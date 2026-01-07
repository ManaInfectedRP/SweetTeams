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
        onSetModerator,
    participants = [], // Array of { socketId, userId, username }
    participantStates = new Map(), // Map of socketId -> { audio, video }
    selectedSpeakerId,
    activeScreenSharer = null, // { socketId, username } or null
    mySocketId = null
}) {
    const localVideoRef = useRef(null);
    const localThumbnailRef = useRef(null);
    const [activeMenu, setActiveMenu] = useState(null); // socketId of active menu
    const [currentPage, setCurrentPage] = useState(0);
    const pageSize = 6;

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
    
    // Separate effect for local thumbnail in screen share mode
    useEffect(() => {
        if (localThumbnailRef.current && localStream) {
            console.log('Setting local thumbnail srcObject to localStream');
            localThumbnailRef.current.srcObject = localStream;
        }
    }, [localStream]);

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

    // Build a flat list of all tiles (include local as first)
    const tiles = [
        { kind: 'local' },
        ...Array.from(remoteStreams, ([socketId, remote]) => ({ kind: 'remote', socketId, remote }))
    ];

    const totalTiles = tiles.length;
    const totalPages = Math.max(1, Math.ceil(totalTiles / pageSize));

    // Clamp current page if participant count changes
    useEffect(() => {
        if (currentPage > totalPages - 1) {
            setCurrentPage(totalPages - 1);
        }
    }, [totalPages, currentPage]);

    const start = currentPage * pageSize;
    const end = start + pageSize;
    const visibleTiles = tiles.slice(start, end);
    const visibleCount = visibleTiles.length;

    const getParticipantInfo = (socketId) => {
        return participants.find(p => p.socketId === socketId);
    };

    const isRemoteHost = (socketId) => {
        const p = getParticipantInfo(socketId);
        return p && p.userId === creatorId;
    };

    const currentUser = participants.find(p => p.userId === currentUserId);
    const currentUserIsModerator = currentUser?.role === 'moderator';

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

    const handlePrev = () => setCurrentPage(p => Math.max(0, p - 1));
    const handleNext = () => setCurrentPage(p => Math.min(totalPages - 1, p + 1));

    // Swipe navigation for mobile
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);
    const onTouchStart = (e) => {
        const t = e.changedTouches[0];
        touchStartX.current = t.clientX;
        touchStartY.current = t.clientY;
    };
    const onTouchEnd = (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - (touchStartX.current ?? t.clientX);
        const dy = t.clientY - (touchStartY.current ?? t.clientY);
        // Horizontal swipe with minimal vertical movement
        if (Math.abs(dx) > 50 && Math.abs(dy) < 40) {
            if (dx < 0) handleNext();
            else handlePrev();
        }
        touchStartX.current = null;
        touchStartY.current = null;
    };
    
    // Check if someone is sharing screen
    const isSomeoneScreenSharing = activeScreenSharer !== null;
    const isLocalScreenSharing = isSomeoneScreenSharing && activeScreenSharer.socketId === mySocketId;
    const screenSharerSocketId = activeScreenSharer?.socketId;

    return (
        <div className="video-grid-wrapper" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {isSomeoneScreenSharing ? (
                // FULLSCREEN LAYOUT - Screen share mode
                <>
                    <div className="screen-share-main">
                        {isLocalScreenSharing ? (
                            // Show local screen stream
                            <ScreenShareVideo
                                stream={screenStream}
                                username={username}
                                label={`${username} (Du) delar skärm`}
                            />
                        ) : (
                            // Show remote screen stream
                            <ScreenShareVideo
                                stream={remoteStreams.get(screenSharerSocketId)?.stream}
                                username={activeScreenSharer.username}
                                label={`${activeScreenSharer.username} delar skärm`}
                            />
                        )}
                    </div>
                    
                    <div className="screen-share-thumbnails">
                        {/* Show thumbnails for participants NOT sharing screen */}
                        {/* Local video thumbnail - only if we're NOT the one sharing */}
                        {!isLocalScreenSharing && (
                            <div className="video-thumbnail local-thumbnail" key="local">
                                <video
                                    ref={localThumbnailRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={isCameraOn ? '' : 'hidden'}
                                />
                                {!isCameraOn && (
                                    <div className="video-placeholder">
                                        <span>{username?.[0]?.toUpperCase()}</span>
                                    </div>
                                )}
                                <div className="user-label">
                                    {username}
                                    {currentUserId === creatorId && <span title="Admin"> ⭐</span>}
                                </div>
                            </div>
                        )}
                        
                        {/* Remote video thumbnails - skip the one sharing screen */}
                        {Array.from(remoteStreams, ([socketId, remote]) => {
                            // Skip the remote that is sharing screen (their track is now screen share)
                            if (socketId === screenSharerSocketId) {
                                return null;
                            }
                            
                            const state = getRemoteState(socketId);
                            const participant = getParticipantInfo(socketId);
                            return (
                                <RemoteThumbnail
                                    key={socketId}
                                    remote={remote}
                                    socketId={socketId}
                                    userId={participant?.userId}
                                    role={participant?.role || 'participant'}
                                    isRemoteHost={isRemoteHost(socketId)}
                                    mediaState={state}
                                    selectedSpeakerId={selectedSpeakerId}
                                />
                            );
                        })}
                    </div>
                </>
            ) : (
                // NORMAL GRID LAYOUT - No screen sharing
                <>
                    <div className={`video-grid ${getGridClass(visibleCount)}`}>
                        {visibleTiles.map((tile, idx) => {
                    if (tile.kind === 'local') {
                        return (
                            <div className="video-container local-video" key="local">
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
                                    {username} (Du)
                                    {currentUserId === creatorId && <span title="Admin"> ⭐</span>}
                                    {currentUserIsModerator && <span title="Moderator"> 🛡️</span>}
                                </div>
                            </div>
                        );
                    }
                    const { socketId, remote } = tile;
                    const state = getRemoteState(socketId);
                    const participant = getParticipantInfo(socketId);
                    return (
                        <RemoteVideo
                            key={socketId}
                            remote={remote}
                            socketId={socketId}
                                                        userId={participant?.userId}
                                                        role={participant?.role || 'participant'}
                            isHost={isHost}
                            canManage={isHost || currentUserIsModerator}
                            isRemoteHost={isRemoteHost(socketId)}
                            mediaState={state}
                            showMenu={activeMenu === socketId}
                            onMenuClick={(e) => handleMenuClick(e, socketId)}
                            onAdminAction={handleAdminAction}
                                                        onSetModerator={onSetModerator}
                            selectedSpeakerId={selectedSpeakerId}
                        />
                    );
                })}
            </div>

            {totalPages > 1 && (
                <div className="video-grid-pager">
                    <button className="pager-btn" onClick={handlePrev} disabled={currentPage === 0} aria-label="Föregående sida">‹</button>
                    <div className="pager-dots">
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                className={`pager-dot ${i === currentPage ? 'active' : ''}`}
                                onClick={() => setCurrentPage(i)}
                                aria-label={`Gå till sida ${i + 1}`}
                            />
                        ))}
                    </div>
                    <button className="pager-btn" onClick={handleNext} disabled={currentPage === totalPages - 1} aria-label="Nästa sida">›</button>
                </div>
            )}
                </>
            )}
        </div>
    );
}

function RemoteVideo({ remote, socketId, userId, role = 'participant', isHost, canManage, isRemoteHost, mediaState, showMenu, onMenuClick, onAdminAction, onSetModerator, selectedSpeakerId }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && remote.stream) {
            console.log(`Setting srcObject for remote ${socketId}, tracks:`, remote.stream.getTracks().map(t => `${t.kind}:${t.readyState}`));
            videoRef.current.srcObject = remote.stream;
        }
    }, [remote.stream, socketId]);

    // Apply selected speaker/output device if supported
    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        const canSetSink = typeof el.setSinkId === 'function';
        if (canSetSink && selectedSpeakerId) {
            el.setSinkId(selectedSpeakerId).catch(err => {
                console.warn('setSinkId failed:', err);
            });
        }
    }, [selectedSpeakerId]);

    const isVideoEnabled = mediaState.video;
    const isModerator = role === 'moderator';
    const showManage = canManage && !isRemoteHost;

    return (
        <div className="video-container">
            {/* Admin/Moderator Control Overlay */}
            {showManage && (
                <div className="admin-controls-trigger" onClick={onMenuClick}>
                    ⋮
                </div>
            )}

            {showMenu && (
                <div className="admin-menu">
                    {/* Admin-only: Promote/Demote Moderator */}
                    {isHost && role === 'participant' && (
                        <button onClick={() => onSetModerator?.(userId, true)}>
                            Gör till Moderator
                        </button>
                    )}
                    {isHost && isModerator && (
                        <button onClick={() => onSetModerator?.(userId, false)}>
                            Ta bort Moderator
                        </button>
                    )}

                    {/* Admin kan bara stänga av mikrofon, inte slå på (integritetsskydd) */}
                    {mediaState.audio && (
                        <button onClick={() => onAdminAction('mute-mic', socketId)}>
                            Stäng av Mikrofon
                        </button>
                    )}
                    {/* Only admin can toggle camera */}
                    {isHost && (
                        <button onClick={() => onAdminAction('toggle-camera', socketId)}>
                            {mediaState.video ? 'Stäng av Kamera' : 'Slå på Kamera'}
                        </button>
                    )}
                    <button onClick={() => onAdminAction('kick', socketId)} className="danger">Sparka ut</button>
                </div>
            )}

            {/* Status Icons Overlay */}
            <div className="status-icons">
                {isModerator && <span className="role-badge moderator" title="Moderator">🛡️</span>}
                {!mediaState.audio && <span className="status-icon" title="Mikrofon av">🎤🚫</span>}
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
                {remote.username}
                {isRemoteHost && <span title="Admin"> ⭐</span>}
                {isModerator && <span title="Moderator"> 🛡️</span>}
            </div>
        </div>
    );
}

// ScreenShareVideo component for the main screen share display
function ScreenShareVideo({ stream, username, label }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="screen-share-video">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="screen-video"
            />
            <div className="screen-share-label">{label}</div>
        </div>
    );
}

// RemoteThumbnail component for participant thumbnails during screen share
function RemoteThumbnail({ remote, socketId, userId, role, isRemoteHost, mediaState, selectedSpeakerId }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && remote.stream) {
            console.log(`Setting srcObject for thumbnail ${socketId}, tracks:`, remote.stream.getTracks().map(t => `${t.kind}:${t.readyState}`));
            videoRef.current.srcObject = remote.stream;
        }
    }, [remote.stream, socketId]);

    // Apply selected speaker/output device if supported
    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        const canSetSink = typeof el.setSinkId === 'function';
        if (canSetSink && selectedSpeakerId) {
            el.setSinkId(selectedSpeakerId).catch(err => {
                console.warn('setSinkId failed:', err);
            });
        }
    }, [selectedSpeakerId]);

    const isVideoEnabled = mediaState.video;
    const isModerator = role === 'moderator';

    return (
        <div className="video-thumbnail">
            <div className="status-icons">
                {isModerator && <span className="role-badge moderator" title="Moderator">🛡️</span>}
                {!mediaState.audio && <span className="status-icon" title="Mikrofon av">🎤🚫</span>}
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
                {remote.username}
                {isRemoteHost && <span title="Admin"> ⭐</span>}
                {isModerator && <span title="Moderator"> 🛡️</span>}
            </div>
        </div>
    );
}
