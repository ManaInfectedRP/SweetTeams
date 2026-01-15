import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../database.js';
import { 
    createUser, 
    findUserByEmail, 
    findUserById,
    createMagicLink,
    findMagicLink,
    markMagicLinkAsUsed,
    cleanupExpiredMagicLinks
} from '../database.js';
import { sendMagicLinkEmail } from '../email.js';

const router = express.Router();

// Health check endpoint for email configuration
router.get('/email-config-check', (req, res) => {
    const config = {
        emailApiKey: !!process.env.EMAIL_API_KEY,
        emailFrom: !!process.env.EMAIL_FROM,
        emailFromName: !!process.env.EMAIL_FROM_NAME,
        clientUrl: !!process.env.CLIENT_URL,
        nodeEnv: process.env.NODE_ENV
    };
    
    const missing = [];
    if (!process.env.EMAIL_API_KEY) missing.push('EMAIL_API_KEY');
    if (!process.env.EMAIL_FROM) missing.push('EMAIL_FROM');
    if (!process.env.CLIENT_URL) missing.push('CLIENT_URL');
    
    res.json({
        configured: missing.length === 0,
        config,
        missing: missing.length > 0 ? missing : undefined,
        message: missing.length > 0 
            ? `Missing environment variables: ${missing.join(', ')}` 
            : 'Email configuration looks good!'
    });
});

// Middleware to verify JWT token
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    // Allow dev tokens in development mode
    if (process.env.NODE_ENV === 'development' && token.startsWith('dev-token-')) {
        req.user = {
            id: 999999,
            username: 'SweetTeams-Dev',
            email: 'dev@localhost'
        };
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Request magic link - replaces both login and register
router.post('/request-magic-link', async (req, res) => {
    try {
        const { email, name } = req.body;

        // Validation
        if (!email || !name) {
            return res.status(400).json({ error: 'E-post och namn krävs' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Ogiltig e-postadress' });
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        
        // Set expiration to 15 minutes from now
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        // Create magic link
        await createMagicLink(email, name, token, expiresAt);
        
        // Send email
        await sendMagicLinkEmail(email, name, token);
        
        // Clean up old links
        cleanupExpiredMagicLinks().catch(err => 
            console.error('Error cleaning up expired magic links:', err)
        );

        res.json({ 
            message: 'Magic link skickat! Kolla din e-post.',
            success: true 
        });
    } catch (error) {
        console.error('Magic link request error:', error);
        // Send the actual error message to help with debugging
        res.status(500).json({ 
            error: error.message || 'Kunde inte skicka magic link',
            details: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    }
});

// Verify magic link and create/login user
router.get('/verify-magic-link', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Token krävs' });
        }

        // Find magic link
        const magicLink = await findMagicLink(token);
        
        if (!magicLink) {
            return res.status(401).json({ error: 'Ogiltig eller använd länk' });
        }

        // Check if expired
        const now = new Date();
        const expiresAt = new Date(magicLink.expires_at);
        
        if (now > expiresAt) {
            return res.status(401).json({ error: 'Länken har gått ut. Begär en ny.' });
        }

        // Mark link as used
        await markMagicLinkAsUsed(token);

        // Check if user exists
        let user = await findUserByEmail(magicLink.email);
        
        if (!user) {
            // Create new user
            const result = await createUser(magicLink.name, magicLink.email);
            user = {
                id: result.lastID,
                username: magicLink.name,
                email: magicLink.email
            };
        } else {
            // Update username if it has changed
            if (user.username !== magicLink.name) {
                const { updateUserProfile } = await import('../database.js');
                await updateUserProfile(user.id, { username: magicLink.name });
                user.username = magicLink.name;
            }
        }

        // Generate JWT token
        const jwtToken = jwt.sign(
            { id: user.id, username: user.username, email: user.email, isAdmin: user.is_admin || 0 },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Inloggning lyckades',
            token: jwtToken,
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email,
                isAdmin: user.is_admin || 0
            }
        });
    } catch (error) {
        console.error('Magic link verification error:', error);
        res.status(500).json({ error: 'Verifiering misslyckades' });
    }
});

// Legacy routes kept for backwards compatibility (optional - can be removed)
// Register new user (DEPRECATED - use magic links instead)
router.post('/register', async (req, res) => {
    res.status(410).json({ 
        error: 'Registrering med lösenord stöds inte längre. Använd magic link istället.',
        useEndpoint: '/api/auth/request-magic-link'
    });
});

// Login user (DEPRECATED - use magic links instead)
router.post('/login', async (req, res) => {
    res.status(410).json({ 
        error: 'Inloggning med lösenord stöds inte längre. Använd magic link istället.',
        useEndpoint: '/api/auth/request-magic-link'
    });
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ 
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profilePicture: user.profile_picture,
                isAdmin: user.is_admin || 0,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Middleware to check if user is admin
export function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Create guest token for joining room without account
router.post('/guest-token', async (req, res) => {
    try {
        const { name, linkCode } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (name.trim().length < 2) {
            return res.status(400).json({ error: 'Name must be at least 2 characters' });
        }

        if (!linkCode) {
            return res.status(400).json({ error: 'Link code is required' });
        }

        const guestId = `guest_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        // Create a guest token (valid for 24 hours)
        const guestToken = jwt.sign(
            {
                id: guestId,
                username: name.trim(),
                isGuest: true,
                linkCode: linkCode
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Store guest session in database for admin tracking
        const usePostgres = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
        
        try {
            if (usePostgres) {
                await db.pool.query(
                    'INSERT INTO guest_sessions (id, guest_name, link_code, expires_at) VALUES ($1, $2, $3, $4)',
                    [guestId, name.trim(), linkCode, expiresAt]
                );
            } else {
                await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO guest_sessions (id, guest_name, link_code, expires_at) VALUES (?, ?, ?, ?)',
                        [guestId, name.trim(), linkCode, expiresAt.toISOString()],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        } catch (dbError) {
            console.error('Error storing guest session:', dbError);
            // Continue anyway - don't fail guest join if tracking fails
        }

        res.json({
            token: guestToken,
            user: {
                id: guestId,
                username: name.trim(),
                isGuest: true
            }
        });
    } catch (error) {
        console.error('Guest token error:', error);
        res.status(500).json({ error: 'Server error creating guest session' });
    }
});

export default router;
