( AI-Genererade README.md & start_dev.sh )

# 🎥 SweetTeams

En Microsoft Teams-liknande videokonferensapplikation med stöd för 50+ deltagare, skärmdelning, realtidschatt och administratörsverktyg. Tillgänglig som **webbapp**, **PWA (mobil)** och **Windows .exe**.

## ✨ Funktioner

- 🔐 **Passwordless Authentication** - Magic links via e-post, ingen registrering behövs!
- 🎬 **Videomöten** - WebRTC-baserade videomöten med stöd för 50+ deltagare
- 📱 **Multi-plattform** - Webb, PWA (installera på mobil), Windows .exe
- 💌 **E-post Magic Links** - SendGrid-integration för säker passwordless inloggning
- 🔢 **Gå med via kod** - Ange rumskod för att direkt hoppa in i möte
- 🎥 **Enhetskontroll** - Välj kamera, mikrofon och högtalare
- 📷 **Kamerabyte** - Byt mellan fram- och bakkamera på mobil
- 📄 **Paginering** - 6 deltagare per sida med swipe-navigation
- 🌐 **Nätverksstöd** - Anslut från andra enheter på samma WiFi (HTTPS-stöd)
- 👑 **Admin-verktyg** - Ägaren (⭐) kan stänga av ljud/video för andra eller sparka ut dem
- 🖥️ **Skärmdelning** - Dela din skärm (fungerar även utan webbkamera!)
- 💬 **Realtidschatt** - Chatta med deltagare och se deltagarlista
- 🔗 **Delningsbara länkar** - Enkel knapp för att kopiera länk
- 🎨 **Modern Design** - Mörkt tema med glassmorfism, responsiv för mobil
- 🗑️ **Auto-cleanup** - Rum raderas automatiskt när sista personen lämnar

## 🛠️ Teknisk Stack

### Backend
- Node.js & Express
- Socket.io (WebRTC signaling)
- SQLite (databas)
- JWT (autentisering)
- SendGrid (passwordless email authentication)

### Frontend
- React 18, Vite
- Socket.io Client
- Simple Peer (WebRTC)
- Vanilla CSS, responsive design
- PWA (Progressive Web App) stöd

### Desktop
- Electron (Windows .exe)
- electron-builder (pakethantering)

## 🚀 Kom igång enkelt

Använd det inkluderade startskriptet för att köra igång både backend och frontend parallellt.

### Windows (PowerShell/CMD)
```batch
start_dev.bat
```

### Bash (Git Bash / WSL)
```bash
./start_dev.sh
```

Detta kommer att:
1. Starta Backend på port 3001
2. Starta Frontend på port 5173 (HTTPS)
3. Logga utskrifter till `server/backend.log` och `client/frontend.log`

---

### Manuell Start

**1. Starta backend-servern**
```bash
cd server
npm start
```
Servern körs på `http://localhost:3001`

**2. Starta frontend-applikationen**
```bash
cd client
npm run dev
```
Applikationen körs på `https://localhost:5173` (och din lokala IP för nätverksåtkomst)

### Nätverksåtkomst
För att ansluta från en annan dator/mobil:
1. Hitta din IP-adress (visas i terminalen när frontend startar, t.ex. `https://192.168.1.156:5173`)
2. Surfa till adressen (acceptera säkerhetsvarningen)
3. Klart!

### 📱 Installera som PWA (Mobil/Desktop)
På **Chrome/Edge** (desktop eller Android):
1. Öppna `https://localhost:5173` (eller din IP)
2. Klicka på ikonen "Installera app" i adressfältet
3. Appen installeras och kan köras som en fristående app

På **iOS Safari**:
1. Öppna appen i Safari
2. Klicka på "Dela" → "Lägg till på hemskärmen"
3. Appen läggs till som en ikon på hemskärmen

### 💻 Bygga Windows .exe (Desktop App)

**Förbered produktionsbygg:**
```bash
# Bygg frontend först
cd client
npm run build

# Bygg Electron-appen till .exe
cd ../desktop
npm run build
```

Installationsfilen skapas i `desktop/dist/SweetTeams Setup 0.1.0.exe`.

**Kör .exe-filen i dev-läge** (utan att bygga):
```bash
# Se till att backend och frontend körs först
./start_dev.sh

# I en ny terminal
cd desktop
npm run start:dev
```

**Obs:** För produktion måste serverns URL konfigureras i Electron-appen att peka mot din produktionsserver istället för localhost.

## 🔧 Kommandon

- **Rensa gamla rum**: `node server/cleanup_rooms.js` (rensar databasen på rum men sparar användare)

## 🏗️ Projektstruktur

```
SweetTeams/
├── server/                 # Backend
│   ├── routes/            # API-routes
│   ├── database.js        # SQLite-databas
│   ├── signaling.js       # Socket.io signaling (admin logic)
│   ├── server.js          # Huvudserver
│   └── cleanup_rooms.js   # Rensningsskript
│
├── client/                # Frontend (React PWA)
│   ├── src/
│   │   ├── components/    # VideoGrid, ChatPanel, Controls
│   │   ├── pages/         # Room, Dashboard, Login
│   │   ├── hooks/         # useWebRTC (media logic)
│   │   ├── polyfills.js   # Node compability
│   │   └── main.jsx
│   ├── public/
│   │   └── manifest.webmanifest  # PWA manifest
│   └── vite.config.js     # Proxy, SSL & PWA config
│
├── desktop/               # Electron Desktop App
│   ├── main.js           # Electron main process
│   ├── package.json      # Build config
│   └── dist/             # Output folder for .exe (after build)
│
├── start_dev.bat          # Windows start script
├── start_dev.sh           # Bash start script
├── render.yaml            # Render.com deployment config
└── DEPLOYMENT.md          # Deployment guide
```

## 🌍 Deployment till Produktion

För att deploya SweetTeams till gratis hosting (Render.com), se våra detaljerade guider:

📚 **Deployment Dokumentation:**

👉 **[DEPLOYMENT.md](DEPLOYMENT.md)** - Komplett steg-för-steg guide
- Render.com setup (gratis tier)
- Frontend + Backend deployment
- Environment variables konfiguration
- CORS och SSL setup
- Felsökning för vanliga problem

👉 **[SENDGRID_SETUP.md](SENDGRID_SETUP.md)** - 5-minuters email setup
- Skapa gratis SendGrid-konto
- API-nyckel konfiguration
- Avsändare-verifiering (Single Sender)
- Render environment variables

👉 **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Snabb checklista
- Pre-deployment checklist
- Environment variables översikt
- Post-deployment tester

👉 **[PASSWORDLESS_AUTH.md](PASSWORDLESS_AUTH.md)** - Teknisk dokumentation
- System arkitektur
- Databas schema
- API endpoints
- Säkerhet och migration

**Vad som ingår:**
- ✅ Gratis hosting på Render.com
- ✅ SendGrid email (100 gratis/dag)
- ✅ SQLite databas
- ✅ Automatisk HTTPS
- ✅ Automatisk redeploy vid git push
- ✅ WebRTC peer-to-peer video

## 🔐 Passwordless Authentication
**magic links** istället för lösenord - enklare och säkrare!

### Hur det fungerar:

**Development (lokal utveckling):**
1. Ange namn + e-post på login-sidan
2. Magic link skrivs ut i **serverns konsol**
3. Kopiera länken och öppna i webbläsaren
4. Du loggas in automatiskt!

**Production (Render.com):**
1. Ange namn + e-post på login-sidan  
2. E-post skickas via **SendGrid** (gratis 100/dag)
3. Kolla din inkorg (och spam-mapp!)
4. Klicka på länken - du loggas in automatiskt!

### Setup för produktion:

**SendGrid konfiguration (5 minuter):**
1. Skapa gratis SendGrid-konto på [sendgrid.com/free](https://sendgrid.com/free)
2. Skapa API-nyckel med "Mail Send" permissions
3. Verifiera din avsändare-email (Single Sender Verification)
4. Lägg till i Render Environment Variables:
   - `EMAIL_API_KEY` = Din SendGrid API-nyckel
   - `EMAIL_FROM` = Din verifierade e-post
   - `EMAIL_FROM_NAME` = "SweetTeams" (valfritt)

👉 **[SENDGRID_SETUP.md](SENDGRID_SETUP.md)** - Detaljerad guide med screenshots  
👉 **[PASSWORDLESS_AUTH.md](PASSWORDLESS_AUTH.md)** - Teknisk dokumentation

**Fördelar:**
- ✅ Inga lösenord att komma ihåg eller hantera
- ✅ Ingen separat registrering behövs
- ✅ Säkrare - magic links utgår efter 15 minuter
- ✅ Enkelt för användare - bara ange e-post!

## 📝 Användarguide

### Logga in (Passwordless)
1. Gå till login-sidan
2. Ange ditt **namn och e-post**
3. Klicka "Skicka inloggningslänk"
4. **Utveckling:** Kolla serverns konsol för länken
5. **Produktion:** Kolla din e-post inkorg (och spam-mapp)
6. Klicka på länken - du loggas in automatiskt!
7. **Kontot skapas automatiskt** vid första inloggningen

### Skapa rum
1. Efter inloggning, klicka "Skapa nytt rum"
2. Ange ett rumsnamn
3. Dela länken eller rumskoden med andra deltagare
4. Dela länken eller rumskoden med andra

### Gå med i rum
- **Via dashboard**: Klicka på ett rum i listan
- **Via kod**: Ange rumskoden i "Gå med i Rum"-fältet
- **Via länk**: Öppna delad länk direkt
**Autentisering:**
- 🔐 Passwordless authentication med magic links
- 🔑 JWT tokens för sessionshantering (7 dagars giltighet)
- ⏱️ Magic links utgår efter 15 minuter
- 🔒 Kryptografiskt säkra tokens (32 bytes random)
- 🚫 Magic links kan endast användas en gång

### Lokal Utveckling

**Problem:** Magic link inte synlig i konsolen
- Kontrollera att `NODE_ENV` INTE är satt till `production`
- Servern måste köras med `npm run dev` eller `npm start`
- Länken visas i terminalen där backend körs

**Problem:** Kan inte ansluta från mobil
- Kontrollera att både dator och mobil är på samma WiFi
- Acceptera säkerhetsvarningen för self-signed certificate
- Använd IP-adressen som visas i terminalen (inte localhost)

**Problem:** Ingen video/ljud
- Ge webbläsaren behörighet till kamera och mikrofon
- Kontrollera att rätt enheter är valda i ⚙️ Inställningar
- Testa i en annan webbläsare (Chrome/Edge rekommenderas)

**Problem:** Electron .exe startar inte
- Se till att frontend är byggd först: `cd client && npm run build`
- För dev-läge: Kör backend och frontend först, sedan `npm run start:dev`

### Produktion (Render.com)

**Problem:** Magic link emails skickas inte
- Kolla Render logs för felmeddelanden
- Besök: `https://your-backend.onrender.com/api/auth/email-config-check`
- Verifiera att `EMAIL_API_KEY`, `EMAIL_FROM`, `CLIENT_URL` är satta
- Kontrollera att avsändaren är verifierad i SendGrid
- Se [DEPLOYMENT.md](DEPLOYMENT.md) felsökningssektion

**Problem:** "SendGrid API-nyckel är ogiltig"
- `EMAIL_FROM` måste matcha din verifierade e-post i SendGrid
- Skapa ny API-nyckel i SendGrid med "Mail Send" permissions
- Uppdatera `EMAIL_API_KEY` i Render Environment Variables

**Problem:** E-post hamnar i spam
- Lägg till `EMAIL_FROM_NAME` i Render Environment
- Överväg Domain Authentication i SendGrid
- Be användare lägga till din e-post i vitlistan

**Problem:** Frontend kan inte ansluta till backend
- Kontrollera att `VITE_API_URL` är korrekt i Render
- Verifiera `CLIENT_URL` i backend Environment Variables
- Gör "Clear build cache & deploy" i Render Dashboard
- ⚙️ **Inställningar** - Välj kamera, mikrofon och högtalare
- 💬 **Chat** - Skicka meddelanden och se deltagare
- ⋮ **Admin-meny** - Hantera deltagare (endast ägare ⭐)

## 🔒 Säkerhet

- Alla användare autentiseras med JWT
- HTTPS används för säker kommunikation
- Endast rumsägaren har admin-behörighet
- WebRTC peer-to-peer för videokommunikation

## 🐛 Felsökning

**Problem:** Kan inte ansluta från mobil
- Kontrollera att både dator och mobil är på samma WiFi
- Acceptera säkerhetsvarningen för self-signed certificate

**Problem:** Ingen video/ljud
- Ge webbläsaren behörighet till kamera och mikrofon
- Kontrollera att rätt enheter är valda i ⚙️ Inställningar

**Problem:** Electron .exe startar inte
- Se till att frontend är byggd först: `cd client && npm run build`
- För dev-läge: Kör backend och frontend först, sedan `npm run start:dev`

## 📄 Licens

Skapad som ett projekt för videokonferens.
├── start_dev.sh           # Bash start script
└── README.md
```
