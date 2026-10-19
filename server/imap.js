const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { dbAsync } = require('./db');

async function testImapConnection(settings) {
  const host = settings.host;
  const port = parseInt(settings.port) || 993;
  const user = settings.username;
  const pass = settings.password;
  const tls = settings.tls !== 0;

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

async function syncImap(settings, specificUser = null) {
  const host = settings.host;
  const port = parseInt(settings.port) || 993;
  const tls = settings.tls !== 0;

  // Daca utilizatorul are casuta IMAP proprie configurata
  const user = (specificUser && specificUser.imap_user) ? specificUser.imap_user : settings.username;
  const pass = (specificUser && specificUser.imap_pass) ? specificUser.imap_pass : settings.password;

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

          // Verificam daca emailul exista deja
          const existing = await dbAsync.get('SELECT id FROM emails WHERE message_id = ?', [messageId]);
          if (existing) continue;

          // Parsare continut complet MIME
          const parsed = await simpleParser(msg.source);

          const senderName = envelope.from && envelope.from[0] ? (envelope.from[0].name || envelope.from[0].address) : 'Necunoscut';
          const senderEmail = envelope.from && envelope.from[0] ? envelope.from[0].address : 'unknown@domain.com';
          const recipient = envelope.to && envelope.to[0] ? envelope.to[0].address : user;
          const subject = envelope.subject || '(Fără subiect)';
          const bodyText = parsed.text || '';
          const bodyHtml = parsed.html || '';
          const dateReceived = envelope.date ? new Date(envelope.date).toISOString() : new Date().toISOString();

          // Parsare atasamente
          const attachments = (parsed.attachments || []).map(att => ({
            filename: att.filename || 'atasament.bin',
            contentType: att.contentType,
            size: att.size
          }));

          await dbAsync.run(`
            INSERT INTO emails 
              (message_id, uid, folder, sender_name, sender_email, recipient, subject, body_text, body_html, date_received, attachments_json)
            VALUES (?, ?, 'INBOX', ?, ?, ?, ?, ?, ?, ?, ?)
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
            JSON.stringify(attachments)
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
  syncImap
};
