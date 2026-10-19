import React, { useState } from 'react';
import { X, ShieldAlert, KeyRound, Smartphone, Lock, Laptop, Sparkles, RefreshCw } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [step, setStep] = useState(1); // 1 = user/pass, 2 = 2fa
  const [username, setUsername] = useState('operator');
  const [password, setPassword] = useState('operator123');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [browserCodeInfo, setBrowserCodeInfo] = useState(null);
  const [isGeneratingBrowserCode, setIsGeneratingBrowserCode] = useState(false);

  if (!isOpen) return null;

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setBrowserCodeInfo(null);

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

  const handleFetchBrowserCode = async () => {
    setIsGeneratingBrowserCode(true);
    setError('');
    try {
      const res = await fetch('/api/auth/current-2fa-token');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nu s-a putut genera codul din browser.');
      
      setTwoFactorCode(data.token);
      setBrowserCodeInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGeneratingBrowserCode(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>
            {step === 1 ? 'Autentificare Utilizator' : 'Verificare 2FA Google (Cu sau Fără Telefon)'}
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
                Conturi gata configurate:<br />
                &bull; <strong>operator</strong> (parolă: <code>operator123</code>) - are 2FA activ (suportă și generare direct din browser fără telefon)<br />
                &bull; <strong>utilizator</strong> (parolă: <code>utilizator123</code>) - logare directă fără 2FA
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

              <h4>Introduceți codul de 6 cifre</h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Puteți folosi aplicația de pe telefon <strong>SAU</strong> genera codul direct din browser:
              </p>

              {error && (
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '14px' }}>
                  {error}
                </div>
              )}

              <input
                type="text"
                autoFocus
                maxLength={6}
                required
                style={{ fontSize: '1.8rem', letterSpacing: '0.3em', textAlign: 'center', width: '220px', margin: '0 auto 14px' }}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
              />

              {/* BUTON GENERARE DIRECT DIN BROWSER (FARA TELEFON) */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px dashed rgba(99, 102, 241, 0.5)',
                borderRadius: '8px',
                padding: '12px 16px',
                textAlign: 'left',
                marginTop: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Laptop size={18} style={{ color: '#818cf8' }} />
                    <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#e2e8f0' }}>
                      Ești doar la calculator (fără telefon)?
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleFetchBrowserCode}
                    disabled={isGeneratingBrowserCode}
                    style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#c7d2fe' }}
                  >
                    <RefreshCw size={13} className={isGeneratingBrowserCode ? 'animate-spin' : ''} />
                    {isGeneratingBrowserCode ? 'Se generează...' : 'Generează cod din browser'}
                  </button>
                </div>

                {browserCodeInfo && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} />
                    Codul generat <strong>{browserCodeInfo.token}</strong> (valabil încă {browserCodeInfo.remainingSeconds}s) a fost introdus automat!
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                Înapoi
              </button>
              <button type="submit" className="btn btn-primary" disabled={isLoading || twoFactorCode.length !== 6}>
                {isLoading ? 'Se validează...' : 'Validează & Conectează'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
