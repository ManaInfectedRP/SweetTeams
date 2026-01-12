import { useState, useEffect, useRef } from 'react';
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
    const previousHandsRef = useRef(new Set());

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
        reactToMessage,
        participants,
        participantStates,
        speakingParticipants,
        raisedHands,
        isHandRaised,
        toggleRaiseHand,
        clearAllHands,
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
    } = useWebRTC(linkCode, token);

    useEffect(() => {
        fetchRoom();
    }, [linkCode]);
    
    // Notification for raised hands (only for host/moderators)
    useEffect(() => {
        if (!room || !user) return;
        
        const isHost = user.id === room.creatorId;
        const currentParticipant = participants.find(p => p.userId === user.id);
        const isModerator = currentParticipant?.role === 'moderator';
        
        // Only show notifications to host/moderators
        if (!isHost && !isModerator) return;
        
        // Check if notifications are supported and permitted
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        
        // Show notification for new raised hands
        raisedHands.forEach((handData, socketId) => {
            // Don't notify about own hand
            if (socketId === 'local') return;
            
            // Check if this is a new hand we haven't seen before
            if (!previousHandsRef.current.has(socketId)) {
                previousHandsRef.current.add(socketId);
                
                // Only show notification if this isn't the initial load
                if (previousHandsRef.current.size <= raisedHands.size) {
                    const notification = new Notification('Hand uppräckt', {
                        body: `${handData.username} räckte upp handen (#${handData.order})`,
                        icon: '/manifest.webmanifest',
                        tag: `hand-${socketId}`,
                        requireInteraction: false
                    });
                    
                    // Auto-close after 5 seconds
                    setTimeout(() => notification.close(), 5000);
                }
            }
        });
        
        // Clean up removed hands from tracking
        previousHandsRef.current.forEach(socketId => {
            if (!raisedHands.has(socketId)) {
                previousHandsRef.current.delete(socketId);
            }
        });
    }, [raisedHands, room, user, participants]);
    
    // Request notification permission on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

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
                    {raisedHands.size > 0 && (
                        <span className="raised-hands-indicator" title={`${raisedHands.size} person(er) har räckt upp handen`}>
                            ✋ {raisedHands.size}
                        </span>
                    )}
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
                        profilePicture={user?.profilePicture}
                        creatorId={room?.creatorId}
                        currentUserId={user?.id}
                        isHost={user?.id === room?.creatorId}
                        onAdminAction={sendAdminCommand}
                        onSetModerator={setModerator}
                        participants={participants}
                        participantStates={participantStates}
                        speakingParticipants={speakingParticipants}
                        raisedHands={raisedHands}
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
                        isHandRaised={isHandRaised}
                        onToggleRaiseHand={toggleRaiseHand}
                        raisedHandsCount={raisedHands.size}
                        isHost={user?.id === room?.creatorId}
                        onClearAllHands={clearAllHands}
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
                            onReactToMessage={reactToMessage}
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
