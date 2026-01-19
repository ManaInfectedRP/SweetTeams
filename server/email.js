import { config } from 'dotenv';
config();

/**
 * Send magic link email
 * In development, logs to console. In production, uses SendGrid.
 */
export async function sendMagicLinkEmail(email, name, token) {
    const magicLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/verify?token=${token}`;
    const displayName = name || 'there';
    
    // For development - log to console
    if (process.env.NODE_ENV !== 'production') {
        console.log('\n==============================================');
        console.log('🔐 MAGIC LINK EMAIL');
        console.log('==============================================');
        console.log(`Till: ${email}`);
        console.log(`Magic Link: ${magicLink}`);
        console.log('==============================================\n');
        return { success: true, dev: true };
    }
    
    // For production - SendGrid implementation
    try {
        // Validate environment variables
        if (!process.env.EMAIL_API_KEY) {
            throw new Error('EMAIL_API_KEY environment variable is not set');
        }
        if (!process.env.EMAIL_FROM) {
            throw new Error('EMAIL_FROM environment variable is not set');
        }
        
        const sgMail = await import('@sendgrid/mail');
        sgMail.default.setApiKey(process.env.EMAIL_API_KEY);
        
        const msg = {
            to: email,
            from: {
                email: process.env.EMAIL_FROM,
                name: process.env.EMAIL_FROM_NAME || 'SweetTeams'
            },
            replyTo: process.env.EMAIL_FROM,
            subject: 'Logga in på SweetTeams 🎥',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .header .emoji { font-size: 48px; margin-bottom: 10px; }
                        .content { padding: 40px 30px; }
                        .content h2 { color: #1f2937; margin-top: 0; }
                        .content p { color: #4b5563; line-height: 1.6; font-size: 16px; }
                        .button { display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                        .footer { padding: 20px 30px; background: #f9fafb; color: #6b7280; font-size: 14px; text-align: center; }
                        .divider { border-top: 1px solid #e5e7eb; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="emoji">🎥</div>
                            <h1>SweetTeams</h1>
                        </div>
                        <div class="content">
                            <h2>Hej! 👋</h2>
                            <p>Du har begärt en inloggningslänk till ditt SweetTeams-konto. Klicka på knappen nedan för att logga in:</p>
                            <div style="text-align: center;">
                                <a href="${magicLink}" class="button">Logga in på SweetTeams</a>
                            </div>
                            <div class="divider"></div>
                            <p style="font-size: 14px; color: #6b7280;">
                                <strong>Denna länk är giltig i 15 minuter.</strong><br>
                                Om du inte begärde denna inloggning kan du ignorera detta meddelande.
                            </p>
                            <p style="font-size: 13px; color: #9ca3af; margin-top: 20px;">
                                Om knappen inte fungerar, kopiera och klistra in denna länk i din webbläsare:<br>
                                <a href="${magicLink}" style="color: #667eea; word-break: break-all;">${magicLink}</a>
                            </p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} SweetTeams. Alla rättigheter förbehållna.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Hej!\n\nKlicka på länken nedan för att logga in på SweetTeams:\n\n${magicLink}\n\nDenna länk är giltig i 15 minuter.\n\nOm du inte begärde denna inloggning kan du ignorera detta meddelande.`
        };
        
        await sgMail.default.send(msg);
        console.log(`✅ Magic link email sent to ${email}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        
        // More detailed error messages for debugging
        if (error.code === 401 || error.code === 403) {
            console.error('SendGrid authentication failed. Check EMAIL_API_KEY.');
            throw new Error('SendGrid API-nyckel är ogiltig. Kontrollera EMAIL_API_KEY i miljövariabler.');
        } else if (error.response?.body?.errors) {
            const errorDetails = error.response.body.errors.map(e => e.message).join(', ');
            console.error('SendGrid errors:', errorDetails);
            throw new Error(`SendGrid-fel: ${errorDetails}`);
        } else if (!process.env.EMAIL_API_KEY) {
            throw new Error('EMAIL_API_KEY saknas i miljövariabler.');
        } else if (!process.env.EMAIL_FROM) {
            throw new Error('EMAIL_FROM saknas i miljövariabler.');
        }
        
        throw new Error(`Kunde inte skicka e-post: ${error.message || 'Okänt fel'}`);
    }
}

/**
 * Send room invitation email
 */
export async function sendRoomInviteEmail(email, inviterName, roomName, linkCode, customMessage = '') {
    const roomLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/guest/${linkCode}`;
    
    // For development - log to console
    if (process.env.NODE_ENV !== 'production') {
        console.log('\n==============================================');
        console.log('📧 ROOM INVITATION EMAIL');
        console.log('==============================================');
        console.log(`Till: ${email}`);
        console.log(`Från: ${inviterName}`);
        console.log(`Möte: ${roomName || 'Videomöte'}`);
        console.log(`Länk: ${roomLink}`);
        if (customMessage) console.log(`Meddelande: ${customMessage}`);
        console.log('==============================================\n');
        return { success: true, dev: true };
    }
    
    // For production - SendGrid implementation
    try {
        if (!process.env.EMAIL_API_KEY) {
            throw new Error('EMAIL_API_KEY environment variable is not set');
        }
        if (!process.env.EMAIL_FROM) {
            throw new Error('EMAIL_FROM environment variable is not set');
        }
        
        const sgMail = await import('@sendgrid/mail');
        sgMail.default.setApiKey(process.env.EMAIL_API_KEY);
        
        const msg = {
            to: email,
            from: {
                email: process.env.EMAIL_FROM,
                name: process.env.EMAIL_FROM_NAME || 'SweetTeams'
            },
            replyTo: process.env.EMAIL_FROM,
            subject: `${inviterName} har bjudit in dig till ett möte på SweetTeams 🎥`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .header .emoji { font-size: 48px; margin-bottom: 10px; }
                        .content { padding: 40px 30px; }
                        .content h2 { color: #1f2937; margin-top: 0; }
                        .content p { color: #4b5563; line-height: 1.6; font-size: 16px; }
                        .room-info { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                        .room-info strong { color: #667eea; }
                        .custom-message { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; font-style: italic; }
                        .button { display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
                        .footer { padding: 20px 30px; background: #f9fafb; color: #6b7280; font-size: 14px; text-align: center; }
                        .divider { border-top: 1px solid #e5e7eb; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="emoji">🎥</div>
                            <h1>SweetTeams</h1>
                        </div>
                        <div class="content">
                            <h2>Du har blivit inbjuden! 🎉</h2>
                            <p><strong>${inviterName}</strong> har bjudit in dig till ett videomöte på SweetTeams.</p>
                            
                            ${roomName ? `
                            <div class="room-info">
                                <strong>Möte:</strong> ${roomName}
                            </div>
                            ` : ''}
                            
                            ${customMessage ? `
                            <div class="custom-message">
                                💬 "${customMessage}"
                            </div>
                            ` : ''}
                            
                            <p>Klicka på knappen nedan för att gå med i mötet. Du kommer att kunna ange ditt namn innan du ansluter.</p>
                            
                            <div style="text-align: center;">
                                <a href="${roomLink}" class="button">Gå med i mötet</a>
                            </div>
                            
                            <div class="divider"></div>
                            
                            <p style="font-size: 13px; color: #9ca3af; margin-top: 20px;">
                                Om knappen inte fungerar, kopiera och klistra in denna länk i din webbläsare:<br>
                                <a href="${roomLink}" style="color: #667eea; word-break: break-all;">${roomLink}</a>
                            </p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} SweetTeams. Alla rättigheter förbehållna.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `${inviterName} har bjudit in dig till ett videomöte på SweetTeams!\n\n${roomName ? `Möte: ${roomName}\n\n` : ''}${customMessage ? `Meddelande: "${customMessage}"\n\n` : ''}Klicka på länken nedan för att gå med:\n\n${roomLink}\n\nDu kommer att kunna ange ditt namn innan du ansluter.`
        };
        
        await sgMail.default.send(msg);
        console.log(`✅ Room invitation email sent to ${email}`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending invitation email:', error);
        throw new Error(error.message || 'Failed to send invitation email');
    }
}
