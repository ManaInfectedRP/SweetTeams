import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';

export function useWebRTC(roomId, token, username) {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [screenStream, setScreenStream] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);

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

        const getMediaStream = async () => {
            try {
                return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
            }

            const socket = io({
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
                    return [...prev, { socketId, userId, username: peerUsername }];
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
            setRemoteStreams(prev => new Map(prev).set(socketId, { stream, username: peerUsername }));
        });

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

    const toggleScreenShare = async () => {
        // (Simplified for brevity - Screen sharing logic handled as before)
        // Note: Screen sharing usually implies Video ON for others, handling that state is bonus
        // We keep the logic from previous steps
        if (isScreenSharing) {
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
                setScreenStream(null);
                setIsScreenSharing(false);
                socketRef.current.emit('screen-share-stopped');
                if (localStreamRef.current) {
                    const videoTrack = localStreamRef.current.getVideoTracks()[0];
                    peersRef.current.forEach(peer => {
                        const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                        if (sender) sender.replaceTrack(videoTrack);
                    });
                }
            }
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = stream;
                setScreenStream(stream);
                setIsScreenSharing(true);
                socketRef.current.emit('screen-share-started');
                const screenTrack = stream.getVideoTracks()[0];
                peersRef.current.forEach(peer => {
                    const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });
                screenTrack.onended = () => toggleScreenShare();
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

    // Helper to get state
    const getParticipantState = (socketId) => {
        return participantStates.get(socketId) || { audio: true, video: true };
    };

    return {
        localStream,
        remoteStreams,
        screenStream,
        isCameraOn,
        isMicOn,
        isScreenSharing,
        participants,
        messages,
        participantStates, // New export
        toggleCamera,
        toggleMic,
        toggleScreenShare,
        sendMessage,
        sendAdminCommand
    };
}
