import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';
import './ProfileSettings.css';

export default function ProfileSettings({ onClose }) {
    const { user, token, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    // Profile state
    const [username, setUsername] = useState(user?.username || '');
    const [profilePicture, setProfilePicture] = useState(user?.profilePicture || null);

    // Preferences state
    const [preferences, setPreferences] = useState({
        defaultMicrophone: '',
        defaultCamera: '',
        defaultSpeaker: '',
        notificationsEnabled: true,
        autoJoinAudio: true,
        autoJoinVideo: true
    });

    // Device lists
    const [devices, setDevices] = useState({
        microphones: [],
        cameras: [],
        speakers: []
    });

    useEffect(() => {
        fetchPreferences();
        fetchDevices();
    }, []);

    const fetchPreferences = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/profile/preferences`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPreferences(data);
            }
        } catch (err) {
            console.error('Error fetching preferences:', err);
        }
    };

    const fetchDevices = async () => {
        try {
            const deviceList = await navigator.mediaDevices.enumerateDevices();
            setDevices({
                microphones: deviceList.filter(d => d.kind === 'audioinput'),
                cameras: deviceList.filter(d => d.kind === 'videoinput'),
                speakers: deviceList.filter(d => d.kind === 'audiooutput')
            });
        } catch (err) {
            console.error('Error fetching devices:', err);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await fetch(`${config.apiUrl}/api/profile/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update profile');
            }

            const data = await response.json();
            updateUser(data.user);
            setMessage('Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleProfilePictureUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('File size must be less than 5MB');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('profilePicture', file);

            const response = await fetch(`${config.apiUrl}/api/profile/me/picture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to upload profile picture');
            }

            const data = await response.json();
            setProfilePicture(data.profilePicture);
            updateUser({ ...user, profilePicture: data.profilePicture });
            setMessage('Profile picture updated!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProfilePicture = async () => {
        if (!window.confirm('Are you sure you want to delete your profile picture?')) {
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await fetch(`${config.apiUrl}/api/profile/me/picture`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete profile picture');
            }

            setProfilePicture(null);
            updateUser({ ...user, profilePicture: null });
            setMessage('Profile picture deleted');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePreferencesUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await fetch(`${config.apiUrl}/api/profile/preferences`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(preferences)
            });

            if (!response.ok) {
                throw new Error('Failed to update preferences');
            }

            setMessage('Preferences saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-settings-overlay" onClick={onClose}>
            <div className="profile-settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="profile-settings-header">
                    <h2>Settings</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="profile-settings-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        Profile
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
                        onClick={() => setActiveTab('devices')}
                    >
                        Devices
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
                        onClick={() => setActiveTab('preferences')}
                    >
                        Preferences
                    </button>
                </div>

                <div className="profile-settings-content">
                    {message && <div className="success-message">{message}</div>}
                    {error && <div className="error-message">{error}</div>}

                    {activeTab === 'profile' && (
                        <div className="settings-section">
                            <div className="profile-picture-section">
                                <div className="profile-picture-wrapper">
                                    {profilePicture ? (
                                        <img
                                            src={`${config.apiUrl}${profilePicture}`}
                                            alt="Profile"
                                            className="profile-picture-preview"
                                        />
                                    ) : (
                                        <div className="profile-picture-placeholder">
                                            {username?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                </div>
                                <div className="profile-picture-actions">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleProfilePictureUpload}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={loading}
                                    >
                                        Upload Picture
                                    </button>
                                    {profilePicture && (
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={handleDeleteProfilePicture}
                                            disabled={loading}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleProfileUpdate}>
                                <div className="form-group">
                                    <label htmlFor="username">Username</label>
                                    <input
                                        type="text"
                                        id="username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        minLength={2}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="email">Email</label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="disabled-input"
                                    />
                                    <small>Email cannot be changed</small>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'devices' && (
                        <div className="settings-section">
                            <form onSubmit={handlePreferencesUpdate}>
                                <div className="form-group">
                                    <label htmlFor="defaultMicrophone">Default Microphone</label>
                                    <select
                                        id="defaultMicrophone"
                                        value={preferences.defaultMicrophone || ''}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            defaultMicrophone: e.target.value
                                        })}
                                    >
                                        <option value="">System Default</option>
                                        {devices.microphones.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="defaultCamera">Default Camera</label>
                                    <select
                                        id="defaultCamera"
                                        value={preferences.defaultCamera || ''}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            defaultCamera: e.target.value
                                        })}
                                    >
                                        <option value="">System Default</option>
                                        {devices.cameras.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="defaultSpeaker">Default Speaker</label>
                                    <select
                                        id="defaultSpeaker"
                                        value={preferences.defaultSpeaker || ''}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            defaultSpeaker: e.target.value
                                        })}
                                    >
                                        <option value="">System Default</option>
                                        {devices.speakers.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Device Settings'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'preferences' && (
                        <div className="settings-section">
                            <form onSubmit={handlePreferencesUpdate}>
                                <div className="form-group checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={preferences.autoJoinAudio}
                                            onChange={(e) => setPreferences({
                                                ...preferences,
                                                autoJoinAudio: e.target.checked
                                            })}
                                        />
                                        <span>Auto-join with audio enabled</span>
                                    </label>
                                </div>

                                <div className="form-group checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={preferences.autoJoinVideo}
                                            onChange={(e) => setPreferences({
                                                ...preferences,
                                                autoJoinVideo: e.target.checked
                                            })}
                                        />
                                        <span>Auto-join with video enabled</span>
                                    </label>
                                </div>

                                <div className="form-group checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={preferences.notificationsEnabled}
                                            onChange={(e) => setPreferences({
                                                ...preferences,
                                                notificationsEnabled: e.target.checked
                                            })}
                                        />
                                        <span>Enable notifications</span>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Preferences'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
