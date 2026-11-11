const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { dbAsync } = require("./db");

const uploadsDir = path.join(process.env.DATA_DIR || path.join(os.homedir(), ".inlocuitor_mail_simplificat"), "uploads");

// Determina metoda de trimitere (resend, brevo sau smtp)
function resolveServiceType(settings = {}) {
  if (settings.mail_service_type) return settings.mail_service_type;
  if (process.env.MAIL_SERVICE_TYPE) return process.env.MAIL_SERVICE_TYPE;
  if (process.env.RESEND_API_KEY || (settings.resend_api_key && settings.resend_api_key.trim())) return "resend";
  if (process.env.BREVO_API_KEY || (settings.brevo_api_key && settings.brevo_api_key.trim())) return "brevo";
  return "smtp";
}

// -------------------------------------------------------------
// EXPEDIERE PRIN RESEND API (HTTPS PORT 443 - PERMIS PE RENDER)
// -------------------------------------------------------------
async function sendViaResend({ apiKey, from, to, subject, html, text, attachments = [] }) {
  const payload = {
    from: from,
    to: Array.isArray(to) ? to : [to],
    subject: subject || "(Fără subiect)",
    html: html || undefined,
    text: text || undefined
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map(att => ({
      filename: att.filename,
      content: fs.readFileSync(att.path).toString("base64")
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data.message || data.error || (typeof data === "string" ? data : `Eroare Resend (HTTP ${res.status})`);
    throw new Error(errMsg);
  }

  return { success: true, messageId: data.id || `resend-${Date.now()}` };
}

// -------------------------------------------------------------
// EXPEDIERE PRIN BREVO API (HTTPS PORT 443 - PERMIS PE RENDER)
// -------------------------------------------------------------
async function sendViaBrevo({ apiKey, fromName, fromEmail, to, subject, html, text, attachments = [] }) {
  const payload = {
    sender: { name: fromName || "Expeditor", email: fromEmail },
    to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }],
    subject: subject || "(Fără subiect)",
    htmlContent: html || undefined,
    textContent: text || undefined
  };

  if (attachments && attachments.length > 0) {
    payload.attachment = attachments.map(att => ({
      name: att.filename,
      content: fs.readFileSync(att.path).toString("base64")
    }));
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey.trim(),
      "Content-Type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data.message || `Eroare Brevo (HTTP ${res.status})`;
    throw new Error(errMsg);
  }

  return { success: true, messageId: data.messageId || `brevo-${Date.now()}` };
}

// -------------------------------------------------------------
// EXPEDIERE CLASICA PRIN SMTP (PORT 465 / 587)
// -------------------------------------------------------------
async function createSmtpTransporter(settings = {}, user = null) {
  const host = (user && user.smtp_host) ? user.smtp_host : (settings.smtp_host || "mail.pbasig.ro");
  const port = parseInt((user && user.smtp_port) ? user.smtp_port : (settings.smtp_port || 465));
  
  let secure;
  if (user && user.smtp_secure !== undefined) {
    secure = user.smtp_secure !== 0;
  } else if (settings.smtp_secure !== undefined) {
    secure = settings.smtp_secure !== 0;
  } else {
    secure = port === 465;
  }
  if (port === 465) {
    secure = true;
  } else if (port === 587 || port === 25) {
    secure = false;
  }
  
  const authUser = (user && user.smtp_user && user.smtp_user.trim()) 
    ? user.smtp_user.trim() 
    : ((user && user.imap_user && user.imap_user.trim()) 
        ? user.imap_user.trim() 
        : ((settings.smtp_user && settings.smtp_user.trim()) ? settings.smtp_user.trim() : (settings.username ? settings.username.trim() : "")));
        
  const authPass = (user && user.smtp_pass && user.smtp_pass.trim()) 
    ? user.smtp_pass.trim() 
    : ((user && user.imap_pass && user.imap_pass.trim()) 
        ? user.imap_pass.trim() 
        : ((settings.smtp_pass && settings.smtp_pass.trim()) ? settings.smtp_pass.trim() : (settings.password ? settings.password.trim() : "")));

  if (!host || !authUser || !authPass) {
    throw new Error("Datele SMTP (gazdă, utilizator, parolă) nu sunt configurate complet.");
  }

  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure,
    auth: {
      user: authUser,
      pass: authPass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000
  });

  return { transporter, senderAddress: authUser, host, port };
}

// -------------------------------------------------------------
// TEST CONEXIUNE (SMTP sau HTTPS API)
// -------------------------------------------------------------
async function testSmtpConnection(settings, user = null) {
  const serviceType = resolveServiceType(settings);

  // 1. Test Resend API
  if (serviceType === "resend") {
    const apiKey = (settings.resend_api_key && settings.resend_api_key.trim()) || process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Cheia Resend API nu este configurată.");

    const startTime = Date.now();
    const res = await fetch("https://api.resend.com/api-keys", {
      headers: { "Authorization": `Bearer ${apiKey.trim()}` }
    });
    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Cheie Resend API invalidă (HTTP ${res.status})`);
    }
    return { success: true, latencyMs, serviceType: "resend", message: "Conexiune Resend HTTPS API validată cu succes!" };
  }

  // 2. Test Brevo API
  if (serviceType === "brevo") {
    const apiKey = (settings.brevo_api_key && settings.brevo_api_key.trim()) || process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error("Cheia Brevo API nu este configurată.");

    const startTime = Date.now();
    const res = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey.trim() }
    });
    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Cheie Brevo API invalidă (HTTP ${res.status})`);
    }
    return { success: true, latencyMs, serviceType: "brevo", message: "Conexiune Brevo HTTPS API validată cu succes!" };
  }

  // 3. Test SMTP Clasic
  const { transporter } = await createSmtpTransporter(settings, user);
  const startTime = Date.now();
  await transporter.verify();
  const latencyMs = Date.now() - startTime;
  return { success: true, latencyMs, serviceType: "smtp" };
}

// -------------------------------------------------------------
// EXPEDIERE PRINCIPALA (CU TRANSFORMARE LINK-URI SI ATAȘAMENTE)
// -------------------------------------------------------------
async function sendEmailWithLinks({ settings = {}, user = null, to, subject, bodyHtml, bodyText, documents = [], reqBaseUrl }) {
  let finalHtml = bodyHtml || (bodyText ? bodyText.replace(/\n/g, "<br>") : "");
  let finalText = bodyText || "";

  // Transformare documente în link-uri securizate
  if (documents && documents.length > 0) {
    let docsHtml = `
      <div style="margin-top: 24px; padding: 18px 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-family: sans-serif;">
        <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 15px; display: flex; align-items: center;">
          📎 Documente atașate securizate (Link-uri directe de descărcare):
        </h4>
        <ul style="list-style: none; padding: 0; margin: 0;">
    `;

    let docsText = "\n\n--- Documente atașate securizate (Link-uri de descărcare) ---\n";

    for (const doc of documents) {
      const downloadUrl = `${reqBaseUrl}/api/documents/download/${doc.download_token}`;
      const sizeMb = (doc.file_size / (1024 * 1024)).toFixed(2);
      
      docsHtml += `
        <li style="margin-bottom: 10px; padding: 8px 12px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 600; color: #334155;">${doc.original_filename} <span style="font-size: 12px; color: #64748b; font-weight: normal;">(${sizeMb} MB)</span></span>
          <a href="${downloadUrl}" target="_blank" style="display: inline-block; padding: 6px 14px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 500;">
            📥 Descarcă Fișierul
          </a>
        </li>
      `;

      docsText += `- ${doc.original_filename} (${sizeMb} MB): ${downloadUrl}\n`;
    }

    docsHtml += `
        </ul>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">
          Documentele sunt stocate în siguranță pe server. Apăsați pe butonul de descărcare pentru acces direct.
        </p>
      </div>
    `;

    finalHtml += docsHtml;
    finalText += docsText;
  }

  // Colectare fișiere fizice dacă sunt sub 20MB
  let mimeAttachments = [];
  if (documents && documents.length > 0) {
    let totalSize = 0;
    for (const d of documents) totalSize += (d.file_size || 0);

    if (totalSize < 20 * 1024 * 1024) {
      for (const d of documents) {
        const filePath = path.join(uploadsDir, d.stored_filename);
        if (fs.existsSync(filePath)) {
          mimeAttachments.push({
            filename: d.original_filename,
            path: filePath,
            contentType: d.mime_type || undefined
          });
        }
      }
    }
  }

  const serviceType = resolveServiceType(settings);

  // 1. Trimitere via Resend API
  if (serviceType === "resend") {
    const apiKey = (settings.resend_api_key && settings.resend_api_key.trim()) || process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Cheia Resend API nu este configurată.");

    const senderDisplayName = (user && user.display_name) ? user.display_name : "Înlocuitor Mail";
    // Dacă utilizatorul a configurat un email expeditor dedicat (ex: office@pbasig.ro) sau onboarding@resend.dev
    const fromAddress = settings.api_sender_email && settings.api_sender_email.trim()
      ? `"${senderDisplayName}" <${settings.api_sender_email.trim()}>`
      : (process.env.RESEND_FROM || `"${senderDisplayName}" <onboarding@resend.dev>`);

    const result = await sendViaResend({
      apiKey,
      from: fromAddress,
      to,
      subject,
      html: finalHtml,
      text: finalText,
      attachments: mimeAttachments
    });

    return {
      success: true,
      messageId: result.messageId,
      sender: fromAddress,
      serviceType: "resend",
      documentsTransformedCount: documents.length
    };
  }

  // 2. Trimitere via Brevo API
  if (serviceType === "brevo") {
    const apiKey = (settings.brevo_api_key && settings.brevo_api_key.trim()) || process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error("Cheia Brevo API nu este configurată.");

    const senderDisplayName = (user && user.display_name) ? user.display_name : "Înlocuitor Mail";
    const fromEmail = (settings.api_sender_email && settings.api_sender_email.trim()) 
      || (user && user.email) 
      || (settings.smtp_user && settings.smtp_user.trim())
      || "office@domeniu.ro";

    const result = await sendViaBrevo({
      apiKey,
      fromName: senderDisplayName,
      fromEmail: fromEmail,
      to,
      subject,
      html: finalHtml,
      text: finalText,
      attachments: mimeAttachments
    });

    return {
      success: true,
      messageId: result.messageId,
      sender: fromEmail,
      serviceType: "brevo",
      documentsTransformedCount: documents.length
    };
  }

  // 3. Trimitere via SMTP Clasic
  const { transporter, senderAddress } = await createSmtpTransporter(settings, user);
  const mailOptions = {
    from: `"${(user && user.display_name) ? user.display_name : senderAddress}" <${senderAddress}>`,
    to: to,
    subject: subject || "(Fără subiect)",
    text: finalText,
    html: finalHtml,
    attachments: mimeAttachments.length > 0 ? mimeAttachments : undefined
  };

  const info = await transporter.sendMail(mailOptions);

  return {
    success: true,
    messageId: info.messageId,
    sender: senderAddress,
    serviceType: "smtp",
    documentsTransformedCount: documents.length
  };
}

module.exports = {
  createSmtpTransporter,
  testSmtpConnection,
  sendEmailWithLinks
};
