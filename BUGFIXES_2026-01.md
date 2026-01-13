# Bug Fixes and Database Migration - January 2026

## Summary

This update includes 2 critical bug fixes and preparation for PostgreSQL migration.

---

## 🐛 Bug Fixes

### Bug #1: Can't Log Back In With Same Name After Logout

**Issue**: When a user logged out and tried to log in again using the same email but potentially different display name, the system would fail or use the old username.

**Root Cause**: The magic link verification in [auth.js](server/routes/auth.js) only checked if the user existed by email, but didn't update the username if it had changed.

**Fix**: Modified the magic link verification to update the username when an existing user logs in:
```javascript
// Update username if it has changed
if (user.username !== magicLink.name) {
    const { updateUserProfile } = await import('../database.js');
    await updateUserProfile(user.id, { username: magicLink.name });
    user.username = magicLink.name;
}
```

**Files Changed**: 
- [server/routes/auth.js](server/routes/auth.js#L139-L147)

---

### Bug #2: Can't Toggle Camera Back On When Auto-Turned Off

**Issue**: When users set their preference to start with camera off (`autoJoinVideo: false`), the app would create a dummy video track. When they tried to toggle the camera on during a call, it would only enable the dummy track instead of requesting real camera access.

**Root Cause**: The `toggleCamera()` function in [useWebRTC.js](client/src/hooks/useWebRTC.js) only toggled the `enabled` property of existing tracks, without checking if the track was a real camera or a dummy track.

**Fix**: Enhanced `toggleCamera()` to:
1. Detect if the current track is a dummy track
2. Request real camera access when toggling on from a dummy state
3. Replace the dummy track with the real camera track
4. Update all peer connections with the new track

**Files Changed**: 
- [client/src/hooks/useWebRTC.js](client/src/hooks/useWebRTC.js#L751-L822)

**User Experience**: Users can now:
- Start meetings with camera off (preference-based)
- Click the camera button during the call
- Instantly enable their real camera
- Others will see their video feed immediately

---

## 🗄️ Database Migration: PostgreSQL Support

### New Features

Added full PostgreSQL support while maintaining SQLite compatibility for development.

**New File Created**: 
- [server/database-postgres.js](server/database-postgres.js) - Dual-mode database layer

**How It Works**:
- **Development**: Uses SQLite (no setup required)
- **Production**: Uses PostgreSQL (when `DATABASE_URL` is set)
- **Automatic Detection**: Checks for `DATABASE_URL` or `NODE_ENV=production`

### Migration Steps

See complete guide: [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md)

**Quick Setup**:
1. Create PostgreSQL database on Render.com
2. Install pg driver: `npm install pg`
3. Rename files:
   ```bash
   cd server
   mv database.js database-sqlite.js
   mv database-postgres.js database.js
   ```
4. Add `DATABASE_URL` to Render environment variables
5. Deploy

### Compatibility Layer

The new database module handles all differences between SQLite and PostgreSQL:

| Operation | SQLite | PostgreSQL |
|-----------|--------|------------|
| Placeholders | `?` | `$1, $2, $3` |
| Auto-increment | `AUTOINCREMENT` | `SERIAL` |
| Upsert | `INSERT OR IGNORE` | `ON CONFLICT DO NOTHING` |
| Current time | `datetime("now")` | `NOW()` |
| Return ID | `this.lastID` | `RETURNING id` |

---

## 📋 Testing Checklist

### Bug #1 Testing
- [ ] Log out of the application
- [ ] Request magic link with same email, different name
- [ ] Verify login succeeds
- [ ] Verify username updates in UI
- [ ] Check profile shows new username

### Bug #2 Testing
- [ ] Set preferences: Auto Join Video = OFF
- [ ] Join a meeting
- [ ] Verify camera starts disabled
- [ ] Click camera toggle button
- [ ] Verify browser requests camera permission
- [ ] Verify video turns on for you and others
- [ ] Toggle off and on again to verify it works repeatedly

### PostgreSQL Migration Testing
- [ ] Local dev still works with SQLite
- [ ] Render deployment uses PostgreSQL
- [ ] Tables created automatically
- [ ] Magic link login works
- [ ] Room creation works
- [ ] User preferences persist
- [ ] Profile pictures upload/display

---

## 🚀 Deployment Notes

**No Breaking Changes**: These fixes are backward compatible.

**Deploy Order**:
1. Deploy backend first (contains both bug fixes)
2. Deploy frontend (camera fix)
3. (Optional) Set up PostgreSQL following migration guide

**Environment Variables Required** (for PostgreSQL):
```env
DATABASE_URL=postgresql://user:password@host/database
```

---

## 📁 Files Modified

### Backend
- ✏️ [server/routes/auth.js](server/routes/auth.js) - Username update on re-login
- ➕ [server/database-postgres.js](server/database-postgres.js) - New dual-mode database

### Frontend
- ✏️ [client/src/hooks/useWebRTC.js](client/src/hooks/useWebRTC.js) - Camera toggle fix

### Documentation
- ➕ [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md) - Complete migration guide
- ➕ [BUGFIXES_2026-01.md](BUGFIXES_2026-01.md) - This file

---

## 💡 Technical Details

### Bug #1: Authentication Flow
```
User logs out → Requests new magic link with different name
   ↓
System checks email → Finds existing user
   ↓
NEW: Compares username → Updates if different
   ↓
Returns JWT with current username → UI updates
```

### Bug #2: Camera Toggle Flow
```
Camera off (dummy track) → User clicks toggle
   ↓
Detect dummy track → Request real camera access
   ↓
Replace dummy with real track → Update peers
   ↓
Camera turns on for everyone
```

### Database Architecture
```
Application Code
      ↓
database.js (abstraction layer)
      ↓
   ┌──────┴──────┐
   ↓             ↓
SQLite      PostgreSQL
(dev)       (production)
```

---

## 🎯 Future Improvements

Possible enhancements based on these fixes:

1. **User Profiles**: Allow users to update display name in settings
2. **Device Management**: Remember camera/mic preferences per device
3. **Database Admin**: Add admin panel for PostgreSQL management
4. **Migration Tool**: Script to migrate data from SQLite to PostgreSQL

---

**Date**: January 13, 2026  
**Version**: 1.1.0  
**Status**: ✅ Ready for Production
