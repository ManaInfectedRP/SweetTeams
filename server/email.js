import { config } from 'dotenv';
config();

/**
 * Send magic link email
 * DISABLED - Email sending is disabled. Direct email login is used instead.
 */
export async function sendMagicLinkEmail(email, name, token) {
    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/verify?token=${token}`;
    const displayName = name || 'there';
    
    // Email sending is disabled - always log to console instead
    console.log('\n==============================================');
    console.log('🔐 MAGIC LINK EMAIL (DISABLED - NOT SENT)');
    console.log('==============================================');
    console.log(`Till: ${email}`);
    console.log(`Magic Link: ${magicLink}`);
    console.log('Note: Email sending is disabled. Use direct email login instead.');
    console.log('==============================================\n');
    return { success: true, disabled: true };
}

/**
 * Send room invitation email
 */
export async function sendRoomInviteEmail(email, inviterName, roomName, linkCode, customMessage = '') {
    const roomLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/guest/${linkCode}`;
    
    // Email sending is disabled - always log to console instead
    console.log('\n==============================================');
    console.log('📧 ROOM INVITATION EMAIL (DISABLED - NOT SENT)');
    console.log('==============================================');
    console.log(`Till: ${email}`);
    console.log(`Från: ${inviterName}`);
    console.log(`Möte: ${roomName || 'Videomöte'}`);
    console.log(`Länk: ${roomLink}`);
    if (customMessage) console.log(`Meddelande: ${customMessage}`);
    console.log('Note: Email sending is disabled.');
    console.log('==============================================\n');
    return { success: true, disabled: true };
}
