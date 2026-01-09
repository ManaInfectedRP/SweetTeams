import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { config } from '../config';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoGrid from '../components/VideoGrid';
import ChatPanel from '../components/ChatPanel';
import Controls from '../components/Controls';
import './Room.css';

export default function Room() {
    const { linkCode } = useParams();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showChat, setShowChat] = useState(true);

    const {
        localStream,
        remoteStreams,
        screenStream,
        isCameraOn,
        isMicOn,
        isScreenSharing,
        messages,
        toggleCamera,
        toggleMic,
        toggleScreenShare,
        switchCamera,
        sendMessage,
        sendAdminCommand,
            setModerator,
        deleteMessage,
        participants,
        participantStates,
        activeScreenSharer,
        // Device selection
        devices,
        selectedCameraId,
        selectedMicrophoneId,
        selectedSpeakerId,
        selectCamera,
        selectMicrophone,
        selectSpeaker,
        // Audio settings
        micVolume,
        noiseReduction,
        spatialAudio,
        handleMicVolumeChange,
        handleNoiseReductionChange,
        handleSpatialAudioChange
    } = useWebRTC(linkCode, token, user?.username);

    useEffect(() => {
        fetchRoom();
    }, [linkCode]);

    const fetchRoom = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/rooms/${linkCode}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setRoom(data.room);
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Failed to fetch room:', err);
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleLeave = () => {
        navigate('/dashboard');
    };

    if (loading) {
        return (
            <div className="room-loading">
                <div className="animate-pulse" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                    🎥
                </div>
                <p className="text-secondary">Ansluter till möte...</p>
            </div>
        );
    }

    return (
        <div className="room-container">
            <div className="room-header">
                <div className="room-info">
                    <h2 className="room-title">{room?.name}</h2>
                    <span className="room-participants">
                        👥 {remoteStreams.size + 1} deltagare
                    </span>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            alert('Länk kopierad till urklipp!');
                        }}
                        style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        🔗 Dela
                    </button>
                </div>
                <button
                    onClick={() => setShowChat(!showChat)}
                    className="btn btn-secondary btn-sm"
                >
                    {showChat ? 'Dölj' : 'Visa'} chat
                </button>
            </div>

            <div className="room-content">
                <div className="room-video-area">
                    <VideoGrid
                        localStream={localStream}
                        remoteStreams={remoteStreams}
                        screenStream={screenStream}
                        isCameraOn={isCameraOn}
                        username={user?.username}
                        creatorId={room?.creatorId}
                        currentUserId={user?.id}
                        isHost={user?.id === room?.creatorId}
                        onAdminAction={sendAdminCommand}
                        onSetModerator={setModerator}
                        participants={participants}
                        participantStates={participantStates}
                        selectedSpeakerId={selectedSpeakerId}
                        activeScreenSharer={activeScreenSharer}
                        mySocketId={participants.find(p => p.userId === user?.id)?.socketId}
                    />
                    <Controls
                        isCameraOn={isCameraOn}
                        isMicOn={isMicOn}
                        isScreenSharing={isScreenSharing}
                        onToggleCamera={toggleCamera}
                        onToggleMic={toggleMic}
                        onToggleScreenShare={toggleScreenShare}
                        onSwitchCamera={switchCamera}
                        devices={devices}
                        selectedCameraId={selectedCameraId}
                        selectedMicrophoneId={selectedMicrophoneId}
                        selectedSpeakerId={selectedSpeakerId}
                        onSelectCamera={selectCamera}
                        onSelectMicrophone={selectMicrophone}
                        onSelectSpeaker={selectSpeaker}
                        micVolume={micVolume}
                        noiseReduction={noiseReduction}
                        spatialAudio={spatialAudio}
                        onMicVolumeChange={handleMicVolumeChange}
                        onNoiseReductionChange={handleNoiseReductionChange}
                        onSpatialAudioChange={handleSpatialAudioChange}
                        onLeave={handleLeave}
                    />
                </div>

                {showChat && (
                    <div className="room-chat-area">
                        <ChatPanel
                            messages={messages}
                            onSendMessage={sendMessage}
                            onDeleteMessage={deleteMessage}
                            username={user?.username}
                            participants={participants}
                            canModerate={user?.id === room?.creatorId || participants.find(p => p.userId === user?.id)?.role === 'moderator'}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
