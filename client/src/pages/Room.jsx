import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { config } from '../config';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoGrid from '../components/VideoGrid';
import ChatPanel from '../components/ChatPanel';
import Controls from '../components/Controls';
import RecordingPreview from '../components/RecordingPreview';
import InviteModal from '../components/InviteModal';
import './Room.css';

export default function Room() {
    const { linkCode } = useParams();
    const navigate = useNavigate();
    const { user, token, logout } = useAuth();
    const { t } = useLanguage();
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showChat, setShowChat] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.getAttribute('data-theme') === 'dark'
    );
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
        handleSpatialAudioChange,
        // Recording
        isRecording,
        recordedBlob,
        showRecordingPreview,
        startRecording,
        stopRecording,
        saveRecording,
        discardRecording
    } = useWebRTC(linkCode, token);

    useEffect(() => {
        fetchRoom();
        
        // Verify guest is accessing the correct room
        const isGuest = localStorage.getItem('isGuest') === 'true';
        if (isGuest && user) {
            // Decode JWT to get the authorized linkCode (stored in the token)
            try {
                const tokenPayload = JSON.parse(atob(token.split('.')[1]));
                const authorizedLinkCode = tokenPayload.linkCode;
                
                // If guest is trying to access a different room, log them out
                if (authorizedLinkCode && authorizedLinkCode !== linkCode) {
                    console.warn('Guest attempting to access unauthorized room');
                    localStorage.removeItem('token');
                    localStorage.removeItem('isGuest');
                    navigate('/');
                }
            } catch (err) {
                console.error('Error validating guest token:', err);
            }
        }
    }, [linkCode, token, user, navigate]);
    
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
                    const notification = new Notification(t('room.handRaised', 'Hand raised'), {
                        body: t('room.handRaisedBy', `${handData.username} raised their hand (#${handData.order})`),
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

    const toggleDarkMode = () => {
        const newTheme = isDarkMode ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        setIsDarkMode(!isDarkMode);
    };

    const toggleAudio = () => {
        setIsAudioMuted(prev => !prev);
    };

    const handleLeave = () => {
        // Check if user is a guest
        const isGuest = localStorage.getItem('isGuest') === 'true';
        
        if (isGuest) {
            // Guests should be logged out when leaving their authorized room
            logout();
            navigate('/login', { replace: true });
        } else {
            navigate('/dashboard');
        }
    };

    if (loading) {
        return (
            <div className="room-loading">
                <div className="animate-pulse" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                    🎥
                </div>
                <p className="text-secondary">{t('room.loading')}</p>
            </div>
        );
    }

    return (
        <div className="room-container">
            <div className="room-header">
                <div className="room-info">
                    <h2 className="room-title">{room?.name}</h2>
                    <span className="room-participants">
                        👥 {remoteStreams.size + 1} {t('room.participants')}
                    </span>
                    {raisedHands.size > 0 && (
                        <span className="raised-hands-indicator" title={t('room.raisedHandsCount', `${raisedHands.size} person(s) raised hand`)}>
                            ✋ {raisedHands.size}
                        </span>
                    )}
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            alert(t('room.linkCopied', 'Link copied to clipboard!'));
                        }}
                        style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        🔗 {t('room.share', 'Share')}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={toggleDarkMode}
                        className="btn btn-secondary btn-sm"
                        title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    >
                        {isDarkMode ? '☀️' : '🌙'}
                    </button>
                    <button
                        onClick={() => setShowChat(!showChat)}
                        className="btn btn-secondary btn-sm"
                    >
                        {showChat ? t('room.hideChat', 'Hide') : t('room.showChat', 'Show')} {t('room.chat')}
                    </button>
                </div>
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
                        isAudioMuted={isAudioMuted}
                    />
                    <Controls
                        isCameraOn={isCameraOn}
                        isMicOn={isMicOn}
                        isAudioMuted={isAudioMuted}
                        isScreenSharing={isScreenSharing}
                        onToggleCamera={toggleCamera}
                        onToggleMic={toggleMic}
                        onToggleAudio={toggleAudio}
                        onToggleScreenShare={toggleScreenShare}
                        onSwitchCamera={switchCamera}
                        isHandRaised={isHandRaised}
                        onToggleRaiseHand={toggleRaiseHand}
                        raisedHandsCount={raisedHands.size}
                        isHost={user?.id === room?.creatorId}
                        onClearAllHands={clearAllHands}
                        isRecording={isRecording}
                        onStartRecording={startRecording}
                        onStopRecording={stopRecording}
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
                        onShowInvite={() => setShowInviteModal(true)}
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
            
            {showRecordingPreview && recordedBlob && (
                <RecordingPreview
                    recordedBlob={recordedBlob}
                    onSave={saveRecording}
                    onDiscard={discardRecording}
                />
            )}
            
            {showInviteModal && (
                <InviteModal
                    roomLinkCode={linkCode}
                    onClose={() => setShowInviteModal(false)}
                />
            )}
        </div>
    );
}
