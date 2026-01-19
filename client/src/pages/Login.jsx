import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Auth.css';

export default function Login() {
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { requestMagicLink } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const result = await requestMagicLink(email);
            setSuccess(result.message || t('auth.magicLinkSent'));
            setEmail('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background"></div>
            <div className="auth-content">
                <div className="auth-card card-glass animate-fade-in">
                    <div className="auth-header">
                        <div className="auth-logo">🎥</div>
                        <h1>{t('auth.welcomeToSweetTeams')}</h1>
                        <p className="text-secondary">{t('auth.enterEmailForLink')}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && (
                            <div className="alert alert-error animate-slide-in">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="alert alert-success animate-slide-in">
                                {success}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email" className="form-label">
                                {t('auth.email')}
                            </label>
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                placeholder={t('auth.emailPlaceholder')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={loading}
                            style={{ width: '100%' }}
                        >
                            {loading ? t('auth.sending') : t('auth.sendLoginLink')}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p className="text-secondary" style={{ textAlign: 'center' }}>
                            {t('auth.noRegistrationNeeded')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
