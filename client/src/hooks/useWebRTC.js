import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { config } from '../config';

export function useWebRTC(roomId, token, username) {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [screenStream, setScreenStream] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [facingMode, setFacingMode] = useState('user'); // 'user' = front, 'environment' = back
    const [currentDeviceId, setCurrentDeviceId] = useState(null);
    // Device selection state
    const [devices, setDevices] = useState({ audioinput: [], videoinput: [], audiooutput: [] });
    const [selectedCameraId, setSelectedCameraId] = useState(null);
    const [selectedMicrophoneId, setSelectedMicrophoneId] = useState(null);
    const [selectedSpeakerId, setSelectedSpeakerId] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    
    // Track who is currently screen sharing: { socketId, username } or null
    const [activeScreenSharer, setActiveScreenSharer] = useState(null);

    // Track media state of all participants (socketId -> { audio: bool, video: bool })
    const [participantStates, setParticipantStates] = useState(new Map());

    const socketRef = useRef(null);
    const peersRef = useRef(new Map());
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);

    // Keep track of our own socket ID for state mapping
    const mySocketId = socketRef.current?.id;

    useEffect(() => {
        if (!roomId || !token) return;

        let mounted = true;

        const createDummyVideoTrack = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 640, 480);
            const stream = canvas.captureStream(30);
            const track = stream.getVideoTracks()[0];
            track.enabled = false;
            return track;
        };

        const getMediaStream = async (videoConstraints = true) => {
            try {
                const constraints = {
                    audio: true,
                    video: videoConstraints === true ? { facingMode: facingMode } : videoConstraints
                };
                return await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                console.warn('Could not get video+audio, trying audio only with dummy video:', err);
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    const videoTrack = createDummyVideoTrack();
                    audioStream.addTrack(videoTrack);
                    if (mounted) setIsCameraOn(false);
                    return audioStream;
                } catch (err2) {
                    console.warn('Could not get audio either, joining without media (dummy A/V):', err2);
                    if (mounted) {
                        setIsCameraOn(false);
                        setIsMicOn(false);
                    }
                    const dummyVideo = createDummyVideoTrack();
                    const stream = new MediaStream([dummyVideo]);
                    return stream;
                }
            }
        };

        const init = async () => {
            const stream = await getMediaStream();

            if (!mounted) {
                if (stream) stream.getTracks().forEach(track => track.stop());
                return;
            }

            if (stream) {
                localStreamRef.current = stream;
                setLocalStream(stream);
                
                // Store initial device ID and facing mode
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    if (settings.deviceId) {
                        setCurrentDeviceId(settings.deviceId);
                        setSelectedCameraId(settings.deviceId);
                    }
                    if (settings.facingMode) {
                        setFacingMode(settings.facingMode);
                    }
                }
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) {
                    const aSettings = audioTrack.getSettings();
                    if (aSettings.deviceId) {
                        setSelectedMicrophoneId(aSettings.deviceId);
                    }
                }
            }

            const socket = io(config.wsUrl, {
                path: '/socket.io',
                auth: { token }
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('Connected to signaling server');
                socket.emit('join-room', roomId);
                // Announce initial state
                if (localStreamRef.current) {
                    const audioTrack = localStreamRef.current.getAudioTracks()[0];
                    const videoTrack = localStreamRef.current.getVideoTracks()[0];
                    // Careful: dummy video track is enabled=false, but effectively we want to say if *camera* is on
                    // For now, trust the state variables
                    socket.emit('media-state-change', { type: 'audio', enabled: audioTrack ? audioTrack.enabled : false });
                    socket.emit('media-state-change', { type: 'video', enabled: videoTrack ? videoTrack.enabled : false });
                }
            });

            socket.on('room-participants', (participantsList) => {
                if (!mounted) return;
                setParticipants(participantsList);
            });

            socket.on('user-joined', ({ socketId, userId, username: peerUsername }) => {
                if (!mounted) return;
                setParticipants(prev => {
                    if (prev.some(p => p.socketId === socketId)) return prev;
                    return [...prev, { socketId, userId, username: peerUsername, role: 'participant' }];
                });
                createPeer(socketId, true, peerUsername, null, socket);
            });

            socket.on('offer', ({ offer, from, username: peerUsername }) => {
                if (!mounted) return;
                createPeer(from, false, peerUsername, offer, socket);
            });

            socket.on('answer', ({ answer, from }) => {
                const peer = peersRef.current.get(from);
                if (peer) peer.signal(answer);
            });

            socket.on('user-role-updated', ({ socketId, role }) => {
                if (!mounted) return;
                setParticipants(prev => prev.map(p =>
                    p.socketId === socketId ? { ...p, role } : p
                ));
            });

            socket.on('ice-candidate', ({ candidate, from }) => {
                const peer = peersRef.current.get(from);
                if (peer) peer.signal(candidate);
            });

            socket.on('user-left', ({ socketId }) => {
                if (!mounted) return;
                setParticipants(prev => prev.filter(p => p.socketId !== socketId));

                const peer = peersRef.current.get(socketId);
                if (peer) {
                    peer.destroy();
                    peersRef.current.delete(socketId);
                }

                setRemoteStreams(prev => {
                    const newStreams = new Map(prev);
                    newStreams.delete(socketId);
                    return newStreams;
                });

                // Clear state
                setParticipantStates(prev => {
                    const newStates = new Map(prev);
                    newStates.delete(socketId);
                    return newStates;
                });
            });

            socket.on('chat-message', (data) => {
                if (!mounted) return;
                setMessages(prev => [...prev, data]);
            });

            socket.on('message-deleted', ({ id, deletedBy }) => {
                if (!mounted) return;
                setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted: true, deletedBy } : m));
            });

            // --- STATE UPDATES ---
            socket.on('user-media-state-changed', ({ socketId, type, enabled }) => {
                if (!mounted) return;
                setParticipantStates(prev => {
                    const newStates = new Map(prev);
                    const currentState = newStates.get(socketId) || { audio: true, video: true };
                    newStates.set(socketId, { ...currentState, [type]: enabled });
                    return newStates;
                });
            });
            
            // --- SCREEN SHARING EVENTS ---
            socket.on('user-screen-sharing', ({ socketId, username }) => {
                if (!mounted) return;
                console.log(`User ${username} (${socketId}) started screen sharing`);
                setActiveScreenSharer({ socketId, username });
            });
            
            socket.on('track-replaced', ({ socketId: fromSocketId, trackType }) => {
                if (!mounted) return;
                console.log(`🔄 Track replaced signal from ${fromSocketId}, type: ${trackType}`);
                
                // Add a small delay to ensure replaceTrack has completed on the sender side
                setTimeout(() => {
                    // Force refresh the remote stream for this peer
                    const peer = peersRef.current.get(fromSocketId);
                    if (peer && peer._pc) {
                        console.log('Found peer connection for', fromSocketId);
                        const receivers = peer._pc.getReceivers();
                        console.log('Receivers:', receivers.length);
                        const tracks = receivers.map(r => r.track).filter(Boolean);
                        console.log('Tracks from receivers:', tracks.map(t => `${t.kind}:${t.id.substring(0,8)}:${t.readyState}:${t.label}`));
                        
                        if (tracks.length > 0) {
                            const updatedStream = new MediaStream(tracks);
                            console.log('Created new MediaStream with tracks:', updatedStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
                            
                            setRemoteStreams(prev => {
                                const existing = prev.get(fromSocketId);
                                if (existing) {
                                    console.log('✅ Refreshing stream for', fromSocketId, 'tracks:', tracks.map(t => `${t.kind}:${t.label}`));
                                    const newMap = new Map(prev);
                                    newMap.set(fromSocketId, { stream: updatedStream, username: existing.username });
                                    return newMap;
                                } else {
                                    console.warn('No existing stream found for', fromSocketId);
                                    return prev;
                                }
                            });
                        } else {
                            console.warn('No tracks found for peer', fromSocketId);
                        }
                    } else {
                        console.warn('No peer connection found for', fromSocketId);
                    }
                }, 200); // 200ms delay to ensure track replacement completes
            });
            
            socket.on('user-stopped-screen-sharing', ({ socketId }) => {
                if (!mounted) return;
                console.log(`User stopped screen sharing: ${socketId}`);
                setActiveScreenSharer(prev => {
                    if (prev && prev.socketId === socketId) {
                        return null;
                    }
                    return prev;
                });
            });
            
            socket.on('screen-share-rejected', ({ reason, sharerUsername }) => {
                if (!mounted) return;
                if (reason === 'already-sharing') {
                    alert(`${sharerUsername} delar redan sin skärm. Bara en person kan dela åt gången.`);
                }
                // Revert our screen sharing state
                if (screenStreamRef.current) {
                    screenStreamRef.current.getTracks().forEach(track => track.stop());
                    screenStreamRef.current = null;
                    setScreenStream(null);
                    setIsScreenSharing(false);
                    
                    // Restore regular camera track to peers
                    if (localStreamRef.current) {
                        const videoTrack = localStreamRef.current.getVideoTracks()[0];
                        if (videoTrack && videoTrack.readyState === 'live') {
                            peersRef.current.forEach(peer => {
                                try {
                                    const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                                    if (sender) {
                                        sender.replaceTrack(videoTrack).catch(err => {
                                            console.error('Failed to restore track after rejection:', err);
                                        });
                                    }
                                } catch (err) {
                                    console.error('Error restoring track after rejection:', err);
                                }
                            });
                        }
                    }
                }
            });

            // --- ADMIN COMMANDS ---
            socket.on('admin-command', ({ action }) => {
                if (!mounted) return;
                console.log('Admin command:', action);

                if (action === 'mute-mic') {
                    if (localStreamRef.current) {
                        localStreamRef.current.getAudioTracks().forEach(track => {
                            track.enabled = false;
                        });
                        setIsMicOn(false);
                        // Notify others
                        socket.emit('media-state-change', { type: 'audio', enabled: false });
                    }
                } else if (action === 'toggle-camera') {
                    if (localStreamRef.current) {
                        localStreamRef.current.getVideoTracks().forEach(track => {
                            track.enabled = !track.enabled;
                            setIsCameraOn(track.enabled);
                            // Notify others
                            socket.emit('media-state-change', { type: 'video', enabled: track.enabled });
                        });
                    }
                }
            });

            socket.on('kicked', () => {
                alert('Du har blivit utsparkad från rummet av ägaren.');
                window.location.href = '/dashboard';
            });
        };

        init();

        // Enumerate devices after permissions are granted
        const refreshDevices = async () => {
            try {
                const list = await navigator.mediaDevices.enumerateDevices();
                const grouped = { audioinput: [], videoinput: [], audiooutput: [] };
                list.forEach(d => {
                    if (grouped[d.kind]) grouped[d.kind].push(d);
                });
                setDevices(grouped);
                if (!selectedSpeakerId && grouped.audiooutput.length > 0) {
                    setSelectedSpeakerId(grouped.audiooutput[0].deviceId);
                }
            } catch (e) {
                console.warn('enumerateDevices failed:', e);
            }
        };
        refreshDevices();
        if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
        }

        return () => {
            mounted = false;
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
            }
            peersRef.current.forEach(peer => peer.destroy());
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
                navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
            }
        };
    }, [roomId, token]);

    const createPeer = (socketId, initiator, peerUsername, offer = null, socket) => {
        if (peersRef.current.has(socketId) && initiator) return;

        const peer = new SimplePeer({
            initiator,
            trickle: true,
            stream: localStreamRef.current || undefined,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('signal', (signal) => {
            if (signal.type === 'offer') {
                socket.emit('offer', { offer: signal, to: socketId });
            } else if (signal.type === 'answer') {
                socket.emit('answer', { answer: signal, to: socketId });
            } else {
                socket.emit('ice-candidate', { candidate: signal, to: socketId });
            }
        });

        peer.on('stream', (stream) => {
            console.log('Received initial stream from peer:', socketId, 'tracks:', stream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`));
            setRemoteStreams(prev => new Map(prev).set(socketId, { stream, username: peerUsername }));
        });
        
        // Listen for track events to handle track replacements (e.g., screen sharing)
        // This is crucial for updating when remote peer switches between camera and screen share
        let lastTrackUpdate = 0;
        let lastStreamTrackIds = '';
        
        peer._pc.ontrack = (event) => {
            const now = Date.now();
            // Debounce updates to prevent spam (max once per 1000ms)
            if (now - lastTrackUpdate < 1000) {
                console.log('⏭️ Skipping ontrack update (debounced)');
                return;
            }
            
            if (event.streams && event.streams[0]) {
                const stream = event.streams[0];
                const currentTrackIds = stream.getTracks().map(t => `${t.kind}:${t.id}`).sort().join(',');
                
                // Check if tracks are actually different
                if (currentTrackIds === lastStreamTrackIds) {
                    console.log('⏭️ Skipping ontrack update (same tracks)');
                    return;
                }
                
                lastTrackUpdate = now;
                lastStreamTrackIds = currentTrackIds;
                
                console.log('🔄 Track event from peer:', socketId, 'kind:', event.track.kind, 'id:', event.track.id.substring(0,8));
                console.log('Stream tracks:', stream.getTracks().map(t => `${t.kind}:${t.id.substring(0,8)}`));
                
                // Force update by creating a new stream object with current tracks
                // This ensures React re-renders and video elements update their srcObject
                const updatedStream = new MediaStream(stream.getTracks());
                
                setRemoteStreams(prev => {
                    const existing = prev.get(socketId);
                    const username = existing?.username || peerUsername;
                    console.log('Updating stream for', socketId, 'with new MediaStream');
                    // Create new Map to trigger React update
                    const newMap = new Map(prev);
                    newMap.set(socketId, { stream: updatedStream, username });
                    return newMap;
                });
            }
        };
        
        // Monitor for track changes on the remote stream
        // This catches track replacements that don't trigger ontrack
        const monitorTracks = () => {
            const receivers = peer._pc.getReceivers();
            receivers.forEach(receiver => {
                if (receiver.track) {
                    receiver.track.onended = () => {
                        console.log('Track ended from peer:', socketId, receiver.track.kind);
                    };
                    receiver.track.onmute = () => {
                        console.log('Track muted from peer:', socketId, receiver.track.kind);
                    };
                    receiver.track.onunmute = () => {
                        console.log('Track unmuted from peer:', socketId, receiver.track.kind);
                    };
                }
            });
        };
        
        // Check for track changes periodically
        peer._pc.onnegotiationneeded = () => {
            console.log('🔄 Negotiation needed for peer:', socketId);
            monitorTracks();
        };
        
        // Initial track monitoring
        setTimeout(monitorTracks, 1000);
        
        // Note: Polling removed since removeTrack + addTrack triggers proper ontrack events

        peer.on('error', (err) => {
            console.error('Peer error:', err);
        });

        if (offer) peer.signal(offer);
        peersRef.current.set(socketId, peer);
    };

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOn(videoTrack.enabled);
                if (socketRef.current) {
                    socketRef.current.emit('media-state-change', { type: 'video', enabled: videoTrack.enabled });
                }
            }
        }
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicOn(audioTrack.enabled);
                if (socketRef.current) {
                    socketRef.current.emit('media-state-change', { type: 'audio', enabled: audioTrack.enabled });
                }
            }
        }
    };

    const switchCamera = async () => {
        if (!localStreamRef.current) return;
        
        try {
            const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
            const currentVideoEnabled = currentVideoTrack?.enabled;
            
            // Stop the current video track first
            if (currentVideoTrack) {
                currentVideoTrack.stop();
            }
            
            // Toggle facing mode
            const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
            
            // Request new video stream with fresh constraints
            let newVideoStream;
            try {
                newVideoStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: newFacingMode },
                    audio: false
                });
            } catch (e1) {
                console.warn('Failed with facingMode, trying alternate approach:', e1);
                // Try without any facingMode - let browser choose
                newVideoStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }
            
            if (!newVideoStream) {
                alert('Kunde inte öppna kamera.');
                return;
            }
            
            const newVideoTrack = newVideoStream.getVideoTracks()[0];
            if (!newVideoTrack) {
                alert('Ingen videospår kunde hämtas.');
                return;
            }
            
            // Get settings from new track
            const newSettings = newVideoTrack.getSettings();
            if (newSettings.deviceId) {
                setCurrentDeviceId(newSettings.deviceId);
            }
            if (newSettings.facingMode) {
                setFacingMode(newSettings.facingMode);
            } else {
                // If facingMode is not available in settings, toggle our state anyway
                setFacingMode(newFacingMode);
            }
            
            // Maintain video enabled state
            newVideoTrack.enabled = currentVideoEnabled;
            
            // Replace old track with new one
            if (currentVideoTrack) {
                localStreamRef.current.removeTrack(currentVideoTrack);
            }
            localStreamRef.current.addTrack(newVideoTrack);
            
            // Trigger re-render
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            
            // Update all peer connections
            peersRef.current.forEach(peer => {
                const videoSender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(newVideoTrack).catch(err => {
                        console.error('Failed to replace track for peer:', err);
                    });
                }
            });
            
        } catch (err) {
            console.error('Error switching camera:', err);
            alert('Kunde inte byta kamera. Din telefon kanske inte stöder detta.');
        }
    };

    // Select camera by deviceId
    const selectCamera = async (deviceId) => {
        if (!deviceId || !localStreamRef.current) return;
        try {
            const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
            const currentEnabled = currentVideoTrack?.enabled;
            const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
            const newVideoTrack = stream.getVideoTracks()[0];
            if (!newVideoTrack) throw new Error('Ingen video-spår hittades');
            newVideoTrack.enabled = currentEnabled;
            if (currentVideoTrack) {
                currentVideoTrack.stop();
                localStreamRef.current.removeTrack(currentVideoTrack);
            }
            localStreamRef.current.addTrack(newVideoTrack);
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            setSelectedCameraId(deviceId);
            const settings = newVideoTrack.getSettings();
            if (settings.facingMode) setFacingMode(settings.facingMode);
            peersRef.current.forEach(peer => {
                const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(newVideoTrack);
            });
        } catch (err) {
            console.error('Failed to select camera:', err);
            alert('Kunde inte byta kamera: ' + err.message);
        }
    };

    // Select microphone by deviceId
    const selectMicrophone = async (deviceId) => {
        if (!deviceId || !localStreamRef.current) return;
        try {
            const currentAudioTrack = localStreamRef.current.getAudioTracks()[0];
            const currentEnabled = currentAudioTrack?.enabled;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } }, video: false });
            const newAudioTrack = stream.getAudioTracks()[0];
            if (!newAudioTrack) throw new Error('Ingen ljud-spår hittades');
            if (currentEnabled !== undefined) newAudioTrack.enabled = currentEnabled;
            if (currentAudioTrack) {
                currentAudioTrack.stop();
                localStreamRef.current.removeTrack(currentAudioTrack);
            }
            localStreamRef.current.addTrack(newAudioTrack);
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            setSelectedMicrophoneId(deviceId);
            peersRef.current.forEach(peer => {
                const sender = peer._pc.getSenders().find(s => s.track?.kind === 'audio');
                if (sender) sender.replaceTrack(newAudioTrack);
            });
            if (socketRef.current) {
                socketRef.current.emit('media-state-change', { type: 'audio', enabled: newAudioTrack.enabled });
            }
        } catch (err) {
            console.error('Failed to select microphone:', err);
            alert('Kunde inte byta mikrofon: ' + err.message);
        }
    };

    // Select speaker (audio output) by deviceId
    const selectSpeaker = (deviceId) => {
        setSelectedSpeakerId(deviceId);
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop screen sharing
            if (screenStreamRef.current) {
                const screenTrack = screenStreamRef.current.getVideoTracks()[0];
                if (screenTrack) {
                    screenTrack.onended = null; // Remove the event listener first
                }
                
                screenStreamRef.current.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
                setScreenStream(null);
                setIsScreenSharing(false);
                setActiveScreenSharer(null);
                
                if (socketRef.current) {
                    socketRef.current.emit('screen-share-stopped');
                }
                
                // Restore regular camera track to peers using replaceTrack
                if (localStreamRef.current) {
                    const videoTrack = localStreamRef.current.getVideoTracks()[0];
                    console.log('Restoring camera track:', videoTrack);
                    console.log('Track details:', {
                        id: videoTrack?.id,
                        kind: videoTrack?.kind,
                        label: videoTrack?.label,
                        readyState: videoTrack?.readyState,
                        enabled: videoTrack?.enabled,
                        muted: videoTrack?.muted
                    });
                    
                    if (videoTrack && videoTrack.readyState === 'live') {
                        // Enable the track if it's disabled
                        videoTrack.enabled = isCameraOn;
                        
                        peersRef.current.forEach(peer => {
                            try {
                                const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                                if (sender) {
                                    console.log('Current sender track:', sender.track?.id, sender.track?.label);
                                    sender.replaceTrack(videoTrack).then(() => {
                                        console.log('✅ Replaced screen track with camera track');
                                        // Signal to remote peers that track was replaced
                                        if (socketRef.current) {
                                            socketRef.current.emit('track-replaced', { trackType: 'video' });
                                        }
                                    }).catch(err => {
                                        console.error('Failed to restore video track for peer:', err);
                                    });
                                }
                            } catch (err) {
                                console.error('Error restoring video track for peer:', err);
                            }
                        });
                    } else {
                        console.warn('Video track is not available or not live, track state:', videoTrack?.readyState);
                    }
                }
            }
        } else {
            // Start screen sharing
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = stream;
                setScreenStream(stream);
                setIsScreenSharing(true);
                
                // Set ourselves as the active sharer optimistically
                // (will be confirmed or rejected by server)
                if (socketRef.current) {
                    socketRef.current.emit('screen-share-started');
                }
                
                const screenTrack = stream.getVideoTracks()[0];
                
                // Replace video track in all peer connections using replaceTrack
                peersRef.current.forEach(peer => {
                    try {
                        const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(screenTrack).then(() => {
                                console.log('✅ Replaced camera track with screen track');
                                // Signal to remote peers that track was replaced
                                if (socketRef.current) {
                                    socketRef.current.emit('track-replaced', { trackType: 'video' });
                                }
                            }).catch(err => {
                                console.error('Failed to replace with screen track for peer:', err);
                            });
                        }
                    } catch (err) {
                        console.error('Error replacing with screen track for peer:', err);
                    }
                });
                
                // Handle when user stops sharing from browser UI
                // Use a more reliable approach that doesn't depend on state closure
                screenTrack.onended = () => {
                    console.log('Screen track ended (user stopped from browser)');
                    // Clean up the screen stream
                    if (screenStreamRef.current) {
                        screenStreamRef.current.getTracks().forEach(track => track.stop());
                        screenStreamRef.current = null;
                    }
                    setScreenStream(null);
                    setIsScreenSharing(false);
                    setActiveScreenSharer(null);
                    
                    if (socketRef.current) {
                        socketRef.current.emit('screen-share-stopped');
                    }
                    
                    // Restore regular camera track to peers using replaceTrack
                    if (localStreamRef.current) {
                        const videoTrack = localStreamRef.current.getVideoTracks()[0];
                        if (videoTrack && videoTrack.readyState === 'live') {
                            peersRef.current.forEach(peer => {
                                try {
                                    const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                                    if (sender) {
                                        sender.replaceTrack(videoTrack).then(() => {
                                            console.log('✅ Restored camera track after browser stop');
                                            // Signal to remote peers
                                            if (socketRef.current) {
                                                socketRef.current.emit('track-replaced', { trackType: 'video' });
                                            }
                                        }).catch(err => {
                                            console.error('Failed to restore video track after browser stop:', err);
                                        });
                                    }
                                } catch (err) {
                                    console.error('Error restoring track after browser stop:', err);
                                }
                            });
                        }
                    }
                };
            } catch (err) {
                console.error('Error sharing screen:', err);
            }
        }
    };

    const sendMessage = (message) => {
        if (socketRef.current && message.trim()) {
            socketRef.current.emit('chat-message', message);
        }
    };

    const sendAdminCommand = (targetSocketId, action) => {
        if (socketRef.current) {
            socketRef.current.emit('admin-action', { targetSocketId, action });
        }
    };

    const setModerator = (targetUserId, isModerator) => {
        if (socketRef.current) {
            socketRef.current.emit('set-moderator', { targetUserId, isModerator });
        }
    };

    // Helper to get state
    const getParticipantState = (socketId) => {
        return participantStates.get(socketId) || { audio: true, video: true };
    };

    const deleteMessage = (id) => {
        if (socketRef.current) {
            socketRef.current.emit('delete-message', { id });
        }
    };

    return {
        localStream,
        remoteStreams,
        screenStream,
        isCameraOn,
        isMicOn,
        isScreenSharing,
        devices,
        selectedCameraId,
        selectedMicrophoneId,
        selectedSpeakerId,
        participants,
        messages,
        participantStates, // New export
        activeScreenSharer, // Track who is sharing screen
        toggleCamera,
        toggleMic,
        toggleScreenShare,
        switchCamera,
        selectCamera,
        selectMicrophone,
        selectSpeaker,
        sendMessage,
        sendAdminCommand,
        deleteMessage,
        setModerator
    };
}
