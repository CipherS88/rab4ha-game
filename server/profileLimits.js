const { db, getOrCreatePlayer, savePlayer } = require('./db');
const { saveUploadedImage } = require('./uploads');

function deviceIdForUser(userId) {
  return `user_${userId}`;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NAME_LIMIT = 1;
const AVATAR_LIMIT = 2;

function initProfileLimitsSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_profile_change_user_type
      ON profile_change_log (user_id, change_type, changed_at);
  `);
  try { db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''`); } catch (_) {}
}

function countChangesInWindow(userId, changeType) {
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  return db.prepare(`
    SELECT COUNT(*) AS c FROM profile_change_log
    WHERE user_id = ? AND change_type = ? AND changed_at > ?
  `).get(userId, changeType, since).c;
}

function getProfileChangeLimits(userId, { isAdmin = false } = {}) {
  if (isAdmin) {
    return {
      name_changes_left: NAME_LIMIT,
      avatar_changes_left: AVATAR_LIMIT,
      name_limit_per_week: NAME_LIMIT,
      avatar_limit_per_week: AVATAR_LIMIT,
      unlimited: true,
    };
  }
  const nameUsed = countChangesInWindow(userId, 'name');
  const avatarUsed = countChangesInWindow(userId, 'avatar');
  return {
    name_changes_left: Math.max(0, NAME_LIMIT - nameUsed),
    avatar_changes_left: Math.max(0, AVATAR_LIMIT - avatarUsed),
    name_limit_per_week: NAME_LIMIT,
    avatar_limit_per_week: AVATAR_LIMIT,
    unlimited: false,
  };
}

function logProfileChange(userId, changeType) {
  db.prepare('INSERT INTO profile_change_log (user_id, change_type) VALUES (?, ?)').run(userId, changeType);
}

function isAvatarRemoved(user) {
  return user.avatar_removed_until && new Date(user.avatar_removed_until) > new Date();
}

function getFullUser(userId) {
  return db.prepare(`
    SELECT id, username, role, is_vip, display_name, email, phone_sa,
           avatar_url, avatar_removed_until
    FROM users WHERE id = ?
  `).get(userId);
}

function syncPlayerDisplayName(userId, displayName) {
  const deviceId = deviceIdForUser(userId);
  const profile = getOrCreatePlayer(deviceId, displayName);
  profile.name = displayName;
  savePlayer(profile);
  return profile;
}

function updateDisplayName(user, displayName) {
  const name = (displayName || '').trim();
  if (!name) return { error: 'الاسم مطلوب' };
  if (name.length > 20) return { error: 'الاسم طويل جداً (20 حرف كحد أقصى)' };

  const full = getFullUser(user.id);
  if (!full) return { error: 'المستخدم غير موجود' };
  if (full.display_name === name) {
    return { ok: true, user: full, skipped: true };
  }

  if (user.role !== 'admin' && countChangesInWindow(user.id, 'name') >= NAME_LIMIT) {
    return { error: 'يمكنك تغيير الاسم مرة واحدة فقط كل أسبوع' };
  }

  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, user.id);
  if (user.role !== 'admin') logProfileChange(user.id, 'name');
  const profile = syncPlayerDisplayName(user.id, name);
  const updated = getFullUser(user.id);
  return { ok: true, user: updated, profile };
}

function updateAvatarImage(user, dataUrl) {
  const full = getFullUser(user.id);
  if (!full) return { error: 'المستخدم غير موجود' };
  if (isAvatarRemoved(full)) {
    return { error: 'صورة العرض محذوفة بسبب مخالفة — لا يمكن تغييرها حالياً' };
  }

  if (user.role !== 'admin' && countChangesInWindow(user.id, 'avatar') >= AVATAR_LIMIT) {
    return { error: 'يمكنك تغيير صورة العرض مرتين فقط كل أسبوع' };
  }

  const saved = saveUploadedImage(dataUrl, 'avatars');
  if (saved.error) return { error: saved.error };

  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(saved.url, user.id);
  if (user.role !== 'admin') logProfileChange(user.id, 'avatar');
  const updated = getFullUser(user.id);
  const profile = syncPlayerDisplayName(user.id, updated.display_name);
  return { ok: true, user: updated, profile, avatar_url: saved.url };
}

function publicAvatarForUser(userRow) {
  if (!userRow) return '';
  if (isAvatarRemoved(userRow)) return '';
  return userRow.avatar_url || '';
}

module.exports = {
  initProfileLimitsSchema,
  getProfileChangeLimits,
  updateDisplayName,
  updateAvatarImage,
  publicAvatarForUser,
  isAvatarRemoved,
  getFullUser,
};
