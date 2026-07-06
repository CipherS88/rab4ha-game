// لوحة تحكم الإدارة — إحصائيات، إدارة اللاعبين، والتحكم بالنظام.
// معزولة تماماً عن محرك اللعبة/النقاط/القيد/البوتات.
const { db, getOrCreatePlayer, savePlayer } = require('./db');
const { getUserById, deviceIdForUser } = require('./auth');
const { getRankInfo } = require('./ranks');
const { publicAvatarForUser } = require('./profileLimits');

// ── حالة النظام (وضع الصيانة) ──────────────────────────────
const systemState = {
  maintenance: false,
  maintenanceMessage: '',
};

function getMaintenance() {
  return {
    enabled: systemState.maintenance,
    message: systemState.maintenanceMessage || '',
  };
}

function setMaintenance(enabled, message = '') {
  systemState.maintenance = !!enabled;
  systemState.maintenanceMessage = String(message || '').slice(0, 300);
  return getMaintenance();
}

function isMaintenanceOn() {
  return systemState.maintenance;
}

// ── إحصائيات النظام ────────────────────────────────────────
function getSystemStats(gameManager) {
  const totals = db.prepare(
    'SELECT COUNT(*) AS players, COALESCE(SUM(coins),0) AS coins, COALESCE(SUM(gems),0) AS gems FROM players',
  ).get();
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const bannedCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_banned = 1').get().n;

  let onlineCount = 0;
  let activeRooms = 0;
  let spectators = 0;
  if (gameManager) {
    onlineCount = gameManager.onlineRegistry ? gameManager.onlineRegistry.size : 0;
    for (const room of gameManager.rooms.values()) {
      if (room.status === 'playing') activeRooms++;
      spectators += room.spectators ? room.spectators.size : 0;
    }
  }

  return {
    online: onlineCount,
    active_rooms: activeRooms,
    spectators,
    total_users: userCount,
    banned_users: bannedCount,
    total_coins: totals.coins || 0,
    total_gems: totals.gems || 0,
  };
}

// ── إدارة اللاعبين ─────────────────────────────────────────
function _userToAdminProfile(user) {
  if (!user) return null;
  const mod = db.prepare(
    'SELECT is_banned, ban_reason FROM users WHERE id = ?',
  ).get(user.id);
  const deviceId = deviceIdForUser(user.id);
  const profile = getOrCreatePlayer(deviceId, user.display_name);
  const info = getRankInfo(profile.rank ?? 0, profile.sub_rank ?? 0);
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    player_code: user.player_code || '',
    role: user.role,
    is_admin: user.role === 'admin',
    is_vip: !!user.is_vip,
    is_famous: !!user.is_famous,
    is_banned: !!mod?.is_banned,
    ban_reason: mod?.ban_reason || '',
    avatar_url: publicAvatarForUser(user),
    coins: profile.coins ?? 0,
    gems: profile.gems ?? 0,
    rank_label: info.fullLabel,
    rank_theme: info.theme,
    wins: profile.wins ?? 0,
    losses: profile.losses ?? 0,
  };
}

function searchUsers(query) {
  const q = String(query || '').trim();
  let rows;
  if (!q) {
    rows = db.prepare('SELECT id FROM users ORDER BY id DESC LIMIT 25').all();
  } else {
    const asId = parseInt(q, 10);
    rows = db.prepare(`
      SELECT id FROM users
      WHERE display_name LIKE ? OR username LIKE ? OR player_code LIKE ? OR id = ?
      ORDER BY id DESC LIMIT 40
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, Number.isFinite(asId) ? asId : -1);
  }
  return rows.map((r) => _userToAdminProfile(getUserById(r.id))).filter(Boolean);
}

function getUserProfileAdmin(userId) {
  const user = getUserById(userId);
  if (!user) return { error: 'المستخدم غير موجود' };
  return { user: _userToAdminProfile(user) };
}

function banUserAccount(userId, reason = '') {
  const user = getUserById(userId);
  if (!user) return { error: 'المستخدم غير موجود' };
  if (user.role === 'admin') return { error: 'لا يمكن حظر حساب أدمن' };
  db.prepare('UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?')
    .run(String(reason || 'حظر بواسطة الإدارة').slice(0, 300), userId);
  db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(userId);
  return { ok: true, user: _userToAdminProfile(getUserById(userId)) };
}

function unbanUserAccount(userId) {
  const user = getUserById(userId);
  if (!user) return { error: 'المستخدم غير موجود' };
  db.prepare('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?').run(userId);
  return { ok: true, user: _userToAdminProfile(getUserById(userId)) };
}

/// تعديل رصيد اللاعب (موجب للإضافة كتعويض، سالب للخصم).
function adjustUserBalance(userId, { coins = 0, gems = 0 } = {}) {
  const user = getUserById(userId);
  if (!user) return { error: 'المستخدم غير موجود' };
  const deviceId = deviceIdForUser(userId);
  const profile = getOrCreatePlayer(deviceId, user.display_name);
  const dCoins = Math.trunc(Number(coins) || 0);
  const dGems = Math.trunc(Number(gems) || 0);
  profile.coins = Math.max(0, (profile.coins ?? 0) + dCoins);
  profile.gems = Math.max(0, (profile.gems ?? 0) + dGems);
  savePlayer(profile);
  return { ok: true, user: _userToAdminProfile(getUserById(userId)) };
}

/// سجل عمليات الهدايا (إرسال إداري + هدايا بين اللاعبين).
function listGiftLog({ limit = 60, adminOnly = false } = {}) {
  const lim = Math.max(1, Math.min(200, parseInt(limit, 10) || 60));
  let rows;
  try {
    if (adminOnly) {
      rows = db.prepare(
        `SELECT * FROM gift_log WHERE is_admin = 1 ORDER BY id DESC LIMIT ?`,
      ).all(lim);
    } else {
      rows = db.prepare(`SELECT * FROM gift_log ORDER BY id DESC LIMIT ?`).all(lim);
    }
  } catch (_) {
    return [];
  }
  const nameFor = (uid) => {
    if (!uid) return null;
    const u = getUserById(uid);
    return u ? (u.display_name || u.username) : `#${uid}`;
  };
  return rows.map((r) => ({
    id: r.id,
    from_user_id: r.from_user_id,
    from_name: r.is_admin ? 'الإدارة' : nameFor(r.from_user_id),
    to_user_id: r.to_user_id,
    to_name: nameFor(r.to_user_id),
    gift_type: r.gift_type,
    amount: r.amount,
    message: r.message,
    is_admin: !!r.is_admin,
    created_at: r.created_at,
  }));
}

module.exports = {
  getMaintenance,
  setMaintenance,
  isMaintenanceOn,
  getSystemStats,
  searchUsers,
  getUserProfileAdmin,
  banUserAccount,
  unbanUserAccount,
  adjustUserBalance,
  listGiftLog,
};
