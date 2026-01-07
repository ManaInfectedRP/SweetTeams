import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function VerifyMagicLink() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('Verifierar din inloggning...');
    const { verifyMagicLink } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const token = searchParams.get('token');

        const verify = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Ingen verifieringstoken hittades');
                return;
            }

            try {
                await verifyMagicLink(token);
                setStatus('success');
                setMessage('Inloggning lyckades! Omdirigerar...');
                
                // Redirect to dashboard after 1.5 seconds
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            } catch (err) {
                setStatus('error');
                setMessage(err.message || 'Verifiering misslyckades');
            }
        };

        verify();
    }, [searchParams, verifyMagicLink, navigate]);

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
                            {status === 'verifying' && 'Verifierar...'}
                            {status === 'success' && 'Välkommen!'}
                            {status === 'error' && 'Något gick fel'}
                        </h1>
                        <p className="text-secondary">{message}</p>
                    </div>

                    {status === 'error' && (
                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/login')}
                            >
                                Begär ny länk
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
