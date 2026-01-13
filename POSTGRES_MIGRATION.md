# PostgreSQL Migration Guide for Render.com

This guide will help you migrate your SweetTeams application from SQLite to PostgreSQL on Render.com.

## Step 1: Create PostgreSQL Database on Render

1. **Log into Render.com**
   - Go to https://render.com and sign in

2. **Create New PostgreSQL Database**
   - Click the "New +" button in the dashboard
   - Select "PostgreSQL"
   - Fill in the details:
     - **Name**: `sweetteams-db` (or your preferred name)
     - **Database**: Leave default or customize
     - **User**: Leave default
     - **Region**: Choose the same region as your web service
     - **PostgreSQL Version**: Latest (16 or higher recommended)
     - **Plan**: Choose Free or Paid tier

3. **Create the Database**
   - Click "Create Database"
   - Wait for provisioning (takes 1-2 minutes)

4. **Copy Connection Details**
   - Once created, you'll see connection details
   - **IMPORTANT**: Copy the "Internal Database URL"
   - It looks like: `postgresql://user:password@hostname/database`

## Step 2: Install PostgreSQL Driver

In your local development environment:

```bash
cd server
npm install pg
```

**Optional**: If you want to completely remove SQLite:
```bash
npm uninstall sqlite3
```

## Step 3: Update Your Code

You have two options:

### Option A: Use the New Dual-Mode Database File (Recommended)

This approach uses SQLite for development and PostgreSQL for production automatically.

1. **Rename the old database file**:
   ```bash
   # In the server directory
   mv database.js database-sqlite.js
   mv database-postgres.js database.js
   ```

2. **That's it!** The new `database.js` will automatically:
   - Use SQLite when `NODE_ENV !== 'production'` or no `DATABASE_URL` is set
   - Use PostgreSQL when `DATABASE_URL` is set (in production)

### Option B: Replace Completely

If you only want PostgreSQL:

1. Delete `server/database.js`
2. Rename `server/database-postgres.js` to `server/database.js`
3. Remove SQLite dependency: `npm uninstall sqlite3`

## Step 4: Configure Environment Variables

### On Render.com (Production)

1. Go to your web service dashboard on Render
2. Navigate to "Environment" tab
3. Add the following environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL you copied in Step 1
   - Format: `postgresql://user:password@hostname/database`

4. Click "Save Changes"
5. Render will automatically redeploy your service

### Local Development (.env file)

For local testing with PostgreSQL (optional):

```env
# Add to server/.env
DATABASE_URL=postgresql://localhost/sweetteams_dev
NODE_ENV=development
```

**Note**: If you don't set `DATABASE_URL` locally, it will use SQLite automatically (which is fine for development).

## Step 5: Deploy and Verify

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add PostgreSQL support for production"
   git push
   ```

2. **Wait for deployment** on Render (auto-deploys from Git)

3. **Verify the migration**:
   - Check Render logs: Should see "🐘 Using PostgreSQL database"
   - Try logging in with magic link
   - Create a room and test functionality

## Database Differences Handled

The new database layer automatically handles these differences:

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Placeholders | `?` | `$1, $2, $3` |
| Auto Increment | `AUTOINCREMENT` | `SERIAL` |
| Ignore Conflicts | `INSERT OR IGNORE` | `ON CONFLICT DO NOTHING` |
| Datetime | `datetime("now")` | `NOW()` |
| Last Insert ID | `this.lastID` | `RETURNING id` |

## Troubleshooting

### Error: "role does not exist"
- Make sure you copied the **Internal Database URL** from Render, not the external one

### Error: "SSL required"
- The code automatically handles SSL for Render databases (rejectUnauthorized: false)

### Tables not created
- Check Render logs for initialization errors
- The tables are created automatically on first connection
- Look for "✅ PostgreSQL tables initialized"

### Still seeing SQLite in logs
- Make sure `DATABASE_URL` environment variable is set in Render
- Check that it starts with `postgresql://`
- Redeploy the service after setting env vars

## Migration Checklist

- [ ] PostgreSQL database created on Render
- [ ] Internal Database URL copied
- [ ] `pg` npm package installed
- [ ] Database code updated (Option A or B)
- [ ] `DATABASE_URL` added to Render environment variables
- [ ] Code committed and pushed to repository
- [ ] Deployment successful on Render
- [ ] Logs show "🐘 Using PostgreSQL database"
- [ ] Magic link login tested
- [ ] Room creation tested
- [ ] User preferences working

## Benefits of PostgreSQL

✅ **Better concurrency** - Multiple users can access simultaneously  
✅ **Production-ready** - Industry standard for web applications  
✅ **Better performance** - Faster queries with indexing  
✅ **ACID compliance** - Data integrity guarantees  
✅ **Cloud-native** - Works seamlessly on Render  

## Keeping SQLite for Development

The dual-mode approach (Option A) is recommended because:
- No need for local PostgreSQL installation
- Faster local development
- Same database engine in production as users will experience
- Easy testing without cloud dependencies

You can override locally by setting `DATABASE_URL` in your `.env` file if you want to test with PostgreSQL.
