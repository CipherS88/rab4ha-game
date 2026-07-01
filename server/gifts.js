const { db, getOrCreatePlayer, savePlayer } = require('./db');
const { deviceIdForUser, getUserById } = require('./auth');
const { publicAvatarForUser } = require('./profileLimits');
const { enrichProfile } = require('./ranks');
const { scanProfanity } = require('./profanityFilter');
const { getSeatMeta, userHasVip } = require('./playerMeta');

const VIP_7D_COST = 2500;
const MIN_COIN_GIFT = 50;
const MAX_COIN_GIFT = 100000;
const CHARISMA_PER_100_COINS = 1;
const CHARISMA_VIP_7D = 40;
const CHARISMA_ADMIN_BASE = 12;

function initGiftsSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gift_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER,
      to_user_id INTEGER NOT NULL,
      gift_type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL DEFAULT '',
      is_admin INTEGER NOT NULL DEFAULT 0,
      charisma_delta INTEGER NOT NULL DEFAULT 0,
      seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_gift_log_to ON gift_log(to_user_id, seen_at);
  `);
  try { db.exec(`ALTER TABLE users ADD COLUMN vip_expires_at TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE players ADD COLUMN charisma INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
}

function refreshVipFlag(userId) {
  const user = getUserById(userId);
  if (!user || user.is_vip) return user;
  if (user.vip_expires_at && new Date(user.vip_expires_at) <= new Date()) {
    db.prepare('UPDATE users SET vip_expires_at = NULL WHERE id = ?').run(userId);
  }
  return getUserById(userId);
}

function grantVipDays(userId, days) {
  const d = parseInt(days, 10) || 7;
  const user = getUserById(userId);
  if (!user) return { error: 'المستخدم غير موجود' };
  const now = Date.now();
  let base = now;
  if (user.vip_expires_at) {
    const cur = new Date(user.vip_expires_at).getTime();
    if (cur > now) base = cur;
  }
  const expires = new Date(base + d * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET vip_expires_at = ? WHERE id = ?').run(expires, userId);
  return { ok: true, vip_expires_at: expires, days: d };
}

function addCharisma(userId, delta) {
  const { addGiftCharisma } = require('./leaderboards');
  return addGiftCharisma(userId, delta);
}

function calcCharismaDelta(giftType, amount, isAdmin) {
  if (giftType === 'coins') {
    return Math.max(1, Math.floor((parseInt(amount, 10) || 0) / 100) * CHARISMA_PER_100_COINS);
  }
  if (giftType === 'vip_7d') return CHARISMA_VIP_7D;
  if (isAdmin) return CHARISMA_ADMIN_BASE;
  return 0;
}

function buildGiftSenderCard(userId) {
  const user = getUserById(userId);
  if (!user) return null;
  const deviceId = deviceIdForUser(userId);
  const row = db.prepare('SELECT * FROM players WHERE device_id = ?').get(deviceId);
  const profile = enrichProfile(row ? {
    ...row,
    name: user.display_name || row.name,
  } : getOrCreatePlayer(deviceId, user.display_name));
  const meta = getSeatMeta(userId);
  const avatarRemoved = user.avatar_removed_until && new Date(user.avatar_removed_until) > new Date();
  return {
    user_id: userId,
    name: profile.name,
    avatar_url: avatarRemoved ? '' : (publicAvatarForUser(user) || ''),
    avatar_initial: avatarRemoved ? '🚫' : (profile.name?.charAt(0) || '؟'),
    rankLabel: profile.rankLabel,
    rankTheme: profile.rankTheme,
    deck_back_url: meta?.deck_back_url || '/cards/back_dark.png',
    star: meta?.star || null,
    is_vip: userHasVip(user),
    is_admin: user.role === 'admin',
  };
}

function defaultGiftMessage(giftType, amount, senderName) {
  const name = senderName || 'لاعب';
  if (giftType === 'coins') {
    const n = parseInt(amount, 10) || 0;
    return `أهداك ${n.toLocaleString('ar-SA')} ذهب`;
  }
  if (giftType === 'vip_7d') return 'أهداك اشتراك VIP 7 أيام';
  if (giftType === 'gems') {
    const n = parseInt(amount, 10) || 0;
    return `أهداك ${n.toLocaleString('ar-SA')} جواهر`;
  }
  return 'أهداك هدية';
}

function formatGiftRow(row) {
  const isAdminGift = !!row.is_admin;
  let sender = null;

  if (isAdminGift) {
    const adminCard = row.from_user_id ? buildGiftSenderCard(row.from_user_id) : null;
    sender = {
      user_id: row.from_user_id || null,
      name: 'الإدارة',
      avatar_url: adminCard?.avatar_url || '',
      avatar_initial: '★',
      rankLabel: '',
      rankTheme: 'gold',
      deck_back_url: adminCard?.deck_back_url || '/cards/back_dark.png',
      star: 'admin',
      is_vip: false,
      is_admin: true,
    };
  } else if (row.from_user_id) {
    sender = buildGiftSenderCard(row.from_user_id);
  }

  if (!sender) {
    sender = {
      user_id: row.from_user_id || null,
      name: 'لاعب',
      avatar_url: '',
      avatar_initial: '?',
      rankLabel: '',
      rankTheme: 'wood',
      deck_back_url: '/cards/back_dark.png',
      star: null,
      is_vip: false,
      is_admin: false,
    };
  }

  return {
    id: row.id,
    gift_type: row.gift_type,
    amount: row.amount,
    message: row.message,
    is_admin: isAdminGift,
    created_at: row.created_at,
    sender,
  };
}

function logGift({
  fromUserId, toUserId, giftType, amount, message, isAdmin, charismaDelta,
}) {
  const r = db.prepare(`
    INSERT INTO gift_log (from_user_id, to_user_id, gift_type, amount, message, is_admin, charisma_delta)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    fromUserId || null,
    toUserId,
    giftType,
    parseInt(amount, 10) || 0,
    message || '',
    isAdmin ? 1 : 0,
    charismaDelta || 0,
  );
  return r.lastInsertRowid;
}

function markGiftSeen(giftId, userId) {
  const r = db.prepare(`
    UPDATE gift_log SET seen_at = datetime('now')
    WHERE id = ? AND to_user_id = ? AND seen_at IS NULL
  `).run(giftId, userId);
  return r.changes > 0;
}

function listPendingGifts(userId) {
  const rows = db.prepare(`
    SELECT * FROM gift_log
    WHERE to_user_id = ? AND seen_at IS NULL
    ORDER BY id ASC
  `).all(userId);
  return rows.map(formatGiftRow);
}

function validateGiftMessage(text, { allowEmpty = false } = {}) {
  const msg = String(text || '').trim();
  if (!msg) return allowEmpty ? { text: '' } : { text: '' };
  if (msg.length > 200) return { error: 'الرسالة طويلة جداً' };
  const scan = scanProfanity(msg);
  if (scan.blocked) return { error: 'الرسالة تحتوي ألفاظاً غير مسموحة' };
  return { text: msg };
}

function sendPlayerGift(fromUserId, toUserId, { type, amount, message } = {}) {
  if (fromUserId === toUserId) return { error: 'لا يمكنك إهداء نفسك' };
  const target = getUserById(toUserId);
  if (!target) return { error: 'المستخدم غير موجود' };
  const sender = getUserById(fromUserId);
  if (!sender) return { error: 'حسابك غير موجود' };

  const block = db.prepare(`
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
    LIMIT 1
  `).get(fromUserId, toUserId, toUserId, fromUserId);
  if (block) return { error: 'لا يمكن الإهداء لهذا اللاعب' };

  const senderDevice = deviceIdForUser(fromUserId);
  const senderProfile = getOrCreatePlayer(senderDevice, sender.display_name);
  const senderCard = buildGiftSenderCard(fromUserId);

  let giftType = type;
  let giftAmount = 0;
  let autoMessage = '';

  if (giftType === 'coins') {
    giftAmount = parseInt(amount, 10) || 0;
    if (giftAmount < MIN_COIN_GIFT) return { error: `الحد الأدنى للإهداء ${MIN_COIN_GIFT} ذهب` };
    if (giftAmount > MAX_COIN_GIFT) return { error: 'المبلغ كبير جداً' };
    if (senderProfile.coins < giftAmount) {
      return { error: `رصيدك غير كافٍ — لديك ${senderProfile.coins} 🪙` };
    }
    autoMessage = defaultGiftMessage('coins', giftAmount, senderCard.name);
  } else if (giftType === 'vip_7d') {
    giftAmount = VIP_7D_COST;
    if (senderProfile.coins < VIP_7D_COST) {
      return { error: `رصيدك غير كافٍ — تحتاج ${VIP_7D_COST} 🪙 لإهداء VIP` };
    }
    autoMessage = defaultGiftMessage('vip_7d', 7, senderCard.name);
  } else {
    return { error: 'نوع الهدية غير مدعوم' };
  }

  const msgCheck = validateGiftMessage(message, { allowEmpty: true });
  if (msgCheck.error) return { error: msgCheck.error };
  const finalMessage = msgCheck.text || autoMessage;

  senderProfile.coins -= giftAmount;
  savePlayer(senderProfile);

  const targetDevice = deviceIdForUser(toUserId);
  const targetProfile = getOrCreatePlayer(targetDevice, target.display_name);
  if (giftType === 'coins') {
    targetProfile.coins = (targetProfile.coins || 0) + giftAmount;
    savePlayer(targetProfile);
  } else if (giftType === 'vip_7d') {
    const vip = grantVipDays(toUserId, 7);
    if (vip.error) return vip;
  }

  const charismaDelta = calcCharismaDelta(giftType, giftAmount, false);
  addCharisma(fromUserId, charismaDelta);
  const giftId = logGift({
    fromUserId,
    toUserId,
    giftType,
    amount: giftType === 'vip_7d' ? 7 : giftAmount,
    message: finalMessage,
    isAdmin: false,
    charismaDelta,
  });

  return {
    ok: true,
    gift: formatGiftRow(db.prepare('SELECT * FROM gift_log WHERE id = ?').get(giftId)),
    sender_coins: senderProfile.coins,
  };
}

function sendAdminGift(adminUser, toUserId, {
  coins = 0, gems = 0, product_id = null, rental_days = 0,
  vip_days = 0, message = '',
} = {}) {
  const target = getUserById(toUserId);
  if (!target) return { error: 'المستخدم غير موجود' };

  const adminCard = buildGiftSenderCard(adminUser.id);
  const senderName = adminUser.display_name || adminUser.username || 'الإدارة';
  const parts = [];
  const notifications = [];

  const c = parseInt(coins, 10) || 0;
  const g = parseInt(gems, 10) || 0;
  const vd = parseInt(vip_days, 10) || 0;

  if (c > 0) {
    const deviceId = deviceIdForUser(toUserId);
    const profile = getOrCreatePlayer(deviceId, target.display_name);
    profile.coins = (profile.coins || 0) + c;
    savePlayer(profile);
    parts.push(`${c} ذهب`);
  }
  if (g > 0) {
    const deviceId = deviceIdForUser(toUserId);
    const profile = getOrCreatePlayer(deviceId, target.display_name);
    profile.gems = (profile.gems || 0) + g;
    savePlayer(profile);
    parts.push(`${g} جواهر`);
  }
  if (vd > 0) {
    const vip = grantVipDays(toUserId, vd);
    if (vip.error) return vip;
    parts.push(`VIP ${vd} أيام`);
  }

  let purchase = null;
  const pid = parseInt(product_id, 10);
  const days = parseInt(rental_days, 10) || 0;
  if (pid && days > 0) {
    const product = db.prepare('SELECT * FROM store_products WHERE id = ?').get(pid);
    if (!product) return { error: 'المنتج غير موجود' };
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const expiresAt = expires.toISOString();
    const existing = db.prepare(
      'SELECT id FROM player_purchases WHERE user_id = ? AND product_id = ? ORDER BY id DESC LIMIT 1',
    ).get(toUserId, pid);
    if (existing) {
      db.prepare('UPDATE player_purchases SET expires_at = ? WHERE id = ?').run(expiresAt, existing.id);
    } else {
      db.prepare('INSERT INTO player_purchases (user_id, product_id, expires_at) VALUES (?, ?, ?)')
        .run(toUserId, pid, expiresAt);
    }
    purchase = { product_id: pid, name: product.name, expires_at: expiresAt, days };
    parts.push(`اشتراك ${product.name}`);
  }

  if (!c && !g && !vd && !purchase) {
    return { error: 'اختر هدية واحدة على الأقل' };
  }

  const msgCheck = validateGiftMessage(message, { allowEmpty: true });
  if (msgCheck.error) return { error: msgCheck.error };

  let finalMessage = msgCheck.text;
  if (!finalMessage) {
    finalMessage = parts.length === 1 && vd > 0
      ? `أهداك اشتراك ${vd} أيام`
      : `أهداك ${parts.join(' و ')}`;
  }

  let giftType = 'admin_bundle';
  let giftAmount = c || g || vd || days;
  if (c && !g && !vd && !purchase) { giftType = 'coins'; giftAmount = c; }
  else if (vd && !c && !g && !purchase) { giftType = 'vip_7d'; giftAmount = vd; }
  else if (g && !c && !vd && !purchase) { giftType = 'gems'; giftAmount = g; }

  let loggedCharisma = 0;
  const coinCharisma = calcCharismaDelta('coins', c, true);
  if (coinCharisma > 0) loggedCharisma = CHARISMA_ADMIN_BASE + coinCharisma;
  else if (vd > 0 || g > 0 || purchase) loggedCharisma = CHARISMA_ADMIN_BASE;
  if (loggedCharisma > 0) addCharisma(adminUser.id, loggedCharisma);

  const giftId = logGift({
    fromUserId: adminUser.id,
    toUserId,
    giftType,
    amount: giftAmount,
    message: finalMessage,
    isAdmin: true,
    charismaDelta: loggedCharisma,
  });

  const deviceId = deviceIdForUser(toUserId);
  const updated = enrichProfile(getOrCreatePlayer(deviceId));

  return {
    ok: true,
    profile: updated,
    gift: formatGiftRow(db.prepare('SELECT * FROM gift_log WHERE id = ?').get(giftId)),
    purchase,
  };
}

function getGiftOptions(viewerUserId) {
  const deviceId = deviceIdForUser(viewerUserId);
  const profile = getOrCreatePlayer(deviceId);
  return {
    vip_7d_cost: VIP_7D_COST,
    min_coins: MIN_COIN_GIFT,
    max_coins: MAX_COIN_GIFT,
    my_coins: profile.coins ?? 0,
  };
}

module.exports = {
  initGiftsSchema,
  VIP_7D_COST,
  MIN_COIN_GIFT,
  grantVipDays,
  buildGiftSenderCard,
  sendPlayerGift,
  sendAdminGift,
  listPendingGifts,
  markGiftSeen,
  formatGiftRow,
  getGiftOptions,
};
