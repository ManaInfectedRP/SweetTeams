( AI-Genererade README.md & start_dev.sh )

# 🎥 SweetTeams

En Microsoft Teams-liknande videokonferensapplikation med stöd för 50+ deltagare, skärmdelning, realtidschatt och administratörsverktyg. Tillgänglig som **webbapp**, **PWA (mobil)** och **Windows .exe**.

## ✨ Funktioner

- 🔐 **Användarautentisering** - Registrering och inloggning med JWT
- 🎬 **Videomöten** - WebRTC-baserade videomöten
- 📱 **Multi-plattform** - Webb, PWA (installera på mobil), Windows .exe
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
└── start_dev.sh           # Bash start script
```

## 📝 Användning

### Skapa rum
1. Logga in/registrera
2. Klicka "Skapa nytt rum"
3. Ange ett namn
4. Dela länken eller rumskoden med andra

### Gå med i rum
- **Via dashboard**: Klicka på ett rum i listan
- **Via kod**: Ange rumskoden i "Gå med i Rum"-fältet
- **Via länk**: Öppna delad länk direkt

### I rummet
- 📹 **Kamera on/off** - Slå av/på din kamera
- 🎤 **Mikrofon on/off** - Slå av/på din mikrofon
- 🔄 **Byt kamera** - Växla mellan fram/bakkamera (mobil)
- 🖥️ **Skärmdelning** - Dela din skärm
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
