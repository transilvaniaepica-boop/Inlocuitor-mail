import React from 'react';
import { Mail, RefreshCw, Shield, User, LogOut, CheckCircle2 } from 'lucide-react';

export default function Navbar({
  user,
  onOpenLogin,
  onLogout,
  onOpenAdmin,
  isAdmin,
  onSyncImap,
  isSyncing,
  activeView,
  setActiveView
}) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">
          <Mail size={22} />
        </div>
        <div>
          <span className="brand-title">Înlocuitor Mail</span>
          <span className="brand-badge">Simplificat (În Construcție)</span>
        </div>
      </div>

      <div className="navbar-actions">
        {/* Buton Sincronizare IMAP */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onSyncImap}
          disabled={isSyncing}
          title="Sincronizează căsuța poștală prin IMAP"
        >
          <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Sincronizare...' : 'Sincronizare IMAP'}
        </button>

        {/* Comutare Intre Mail View si Admin Panel */}
        {activeView === 'admin' ? (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setActiveView('mail')}
          >
            <Mail size={15} />
            Înapoi la E-mailuri
          </button>
        ) : (
          <button
            className="btn btn-admin btn-sm"
            onClick={onOpenAdmin}
            title="Acces la panoul de administrare cu parolă dedicată"
          >
            <Shield size={15} />
            Panou Administrare
          </button>
        )}

        {/* Informatii Utilizator & Pozitie Ierarhica */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{user.displayName}</span>
                {user.hierarchyName && (
                  <span
                    style={{
                      fontSize: '0.675rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: user.hierarchyColor || '#93c5fd',
                      border: '1px solid rgba(59, 130, 246, 0.4)'
                    }}
                  >
                    Nv.{user.levelDepth}: {user.hierarchyName}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem' }}>
                {user.jobTitle && <span style={{ color: '#cbd5e1' }}>{user.jobTitle}</span>}
                <span style={{ color: user.twoFactorEnabled ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {user.twoFactorEnabled && <CheckCircle2 size={11} />}
                  {user.twoFactorEnabled ? '2FA Google' : 'Fără 2FA'}
                </span>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onLogout} title="Deconectare cont">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onOpenLogin}>
            <User size={15} />
            Autentificare Utilizator
          </button>
        )}
      </div>
    </nav>
  );
}
