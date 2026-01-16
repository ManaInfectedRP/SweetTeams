import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { config } from '../config';
import ConfirmModal from '../components/ConfirmModal';
import './Admin.css';

export default function Admin() {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [guests, setGuests] = useState([]);
    const [databaseInfo, setDatabaseInfo] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAdmin, setFilterAdmin] = useState('all'); // 'all', 'admin', 'user'
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [showClearTableModal, setShowClearTableModal] = useState(false);
    const [selectedTable, setSelectedTable] = useState('users');
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        isDangerous: false
    });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const headers = { 'Authorization': `Bearer ${token}` };

            const [statsRes, usersRes, roomsRes, guestsRes, dbInfoRes] = await Promise.all([
                fetch(`${config.apiUrl}/api/admin/stats`, { headers }),
                fetch(`${config.apiUrl}/api/admin/users`, { headers }),
                fetch(`${config.apiUrl}/api/admin/rooms`, { headers }),
                fetch(`${config.apiUrl}/api/admin/guests`, { headers }),
                fetch(`${config.apiUrl}/api/admin/database/info`, { headers })
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (usersRes.ok) {
                const data = await usersRes.json();
                setUsers(data.users);
            }
            if (roomsRes.ok) {
                const data = await roomsRes.json();
                setRooms(data.rooms);
            }
            if (guestsRes.ok) {
                const data = await guestsRes.json();
                setGuests(data.guests);
            }
            if (dbInfoRes.ok) setDatabaseInfo(await dbInfoRes.json());
        } catch (err) {
            console.error('Error fetching admin data:', err);
            setMessage('Failed to load admin data');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!user?.isAdmin) {
            navigate('/dashboard');
            return;
        }
        fetchData();
    }, [user, navigate, fetchData]);

    // Auto-refresh effect
    useEffect(() => {
        if (!autoRefresh) return;
        
        const interval = setInterval(() => {
            fetchData();
        }, 5000); // Refresh every 5 seconds
        
        return () => clearInterval(interval);
    }, [autoRefresh, fetchData]);

    const toggleAdminStatus = async (userId, currentStatus) => {
        try {
            const response = await fetch(`${config.apiUrl}/api/admin/users/${userId}/admin`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isAdmin: !currentStatus })
            });

            if (response.ok) {
                setMessage('Admin status updated');
                fetchData();
            } else {
                const data = await response.json();
                setMessage(data.error || 'Failed to update admin status');
            }
        } catch (err) {
            console.error('Error updating admin status:', err);
            setMessage('Failed to update admin status');
        }
    };

    const deleteUser = async (userId) => {
        setConfirmModal({
            isOpen: true,
            title: t('admin.deleteUserTitle', '⚠️ Delete User'),
            message: t('admin.deleteUserMessage', 'Are you sure you want to delete this user? This cannot be undone.'),
            isDangerous: true,
            onConfirm: async () => {
                try {
            const response = await fetch(`${config.apiUrl}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setMessage('User deleted successfully');
                fetchData();
            } else {
                const data = await response.json();
                setMessage(data.error || 'Failed to delete user');
            }
                } catch (err) {
                    console.error('Error deleting user:', err);
                    setMessage('Failed to delete user');
                }
            }
        });
    };

    const deleteRoom = async (roomId) => {
        setConfirmModal({
            isOpen: true,
            title: t('admin.deleteRoomTitle', '⚠️ Delete Room'),
            message: t('admin.deleteRoomMessage', 'Are you sure you want to delete this room?'),
            isDangerous: true,
            onConfirm: async () => {
                try {
            const response = await fetch(`${config.apiUrl}/api/admin/rooms/${roomId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setMessage('Room deleted successfully');
                fetchData();
            } else {
                const data = await response.json();
                setMessage(data.error || 'Failed to delete room');
            }
                } catch (err) {
                    console.error('Error deleting room:', err);
                    setMessage('Failed to delete room');
                }
            }
        });
    };

    const cleanupMagicLinks = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/admin/cleanup/magic-links`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setMessage(data.message);
                fetchData();
            } else {
                setMessage('Failed to cleanup magic links');
            }
        } catch (err) {
            console.error('Error cleaning up:', err);
            setMessage('Failed to cleanup magic links');
        }
    };

    const deleteGuest = async (guestId) => {
        setConfirmModal({
            isOpen: true,
            title: t('admin.deleteGuestTitle', '⚠️ Delete Guest Session'),
            message: t('admin.deleteGuestMessage', 'Are you sure you want to delete this guest session?'),
            isDangerous: true,
            onConfirm: async () => {
                try {
            const response = await fetch(`${config.apiUrl}/api/admin/guests/${guestId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setMessage('Guest session deleted successfully');
                fetchData();
            } else {
                const data = await response.json();
                setMessage(data.error || 'Failed to delete guest session');
            }
                } catch (err) {
                    console.error('Error deleting guest:', err);
                    setMessage('Failed to delete guest session');
                }
            }
        });
    };

    const cleanupGuests = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/admin/cleanup/guests`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setMessage(data.message);
                fetchData();
            } else {
                setMessage('Failed to cleanup guest sessions');
            }
        } catch (err) {
            console.error('Error cleaning up guests:', err);
            setMessage('Failed to cleanup guest sessions');
        }
    };

    const clearTable = async () => {
        setConfirmModal({
            isOpen: true,
            title: t('admin.clearTableTitle', '🚨 Clear Entire Table'),
            message: t('admin.clearTableMessage', `Are you ABSOLUTELY sure you want to clear the ENTIRE "${selectedTable}" table? This will PERMANENTLY delete all records and CANNOT be undone!`),
            isDangerous: true,
            confirmText: t('admin.clearTableConfirm', 'Yes, Clear'),
            onConfirm: async () => {
                try {
            const response = await fetch(`${config.apiUrl}/api/admin/clear-table`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tableName: selectedTable })
            });

            if (response.ok) {
                const data = await response.json();
                setMessage(data.message);
                setShowClearTableModal(false);
                fetchData();
            } else {
                const data = await response.json();
                        setMessage(data.error || 'Failed to clear table');
                    }
                } catch (err) {
                    console.error('Error clearing table:', err);
                    setMessage('Failed to clear table');
                }
            }
        });
    };

    // Filter users based on search and admin status
    const filteredUsers = users.filter(u => {
        const matchesSearch = 
            u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesFilter = 
            filterAdmin === 'all' ? true :
            filterAdmin === 'admin' ? u.is_admin :
            !u.is_admin;
        
        return matchesSearch && matchesFilter;
    });

    // Filter rooms based on search
    const filteredRooms = rooms.filter(room =>
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.link_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.creator_username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter guests based on search
    const filteredGuests = guests.filter(guest =>
        guest.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.link_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="admin-container">
                <div className="loading-message">Loading admin panel...</div>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <header className="admin-header">
                <div>
                    <h1>🛠️ Admin Panel</h1>
                    <p className="admin-subtitle">{t('admin.subtitle', 'Manage users, rooms and system')}</p>
                </div>
                <div className="header-actions">
                    <label className="auto-refresh-toggle">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        <span>🔄 {t('admin.autoRefresh', 'Auto-refresh')}</span>
                    </label>
                    <button onClick={() => setShowClearTableModal(true)} className="btn btn-warning">
                        🗑️ {t('admin.clearTable', 'Clear Table')}
                    </button>
                    <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
                        ← {t('admin.backToDashboard', 'Back to Dashboard')}
                    </button>
                </div>
            </header>

            {message && (
                <div className="admin-message">
                    {message}
                    <button onClick={() => setMessage('')} className="close-btn">×</button>
                </div>
            )}

            <div className="admin-tabs">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Overview
                </button>
                <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Users
                </button>
                <button
                    className={`tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rooms')}
                >
                    🎥 Rooms
                </button>
                <button
                    className={`tab-btn ${activeTab === 'guests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('guests')}
                >
                    👤 Guests
                </button>
                <button
                    className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
                    onClick={() => setActiveTab('database')}
                >
                    🗄️ Database
                </button>
            </div>

            <div className="admin-content">
                {activeTab === 'overview' && stats && (
                    <div className="overview-section">
                        <div className="stats-grid">
                            <div className="stat-card primary">
                                <div className="stat-icon">👥</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.users}</div>
                                    <div className="stat-label">{t('admin.totalUsers', 'Total Users')}</div>
                                </div>
                            </div>
                            <div className="stat-card success">
                                <div className="stat-icon">🎥</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.rooms}</div>
                                    <div className="stat-label">{t('admin.totalRooms', 'Total Rooms')}</div>
                                </div>
                            </div>
                            <div className="stat-card secondary">
                                <div className="stat-icon">👤</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.guestSessions || 0}</div>
                                    <div className="stat-label">{t('admin.activeGuests', 'Active Guests')}</div>
                                </div>
                            </div>
                            <div className="stat-card warning">
                                <div className="stat-icon">🔗</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.magicLinks}</div>
                                    <div className="stat-label">{t('admin.magicLinks', 'Magic Links')}</div>
                                </div>
                            </div>
                            <div className="stat-card info">
                                <div className="stat-icon">⚙️</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.preferences}</div>
                                    <div className="stat-label">{t('admin.userPreferences', 'User Preferences')}</div>
                                </div>
                            </div>
                        </div>

                        <div className="system-info-grid">
                            <div className="system-card">
                                <h3>🗄️ {t('admin.database', 'Database')}</h3>
                                <div className="system-info-item">
                                    <span className="label">{t('admin.type', 'Type')}:</span>
                                    <span className="value">{stats.databaseType}</span>
                                </div>
                                <div className="system-info-item">
                                    <span className="label">{t('admin.status', 'Status')}:</span>
                                    <span className="value status-active">🟢 {t('admin.active', 'Active')}</span>
                                </div>
                            </div>
                            
                            <div className="system-card">
                                <h3>📊 {t('admin.activity', 'Activity')}</h3>
                                <div className="system-info-item">
                                    <span className="label">{t('admin.activeRoomsLabel', 'Active rooms')}:</span>
                                    <span className="value">{stats.rooms}</span>
                                </div>
                                <div className="system-info-item">
                                    <span className="label">{t('admin.registeredLabel', 'Registered')}:</span>
                                    <span className="value">{stats.users}</span>
                                </div>
                            </div>
                            
                            <div className="system-card">
                                <h3>🔐 {t('admin.security', 'Security')}</h3>
                                <div className="system-info-item">
                                    <span className="label">{t('admin.admins', 'Admins')}:</span>
                                    <span className="value">{users.filter(u => u.is_admin).length}</span>
                                </div>
                                <div className="system-info-item">
                                    <span className="label">{t('admin.regularUsers', 'Regular users')}:</span>
                                    <span className="value">{users.filter(u => !u.is_admin).length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="users-section">
                        <div className="section-header">
                            <h2>{t('admin.userManagement', 'User Management')}</h2>
                            <div className="search-filter-bar">
                                <input
                                    type="text"
                                    placeholder={t('admin.searchUsers', 'Search users...')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                                <select 
                                    value={filterAdmin} 
                                    onChange={(e) => setFilterAdmin(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="all">{t('admin.allUsers', 'All users')}</option>
                                    <option value="admin">{t('admin.adminsOnly', 'Admins only')}</option>
                                    <option value="user">{t('admin.regularUsersOnly', 'Regular users only')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="results-count">
                            {t('admin.showingXofY', `Showing ${filteredUsers.length} of ${users.length} users`)}
                        </div>
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>{t('admin.user')}</th>
                                        <th>{t('admin.email')}</th>
                                        <th>{t('admin.role')}</th>
                                        <th>{t('admin.created')}</th>
                                        <th>{t('admin.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.id}</td>
                                            <td>
                                                <div className="user-cell">
                                                    {u.profile_picture ? (
                                                        <img
                                                            src={`${config.apiUrl}${u.profile_picture}`}
                                                            alt=""
                                                            className="user-avatar-small"
                                                        />
                                                    ) : (
                                                        <div className="user-avatar-small avatar-placeholder">
                                                            {u.username[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span>{u.username}</span>
                                                </div>
                                            </td>
                                            <td>{u.email}</td>
                                            <td>
                                                <span className={`badge ${u.is_admin ? 'badge-admin' : 'badge-user'}`}>
                                                    {u.is_admin ? `⭐ ${t('admin.admin')}` : `👤 ${t('admin.userRole')}`}
                                                </span>
                                            </td>
                                            <td>{new Date(u.created_at).toLocaleDateString('sv-SE')}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    {u.id !== user.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => toggleAdminStatus(u.id, u.is_admin)}
                                                                className="btn btn-sm btn-secondary"
                                                                title={u.is_admin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                                                            >
                                                                {u.is_admin ? '⭐→👤' : '👤→⭐'}
                                                            </button>
                                                            <button
                                                                onClick={() => deleteUser(u.id)}
                                                                className="btn btn-sm btn-danger"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-muted">({t('admin.you')})</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredUsers.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">🔍</div>
                                    <p>{t('admin.noUsersFound')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'rooms' && (
                    <div className="rooms-section">
                        <div className="section-header">
                            <h2>{t('admin.roomManagement')}</h2>
                            <input
                                type="text"
                                placeholder={t('admin.searchRooms')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                        <div className="results-count">
                            {t('admin.showingXofYRooms', `Showing ${filteredRooms.length} of ${rooms.length} rooms`)}
                        </div>
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>{t('admin.name')}</th>
                                        <th>{t('admin.creator')}</th>
                                        <th>{t('admin.linkCode')}</th>
                                        <th>{t('admin.participants')}</th>
                                        <th>{t('admin.created')}</th>
                                        <th>{t('admin.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRooms.map(room => (
                                        <tr key={room.id}>
                                            <td>{room.id}</td>
                                            <td className="room-name-cell">{room.name}</td>
                                            <td>{room.creator_username}</td>
                                            <td><code className="link-code">{room.link_code}</code></td>
                                            <td><span className="badge badge-info">{room.participant_count}</span></td>
                                            <td>{new Date(room.created_at).toLocaleDateString('sv-SE')}</td>
                                            <td>
                                                <button
                                                    onClick={() => deleteRoom(room.id)}
                                                    className="btn btn-sm btn-danger"
                                                >
                                                    🗑️ {t('admin.delete')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredRooms.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">🔍</div>
                                    <p>{t('admin.noRoomsFound')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'guests' && (
                    <div className="guests-section">
                        <div className="section-header">
                            <h2>{t('admin.guestSessions')}</h2>
                            <input
                                type="text"
                                placeholder={t('admin.searchGuests')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                        <div className="results-count">
                            {t('admin.showingXofYGuests', `Showing ${filteredGuests.length} of ${guests.length} guests`)}
                            ({guests.filter(g => g.is_active).length} {t('admin.active')})
                        </div>
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>{t('admin.name')}</th>
                                        <th>{t('admin.linkCode')}</th>
                                        <th>{t('admin.status')}</th>
                                        <th>{t('admin.created')}</th>
                                        <th>{t('admin.expires')}</th>
                                        <th>{t('admin.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredGuests.map(guest => (
                                        <tr key={guest.id} className={!guest.is_active ? 'expired-row' : ''}>
                                            <td><code className="guest-id">{guest.id.substring(0, 20)}...</code></td>
                                            <td>{guest.guest_name}</td>
                                            <td><code className="link-code">{guest.link_code}</code></td>
                                            <td>
                                                <span className={`badge ${guest.is_active ? 'badge-success' : 'badge-expired'}`}>
                                                    {guest.is_active ? `🟢 ${t('admin.active')}` : `🔴 ${t('admin.expired')}`}
                                                </span>
                                            </td>
                                            <td>{new Date(guest.created_at).toLocaleString('sv-SE')}</td>
                                            <td>{new Date(guest.expires_at).toLocaleString('sv-SE')}</td>
                                            <td>
                                                <button
                                                    onClick={() => deleteGuest(guest.id)}
                                                    className="btn btn-sm btn-danger"
                                                >
                                                    🗑️ {t('admin.delete')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredGuests.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">🔍</div>
                                    <p>{t('admin.noGuestsFound')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'database' && databaseInfo && (
                    <div className="database-section">
                        <h2>{t('admin.databaseInfo')}</h2>
                        <div className="info-grid">
                            <div className="info-card">
                                <div className="info-label">🗄️ {t('admin.type')}</div>
                                <div className="info-value">{databaseInfo.type}</div>
                            </div>
                            <div className="info-card">
                                <div className="info-label">📊 {t('admin.version')}</div>
                                <div className="info-value">{databaseInfo.version}</div>
                            </div>
                            <div className="info-card">
                                <div className="info-label">💾 {t('admin.size')}</div>
                                <div className="info-value">{databaseInfo.size}</div>
                            </div>
                            {databaseInfo.path && (
                                <div className="info-card full-width">
                                    <div className="info-label">📁 {t('admin.path')}</div>
                                    <div className="info-value"><code>{databaseInfo.path}</code></div>
                                </div>
                            )}
                        </div>

                        <div className="maintenance-section">
                            <h3>🧹 {t('admin.maintenance')}</h3>
                            <div className="maintenance-actions">
                                <div className="maintenance-item">
                                    <div className="maintenance-info">
                                        <strong>{t('admin.cleanupMagicLinks')}</strong>
                                        <p>{t('admin.cleanupMagicLinksDesc')}</p>
                                    </div>
                                    <button
                                        onClick={cleanupMagicLinks}
                                        className="btn btn-primary"
                                    >
                                        🧹 {t('admin.cleanupNow')}
                                    </button>
                                </div>
                                <div className="maintenance-item">
                                    <div className="maintenance-info">
                                        <strong>{t('admin.cleanupGuestSessions')}</strong>
                                        <p>{t('admin.cleanupGuestSessionsDesc')}</p>
                                    </div>
                                    <button
                                        onClick={cleanupGuests}
                                        className="btn btn-primary"
                                    >
                                        🧹 {t('admin.cleanupNow')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showClearTableModal && (
                <div className="modal-overlay" onClick={() => setShowClearTableModal(false)}>
                    <div className="modal-content clear-table-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>⚠️ {t('admin.clearTable')}</h2>
                        <p className="warning-text">
                            {t('admin.clearTableWarning')}
                        </p>
                        
                        <div className="form-group">
                            <label htmlFor="table-select">{t('admin.selectTableToClear')}</label>
                            <select
                                id="table-select"
                                value={selectedTable}
                                onChange={(e) => setSelectedTable(e.target.value)}
                                className="table-select"
                            >
                                <option value="users">{t('admin.usersTable')}</option>
                                <option value="rooms">{t('admin.roomsTable')}</option>
                                <option value="guest_sessions">{t('admin.guestSessionsTable')}</option>
                                <option value="magic_links">{t('admin.magicLinksTable')}</option>
                                <option value="user_preferences">{t('admin.userPreferencesTable')}</option>
                                <option value="room_participants">{t('admin.roomParticipantsTable')}</option>
                            </select>
                        </div>

                        <div className="modal-actions">
                            <button
                                onClick={() => setShowClearTableModal(false)}
                                className="btn btn-secondary"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={clearTable}
                                className="btn btn-danger"
                            >
                                🗑️ {t('admin.clearTableButton', `Clear ${selectedTable}`)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                isDangerous={confirmModal.isDangerous}
                confirmText={confirmModal.confirmText}
            />
        </div>
    );
}
