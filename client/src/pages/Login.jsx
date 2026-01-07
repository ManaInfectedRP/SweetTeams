import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { requestMagicLink } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const result = await requestMagicLink(email, name);
            setSuccess(result.message || 'Magic link skickat! Kolla din e-post.');
            setEmail('');
            setName('');
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
                        <h1>Välkommen till SweetTeams</h1>
                        <p className="text-secondary">Ange din e-post så skickar vi en inloggningslänk</p>
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
                            <label htmlFor="name" className="form-label">
                                Namn
                            </label>
                            <input
                                id="name"
                                type="text"
                                className="form-input"
                                placeholder="Ditt namn"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email" className="form-label">
                                E-post
                            </label>
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                placeholder="din@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={loading}
                            style={{ width: '100%' }}
                        >
                            {loading ? 'Skickar...' : 'Skicka inloggningslänk'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p className="text-secondary" style={{ textAlign: 'center' }}>
                            Ingen registrering behövs - din länk skapar kontot automatiskt! 
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
