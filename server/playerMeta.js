const { getRankInfo } = require('./ranks');
const { db, getOrCreatePlayer } = require('./db');
const { getUserById } = require('./auth');
const { publicAvatarForUser } = require('./profileLimits');
const { getEquippedCardDeck } = require('./bag');

function userHasVip(user) {
  if (!user) return false;
  if (user.is_vip) return true;
  if (user.vip_expires_at && new Date(user.vip_expires_at) > new Date()) return true;
  return false;
}

function normalizeUserId(userId) {
  if (userId == null || userId === '') return null;
  const s = String(userId);
  if (s.startsWith('user_')) return parseInt(s.slice(5), 10) || null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function getSeatMeta(userId) {
  const uid = normalizeUserId(userId);
  if (!uid) return null;
  const user = getUserById(uid);
  if (!user) return null;
  const deck = getEquippedCardDeck(uid);
  let star = null;
  if (user.role === 'admin') star = 'admin';
  else if (user.is_famous) star = 'famous';
  else if (userHasVip(user)) star = 'vip';
  let rankLabel = '';
  let rankTheme = 'wood';
  try {
    const profile = getOrCreatePlayer(`user_${uid}`);
    const info = getRankInfo(profile.rank ?? 0, profile.sub_rank ?? 0);
    rankLabel = info.fullLabel;
    rankTheme = info.theme;
  } catch (_) {}
  return {
    user_id: uid,
    avatar_url: publicAvatarForUser(user),
    deck_back_url: deck.back_url,
    deck_asset_key: deck.asset_key,
    deck_glow_color: deck.glow_color,
    star,
    is_admin: user.role === 'admin',
    is_vip: userHasVip(user),
    is_famous: !!user.is_famous,
    rank_label: rankLabel,
    rankLabel,
    rank_theme: rankTheme,
    rankTheme,
  };
}

function listUsersAdmin() {
  return db.prepare(`
    SELECT id, username, display_name, role, is_vip, is_famous, email, phone_sa,
           equipped_deck_key, equipped_bg_key, player_code
    FROM users
    ORDER BY id
  `).all().map((u) => ({
    ...u,
    is_vip: !!u.is_vip,
    is_famous: !!u.is_famous,
    is_admin: u.role === 'admin',
  }));
}

function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
}

function updateUserFlags(userId, { is_vip, is_famous, role } = {}) {
  const user = getUserById(userId);
  if (!user) return { error: 'المستخدم غير موجود' };
  const vipVal = is_vip != null ? (is_vip ? 1 : 0) : user.is_vip;
  const famousVal = is_famous != null ? (is_famous ? 1 : 0) : (user.is_famous || 0);
  let roleVal = user.role;
  if (role === 'admin' || role === 'player') {
    if (user.role === 'admin' && role === 'player' && countAdmins() <= 1) {
      return { error: 'لا يمكن إزالة آخر أدمن في النظام' };
    }
    roleVal = role;
  }
  db.prepare('UPDATE users SET is_vip = ?, is_famous = ?, role = ? WHERE id = ?')
    .run(vipVal, famousVal, roleVal, userId);
  return { ok: true, user: getUserById(userId) };
}

module.exports = {
  normalizeUserId,
  userHasVip,
  getSeatMeta,
  listUsersAdmin,
  updateUserFlags,
};
