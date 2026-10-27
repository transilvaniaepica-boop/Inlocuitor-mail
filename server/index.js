
// Global process error handlers to prevent unhandled socket timeouts from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { db, dbAsync } = require('./db');
const { generateSecret, getOtpAuthUrl, generateQRCodeDataUrl, verifyTOTP } = require('./totp');
const { testImapConnection, syncImap } = require('./imap');
const crypto = require("crypto");
const multer = require("multer");
const { testSmtpConnection, sendEmailWithLinks } = require("./smtp");

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// Configurare director uploads pentru pastrarea documentelor
const uploadsDir = path.join(process.env.DATA_DIR || path.join(require("os").homedir(), ".inlocuitor_mail_simplificat"), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = crypto.randomUUID() + ext;
    cb(null, uniqueName);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // pana la 50MB per fisier
});


app.use(session({
  secret: process.env.SESSION_SECRET || 'inlocuitor-mail-simplificat-super-secure-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // http
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 ore
  }
}));

// Middlewares
function requireUser(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Trebuie să fiți autentificat ca utilizator.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Acces interzis. Necesită autentificare în panoul de administrare.' });
  }
  next();
}

// ========================================================
// 1. AUTENTIFICARE UTILIZATORI (Cu suport Google 2FA TOTP)
// ========================================================

// Pasul 1: Verificare utilizator și parolă
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Numele de utilizator și parola sunt obligatorii.' });
    }

    const user = await dbAsync.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Credențiale incorecte.' });
    }

    const passMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passMatch) {
      return res.status(401).json({ error: 'Credențiale incorecte.' });
    }

    // Dacă utilizatorul are 2FA activat prin Google
    if (user.two_factor_enabled && user.two_factor_secret) {
      req.session.pendingUserId = user.id;
      return res.json({
        requires2FA: true,
        message: 'Introduceți codul de 6 cifre generat de Google Authenticator de pe telefonul dumneavoastră.'
      });
    }

    // Fără 2FA: autentificare directă
    req.session.userId = user.id;
    await dbAsync.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        role: user.role,
        twoFactorEnabled: Boolean(user.two_factor_enabled)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Eroare la autentificare: ' + err.message });
  }
});

// Pasul 2: Verificare cod 2FA din Google Authenticator
app.post('/api/auth/verify-2fa', async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.session.pendingUserId;

    if (!userId) {
      return res.status(400).json({ error: 'Sesiunea de autentificare a expirat. Reluați pasul 1.' });
    }

    const checkToken = token ? token.toString().replace(/\D/g, '') : '';
    if (checkToken.length !== 6) {
      return res.status(400).json({ error: 'Codul de verificare trebuie să conțină exact 6 cifre.' });
    }

    const user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ error: 'Configurația 2FA a utilizatorului nu este validă.' });
    }

    const cleanToken = token ? token.toString().replace(/\D/g, "") : "";
    const isValid = verifyTOTP(cleanToken, user.two_factor_secret, 4);
    console.log();
    if (!isValid) {
      return res.status(401).json({ error: 'Codul din Google Authenticator este incorect sau a expirat.' });
    }

    // Validare cu succes
    delete req.session.pendingUserId;
    req.session.userId = user.id;
    await dbAsync.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        role: user.role,
        twoFactorEnabled: true
      }
    });
  } catch (err) {
    console.error('2FA error:', err);
    res.status(500).json({ error: 'Eroare la verificarea 2FA: ' + err.message });
  }
});

// Informatii utilizator curent

// Generator cod 2FA direct in browser (fara telefon, pentru testare si utilizare din browser)
app.get('/api/auth/current-2fa-token', async (req, res) => {
  try {
    const userId = req.session.pendingUserId || req.session.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Nicio sesiune de autentificare activă.' });
    }

    const user = await dbAsync.get('SELECT username, two_factor_secret FROM users WHERE id = ?', [userId]);
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ error: 'Utilizatorul nu are 2FA configurat.' });
    }

    const step = 30;
    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSeconds = step - (nowSec % step);
    const { generateTOTP } = require('./totp');
    const token = generateTOTP(user.two_factor_secret);

    res.json({
      success: true,
      token,
      remainingSeconds,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generator cod 2FA pentru admin (vizualizare live cod in panou fara telefon)
app.get('/api/admin/users/:id/current-token', requireAdmin, async (req, res) => {
  try {
    const user = await dbAsync.get('SELECT username, two_factor_secret FROM users WHERE id = ?', [req.params.id]);
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ error: 'Utilizatorul nu are cheie secretă 2FA.' });
    }
    const step = 30;
    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSeconds = step - (nowSec % step);
    const { generateTOTP } = require('./totp');
    const token = generateTOTP(user.two_factor_secret);

    res.json({
      success: true,
      token,
      remainingSeconds,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ user: null });
    }
    const user = await dbAsync.get(`
      SELECT u.id, u.username, u.display_name, u.email, u.role, u.job_title, u.hierarchy_id, u.imap_host, u.imap_port, u.imap_tls, u.imap_user, (CASE WHEN u.imap_pass IS NOT NULL AND u.imap_pass != '' THEN 1 ELSE 0 END) as has_imap_pass, u.smtp_host, u.smtp_port, u.smtp_secure, u.smtp_user, (CASE WHEN u.smtp_pass IS NOT NULL AND u.smtp_pass != '' THEN 1 ELSE 0 END) as has_smtp_pass, u.two_factor_enabled,
             h.name as hierarchy_name, h.color as hierarchy_color, h.level_depth
      FROM users u
      LEFT JOIN hierarchy_nodes h ON u.hierarchy_id = h.id
      WHERE u.id = ?
    `, [req.session.userId]);
    if (!user) {
      req.session.userId = null;
      return res.json({ user: null });
    }
    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        role: user.role,
        jobTitle: user.job_title,
        hierarchyId: user.hierarchy_id,
        hierarchyName: user.hierarchy_name,
        hierarchyColor: user.hierarchy_color,
        levelDepth: user.level_depth,
        twoFactorEnabled: Boolean(user.two_factor_enabled),
        imapHost: user.imap_host,
        imapPort: user.imap_port,
        imapTls: user.imap_tls,
        imapUser: user.imap_user,
        hasImapPass: Boolean(user.has_imap_pass),
        smtpHost: user.smtp_host,
        smtpPort: user.smtp_port,
        smtpSecure: user.smtp_secure,
        smtpUser: user.smtp_user,
        hasSmtpPass: Boolean(user.has_smtp_pass)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deconectare utilizator
app.post('/api/auth/logout', (req, res) => {
  req.session.userId = null;
  res.json({ success: true });
});

// ========================================================
// 2. PANOU DE ADMINISTRARE CU PAROLĂ SEPARATĂ
// ========================================================

// Autentificare in administrare cu parola separata
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Parola de administrare este obligatorie.' });
    }

    const adminRow = await dbAsync.get('SELECT admin_password_hash FROM admin_settings WHERE id = 1');
    if (!adminRow) {
      return res.status(500).json({ error: 'Tabela de setări admin nu a fost inițializată.' });
    }

    const isMatch = bcrypt.compareSync(password, adminRow.admin_password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Parola de administrare este incorectă!' });
    }

    req.session.isAdmin = true;
    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'INFO',
      'Autentificare reușită în Panoul de Administrare (cu parolă dedicată).',
      'ADMIN_AUTH'
    ]);

    res.json({ success: true, isAdmin: true });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la verificare parola admin: ' + err.message });
  }
});

// Verificare status admin
app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: Boolean(req.session.isAdmin) });
});

// Deconectare din panoul de administrare
app.post('/api/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ success: true });
});

// Schimbare parola dedicată de administrare
app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Noua parolă de administrare trebuie să aibă minim 4 caractere.' });
    }

    const adminRow = await dbAsync.get('SELECT admin_password_hash FROM admin_settings WHERE id = 1');
    if (adminRow) {
      const match = bcrypt.compareSync(currentPassword, adminRow.admin_password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Parola actuală de administrare este incorectă.' });
      }
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await dbAsync.run('UPDATE admin_settings SET admin_password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [newHash]);
    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'WARN',
      'Parola dedicată a Panoului de Administrare a fost actualizată.',
      'ADMIN_SECURITY'
    ]);

    res.json({ success: true, message: 'Parola de administrare a fost actualizată cu succes!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 3. STRUCTURI IERARHICE PE ORICATE NIVELE (UNLIMITED DEPTH)
// ========================================================

// Functie recursiva de calculare arbore ierarhic
function buildHierarchyTree(nodes, parentId = null) {
  return nodes
    .filter(node => node.parent_id === parentId)
    .sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id))
    .map(node => ({
      ...node,
      children: buildHierarchyTree(nodes, node.id)
    }));
}

// Returneaza structurile ierarhice (format arbore si format plat cu numarul de email-uri si utilizatori asignati)
app.get('/api/hierarchy', async (req, res) => {
  try {
    const allUsers = await dbAsync.all(`
      SELECT id, username, display_name, job_title, role, hierarchy_id 
      FROM users WHERE hierarchy_id IS NOT NULL
    `);

    const nodes = await dbAsync.all(`
      SELECT h.*, 
        (SELECT COUNT(*) FROM emails WHERE emails.hierarchy_id = h.id) as email_count
      FROM hierarchy_nodes h
      ORDER BY h.level_depth ASC, h.sort_order ASC, h.id ASC
    `);

    // Calculare email_count recursiv (insumeaza si descendentii)
    const emailCounts = {};
    nodes.forEach(n => { emailCounts[n.id] = n.email_count; });

    function getSubtreeEmailCount(nodeId) {
      let count = emailCounts[nodeId] || 0;
      const children = nodes.filter(n => n.parent_id === nodeId);
      for (const ch of children) {
        count += getSubtreeEmailCount(ch.id);
      }
      return count;
    }

    const enhancedNodes = nodes.map(n => ({
      ...n,
      total_emails: getSubtreeEmailCount(n.id),
      users: allUsers.filter(u => u.hierarchy_id === n.id)
    }));

    const tree = buildHierarchyTree(enhancedNodes, null);

    res.json({
      tree: tree,
      flat: enhancedNodes
    });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la obținerea ierarhiei: ' + err.message });
  }
});

// Creare nod ierarhic (la radacina daca parent_id este null sau la orice adancime)
app.post('/api/hierarchy', requireAdmin, async (req, res) => {
  try {
    const { parent_id, name, code, description, color, icon } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Denumirea nivelului este obligatorie.' });
    }

    let level_depth = 1;
    if (parent_id) {
      const parent = await dbAsync.get('SELECT level_depth FROM hierarchy_nodes WHERE id = ?', [parent_id]);
      if (parent) {
        level_depth = parent.level_depth + 1;
      }
    }

    const result = await dbAsync.run(`
      INSERT INTO hierarchy_nodes (parent_id, name, code, description, level_depth, color, icon)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      parent_id ? parseInt(parent_id) : null,
      name.trim(),
      code ? code.trim() : null,
      description ? description.trim() : null,
      level_depth,
      color || '#3b82f6',
      icon || 'folder'
    ]);

    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'INFO',
      `Adăugat nivel ierarhic nou: "${name.trim()}" (Nivelul ${level_depth})`,
      'HIERARCHY'
    ]);

    res.json({ success: true, id: result.id, level_depth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editare denumire și proprietăți nivel ierarhic
app.put('/api/hierarchy/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, color, icon, sort_order } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Denumirea nu poate fi goală.' });
    }

    await dbAsync.run(`
      UPDATE hierarchy_nodes 
      SET name = ?, code = ?, description = ?, color = ?, icon = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name.trim(),
      code ? code.trim() : null,
      description ? description.trim() : null,
      color || '#3b82f6',
      icon || 'folder',
      sort_order || 0,
      id
    ]);

    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'INFO',
      `Actualizată denumirea nivelului ID ${id} la "${name.trim()}".`,
      'HIERARCHY'
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stergere nivel ierarhic si a tuturor subnivelelor sale
app.delete('/api/hierarchy/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Functie recursiva de colectare a ID-urilor descendente
    const allNodes = await dbAsync.all('SELECT id, parent_id FROM hierarchy_nodes');
    const idsToDelete = [parseInt(id)];

    function collectDescendants(parentId) {
      const children = allNodes.filter(n => n.parent_id === parentId);
      for (const ch of children) {
        idsToDelete.push(ch.id);
        collectDescendants(ch.id);
      }
    }
    collectDescendants(parseInt(id));

    const placeholders = idsToDelete.map(() => '?').join(',');
    
    // Deasociem email-urile de aceste nivele
    await dbAsync.run(`UPDATE emails SET hierarchy_id = NULL WHERE hierarchy_id IN (${placeholders})`, idsToDelete);
    
    // Stergem nodurile
    await dbAsync.run(`DELETE FROM hierarchy_nodes WHERE id IN (${placeholders})`, idsToDelete);

    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'WARN',
      `Șterse ${idsToDelete.length} noduri din ierarhie începând cu ID ${id}.`,
      'HIERARCHY'
    ]);

    res.json({ success: true, deletedCount: idsToDelete.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 4. GESTIUNE UTILIZATORI & CONFIGURARE GOOGLE 2FA
// ========================================================

// Lista utilizatori cu pozitie ierarhica inclusa (doar pentru admin)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await dbAsync.all(`
      SELECT u.id, u.username, u.display_name, u.email, u.role, u.job_title, u.hierarchy_id, u.imap_user, (CASE WHEN u.imap_pass IS NOT NULL AND u.imap_pass != '' THEN 1 ELSE 0 END) as has_imap_pass,
             u.two_factor_enabled, u.created_at, u.last_login,
             h.name as hierarchy_name, h.color as hierarchy_color, h.level_depth
      FROM users u
      LEFT JOIN hierarchy_nodes h ON u.hierarchy_id = h.id
      ORDER BY u.id ASC
    `);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adaugare utilizator cu pozitie ierarhica si functie
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { username, display_name, password, email, role, job_title, hierarchy_id, imap_host, imap_port, imap_tls, imap_user, imap_pass, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass } = req.body;
    if (!username || !password || !display_name) {
      return res.status(400).json({ error: 'Numele de utilizator, numele afișat și parola sunt obligatorii.' });
    }

    const existing = await dbAsync.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Acest nume de utilizator există deja.' });
    }

    const hId = (hierarchy_id === '' || hierarchy_id === null || hierarchy_id === undefined) ? null : parseInt(hierarchy_id);
    const passHash = bcrypt.hashSync(password, 10);
    const result = await dbAsync.run(`
      INSERT INTO users (username, display_name, password_hash, email, role, job_title, hierarchy_id, imap_host, imap_port, imap_tls, imap_user, imap_pass, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, two_factor_enabled)\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [username.trim(), display_name.trim(), passHash, email ? email.trim() : null, role || 'user', job_title ? job_title.trim() : null, hId, imap_host || null, imap_port ? parseInt(imap_port) : 993, imap_tls !== undefined ? (imap_tls ? 1 : 0) : 1, imap_user ? imap_user.trim() : null, imap_pass ? imap_pass.trim() : null, smtp_host || null, smtp_port ? parseInt(smtp_port) : 465, smtp_secure !== undefined ? (smtp_secure ? 1 : 0) : 1, smtp_user ? smtp_user.trim() : null, smtp_pass ? smtp_pass.trim() : null]);

    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'INFO',
      `Utilizator nou creat: ${username.trim()} (${display_name.trim()})`,
      'USER_MANAGEMENT'
    ]);

    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editare utilizator (inclusiv pozitie ierarhica si functie)
app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, email, role, job_title, hierarchy_id, password, imap_host, imap_port, imap_tls, imap_user, imap_pass, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass } = req.body;

    const hId = (hierarchy_id === '' || hierarchy_id === null || hierarchy_id === undefined) ? null : parseInt(hierarchy_id);

    let query = 'UPDATE users SET display_name = ?, email = ?, role = ?, job_title = ?, hierarchy_id = ?, imap_host = ?, imap_port = ?, imap_tls = ?, imap_user = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?';
    let params = [display_name, email ? email.trim() : null, role || 'user', job_title ? job_title.trim() : null, hId, imap_host || null, imap_port ? parseInt(imap_port) : 993, imap_tls !== undefined ? (imap_tls ? 1 : 0) : 1, imap_user ? imap_user.trim() : null, smtp_host || null, smtp_port ? parseInt(smtp_port) : 465, smtp_secure !== undefined ? (smtp_secure ? 1 : 0) : 1, smtp_user ? smtp_user.trim() : null];
    if (smtp_pass !== undefined && smtp_pass !== '') { query += ', smtp_pass = ?'; params.push(smtp_pass.trim()); }
    if (imap_pass !== undefined && imap_pass !== '') {
      query += ', imap_pass = ?';
      params.push(imap_pass.trim());
    }

    if (password && password.trim() !== '') {
      query += ', password_hash = ?';
      params.push(bcrypt.hashSync(password, 10));
    }

    query += ' WHERE id = ?';
    params.push(id);

    await dbAsync.run(query, params);

    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'INFO',
      `Actualizate datele utilizatorului ID ${id} (${display_name})`,
      'USER_MANAGEMENT'
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stergere utilizator
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configurare / Generare secret si cod QR Google Authenticator pentru un utilizator
app.post('/api/admin/users/:id/setup-2fa', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dbAsync.get('SELECT username FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Utilizatorul nu a fost găsit.' });
    }

    const secret = generateSecret();
    const otpAuthUrl = getOtpAuthUrl(user.username, secret, 'Înlocuitor Mail');
    const qrCodeDataUrl = await generateQRCodeDataUrl(otpAuthUrl);

    // Salvam secretul pregatit
    await dbAsync.run('UPDATE users SET two_factor_secret = ? WHERE id = ?', [secret, id]);

    res.json({
      success: true,
      secret: secret,
      otpAuthUrl: otpAuthUrl,
      qrCode: qrCodeDataUrl,
      username: user.username
    });
  } catch (err) {
    res.status(500).json({ error: 'Eroare la generare 2FA: ' + err.message });
  }
});

// Activare / Dezactivare comutator 2FA
app.post('/api/admin/users/:id/toggle-2fa', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const user = await dbAsync.get('SELECT two_factor_secret FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Utilizatorul nu a fost găsit.' });
    }

    if (enabled && !user.two_factor_secret) {
      return res.status(400).json({ error: 'Trebuie mai întâi să generați cheia secretă și codul QR Google Authenticator.' });
    }

    await dbAsync.run('UPDATE users SET two_factor_enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);

    await dbAsync.run('INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)', [
      'INFO',
      `Google 2FA a fost ${enabled ? 'ACTIVAT' : 'DEZACTIVAT'} pentru utilizatorul ID ${id}.`,
      '2FA_SECURITY'
    ]);

    res.json({ success: true, enabled: Boolean(enabled) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 5. CONFIGURARE ȘI SINCRONIZARE IMAP
// ========================================================

// Citire setari IMAP
app.get('/api/settings/imap', async (req, res) => {
  try {
    const row = await dbAsync.get('SELECT id, host, port, tls, username, auto_sync, sync_interval, last_sync FROM imap_settings WHERE id = 1');
    res.json(row || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salvare setari IMAP
app.post('/api/settings/imap', requireAdmin, async (req, res) => {
  try {
    const { host, port, tls, username, password, auto_sync, sync_interval } = req.body;

    let query = 'UPDATE imap_settings SET host = ?, port = ?, tls = ?, username = ?, auto_sync = ?, sync_interval = ?';
    let params = [host, parseInt(port) || 993, tls ? 1 : 0, username, auto_sync ? 1 : 0, parseInt(sync_interval) || 5];

    if (password && password.trim() !== '') {
      query += ', password = ?';
      params.push(password);
    }

    query += ' WHERE id = 1';
    await dbAsync.run(query, params);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ========================================================
// USER MAIL SETTINGS - fiecare utilizator isi poate configura propria casuta
// ========================================================

// GET setarile de mail ale utilizatorului curent
app.get('/api/user/mail-settings', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Neautentificat' });
    const user = await dbAsync.get(
      `SELECT imap_host, imap_port, imap_tls, imap_user,
              (CASE WHEN imap_pass IS NOT NULL AND imap_pass != '' THEN 1 ELSE 0 END) as has_imap_pass,
              smtp_host, smtp_port, smtp_secure, smtp_user,
              (CASE WHEN smtp_pass IS NOT NULL AND smtp_pass != '' THEN 1 ELSE 0 END) as has_smtp_pass
       FROM users WHERE id = ?`,
      [req.session.userId]
    );
    if (!user) return res.status(404).json({ error: 'Utilizator negasit' });
    res.json({ settings: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST salveaza setarile de mail ale utilizatorului curent
app.post('/api/user/mail-settings', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Neautentificat' });
    const { imap_host, imap_port, imap_tls, imap_user, imap_pass, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass } = req.body;

    let query = `UPDATE users SET
      imap_host = ?, imap_port = ?, imap_tls = ?, imap_user = ?,
      smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?`;
    let params = [
      imap_host || null,
      imap_port ? parseInt(imap_port) : 993,
      imap_tls !== undefined ? (imap_tls ? 1 : 0) : 1,
      imap_user ? imap_user.trim() : null,
      smtp_host || null,
      smtp_port ? parseInt(smtp_port) : 465,
      smtp_secure !== undefined ? (smtp_secure ? 1 : 0) : 1,
      smtp_user ? smtp_user.trim() : null
    ];

    if (imap_pass && imap_pass.trim()) {
      query += ', imap_pass = ?';
      params.push(imap_pass.trim());
    }
    if (smtp_pass && smtp_pass.trim()) {
      query += ', smtp_pass = ?';
      params.push(smtp_pass.trim());
    }

    query += ' WHERE id = ?';
    params.push(req.session.userId);

    await dbAsync.run(query, params);
    res.json({ success: true, message: 'Setarile au fost salvate cu succes.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST testare conexiune IMAP pentru utilizatorul curent
app.post('/api/user/imap/test', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Neautentificat' });
    const { imap_host, imap_port, imap_tls, imap_user, imap_pass } = req.body;

    // Daca nu se trimite parola, o luam din baza de date
    let password = imap_pass;
    if (!password || !password.trim()) {
      const user = await dbAsync.get('SELECT imap_pass FROM users WHERE id = ?', [req.session.userId]);
      if (user) password = user.imap_pass;
    }

    const settings = {
      host: imap_host,
      port: parseInt(imap_port) || 993,
      tls: imap_tls !== undefined ? (imap_tls ? true : false) : true,
      username: imap_user,
      password: password
    };

    if (!settings.host || !settings.username || !settings.password) {
      return res.status(400).json({ success: false, error: 'Completati toate campurile obligatorii (host, utilizator, parola).' });
    }

    const result = await testImapConnection(settings);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test live conexiune IMAP
app.post('/api/imap/test', requireAdmin, async (req, res) => {
  try {
    let settings = req.body;
    if (!settings.password) {
      const current = await dbAsync.get('SELECT password FROM imap_settings WHERE id = 1');
      if (current) settings.password = current.password;
    }

    const testRes = await testImapConnection(settings);
    res.json(testRes);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Declanșare sincronizare e-mailuri (CONFIDENȚIAL: utilizatorul își sincronizează strict contul propriu)
app.post('/api/imap/sync', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Trebuie să fiți autentificat cu un cont de utilizator pentru a vă sincroniza e-mailurile.' });
    }

    const targetUser = await dbAsync.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (!targetUser) {
      return res.status(401).json({ error: 'Utilizatorul nu a fost găsit.' });
    }

    const globalSettings = await dbAsync.get('SELECT * FROM imap_settings WHERE id = 1') || {};

    const userSettings = {
      host: targetUser.imap_host || globalSettings.host,
      port: targetUser.imap_port || globalSettings.port || 993,
      tls: targetUser.imap_tls !== undefined ? (targetUser.imap_tls !== 0) : (globalSettings.tls !== 0),
      username: targetUser.imap_user || targetUser.email,
      password: targetUser.imap_pass
    };

    if (!userSettings.username || !userSettings.password) {
      return res.status(400).json({ 
        error: 'Căsuța dvs. IMAP nu are configurat utilizatorul sau parola. Apăsați pe butonul "Căsuța Mea" pentru a introduce datele contului dvs.' 
      });
    }

    const syncRes = await syncImap(userSettings, targetUser);
    res.json(syncRes);
  } catch (err) {
    res.status(500).json({ error: 'Eroare la sincronizare: ' + err.message });
  }
});


// ========================================================
// 5.1 GESTIUNE SETĂRI SMTP GLOBALE & TEST CONEXIUNE
// ========================================================

app.get("/api/settings/mail", requireAdmin, async (req, res) => {
  try {
    const row = await dbAsync.get("SELECT id, host, port, tls, username, smtp_host, smtp_port, smtp_secure, smtp_user, auto_sync, sync_interval, last_sync FROM imap_settings WHERE id = 1");
    res.json({ settings: row || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/settings/mail", requireAdmin, async (req, res) => {
  try {
    const { host, port, tls, username, password, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, auto_sync, sync_interval } = req.body;
    let query = "UPDATE imap_settings SET host = ?, port = ?, tls = ?, username = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?, auto_sync = ?, sync_interval = ?";
    let params = [host, parseInt(port) || 993, tls ? 1 : 0, username || "", smtp_host || "", parseInt(smtp_port) || 465, smtp_secure ? 1 : 0, smtp_user || "", auto_sync ? 1 : 0, parseInt(sync_interval) || 5];

    if (password && password.trim() !== "") {
      query += ", password = ?";
      params.push(password.trim());
    }
    if (smtp_pass && smtp_pass.trim() !== "") {
      query += ", smtp_pass = ?";
      params.push(smtp_pass.trim());
    }

    query += " WHERE id = 1";
    await dbAsync.run(query, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/smtp/test", requireAdmin, async (req, res) => {
  try {
    let settings = req.body;
    if (!settings.smtp_pass) {
      const cur = await dbAsync.get("SELECT smtp_pass, password FROM imap_settings WHERE id = 1");
      if (cur) settings.smtp_pass = cur.smtp_pass || cur.password;
    }
    const testRes = await testSmtpConnection(settings);
    res.json(testRes);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ========================================================
// 5.2 ÎNCĂRCARE DOCUMENTE (TRANSFORMARE ÎN LINK-URI SECURIZATE)
// ========================================================

app.post("/api/documents/upload", upload.array("documents", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Nu a fost încărcat niciun fișier." });
    }

    const userId = req.session.userId || null;
    const uploadedDocs = [];

    for (const file of req.files) {
      const downloadToken = crypto.randomBytes(24).toString("hex");
      const result = await dbAsync.run(`
        INSERT INTO uploaded_documents 
          (download_token, original_filename, stored_filename, file_size, mime_type, uploader_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        downloadToken,
        file.originalname,
        file.filename,
        file.size,
        file.mimetype,
        userId
      ]);

      uploadedDocs.push({
        id: result.id,
        download_token: downloadToken,
        original_filename: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype
      });
    }

    res.json({ success: true, documents: uploadedDocs });
  } catch (err) {
    console.error("[Upload] Eroare la încărcare documente:", err);
    res.status(500).json({ error: "Eroare la procesarea documentelor: " + err.message });
  }
});

// Endpoint public de descărcare fișier securizat
app.get("/api/documents/download/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const doc = await dbAsync.get("SELECT * FROM uploaded_documents WHERE download_token = ?", [token]);
    if (!doc) {
      return res.status(404).send("Documentul solicitat nu a fost găsit sau link-ul a expirat.");
    }

    const filePath = path.join(uploadsDir, doc.stored_filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Fișierul nu mai există pe server.");
    }

    // Incrementare contor descărcări
    await dbAsync.run("UPDATE uploaded_documents SET download_count = download_count + 1 WHERE id = ?", [doc.id]);

    res.download(filePath, doc.original_filename);
  } catch (err) {
    res.status(500).send("Eroare la descărcare: " + err.message);
  }
});

// ========================================================
// 5.3 TRIMITERE E-MAIL (OUTGOING CU LINK-URI AUTOMATE)
// ========================================================

app.post("/api/mail/send", async (req, res) => {
  try {
    const { to, subject, bodyHtml, bodyText, documentIds, hierarchyId } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Destinatarul (To) este obligatoriu." });
    }

    // Setări globale
    const settings = await dbAsync.get("SELECT * FROM imap_settings WHERE id = 1") || {};

    // Utilizator curent
    let user = null;
    if (req.session.userId) {
      user = await dbAsync.get("SELECT * FROM users WHERE id = ?", [req.session.userId]);
    }

    // Preluam documentele încărcate dacă există
    let documents = [];
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      const placeholders = documentIds.map(() => "?").join(",");
      documents = await dbAsync.all(`SELECT * FROM uploaded_documents WHERE id IN (${placeholders})`, documentIds);
    }

    // Construim URL-ul de bază al serverului
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const hostHeader = req.headers["x-forwarded-host"] || req.headers.host;
    const reqBaseUrl = `${protocol}://${hostHeader}`;

    const sendResult = await sendEmailWithLinks({
      settings,
      user,
      to,
      subject,
      bodyHtml,
      bodyText,
      documents,
      reqBaseUrl
    });

    // Salvăm o copie în tabela emails pentru istoric / ierarhie
    const messageId = sendResult.messageId || `sent-${Date.now()}@local`;
    const senderName = user ? user.display_name : "Sistem";
    const senderEmail = sendResult.sender;
    const targetHierarchyId = hierarchyId || (user ? user.hierarchy_id : null);

    const attachmentsMeta = documents.map(d => ({
      filename: d.original_filename,
      size: d.file_size,
      download_token: d.download_token
    }));

    const insEmail = await dbAsync.run(`
      INSERT INTO emails 
        (message_id, folder, sender_name, sender_email, recipient, subject, body_text, body_html, hierarchy_id, is_read, attachments_json, user_id)
      VALUES (?, 'SENT', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      messageId,
      senderName,
      senderEmail,
      to,
      subject,
      bodyText || "",
      bodyHtml || "",
      targetHierarchyId,
      JSON.stringify(attachmentsMeta),
      user ? user.id : null
    ]);

    // Asociem email_id cu documentele încărcate
    if (documents.length > 0) {
      const placeholders = documents.map(() => "?").join(",");
      await dbAsync.run(`UPDATE uploaded_documents SET email_id = ? WHERE id IN (${placeholders})`, [insEmail.id, ...documents.map(d => d.id)]);
    }

    await dbAsync.run("INSERT INTO system_logs (level, message, source) VALUES (?, ?, ?)", [
      "INFO",
      `E-mail trimis cu succes către ${to}. Subiect: ${subject || "(fără)"}. Documente transformate în link: ${documents.length}`,
      "SMTP_SEND"
    ]);

    res.json({
      success: true,
      messageId: sendResult.messageId,
      documentsCount: documents.length
    });
  } catch (err) {
    console.error("[SMTP Send Error]:", err);
    res.status(500).json({ error: "Eroare la trimiterea e-mailului: " + err.message });
  }
});

// ========================================================
// 6. GESTIUNE EMAIL-URI & ASOCIERE IERARHICĂ
// ========================================================

// Lista email-uri cu filtrare după nod ierarhic, căutare și stare
app.get('/api/emails', async (req, res) => {
  try {
    // PROTECȚIE & CONFIDENȚIALITATE: Doar utilizatorul autentificat are acces exclusiv la mailurile sale!
    if (!req.session.userId) {
      return res.json({ emails: [] });
    }

    const { hierarchy_id, search, unread, flagged } = req.query;

    let query = `
      SELECT e.id, e.message_id, e.sender_name, e.sender_email, e.recipient, e.subject, 
             e.date_received, e.hierarchy_id, e.is_read, e.is_flagged, e.attachments_json,
             h.name as hierarchy_name, h.color as hierarchy_color, h.level_depth
      FROM emails e
      LEFT JOIN hierarchy_nodes h ON e.hierarchy_id = h.id
      WHERE e.user_id = ?
    `;
    const params = [req.session.userId];

    if (hierarchy_id !== undefined && hierarchy_id !== '') {
      if (hierarchy_id === 'unassigned') {
        query += ' AND e.hierarchy_id IS NULL';
      } else {
        // Includem si toate subnivelele nodului selectat
        const allNodes = await dbAsync.all('SELECT id, parent_id FROM hierarchy_nodes');
        const targetIds = [parseInt(hierarchy_id)];
        
        function addChildren(pid) {
          const ch = allNodes.filter(n => n.parent_id === pid);
          for (const item of ch) {
            targetIds.push(item.id);
            addChildren(item.id);
          }
        }
        addChildren(parseInt(hierarchy_id));

        const ph = targetIds.map(() => '?').join(',');
        query += ` AND e.hierarchy_id IN (${ph})`;
        params.push(...targetIds);
      }
    }

    if (search && search.trim() !== '') {
      query += ' AND (e.subject LIKE ? OR e.sender_name LIKE ? OR e.sender_email LIKE ? OR e.body_text LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    if (unread === '1') {
      query += ' AND e.is_read = 0';
    }

    if (flagged === '1') {
      query += ' AND e.is_flagged = 1';
    }

    query += ' ORDER BY e.date_received DESC LIMIT 100';

    const emails = await dbAsync.all(query, params);
    res.json({ emails });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalii email individual
app.get('/api/emails/:id', async (req, res) => {
  try {
    const email = await dbAsync.get(`
      SELECT e.*, h.name as hierarchy_name, h.color as hierarchy_color, h.level_depth
      FROM emails e
      LEFT JOIN hierarchy_nodes h ON e.hierarchy_id = h.id
      WHERE e.id = ? AND e.user_id = ?
    `, [req.params.id, req.session.userId]);

    if (!email) {
      return res.status(404).json({ error: 'Mesajul nu a fost găsit.' });
    }

    // Marcare automata ca citit
    if (!email.is_read) {
      await dbAsync.run('UPDATE emails SET is_read = 1 WHERE id = ?', [email.id]);
      email.is_read = 1;
    }

    res.json({ email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Asociere email la un nivel din structura ierarhica
app.put('/api/emails/:id/hierarchy', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Trebuie să fiți autentificat." });
    }
    const { id } = req.params;
    const { hierarchy_id } = req.body;
    // Verificam ca emailul apartine utilizatorului
    const checkEmail = await dbAsync.get("SELECT id FROM emails WHERE id = ? AND user_id = ?", [id, req.session.userId]);
    if (!checkEmail) {
      return res.status(403).json({ error: "Nu aveți permisiunea de a modifica acest e-mail." });
    }

    const targetHId = (hierarchy_id === null || hierarchy_id === '' || hierarchy_id === 'none') ? null : parseInt(hierarchy_id);

    await dbAsync.run('UPDATE emails SET hierarchy_id = ? WHERE id = ?', [targetHId, id]);

    let levelName = 'Neclasificat';
    if (targetHId) {
      const node = await dbAsync.get('SELECT name, level_depth FROM hierarchy_nodes WHERE id = ?', [targetHId]);
      if (node) levelName = `${node.name} (Nivel ${node.level_depth})`;
    }

    res.json({ success: true, hierarchy_id: targetHId, hierarchy_name: levelName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcare citit / necitit / stelat
app.put('/api/emails/:id/status', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Trebuie să fiți autentificat." });
    }
    const { id } = req.params;
    const { is_read, is_flagged } = req.body;
    // Verificam ca emailul apartine utilizatorului
    const checkEmail = await dbAsync.get("SELECT id FROM emails WHERE id = ? AND user_id = ?", [id, req.session.userId]);
    if (!checkEmail) {
      return res.status(403).json({ error: "Nu aveți acces la acest e-mail." });
    }

    if (is_read !== undefined) {
      await dbAsync.run('UPDATE emails SET is_read = ? WHERE id = ?', [is_read ? 1 : 0, id]);
    }
    if (is_flagged !== undefined) {
      await dbAsync.run('UPDATE emails SET is_flagged = ? WHERE id = ?', [is_flagged ? 1 : 0, id]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stergere email
app.delete('/api/emails/:id', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Trebuie să fiți autentificat." });
    }
    const result = await dbAsync.run('DELETE FROM emails WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 7. JURNALE SISTEM & STATISTICI
// ========================================================

app.get('/api/logs', requireAdmin, async (req, res) => {
  try {
    const logs = await dbAsync.all('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100');
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const emailStats = await dbAsync.get('SELECT COUNT(*) as total, SUM(CASE WHEN is_read=0 THEN 1 ELSE 0 END) as unread FROM emails');
    const hierarchyCount = await dbAsync.get('SELECT COUNT(*) as total FROM hierarchy_nodes');
    const usersCount = await dbAsync.get('SELECT COUNT(*) as total FROM users');
    const imapRow = await dbAsync.get('SELECT last_sync, host FROM imap_settings WHERE id = 1');

    res.json({
      totalEmails: emailStats ? emailStats.total : 0,
      unreadEmails: emailStats ? emailStats.unread : 0,
      totalHierarchyNodes: hierarchyCount ? hierarchyCount.total : 0,
      totalUsers: usersCount ? usersCount.total : 0,
      lastSync: imapRow ? imapRow.last_sync : null,
      imapHost: imapRow ? imapRow.host : ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Servire frontend React (productie)
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback: toate rutele non-API servesc index.html
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(distPath, "index.html"));
    }
    next();
  });
  console.log('[STATIC] Servire frontend din:', distPath);
}

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Înlocuitor Mail Simplificat (În Construcție) Server   `);
  console.log(` Rulare la adresa: http://localhost:${PORT}             `);
  console.log(`=======================================================`);
});
