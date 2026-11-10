import React, { useState, useEffect } from 'react';
import { X, Mail, Server, Send, RefreshCw, CheckCircle2, AlertCircle, Key, Lock, ShieldCheck } from 'lucide-react';

export default function UserMailSettingsModal({ isOpen, onClose, onSaved, currentUser }) {
  const [imapHost, setImapHost] = useState('mail.pbasig.ro');
  const [imapPort, setImapPort] = useState(993);
  const [imapTls, setImapTls] = useState(1);
  const [imapUser, setImapUser] = useState('');
  const [imapPass, setImapPass] = useState('');
  const [hasImapPass, setHasImapPass] = useState(false);

  const [smtpHost, setSmtpHost] = useState('mail.pbasig.ro');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(1);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [hasSmtpPass, setHasSmtpPass] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingImap, setIsTestingImap] = useState(false);
  const [imapTestResult, setImapTestResult] = useState(null);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setStatusMsg(null);
    setImapTestResult(null);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/user/mail-settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || {};
        setImapHost(s.imap_host || 'mail.pbasig.ro');
        setImapPort(s.imap_port || 993);
        setImapTls(s.imap_tls !== undefined ? s.imap_tls : 1);
        setImapUser(s.imap_user || currentUser?.email || '');
        setHasImapPass(Boolean(s.has_imap_pass));
        setImapPass('');

        setSmtpHost(s.smtp_host || 'mail.pbasig.ro');
        setSmtpPort(s.smtp_port || 465);
        setSmtpSecure(s.smtp_secure !== undefined ? s.smtp_secure : 1);
        setSmtpUser(s.smtp_user || '');
        setHasSmtpPass(Boolean(s.has_smtp_pass));
        setSmtpPass('');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Eroare la încărcarea setărilor: ' + err.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleTestImap = async () => {
    if (!imapUser.trim()) {
      setStatusMsg({ type: 'error', text: 'Introduceți adresa de e-mail / utilizatorul IMAP.' });
      return;
    }
    setIsTestingImap(true);
    setImapTestResult(null);
    try {
      const res = await fetch('/api/user/imap/test', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: imapHost,
          port: imapPort,
          tls: imapTls,
          username: imapUser.trim(),
          password: imapPass
        })
      });
      const data = await res.json();
      setImapTestResult(data);
    } catch (err) {
      setImapTestResult({ success: false, error: err.message });
    } finally {
      setIsTestingImap(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/user/smtp/test', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          username: smtpUser.trim() || imapUser.trim(),
          password: smtpPass || imapPass
        })
      });
      const data = await res.json();
      setSmtpTestResult(data);
    } catch (err) {
      setSmtpTestResult({ success: false, error: err.message });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!imapUser.trim()) {
      setStatusMsg({ type: 'error', text: 'Completați utilizatorul IMAP (adresa dvs. de e-mail).' });
      return;
    }
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/user/mail-settings', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imap_host: imapHost.trim(),
          imap_port: imapPort,
          imap_tls: imapTls,
          imap_user: imapUser.trim(),
          imap_pass: imapPass,
          smtp_host: smtpHost.trim(),
          smtp_port: smtpPort,
          smtp_secure: smtpSecure,
          smtp_user: smtpUser ? smtpUser.trim() : '',
          smtp_pass: smtpPass
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eroare la salvare');

      if (onSaved) onSaved('Setările proprii de e-mail (IMAP & SMTP) au fost salvate cu succes!');
      onClose();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#2563eb', padding: '7px', borderRadius: '8px', color: '#fff', display: 'flex' }}>
              <Server size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                Setările Mele IMAP & SMTP
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Fiecare utilizator își gestionează propria conexiune de e-mail &bull; Cont: <strong>{currentUser?.displayName || currentUser?.username}</strong>
              </span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} disabled={isSaving}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ padding: '20px' }}>
          {statusMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: statusMsg.type === 'error' ? '#fca5a5' : '#86efac',
              border: `1px solid ${statusMsg.type === 'error' ? '#ef4444' : '#10b981'}`
            }}>
              {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* SECTIUNE INCOMING IMAP */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '16px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={16} />
              Incoming (Primire E-mailuri prin IMAP)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px', marginBottom: '10px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Gazdă Server IMAP</label>
                <input
                  type="text"
                  required
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="mail.pbasig.ro"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Port & Criptare</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    style={{ width: '80px' }}
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                  />
                  <select
                    value={imapTls}
                    onChange={(e) => setImapTls(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  >
                    <option value={1}>SSL/TLS (993)</option>
                    <option value={0}>STARTTLS / Simplu (143)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Utilizator IMAP (Adresa Dvs. de E-mail)</label>
                <input
                  type="email"
                  required
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  placeholder="ex: prenume.nume@pbasig.ro"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Parolă Căsuță IMAP</label>
                <input
                  type="password"
                  value={imapPass}
                  onChange={(e) => setImapPass(e.target.value)}
                  placeholder={hasImapPass ? '•••••••• (Parolă salvată - lăsați gol pt. păstrare)' : 'Introduceți parola...'}
                />
              </div>
            </div>

            {imapTestResult && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                marginTop: '10px',
                background: imapTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${imapTestResult.success ? '#10b981' : '#ef4444'}`,
                color: imapTestResult.success ? '#86efac' : '#fca5a5'
              }}>
                {imapTestResult.success ? (
                  <span>✓ Conexiune IMAP reușită! Răspuns în {imapTestResult.latencyMs} ms ({imapTestResult.mailboxCount} dosare găsite).</span>
                ) : (
                  <span>✕ Eroare conectare: {imapTestResult.error}</span>
                )}
              </div>
            )}

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestImap}
                disabled={isTestingImap || !imapUser}
                style={{ fontSize: '0.785rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={13} className={isTestingImap ? 'animate-spin' : ''} />
                <span>{isTestingImap ? 'Se testează...' : 'Testează Conexiunea IMAP'}</span>
              </button>
            </div>
          </div>

          {/* SECTIUNE OUTGOING SMTP */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '18px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={15} />
              Outgoing (Trimitere E-mailuri prin SMTP)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px', marginBottom: '10px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Gazdă Server SMTP</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="mail.pbasig.ro"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Port & Criptare</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    style={{ width: '80px' }}
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                  />
                  <select
                    value={smtpSecure}
                    onChange={(e) => setSmtpSecure(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  >
                    <option value={1}>SSL/TLS (465)</option>
                    <option value={0}>STARTTLS (587)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Utilizator SMTP Expeditor</label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="Lăsați gol pentru a folosi utilizatorul IMAP"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Parolă SMTP</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={hasSmtpPass ? '•••••••• (Lăsați gol pt. păstrare)' : 'Lăsați gol pt. parola IMAP'}
                />
              </div>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Dacă lăsați parola SMTP goală, sistemul va folosi automat parola salvată la IMAP pentru expediere.
            </span>

            {smtpTestResult && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                marginTop: '10px',
                background: smtpTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${smtpTestResult.success ? '#10b981' : '#ef4444'}`,
                color: smtpTestResult.success ? '#86efac' : '#fca5a5'
              }}>
                {smtpTestResult.success ? (
                  <span>✓ Conexiune SMTP reușită! Răspuns în {smtpTestResult.latencyMs} ms. Serverul este gata pentru expediere.</span>
                ) : (
                  <span>✕ Eroare expediere SMTP: {smtpTestResult.error}</span>
                )}
              </div>
            )}

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestSmtp}
                disabled={isTestingSmtp}
                style={{ fontSize: '0.785rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <RefreshCw size={13} className={isTestingSmtp ? 'animate-spin' : ''} />
                <span>{isTestingSmtp ? 'Se testează SMTP...' : 'Testează Conexiunea SMTP'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Anulează
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px' }}
            >
              <CheckCircle2 size={16} />
              <span>{isSaving ? 'Se salvează...' : 'Salvează Setările Mele'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
