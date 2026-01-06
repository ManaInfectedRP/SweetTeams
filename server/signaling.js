import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { deleteRoom } from './database.js';

// Store active rooms and their participants
const rooms = new Map();

export function setupSignaling(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Middleware to authenticate socket connections
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return next(new Error('Authentication error'));
            }
            socket.userId = decoded.id;
            socket.username = decoded.username;
            next();
        });
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.username} (${socket.id})`);

        // Join room
        socket.on('join-room', (roomId) => {
            socket.join(roomId);
            socket.roomId = roomId;

            // Initialize room if it doesn't exist
            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Map());
            }

            const roomParticipants = rooms.get(roomId);
            roomParticipants.set(socket.id, {
                userId: socket.userId,
                username: socket.username,
                socketId: socket.id
            });

            // Notify others in the room
            socket.to(roomId).emit('user-joined', {
                socketId: socket.id,
                userId: socket.userId,
                username: socket.username
            });

            // Send current participants to the new user
            const participants = Array.from(roomParticipants.values());
            socket.emit('room-participants', participants);

            console.log(`${socket.username} joined room ${roomId}`);
        });

        // WebRTC signaling - offer
        socket.on('offer', ({ offer, to }) => {
            socket.to(to).emit('offer', {
                offer,
                from: socket.id,
                username: socket.username
            });
        });

        // WebRTC signaling - answer
        socket.on('answer', ({ answer, to }) => {
            socket.to(to).emit('answer', {
                answer,
                from: socket.id
            });
        });

        // WebRTC signaling - ICE candidate
        socket.on('ice-candidate', ({ candidate, to }) => {
            socket.to(to).emit('ice-candidate', {
                candidate,
                from: socket.id
            });
        });

        // Chat message
        socket.on('chat-message', (message) => {
            if (socket.roomId) {
                io.to(socket.roomId).emit('chat-message', {
                    message,
                    username: socket.username,
                    userId: socket.userId,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Screen sharing started
        socket.on('screen-share-started', () => {
            if (socket.roomId) {
                socket.to(socket.roomId).emit('user-screen-sharing', {
                    socketId: socket.id,
                    username: socket.username
                });
            }
        });

        // Screen sharing stopped
        socket.on('screen-share-stopped', () => {
            if (socket.roomId) {
                socket.to(socket.roomId).emit('user-stopped-screen-sharing', {
                    socketId: socket.id
                });
            }
        });

        // Admin actions (mute, video toggle, kick)
        socket.on('admin-action', ({ targetSocketId, action }) => {
            // In a real app, verify that socket.userId is actually the room owner
            // For now, we trust the client logic (MVP)

            if (action === 'kick') {
                io.to(targetSocketId).emit('kicked');
                // Force disconnect
                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (targetSocket) targetSocket.disconnect();
            } else {
                // Forward action to target (mute-mic, toggle-camera)
                io.to(targetSocketId).emit('admin-command', { action });
            }
        });

        // Handle media state changes (mute/unmute updates)
        socket.on('media-state-change', ({ type, enabled }) => {
            // Broadcast to room so everyone updates their icons
            io.to(socket.roomId).emit('user-media-state-changed', {
                socketId: socket.id,
                type,
                enabled
            });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.username} (${socket.id})`);

            if (socket.roomId && rooms.has(socket.roomId)) {
                const roomParticipants = rooms.get(socket.roomId);
                roomParticipants.delete(socket.id);

                // Notify others
                socket.to(socket.roomId).emit('user-left', {
                    socketId: socket.id,
                    userId: socket.userId,
                    username: socket.username
                });

                // Clean up empty rooms
                if (roomParticipants.size === 0) {
                    rooms.delete(socket.roomId);
                    // Also delete from database
                    deleteRoom(socket.roomId).then(() => {
                        console.log(`Room ${socket.roomId} deleted from database (empty)`);
                    }).catch(err => {
                        console.error(`Error deleting room ${socket.roomId}:`, err);
                    });
                }
            }
        });
    });

    return io;
}
