import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Lösenorden matchar inte');
            return;
        }

        if (password.length < 6) {
            setError('Lösenordet måste vara minst 6 tecken');
            return;
        }

        setLoading(true);

        try {
            await register(username, email, password);
            navigate('/dashboard');
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
                        <h1>Skapa konto</h1>
                        <p className="text-secondary">Börja använda SweetTeams idag</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && (
                            <div className="alert alert-error animate-slide-in">
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="username" className="form-label">
                                Användarnamn
                            </label>
                            <input
                                id="username"
                                type="text"
                                className="form-input"
                                placeholder="dittnamn"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
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

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">
                                Lösenord
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword" className="form-label">
                                Bekräfta lösenord
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={loading}
                            style={{ width: '100%' }}
                        >
                            {loading ? 'Skapar konto...' : 'Skapa konto'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p className="text-secondary">
                            Har du redan ett konto?{' '}
                            <Link to="/login" className="auth-link">
                                Logga in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
