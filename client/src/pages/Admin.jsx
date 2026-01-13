import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';
import './Admin.css';

export default function Admin() {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [databaseInfo, setDatabaseInfo] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [message, setMessage] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const headers = { 'Authorization': `Bearer ${token}` };

            const [statsRes, usersRes, roomsRes, dbInfoRes] = await Promise.all([
                fetch(`${config.apiUrl}/api/admin/stats`, { headers }),
                fetch(`${config.apiUrl}/api/admin/users`, { headers }),
                fetch(`${config.apiUrl}/api/admin/rooms`, { headers }),
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
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

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
    };

    const deleteRoom = async (roomId) => {
        if (!confirm('Are you sure you want to delete this room?')) {
            return;
        }

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
                <h1>🛠️ Admin Panel</h1>
                <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
                    ← Back to Dashboard
                </button>
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
                            <div className="stat-card">
                                <div className="stat-icon">👥</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.users}</div>
                                    <div className="stat-label">Total Users</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🎥</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.rooms}</div>
                                    <div className="stat-label">Total Rooms</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🔗</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.magicLinks}</div>
                                    <div className="stat-label">Magic Links</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">⚙️</div>
                                <div className="stat-info">
                                    <div className="stat-value">{stats.preferences}</div>
                                    <div className="stat-label">User Preferences</div>
                                </div>
                            </div>
                        </div>

                        <div className="database-type-banner">
                            <strong>Database:</strong> {stats.databaseType}
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="users-section">
                        <h2>User Management</h2>
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Admin</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.id}</td>
                                            <td>
                                                {u.profile_picture && (
                                                    <img
                                                        src={`${config.apiUrl}${u.profile_picture}`}
                                                        alt=""
                                                        className="user-avatar-small"
                                                    />
                                                )}
                                                {u.username}
                                            </td>
                                            <td>{u.email}</td>
                                            <td>
                                                <span className={`badge ${u.is_admin ? 'badge-admin' : 'badge-user'}`}>
                                                    {u.is_admin ? '✓ Admin' : 'User'}
                                                </span>
                                            </td>
                                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    {u.id !== user.id && (
                                                        <>
                                                            <button
                                                                onClick={() => toggleAdminStatus(u.id, u.is_admin)}
                                                                className="btn btn-sm btn-secondary"
                                                            >
                                                                {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                                                            </button>
                                                            <button
                                                                onClick={() => deleteUser(u.id)}
                                                                className="btn btn-sm btn-danger"
                                                            >
                                                                Delete
                                                            </button>
                                                        </>
                                                    )}
                                                    {u.id === user.id && (
                                                        <span className="text-muted">(You)</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'rooms' && (
                    <div className="rooms-section">
                        <h2>Room Management</h2>
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Name</th>
                                        <th>Creator</th>
                                        <th>Link Code</th>
                                        <th>Participants</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rooms.map(room => (
                                        <tr key={room.id}>
                                            <td>{room.id}</td>
                                            <td>{room.name}</td>
                                            <td>{room.creator_username}</td>
                                            <td><code>{room.link_code}</code></td>
                                            <td>{room.participant_count}</td>
                                            <td>{new Date(room.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    onClick={() => deleteRoom(room.id)}
                                                    className="btn btn-sm btn-danger"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'database' && databaseInfo && (
                    <div className="database-section">
                        <h2>Database Information</h2>
                        <div className="info-grid">
                            <div className="info-card">
                                <div className="info-label">Type</div>
                                <div className="info-value">{databaseInfo.type}</div>
                            </div>
                            <div className="info-card">
                                <div className="info-label">Version</div>
                                <div className="info-value">{databaseInfo.version}</div>
                            </div>
                            <div className="info-card">
                                <div className="info-label">Size</div>
                                <div className="info-value">{databaseInfo.size}</div>
                            </div>
                            {databaseInfo.path && (
                                <div className="info-card full-width">
                                    <div className="info-label">Path</div>
                                    <div className="info-value"><code>{databaseInfo.path}</code></div>
                                </div>
                            )}
                        </div>

                        <div className="maintenance-section">
                            <h3>Maintenance</h3>
                            <button
                                onClick={cleanupMagicLinks}
                                className="btn btn-primary"
                            >
                                🧹 Clean Up Expired Magic Links
                            </button>
                            <p className="text-secondary">
                                Removes all expired or used magic link tokens from the database
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
