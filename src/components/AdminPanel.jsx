import React, { useState, useEffect } from 'react';
import { 
  Layers, Users, Server, FileText, Plus, Edit, Trash2, 
  Check, X, QrCode, Smartphone, RefreshCw, Key, ShieldCheck, 
  ChevronRight, CornerDownRight, CheckCircle2, AlertTriangle
} from 'lucide-react';

export default function AdminPanel({
  hierarchyTree,
  flatHierarchy,
  onReloadHierarchy,
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState('hierarchy'); // hierarchy, users, imap, security

  // Stari pentru Ierarhie
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [parentIdForNew, setParentIdForNew] = useState(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeCode, setNodeCode] = useState('');
  const [nodeDesc, setNodeDesc] = useState('');
  const [nodeColor, setNodeColor] = useState('#3b82f6');

  // Stari pentru Utilizatori & 2FA Google
  const [users, setUsers] = useState([]);
  const [twoFaModalOpen, setTwoFaModalOpen] = useState(false);
  const [selectedUser2FA, setSelectedUser2FA] = useState(null);
  const [twoFaData, setTwoFaData] = useState(null);
  const [verifyTestCode, setVerifyTestCode] = useState('');
  const [verifyStatus, setVerifyStatus] = useState(null);

  // Stari pentru Setari IMAP
  const [imapSettings, setImapSettings] = useState({
    host: 'mail.pbasig.ro',
    port: 993,
    tls: 1,
    username: '',
    password: '',
    auto_sync: 1,
    sync_interval: 5
  });
  const [imapTestResult, setImapTestResult] = useState(null);
  const [isTestingImap, setIsTestingImap] = useState(false);

  // Stare Parola Admin
  const [currentAdminPass, setCurrentAdminPass] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');

  // Incarcare initiala date admin
  useEffect(() => {
    fetchUsers();
    fetchImapSettings();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchImapSettings = async () => {
    try {
      const res = await fetch('/api/settings/imap');
      const data = await res.json();
      if (res.ok) setImapSettings(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error(err);
    }
  };

  // --- Handlers Ierarhie ---
  const handleOpenAddRoot = () => {
    setEditingNode(null);
    setParentIdForNew(null);
    setNodeName('');
    setNodeCode('');
    setNodeDesc('');
    setNodeColor('#3b82f6');
    setNodeModalOpen(true);
  };

  const handleOpenAddChild = (parentNode) => {
    setEditingNode(null);
    setParentIdForNew(parentNode.id);
    setNodeName('');
    setNodeCode('');
    setNodeDesc('');
    setNodeColor(parentNode.color || '#3b82f6');
    setNodeModalOpen(true);
  };

  const handleOpenEditNode = (node) => {
    setEditingNode(node);
    setParentIdForNew(node.parent_id);
    setNodeName(node.name);
    setNodeCode(node.code || '');
    setNodeDesc(node.description || '');
    setNodeColor(node.color || '#3b82f6');
    setNodeModalOpen(true);
  };

  const handleSaveNode = async (e) => {
    e.preventDefault();
    try {
      if (editingNode) {
        // Editare
        const res = await fetch(`/api/hierarchy/${editingNode.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nodeName,
            code: nodeCode,
            description: nodeDesc,
            color: nodeColor
          })
        });
        if (!res.ok) throw new Error('Eroare la actualizarea denumirii');
        onShowToast('Denumire nivel actualizată cu succes!', 'success');
      } else {
        // Adaugare la radacina sau subnivel
        const res = await fetch('/api/hierarchy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parent_id: parentIdForNew,
            name: nodeName,
            code: nodeCode,
            description: nodeDesc,
            color: nodeColor
          })
        });
        if (!res.ok) throw new Error('Eroare la adăugarea nivelului');
        onShowToast('Nivel ierarhic adăugat cu succes!', 'success');
      }

      setNodeModalOpen(false);
      onReloadHierarchy();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleDeleteNode = async (node) => {
    if (!window.confirm(`Sunteți sigur că doriți să ștergeți "${node.name}" și TOATE subnivelele sale?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/hierarchy/${node.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Eroare la ștergerea nivelului');
      onShowToast(`Nivelul și subnivelele au fost șterse.`, 'success');
      onReloadHierarchy();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  // --- Handlers Utilizatori & 2FA Google ---
  const handleSetup2FA = async (user) => {
    setSelectedUser2FA(user);
    setVerifyTestCode('');
    setVerifyStatus(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/setup-2fa`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTwoFaData(data);
      setTwoFaModalOpen(true);
    } catch (err) {
      onShowToast('Eroare la configurare 2FA: ' + err.message, 'error');
    }
  };

  const handleToggle2FA = async (userId, newStatus) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onShowToast(`Google 2FA a fost ${newStatus ? 'activat' : 'dezactivat'}.`, 'success');
      fetchUsers();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleTest2FACode = async () => {
    if (!verifyTestCode || verifyTestCode.length !== 6) return;
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyTestCode })
      });
      if (res.ok) {
        setVerifyStatus({ ok: true, msg: 'Cod valid! Telefonul este sincronizat corect.' });
      } else {
        setVerifyStatus({ ok: false, msg: 'Cod invalid sau expirat. Verificați ceasul telefonului.' });
      }
    } catch (err) {
      setVerifyStatus({ ok: false, msg: err.message });
    }
  };

  // --- Handlers IMAP ---
  const handleTestImap = async () => {
    setIsTestingImap(true);
    setImapTestResult(null);
    try {
      const res = await fetch('/api/imap/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imapSettings)
      });
      const data = await res.json();
      setImapTestResult(data);
    } catch (err) {
      setImapTestResult({ success: false, error: err.message });
    } finally {
      setIsTestingImap(false);
    }
  };

  const handleSaveImap = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings/imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imapSettings)
      });
      if (!res.ok) throw new Error('Eroare la salvarea setărilor IMAP');
      onShowToast('Setările IMAP au fost salvate cu succes!', 'success');
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  // --- Handler Schimbare Parola Admin ---
  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentAdminPass,
          newPassword: newAdminPass
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onShowToast('Parola dedicată de administrare a fost schimbată cu succes!', 'success');
      setCurrentAdminPass('');
      setNewAdminPass('');
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  // Randare recursiva a nodurilor de ierarhie in panoul de administrare
  const renderAdminHierarchyTree = (nodes, depth = 1) => {
    if (!nodes || nodes.length === 0) return null;

    return nodes.map(node => (
      <div key={node.id} style={{ marginBottom: '8px' }}>
        <div 
          className="hierarchy-node-card"
          style={{ marginLeft: `${(depth - 1) * 28}px`, borderLeft: `4px solid ${node.color || '#3b82f6'}` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              className="level-badge"
              style={{
                backgroundColor: `${node.color || '#3b82f6'}30`,
                color: node.color || '#93c5fd',
                fontSize: '0.75rem',
                padding: '2px 8px'
              }}
            >
              Nivelul {node.level_depth}
            </span>

            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                {node.name}
                {node.code && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 'normal' }}>
                    [{node.code}]
                  </span>
                )}
              </div>
              {node.description && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {node.description}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '8px' }}>
              {node.total_emails} email-uri
            </span>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenAddChild(node)}
              title="Adaugă un subnivel sub acest nod"
            >
              <Plus size={14} />
              + Subnivel (Nv.{node.level_depth + 1})
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenEditNode(node)}
              title="Editează denumirea sau proprietățile"
            >
              <Edit size={14} />
              Editează
            </button>

            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleDeleteNode(node)}
              title="Șterge nivelul și toate subnivelele sale"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {node.children && node.children.length > 0 && (
          <div>
            {renderAdminHierarchyTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="admin-view">
      {/* Bara de Navigare Admin */}
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={24} style={{ color: '#818cf8' }} />
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Panou de Administrare</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Sesiune securizată cu parolă separată
            </span>
          </div>
        </div>

        <div className="admin-nav-tabs">
          <button
            className={`admin-tab ${activeTab === 'hierarchy' ? 'active' : ''}`}
            onClick={() => setActiveTab('hierarchy')}
          >
            <Layers size={16} />
            Arbore Ierarhic (Nivele Nelimitate)
          </button>

          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            Utilizatori & 2FA Google
          </button>

          <button
            className={`admin-tab ${activeTab === 'imap' ? 'active' : ''}`}
            onClick={() => setActiveTab('imap')}
          >
            <Server size={16} />
            Configurare IMAP
          </button>

          <button
            className={`admin-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Key size={16} />
            Securitate Parolă Admin
          </button>
        </div>
      </div>

      {/* Corpul Tab-ului Curent */}
      <div className="admin-body">
        {/* TAB 1: ARBORE IERARHIC NELIMITAT */}
        {activeTab === 'hierarchy' && (
          <div className="hierarchy-manager">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Configurare Structuri Ierarhice</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Puteți adăuga un număr <strong>nelimitat de nivele</strong> (Rădăcină &rarr; Subnivel &rarr; Sub-subnivel etc.). Denumirea fiecărui nivel poate fi editată oricând.
                </p>
              </div>

              <button className="btn btn-primary" onClick={handleOpenAddRoot}>
                <Plus size={16} />
                + Adaugă Nivel Rădăcină (Nivel 1)
              </button>
            </div>

            {hierarchyTree && hierarchyTree.length > 0 ? (
              <div>{renderAdminHierarchyTree(hierarchyTree, 1)}</div>
            ) : (
              <div style={{ padding: '40px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <Layers size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <h4>Niciun nivel ierarhic definit</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Creați prima structură apăsând butonul "+ Adaugă Nivel Rădăcină".
                </p>
                <button className="btn btn-primary" onClick={handleOpenAddRoot}>
                  + Adaugă Primul Nivel
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UTILIZATORI & GOOGLE 2FA */}
        {activeTab === 'users' && (
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Gestiune Utilizatori & Google Authenticator</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Configurați autentificarea cu 2 factori (2FA) prin Google Authenticator pentru fiecare cont de utilizator.
                </p>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '14px 20px' }}>Utilizator</th>
                    <th style={{ padding: '14px 20px' }}>Rol</th>
                    <th style={{ padding: '14px 20px' }}>Status Google 2FA</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Acțiuni 2FA</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{u.display_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username} &bull; {u.email || 'fără email'}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ textTransform: 'capitalize', background: 'rgba(148, 163, 184, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {u.two_factor_enabled ? (
                          <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.8rem' }}>
                            <CheckCircle2 size={15} />
                            Activat (Google Authenticator)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Dezactivat
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSetup2FA(u)}
                            title="Generează codul QR pentru Google Authenticator"
                          >
                            <QrCode size={14} />
                            {u.two_factor_enabled ? 'Reconfigurează QR' : 'Configurează QR'}
                          </button>

                          <button
                            className={`btn btn-sm ${u.two_factor_enabled ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => handleToggle2FA(u.id, !u.two_factor_enabled)}
                          >
                            {u.two_factor_enabled ? 'Dezactivează' : 'Activează'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CONFIGURARE IMAP */}
        {activeTab === 'imap' && (
          <div style={{ maxWidth: '750px', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>Setări Server IMAP</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Configurați serverul de mail pentru preluarea automată a e-mailurilor prin protocolul securizat IMAP.
            </p>

            <form onSubmit={handleSaveImap} style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Gazdă Server IMAP (Host)</label>
                  <input
                    type="text"
                    required
                    value={imapSettings.host || ''}
                    onChange={(e) => setImapSettings({ ...imapSettings, host: e.target.value })}
                    placeholder="mail.domeniu.ro"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Port IMAP (SSL/TLS)</label>
                  <input
                    type="number"
                    required
                    value={imapSettings.port || 993}
                    onChange={(e) => setImapSettings({ ...imapSettings, port: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Utilizator IMAP / Căsuță E-mail</label>
                  <input
                    type="text"
                    required
                    value={imapSettings.username || ''}
                    onChange={(e) => setImapSettings({ ...imapSettings, username: e.target.value })}
                    placeholder="office@domeniu.ro"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parolă IMAP</label>
                  <input
                    type="password"
                    value={imapSettings.password || ''}
                    onChange={(e) => setImapSettings({ ...imapSettings, password: e.target.value })}
                    placeholder="Introduceți parola..."
                  />
                </div>
              </div>

              {imapTestResult && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  background: imapTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${imapTestResult.success ? '#10b981' : '#ef4444'}`,
                  color: imapTestResult.success ? '#a7f3d0' : '#fca5a5'
                }}>
                  {imapTestResult.success ? (
                    <div>
                      <strong>Conexiune IMAP reușită!</strong> Timp de răspuns: {imapTestResult.latencyMs} ms &bull; Dosare găsite: {imapTestResult.mailboxCount}
                    </div>
                  ) : (
                    <div>
                      <strong>Eroare conexiune:</strong> {imapTestResult.error}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleTestImap}
                  disabled={isTestingImap}
                >
                  <RefreshCw size={15} className={isTestingImap ? 'animate-spin' : ''} />
                  {isTestingImap ? 'Se testează...' : 'Testează Conexiunea IMAP'}
                </button>

                <button type="submit" className="btn btn-primary">
                  Salvează Setările IMAP
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 4: SECURITATE PAROLA ADMIN */}
        {activeTab === 'security' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>Schimbare Parolă de Administrare</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Aceasta este parola separată folosită exclusiv pentru accesul în acest Panou de Administrare.
            </p>

            <form onSubmit={handleChangeAdminPassword} style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Parola Actuală de Administrare</label>
                <input
                  type="password"
                  required
                  value={currentAdminPass}
                  onChange={(e) => setCurrentAdminPass(e.target.value)}
                  placeholder="Introduceți parola curentă..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Noua Parolă de Administrare</label>
                <input
                  type="password"
                  required
                  value={newAdminPass}
                  onChange={(e) => setNewAdminPass(e.target.value)}
                  placeholder="Minim 4 caractere..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="submit" className="btn btn-admin">
                  <Key size={15} />
                  Actualizează Parola de Administrare
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* MODAL ADAUGARE / EDITARE NIVEL IERARHIC */}
      {nodeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingNode ? 'Editează Denumire Nivel' : (parentIdForNew ? '+ Adaugă Subnivel Ierarhic' : '+ Adaugă Nivel Rădăcină (Nivel 1)')}</h3>
              <button onClick={() => setNodeModalOpen(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNode}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Denumire Nivel (Editabilă)</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={nodeName}
                    onChange={(e) => setNodeName(e.target.value)}
                    placeholder="ex: Departament Vânzări, Divizia Sud, etc."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Cod / Prescurtare</label>
                    <input
                      type="text"
                      value={nodeCode}
                      onChange={(e) => setNodeCode(e.target.value)}
                      placeholder="ex: VNZ-01"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Culoare Etichetă</label>
                    <input
                      type="color"
                      style={{ height: '40px', padding: '2px', cursor: 'pointer' }}
                      value={nodeColor}
                      onChange={(e) => setNodeColor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Descriere Nivel</label>
                  <textarea
                    rows={3}
                    value={nodeDesc}
                    onChange={(e) => setNodeDesc(e.target.value)}
                    placeholder="Descrierea atribuțiilor sau specificul acestui nivel..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setNodeModalOpen(false)}>
                  Anulează
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingNode ? 'Salvează Modificările' : 'Creează Nivelul'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURARE GOOGLE AUTHENTICATOR 2FA */}
      {twoFaModalOpen && twoFaData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={20} style={{ color: '#60a5fa' }} />
                <h3>Configurare Google Authenticator</h3>
              </div>
              <button onClick={() => setTwoFaModalOpen(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Scanați codul QR de mai jos cu aplicația <strong>Google Authenticator</strong> de pe telefon pentru utilizatorul <strong>{selectedUser2FA?.username}</strong>:
              </p>

              {/* Imagine Cod QR generat */}
              <div style={{ background: 'white', padding: '12px', borderRadius: '8px', display: 'inline-block', margin: '0 auto 12px' }}>
                <img src={twoFaData.qrCode} alt="Cod QR Google Authenticator" style={{ width: '200px', height: '200px', display: 'block' }} />
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Cheie manuală de configurare:<br />
                <code style={{ fontSize: '0.85rem', color: '#93c5fd', background: 'rgba(15, 23, 42, 0.6)', padding: '3px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>
                  {twoFaData.secret}
                </code>
              </div>

              {/* Testare Cod 6 Cifre */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Testați codul generat pe telefon (6 cifre):
                </label>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={verifyTestCode}
                    onChange={(e) => setVerifyTestCode(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{ width: '130px', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2em' }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleTest2FACode}>
                    Verifică
                  </button>
                </div>

                {verifyStatus && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: verifyStatus.ok ? '#34d399' : '#f87171' }}>
                    {verifyStatus.msg}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleToggle2FA(selectedUser2FA.id, true);
                  setTwoFaModalOpen(false);
                }}
              >
                Activează 2FA pentru Utilizator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
