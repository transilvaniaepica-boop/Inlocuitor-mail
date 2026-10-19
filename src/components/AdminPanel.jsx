import React, { useState, useEffect } from 'react';
import { 
  Layers, Users, Server, FileText, Plus, Edit, Trash2, 
  Check, X, QrCode, Smartphone, RefreshCw, Key, ShieldCheck, 
  ChevronRight, CornerDownRight, CheckCircle2, AlertTriangle,
  UserPlus, Briefcase, Tag, UserCheck
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

  // Stari pentru Utilizatori & 2FA Google & Pozitii Ierarhice
  const [users, setUsers] = useState([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Campuri formular utilizator
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormDisplayName, setUserFormDisplayName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState('user');
  const [userFormJobTitle, setUserFormJobTitle] = useState('');
  const [userFormHierarchyId, setUserFormHierarchyId] = useState('');
  const [userFormImapUser, setUserFormImapUser] = useState('');
  const [userFormImapPass, setUserFormImapPass] = useState('');

  // Stari pentru 2FA
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

  // --- Handlers Utilizatori & Pozitii Ierarhice ---
  const handleOpenAddUser = (preselectedHierarchyId = '') => {
    setEditingUser(null);
    setUserFormUsername('');
    setUserFormDisplayName('');
    setUserFormEmail('');
    setUserFormPassword('');
    setUserFormRole('user');
    setUserFormJobTitle('');
    setUserFormHierarchyId(preselectedHierarchyId ? String(preselectedHierarchyId) : '');
    setUserFormImapUser('');
    setUserFormImapPass('');
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    setUserFormUsername(user.username);
    setUserFormDisplayName(user.display_name);
    setUserFormEmail(user.email || '');
    setUserFormPassword('');
    setUserFormRole(user.role || 'user');
    setUserFormJobTitle(user.job_title || '');
    setUserFormHierarchyId(user.hierarchy_id ? String(user.hierarchy_id) : '');
    setUserFormImapUser(user.imap_user || '');
    setUserFormImapPass('');
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Editare
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: userFormDisplayName,
            email: userFormEmail,
            role: userFormRole,
            job_title: userFormJobTitle,
            hierarchy_id: userFormHierarchyId,
            imap_user: userFormImapUser,
            imap_pass: userFormImapPass,
            imap_user: userFormImapUser,
            imap_pass: userFormImapPass,
            password: userFormPassword
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Eroare la actualizarea utilizatorului');
        onShowToast('Utilizatorul și poziția ierarhică au fost actualizate!', 'success');
      } else {
        // Adaugare utilizator nou
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userFormUsername,
            display_name: userFormDisplayName,
            email: userFormEmail,
            password: userFormPassword,
            role: userFormRole,
            job_title: userFormJobTitle,
            hierarchy_id: userFormHierarchyId,
            imap_user: userFormImapUser,
            imap_pass: userFormImapPass
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Eroare la adăugarea utilizatorului');
        onShowToast(`Utilizatorul "${userFormDisplayName}" a fost adăugat cu succes pe poziția selectată!`, 'success');
      }

      setUserModalOpen(false);
      fetchUsers();
      onReloadHierarchy();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Sunteți sigur că doriți să ștergeți utilizatorul "${user.display_name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Eroare la ștergerea utilizatorului');
      onShowToast('Utilizatorul a fost șters.', 'success');
      fetchUsers();
      onReloadHierarchy();
    } catch (err) {
      onShowToast(err.message, 'error');
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
      fetchUsers();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  // --- Handlers 2FA Google ---
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
        setVerifyStatus({ ok: true, msg: 'Cod valid! Sincronizat corect.' });
      } else {
        setVerifyStatus({ ok: false, msg: 'Cod invalid sau expirat.' });
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
      <div key={node.id} style={{ marginBottom: '10px' }}>
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
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {node.name}
                {node.code && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                    [{node.code}]
                  </span>
                )}
              </div>
              
              {node.description && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {node.description}
                </div>
              )}

              {/* Utilizatori asignati pe acest nivel */}
              {node.users && node.users.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <Users size={12} style={{ color: '#a5b4fc' }} />
                  <span style={{ fontSize: '0.725rem', color: '#cbd5e1' }}>Membri:</span>
                  {node.users.map(u => (
                    <span 
                      key={u.id}
                      style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#c7d2fe',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.725rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <strong>{u.display_name}</strong>
                      {u.job_title && <span style={{ opacity: 0.8 }}>({u.job_title})</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '6px' }}>
              {node.total_emails} email-uri
            </span>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenAddUser(node.id)}
              title="Adaugă un utilizator direct pe această poziție ierarhică"
              style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd' }}
            >
              <UserPlus size={13} />
              + User pe acest nivel
            </button>

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
            Arbore Ierarhic & Utilizatori
          </button>

          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            Gestiune Utilizatori & 2FA
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
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Configurare Structuri Ierarhice & Membri</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Puteți adăuga un număr <strong>nelimitat de nivele</strong> (Rădăcină &rarr; Subnivel &rarr; Sub-subnivel etc.) și puteți plasa utilizatori pe oricare dintre aceste poziții.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => handleOpenAddUser('')}>
                  <UserPlus size={16} />
                  + Adaugă Utilizator
                </button>
                <button className="btn btn-primary" onClick={handleOpenAddRoot}>
                  <Plus size={16} />
                  + Adaugă Nivel Rădăcină (Nivel 1)
                </button>
              </div>
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

        {/* TAB 2: UTILIZATORI & POZITII IERARHICE & 2FA */}
        {activeTab === 'users' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Gestiune Utilizatori pe Poziții Ierarhice</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Creați conturi, asociați-le la nivele ierarhice specifice și configurați autentificarea 2FA Google.
                </p>
              </div>

              <button className="btn btn-primary" onClick={() => handleOpenAddUser('')}>
                <UserPlus size={16} />
                + Adaugă Utilizator Nou
              </button>
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '14px 20px' }}>Utilizator & Funcție</th>
                    <th style={{ padding: '14px 20px' }}>Poziție în Ierarhie</th>
                    <th style={{ padding: '14px 20px' }}>Rol</th>
                    <th style={{ padding: '14px 20px' }}>Google 2FA</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.display_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          @{u.username} &bull; {u.email || 'fără email'}
                        </div>
                        {u.job_title && (
                          <div style={{ fontSize: '0.75rem', color: '#93c5fd', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Briefcase size={12} />
                            {u.job_title}
                          </div>
                        )}
                        {u.imap_user && (
                          <div style={{ fontSize: '0.725rem', color: '#34d399', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            📬 IMAP dedicat: {u.imap_user} {u.has_imap_pass ? '✓' : ''}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        {u.hierarchy_name ? (
                          <span
                            className="hierarchy-tag"
                            style={{
                              backgroundColor: `${u.hierarchy_color || '#3b82f6'}20`,
                              color: u.hierarchy_color || '#60a5fa',
                              border: `1px solid ${u.hierarchy_color || '#3b82f6'}40`,
                              fontSize: '0.75rem'
                            }}
                          >
                            <Tag size={11} />
                            [Nivel {u.level_depth}] {u.hierarchy_name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            -- Neasignat în ierarhie --
                          </span>
                        )}
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
                            Activat (Google 2FA)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Dezactivat
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditUser(u)}
                            title="Editează datele sau schimbă poziția ierarhică"
                          >
                            <Edit size={13} />
                            Editează
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSetup2FA(u)}
                            title="Configurează Google Authenticator"
                          >
                            <QrCode size={13} />
                            2FA QR
                          </button>

                          <button
                            className={`btn btn-sm ${u.two_factor_enabled ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => handleToggle2FA(u.id, !u.two_factor_enabled)}
                          >
                            {u.two_factor_enabled ? 'Dezactivare' : 'Activare'}
                          </button>

                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteUser(u)}
                            title="Șterge utilizatorul"
                          >
                            <Trash2 size={13} />
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

      {/* MODAL ADAUGARE / EDITARE UTILIZATOR & POZITIE IERARHICA */}
      {userModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} style={{ color: '#818cf8' }} />
                <h3>{editingUser ? 'Editează Utilizator & Poziție Ierarhică' : 'Adaugă Utilizator Nou în Ierarhie'}</h3>
              </div>
              <button onClick={() => setUserModalOpen(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Nume Afișat (Complet)</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={userFormDisplayName}
                      onChange={(e) => setUserFormDisplayName(e.target.value)}
                      placeholder="ex: Ion Popescu"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nume Utilizator (Username)</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingUser)}
                      value={userFormUsername}
                      onChange={(e) => setUserFormUsername(e.target.value)}
                      placeholder="ex: ipopescu"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Funcție / Titlu Poziție</label>
                    <input
                      type="text"
                      value={userFormJobTitle}
                      onChange={(e) => setUserFormJobTitle(e.target.value)}
                      placeholder="ex: Director Vânzări, Specialist IT"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rol în Aplicație</label>
                    <select
                      value={userFormRole}
                      onChange={(e) => setUserFormRole(e.target.value)}
                    >
                      <option value="user">Utilizator Standard</option>
                      <option value="operator">Operator</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                {/* SELECTOR POZITIE IERARHICA */}
                <div className="form-group" style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <label className="form-label" style={{ color: '#93c5fd', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} />
                    Poziție în Structura Ierarhică (Pe oricâte nivele):
                  </label>
                  <select
                    value={userFormHierarchyId}
                    onChange={(e) => setUserFormHierarchyId(e.target.value)}
                    style={{ width: '100%', fontSize: '0.875rem', fontWeight: 500 }}
                  >
                    <option value="">-- Fără poziție ierarhică (Neasignat) --</option>
                    {flatHierarchy.map(node => (
                      <option key={node.id} value={node.id}>
                        {'  '.repeat(node.level_depth - 1)}[Nivel {node.level_depth}] {node.name} {node.code ? `(${node.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Selectați nivelul din structură căruia îi aparține acest utilizator.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Adresă E-mail Notificări</label>
                    <input
                      type="email"
                      value={userFormEmail}
                      onChange={(e) => setUserFormEmail(e.target.value)}
                      placeholder="nume@companie.ro"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{editingUser ? 'Parolă aplicație (opțional)' : 'Parolă conectare aplicație'}</label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={userFormPassword}
                      onChange={(e) => setUserFormPassword(e.target.value)}
                      placeholder={editingUser ? 'Lăsați gol dacă nu schimbați' : 'Introduceți parola...'}
                    />
                  </div>
                </div>

                {/* SECTIUNE CREDENTIALE IMAP DEDICATE */}
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <label className="form-label" style={{ color: '#6ee7b7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    📬 Căsuță Poștală IMAP Dedicată (Opțional):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Utilizator IMAP / Căsuță E-mail</label>
                      <input
                        type="text"
                        value={userFormImapUser}
                        onChange={(e) => setUserFormImapUser(e.target.value)}
                        placeholder="ex: ion.popescu@pbasig.ro"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Parolă IMAP E-mail</label>
                      <input
                        type="password"
                        value={userFormImapPass}
                        onChange={(e) => setUserFormImapPass(e.target.value)}
                        placeholder={editingUser && editingUser.has_imap_pass ? '••••••••' : 'Parolă IMAP...'}
                      />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Dacă este completat, acest utilizator se va conecta și își va sincroniza propria căsuță IMAP. Dacă se lasă gol, va folosi căsuța globală a companiei.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setUserModalOpen(false)}>
                  Anulează
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Salvează Modificările' : 'Creează Utilizatorul'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                Scanați codul QR cu aplicația <strong>Google Authenticator</strong> de pe telefon pentru utilizatorul <strong>{selectedUser2FA?.username}</strong>:
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
                  Testare cod 6 cifre (cu telefonul sau direct din browser):
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
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    title="Generează codul acum direct din calculator fără telefon"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin/users/${selectedUser2FA.id}/current-token`);
                        const d = await res.json();
                        if (d.token) {
                          setVerifyTestCode(d.token);
                          setVerifyStatus({ ok: true, msg: `Cod generat din browser: ${d.token} (expiră în ${d.remainingSeconds}s)` });
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    style={{ background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe' }}
                  >
                    Generează din Browser
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
