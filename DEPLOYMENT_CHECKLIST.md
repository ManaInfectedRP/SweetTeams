# 📋 Quick Deployment Checklist

Använd denna checklista innan deployment till Render.com:

## Före Deployment

- [ ] Koden är pushad till GitHub (main branch)
- [ ] `.env` filer finns lokalt (men är INTE i git)
- [ ] `.gitignore` inkluderar `.env` och `.env.local`
- [ ] Alla dependencies är installerade lokalt och testade

## Lokalt Test

```bash
# Testa att bygget fungerar
cd client
npm run build
cd ..

# Testa att servern startar
cd server
npm start
```

## Render.com Setup

### Backend (Web Service)
- [ ] Service skapad: `sweetteams-server`
- [ ] Root Directory: `server`
- [ ] Build Command: `npm install`
- [ ] Start Command: `npm start`
- [ ] Environment Variables satta:
  - [ ] `PORT=10000`
  - [ ] `NODE_ENV=production`
  - [ ] `JWT_SECRET` (generera säker nyckel!)
  - [ ] `CLIENT_URL` (frontend URL)
  - [ ] `DB_PATH=./sweetteams.db`

### Frontend (Static Site)
- [ ] Service skapad: `sweetteams`
- [ ] Root Directory: `client`
- [ ] Build Command: `npm install && npm run build`
- [ ] Publish Directory: `dist`
- [ ] Environment Variables satta:
  - [ ] `VITE_API_URL` (backend URL)

## Efter Deployment

- [ ] Backend service körs utan fel (kolla logs)
- [ ] Frontend site är tillgänglig
- [ ] Backend `CLIENT_URL` uppdaterad med frontend URL
- [ ] Testa registrering av ny användare
- [ ] Testa skapa rum
- [ ] Testa gå med i rum
- [ ] Testa video/audio
- [ ] Testa chat
- [ ] Testa screen sharing

## Common Issues

**Backend 503 Error:**
- Vänta 30-60 sekunder (free tier cold start)
- Kolla logs för errors

**CORS Error:**
- Verifiera `CLIENT_URL` i backend env vars
- Verifiera `VITE_API_URL` i frontend env vars

**Socket.io inte ansluter:**
- Kolla browser console
- Verifiera att JWT-token skickas
- Kolla backend logs

**Database reset:**
- SQLite på free tier kan nollställas vid restart
- Överväg uppgradering eller PostgreSQL för produktion

---

Se [DEPLOYMENT.md](DEPLOYMENT.md) för detaljerad guide!
