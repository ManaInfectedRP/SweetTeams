import { createContext, useContext, useState, useEffect } from 'react';
import { config } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Initialize theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    useEffect(() => {
        // Auto-login för localhost development
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        
        if (isLocalhost && !token) {
            // Skapa en dev-token
            const devToken = 'dev-token-' + Date.now();
            localStorage.setItem('token', devToken);
            setToken(devToken);
            
            // Fetch dev user data from backend
            fetch(`${config.apiUrl}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${devToken}`
                }
            })
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(data => {
                    setUser(data.user);
                })
                .catch(() => {
                    // Fallback to basic dev user
                    setUser({
                        id: 'dev-user',
                        username: 'SweetTeams-Dev',
                        email: 'dev@localhost'
                    });
                })
                .finally(() => {
                    setLoading(false);
                });
            return;
        }

        if (token) {
            // For dev-tokens, fetch from backend
            if (token.startsWith('dev-token-')) {
                fetch(`${config.apiUrl}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                    .then(res => res.ok ? res.json() : Promise.reject())
                    .then(data => {
                        setUser(data.user);
                    })
                    .catch(() => {
                        // Fallback to basic dev user
                        setUser({
                            id: 'dev-user',
                            username: 'SweetTeams-Dev',
                            email: 'dev@localhost'
                        });
                    })
                    .finally(() => {
                        setLoading(false);
                    });
                return;
            }

            // Verify token and get user info
            fetch(`${config.apiUrl}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error('Invalid token');
                    return res.json();
                })
                .then(data => {
                    setUser(data.user);
                })
                .catch(() => {
                    localStorage.removeItem('token');
                    setToken(null);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [token]);

    const login = async (email, password) => {
        const response = await fetch(`${config.apiUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const register = async (username, email, password) => {
        const response = await fetch(`${config.apiUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const requestMagicLink = async (email, name) => {
        const response = await fetch(`${config.apiUrl}/api/auth/request-magic-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Kunde inte skicka magic link');
        }

        return await response.json();
    };

    const verifyMagicLink = async (token) => {
        const response = await fetch(`${config.apiUrl}/api/auth/verify-magic-link?token=${token}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Verifiering misslyckades');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('isGuest');
        setToken(null);
        setUser(null);
    };

    const updateUser = (updates) => {
        setUser(prevUser => ({
            ...prevUser,
            ...updates
        }));
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            token, 
            login,
            register,
            requestMagicLink, 
            verifyMagicLink, 
            logout, 
            updateUser,
            loading 
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
