import React, { useState } from 'react';
import { 
  Search, Star, Tag, Paperclip, Calendar, User, 
  Trash2, ChevronLeft, ChevronRight, Reply, Forward, 
  Download, Mail, CheckCircle2, AlertCircle, PlusCircle, ExternalLink, Link2, Eye, EyeOff
} from 'lucide-react';

export default function MailView({
  currentUser,
  onOpenLogin,
  emails = [],
  selectedEmail,
  onSelectEmail,
  searchTerm,
  setSearchTerm,
  flatHierarchy = [],
  onAssignHierarchy,
  onToggleStar,
  onDeleteEmail,
  onOpenCompose,
  onToggleRead
}) {
    if (!currentUser) {
    return (
      <div className="mail-view-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%" }}>
        <div style={{
          maxWidth: "480px",
          textAlign: "center",
          padding: "36px",
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
          borderRadius: "12px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.3)"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: "rgba(59, 130, 246, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
            color: "#60a5fa"
          }}>
            <Mail size={30} />
          </div>
          <h2 style={{ margin: "0 0 10px 0", fontSize: "1.25rem", fontWeight: 700 }}>
            Confidențialitate & Protecție E-mail
          </h2>
          <p style={{ margin: "0 0 20px 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.6" }}>
            E-mailurile fiecărui utilizator sunt <strong>complet private</strong>. Nimeni &mdash; nici chiar administratorul sistemului &mdash; nu are acces la corespondența dvs. fără credențialele dvs. personale.
          </p>
          <button
            className="btn btn-primary"
            onClick={onOpenLogin}
            style={{ padding: "9px 22px", fontSize: "0.9rem", fontWeight: 600 }}
          >
            Autentificare în Contul Dvs.
          </button>
        </div>
      </div>
    );
  }

  const [filterType, setFilterType] = useState('all'); // 'all' | 'unread' | 'starred'

  // Indexul emailului curent pentru navigare Urmatorul / Anteriorul
  const currentIndex = selectedEmail 
    ? emails.findIndex(e => e.id === selectedEmail.id) 
    : -1;

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < emails.length - 1) {
      onSelectEmail(emails[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectEmail(emails[currentIndex - 1]);
    }
  };

  // Parsare atasamente / documente
  let parsedAttachments = [];
  try {
    if (selectedEmail && selectedEmail.attachments_json) {
      parsedAttachments = JSON.parse(selectedEmail.attachments_json);
    }
  } catch (e) {
    parsedAttachments = [];
  }

  // Filtrare rapida locala a listei
  const filteredEmails = emails.filter(email => {
    if (filterType === 'unread') return !email.is_read;
    if (filterType === 'starred') return email.is_flagged;
    return true;
  });

  return (
    <div className="mail-view-container">
      {/* Panou Lista Mesaje */}
      <div className="mail-list-panel">
        <div className="mail-list-toolbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => onOpenCompose && onOpenCompose()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
                whiteSpace: 'nowrap'
              }}
              title="Compune un nou e-mail"
            >
              <PlusCircle size={15} />
              <span>Compune</span>
            </button>

            <div className="search-box" style={{ flex: 1, margin: 0 }}>
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Caută în e-mailuri..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Filtre rapide */}
          <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                background: filterType === 'all' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: `1px solid ${filterType === 'all' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                color: filterType === 'all' ? '#93c5fd' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer'
              }}
            >
              Toate ({emails.length})
            </button>
            <button
              onClick={() => setFilterType('unread')}
              style={{
                background: filterType === 'unread' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: `1px solid ${filterType === 'unread' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                color: filterType === 'unread' ? '#93c5fd' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer'
              }}
            >
              Necitite ({emails.filter(e => !e.is_read).length})
            </button>
            <button
              onClick={() => setFilterType('starred')}
              style={{
                background: filterType === 'starred' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                border: `1px solid ${filterType === 'starred' ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                color: filterType === 'starred' ? '#fcd34d' : 'var(--text-muted)',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer'
              }}
            >
              Importante ({emails.filter(e => e.is_flagged).length})
            </button>
          </div>
        </div>

        <div className="mail-items-container">
          {filteredEmails.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Niciun e-mail găsit în această vizualizare.
            </div>
          ) : (
            filteredEmails.map(email => (
              <div
                key={email.id}
                className={`mail-card ${email.is_read ? '' : 'unread'} ${selectedEmail?.id === email.id ? 'selected' : ''}`}
                onClick={() => onSelectEmail(email)}
              >
                <div className="mail-card-header">
                  <span className="mail-sender">{email.sender_name || email.sender_email}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(email);
                      }}
                      style={{ cursor: 'pointer', color: email.is_flagged ? '#f59e0b' : '#64748b' }}
                      title={email.is_flagged ? 'Elimină marcaj' : 'Marchează ca important'}
                    >
                      <Star size={14} fill={email.is_flagged ? '#f59e0b' : 'none'} />
                    </span>
                    <span className="mail-date">
                      {new Date(email.date_received).toLocaleDateString('ro-RO', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                  </div>
                </div>

                <div className="mail-subject" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {email.subject || '(Fără subiect)'}
                  </span>
                  {email.attachments_json && email.attachments_json !== '[]' && (
                    <Paperclip size={13} style={{ color: '#38bdf8', flexShrink: 0 }} title="Conține atașamente / fișiere" />
                  )}
                </div>

                {email.body_snippet && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {email.body_snippet.replace(/\s+/g, ' ').trim()}
                  </div>
                )}

                {email.hierarchy_name && (
                  <span
                    className="hierarchy-tag"
                    style={{
                      backgroundColor: `${email.hierarchy_color || '#3b82f6'}20`,
                      color: email.hierarchy_color || '#60a5fa',
                      border: `1px solid ${email.hierarchy_color || '#3b82f6'}40`,
                      marginTop: '4px'
                    }}
                  >
                    <Tag size={10} />
                    Nv.{email.level_depth}: {email.hierarchy_name}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panou Citire Mesaj */}
      <div className="mail-reader-panel">
        {selectedEmail ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* BARA SUPERIOARA DE ACTIUNI COMPLETA */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.02)',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              {/* Grupul stang: Navigare Urmator / Anterior */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  title="Mesajul anterior"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ChevronLeft size={16} />
                  <span>Anteriorul</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={handleNext}
                  disabled={currentIndex === -1 || currentIndex >= emails.length - 1}
                  title="Mesajul următor"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Următorul</span>
                  <ChevronRight size={16} />
                </button>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  {currentIndex >= 0 ? `${currentIndex + 1} din ${emails.length}` : ''}
                </span>
              </div>

              {/* Grupul din dreapta: Raspunde, Retrimite, Marcheaza, Sterge, etc. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => onOpenCompose && onOpenCompose({
                    to: selectedEmail.sender_email,
                    subject: `Re: ${selectedEmail.subject || ''}`,
                    bodyText: `\n\n--- În data de ${new Date(selectedEmail.date_received).toLocaleString('ro-RO')}, ${selectedEmail.sender_name || selectedEmail.sender_email} a scris: ---\n> ${selectedEmail.body_text || ''}`
                  })}
                  title="Răspunde expeditorului"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Reply size={15} />
                  <span>Răspunde</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => onOpenCompose && onOpenCompose({
                    subject: `Fwd: ${selectedEmail.subject || ''}`,
                    bodyText: `\n\n---------- Mesaj redirecționat ----------\nDe la: ${selectedEmail.sender_name} <${selectedEmail.sender_email}>\nData: ${new Date(selectedEmail.date_received).toLocaleString('ro-RO')}\nSubiect: ${selectedEmail.subject}\nCătre: ${selectedEmail.recipient}\n\n${selectedEmail.body_text || ''}`
                  })}
                  title="Redirecționează mesajul"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Forward size={15} />
                  <span>Redirecționează</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => onToggleRead && onToggleRead(selectedEmail)}
                  title={selectedEmail.is_read ? 'Marchează ca necitit' : 'Marchează ca citit'}
                  style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  {selectedEmail.is_read ? <EyeOff size={15} /> : <Eye size={15} />}
                  <span>{selectedEmail.is_read ? 'Necitit' : 'Citit'}</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => onToggleStar && onToggleStar(selectedEmail)}
                  title={selectedEmail.is_flagged ? 'Elimină marcaj' : 'Marchează important'}
                  style={{ padding: '6px 10px', fontSize: '0.8rem', color: selectedEmail.is_flagged ? '#f59e0b' : 'inherit' }}
                >
                  <Star size={15} fill={selectedEmail.is_flagged ? '#f59e0b' : 'none'} />
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (window.confirm(`Sigur doriți să ștergeți e-mailul: "${selectedEmail.subject}"?`)) {
                      onDeleteEmail && onDeleteEmail(selectedEmail.id);
                    }
                  }}
                  title="Șterge definitiv e-mailul"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Trash2 size={15} />
                  <span>Șterge</span>
                </button>
              </div>
            </div>

            {/* Antetul E-mailului */}
            <div className="reader-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <h1 className="reader-subject" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
                  {selectedEmail.subject || '(Fără subiect)'}
                </h1>
                
                {/* Selector Asignare Ierarhica */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <Tag size={14} color="#60a5fa" />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ierarhie:</span>
                  <select
                    value={selectedEmail.hierarchy_id || ''}
                    onChange={(e) => onAssignHierarchy(selectedEmail.id, e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '5px 10px', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                  >
                    <option value="">-- Neclasificat --</option>
                    {flatHierarchy.map(node => (
                      <option key={node.id} value={node.id}>
                        {' '.repeat((node.level_depth - 1) * 2)}[Niv. {node.level_depth}] {node.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="reader-meta-row" style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="reader-sender-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="sender-avatar" style={{ width: '38px', height: '38px', fontSize: '1rem' }}>
                    {(selectedEmail.sender_name || selectedEmail.sender_email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedEmail.sender_name || selectedEmail.sender_email}</div>
                    <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                      De la: <strong>{selectedEmail.sender_email}</strong> &bull; Către: <strong>{selectedEmail.recipient}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} />
                  <span>{new Date(selectedEmail.date_received).toLocaleString('ro-RO')}</span>
                </div>
              </div>
            </div>

            {/* SECTIUNE ATASAMENTE / DOCUMENTE TRANSFORMAT CU LINK-URI */}
            {parsedAttachments.length > 0 && (
              <div style={{
                padding: '12px 20px',
                background: 'rgba(59, 130, 246, 0.06)',
                borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#93c5fd' }}>
                  <Paperclip size={14} />
                  <span>Fișiere & Documente atașate ({parsedAttachments.length}):</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {parsedAttachments.map((att, idx) => {
                    const downloadUrl = att.download_token 
                      ? `/api/documents/download/${att.download_token}` 
                      : (att.url || '#');

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 12px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          fontSize: '0.785rem'
                        }}
                      >
                        <Link2 size={14} color="#38bdf8" />
                        <span style={{ fontWeight: 500 }}>{att.filename || 'document.bin'}</span>
                        {att.size && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            ({(att.size / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                        )}

                        {att.download_token ? (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              marginLeft: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#60a5fa',
                              textDecoration: 'none',
                              fontWeight: 600
                            }}
                          >
                            <Download size={13} />
                            <span>Descarcă</span>
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Corpul E-mailului */}
            <div className="reader-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {selectedEmail.body_html ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                  style={{
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '24px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    lineHeight: '1.6'
                  }}
                />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6' }}>
                  {selectedEmail.body_text || '(Mesajul nu conține text în corpul principal)'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', padding: '20px' }}>
            <Mail size={54} style={{ opacity: 0.25, marginBottom: '16px' }} />
            <h3 style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Selectați un e-mail din listă pentru a-l citi</h3>
            <p style={{ fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>
              Puteți compune mesaje noi, naviga între e-mailuri, descărca documente securizate sau asigna structura ierarhică direct din bară.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
