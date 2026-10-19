import React, { useState } from 'react';
import { 
  Search, Star, CheckCircle, Tag, Paperclip, 
  Calendar, User, ArrowRight, ShieldCheck, Mail
} from 'lucide-react';

export default function MailView({
  emails,
  selectedEmail,
  onSelectEmail,
  searchTerm,
  setSearchTerm,
  flatHierarchy,
  onAssignHierarchy,
  onToggleStar
}) {
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);

  return (
    <div className="mail-view-container">
      {/* Panou Lista Mesaje */}
      <div className="mail-list-panel">
        <div className="mail-list-toolbar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Caută după expeditor, subiect sau conținut..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="mail-items-container">
          {emails.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nu a fost găsit niciun e-mail pentru filtrul selectat.
            </div>
          ) : (
            emails.map(email => (
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

                <div className="mail-subject">{email.subject}</div>

                {email.hierarchy_name && (
                  <span
                    className="hierarchy-tag"
                    style={{
                      backgroundColor: `${email.hierarchy_color || '#3b82f6'}20`,
                      color: email.hierarchy_color || '#60a5fa',
                      border: `1px solid ${email.hierarchy_color || '#3b82f6'}40`
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
          <div>
            <div className="reader-header">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <h1 className="reader-subject">{selectedEmail.subject}</h1>
                
                {/* Selector Asignare Ierarhica */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ierarhie:</span>
                  <select
                    value={selectedEmail.hierarchy_id || ''}
                    onChange={(e) => onAssignHierarchy(selectedEmail.id, e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}
                  >
                    <option value="">-- Neclasificat --</option>
                    {flatHierarchy.map(node => (
                      <option key={node.id} value={node.id}>
                        [Nivel {node.level_depth}] {node.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="reader-meta-row" style={{ marginTop: '16px' }}>
                <div className="reader-sender-info">
                  <div className="sender-avatar">
                    {(selectedEmail.sender_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedEmail.sender_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      De la: {selectedEmail.sender_email} &bull; Către: {selectedEmail.recipient}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} />
                  {new Date(selectedEmail.date_received).toLocaleString('ro-RO')}
                </div>
              </div>
            </div>

            {/* Corpul E-mailului */}
            <div className="reader-body">
              {selectedEmail.body_html ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                  style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {selectedEmail.body_text || '(Mesajul nu conține text în corpul principal)'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <Mail size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <h3>Selectați un e-mail din listă pentru a-l citi</h3>
            <p style={{ fontSize: '0.85rem' }}>Puteți asigna orice mesaj direct la structura ierarhică dorită.</p>
          </div>
        )}
      </div>
    </div>
  );
}
