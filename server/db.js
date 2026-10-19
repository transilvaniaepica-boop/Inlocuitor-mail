const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Stocare baza de date intr-o cale locala sigura pentru a preveni SIGBUS pe unitati externe exFAT/SMB
const localDir = path.join(process.env.HOME || '/tmp', '.inlocuitor_mail_simplificat');
if (!fs.existsSync(localDir)) {
  fs.mkdirSync(localDir, { recursive: true });
}
const dbPath = path.join(localDir, 'database.sqlite');
console.log('[DB] Local SQLite Database:', dbPath);

const db = new sqlite3.Database(dbPath);

const dbAsync = {
  all: (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  }),
  get: (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => (err ? reject(err) : resolve(row)));
  }),
  run: (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  })
};

db.serialize(async () => {
  // 1. SETARI ADMIN (Parola separata de administrare)
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY,
      admin_password_hash TEXT NOT NULL,
      session_secret TEXT DEFAULT 'mail-simplificat-2026-secret',
      app_title TEXT DEFAULT 'Înlocuitor Mail Simplificat',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. UTILIZATORI (Cu suport Google 2FA Authenticator)
  db.run(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      FOREIGN KEY(hierarchy_id) REFERENCES hierarchy_nodes(id) ON DELETE SET NULL
    )
  `);

  // 3. SETARI IMAP
  db.run(`
    CREATE TABLE IF NOT EXISTS imap_settings (
      id INTEGER PRIMARY KEY,
      host TEXT DEFAULT 'mail.pbasig.ro',
      port INTEGER DEFAULT 993,
      tls INTEGER DEFAULT 1,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      auto_sync INTEGER DEFAULT 1,
      sync_interval INTEGER DEFAULT 5,
      last_sync DATETIME
    )
  `);

  // 4. STRUCTURI IERARHICE (Oricate nivele nelimitate)
  db.run(`
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(parent_id) REFERENCES hierarchy_nodes(id) ON DELETE CASCADE
    )
  `);

  // 5. EMAILS (Mesaje IMAP asociate structurilor ierarhice)
  db.run(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
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
      FOREIGN KEY(hierarchy_id) REFERENCES hierarchy_nodes(id) ON DELETE SET NULL
    )
  `);

  // 6. LOGS
  db.run(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT DEFAULT 'INFO',
      message TEXT NOT NULL,
      source TEXT DEFAULT 'SYSTEM',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initializare parola de administrare (Default: admin1234)
  db.get('SELECT COUNT(*) as count FROM admin_settings', [], (err, row) => {
    if (!err && row && row.count === 0) {
      const defaultHash = bcrypt.hashSync('admin1234', 10);
      db.run('INSERT INTO admin_settings (id, admin_password_hash) VALUES (1, ?)', [defaultHash]);
      console.log('[DB] Setata parola implicita de administrare: admin1234');
    }
  });

  // Initializare setari IMAP
  db.get('SELECT COUNT(*) as count FROM imap_settings', [], (err, row) => {
    if (!err && row && row.count === 0) {
      db.run(`
        INSERT INTO imap_settings (id, host, port, tls, username, password)
        VALUES (1, 'mail.pbasig.ro', 993, 1, 'office@pbasig.ro', '')
      `);
    }
  });

  // Initializare utilizatori demonstrativi
  db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
    if (!err && row && row.count === 0) {
      const hash1 = bcrypt.hashSync('utilizator123', 10);
      const hash2 = bcrypt.hashSync('operator123', 10);
      db.run(`
        INSERT INTO users (username, display_name, password_hash, email, role, two_factor_enabled)
        VALUES 
          ('utilizator', 'Utilizator Normal', ?, 'utilizator@companie.ro', 'user', 0),
          ('operator', 'Operator (Cu 2FA Google)', ?, 'operator@companie.ro', 'operator', 0)
      `, [hash1, hash2]);
      console.log('[DB] Creati utilizatori demonstrativi (utilizator / utilizator123, operator / operator123)');
    }
  });

  // Initializare structuri ierarhice demonstrative (4 nivele imbricate)
  db.get('SELECT COUNT(*) as count FROM hierarchy_nodes', [], async (err, row) => {
    if (!err && row && row.count === 0) {
      try {
        // Nivel 1: Radacini
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

        // Nivel 2: Subnivele sub Departamentul Operațiuni
        const sub1 = await dbAsync.run(
          'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (?, ?, ?, ?, 2, 1, ?, ?)',
          [r2.id, 'Divizia Clienți Corporate & Flote', 'CORP', 'Asigurări companii mari și leasing', '#2563eb', 'building']
        );
        const sub2 = await dbAsync.run(
          'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (?, ?, ?, ?, 2, 2, ?, ?)',
          [r2.id, 'Divizia Asigurări Persoane Fizice', 'RETAIL', 'Polițe RCA, CASCO și călătorie', '#d97706', 'users']
        );

        // Nivel 3: Subnivel sub Divizia Corporate
        const subSub1 = await dbAsync.run(
          'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (?, ?, ?, ?, 3, 1, ?, ?)',
          [sub1.id, 'Sectorul Leasing & Finanțări', 'LEASING', 'Parteneriate cu bănci și societăți leasing', '#7c3aed', 'landmark']
        );

        // Nivel 4: Subnivel sub Sectorul Leasing (Demonstratie Nivel 4)
        const subSubSub1 = await dbAsync.run(
          'INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, sort_order, color, icon) VALUES (?, ?, ?, ?, 4, 1, ?, ?)',
          [subSub1.id, 'Flote Vehicule Comerciale Grele', 'TIR', 'Asigurări transportatori marfă și camioane', '#db2777', 'truck']
        );

        // Seed email-uri demonstrative asociate ierarhiei
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

        console.log('[DB] Structuri ierarhice pe 4 nivele si email-uri demonstrative seed-uite cu succes!');
      } catch (err) {
        console.error('[DB] Eroare la seed ierarhie:', err);
      }
    }
  });
});

module.exports = { db, dbAsync };

  // Migrari sigure pentru coloane utilizator
  db.run("ALTER TABLE users ADD COLUMN hierarchy_id INTEGER", () => {});
  db.run("ALTER TABLE users ADD COLUMN job_title TEXT", () => {});
