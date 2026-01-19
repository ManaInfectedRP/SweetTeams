import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { config } from '../config';
import './SetNameModal.css';

export default function SetNameModal({ onClose, onNameSet }) {
    const { token, updateUser } = useAuth();
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!name.trim()) {
            setError(t('dashboard.nameRequired', 'Name is required'));
            return;
        }

        if (name.trim().length < 2) {
            setError(t('dashboard.nameTooShort', 'Name must be at least 2 characters'));
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${config.apiUrl}/api/profile/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: name.trim() })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || t('dashboard.updateFailed', 'Failed to update name'));
            }

            const data = await response.json();
            updateUser(data.user);
            
            if (onNameSet) {
                onNameSet();
            }
            
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="set-name-modal-overlay">
            <div className="set-name-modal">
                <div className="set-name-modal-header">
                    <h2>👋 {t('dashboard.welcomeTitle', 'Welcome to SweetTeams!')}</h2>
                    <p>{t('dashboard.setNamePrompt', 'Please set your name to continue')}</p>
                </div>

                <form onSubmit={handleSubmit} className="set-name-form">
                    {error && (
                        <div className="alert alert-error">
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">
                            {t('dashboard.yourName', 'Your Name')}
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('dashboard.namePlaceholder', 'Enter your name')}
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? t('dashboard.saving', 'Saving...') : t('dashboard.continue', 'Continue')}
                    </button>
                </form>
            </div>
        </div>
    );
}
