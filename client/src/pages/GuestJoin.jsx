import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { config } from '../config';
import './GuestJoin.css';

export default function GuestJoin() {
    const { linkCode } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [room, setRoom] = useState(null);

    // Check if room exists
    useEffect(() => {
        const checkRoom = async () => {
            try {
                const response = await fetch(`${config.apiUrl}/api/rooms/guest-check/${linkCode}`);
                const data = await response.json();
                
                if (!response.ok) {
                    setError(data.error || 'Rummet kunde inte hittas');
                    return;
                }
                
                setRoom(data);
            } catch (err) {
                setError('Kunde inte ansluta till servern');
            }
        };
        
        checkRoom();
    }, [linkCode]);

    const handleJoin = async (e) => {
        e.preventDefault();
        
        if (!name.trim()) {
            setError('Vänligen ange ditt namn');
            return;
        }

        if (name.trim().length < 2) {
            setError('Namnet måste vara minst 2 tecken');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Create guest token
            const response = await fetch(`${config.apiUrl}/api/auth/guest-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name.trim(),
                    linkCode
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Kunde inte skapa gästsession');
            }

            // Store guest token
            localStorage.setItem('token', data.token);
            localStorage.setItem('isGuest', 'true');
            
            // Navigate to room
            navigate(`/room/${linkCode}`);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    if (error && !room) {
        return (
            <div className="guest-join-container">
                <div className="guest-join-card error-card">
                    <div className="error-icon">❌</div>
                    <h2>Kunde inte hitta mötet</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="guest-join-container">
            <div className="guest-join-card">
                <div className="guest-join-header">
                    <div className="logo">🎥</div>
                    <h1>SweetTeams</h1>
                </div>

                {room && (
                    <div className="room-info">
                        <h2>Du har blivit inbjuden till ett möte</h2>
                        {room.name && <p className="room-name">{room.name}</p>}
                        <p className="room-host">Värd: {room.creatorName}</p>
                    </div>
                )}

                <form onSubmit={handleJoin} className="guest-join-form">
                    <div className="form-group">
                        <label htmlFor="name">Ditt namn</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ange ditt namn"
                            maxLength={50}
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="btn-join"
                        disabled={loading || !name.trim()}
                    >
                        {loading ? 'Ansluter...' : 'Gå med i mötet'}
                    </button>
                </form>

                <div className="guest-join-footer">
                    <p>Genom att gå med accepterar du att delta som gäst</p>
                </div>
            </div>
        </div>
    );
}
