import express from 'express';
import { authenticateToken } from './auth.js';
import { createRoom, findRoomByLinkCode, findRoomsByCreator, addRoomParticipant } from '../database.js';
import crypto from 'crypto';

const router = express.Router();

// Generate unique room link code
function generateLinkCode() {
    return crypto.randomBytes(6).toString('hex');
}

// Create new room
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Room name is required' });
        }

        // Generate unique link code
        let linkCode;
        let attempts = 0;
        while (attempts < 10) {
            linkCode = generateLinkCode();
            const existing = await findRoomByLinkCode(linkCode);
            if (!existing) break;
            attempts++;
        }

        if (attempts === 10) {
            return res.status(500).json({ error: 'Failed to generate unique room code' });
        }

        // Create room
        const result = await createRoom(name.trim(), req.user.id, linkCode);
        const roomId = result.lastID;

        // Add creator as participant
        await addRoomParticipant(roomId, req.user.id);

        res.status(201).json({
            message: 'Room created successfully',
            room: {
                id: roomId,
                name: name.trim(),
                linkCode,
                creatorId: req.user.id
            }
        });
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Server error creating room' });
    }
});

// Get room by link code
router.get('/:linkCode', authenticateToken, async (req, res) => {
    try {
        const { linkCode } = req.params;
        const room = await findRoomByLinkCode(linkCode);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Add user as participant if not already
        await addRoomParticipant(room.id, req.user.id);

        // Convert snake_case to camelCase for frontend
        const formattedRoom = {
            id: room.id,
            name: room.name,
            linkCode: room.link_code,
            creatorId: room.creator_id,
            created_at: room.created_at
        };

        res.json({ room: formattedRoom });
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({ error: 'Server error fetching room' });
    }
});

// Get user's rooms
router.get('/', authenticateToken, async (req, res) => {
    try {
        const rooms = await findRoomsByCreator(req.user.id);
        // Convert snake_case to camelCase for frontend
        const formattedRooms = rooms.map(room => ({
            id: room.id,
            name: room.name,
            linkCode: room.link_code,
            creatorId: room.creator_id,
            created_at: room.created_at
        }));
        res.json({ rooms: formattedRooms });
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Server error fetching rooms' });
    }
});

export default router;
