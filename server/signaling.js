import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { deleteRoom, findRoomByLinkCode } from './database.js';

// Store active rooms and their participants
const rooms = new Map();
// Store moderators per room: roomId -> Set of userIds
const roomModerators = new Map();
// Store active screen sharer per room: roomId -> { socketId, username }
const roomScreenSharers = new Map();

export function setupSignaling(httpServer) {
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
    
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.NODE_ENV === 'production' ? CLIENT_URL : '*',
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
                socketId: socket.id,
                role: 'participant' // Will be updated below
            });

            // Notify others in the room
            socket.to(roomId).emit('user-joined', {
                socketId: socket.id,
                userId: socket.userId,
                username: socket.username
            });

            // Send current participants to the new user
            // Get room info to determine admin
            findRoomByLinkCode(roomId).then(room => {
                const adminId = room?.creator_id;
                const moderators = roomModerators.get(roomId) || new Set();
                
                // Set role for this user
                const participant = roomParticipants.get(socket.id);
                if (socket.userId === adminId) {
                    participant.role = 'admin';
                } else if (moderators.has(socket.userId)) {
                    participant.role = 'moderator';
                }
                
                // Send participants with roles
                const participants = Array.from(roomParticipants.values());
                socket.emit('room-participants', participants);
                
                // Notify others about role update
                socket.to(roomId).emit('user-role-updated', {
                    socketId: socket.id,
                    role: participant.role
                });
            });

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
                const payload = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    message,
                    username: socket.username,
                    userId: socket.userId,
                    timestamp: new Date().toISOString()
                };
                io.to(socket.roomId).emit('chat-message', payload);
            }
        });

        // Delete chat message (admin or moderator only)
        socket.on('delete-message', async ({ id }) => {
            if (!socket.roomId) return;
            const room = await findRoomByLinkCode(socket.roomId);
            const isAdmin = socket.userId === room?.creator_id;
            const moderators = roomModerators.get(socket.roomId) || new Set();
            const isModerator = moderators.has(socket.userId);
            if (!isAdmin && !isModerator) return;
            io.to(socket.roomId).emit('message-deleted', { id, deletedBy: socket.userId });
        });

        // Screen sharing started
        socket.on('screen-share-started', () => {
            if (socket.roomId) {
                // Check if someone is already sharing
                const currentSharer = roomScreenSharers.get(socket.roomId);
                if (currentSharer && currentSharer.socketId !== socket.id) {
                    // Someone else is already sharing, reject
                    socket.emit('screen-share-rejected', {
                        reason: 'already-sharing',
                        sharerUsername: currentSharer.username
                    });
                    return;
                }
                
                // Set this user as the active sharer
                roomScreenSharers.set(socket.roomId, {
                    socketId: socket.id,
                    username: socket.username
                });
                
                // Notify everyone including sender
                io.to(socket.roomId).emit('user-screen-sharing', {
                    socketId: socket.id,
                    username: socket.username
                });
            }
        });

        // Screen sharing stopped
        socket.on('screen-share-stopped', () => {
            if (socket.roomId) {
                // Clear the active sharer
                const currentSharer = roomScreenSharers.get(socket.roomId);
                if (currentSharer && currentSharer.socketId === socket.id) {
                    roomScreenSharers.delete(socket.roomId);
                }
                
                // Notify everyone
                io.to(socket.roomId).emit('user-stopped-screen-sharing', {
                    socketId: socket.id
                });
            }
        });

        // Admin actions (mute, video toggle, kick)
        socket.on('admin-action', async ({ targetSocketId, action }) => {
            if (!socket.roomId) return;
            
            // Verify permissions
            const room = await findRoomByLinkCode(socket.roomId);
            const isAdmin = socket.userId === room?.creator_id;
            const moderators = roomModerators.get(socket.roomId) || new Set();
            const isModerator = moderators.has(socket.userId);
            
            if (!isAdmin && !isModerator) {
                return; // No permission
            }
            
            // Moderators can only mute-mic and kick, not toggle-camera
            if (isModerator && !isAdmin && action === 'toggle-camera') {
                return; // Moderators can't control cameras
            }

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

        // Promote/demote moderator (admin only)
        socket.on('set-moderator', async ({ targetUserId, isModerator }) => {
            if (!socket.roomId) return;
            const room = await findRoomByLinkCode(socket.roomId);
            const isAdmin = socket.userId === room?.creator_id;
            if (!isAdmin) return; // Only admin can set moderators

            if (!roomModerators.has(socket.roomId)) {
                roomModerators.set(socket.roomId, new Set());
            }
            const moderators = roomModerators.get(socket.roomId);
            if (isModerator) {
                moderators.add(targetUserId);
            } else {
                moderators.delete(targetUserId);
            }

            // Update role for the target user and notify room
            const roomParticipants = rooms.get(socket.roomId);
            if (roomParticipants) {
                roomParticipants.forEach(p => {
                    if (p.userId === targetUserId) {
                        p.role = isModerator ? 'moderator' : 'participant';
                        io.to(socket.roomId).emit('user-role-updated', {
                            socketId: p.socketId,
                            role: p.role
                        });
                    }
                });
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
                
                // Clear screen sharer if this user was sharing
                const currentSharer = roomScreenSharers.get(socket.roomId);
                if (currentSharer && currentSharer.socketId === socket.id) {
                    roomScreenSharers.delete(socket.roomId);
                    // Notify others that screen sharing stopped
                    socket.to(socket.roomId).emit('user-stopped-screen-sharing', {
                        socketId: socket.id
                    });
                }

                // Notify others
                socket.to(socket.roomId).emit('user-left', {
                    socketId: socket.id,
                    userId: socket.userId,
                    username: socket.username
                });

                // Clean up empty rooms
                if (roomParticipants.size === 0) {
                    rooms.delete(socket.roomId);
                    roomModerators.delete(socket.roomId);
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
