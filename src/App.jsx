import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import HierarchySidebar from './components/HierarchySidebar.jsx';
import MailView from './components/MailView.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import LoginModal from './components/LoginModal.jsx';
import AdminLoginModal from './components/AdminLoginModal.jsx';
import ComposeModal from './components/ComposeModal.jsx';
import UserMailSettingsModal from './components/UserMailSettingsModal.jsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeView, setActiveView] = useState('mail'); // 'mail' | 'admin'

  // Modale
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [adminLoginModalOpen, setAdminLoginModalOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState(null);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);

  // Date E-mail & Ierarhie
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedHierarchyId, setSelectedHierarchyId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hierarchyTree, setHierarchyTree] = useState([]);
  const [flatHierarchy, setFlatHierarchy] = useState([]);
  const [totalEmailsCount, setTotalEmailsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Toast Notificari
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Verificare sesiune utilizator si admin la pornire
  useEffect(() => {
    checkCurrentUser();
    checkAdminSession();
    loadHierarchy();
    loadEmails();
  }, []);

  // Reincarcare e-mailuri la schimbarea filtrului ierarhic sau a termenului de cautare
  useEffect(() => {
    loadEmails();
  }, [selectedHierarchyId, searchTerm]);

  const checkCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.user) setCurrentUser(data.user);
      loadEmails();
    } catch (err) {
      console.error(err);
    }
  };

  const checkAdminSession = async () => {
    try {
      const res = await fetch('/api/admin/check', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setIsAdmin(Boolean(data.isAdmin));
    } catch (err) {
      console.error(err);
    }
  };

  const loadHierarchy = async () => {
    try {
      const res = await fetch('/api/hierarchy', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (res.ok) {
        setHierarchyTree(data.tree || []);
        setFlatHierarchy(data.flat || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectEmail = async (email) => {
    if (!email) {
      setSelectedEmail(null);
      return;
    }
    // Previzualizare rapida din lista
    setSelectedEmail(email);
    // Marcare rapida ca citit in starea locala a listei
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: 1 } : e));

    try {
      const res = await fetch(`/api/emails/${email.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setSelectedEmail(data.email);
        }
      }
    } catch (err) {
      console.error('Eroare la preluarea corpului e-mailului:', err);
    }
  };

  const loadEmails = async () => {
    try {
      let url = '/api/emails?';
      if (selectedHierarchyId === 'flagged') {
        url += 'flagged=1';
      } else if (selectedHierarchyId) {
        url += `hierarchy_id=${encodeURIComponent(selectedHierarchyId)}`;
      }
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setEmails(data.emails || []);
        if (selectedHierarchyId === '' && !searchTerm) {
          setTotalEmailsCount((data.emails || []).length);
        }
        if (data.emails && data.emails.length > 0) {
          // Daca nu avem un email selectat sau cel selectat nu mai este in lista curenta
          if (!selectedEmail || !data.emails.some(e => e.id === selectedEmail.id)) {
            handleSelectEmail(data.emails[0]);
          }
        } else {
          setSelectedEmail(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncImap = async () => {
    setIsSyncing(true);
    showToast('Sincronizare IMAP în desfășurare...', 'info');
    try {
      const res = await fetch('/api/imap/sync', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Sincronizare completă: ${data.count} e-mailuri noi descărcate.`, 'success');
        setSelectedEmail(null);
        await loadEmails();
        loadHierarchy();
      } else {
        showToast(data.error || 'Serverul IMAP nu a putut fi contactat.', 'error');
      }
    } catch (err) {
      showToast('Eroare la sincronizare IMAP: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAdmin = () => {
    if (isAdmin) {
      setActiveView('admin');
    } else {
      setAdminLoginModalOpen(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    setActiveView('admin');
    showToast('Autentificat în Panoul de Administrare cu succes!', 'success');
  };

  const handleUserLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setCurrentUser(null);
    setEmails([]);
    setSelectedEmail(null);
    showToast('V-ați deconectat de la cont.', 'info');
  };

  const handleAssignHierarchy = async (emailId, hierarchyId) => {
    try {
      const res = await fetch(`/api/emails/${emailId}/hierarchy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hierarchy_id: hierarchyId })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`E-mailul a fost asociat la: ${data.hierarchy_name}`, 'success');
        loadEmails();
        loadHierarchy();
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail(prev => ({
            ...prev,
            hierarchy_id: data.hierarchy_id,
            hierarchy_name: data.hierarchy_name
          }));
        }
      }
    } catch (err) {
      showToast('Eroare la asignare: ' + err.message, 'error');
    }
  };

  
  const handleDeleteEmail = async (emailId) => {
    try {
      const res = await fetch(`/api/emails/${emailId}`, { method: "DELETE", credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.is_protected_domain) {
          showToast("E-mailul a fost șters din aplicație (domeniu protejat, păstrat pe serverul IMAP).", "info");
        } else if (data.deleted_from_imap) {
          showToast("E-mailul a fost șters din aplicație și din căsuța originală de mail.", "info");
        } else {
          showToast("E-mailul a fost șters cu succes.", "info");
        }
        setEmails(prev => prev.filter(e => e.id !== emailId));
        if (selectedEmail?.id === emailId) {
          const remaining = emails.filter(e => e.id !== emailId);
          setSelectedEmail(remaining.length > 0 ? remaining[0] : null);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Eroare la ștergere: ' + res.status, 'error');
      }
    } catch (err) {
      showToast("Eroare la ștergerea e-mailului: " + err.message, "error");
    }
  };

  const handleToggleRead = async (email) => {
    const newRead = !email.is_read;
    try {
      await fetch(`/api/emails/${email.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ is_read: newRead ? 1 : 0 })
      });
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: newRead ? 1 : 0 } : e));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(prev => ({ ...prev, is_read: newRead ? 1 : 0 }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenComposeWithData = (data = null) => {
    setComposeInitialData(data);
    setIsComposeOpen(true);
  };

  const handleToggleStar = async (email) => {
    const newFlag = !email.is_flagged;
    try {
      await fetch(`/api/emails/${email.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_flagged: newFlag })
      });
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_flagged: newFlag ? 1 : 0 } : e));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(prev => ({ ...prev, is_flagged: newFlag ? 1 : 0 }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      {/* Bara de Navigare Superioara */}
      <Navbar
        user={currentUser}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleUserLogout}
        onOpenAdmin={handleOpenAdmin}
        isAdmin={isAdmin}
        onSyncImap={handleSyncImap}
        isSyncing={isSyncing}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenUserSettings={() => {
          if (!currentUser) {
            setLoginModalOpen(true);
          } else {
            setIsUserSettingsOpen(true);
          }
        }}
        onOpenCompose={() => handleOpenComposeWithData(null)}
      />

      {/* Zona Principala */}
      <main className="main-content">
        {activeView === 'admin' ? (
          <AdminPanel
            hierarchyTree={hierarchyTree}
            flatHierarchy={flatHierarchy}
            onReloadHierarchy={loadHierarchy}
            onShowToast={showToast}
          />
        ) : (
          <>
            <HierarchySidebar
              hierarchyTree={hierarchyTree}
              selectedHierarchyId={selectedHierarchyId}
              onSelectHierarchy={setSelectedHierarchyId}
              totalEmailsCount={totalEmailsCount}
            />

            <MailView
              currentUser={currentUser}
              onOpenLogin={() => setLoginModalOpen(true)}
              emails={emails}
              selectedEmail={selectedEmail}
              onSelectEmail={handleSelectEmail}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              flatHierarchy={flatHierarchy}
              onAssignHierarchy={handleAssignHierarchy}
              onToggleStar={handleToggleStar}
              onDeleteEmail={handleDeleteEmail}
              onToggleRead={handleToggleRead}
              onOpenCompose={handleOpenComposeWithData}
            />
          </>
        )}
      </main>

      <UserMailSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        currentUser={currentUser}
        onSaved={(msg) => {
          showToast(msg, "success");
          checkCurrentUser();
        }}
      />


      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => {
          setIsComposeOpen(false);
          setComposeInitialData(null);
        }}
        initialData={composeInitialData}
        flatHierarchy={flatHierarchy}
        onEmailSent={(msg) => {
          showToast(msg, "success");
          loadEmails();
        }}
      />


      {/* Modale */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          showToast(`Bun venit, ${user.displayName}!`, 'success');
        }}
      />

      <AdminLoginModal
        isOpen={adminLoginModalOpen}
        onClose={() => setAdminLoginModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      {/* Container Notificari Toast */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
