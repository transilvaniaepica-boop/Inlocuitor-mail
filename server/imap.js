const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { dbAsync } = require('./db');

const uploadsDir = path.join(process.env.DATA_DIR || path.join(require("os").homedir(), ".inlocuitor_mail_simplificat"), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function testImapConnection(settings) {
  const host = settings.host || settings.imap_host;
  const port = parseInt(settings.port || settings.imap_port) || 993;
  const user = settings.username || settings.imap_user;
  const pass = settings.password || settings.imap_pass;
  const tls = (settings.tls !== undefined ? settings.tls !== 0 : (settings.imap_tls !== undefined ? settings.imap_tls !== 0 : true));

  if (!host || !user || !pass) {
    throw new Error('Gazda, utilizatorul și parola IMAP sunt obligatorii.');
  }

  const client = new ImapFlow({
    host: host,
    port: port,
    secure: tls,
    auth: { user: user, pass: pass },
    logger: false,
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });
  client.on('error', (err) => { console.warn('[IMAP Test Client Error Handled]:', err.message); });

  const startTime = Date.now();
  await client.connect();
  const mailboxes = await client.list();
  const latencyMs = Date.now() - startTime;
  await client.logout();

  return {
    success: true,
    latencyMs,
    mailboxCount: mailboxes.length,
    mailboxes: mailboxes.map(m => m.path)
  };
}

async function deleteFromImap(settings, uid) {
  const host = settings.host || settings.imap_host;
  const port = parseInt(settings.port || settings.imap_port) || 993;
  const user = settings.username || settings.imap_user;
  const pass = settings.password || settings.imap_pass;
  const tls = (settings.tls !== undefined ? settings.tls !== 0 : (settings.imap_tls !== undefined ? settings.imap_tls !== 0 : true));

  if (!host || !user || !pass) {
    throw new Error('Setările IMAP nu sunt configurate.');
  }

  const client = new ImapFlow({
    host: host,
    port: port,
    secure: tls,
    auth: { user: user, pass: pass },
    logger: false,
    connectionTimeout: 15000
  });
  client.on('error', (err) => { console.warn('[IMAP Delete Client Error]:', err.message); });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Mark message as \Deleted and expunge
      await client.messageDelete(uid, { uid: true });
      console.log(`[IMAP] Mesajul UID ${uid} a fost șters din INBOX pe server.`);
    } finally {
      lock.release();
    }
    await client.logout();
    return { success: true };
  } catch (err) {
    console.error('[IMAP] Eroare la ștergerea mesajului din server:', err);
    return { success: false, error: err.message };
  }
}

async function syncImap(settings, specificUser = null) {
  const host = (specificUser && specificUser.imap_host) ? specificUser.imap_host : (settings.host || settings.imap_host);
  const port = parseInt((specificUser && specificUser.imap_port) ? specificUser.imap_port : (settings.port || settings.imap_port || 993));
  const tls = (specificUser && specificUser.imap_tls !== undefined) 
    ? (specificUser.imap_tls !== 0) 
    : ((settings.tls !== undefined ? settings.tls !== 0 : (settings.imap_tls !== undefined ? settings.imap_tls !== 0 : true)));

  // Daca utilizatorul are casuta IMAP proprie configurata
  const user = (specificUser && specificUser.imap_user) ? specificUser.imap_user : (settings.username || settings.imap_user);
  const pass = (specificUser && specificUser.imap_pass) ? specificUser.imap_pass : (settings.password || settings.imap_pass);

  if (!host || !user || !pass) {
    return { success: false, message: 'Setările IMAP nu sunt configurate complet.' };
  }

  const client = new ImapFlow({
    host: host,
    port: port,
    secure: tls,
    auth: { user: user, pass: pass },
    logger: false,
    connectionTimeout: 15000
  });
  client.on('error', (err) => { console.warn('[IMAP Sync Client Error Handled]:', err.message); });

  let newCount = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const mailbox = client.mailbox;
      const totalMessages = mailbox.exists || 0;
      if (totalMessages === 0) {
        return { success: true, count: 0, message: 'Căsuța poștală INBOX este goală.' };
      }

      // Prelucram ultimele 30 mesaje
      const fetchRange = `${Math.max(1, totalMessages - 29)}:*`;
      const messages = client.fetch(fetchRange, {
        envelope: true,
        source: true,
        uid: true,
        flags: true
      });

      for await (const msg of messages) {
        try {
          const envelope = msg.envelope;
          const messageId = envelope.messageId || `gen-${msg.uid}-${Date.now()}@local`;

          // Verificam daca emailul exista deja PENTRU ACEST UTILIZATOR
          const userId = specificUser ? specificUser.id : null;
          const existing = await dbAsync.get(
            userId !== null
              ? 'SELECT id FROM emails WHERE (message_id = ? OR (uid = ? AND uid IS NOT NULL)) AND user_id = ?'
              : 'SELECT id FROM emails WHERE (message_id = ? OR (uid = ? AND uid IS NOT NULL)) AND user_id IS NULL',
            userId !== null ? [messageId, msg.uid || 0, userId] : [messageId, msg.uid || 0]
          );
          if (existing) continue;

          // Verificam daca mesajul a fost sters anterior de utilizator
          const wasDeleted = await dbAsync.get(
            userId !== null
              ? 'SELECT id FROM deleted_emails WHERE (message_id = ? OR (uid = ? AND uid IS NOT NULL)) AND user_id = ?'
              : 'SELECT id FROM deleted_emails WHERE (message_id = ? OR (uid = ? AND uid IS NOT NULL)) AND user_id IS NULL',
            userId !== null ? [messageId, msg.uid || 0, userId] : [messageId, msg.uid || 0]
          );
          if (wasDeleted) continue;

          // Parsare continut complet MIME
          const parsed = await simpleParser(msg.source);

          const senderName = envelope.from && envelope.from[0] ? (envelope.from[0].name || envelope.from[0].address) : 'Necunoscut';
          const senderEmail = envelope.from && envelope.from[0] ? envelope.from[0].address : 'unknown@domain.com';
          const recipient = envelope.to && envelope.to[0] ? envelope.to[0].address : user;
          const subject = envelope.subject || '(Fără subiect)';
          const bodyText = parsed.text || '';
          const bodyHtml = parsed.html || '';
          const dateReceived = envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString();

          // Parsare si salvare atasamente fizice pe disc
          const attachments = [];
          if (parsed.attachments && Array.isArray(parsed.attachments)) {
            for (const att of parsed.attachments) {
              const filename = att.filename || 'atasament.bin';
              const size = att.size || (att.content ? att.content.length : 0);
              let downloadToken = null;

              if (att.content && Buffer.isBuffer(att.content)) {
                try {
                  const ext = path.extname(filename);
                  const uniqueName = crypto.randomUUID() + ext;
                  const filePath = path.join(uploadsDir, uniqueName);
                  fs.writeFileSync(filePath, att.content);

                  downloadToken = crypto.randomBytes(24).toString('hex');
                  await dbAsync.run(`
                    INSERT INTO uploaded_documents 
                      (download_token, original_filename, stored_filename, file_size, mime_type, uploader_user_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                  `, [
                    downloadToken,
                    filename,
                    uniqueName,
                    size,
                    att.contentType || 'application/octet-stream',
                    userId
                  ]);
                } catch (saveErr) {
                  console.error('[IMAP] Eroare la salvarea atasamentului:', saveErr);
                }
              }

              attachments.push({
                filename: filename,
                contentType: att.contentType,
                size: size,
                download_token: downloadToken
              });
            }
          }

          await dbAsync.run(`
            INSERT INTO emails 
              (message_id, uid, folder, sender_name, sender_email, recipient, subject, body_text, body_html, date_received, attachments_json, user_id)
            VALUES (?, ?, 'INBOX', ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            messageId,
            msg.uid,
            senderName,
            senderEmail,
            recipient,
            subject,
            bodyText,
            bodyHtml,
            dateReceived,
            JSON.stringify(attachments),
            userId
          ]);

          newCount++;
        } catch (msgErr) {
          console.error('[IMAP] Eroare la procesarea unui mesaj:', msgErr);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    // Actualizam last_sync in setari
    await dbAsync.run('UPDATE imap_settings SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'INFO',
      `Sincronizare IMAP finalizată cu succes. ${newCount} e-mailuri noi descărcate.`,
      'IMAP_SYNC'
    ]);

    return { success: true, count: newCount };
  } catch (err) {
    console.error('[IMAP] Eroare conexiune:', err);
    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'ERROR',
      `Eroare sincronizare IMAP: ${err.message}`,
      'IMAP_SYNC'
    ]);
    return { success: false, error: err.message };
  }
}

module.exports = {
  testImapConnection,
  deleteFromImap,
  syncImap
};
