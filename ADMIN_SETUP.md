# Making Users Admin - Guide

## How to Grant Admin Access

Admin access is controlled by the `is_admin` column in the `users` table. Only users with `is_admin = 1` can access the admin panel.

### Method 1: Using SQLite (Development)

If you're running locally with SQLite:

1. **Find your database file**:
   - Location: `server/sweetteams.db`

2. **Open it with SQLite**:
   ```bash
   # Install sqlite3 if not already installed
   # macOS: brew install sqlite
   # Ubuntu: sudo apt-get install sqlite3
   # Windows: Download from sqlite.org

   sqlite3 server/sweetteams.db
   ```

3. **Make a user admin by email**:
   ```sql
   UPDATE users SET is_admin = 1 WHERE email = 'your-email@example.com';
   ```

4. **Or by username**:
   ```sql
   UPDATE users SET is_admin = 1 WHERE username = 'YourUsername';
   ```

5. **Verify the change**:
   ```sql
   SELECT id, username, email, is_admin FROM users WHERE is_admin = 1;
   ```

6. **Exit SQLite**:
   ```sql
   .quit
   ```

### Method 2: Using PostgreSQL (Production on Render)

If you're running on Render with PostgreSQL:

1. **Access your database**:
   - Go to Render Dashboard
   - Click on your PostgreSQL database
   - Click "Connect" → "External Connection"
   - Use the `psql` command provided

2. **Or use Render's built-in shell**:
   - Click "Connect" → "Render Shell"

3. **Make a user admin**:
   ```sql
   UPDATE users SET is_admin = 1 WHERE email = 'your-email@example.com';
   ```

4. **Verify**:
   ```sql
   SELECT id, username, email, is_admin FROM users WHERE is_admin = 1;
   ```

### Method 3: Using a Database GUI Tool

#### For SQLite (DBeaver, DB Browser for SQLite):
1. Open the `server/sweetteams.db` file
2. Navigate to the `users` table
3. Find your user row
4. Change `is_admin` from `0` to `1`
5. Save changes

#### For PostgreSQL (TablePlus, DBeaver, pgAdmin):
1. Connect using the database URL from Render
2. Navigate to the `users` table
3. Find your user row
4. Change `is_admin` from `0` to `1`
5. Save changes

### Method 4: Direct SQL Script

Create a file `make_admin.sql`:

```sql
-- For SQLite
UPDATE users SET is_admin = 1 WHERE email = 'admin@example.com';

-- For PostgreSQL (same syntax)
UPDATE users SET is_admin = 1 WHERE email = 'admin@example.com';
```

Run it:
```bash
# SQLite
sqlite3 server/sweetteams.db < make_admin.sql

# PostgreSQL (get connection string from Render)
psql YOUR_DATABASE_URL < make_admin.sql
```

## Accessing the Admin Panel

Once a user has `is_admin = 1`:

1. **Log out** if already logged in
2. **Log back in** with magic link
3. You'll see a **🛠️ Admin** button in the navigation
4. Click it to access the admin panel

The admin panel provides:
- **Overview**: Database statistics
- **Users**: Manage users, grant/revoke admin access
- **Rooms**: View and delete rooms
- **Database**: View database info and run maintenance

## First Admin User Setup

For initial setup, make yourself admin:

1. **Start the server** (so database is created)
2. **Log in once** with magic link (creates your user)
3. **Make yourself admin** using one of the methods above
4. **Log out and log back in**
5. **Access admin panel**

## Admin Capabilities

Admins can:
- ✅ View all users and rooms
- ✅ Grant/revoke admin privileges to other users
- ✅ Delete users (except themselves)
- ✅ Delete any room
- ✅ View database statistics
- ✅ Run maintenance tasks (cleanup expired magic links)
- ✅ View database type and connection info

## Security Notes

- ⚠️ Admin users have full control over the system
- ⚠️ Only grant admin access to trusted users
- ⚠️ Admins cannot remove their own admin status (prevents lockout)
- ⚠️ Admins cannot delete their own account (prevents lockout)

## Troubleshooting

### "Admin Panel Not Showing"
- Log out and log back in (JWT needs to include isAdmin flag)
- Verify `is_admin = 1` in database
- Check browser console for errors

### "Access Denied" when accessing /admin
- Verify user is logged in
- Check that `is_admin = 1` in database
- Ensure you logged in AFTER setting admin flag

### "Can't Update Admin Status"
- Backend route requires authentication
- Check server logs for errors
- Verify DATABASE_URL is set correctly

## Example: Make First Admin

**Local Development (SQLite)**:
```bash
# Login first to create your account
# Then run:
sqlite3 server/sweetteams.db "UPDATE users SET is_admin = 1 WHERE email = 'your-email@example.com';"

# Verify
sqlite3 server/sweetteams.db "SELECT username, email, is_admin FROM users;"
```

**Production (Render PostgreSQL)**:
```bash
# Get your database URL from Render dashboard
# Then run:
psql YOUR_DATABASE_URL -c "UPDATE users SET is_admin = 1 WHERE email = 'your-email@example.com';"

# Verify
psql YOUR_DATABASE_URL -c "SELECT username, email, is_admin FROM users;"
```

## Admin Panel Features

### Overview Tab
- Total users count
- Total rooms count
- Magic links count
- User preferences count
- Database type indicator

### Users Tab
- List all users with details
- See profile pictures
- Admin badge display
- Grant/revoke admin access
- Delete users

### Rooms Tab
- List all rooms
- See creator and participants
- Copy link codes
- Delete rooms

### Database Tab
- Database type (SQLite/PostgreSQL)
- Database version
- Database size
- Connection info
- Cleanup maintenance tools

---

**Remember**: Always log out and back in after changing admin status for changes to take effect!
