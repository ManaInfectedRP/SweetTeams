# 📧 SendGrid Setup Guide för SweetTeams

Snabbguide för att konfigurera e-post för passwordless authentication.

## Varför SendGrid?

SweetTeams använder **passwordless authentication** med magic links som skickas via e-post. SendGrid är gratis för upp till 100 e-post/dag, perfekt för små projekt på Render.com.

---

## 🚀 Snabbstart (5 minuter)

### Steg 1: Skapa SendGrid-konto
1. Gå till: https://sendgrid.com/free/
2. Klicka **"Start for free"**
3. Fyll i dina uppgifter och skapa konto
4. Verifiera din e-postadress

### Steg 2: Skapa API-nyckel
1. Logga in på [SendGrid Dashboard](https://app.sendgrid.com/)
2. Gå till **Settings** → **API Keys** (från vänster-menyn)
3. Klicka **"Create API Key"** (blå knapp uppe till höger)
4. Fyll i:
   - **API Key Name:** `SweetTeams-Render`
   - **API Key Permissions:** Välj **"Full Access"** (eller minst "Mail Send")
5. Klicka **"Create & View"**
6. **⚠️ VIKTIGT:** Kopiera API-nyckeln NU - du kan inte se den igen!
   - Den börjar med `SG.`
   - Spara den säkert (t.ex. i en lösenordshanterare)

### Steg 3: Verifiera avsändare
SendGrid kräver att du verifierar din e-postadress innan du kan skicka e-post.

1. I SendGrid Dashboard, gå till **Settings** → **Sender Authentication**
2. Under "Single Sender Verification", klicka **"Get Started"** (eller "Verify Single Sender")
3. Klicka **"Create New Sender"**
4. Fyll i formuläret:
   - **From Name:** `SweetTeams`
   - **From Email Address:** Din e-postadress (t.ex. `you@gmail.com`)
   - **Reply To:** Samma som From Email
   - Fyll i övriga fält (adress kan vara fiktiv)
5. Klicka **"Create"**
6. **Kolla din inkorg** - SendGrid skickar ett verifieringsmail
7. Klicka på länken i e-postmeddelandet för att verifiera

### Steg 4: Lägg till i Render.com

Nu ska vi lägga till dessa värden i Render:

1. Gå till [Render Dashboard](https://dashboard.render.com/)
2. Välj din **sweetteams-server** service
3. Gå till **Environment** (från vänster-menyn)
4. Lägg till dessa environment variables (eller uppdatera om de redan finns):

| Key | Value | Exempel |
|-----|-------|---------|
| `EMAIL_SERVICE` | `sendgrid` | `sendgrid` |
| `EMAIL_API_KEY` | Din SendGrid API-nyckel | `SG.xxxxxxxxxxxxxxxx...` |
| `EMAIL_FROM` | E-postadressen du verifierade | `you@gmail.com` |
| `EMAIL_FROM_NAME` | `SweetTeams` | `SweetTeams` |

5. Klicka **"Save Changes"**
6. Render kommer automatiskt att redeploya servern

---

## ✅ Testa att det fungerar

1. Vänta tills backend har redeployat (1-2 minuter)
2. Gå till din SweetTeams frontend: `https://sweetteams.onrender.com/login`
3. Ange ditt namn och e-postadress
4. Klicka "Skicka inloggningslänk"
5. **Kolla din inkorg!** (kontrollera även spam/skräppost)
6. Första e-postmeddelandet kan ta 1-2 minuter
7. Klicka på länken i e-postmeddelandet - du bör loggas in automatiskt

---

## 🔧 Felsökning

### Får inte e-post?

**1. Kolla backend logs i Render:**
- Gå till Render Dashboard → sweetteams-server → Logs
- Leta efter fel som "Error sending email" eller "SendGrid"

**2. Vanliga fel:**

**"Unauthorized":**
- API-nyckeln är felaktig eller inte satt
- Kontrollera `EMAIL_API_KEY` i environment variables
- Skapa en ny API-nyckel om nödvändigt

**"The from address does not match a verified Sender Identity":**
- E-postadressen i `EMAIL_FROM` är inte verifierad i SendGrid
- Gå till SendGrid → Settings → Sender Authentication
- Verifiera avsändaren

**"Email service not configured for production":**
- `NODE_ENV` är inte satt till `production`
- Lägg till `NODE_ENV=production` i environment variables

**3. Testa SendGrid API direkt:**

I Render → sweetteams-server → Shell, kör:
```bash
curl -X "POST" "https://api.sendgrid.com/v3/mail/send" \
  -H "Authorization: Bearer $EMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{"to": [{"email": "your@email.com"}]}],
    "from": {"email": "'$EMAIL_FROM'"},
    "subject": "Test från SweetTeams",
    "content": [{"type": "text/plain", "value": "Om du får detta e-post fungerar SendGrid!"}]
  }'
```

Om detta fungerar men magic links inte kommer, kontrollera backend-koden.

### E-post hamnar i spam?

Det är normalt för nya SendGrid-konton. Lösningar:

1. **Domain Authentication** (rekommenderas för produktion):
   - SendGrid → Settings → Sender Authentication → Domain Authentication
   - Kräver egen domän och DNS-inställningar

2. **Tillfällig lösning:**
   - Markera e-posten som "Not Spam" i din inkorg
   - Lägg till avsändaren i dina kontakter

### Vill använda custom domain?

Om du har en egen domän (t.ex. `sweetteams.com`):

1. Konfigurera Domain Authentication i SendGrid
2. Lägg till DNS-poster (CNAME) hos din domänleverantör
3. Uppdatera `EMAIL_FROM` till `noreply@sweetteams.com`
4. Detta förbättrar e-postleverans och minskar spam-risk

---

## 📊 SendGrid Free Tier Limits

- **100 e-post/dag** gratis
- Det räcker för ~3000 användare/månad med 1 inloggning/dag
- Om du behöver mer, uppgradera till SendGrid's betalplan

---

## 🔐 Säkerhet

**Skydda din API-nyckel:**
- Lägg ALDRIG API-nyckeln i git/kod
- Använd endast environment variables
- Om nyckeln läcker, generera en ny omedelbart i SendGrid

**Best practices:**
- Använd "Restricted Access" istället för "Full Access"
- Ge endast "Mail Send" permission
- Rotera API-nycklar regelbundet (varannan månad)

---

## 📚 Användbara länkar

- [SendGrid Dashboard](https://app.sendgrid.com/)
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid API Reference](https://docs.sendgrid.com/api-reference/mail-send/mail-send)
- [Verify Sender Identity](https://docs.sendgrid.com/ui/sending-email/sender-verification)

---

## 🎉 Klart!

Nu fungerar passwordless authentication med e-post! Användare kan logga in genom att:
1. Ange namn och e-post
2. Få en magic link via e-post
3. Klicka på länken och loggas in automatiskt

Ingen registrering eller lösenord behövs! 🚀
