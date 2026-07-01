const { db, getOrCreatePlayer } = require('./db');
const { deviceIdForUser, getProfileForUser } = require('./auth');
const { enrichProfile } = require('./ranks');
const { scanProfanity } = require('./profanityFilter');
const { getSeatMeta } = require('./playerMeta');

const DM_TTL_HOURS = 48;
const PUBLIC_HISTORY_LIMIT = 200;

function initChatSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER,
      reply_to_id INTEGER,
      body TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_deleted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_public ON chat_messages(channel, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_dm ON chat_messages(channel, sender_id, recipient_id, created_at);

    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_a INTEGER NOT NULL,
      user_b INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_a, user_b)
    );

    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id INTEGER NOT NULL,
      blocked_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (blocker_id, blocked_id)
    );

    CREATE TABLE IF NOT EXISTS chat_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      reported_user_id INTEGER NOT NULL,
      message_id INTEGER,
      report_type TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_action TEXT,
      admin_notes TEXT,
      resolved_by INTEGER,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const userCols = [
    'profanity_strikes INTEGER NOT NULL DEFAULT 0',
    'chat_public_muted_until TEXT',
    'chat_dm_muted_until TEXT',
    'is_banned INTEGER NOT NULL DEFAULT 0',
    'ban_reason TEXT',
    'avatar_removed_until TEXT',
  ];
  for (const col of userCols) {
    try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch (_) {}
  }
}

function pairKey(a, b) {
  return a < b ? [a, b] : [b, a];
}

function getModerationRow(userId) {
  return db.prepare(`
    SELECT id, profanity_strikes, chat_public_muted_until, chat_dm_muted_until,
           is_banned, ban_reason, avatar_removed_until
    FROM users WHERE id = ?
  `).get(userId);
}

function isBanned(userId) {
  const row = getModerationRow(userId);
  return !!row?.is_banned;
}

function isMuted(userId, channel) {
  const row = getModerationRow(userId);
  if (!row) return { muted: true, reason: 'حساب غير موجود' };
  if (row.is_banned) {
    return { muted: true, reason: row.ban_reason || 'حسابك محظور — ممنوع اللعب والشات' };
  }
  const col = channel === 'dm' ? 'chat_dm_muted_until' : 'chat_public_muted_until';
  const until = row[col];
  if (until && new Date(until) > new Date()) {
    return { muted: true, reason: `مكتوم في الشات حتى ${new Date(until).toLocaleString('ar-SA')}` };
  }
  return { muted: false };
}

function applyProfanityStrike(userId) {
  const row = getModerationRow(userId);
  const strikes = (row?.profanity_strikes || 0) + 1;
  const now = new Date();

  if (strikes >= 3) {
    db.prepare(`
      UPDATE users SET profanity_strikes = ?, is_banned = 1,
        ban_reason = 'حظر نهائي — مخالفة لغة مسيئة متكررة'
      WHERE id = ?
    `).run(strikes, userId);
    db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(userId);
    return {
      strikes,
      banned: true,
      message: 'تم حظر حسابك نهائياً بسبب تكرار الألفاظ المسيئة. ممنوع اللعب والشات.',
    };
  }

  const days = strikes === 1 ? 3 : 7;
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    UPDATE users SET profanity_strikes = ?,
      chat_public_muted_until = ?,
      chat_dm_muted_until = ?
    WHERE id = ?
  `).run(strikes, until, until, userId);

  return {
    strikes,
    banned: false,
    muteDays: days,
    message: `تم كتمك ${days} أيام بسبب ألفاظ مسيئة (مخالفة ${strikes}/3)`,
  };
}

function purgeExpiredDm() {
  db.prepare(`
    DELETE FROM chat_messages
    WHERE channel = 'dm' AND datetime(created_at) < datetime('now', '-${DM_TTL_HOURS} hours')
  `).run();
}

function isBlocked(a, b) {
  return !!db.prepare(`
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
  `).get(a, b, b, a);
}

function getFriendshipStatus(viewerId, targetId) {
  if (viewerId === targetId) return 'self';
  if (isBlocked(viewerId, targetId)) {
    const iBlocked = db.prepare('SELECT 1 FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').get(viewerId, targetId);
    return iBlocked ? 'blocked_by_me' : 'blocked_me';
  }
  const [ua, ub] = pairKey(viewerId, targetId);
  const row = db.prepare('SELECT status, requested_by FROM friendships WHERE user_a = ? AND user_b = ?').get(ua, ub);
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  if (row.requested_by === viewerId) return 'pending_sent';
  return 'pending_received';
}

function playerRowToCard(userId, viewerId) {
  const user = db.prepare(`
    SELECT id, username, display_name, avatar_url, avatar_removed_until, player_code
    FROM users WHERE id = ?
  `).get(userId);
  if (!user) return null;
  const deviceId = deviceIdForUser(userId);
  const row = db.prepare('SELECT * FROM players WHERE device_id = ?').get(deviceId);
  const profile = enrichProfile(row ? {
    ...row,
    name: user.display_name || row.name,
  } : getOrCreatePlayer(deviceId, user.display_name));

  const avatarRemoved = user.avatar_removed_until && new Date(user.avatar_removed_until) > new Date();
  const avatarUrl = avatarRemoved ? '' : (user.avatar_url || '');
  const initial = avatarRemoved ? '🚫' : (profile.name?.charAt(0) || '؟');

  const meta = getSeatMeta(userId);
  return {
    user_id: userId,
    username: user.username,
    player_code: user.player_code || '',
    name: profile.name,
    avatar_url: avatarUrl,
    avatar_initial: initial,
    avatar_removed: avatarRemoved,
    rankLabel: profile.rankLabel,
    rankTheme: profile.rankTheme,
    deck_back_url: meta?.deck_back_url || '/cards/back_dark.png',
    deck_glow_color: meta?.deck_glow_color || null,
    deck_asset_key: meta?.deck_asset_key || null,
    star: meta?.star || null,
    is_admin: !!meta?.is_admin,
    is_famous: !!meta?.is_famous,
    is_vip: !!meta?.is_vip,
    wins: profile.wins,
    losses: profile.losses,
    coins: profile.coins,
    championship_stars: profile.championship_stars,
    radarStats: profile.radarStats,
    friendship: getFriendshipStatus(viewerId, userId),
  };
}

function formatMessageRow(row, viewerId) {
  const reply = row.reply_to_id
    ? db.prepare('SELECT id, body, sender_id, is_deleted FROM chat_messages WHERE id = ?').get(row.reply_to_id)
    : null;
  return {
    id: row.id,
    channel: row.channel,
    body: row.is_deleted ? '[تم حذف الرسالة]' : row.body,
    image_url: row.is_deleted ? null : (row.image_url || null),
    created_at: row.created_at,
    reply_to: reply ? {
      id: reply.id,
      body: reply.is_deleted ? '[محذوفة]' : reply.body,
      sender_id: reply.sender_id,
    } : null,
    sender: playerRowToCard(row.sender_id, viewerId),
    recipient_id: row.recipient_id,
  };
}

function getPublicHistory(viewerId, limit = PUBLIC_HISTORY_LIMIT) {
  purgeExpiredDm();
  const rows = db.prepare(`
    SELECT * FROM chat_messages
    WHERE channel = 'public' AND is_deleted = 0
    ORDER BY id DESC LIMIT ?
  `).all(limit);
  return rows.reverse().map((r) => formatMessageRow(r, viewerId));
}

function getDmThread(viewerId, otherId, limit = 100) {
  purgeExpiredDm();
  if (isBlocked(viewerId, otherId)) return { error: 'لا يمكنك مراسلة هذا اللاعب' };
  const rows = db.prepare(`
    SELECT * FROM chat_messages
    WHERE channel = 'dm' AND is_deleted = 0
      AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
      AND datetime(created_at) >= datetime('now', '-${DM_TTL_HOURS} hours')
    ORDER BY id ASC LIMIT ?
  `).all(viewerId, otherId, otherId, viewerId, limit);
  return { messages: rows.map((r) => formatMessageRow(r, viewerId)) };
}

function listDmConversations(userId) {
  purgeExpiredDm();
  const rows = db.prepare(`
    SELECT
      CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS other_id,
      MAX(id) AS last_id
    FROM chat_messages
    WHERE channel = 'dm'
      AND (sender_id = ? OR recipient_id = ?)
      AND datetime(created_at) >= datetime('now', '-${DM_TTL_HOURS} hours')
      AND is_deleted = 0
    GROUP BY other_id
    ORDER BY last_id DESC
  `).all(userId, userId, userId);

  return rows.map((r) => {
    const last = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(r.last_id);
    const card = playerRowToCard(r.other_id, userId);
    return {
      user: card,
      last_message: last ? {
        body: last.body,
        created_at: last.created_at,
        from_me: last.sender_id === userId,
      } : null,
    };
  });
}

function validateMessageBody(body) {
  const text = String(body || '').trim();
  if (!text) return { error: 'الرسالة فارغة' };
  if (text.length > 500) return { error: 'الرسالة طويلة جداً' };
  const scan = scanProfanity(text);
  if (scan.blocked) return { error: 'profanity', profanity: true };
  return { text };
}

function sendMessage(senderId, { channel, recipientId, body, imageUrl, replyToId }) {
  purgeExpiredDm();
  if (isBanned(senderId)) return { error: 'حسابك محظور' };

  const mute = isMuted(senderId, channel === 'dm' ? 'dm' : 'public');
  if (mute.muted) return { error: mute.reason };

  if (channel === 'dm') {
    if (!recipientId) return { error: 'مستلم غير محدد' };
    if (recipientId === senderId) return { error: 'لا يمكن مراسلة نفسك' };
    if (isBlocked(senderId, recipientId)) return { error: 'لا يمكنك مراسلة هذا اللاعب' };
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(recipientId);
    if (!target) return { error: 'المستخدم غير موجود' };
  } else if (imageUrl) {
    return { error: 'رفع الصور متاح في الشات الخاص فقط' };
  }

  let text = '';
  if (body) {
    const v = validateMessageBody(body);
    if (v.error === 'profanity') {
      const strike = applyProfanityStrike(senderId);
      return { error: strike.message, profanityStrike: strike };
    }
    if (v.error) return { error: v.error };
    text = v.text;
  }

  if (!text && !imageUrl) return { error: 'أدخل نصاً أو صورة' };

  if (replyToId) {
    const parent = db.prepare('SELECT id, channel FROM chat_messages WHERE id = ?').get(replyToId);
    if (!parent || parent.channel !== channel) return { error: 'الرد غير صالح' };
  }

  const info = db.prepare(`
    INSERT INTO chat_messages (channel, sender_id, recipient_id, reply_to_id, body, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(channel, senderId, recipientId || null, replyToId || null, text, imageUrl || null);

  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  return { message: formatMessageRow(row, senderId) };
}

function sendFriendRequest(fromId, toId) {
  if (fromId === toId) return { error: 'غير صالح' };
  if (isBlocked(fromId, toId)) return { error: 'لا يمكن إرسال طلب صداقة' };
  const [ua, ub] = pairKey(fromId, toId);
  const existing = db.prepare('SELECT * FROM friendships WHERE user_a = ? AND user_b = ?').get(ua, ub);
  if (existing?.status === 'accepted') return { error: 'أنتما أصدقاء بالفعل' };
  if (existing?.status === 'pending') return { error: 'طلب صداقة موجود مسبقاً' };
  if (existing) {
    db.prepare('UPDATE friendships SET status = ?, requested_by = ? WHERE user_a = ? AND user_b = ?')
      .run('pending', fromId, ua, ub);
  } else {
    db.prepare('INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES (?, ?, ?, ?)')
      .run(ua, ub, 'pending', fromId);
  }
  return { ok: true, friendship: getFriendshipStatus(fromId, toId) };
}

function acceptFriendRequest(userId, otherId) {
  const [ua, ub] = pairKey(userId, otherId);
  const row = db.prepare('SELECT * FROM friendships WHERE user_a = ? AND user_b = ?').get(ua, ub);
  if (!row || row.status !== 'pending') return { error: 'لا يوجد طلب صداقة' };
  if (row.requested_by === userId) return { error: 'لا يمكنك قبول طلبك أنت' };
  db.prepare(`UPDATE friendships SET status = 'accepted' WHERE user_a = ? AND user_b = ?`).run(ua, ub);
  return { ok: true, friendship: 'friends' };
}

function removeFriend(userId, otherId) {
  const [ua, ub] = pairKey(userId, otherId);
  db.prepare('DELETE FROM friendships WHERE user_a = ? AND user_b = ?').run(ua, ub);
  return { ok: true };
}

function blockUser(blockerId, blockedId) {
  if (blockerId === blockedId) return { error: 'غير صالح' };
  removeFriend(blockerId, blockedId);
  db.prepare(`
    INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)
  `).run(blockerId, blockedId);
  return { ok: true };
}

function unblockUser(blockerId, blockedId) {
  db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').run(blockerId, blockedId);
  return { ok: true };
}

function createReport(reporterId, { reportedUserId, messageId, reportType, details }) {
  if (!reportedUserId) return { error: 'مستخدم غير محدد' };
  const info = db.prepare(`
    INSERT INTO chat_reports (reporter_id, reported_user_id, message_id, report_type, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(reporterId, reportedUserId, messageId || null, reportType || 'message', (details || '').slice(0, 500));
  return { id: info.lastInsertRowid };
}

function listReports(status = 'pending') {
  return db.prepare(`
    SELECT r.*,
      ru.display_name AS reporter_name,
      tu.display_name AS reported_name,
      m.body AS message_body, m.image_url AS message_image, m.channel AS message_channel
    FROM chat_reports r
    JOIN users ru ON ru.id = r.reporter_id
    JOIN users tu ON tu.id = r.reported_user_id
    LEFT JOIN chat_messages m ON m.id = r.message_id
    WHERE r.status = ?
    ORDER BY r.created_at DESC LIMIT 100
  `).all(status);
}

function resolveReport(adminId, reportId, { action, muteDays, notes }) {
  const report = db.prepare('SELECT * FROM chat_reports WHERE id = ?').get(reportId);
  if (!report) return { error: 'التبليغ غير موجود' };

  const targetId = report.reported_user_id;
  const days = Math.max(0, Math.min(365, parseInt(muteDays, 10) || 0));
  const until = days > 0
    ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  switch (action) {
    case 'dismiss':
      break;
    case 'delete_message':
      if (report.message_id) {
        db.prepare('UPDATE chat_messages SET is_deleted = 1, body = ? WHERE id = ?').run('[محذوفة بواسطة الإدارة]', report.message_id);
      }
      break;
    case 'remove_avatar':
      db.prepare('UPDATE users SET avatar_removed_until = ? WHERE id = ?').run(
        new Date(Date.now() + (days || 30) * 24 * 60 * 60 * 1000).toISOString(),
        targetId
      );
      break;
    case 'mute_public':
      if (until) db.prepare('UPDATE users SET chat_public_muted_until = ? WHERE id = ?').run(until, targetId);
      break;
    case 'mute_dm':
      if (until) db.prepare('UPDATE users SET chat_dm_muted_until = ? WHERE id = ?').run(until, targetId);
      break;
    case 'mute_both':
      if (until) {
        db.prepare('UPDATE users SET chat_public_muted_until = ?, chat_dm_muted_until = ? WHERE id = ?').run(until, until, targetId);
      }
      break;
    case 'ban':
      db.prepare(`UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?`).run(notes || 'حظر بواسطة الإدارة', targetId);
      db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(targetId);
      break;
    default:
      return { error: 'إجراء غير معروف' };
  }

  db.prepare(`
    UPDATE chat_reports SET status = 'resolved', admin_action = ?, admin_notes = ?,
      resolved_by = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(action, (notes || '').slice(0, 500), adminId, reportId);

  return { ok: true };
}

function getBanInfoForUser(userId) {
  const row = getModerationRow(userId);
  if (!row?.is_banned) return null;
  return { banned: true, reason: row.ban_reason || 'حساب محظور' };
}

function listBannedUsers() {
  return db.prepare(`
    SELECT id, username, display_name, ban_reason, profanity_strikes, role, created_at
    FROM users
    WHERE is_banned = 1
    ORDER BY id DESC
  `).all();
}

function unbanUser(userId) {
  const row = getModerationRow(userId);
  if (!row) return { error: 'المستخدم غير موجود' };
  if (!row.is_banned) return { error: 'المستخدم غير محظور' };
  db.prepare(`
    UPDATE users SET is_banned = 0, ban_reason = NULL
    WHERE id = ?
  `).run(userId);
  return { ok: true };
}

function listFriends(userId) {
  const rows = db.prepare(`
    SELECT user_a, user_b, status, requested_by FROM friendships
    WHERE user_a = ? OR user_b = ?
  `).all(userId, userId);

  const friends = [];
  const pendingReceived = [];
  const pendingSent = [];

  for (const row of rows) {
    const otherId = row.user_a === userId ? row.user_b : row.user_a;
    if (isBlocked(userId, otherId)) continue;
    const card = playerRowToCard(otherId, userId);
    if (!card) continue;
    if (row.status === 'accepted') friends.push(card);
    else if (row.requested_by === userId) pendingSent.push(card);
    else pendingReceived.push(card);
  }

  friends.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  pendingReceived.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  pendingSent.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

  return { friends, pending_received: pendingReceived, pending_sent: pendingSent };
}

module.exports = {
  initChatSchema,
  purgeExpiredDm,
  isBanned,
  isMuted,
  getBanInfoForUser,
  listBannedUsers,
  unbanUser,
  getPublicHistory,
  getDmThread,
  listDmConversations,
  sendMessage,
  playerRowToCard,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  listFriends,
  blockUser,
  unblockUser,
  createReport,
  listReports,
  resolveReport,
  formatMessageRow,
  DM_TTL_HOURS,
};
