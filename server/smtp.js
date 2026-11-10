const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { dbAsync } = require("./db");

const uploadsDir = path.join(process.env.DATA_DIR || path.join(os.homedir(), ".inlocuitor_mail_simplificat"), "uploads");

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
    secure: secure, // true pt 465, false pt 587 STARTTLS
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

async function testSmtpConnection(settings, user = null) {
  const { transporter } = await createSmtpTransporter(settings, user);
  const startTime = Date.now();
  await transporter.verify();
  const latencyMs = Date.now() - startTime;
  return { success: true, latencyMs };
}

async function sendEmailWithLinks({ settings, user, to, subject, bodyHtml, bodyText, documents = [], reqBaseUrl }) {
  const { transporter, senderAddress } = await createSmtpTransporter(settings, user);

  let finalHtml = bodyHtml || (bodyText ? bodyText.replace(/\n/g, "<br>") : "");
  let finalText = bodyText || "";

  // Daca exista documente incarcate, transformam automat in bloc de link-uri de descarcare securizata
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

  // Daca fisierele sunt sub 20MB in total, le trimitem si ca atasamente directe MIME
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
    documentsTransformedCount: documents.length
  };
}

module.exports = {
  createSmtpTransporter,
  testSmtpConnection,
  sendEmailWithLinks
};
