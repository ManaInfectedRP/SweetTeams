import { useRef, useEffect, useState } from 'react';
import './VideoGrid.css';

export default function VideoGrid({
    localStream,
    remoteStreams,
    screenStream,
    isCameraOn,
    username,
    creatorId,
    currentUserId,
    isHost,
    onAdminAction,
    participants = [], // Array of { socketId, userId, username }
    participantStates = new Map() // Map of socketId -> { audio, video }
}) {
    const localVideoRef = useRef(null);
    const [activeMenu, setActiveMenu] = useState(null); // socketId of active menu

    useEffect(() => {
        if (localVideoRef.current) {
            // Prioritize screen stream if available
            if (screenStream) {
                localVideoRef.current.srcObject = screenStream;
            } else if (localStream) {
                localVideoRef.current.srcObject = localStream;
            }
        }
    }, [localStream, screenStream]);

    // Handle outside click to close menu
    useEffect(() => {
        const handleClick = () => setActiveMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const getGridClass = (count) => {
        if (count <= 1) return 'grid-1';
        if (count <= 2) return 'grid-2';
        if (count <= 4) return 'grid-4';
        if (count <= 6) return 'grid-6';
        return 'grid-many';
    };

    const totalParticipants = 1 + remoteStreams.size;

    const getParticipantInfo = (socketId) => {
        return participants.find(p => p.socketId === socketId);
    };

    const isRemoteHost = (socketId) => {
        const p = getParticipantInfo(socketId);
        return p && p.userId === creatorId;
    };

    const getRemoteState = (socketId) => {
        return participantStates.get(socketId) || { audio: true, video: true };
    };

    const handleMenuClick = (e, socketId) => {
        e.stopPropagation();
        if (activeMenu === socketId) {
            setActiveMenu(null);
        } else {
            setActiveMenu(socketId);
        }
    };

    const handleAdminAction = (action, socketId) => {
        onAdminAction(socketId, action);
        setActiveMenu(null);
    };

    const isLocalVideoVisible = isCameraOn || !!screenStream;

    return (
        <div className={`video-grid ${getGridClass(totalParticipants)}`}>
            {/* Local User */}
            <div className="video-container local-video">
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={isLocalVideoVisible ? '' : 'hidden'}
                />
                {!isLocalVideoVisible && (
                    <div className="video-placeholder">
                        <span>{username?.[0]?.toUpperCase()}</span>
                    </div>
                )}
                <div className="user-label">
                    {username} (Du) {currentUserId === creatorId && '⭐'}
                </div>
            </div>

            {/* Remote Users */}
            {Array.from(remoteStreams).map(([socketId, remote]) => {
                const state = getRemoteState(socketId);
                return (
                    <RemoteVideo
                        key={socketId}
                        remote={remote}
                        socketId={socketId}
                        isHost={isHost}
                        isRemoteHost={isRemoteHost(socketId)}
                        mediaState={state}
                        showMenu={activeMenu === socketId}
                        onMenuClick={(e) => handleMenuClick(e, socketId)}
                        onAdminAction={handleAdminAction}
                    />
                );
            })}
        </div>
    );
}

function RemoteVideo({ remote, socketId, isHost, isRemoteHost, mediaState, showMenu, onMenuClick, onAdminAction }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && remote.stream) {
            videoRef.current.srcObject = remote.stream;
        }
    }, [remote.stream]);

    const isVideoEnabled = mediaState.video;

    return (
        <div className="video-container">
            {/* Admin Control Overlay */}
            {isHost && (
                <div className="admin-controls-trigger" onClick={onMenuClick}>
                    ⋮
                </div>
            )}

            {showMenu && (
                <div className="admin-menu">
                    <button onClick={() => onAdminAction('mute-mic', socketId)}>Stäng av Mick</button>
                    <button onClick={() => onAdminAction('toggle-camera', socketId)}>Stäng av Kamera</button>
                    <button onClick={() => onAdminAction('kick', socketId)} className="danger">Sparka ut</button>
                </div>
            )}

            {/* Status Icons Overlay */}
            <div className="status-icons">
                {!mediaState.audio && <span className="status-icon" title="Mick av">🎤🚫</span>}
                {!mediaState.video && <span className="status-icon" title="Kamera av">📷🚫</span>}
            </div>

            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={isVideoEnabled ? '' : 'hidden'}
            />

            {!isVideoEnabled && (
                <div className="video-placeholder">
                    <span>{remote.username?.[0]?.toUpperCase()}</span>
                </div>
            )}

            <div className="user-label">
                {remote.username} {isRemoteHost && '⭐'}
            </div>
        </div>
    );
}
