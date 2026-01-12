import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
        }

        // Generate JWT token
        const jwtToken = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Inloggning lyckades',
            token: jwtToken,
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email 
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
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
