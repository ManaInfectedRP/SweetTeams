import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import { config } from '../config';

export function useWebRTC(roomId, token) {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [screenStream, setScreenStream] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [facingMode, setFacingMode] = useState('user'); // 'user' = front, 'environment' = back
    // Device selection state
    const [devices, setDevices] = useState({ audioinput: [], videoinput: [], audiooutput: [] });
    const [selectedCameraId, setSelectedCameraId] = useState(null);
    const [selectedMicrophoneId, setSelectedMicrophoneId] = useState(null);
    const [selectedSpeakerId, setSelectedSpeakerId] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    
    // Audio settings state
    const [micVolume, setMicVolume] = useState(100);
    const [noiseReduction, setNoiseReduction] = useState(true);
    const [spatialAudio, setSpatialAudio] = useState(false);
    
    // Track who is currently screen sharing: { socketId, username } or null
    const [activeScreenSharer, setActiveScreenSharer] = useState(null);

    // Track media state of all participants (socketId -> { audio: bool, video: bool })
    const [participantStates, setParticipantStates] = useState(new Map());
    
    // Track who is currently speaking (socketId -> boolean)
    const [speakingParticipants, setSpeakingParticipants] = useState(new Map());
    const speakingTimeoutsRef = useRef(new Map());
    
    // Track raised hands: Map of socketId -> { order: number, timestamp: number, username: string }
    const [raisedHands, setRaisedHands] = useState(new Map());
    const [isHandRaised, setIsHandRaised] = useState(false);
    
    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [showRecordingPreview, setShowRecordingPreview] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const socketRef = useRef(null);
    const peersRef = useRef(new Map());
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null);
    const sourceNodeRef = useRef(null);

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

        const getMediaStream = async (videoConstraints = true, audioDeviceId = null, videoDeviceId = null) => {
            try {
                const audioConstraints = {
                    echoCancellation: true,
                    noiseSuppression: noiseReduction,
                    autoGainControl: true
                };
                
                // Add device ID if specified
                if (audioDeviceId) {
                    audioConstraints.deviceId = { exact: audioDeviceId };
                }
                
                let videoConstraintsObj = videoConstraints;
                if (videoConstraints === true) {
                    videoConstraintsObj = { facingMode: facingMode };
                    if (videoDeviceId) {
                        videoConstraintsObj.deviceId = { exact: videoDeviceId };
                    }
                } else if (videoConstraints && typeof videoConstraints === 'object' && videoDeviceId) {
                    videoConstraintsObj = { ...videoConstraints, deviceId: { exact: videoDeviceId } };
                }
                
                const constraints = {
                    audio: audioConstraints,
                    video: videoConstraintsObj
                };
                return await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                console.warn('Could not get video+audio, trying audio only with dummy video:', err);
                try {
                    const audioConstraints = {
                        echoCancellation: true,
                        noiseSuppression: noiseReduction,
                        autoGainControl: true
                    };
                    if (audioDeviceId) {
                        audioConstraints.deviceId = { exact: audioDeviceId };
                    }
                    const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });
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
            // Fetch user preferences
            let preferences = null;
            try {
                const response = await fetch(`${config.apiUrl}/api/profile/preferences`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    preferences = await response.json();
                    console.log('Loaded user preferences:', preferences);
                }
            } catch (err) {
                console.warn('Could not fetch preferences:', err);
            }

            // Get initial camera state from preferences (default to true if not set)
            const initialCameraOn = preferences?.autoJoinVideo !== false;
            const initialMicOn = preferences?.autoJoinAudio !== false;
            
            // Use default devices from preferences if available
            const defaultAudioDevice = preferences?.defaultMicrophone || null;
            const defaultVideoDevice = preferences?.defaultCamera || null;
            const defaultSpeaker = preferences?.defaultSpeaker || null;

            const stream = await getMediaStream(initialCameraOn, defaultAudioDevice, defaultVideoDevice);

            if (!mounted) {
                if (stream) stream.getTracks().forEach(track => track.stop());
                return;
            }

            if (stream) {
                // Store original stream first
                const originalStream = stream;
                
                // Apply audio processing to get processed audio track
                const originalAudioTrack = originalStream.getAudioTracks()[0];
                let audioTrackToUse = originalAudioTrack;
                
                if (originalAudioTrack) {
                    const processedAudioTrack = applyAudioProcessing(originalAudioTrack);
                    if (processedAudioTrack && processedAudioTrack !== originalAudioTrack) {
                        audioTrackToUse = processedAudioTrack;
                    }
                    
                    const aSettings = originalAudioTrack.getSettings();
                    if (aSettings.deviceId) {
                        setSelectedMicrophoneId(aSettings.deviceId);
                    }
                }
                
                // Create new stream with processed audio and original video
                const videoTrack = originalStream.getVideoTracks()[0];
                const tracksForStream = [];
                if (audioTrackToUse) tracksForStream.push(audioTrackToUse);
                if (videoTrack) tracksForStream.push(videoTrack);
                
                const processedStream = new MediaStream(tracksForStream);
                
                localStreamRef.current = processedStream;
                setLocalStream(processedStream);
                
                // Apply initial states from preferences
                // Disable tracks if preferences say to start with them off
                if (!initialMicOn && audioTrackToUse) {
                    audioTrackToUse.enabled = false;
                }
                if (!initialCameraOn && videoTrack && !videoTrack.label.includes('dummy')) {
                    videoTrack.enabled = false;
                }
                
                // Set initial camera and mic states from preferences
                setIsCameraOn(initialCameraOn && videoTrack && !videoTrack.label.includes('dummy'));
                setIsMicOn(initialMicOn && audioTrackToUse && originalAudioTrack.readyState === 'live');
                
                // Set default speaker if available
                if (defaultSpeaker) {
                    setSelectedSpeakerId(defaultSpeaker);
                }
                
                // Set up audio level detection for local stream
                if (audioTrackToUse) {
                    setupAudioLevelDetection(processedStream, 'local');
                }
                
                // Store initial device ID and facing mode
                if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    if (settings.deviceId) {
                        setSelectedCameraId(settings.deviceId);
                    }
                    if (settings.facingMode) {
                        setFacingMode(settings.facingMode);
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
                
                // Get initial media state
                let initialAudioState = false;
                let initialVideoState = false;
                if (localStreamRef.current) {
                    const audioTrack = localStreamRef.current.getAudioTracks()[0];
                    const videoTrack = localStreamRef.current.getVideoTracks()[0];
                    initialAudioState = audioTrack ? audioTrack.enabled : false;
                    initialVideoState = videoTrack ? videoTrack.enabled : false;
                }
                
                // Send initial state with join-room
                socket.emit('join-room', roomId, {
                    audio: initialAudioState,
                    video: initialVideoState
                });
            });

            socket.on('room-participants', (participantsList) => {
                if (!mounted) return;
                setParticipants(participantsList);
            });

            socket.on('user-joined', ({ socketId, userId, username: peerUsername, profilePicture }) => {
                if (!mounted) return;
                setParticipants(prev => {
                    if (prev.some(p => p.socketId === socketId)) return prev;
                    return [...prev, { socketId, userId, username: peerUsername, profilePicture, role: 'participant' }];
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

            socket.on('message-reaction', ({ messageId, emoji, username, userId }) => {
                if (!mounted) return;
                setMessages(prev => prev.map(m => {
                    if (m.id === messageId) {
                        // Remove any existing reaction from this user
                        const reactions = (m.reactions || []).filter(r => r.userId !== userId);
                        // Add new reaction
                        return { ...m, reactions: [...reactions, { emoji, username, userId }] };
                    }
                    return m;
                }));
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
                    if (peer && peer._pc && peer._pc.getReceivers) {
                        console.log('Found peer connection for', fromSocketId);
                        const receivers = peer._pc.getReceivers();
                        console.log('Receivers:', receivers.length);
                        const tracks = receivers.map(r => r.track).filter(Boolean);
                        console.log('Tracks from receivers:', tracks.map(t => `${t.kind}:${t.id.substring(0,8)}:${t.readyState}:${t.label}`));
                        
                        if (tracks.length > 0) {
                            const updatedStream = new MediaStream(tracks);
                            // Add a timestamp to force React to detect the change
                            updatedStream._updateTime = Date.now();
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
                console.log(`📺 User stopped screen sharing: ${socketId}`);
                setActiveScreenSharer(prev => {
                    if (prev && prev.socketId === socketId) {
                        console.log('Clearing activeScreenSharer state');
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
            
            // --- HAND RAISING EVENTS ---
            socket.on('hand-raised', ({ socketId, username, order, timestamp }) => {
                if (!mounted) return;
                // Check if this is our own hand being echoed back
                const isOwnHand = socketId === socket.id;
                const keyToUse = isOwnHand ? 'local' : socketId;
                
                setRaisedHands(prev => {
                    const newMap = new Map(prev);
                    newMap.set(keyToUse, { order, timestamp, username });
                    return newMap;
                });
            });
            
            socket.on('hand-lowered', ({ socketId }) => {
                if (!mounted) return;
                // Check if this is our own hand
                const isOwnHand = socketId === socket.id;
                const keyToUse = isOwnHand ? 'local' : socketId;
                
                setRaisedHands(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(keyToUse);
                    // Reorder remaining hands
                    const sortedHands = Array.from(newMap.entries())
                        .sort((a, b) => a[1].timestamp - b[1].timestamp)
                        .map(([sid, data], index) => [sid, { ...data, order: index + 1 }]);
                    return new Map(sortedHands);
                });
            });
            
            socket.on('all-hands-lowered', () => {
                if (!mounted) return;
                setRaisedHands(new Map());
                setIsHandRaised(false);
            });
            
            // --- SPEAKING STATE EVENTS ---
            socket.on('user-speaking-state', ({ socketId, speaking }) => {
                if (!mounted) return;
                setSpeakingParticipants(prev => {
                    const newMap = new Map(prev);
                    newMap.set(socketId, speaking);
                    return newMap;
                });
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
            if (sourceNodeRef.current) {
                sourceNodeRef.current.disconnect();
            }
            if (gainNodeRef.current) {
                gainNodeRef.current.disconnect();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            const peers = peersRef.current;
            peers.forEach(peer => peer.destroy());
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
            
            // Set up audio level detection for remote peer
            setupAudioLevelDetection(stream, socketId);
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
            if (!peer._pc || !peer._pc.getReceivers) return;
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
    
    // Setup audio level detection for a stream
    const setupAudioLevelDetection = (stream, socketId) => {
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const SPEAKING_THRESHOLD = 20; // Adjust this value for sensitivity
            const SPEAKING_TIMEOUT = 300; // ms to wait before marking as not speaking
            
            const checkAudioLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                
                const isSpeaking = average > SPEAKING_THRESHOLD;
                
                if (isSpeaking) {
                    // Mark as speaking
                    setSpeakingParticipants(prev => {
                        const newMap = new Map(prev);
                        const wasNotSpeaking = !prev.get(socketId);
                        newMap.set(socketId, true);
                        
                        // Broadcast to others if this is local stream and we just started speaking
                        if (socketId === 'local' && wasNotSpeaking && socketRef.current) {
                            socketRef.current.emit('speaking-state', { speaking: true });
                        }
                        
                        return newMap;
                    });
                    
                    // Clear existing timeout
                    if (speakingTimeoutsRef.current.has(socketId)) {
                        clearTimeout(speakingTimeoutsRef.current.get(socketId));
                    }
                    
                    // Set timeout to mark as not speaking
                    const timeout = setTimeout(() => {
                        setSpeakingParticipants(prev => {
                            const newMap = new Map(prev);
                            newMap.set(socketId, false);
                            
                            // Broadcast to others if this is local stream
                            if (socketId === 'local' && socketRef.current) {
                                socketRef.current.emit('speaking-state', { speaking: false });
                            }
                            
                            return newMap;
                        });
                    }, SPEAKING_TIMEOUT);
                    
                    speakingTimeoutsRef.current.set(socketId, timeout);
                }
                
                // Continue checking if track is still live
                if (audioTrack.readyState === 'live') {
                    requestAnimationFrame(checkAudioLevel);
                }
            };
            
            checkAudioLevel();
        } catch (err) {
            console.warn('Could not set up audio level detection:', err);
        }
    };

    const toggleCamera = async () => {
        if (!localStreamRef.current) return;
        
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        
        // Check if we have a real camera track (not a dummy track)
        const isDummyTrack = videoTrack && videoTrack.label.includes('dummy');
        const hasRealCamera = videoTrack && !isDummyTrack;
        
        if (hasRealCamera) {
            // If we have a real camera track, just toggle it
            videoTrack.enabled = !videoTrack.enabled;
            setIsCameraOn(videoTrack.enabled);
            if (socketRef.current) {
                socketRef.current.emit('media-state-change', { type: 'video', enabled: videoTrack.enabled });
            }
        } else if (!isCameraOn) {
            // If camera is off and we don't have a real track, request camera access
            try {
                const videoConstraints = selectedCameraId 
                    ? { deviceId: { exact: selectedCameraId }, facingMode: facingMode }
                    : { facingMode: facingMode };
                    
                const newVideoStream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints,
                    audio: false
                });
                
                const newVideoTrack = newVideoStream.getVideoTracks()[0];
                
                if (newVideoTrack) {
                    // Remove old track if exists
                    if (videoTrack) {
                        videoTrack.stop();
                        localStreamRef.current.removeTrack(videoTrack);
                    }
                    
                    // Add new track
                    localStreamRef.current.addTrack(newVideoTrack);
                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                    
                    // Update state
                    setIsCameraOn(true);
                    
                    // Update device ID
                    const settings = newVideoTrack.getSettings();
                    if (settings.deviceId) {
                        setSelectedCameraId(settings.deviceId);
                    }
                    
                    // Notify peers
                    if (socketRef.current) {
                        socketRef.current.emit('media-state-change', { type: 'video', enabled: true });
                    }
                    
                    // Replace track in all peer connections
                    peersRef.current.forEach(peer => {
                        const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(newVideoTrack).catch(err => {
                                console.error('Failed to replace video track:', err);
                            });
                        }
                    });
                }
            } catch (err) {
                console.error('Error enabling camera:', err);
                alert('Kunde inte aktivera kameran. Kontrollera att du har gett webbläsaren åtkomst till kameran.');
            }
        } else {
            // Turn off camera
            if (videoTrack) {
                videoTrack.enabled = false;
                setIsCameraOn(false);
                if (socketRef.current) {
                    socketRef.current.emit('media-state-change', { type: 'video', enabled: false });
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
            
            // Build constraints with audio settings
            const constraints = {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: noiseReduction,
                autoGainControl: true
            };
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints, video: false });
            const newAudioTrack = stream.getAudioTracks()[0];
            if (!newAudioTrack) throw new Error('Ingen ljud-spår hittades');
            
            const wasEnabled = currentEnabled !== undefined ? currentEnabled : true;
            
            // Apply audio processing
            const processedAudioTrack = applyAudioProcessing(newAudioTrack);
            const audioTrackToUse = processedAudioTrack || newAudioTrack;
            audioTrackToUse.enabled = wasEnabled;
            
            if (currentAudioTrack) {
                currentAudioTrack.stop();
                localStreamRef.current.removeTrack(currentAudioTrack);
            }
            localStreamRef.current.addTrack(audioTrackToUse);
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            setSelectedMicrophoneId(deviceId);
            
            peersRef.current.forEach(peer => {
                const sender = peer._pc.getSenders().find(s => s.track?.kind === 'audio');
                if (sender) sender.replaceTrack(audioTrackToUse);
            });
            if (socketRef.current) {
                socketRef.current.emit('media-state-change', { type: 'audio', enabled: newAudioTrack.enabled });
            }
        } catch (err) {
            console.error('Failed to select microphone:', err);
            alert('Kunde inte byta mikrofon: ' + err.message);
        }
    };

    // Apply audio processing (volume, noise reduction, spatial audio)
    const applyAudioProcessing = (audioTrack) => {
        if (!audioTrack) return audioTrack;
        
        try {
            // Clean up previous audio context if exists
            if (sourceNodeRef.current) {
                try { sourceNodeRef.current.disconnect(); } catch { /* ignore disconnect errors */ }
            }
            if (gainNodeRef.current) {
                try { gainNodeRef.current.disconnect(); } catch { /* ignore disconnect errors */ }
            }
            
            // Create or reuse audio context
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const audioContext = audioContextRef.current;
            
            // Create source from audio track
            const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
            
            // Create gain node for volume control
            const gainNode = audioContext.createGain();
            gainNode.gain.value = micVolume / 50; // 0-100% mapped to 0-2 gain
            
            // Create destination that outputs to a new MediaStream (NOT speakers)
            const destination = audioContext.createMediaStreamDestination();
            
            // Connect: source -> gain -> destination
            source.connect(gainNode);
            gainNode.connect(destination);
            
            // Store references
            sourceNodeRef.current = source;
            gainNodeRef.current = gainNode;
            
            // Return the processed audio track from destination
            const processedTrack = destination.stream.getAudioTracks()[0];
            
            // Copy enabled state
            if (processedTrack && audioTrack) {
                processedTrack.enabled = audioTrack.enabled;
            }
            
            return processedTrack;
            
        } catch (err) {
            console.error('Failed to apply audio processing:', err);
            return audioTrack; // Fallback to original
        }
    };

    // Handle volume change
    const handleMicVolumeChange = (volume) => {
        setMicVolume(volume);
        
        // Update gain node if it exists
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = volume / 50; // 0-100% mapped to 0-2 gain
        }
    };

    // Handle noise reduction change
    const handleNoiseReductionChange = async (enabled) => {
        setNoiseReduction(enabled);
        
        // Reapply microphone with new constraints
        if (localStreamRef.current && selectedMicrophoneId) {
            try {
                const currentAudioTrack = localStreamRef.current.getAudioTracks()[0];
                const currentEnabled = currentAudioTrack?.enabled;
                
                const constraints = {
                    deviceId: { exact: selectedMicrophoneId },
                    echoCancellation: true,
                    noiseSuppression: enabled,
                    autoGainControl: true
                };
                
                const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints, video: false });
                const newAudioTrack = stream.getAudioTracks()[0];
                
                if (newAudioTrack) {
                    // Apply audio processing
                    const processedAudioTrack = applyAudioProcessing(newAudioTrack);
                    const audioTrackToUse = processedAudioTrack || newAudioTrack;
                    audioTrackToUse.enabled = currentEnabled;
                    
                    if (currentAudioTrack) {
                        currentAudioTrack.stop();
                        localStreamRef.current.removeTrack(currentAudioTrack);
                    }
                    
                    localStreamRef.current.addTrack(audioTrackToUse);
                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                    
                    // Update peers
                    peersRef.current.forEach(peer => {
                        const sender = peer._pc.getSenders().find(s => s.track?.kind === 'audio');
                        if (sender) sender.replaceTrack(audioTrackToUse);
                    });
                }
            } catch (err) {
                console.error('Failed to update noise reduction:', err);
            }
        }
    };

    // Handle spatial audio change
    const handleSpatialAudioChange = (enabled) => {
        setSpatialAudio(enabled);
        
        // Spatial audio typically affects remote audio playback
        // This would require additional audio processing on remote streams
        // For now, we just store the preference
        console.log('Spatial audio:', enabled ? 'enabled' : 'disabled');
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
                    let videoTrack = localStreamRef.current.getVideoTracks()[0];
                    console.log('Restoring camera track:', videoTrack);
                    console.log('Track details:', {
                        id: videoTrack?.id,
                        kind: videoTrack?.kind,
                        label: videoTrack?.label,
                        readyState: videoTrack?.readyState,
                        enabled: videoTrack?.enabled,
                        muted: videoTrack?.muted,
                        constructor: videoTrack?.constructor.name
                    });
                    
                    // Check if it's a dummy canvas track and try to get real camera
                    if (videoTrack && videoTrack.constructor.name === 'CanvasCaptureMediaStreamTrack') {
                        console.warn('⚠️ Current video track is a dummy canvas track, trying to get real camera...');
                        try {
                            const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                            const newVideoTrack = newStream.getVideoTracks()[0];
                            if (newVideoTrack) {
                                console.log('✅ Got real camera track:', newVideoTrack.label);
                                // Replace the dummy track with real one
                                localStreamRef.current.removeTrack(videoTrack);
                                videoTrack.stop();
                                localStreamRef.current.addTrack(newVideoTrack);
                                videoTrack = newVideoTrack;
                                setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                                setIsCameraOn(true);
                            }
                        } catch (err) {
                            console.error('Failed to get real camera:', err);
                        }
                    }
                    
                    // Wait a bit for the stream to be ready before replacing tracks
                    setTimeout(() => {
                        if (videoTrack && videoTrack.readyState === 'live') {
                        // Enable the track if it's disabled
                        videoTrack.enabled = true;
                        
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
                    }, 500);
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
                screenTrack.onended = async () => {
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
                        let videoTrack = localStreamRef.current.getVideoTracks()[0];
                        
                        // Check if it's a dummy canvas track and try to get real camera
                        if (videoTrack && videoTrack.constructor.name === 'CanvasCaptureMediaStreamTrack') {
                            console.warn('⚠️ Dummy canvas track detected in onended, trying to get real camera...');
                            try {
                                const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                                const newVideoTrack = newStream.getVideoTracks()[0];
                                if (newVideoTrack) {
                                    console.log('✅ Got real camera track:', newVideoTrack.label);
                                    localStreamRef.current.removeTrack(videoTrack);
                                    videoTrack.stop();
                                    localStreamRef.current.addTrack(newVideoTrack);
                                    videoTrack = newVideoTrack;
                                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                                    setIsCameraOn(true);
                                }
                            } catch (err) {
                                console.error('Failed to get real camera in onended:', err);
                            }
                        }
                        
                        // Wait a bit for the stream to be ready before replacing tracks
                        setTimeout(() => {
                            if (videoTrack && videoTrack.readyState === 'live') {
                            videoTrack.enabled = true;
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
                        }, 500);
                    }
                };
            } catch (err) {
                console.error('Error sharing screen:', err);
            }
        }
    };

    const sendMessage = (data) => {
        if (socketRef.current) {
            // Support both old string format and new object format
            if (typeof data === 'string') {
                socketRef.current.emit('chat-message', { text: data, type: 'text' });
            } else if (data.text || data.imageData) {
                socketRef.current.emit('chat-message', data);
            }
        }
    };

    const reactToMessage = (messageId, emoji) => {
        if (socketRef.current) {
            socketRef.current.emit('react-to-message', { messageId, emoji });
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

    const deleteMessage = (id) => {
        if (socketRef.current) {
            socketRef.current.emit('delete-message', { id });
        }
    };
    
    const toggleRaiseHand = () => {
        if (socketRef.current) {
            if (isHandRaised) {
                socketRef.current.emit('lower-hand');
                setIsHandRaised(false);
            } else {
                socketRef.current.emit('raise-hand');
                setIsHandRaised(true);
            }
        }
    };
    
    const clearAllHands = () => {
        if (socketRef.current) {
            socketRef.current.emit('clear-all-hands');
        }
    };
    
    const startRecording = async () => {
        try {
            // Create a canvas to render the meeting
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d');
            
            // Create a destination for mixed audio
            const audioContext = new AudioContext();
            const dest = audioContext.createMediaStreamDestination();
            
            // Add local audio
            if (localStreamRef.current) {
                const localAudioTracks = localStreamRef.current.getAudioTracks();
                if (localAudioTracks.length > 0) {
                    try {
                        const source = audioContext.createMediaStreamSource(
                            new MediaStream(localAudioTracks)
                        );
                        source.connect(dest);
                        console.log('Local audio connected to recording');
                    } catch (err) {
                        console.warn('Could not add local audio:', err);
                    }
                }
            }
            
            // Add remote audio streams - remoteStreams is a Map with values { stream, username }
            remoteStreams.forEach(({ stream }) => {
                if (stream && typeof stream.getAudioTracks === 'function') {
                    const audioTracks = stream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        try {
                            const source = audioContext.createMediaStreamSource(
                                new MediaStream(audioTracks)
                            );
                            source.connect(dest);
                            console.log('Remote audio connected to recording');
                        } catch (err) {
                            console.warn('Could not add remote audio:', err);
                        }
                    }
                }
            });
            
            // Get all video elements from the page
            const getVideoElements = () => {
                const videos = [];
                
                // Find all video elements in the video grid
                const videoElements = document.querySelectorAll('.video-grid video, .video-tile video');
                videoElements.forEach(video => {
                    if (video.srcObject && video.readyState >= 2) { // HAVE_CURRENT_DATA
                        videos.push(video);
                    }
                });
                
                return videos;
            };
            
            // Render frame to canvas
            const renderFrame = () => {
                if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
                    return;
                }
                
                // Clear canvas
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const videos = getVideoElements();
                const videoCount = videos.length;
                
                if (videoCount === 0) {
                    // No videos, just show a message
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '48px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Väntar på videoströmmar...', canvas.width / 2, canvas.height / 2);
                } else {
                    // Calculate grid layout
                    let cols, rows;
                    if (videoCount === 1) {
                        cols = 1; rows = 1;
                    } else if (videoCount === 2) {
                        cols = 2; rows = 1;
                    } else if (videoCount <= 4) {
                        cols = 2; rows = 2;
                    } else if (videoCount <= 6) {
                        cols = 3; rows = 2;
                    } else if (videoCount <= 9) {
                        cols = 3; rows = 3;
                    } else {
                        cols = 4; rows = Math.ceil(videoCount / 4);
                    }
                    
                    const cellWidth = canvas.width / cols;
                    const cellHeight = canvas.height / rows;
                    const padding = 10;
                    
                    // Draw each video
                    videos.forEach((video, index) => {
                        const col = index % cols;
                        const row = Math.floor(index / cols);
                        
                        const x = col * cellWidth + padding;
                        const y = row * cellHeight + padding;
                        const w = cellWidth - padding * 2;
                        const h = cellHeight - padding * 2;
                        
                        try {
                            // Calculate aspect ratio to fit video
                            const videoAspect = video.videoWidth / video.videoHeight;
                            const cellAspect = w / h;
                            
                            let drawW = w;
                            let drawH = h;
                            let drawX = x;
                            let drawY = y;
                            
                            if (videoAspect > cellAspect) {
                                drawH = w / videoAspect;
                                drawY = y + (h - drawH) / 2;
                            } else {
                                drawW = h * videoAspect;
                                drawX = x + (w - drawW) / 2;
                            }
                            
                            ctx.drawImage(video, drawX, drawY, drawW, drawH);
                        } catch (err) {
                            // Video not ready, skip
                            console.warn('Could not draw video:', err);
                        }
                    });
                }
                
                requestAnimationFrame(renderFrame);
            };
            
            // Start rendering
            renderFrame();
            
            // Capture canvas stream and combine with audio
            const canvasStream = canvas.captureStream(30); // 30 FPS
            console.log('Canvas stream created:', canvasStream.getVideoTracks().length, 'video tracks');
            
            const recordStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);
            
            console.log('Record stream tracks:', recordStream.getTracks().length);
            
            recordedChunksRef.current = [];
            
            // Try different codecs with fallback
            let mimeType = 'video/webm;codecs=vp9,opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                console.warn('vp9 not supported, trying vp8');
                mimeType = 'video/webm;codecs=vp8,opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    console.warn('vp8 not supported, using default');
                    mimeType = 'video/webm';
                }
            }
            
            console.log('Using mimeType:', mimeType);
            
            const mediaRecorder = new MediaRecorder(recordStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 2500000
            });
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    console.log('Recording chunk received:', event.data.size, 'bytes');
                    recordedChunksRef.current.push(event.data);
                } else {
                    console.warn('Received empty chunk');
                }
            };
            
            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
            };
            
            mediaRecorder.onstop = () => {
                console.log('Recording stopped. Total chunks:', recordedChunksRef.current.length);
                const totalSize = recordedChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
                console.log('Total size:', totalSize, 'bytes');
                
                const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                console.log('Final blob size:', blob.size, 'bytes');
                setRecordedBlob(blob);
                setShowRecordingPreview(true);
            };
            
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            
            console.log('Recording started - capturing meeting with audio from all participants');
            console.log('MediaRecorder state:', mediaRecorder.state);
        } catch (err) {
            console.error('Error starting recording:', err);
            alert('Kunde inte starta inspelning. Se konsolen för mer information.');
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            console.log('Recording stopped');
        }
    };
    
    const saveRecording = () => {
        if (recordedBlob) {
            try {
                const url = URL.createObjectURL(recordedBlob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `meeting-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
                document.body.appendChild(a);
                a.click();
                
                // Clean up after a delay to ensure download starts
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                
                // Close preview
                setShowRecordingPreview(false);
                setRecordedBlob(null);
            } catch (err) {
                console.error('Error saving recording:', err);
                alert('Kunde inte spara inspelningen. Försök igen.');
            }
        }
    };
    
    const discardRecording = () => {
        setRecordedBlob(null);
        setShowRecordingPreview(false);
        recordedChunksRef.current = [];
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
        speakingParticipants, // Track who is speaking
        activeScreenSharer, // Track who is sharing screen
        raisedHands, // Map of socketId -> { order, timestamp, username }
        isHandRaised, // Local hand raised state
        micVolume,
        noiseReduction,
        spatialAudio,
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
        reactToMessage,
        setModerator,
        toggleRaiseHand,
        clearAllHands,
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
    };
}
