# 🚀 Deployment Guide - SweetTeams

Guide för att deploya SweetTeams till gratis hosting på **Render.com**

---

## 🆘 Snabb Felsökning

**Frontend får 404 på `/api/` endpoints?**
→ `VITE_API_URL` är inte satt eller är fel
→ Gå till Render → sweetteams → Environment → Lägg till `VITE_API_URL=https://sweetteams-server.onrender.com`
→ Gör **Manual Deploy → Clear build cache & deploy**

**Backend returnerar CORS errors?**
→ `CLIENT_URL` är inte satt eller är fel
→ Gå till Render → sweetteams-server → Environment → Lägg till `CLIENT_URL=https://sweetteams.onrender.com`

---

## 📋 Förutsättningar

- Ett GitHub-konto
- Ett Render.com-konto (gratis)
- Din kod pushad till ett GitHub repository

## 🔧 Steg 1: Förbered ditt projekt

### 1.1 Skapa environment-filer lokalt (om de inte finns)

Skapa `.env` i root-mappen baserat på `.env.example`:
```bash
PORT=3001
NODE_ENV=production
JWT_SECRET=din-hemliga-nyckel-ändra-detta
CLIENT_URL=https://sweetteams.onrender.com
DB_PATH=./sweetteams.db
```

Skapa `client/.env` baserat på `client/.env.example`:
```bash
VITE_API_URL=https://sweetteams-server.onrender.com
```

**OBS:** Lägg INTE till dessa .env-filer i git! De är redan i `.gitignore`.

### 1.2 Push till GitHub

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

## 🌐 Steg 2: Deploya Backend på Render

### 2.1 Skapa ny Web Service

1. Gå till [Render Dashboard](https://dashboard.render.com/)
2. Klicka på **"New +"** → **"Web Service"**
3. Anslut ditt GitHub repository
4. Välj ditt **SweetTeams** repository

### 2.2 Konfigurera Backend Service

Fyll i följande inställningar:

- **Name:** `sweetteams-server`
- **Region:** Europe (Frankfurt) eller närmaste region
- **Branch:** `main`
- **Root Directory:** `server`
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** `Free`

### 2.3 Environment Variables

Klicka på **"Advanced"** och lägg till följande environment variables:

| Key | Value |
|-----|-------|
| `PORT` | `10000` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | [Generera en säker slumpmässig sträng](https://www.random.org/strings/?num=1&len=64&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new) |
| `CLIENT_URL` | (Lämna tom tills vidare, vi uppdaterar detta senare) |
| `DB_PATH` | `./sweetteams.db` |
| `EMAIL_SERVICE` | `sendgrid` |
| `EMAIL_API_KEY` | (Se Steg 2.3.1 nedan) |
| `EMAIL_FROM` | `noreply@sweetteams.onrender.com` (eller din egen domän) |
| `EMAIL_FROM_NAME` | `SweetTeams` |

#### 2.3.1 Konfigurera SendGrid för E-post (VIKTIGT för Magic Links!)

SweetTeams använder passwordless authentication med "magic links" som skickas via e-post. För att detta ska fungera i produktion behöver du konfigurera SendGrid:

**Steg 1: Skapa SendGrid-konto (Gratis)**
1. Gå till [SendGrid.com](https://sendgrid.com/free/)
2. Registrera ett gratis konto (100 emails/dag gratis)
3. Verifiera din e-postadress

**Steg 2: Skapa API-nyckel**
1. Logga in på SendGrid Dashboard
2. Gå till **Settings** → **API Keys**
3. Klicka **Create API Key**
4. Namn: `SweetTeams-Render`
5. Permissions: **Full Access** (eller minst "Mail Send")
6. Klicka **Create & View**
7. **KOPIERA API-NYCKELN** (du kan inte se den igen!)

**Steg 3: Lägg till i Render Environment Variables**
1. Gå tillbaka till Render Dashboard → din backend service
2. Under Environment Variables, uppdatera `EMAIL_API_KEY` med din SendGrid API-nyckel
3. Klicka **Save Changes**

**Steg 4: Verifiera avsändare (Single Sender Verification)**
1. I SendGrid Dashboard, gå till **Settings** → **Sender Authentication**
2. Klicka **Get Started** under "Single Sender Verification"
3. Fyll i dina uppgifter (använd samma e-post som i `EMAIL_FROM`)
4. Verifiera e-postadressen genom att klicka på länken i e-postmeddelandet

**OBS:** För produktion med custom domain rekommenderas "Domain Authentication" istället för Single Sender Verification.

**Viktig anmärkning om databasen:** 
- SQLite-databasen kommer att lagras på Render's filsystem
- På Render's free tier kan disken nollställas vid omstart
- För långsiktig lagring, överväg att uppgradera till betalplan eller använda en extern databas

4. Klicka på **"Create Web Service"**

### 2.4 Vänta på deploy

Render kommer nu att:
- Klona ditt repository
- Installera dependencies
- Starta servern

Kopiera backend-URL:en när den är klar, t.ex.: `https://sweetteams-server.onrender.com`

## 🎨 Steg 3: Deploya Frontend på Render

### 3.1 Skapa Static Site

1. Gå tillbaka till Render Dashboard
2. Klicka på **"New +"** → **"Static Site"**
3. Välj samma GitHub repository

### 3.2 Konfigurera Frontend

Fyll i:

- **Name:** `sweetteams`
- **Branch:** `main`
- **Root Directory:** `client`
- **Build Command:** `npm install && VITE_API_URL=https://sweetteams-server.onrender.com npm run build` **(Ändra URL:en till din backend-URL!)**
- **Publish Directory:** `dist`

### 3.3 Environment Variables för Frontend

**⚠️ VIKTIGT för Static Sites:** 
Render Static Sites läser inte alltid `.env` filer korrekt. Istället har vi redan satt `VITE_API_URL` direkt i build-kommandot ovan.

Om du behöver ändra backend-URL:en senare:
1. Gå till **Settings** → **Build & Deploy**
2. Uppdatera **Build Command** med ny URL
3. **Spara** och trigga en **Manual Deploy → Clear build cache & deploy**

~~Du kan också lägga till under "Advanced":~~
~~`VITE_API_URL` = `https://sweetteams-server.onrender.com`~~ (Fungerar inte alltid på static sites)

4. Klicka på **"Create Static Site"**

Kopiera frontend-URL:en när den är klar, t.ex.: `https://sweetteams.onrender.com`

## 🔄 Steg 4: Uppdatera Backend Environment Variables

Nu när vi har frontend-URL:en:

1. Gå till din backend service i Render Dashboard
2. Gå till **"Environment"**
3. Uppdatera `CLIENT_URL` till din frontend-URL: `https://sweetteams.onrender.com`
4. Klicka **"Save Changes"** - Render kommer automatiskt att redeploya

## ✅ Steg 5: Testa din deployment

1. Öppna din frontend-URL: `https://sweetteams.onrender.com`
2. **Testa passwordless login:**
   - Gå till login-sidan
   - Ange ditt namn och e-post
   - Kolla din inkorg för magic link e-post
   - Klicka på länken för att logga in
3. Skapa ett rum
4. Testa videochatt-funktionaliteten

**Första magic link tar längre tid:**
- SendGrid kan ta 1-2 minuter för första e-postmeddelandet
- Kontrollera även spam/skräppost-mappen
- Om du inte får e-post efter 5 min, kolla backend logs i Render Dashboard

## 🔧 Alternativ: Använda render.yaml (Infrastruktur som kod)

Istället för att manuellt konfigurera via UI, kan du använda `render.yaml` filen som redan finns i projektet:

1. I Render Dashboard, gå till **"New +"** → **"Blueprint"**
2. Anslut ditt repository
3. Render kommer automatiskt att upptäcka `render.yaml`
4. Konfigurera environment variables när promptad
5. Klicka **"Apply"**

Detta kommer att skapa båda services automatiskt!

## 📱 Viktigt att veta

### Free Tier-begränsningar:

- **Backend:** Servern går i viloläge efter 15 min inaktivitet. Första requesten kan ta 30-60 sekunder att "väcka" den
- **Databas:** SQLite-filer kan försvinna vid service-restart. För produktion, överväg PostgreSQL
- **Bandbredd:** Begränsad bandbredd per månad (100 GB på free tier)

### WebRTC-anteckningar:

- WebRTC peer-to-peer-anslutningar sker direkt mellan användare
- Servern används endast för signaling (koordinering av anslutningar)
- Video-/ljuddata går INTE genom servern

## 🚨 Felsökning

### Backend startar inte:
- Kontrollera loggar i Render Dashboard
- Verifiera att alla environment variables är korrekt satta

### Magic Link emails skickas inte:
**Kontrollera Render logs för specifika felmeddelanden:**

1. **"EMAIL_API_KEY environment variable is not set"**
   - Gå till Render Dashboard → backend service → Environment
   - Lägg till `EMAIL_API_KEY` med din SendGrid API-nyckel
   - Spara och vänta på redeploy

2. **"SendGrid authentication failed" eller 401/403 error**
   - Din SendGrid API-nyckel är ogiltig eller har gått ut
   - Gå till SendGrid Dashboard → Settings → API Keys
   - Skapa en ny API-nyckel med "Mail Send" permissions
   - Uppdatera `EMAIL_API_KEY` i Render

3. **"EMAIL_FROM saknas i miljövariabler"**
   - Lägg till `EMAIL_FROM` i Render Environment Variables
   - Exempel: `noreply@yourdomain.com`
   - Denna e-post måste vara verifierad i SendGrid (se Steg 4 under SendGrid-konfiguration)

4. **"Sender address not verified"**
   - Gå till SendGrid → Settings → Sender Authentication
   - Slutför "Single Sender Verification" för din `EMAIL_FROM` adress
   - Kolla din inkorg och klicka på verifieringslänken

5. **E-post hamnar i spam**
   - Lägg till `EMAIL_FROM_NAME` i Environment Variables (t.ex. "SweetTeams")
   - Överväg Domain Authentication i SendGrid för bättre leverans
   - Be användare att lägga till din e-post i vitlistan

**Test magic link i produktion:**
```bash
# Kolla backend logs i Render Dashboard
# Du bör se: "✅ Magic link email sent to user@example.com"
```

### Frontend kan inte ansluta till backend:
- **Kontrollera att `VITE_API_URL` är korrekt i frontend environment variables**
- **Gå till Render Dashboard → sweetteams → Environment → Verifiera `VITE_API_URL`**
- **Om du ändrat den, gör Manual Deploy → Clear build cache & deploy**
- Kontrollera att `CLIENT_URL` är korrekt i backend environment variables
- Kontrollera CORS-inställningar i server logs
- Öppna browser DevTools → Network → Kolla vilken URL API-anropen går till

### WebRTC-anslutningar fungerar inte:
- Kontrollera att Socket.io ansluter korrekt (använd browser DevTools → Network → WS)
- Verifiera att JWT-token skickas korrekt
- Kolla browser console för fel

## 🔄 Uppdatera deployment

Varje gång du pushar till GitHub main branch:
- Render upptäcker automatiskt ändringarna
- Både frontend och backend redeploys automatiskt

## 💡 Nästa steg

För bättre prestanda och stabilitet, överväg:

1. **Uppgradera till betald plan** för:
   - Ingen viloläge för backend
   - Persistent disk för databas
   - Mer bandbredd

2. **Byt till PostgreSQL:**
   - Render erbjuder gratis PostgreSQL (90 dagar)
   - Mer robust än SQLite för produktion

3. **Lägg till custom domain:**
   - Render stödjer custom domains gratis

4. **Monitorering:**
   - Aktivera health checks
   - Sätt upp notifications för downtime

---

## 📚 Användbara länkar

- [Render Documentation](https://render.com/docs)
- [Render Discord Community](https://discord.gg/render)
- [Socket.io på Render](https://render.com/docs/deploy-socketio)

Lycka till med din deployment! 🎉
