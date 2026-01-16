import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { config } from '../config';
import './InviteModal.css';

export default function InviteModal({ roomLinkCode, onClose }) {
    const { t } = useLanguage();
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
            setError(t('invite.enterAtLeastOneEmail'));
            return;
        }

        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emailList.filter(e => !emailRegex.test(e));
        if (invalidEmails.length > 0) {
            setError(`${t('invite.invalidEmails')}: ${invalidEmails.join(', ')}`);
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
                throw new Error(data.error || t('invite.couldNotSend'));
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
                    <h2>📧 {t('invite.sendEmailInvitation')}</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="invite-modal-content">
                    <div className="form-group">
                        <label>{t('invite.emailAddresses')} *</label>
                        <textarea
                            value={emails}
                            onChange={(e) => setEmails(e.target.value)}
                            placeholder={t('invite.emailPlaceholder')}
                            rows={4}
                            disabled={sending || success}
                        />
                        <small>{t('invite.enterOneOrMore')}</small>
                    </div>

                    <div className="form-group">
                        <label>{t('invite.message')} ({t('invite.optional')})</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t('invite.messagePlaceholder')}
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
                            ✅ {t('invite.invitationsSent')}
                        </div>
                    )}
                </div>

                <div className="invite-modal-footer">
                    <button 
                        className="btn-secondary" 
                        onClick={onClose}
                        disabled={sending}
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        className="btn-primary" 
                        onClick={handleSend}
                        disabled={sending || success}
                    >
                        {sending ? t('invite.sending') : success ? t('invite.sent') : t('invite.sendInvitations')}
                    </button>
                </div>
            </div>
        </div>
    );
}
