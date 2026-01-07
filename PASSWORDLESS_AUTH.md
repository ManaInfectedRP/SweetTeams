# Passwordless Authentication - Migration Guide

## Översikt

SweetTeams använder nu ett passwordless email-autentiseringssystem med "magic links". Användare behöver inte längre skapa lösenord eller registrera sig separat.

## Hur det fungerar

1. **Användaren anger e-post och namn** på inloggningssidan
2. **Ett e-postmeddelande skickas** med en unik länk
3. **Klickar på länken** skapar automatiskt ett konto (om det inte finns) och loggar in användaren
4. **Ingen registrering eller lösenord behövs**

## Ändringar i systemet

### Backend

#### Nya tabeller
- `magic_links` - lagrar temporära inloggningslänkar med:
  - email, namn, token, utgångsdatum
  - Länkar är giltiga i 15 minuter
  - Automatisk städning av gamla/använda länkar

#### Nya API endpoints
- `POST /api/auth/request-magic-link` - begär en magic link
  ```json
  {
    "email": "user@example.com",
    "name": "Användarnamn"
  }
  ```

- `GET /api/auth/verify-magic-link?token=xxx` - verifierar och loggar in

#### Borttagna endpoints
- `POST /api/auth/register` - returnerar nu 410 Gone
- `POST /api/auth/login` - returnerar nu 410 Gone

### Frontend

#### Nya komponenter
- `VerifyMagicLink.jsx` - hanterar verifiering av magic links

#### Uppdaterade komponenter
- `Login.jsx` - nu en enkel form med namn och e-post
- `AuthContext.jsx` - nya metoder: `requestMagicLink()`, `verifyMagicLink()`
- `App.jsx` - route för `/auth/verify` tillagd, `/register` borttagen

#### Borttagna sidor
- `Register.jsx` - inte längre nödvändig

### Databas

#### Uppdaterad schema
```sql
-- Användare behöver inte längre password_hash (kan vara null/tom)
-- Ny tabell för magic links
CREATE TABLE magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used INTEGER DEFAULT 0
);
```

## Utvecklingsmiljö

I utvecklingsläge skrivs magic links ut i serverns konsol istället för att skickas via e-post.

```bash
==============================================
🔐 MAGIC LINK EMAIL
==============================================
Till: user@example.com
Namn: John Doe
Magic Link: http://localhost:5173/auth/verify?token=abc123...
==============================================
```

## Produktionsmiljö

För produktion behöver du konfigurera en e-posttjänst i `server/email.js`:

### Exempel med SendGrid

```javascript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.EMAIL_API_KEY);

export async function sendMagicLinkEmail(email, name, token) {
    const magicLink = `${process.env.CLIENT_URL}/auth/verify?token=${token}`;
    
    const msg = {
        to: email,
        from: process.env.EMAIL_FROM,
        subject: 'Logga in på SweetTeams',
        html: `
            <h2>Hej ${name}!</h2>
            <p>Klicka på länken nedan för att logga in:</p>
            <a href="${magicLink}">Logga in på SweetTeams</a>
            <p>Länken är giltig i 15 minuter.</p>
        `
    };
    
    await sgMail.send(msg);
}
```

### Miljövariabler

Lägg till i `.env`:
```env
CLIENT_URL=https://yourapp.com
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@yourapp.com
```

## Installation och testning

1. **Uppdatera beroenden** (inga nya behövs)
   ```bash
   cd server
   npm install
   ```

2. **Uppdatera miljövariabler**
   ```bash
   cp .env.example .env
   # Redigera .env och ange CLIENT_URL
   ```

3. **Starta servern**
   ```bash
   npm run dev
   ```

4. **Starta klienten**
   ```bash
   cd client
   npm run dev
   ```

5. **Testa inloggning**
   - Gå till http://localhost:5173/login
   - Ange namn och e-post
   - Kolla serverns konsol för magic link
   - Kopiera länken och öppna i webbläsaren

## Migration av befintliga användare

Befintliga användare med lösenord kan fortfarande existera i databasen men kommer att använda magic links för inloggning framöver. `password_hash`-fältet ignoreras nu helt.

## Säkerhet

- Magic links är giltiga i endast 15 minuter
- Tokens är kryptografiskt säkra (32 bytes random)
- Länkar kan endast användas en gång
- Automatisk städning av gamla länkar
- JWT tokens för sessioner (7 dagar)

## Framtida förbättringar

- [ ] Rate limiting på magic link requests
- [ ] Blockering av misstänkta IP-adresser
- [ ] Email template system
- [ ] Multi-faktor autentisering (optional)
- [ ] Social login (Google, GitHub, etc.)
