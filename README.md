( AI-Genererade README.md & start_dev.sh )

# 🎥 SweetTeams

En Microsoft Teams-liknande videokonferensapplikation med stöd för 50+ deltagare, skärmdelning, realtidschatt och administratörsverktyg.

## ✨ Funktioner

- 🔐 **Användarautentisering** - Registrering och inloggning med JWT
- 🎬 **Videomöten** - WebRTC-baserade videomöten
- 🌐 **Nätverksstöd** - Anslut från andra enheter på samma WiFi (HTTPS-stöd)
- 👑 **Admin-verktyg** - Ägaren (⭐) kan stänga av ljud/video för andra eller sparka ut dem
- 🖥️ **Skärmdelning** - Dela din skärm (fungerar även utan webbkamera!)
- 💬 **Realtidschatt** - Chatta med deltagare och se deltagarlista
- 🔗 **Delningsbara länkar** - Enkel knapp för att kopiera länk
- 🎨 **Modern Design** - Mörkt tema med glassmorfism
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
├── client/                # Frontend
│   ├── src/
│   │   ├── components/    # VideoGrid (admin UI), ChatPanel
│   │   ├── pages/         # Room, Dashboard, Login...
│   │   ├── hooks/         # useWebRTC (media logic)
│   │   ├── polyfills.js   # Node compability
│   │   └── main.jsx
│   └── vite.config.js     # Proxy & SSL config
│
├── start_dev.bat          # Windows start script
├── start_dev.sh           # Bash start script
└── README.md
```
