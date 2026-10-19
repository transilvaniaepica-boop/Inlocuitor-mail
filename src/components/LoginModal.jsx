import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound, Smartphone, Lock } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [step, setStep] = useState(1); // 1 = user/pass, 2 = 2fa
  const [username, setUsername] = useState('operator');
  const [password, setPassword] = useState('operator123');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Autentificare eșuată');
      }

      if (data.requires2FA) {
        setStep(2);
      } else {
        onLoginSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: twoFactorCode.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Codul 2FA este incorect');
      }

      onLoginSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>
            {step === 1 ? 'Autentificare Utilizator' : 'Verificare Google Authenticator 2FA'}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1}>
            <div className="modal-body">
              {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nume utilizator</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: operator sau utilizator"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parolă</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduceți parola..."
                />
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Conturi demonstrative gata configurate:<br />
                &bull; <strong>utilizator</strong> (parolă: <code>utilizator123</code>) - fără 2FA<br />
                &bull; <strong>operator</strong> (parolă: <code>operator123</code>) - suportă 2FA Google
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Anulează
              </button>
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? 'Se verifică...' : 'Continuă'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStep2}>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Smartphone size={28} />
              </div>

              <h4>Introduceți codul din aplicație</h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Deschideți aplicația <strong>Google Authenticator</strong> pe telefon și introduceți codul de 6 cifre asociat contului.
              </p>

              {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <input
                type="text"
                autoFocus
                maxLength={6}
                required
                style={{ fontSize: '1.8rem', letterSpacing: '0.3em', textAlign: 'center', width: '220px', margin: '0 auto' }}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                Înapoi
              </button>
              <button type="submit" className="btn btn-primary" disabled={isLoading || twoFactorCode.length !== 6}>
                {isLoading ? 'Se validează...' : 'Validează 2FA'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
