import React, { useState, useEffect } from 'react';
import { X, Send, Paperclip, FileText, CheckCircle2, AlertCircle, Link2, Trash2 } from 'lucide-react';

export default function ComposeModal({ isOpen, onClose, onEmailSent, flatHierarchy = [], initialData = null }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [selectedHierarchyId, setSelectedHierarchyId] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (initialData) {
      setTo(initialData.to || "");
      setSubject(initialData.subject || "");
      setBodyText(initialData.bodyText || "");
      setSelectedHierarchyId(initialData.hierarchyId || "");
    } else {
      setTo("");
      setSubject("");
      setBodyText("");
      setSelectedHierarchyId("");
    }
    setUploadedDocs([]);
    setStatusMsg(null);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;

    setIsUploading(true);
    setStatusMsg({ type: 'info', text: 'Se încarcă documentele pe server și se generează link-urile securizate...' });

    const formData = new FormData();
    selected.forEach(file => {
      formData.append('documents', file);
    });

    try {
      const res = await fetch('/api/documents/upload', { credentials: 'include',
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Eroare la încărcarea fișierelor');
      }

      setUploadedDocs(prev => [...prev, ...data.documents]);
      setStatusMsg({ 
        type: 'success', 
        text: `✓ ${data.documents.length} fișier(e) încărcat(e) cu succes! Vor fi transformate automat în link-uri securizate de descărcare.` 
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveDoc = (index) => {
    setUploadedDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!to.trim()) {
      setStatusMsg({ type: 'error', text: 'Introduceți adresa de e-mail a destinatarului.' });
      return;
    }

    setIsSending(true);
    setStatusMsg({ type: 'info', text: 'Se trimite e-mailul prin serverul Outgoing (SMTP)...' });

    try {
      const res = await fetch('/api/mail/send', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          bodyText: bodyText,
          hierarchyId: selectedHierarchyId || null,
          documentIds: uploadedDocs.map(d => d.id)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Eroare la trimiterea e-mailului');
      }

      if (onEmailSent) {
        onEmailSent(`E-mailul a fost trimis cu succes către ${to.trim()}! Documente transformate în link: ${uploadedDocs.length}`);
      }
      onClose();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#2563eb', padding: '6px', borderRadius: '8px', color: '#fff', display: 'flex' }}>
              <Send size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>Mesaj Nou (Outgoing Email)</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Trimite e-mail securizat cu transformare automată a fișierelor în link-uri de descărcare
              </span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} disabled={isSending}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {statusMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : (statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'),
              color: statusMsg.type === 'error' ? '#fca5a5' : (statusMsg.type === 'success' ? '#86efac' : '#93c5fd'),
              border: `1px solid ${statusMsg.type === 'error' ? '#ef4444' : (statusMsg.type === 'success' ? '#10b981' : '#3b82f6')}`
            }}>
              {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Către (Destinatar):</label>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@exemplu.ro, partener@firma.ro"
              style={{ width: '100%', padding: '8px 12px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Subiect:</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Documente contractuale / Oferta"
                style={{ width: '100%', padding: '8px 12px' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Nivel Ierarhic Asociat:</label>
              <select
                value={selectedHierarchyId}
                onChange={(e) => setSelectedHierarchyId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px' }}
              >
                <option value="">-- Fără asignare --</option>
                {flatHierarchy.map(node => (
                  <option key={node.id} value={node.id}>
                    {' '.repeat((node.level_depth - 1) * 2)}[Niv. {node.level_depth}] {node.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Mesaj Text:</label>
            <textarea
              rows={6}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Scrieți conținutul mesajului aici..."
              style={{ width: '100%', padding: '10px 12px', resize: 'vertical' }}
            />
          </div>

          {/* ZONA DOCUMENTELOR TRANSFORMATE IN LINK */}
          <div style={{
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: '1px dashed rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                <Link2 size={16} color="#38bdf8" />
                <span>Documente Atașate &rarr; Transformare Automată în Link</span>
              </div>

              <label className="btn btn-secondary" style={{ cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.785rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Paperclip size={14} />
                <span>{isUploading ? 'Se încarcă...' : 'Atașează Documente'}</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <p style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Orice fișier încărcat este păstrat în siguranță pe server, iar în e-mailul destinatarului va fi inserat automat un link securizat de descărcare directă (fără limite de dimensiune email).
            </p>

            {uploadedDocs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {uploadedDocs.map((doc, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    fontSize: '0.8rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color="#60a5fa" />
                      <span style={{ fontWeight: 600 }}>{doc.original_filename}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        ({(doc.file_size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: '#10b981',
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}>
                        Link Activ
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                        title="Șterge documentul"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSending || isUploading}
            >
              Anulează
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSending || isUploading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px' }}
            >
              <Send size={16} />
              <span>{isSending ? 'Se trimite...' : 'Trimite E-mail'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
