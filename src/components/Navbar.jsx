import React from 'react';
import { Mail, RefreshCw, Settings, Shield, User, LogOut, CheckCircle2, Send, Plus } from 'lucide-react';

export default function Navbar({
  user,
  onOpenLogin,
  onLogout,
  onOpenAdmin,
  isAdmin,
  onSyncImap,
  isSyncing,
  activeView,
  setActiveView,
  onOpenUserSettings,
  onOpenCompose
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

      <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Buton Compune Mesaj */}
        <button
          className="btn btn-primary btn-sm"
          onClick={onOpenCompose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
            fontWeight: 600
          }}
          title="Compune și trimite un mesaj nou"
        >
          <Send size={14} />
          <span>Mesaj Nou</span>
        </button>

        {/* Buton Sincronizare IMAP */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onSyncImap}
          disabled={isSyncing}
          title="Sincronizează căsuța poștală prin IMAP"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'Sincronizare...' : 'Sincronizare IMAP'}</span>
        </button>

        {/* Buton Setări IMAP / Căsuță proprie pentru Utilizator */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenUserSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(59, 130, 246, 0.15)',
            borderColor: 'rgba(59, 130, 246, 0.4)',
            color: '#93c5fd',
            fontWeight: 600
          }}
          title="Configurează adresa ta IMAP, parola și serverul de expediere"
        >
          <Settings size={15} />
          <span>Setări IMAP / Mail</span>
        </button>

        {/* Comutare Intre Mail View si Admin Panel */}
        {activeView === 'admin' ? (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setActiveView('mail')}
          >
            <Mail size={14} />
            <span>Înapoi la E-mailuri</span>
          </button>
        ) : (
          <button
            className="btn btn-admin btn-sm"
            onClick={onOpenAdmin}
            title="Acces la panoul de administrare cu parolă dedicată"
          >
            <Shield size={14} />
            <span>Panou Administrare</span>
          </button>
        )}

        {/* Informatii Utilizator & Pozitie Ierarhica */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user.displayName}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.685rem' }}>
                {user.jobTitle && <span style={{ color: '#cbd5e1' }}>{user.jobTitle}</span>}
                <span style={{ color: user.twoFactorEnabled ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {user.twoFactorEnabled && <CheckCircle2 size={11} />}
                  {user.twoFactorEnabled ? '2FA Google' : 'Fără 2FA'}
                </span>
              </div>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={onLogout} title="Deconectare cont">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={onOpenLogin}>
            <User size={14} />
            <span>Autentificare</span>
          </button>
        )}
      </div>
    </nav>
  );
}
