import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Auth.css';

export default function VerifyMagicLink() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('');
    const { verifyMagicLink } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    useEffect(() => {
        const token = searchParams.get('token');

        const verify = async () => {
            if (!token) {
                setStatus('error');
                setMessage(t('auth.noToken', 'No verification token found'));
                return;
            }

            try {
                await verifyMagicLink(token);
                setStatus('success');
                setMessage(t('auth.loginSuccess'));
                
                // Redirect to dashboard after 1.5 seconds
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            } catch (err) {
                setStatus('error');
                setMessage(err.message || t('auth.verifyFailed', 'Verification failed'));
            }
        };

        verify();
    }, [searchParams, verifyMagicLink, navigate, t]);

    return (
        <div className="auth-container">
            <div className="auth-background"></div>
            <div className="auth-content">
                <div className="auth-card card-glass animate-fade-in">
                    <div className="auth-header">
                        <div className="auth-logo">
                            {status === 'verifying' && '⏳'}
                            {status === 'success' && '✅'}
                            {status === 'error' && '❌'}
                        </div>
                        <h1>
                            {status === 'verifying' && t('auth.verifying')}
                            {status === 'success' && t('auth.welcome', 'Welcome!')}
                            {status === 'error' && t('auth.somethingWrong', 'Something went wrong')}
                        </h1>
                        <p className="text-secondary">{message}</p>
                    </div>

                    {status === 'error' && (
                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/login')}
                            >
                                {t('auth.requestNewLink', 'Request new link')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
