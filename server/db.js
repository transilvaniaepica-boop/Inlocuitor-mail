const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db = null;
let dbAsync = null;

const isTurso = Boolean(process.env.TURSO_DATABASE_URL);

if (isTurso) {
  const { createClient } = require('@libsql/client');
  const tursoClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  console.log('[DB] Conectat la Turso Cloud SQLite:', process.env.TURSO_DATABASE_URL);

  dbAsync = {
    all: async (query, params = []) => {
      const res = await tursoClient.execute({ sql: query, args: params });
      return res.rows;
    },
    get: async (query, params = []) => {
      const res = await tursoClient.execute({ sql: query, args: params });
      return res.rows[0] || null;
    },
    run: async (query, params = []) => {
      const res = await tursoClient.execute({ sql: query, args: params });
      return {
        id: res.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : 0,
        changes: res.rowsAffected || 0
      };
    }
  };

  db = {
    serialize: (fn) => fn(),
    run: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      dbAsync.run(sql, params).then(res => cb && cb.call(res, null)).catch(err => cb && cb(err));
    },
    get: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      dbAsync.get(sql, params).then(res => cb && cb(null, res)).catch(err => cb && cb(err));
    },
    all: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      dbAsync.all(sql, params).then(res => cb && cb(null, res)).catch(err => cb && cb(err));
    }
  };
} else {
  const sqlite3 = require('sqlite3').verbose();
  const getDbDir = () => {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/data')) {
      return '/data';
    }
    const localDir = path.join(process.env.HOME || '/tmp', '.inlocuitor_mail_simplificat');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return localDir;
  };
  const dbDir = getDbDir();
  const dbPath = path.join(dbDir, 'database.sqlite');
  console.log('[DB] SQLite Database local:', dbPath);

  const localDb = new sqlite3.Database(dbPath);
  db = localDb;

  dbAsync = {
    all: (query, params = []) => new Promise((resolve, reject) => {
      localDb.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    }),
    get: (query, params = []) => new Promise((resolve, reject) => {
      localDb.get(query, params, (err, row) => (err ? reject(err) : resolve(row)));
    }),
    run: (query, params = []) => new Promise((resolve, reject) => {
      localDb.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    })
  };
}

async function initDatabase() {
  try {
    // 1. SETARI ADMIN
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id INTEGER PRIMARY KEY,
        admin_password_hash TEXT NOT NULL,
        session_secret TEXT DEFAULT 'mail-simplificat-2026-secret',
        app_title TEXT DEFAULT 'Înlocuitor Mail Simplificat',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. UTILIZATORI
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        job_title TEXT,
        hierarchy_id INTEGER,
        two_factor_enabled INTEGER DEFAULT 0,
        two_factor_secret TEXT,
        smtp_host TEXT,
        smtp_port INTEGER DEFAULT 465,
        smtp_secure INTEGER DEFAULT 1,
        smtp_user TEXT,
        smtp_pass TEXT,
        imap_host TEXT,
        imap_port INTEGER DEFAULT 993,
        imap_tls INTEGER DEFAULT 1,
        imap_user TEXT,
        imap_pass TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // 3. SETARI IMAP
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS imap_settings (
        id INTEGER PRIMARY KEY,
        host TEXT DEFAULT 'mail.pbasig.ro',
        port INTEGER DEFAULT 993,
        tls INTEGER DEFAULT 1,
        username TEXT DEFAULT '',
        password TEXT DEFAULT '',
        smtp_host TEXT DEFAULT 'mail.pbasig.ro',
        smtp_port INTEGER DEFAULT 465,
        smtp_secure INTEGER DEFAULT 1,
        smtp_user TEXT DEFAULT '',
        smtp_pass TEXT DEFAULT '',
        mail_service_type TEXT DEFAULT 'smtp',
        resend_api_key TEXT DEFAULT '',
        brevo_api_key TEXT DEFAULT '',
        api_sender_email TEXT DEFAULT '',
        auto_sync INTEGER DEFAULT 1,
        sync_interval INTEGER DEFAULT 5,
        last_sync DATETIME
      )
    `);

    // 4. STRUCTURI IERARHICE
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS hierarchy_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER DEFAULT NULL,
        name TEXT NOT NULL,
        code TEXT,
        description TEXT,
        level_depth INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        color TEXT DEFAULT '#3b82f6',
        icon TEXT DEFAULT 'folder',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. EMAILS
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT,
        uid INTEGER,
        folder TEXT DEFAULT 'INBOX',
        sender_name TEXT,
        sender_email TEXT,
        recipient TEXT,
        subject TEXT,
        body_text TEXT,
        body_html TEXT,
        date_received DATETIME DEFAULT CURRENT_TIMESTAMP,
        hierarchy_id INTEGER,
        is_read INTEGER DEFAULT 0,
        is_flagged INTEGER DEFAULT 0,
        attachments_json TEXT DEFAULT '[]',
        user_id INTEGER
      )
    `);

    // 6. LOGS
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT DEFAULT 'INFO',
        message TEXT NOT NULL,
        source TEXT DEFAULT 'SYSTEM',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. DOCUMENTE INCARCATE
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS uploaded_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        download_token TEXT UNIQUE NOT NULL,
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT,
        uploader_user_id INTEGER,
        email_id INTEGER,
        download_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. MESAJE STERSE
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS deleted_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        uid INTEGER,
        user_id INTEGER NOT NULL,
        sender_email TEXT,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_from_imap INTEGER DEFAULT 0
      )
    `);

    // 9. EXCEPTII DE LA STERGERE
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS delete_exceptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL UNIQUE,
        description TEXT,
        added_by_admin INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexuri
    await dbAsync.run('CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id)');
    await dbAsync.run('CREATE INDEX IF NOT EXISTS idx_emails_user_msg ON emails(user_id, message_id)');
    await dbAsync.run('CREATE INDEX IF NOT EXISTS idx_deleted_emails_user_msg ON deleted_emails(user_id, message_id)');
    await dbAsync.run('CREATE INDEX IF NOT EXISTS idx_deleted_emails_user_uid ON deleted_emails(user_id, uid)');

    // Migrari sigure pentru baze de date existente
    const safeAlter = async (sql) => { try { await dbAsync.run(sql); } catch (_) {} };
    await safeAlter('ALTER TABLE users ADD COLUMN hierarchy_id INTEGER');
    await safeAlter('ALTER TABLE users ADD COLUMN job_title TEXT');
    await safeAlter('ALTER TABLE users ADD COLUMN imap_user TEXT');
    await safeAlter('ALTER TABLE users ADD COLUMN imap_pass TEXT');
    await safeAlter('ALTER TABLE users ADD COLUMN smtp_host TEXT');
    await safeAlter('ALTER TABLE users ADD COLUMN smtp_port INTEGER DEFAULT 465');
    await safeAlter('ALTER TABLE users ADD COLUMN smtp_secure INTEGER DEFAULT 1');
    await safeAlter('ALTER TABLE users ADD COLUMN smtp_user TEXT');
    await safeAlter('ALTER TABLE users ADD COLUMN smtp_pass TEXT');
    await safeAlter('ALTER TABLE users ADD COLUMN imap_host TEXT');
    await safeAlter('ALTER TABLE users ADD COLUMN imap_port INTEGER DEFAULT 993');
    await safeAlter('ALTER TABLE users ADD COLUMN imap_tls INTEGER DEFAULT 1');
    await safeAlter("ALTER TABLE imap_settings ADD COLUMN smtp_host TEXT DEFAULT 'mail.pbasig.ro'");
    await safeAlter('ALTER TABLE imap_settings ADD COLUMN smtp_port INTEGER DEFAULT 465');
    await safeAlter('ALTER TABLE imap_settings ADD COLUMN smtp_secure INTEGER DEFAULT 1');
    await safeAlter("ALTER TABLE imap_settings ADD COLUMN smtp_user TEXT DEFAULT ''");
    await safeAlter("ALTER TABLE imap_settings ADD COLUMN smtp_pass TEXT DEFAULT ''");
    await safeAlter("ALTER TABLE imap_settings ADD COLUMN mail_service_type TEXT DEFAULT 'smtp'");
    await safeAlter("ALTER TABLE imap_settings ADD COLUMN resend_api_key TEXT DEFAULT ''");
    await safeAlter("ALTER TABLE imap_settings ADD COLUMN brevo_api_key TEXT DEFAULT ''");
    await safeAlter("ALTER TABLE imap_settings ADD COLUMN api_sender_email TEXT DEFAULT ''");
    await safeAlter('ALTER TABLE emails ADD COLUMN user_id INTEGER');

    // Initializare parola admin (admin1234)
    const adminRow = await dbAsync.get('SELECT COUNT(*) as count FROM admin_settings');
    if (!adminRow || Number(adminRow.count) === 0) {
      const defaultHash = bcrypt.hashSync('admin1234', 10);
      await dbAsync.run('INSERT INTO admin_settings (id, admin_password_hash) VALUES (1, ?)', [defaultHash]);
      console.log('[DB] Setata parola implicita de administrare: admin1234');
    }

    // Initializare setari IMAP globale
    const imapRow = await dbAsync.get('SELECT COUNT(*) as count FROM imap_settings');
    if (!imapRow || Number(imapRow.count) === 0) {
      await dbAsync.run(`
        INSERT INTO imap_settings (id, host, port, tls, username, password)
        VALUES (1, 'mail.pbasig.ro', 993, 1, 'office@pbasig.ro', '')
      `);
    }

    // Initializare utilizatori demonstrativi
    const usersRow = await dbAsync.get('SELECT COUNT(*) as count FROM users');
    if (!usersRow || Number(usersRow.count) === 0) {
      const hash1 = bcrypt.hashSync('utilizator123', 10);
      const hash2 = bcrypt.hashSync('operator123', 10);
      await dbAsync.run(`
        INSERT INTO users (username, display_name, password_hash, email, role, two_factor_enabled)
        VALUES 
          ('utilizator', 'Utilizator Normal', ?, 'utilizator@companie.ro', 'user', 0),
          ('operator', 'Operator (Cu 2FA Google)', ?, 'operator@companie.ro', 'operator', 0)
      `, [hash1, hash2]);
      console.log('[DB] Creati utilizatori demonstrativi (utilizator / utilizator123, operator / operator123)');
    }

    // Initializare structuri ierarhice demonstrative
    const hRow = await dbAsync.get('SELECT COUNT(*) as count FROM hierarchy_nodes');
    if (!hRow || Number(hRow.count) === 0) {
      const r1 = await dbAsync.run(
        'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (NULL, ?, ?, ?, 1, 1, ?, ?)',
        ['Direcția Generală Executivă', 'DG', 'Conducerea companiei și decizii strategice', '#4f46e5', 'briefcase']
      );
      const r2 = await dbAsync.run(
        'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (NULL, ?, ?, ?, 1, 2, ?, ?)',
        ['Departament Operațiuni & Asigurări', 'DOA', 'Gestionare dosare, polițe și corespondență clienți', '#0284c7', 'file-text']
      );
      const r3 = await dbAsync.run(
        'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (NULL, ?, ?, ?, 1, 3, ?, ?)',
        ['Departament Suport & IT', 'DIT', 'Infrastructură, securitate și asistență tehnică', '#059669', 'server']
      );

      const sub1 = await dbAsync.run(
        'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (?, ?, ?, ?, 2, 1, ?, ?)',
        [r2.id, 'Divizia Clienți Corporate & Flote', 'CORP', 'Asigurări companii mari și leasing', '#2563eb', 'building']
      );
      const sub2 = await dbAsync.run(
        'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (?, ?, ?, ?, 2, 2, ?, ?)',
        [r2.id, 'Divizia Asigurări Persoane Fizice', 'RETAIL', 'Polițe RCA, CASCO și călătorie', '#d97706', 'users']
      );

      const subSub1 = await dbAsync.run(
        'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (?, ?, ?, ?, 3, 1, ?, ?)',
        [sub1.id, 'Sectorul Leasing & Finanțări', 'LEASING', 'Parteneriate cu bănci și societăți leasing', '#7c3aed', 'landmark']
      );

      const subSubSub1 = await dbAsync.run(
        'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (?, ?, ?, ?, 4, 1, ?, ?)',
        [subSub1.id, 'Flote Vehicule Comerciale Grele', 'TIR', 'Asigurări transportatori marfă și camioane', '#db2777', 'truck']
      );

      await dbAsync.run(`
        INSERT INTO emails (message_id, sender_name, sender_email, recipient, subject, body_text, body_html, hierarchy_id, is_read, is_flagged)
        VALUES 
          ('demo-msg-1@example.com', 'Unicredit Leasing Fleet', 'flote@unicredit-leasing.ro', 'office@pbasig.ro', 
           'Solicitare reînnoire polițe CASCO flotă 50 camioane', 
           'Bună ziua,\\n\\nVă transmitem anexată lista capetelor tractor pentru oferta de reînnoire a polițelor CASCO pe anul 2026.\\n\\nCu stimă,\\nEchipa Gestionare Flote', 
           '<p>Bună ziua,</p><p>Vă transmitem anexată lista capetelor tractor pentru oferta de reînnoire a polițelor CASCO pe anul 2026.</p><p><strong>Cu stimă,</strong><br>Echipa Gestionare Flote</p>', 
           ?, 1, 1),
          ('demo-msg-2@example.com', 'Alexandru Popa', 'a.popa@gmail.com', 'office@pbasig.ro', 
           'Actualizare date contact pentru polița de locuință PAD', 
           'Buna ziua,\\n\\nAm schimbat numarul de telefon si doresc actualizarea acestuia pe polita de locuinta.\\n\\nMultumesc,\\nAlexandru Popa', 
           '<p>Buna ziua,</p><p>Am schimbat numarul de telefon si doresc actualizarea acestuia pe polita de locuinta.</p><p>Multumesc,<br>Alexandru Popa</p>', 
           ?, 0, 0),
          ('demo-msg-3@example.com', 'Centru Notificări IT', 'alert@server-security.net', 'office@pbasig.ro', 
           'Raport zilnic: Sincronizare IMAP și certificate SSL active', 
           'Toate conexiunile SSL/TLS pe portul 993 funcționează optim. Fără erori înregistrate în ultimele 24 de ore.', 
           '<p>Toate conexiunile SSL/TLS pe portul 993 funcționează optim. Fără erori înregistrate în ultimele 24 de ore.</p>', 
           ?, 1, 0)
      `, [subSubSub1.id, sub2.id, r3.id]);
    }
  } catch (err) {
    console.error('[DB] Eroare initializare schema:', err);
  }
}

initDatabase();

module.exports = { db, dbAsync };
