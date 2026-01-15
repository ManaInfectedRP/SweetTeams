import express from 'express';
import { authenticateToken } from './auth.js';
import { createRoom, findRoomByLinkCode, findRoomsByCreator, addRoomParticipant, findUserById } from '../database.js';
import { sendRoomInviteEmail } from '../email.js';
import crypto from 'crypto';

const router = express.Router();

// Generate unique room link code
function generateLinkCode() {
    return crypto.randomBytes(6).toString('hex');
}

// Create new room
router.post('/', authenticateToken, async (req, res) => {
    try {
        // Guests cannot create rooms
        if (req.user.isGuest) {
            return res.status(403).json({ error: 'Guests cannot create rooms' });
        }
        
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

        // Add user as participant if not already (but skip for guests)
        if (!req.user.isGuest) {
            await addRoomParticipant(room.id, req.user.id);
        }

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
        // Guests don't have rooms
        if (req.user.isGuest) {
            return res.json({ rooms: [] });
        }
        
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

// Guest check room (no auth required)
router.get('/guest-check/:linkCode', async (req, res) => {
    try {
        const { linkCode } = req.params;
        const room = await findRoomByLinkCode(linkCode);

        if (!room) {
            return res.status(404).json({ error: 'Rummet kunde inte hittas' });
        }

        // Get creator info
        const creator = await findUserById(room.creator_id);

        res.json({
            name: room.name,
            creatorName: creator?.username || 'Okänd',
            linkCode: room.link_code
        });
    } catch (error) {
        console.error('Guest check room error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Send room invitations via email
router.post('/invite', authenticateToken, async (req, res) => {
    try {
        // Guests cannot send invitations
        if (req.user.isGuest) {
            return res.status(403).json({ error: 'Guests cannot send invitations' });
        }
        
        const { linkCode, emails, message } = req.body;

        if (!linkCode || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'Link code and emails are required' });
        }

        // Verify room exists and user has access
        const room = await findRoomByLinkCode(linkCode);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Get sender info
        const sender = await findUserById(req.user.id);
        const senderName = sender?.username || 'En användare';

        // Send email to each recipient
        const results = await Promise.allSettled(
            emails.map(email => 
                sendRoomInviteEmail(email, senderName, room.name, linkCode, message)
            )
        );

        // Check if any succeeded
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        if (succeeded === 0) {
            return res.status(500).json({ error: 'Kunde inte skicka några inbjudningar' });
        }

        res.json({
            message: `${succeeded} inbjudningar skickade${failed > 0 ? `, ${failed} misslyckades` : ''}`,
            succeeded,
            failed
        });
    } catch (error) {
        console.error('Send invitations error:', error);
        res.status(500).json({ error: 'Server error sending invitations' });
    }
});

export default router;
