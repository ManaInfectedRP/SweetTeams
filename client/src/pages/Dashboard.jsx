import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { config } from '../config';
import ProfileSettings from '../components/ProfileSettings';
import './Dashboard.css';

export default function Dashboard() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [error, setError] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const { user, token, logout } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/rooms`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setRooms(data.rooms);
            }
        } catch (err) {
            console.error('Failed to fetch rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    const createRoom = async (e) => {
        e.preventDefault();
        setError('');
        setCreating(true);

        try {
            const response = await fetch(`${config.apiUrl}/api/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: roomName })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create room');
            }

            const data = await response.json();
            setRooms([data.room, ...rooms]);
            setRoomName('');
            setShowCreateModal(false);
            navigate(`/room/${data.room.linkCode}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const copyRoomLink = (linkCode) => {
        const link = `${window.location.origin}/room/${linkCode}`;
        navigator.clipboard.writeText(link);
        // You could add a toast notification here
    };

    const handleJoinByCode = (e) => {
        e?.preventDefault?.();
        const code = joinCode.trim();
        if (!code) return;
        navigate(`/room/${code}`);
    };

    return (
        <div className="dashboard-container">
            <nav className="dashboard-nav">
                <div className="container">
                    <div className="nav-content">
                        <div className="nav-brand">
                            <span className="nav-logo">🎥</span>
                            <span className="nav-title">SweetTeams</span>
                        </div>
                        <div className="nav-actions">
                            <div className="user-info">
                                {user?.profilePicture ? (
                                    <img 
                                        src={`${config.apiUrl}${user.profilePicture}`}
                                        alt="Profile" 
                                        className="user-avatar-img"
                                    />
                                ) : (
                                    <span className="user-avatar">{user?.username?.[0]?.toUpperCase()}</span>
                                )}
                                <span className="user-name">{user?.username}</span>
                            </div>
                            {user?.isAdmin === 1 && (
                                <button 
                                    onClick={() => navigate('/admin')} 
                                    className="btn btn-primary btn-sm"
                                    title="Admin Panel"
                                >
                                    🛠️ Admin
                                </button>
                            )}
                            <button 
                                onClick={() => setShowSettings(true)} 
                                className="btn btn-secondary btn-sm"
                                title={t('dashboard.settings')}
                            >
                                ⚙️
                            </button>
                            <button onClick={logout} className="btn btn-secondary btn-sm">
                                {t('dashboard.logout')}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="dashboard-main">
                <div className="container">
                    <div className="dashboard-header">
                        <div>
                            <h1 className="dashboard-title">{t('dashboard.myRooms')}</h1>
                            <p className="text-secondary">{t('dashboard.createAndManage', 'Create and manage your video meetings')}</p>
                        </div>
                        <div className="dashboard-actions-wrap">
                            <form className="join-room-form" onSubmit={handleJoinByCode}>
                                <label htmlFor="joinCode" className="sr-only">{t('dashboard.join')}</label>
                                <input
                                    id="joinCode"
                                    type="text"
                                    className="form-input join-room-input"
                                    placeholder={t('dashboard.enterRoomCode', 'Enter room code')}
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                />
                                <button type="submit" className="btn btn-secondary">{t('dashboard.join')}</button>
                            </form>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn btn-primary btn-lg"
                            >
                                <span style={{ fontSize: '1.25rem' }}>+</span>
                                {t('dashboard.createRoom')}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading-state">
                            <div className="animate-pulse" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                                🎥
                            </div>
                            <p className="text-secondary">Laddar rum...</p>
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="empty-state card-glass">
                            <div className="empty-icon">📹</div>
                            <h3>Inga rum ännu</h3>
                            <p className="text-secondary">Skapa ditt första rum för att komma igång</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn btn-primary mt-lg"
                            >
                                Skapa rum
                            </button>
                        </div>
                    ) : (
                        <div className="rooms-grid">
                            {rooms.map((room) => (
                                <div key={room.id} className="room-card card-glass animate-fade-in">
                                    <div className="room-header">
                                        <h3 className="room-name">{room.name}</h3>
                                        <span className="room-code">{room.linkCode}</span>
                                    </div>
                                    <div className="room-meta">
                                        <span className="text-muted text-sm">
                                            Skapad {new Date(room.created_at).toLocaleDateString('sv-SE')}
                                        </span>
                                    </div>
                                    <div className="room-actions">
                                        <button
                                            onClick={() => navigate(`/room/${room.linkCode}`)}
                                            className="btn btn-primary"
                                            style={{ flex: 1 }}
                                        >
                                            {t('dashboard.join')}
                                        </button>
                                        <button
                                            onClick={() => copyRoomLink(room.linkCode)}
                                            className="btn btn-secondary"
                                            title="Kopiera länk"
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content card-glass" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{t('dashboard.createRoom')}</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="modal-close"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={createRoom}>
                            {error && (
                                <div className="alert alert-error">
                                    {error}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="roomName" className="form-label">
                                    {t('dashboard.roomName')}
                                </label>
                                <input
                                    id="roomName"
                                    type="text"
                                    className="form-input"
                                    placeholder={t('dashboard.roomNamePlaceholder', 'e.g., Team Meeting, Standup...')}
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="btn btn-secondary"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={creating}
                                >
                                    {creating ? t('dashboard.creating', 'Creating...') : t('dashboard.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showSettings && (
                <ProfileSettings onClose={() => setShowSettings(false)} />
            )}
        </div>
    );
}
