import { useState } from 'react';
import { config } from '../config';
import './InviteModal.css';

export default function InviteModal({ roomLinkCode, onClose }) {
    const [emails, setEmails] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSend = async () => {
        setError('');
        setSuccess(false);

        // Parse emails (split by comma, semicolon, or newline)
        const emailList = emails
            .split(/[,;\n]/)
            .map(e => e.trim())
            .filter(e => e.length > 0);

        if (emailList.length === 0) {
            setError('Ange minst en email-adress');
            return;
        }

        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emailList.filter(e => !emailRegex.test(e));
        if (invalidEmails.length > 0) {
            setError(`Ogiltiga email-adresser: ${invalidEmails.join(', ')}`);
            return;
        }

        setSending(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${config.apiUrl}/api/rooms/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    linkCode: roomLinkCode,
                    emails: emailList,
                    message: message.trim()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Kunde inte skicka inbjudningar');
            }

            setSuccess(true);
            setEmails('');
            setMessage('');
            
            // Close modal after 2 seconds
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="invite-modal-overlay" onClick={onClose}>
            <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
                <div className="invite-modal-header">
                    <h2>📧 Skicka inbjudan via email</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="invite-modal-content">
                    <div className="form-group">
                        <label>Email-adresser *</label>
                        <textarea
                            value={emails}
                            onChange={(e) => setEmails(e.target.value)}
                            placeholder="exempel@email.com, annat@email.com&#10;Separera med komma, semikolon eller ny rad"
                            rows={4}
                            disabled={sending || success}
                        />
                        <small>Ange en eller flera email-adresser</small>
                    </div>

                    <div className="form-group">
                        <label>Meddelande (valfritt)</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Lägg till ett personligt meddelande..."
                            rows={3}
                            disabled={sending || success}
                        />
                    </div>

                    {error && (
                        <div className="invite-error">
                            ⚠️ {error}
                        </div>
                    )}

                    {success && (
                        <div className="invite-success">
                            ✅ Inbjudningar skickade!
                        </div>
                    )}
                </div>

                <div className="invite-modal-footer">
                    <button 
                        className="btn-secondary" 
                        onClick={onClose}
                        disabled={sending}
                    >
                        Avbryt
                    </button>
                    <button 
                        className="btn-primary" 
                        onClick={handleSend}
                        disabled={sending || success}
                    >
                        {sending ? 'Skickar...' : success ? 'Skickat!' : 'Skicka inbjudningar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
