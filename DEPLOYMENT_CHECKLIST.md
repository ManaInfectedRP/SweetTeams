# 📋 Quick Deployment Checklist

Använd denna checklista innan deployment till Render.com:

## Före Deployment

- [x] Koden är pushad till GitHub (main branch)
- [x] `.env` filer finns lokalt (men är INTE i git)
- [x] `.gitignore` inkluderar `.env` och `.env.local`
- [x] Alla dependencies är installerade lokalt och testade

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
- [x] Service skapad: `sweetteams-server`
- [x] Root Directory: `server`
- [x] Build Command: `npm install`
- [x] Start Command: `npm start`
- [x] Environment Variables satta:
  - [x] `PORT=10000`
  - [x] `NODE_ENV=production`
  - [x] `JWT_SECRET` (generera säker nyckel!)
  - [x] `CLIENT_URL` (frontend URL)
  - [x] `DB_PATH=./sweetteams.db`
  - [ ] **`EMAIL_SERVICE=sendgrid`**
  - [ ] **`EMAIL_API_KEY` (från SendGrid)**
  - [ ] **`EMAIL_FROM` (verifierad avsändare)**
  - [ ] **`EMAIL_FROM_NAME=SweetTeams`**

### SendGrid Setup (Krävs för magic links!)
- [ ] SendGrid-konto skapat på [sendgrid.com/free](https://sendgrid.com/free/)
- [ ] API-nyckel genererad med "Mail Send" permissions
- [ ] Single Sender Verification genomförd
- [ ] E-postadress verifierad i SendGrid
- [ ] API-nyckel tillagd i Render environment variables

### Frontend (Static Site)
- [x] Service skapad: `sweetteams`
- [x] Root Directory: `client`
- [x] Build Command: `npm install && npm run build`
- [x] Publish Directory: `dist`
- [x] Environment Variables satta:
  - [x] `VITE_API_URL` (backend URL)

## Efter Deployment

- [x] Backend service körs utan fel (kolla logs)
- [x] Frontend site är tillgänglig
- [x] Backend `CLIENT_URL` uppdaterad med frontend URL
- [ ] **SendGrid e-post fungerar (testa magic link)**
- [ ] **Mottaget magic link e-post i inkorg**
- [ ] **Magic link loggar in korrekt**
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
- Magic link e-post kommer inte fram:**
- Kontrollera att `EMAIL_API_KEY` är korrekt satt
- Kolla spam/skräppost-mappen
- Verifiera att avsändaren är verifierad i SendGrid
- Kolla backend logs för email errors
- Test SendGrid API key i SendGrid Dashboard → Settings → API Keys

**"Email service not configured" error:**
- Kontrollera att alla EMAIL_* environment variables är satta
- Verifiera att `NODE_ENV=production` är satt
- Redeploya backend efter att ha lagt till env vars

**Verifiera `VITE_API_URL` i frontend env vars

**Socket.io inte ansluter:**
- Kolla browser console
- Verifiera att JWT-token skickas
- Kolla backend logs

**Database reset:**
- SQLite på free tier kan nollställas vid restart
- Överväg uppgradering eller PostgreSQL för produktion

---

Se [DEPLOYMENT.md](DEPLOYMENT.md) för detaljerad guide!
