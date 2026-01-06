# 🚀 Deployment Guide - SweetTeams

Guide för att deploya SweetTeams till gratis hosting på **Render.com**

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
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`

### 3.3 Environment Variables för Frontend

Under **"Advanced"**, lägg till:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://sweetteams-server.onrender.com` (använd din backend-URL från steg 2.4) |

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
2. Registrera ett nytt konto
3. Skapa ett rum
4. Testa videochatt-funktionaliteten

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

### Frontend kan inte ansluta till backend:
- Kontrollera att `VITE_API_URL` är korrekt i frontend environment variables
- Kontrollera att `CLIENT_URL` är korrekt i backend environment variables
- Kontrollera CORS-inställningar i server logs

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
