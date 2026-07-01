const { db, getOrCreatePlayer, savePlayer } = require('./db');
const { enrichProfile } = require('./ranks');
const { DEFAULT_DECK_KEY, DEFAULT_BG_KEY } = require('./store');

const FALLBACK_DECK_BACK = '/cards/back_dark.png';

function migrateInventoryColumns() {
  try { db.exec(`ALTER TABLE inventory ADD COLUMN item_type TEXT DEFAULT 'achievement'`); } catch (_) {}
  try { db.exec(`ALTER TABLE inventory ADD COLUMN image_url TEXT DEFAULT ''`); } catch (_) {}
}

function migrateBagColumns() {
  try { db.exec(`ALTER TABLE users ADD COLUMN is_famous INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN equipped_deck_key TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN equipped_bg_key TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE players ADD COLUMN gems INTEGER NOT NULL DEFAULT 1000`); } catch (_) {}
  try { db.exec(`UPDATE players SET gems = 1000 WHERE gems IS NULL OR gems = 0`); } catch (_) {}
}

function getUserEquippedKeys(userId) {
  const row = db.prepare('SELECT equipped_deck_key, equipped_bg_key FROM users WHERE id = ?').get(userId);
  return {
    deck: row?.equipped_deck_key || '',
    bg: row?.equipped_bg_key || '',
  };
}

function getGlobalDefaultProducts() {
  return db.prepare(`
    SELECT * FROM store_products
    WHERE is_global_default = 1 AND is_active = 1
    ORDER BY category, id
  `).all();
}

function getActivePurchases(userId) {
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT p.id AS purchase_id, p.purchased_at, p.expires_at,
      pr.id AS product_id, pr.name, pr.category, pr.image_url, pr.asset_key,
      pr.ownership_type, pr.rental_days, pr.description, pr.is_global_default
    FROM player_purchases p
    JOIN store_products pr ON pr.id = p.product_id
    WHERE p.user_id = ?
      AND (p.expires_at IS NULL OR p.expires_at > ?)
    ORDER BY p.purchased_at DESC
  `).all(userId, now);
}

function userOwnsProduct(userId, productId) {
  const row = db.prepare('SELECT asset_key, is_free, is_global_default FROM store_products WHERE id = ?').get(productId);
  if (!row) return false;
  if (row.is_global_default) return true;
  return db.prepare(`
    SELECT 1 FROM player_purchases
    WHERE user_id = ? AND product_id = ?
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    LIMIT 1
  `).get(userId, productId) != null;
}

function purchaseToBagItem(row, { isDefault = false, equipped = false } = {}) {
  return {
    id: row.product_id || row.id,
    purchase_id: row.purchase_id || null,
    name: row.name,
    category: row.category,
    category_label: row.category === 'cards' ? 'أوراق اللعب' : 'خلفيات الجلسات',
    image_url: row.image_url || '',
    asset_key: row.asset_key,
    ownership_type: row.ownership_type || 'permanent',
    expires_at: row.expires_at || null,
    purchased_at: row.purchased_at || null,
    is_default: isDefault,
    is_global_default: !!row.is_global_default,
    description: row.description || '',
    equipped: !!equipped,
  };
}

function isItemEquipped(row, keys) {
  if (row.category === 'cards') {
    if (keys.deck) return keys.deck === row.asset_key;
    return row.asset_key === DEFAULT_DECK_KEY;
  }
  if (row.category === 'session_bg') {
    if (keys.bg) return keys.bg === row.asset_key;
    return row.asset_key === DEFAULT_BG_KEY;
  }
  return false;
}

function getBagStoreItems(userId) {
  const items = [];
  const seen = new Set();
  const keys = getUserEquippedKeys(userId);

  for (const row of getGlobalDefaultProducts()) {
    const equipped = isItemEquipped(row, keys);
    items.push(purchaseToBagItem(row, { isDefault: true, equipped }));
    seen.add(`${row.category}:${row.asset_key}`);
  }

  for (const row of getActivePurchases(userId)) {
    const key = `${row.category}:${row.asset_key}`;
    if (seen.has(key)) continue;
    const equipped = isItemEquipped(row, keys);
    items.push(purchaseToBagItem(row, { equipped }));
    seen.add(key);
  }

  return items;
}

function getBagAchievements(userId) {
  return db.prepare(`
    SELECT id, item_key, label, image_url, item_type, earned_at
    FROM inventory
    WHERE user_id = ? AND (item_type = 'achievement' OR item_type IS NULL)
    ORDER BY earned_at DESC
  `).all(userId).map((r) => ({
    id: r.id,
    item_key: r.item_key,
    label: r.label,
    image_url: r.image_url || '',
    earned_at: r.earned_at,
  }));
}

function getDisplayBadges(userId, maxSlots = 4) {
  const rows = db.prepare(`
    SELECT id, item_key, label, image_url, item_type, earned_at
    FROM inventory
    WHERE user_id = ? AND (item_type = 'badge' OR item_type = 'achievement')
    ORDER BY earned_at DESC
    LIMIT ?
  `).all(userId, maxSlots);
  const badges = rows.map((r) => ({
    id: r.id,
    item_key: r.item_key,
    label: r.label,
    image_url: r.image_url || '',
    item_type: r.item_type,
  }));
  while (badges.length < maxSlots) badges.push(null);
  return badges;
}

function resolveDeckBack(imageUrl) {
  return imageUrl || FALLBACK_DECK_BACK;
}

function getDeckGlowColor(assetKey) {
  const presets = {
    deck_dark: '#64748b',
    deck_light: '#f1f5f9',
    kingofd: '#eab308',
    darl: '#22d3ee',
    default_session: '#94a3b8',
  };
  if (presets[assetKey]) return presets[assetKey];
  if (!assetKey) return '#64748b';
  let h = 0;
  for (let i = 0; i < assetKey.length; i++) h = (h * 31 + assetKey.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 72%, 58%)`;
}

function getEquippedCardDeck(userId) {
  const items = getBagStoreItems(userId).filter((i) => i.category === 'cards');
  const keys = getUserEquippedKeys(userId);
  const deckKey = keys.deck || DEFAULT_DECK_KEY;
  const picked = items.find((i) => i.asset_key === deckKey)
    || items.find((i) => i.asset_key === DEFAULT_DECK_KEY)
    || items.find((i) => i.is_global_default);
  return {
    asset_key: picked?.asset_key || DEFAULT_DECK_KEY,
    name: picked?.name || 'أوراق اللعب',
    back_url: resolveDeckBack(picked?.image_url || ''),
    is_default: !!picked?.is_global_default,
    glow_color: getDeckGlowColor(picked?.asset_key || DEFAULT_DECK_KEY),
  };
}

function getDefaultSessionBgUrl() {
  const row = db.prepare(`
    SELECT image_url FROM store_products
    WHERE category = 'session_bg' AND is_global_default = 1 AND is_active = 1
    ORDER BY id LIMIT 1
  `).get();
  return row?.image_url || '/backgrounds/default.jpg';
}

function getGlobalDefaultSessionBg() {
  const row = db.prepare(`
    SELECT * FROM store_products
    WHERE category = 'session_bg' AND is_global_default = 1 AND is_active = 1
    ORDER BY id LIMIT 1
  `).get();
  if (!row) {
    return {
      asset_key: DEFAULT_BG_KEY,
      name: 'الجلسة العادية',
      image_url: '/backgrounds/default.jpg',
      is_default: true,
      contributes_to_room: false,
    };
  }
  return {
    asset_key: row.asset_key,
    name: row.name,
    image_url: row.image_url || '/backgrounds/default.jpg',
    is_default: true,
    contributes_to_room: false,
  };
}

function getEquippedSessionBg(userId) {
  const items = getBagStoreItems(userId).filter((i) => i.category === 'session_bg');
  const keys = getUserEquippedKeys(userId);
  const bgKey = keys.bg || DEFAULT_BG_KEY;
  const picked = items.find((i) => i.asset_key === bgKey);
  if (picked) {
    const isGlobal = !!picked.is_global_default;
    return {
      asset_key: picked.asset_key,
      name: picked.name,
      image_url: picked.image_url || '',
      is_default: isGlobal,
      contributes_to_room: !isGlobal,
    };
  }
  return getGlobalDefaultSessionBg();
}

function equipItem(user, category, assetKey) {
  const uid = user.id;
  const items = getBagStoreItems(uid).filter((i) => i.category === category);
  const col = category === 'cards' ? 'equipped_deck_key' : 'equipped_bg_key';
  const defaultKey = category === 'cards' ? DEFAULT_DECK_KEY : DEFAULT_BG_KEY;

  if (!assetKey || assetKey === defaultKey) {
    db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(defaultKey, uid);
    return { ok: true, bag: getBag(uid), equipped: defaultKey };
  }
  const item = items.find((i) => i.asset_key === assetKey);
  if (!item) return { error: 'العنصر غير متوفر في شنطتك' };
  db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(assetKey, uid);
  return { ok: true, bag: getBag(uid), equipped: assetKey };
}

function getPlayerShowcase(userId) {
  return {
    card_deck: getEquippedCardDeck(userId),
    session_bg: getEquippedSessionBg(userId),
    badges: getDisplayBadges(userId, 4),
  };
}

function getBag(userId) {
  return {
    store_items: getBagStoreItems(userId),
    achievements: getBagAchievements(userId),
    showcase: getPlayerShowcase(userId),
  };
}

function grantAchievement(userId, itemKey, label, imageUrl = '') {
  const exists = db.prepare('SELECT id FROM inventory WHERE user_id = ? AND item_key = ?').get(userId, itemKey);
  if (exists) return { ok: true, duplicate: true };
  db.prepare(`
    INSERT INTO inventory (user_id, item_key, label, image_url, item_type)
    VALUES (?, ?, ?, ?, 'achievement')
  `).run(userId, itemKey, label, imageUrl || '');
  return { ok: true };
}

function markProductsOwned(userId, products) {
  return products.map((p) => ({
    ...p,
    owned: userOwnsProduct(userId, p.id),
  }));
}

function purchaseWithCoins(user, productId) {
  const row = db.prepare('SELECT * FROM store_products WHERE id = ?').get(productId);
  if (!row) return { error: 'المنتج غير موجود' };
  if (row.is_global_default) return { error: 'هذا العنصر افتراضي ومتاح لجميع اللاعبين' };

  const now = new Date().toISOString();
  const expired = row.available_until && row.available_until < now;
  const outOfStock = row.stock_limit != null && row.sold_count >= row.stock_limit;
  if (!row.is_active || expired || outOfStock) return { error: 'المنتج غير متاح في المتجر' };
  if (row.ownership_type === 'permanent' && userOwnsProduct(user.id, productId)) {
    return { error: 'تملك هذا المنتج مسبقاً' };
  }

  const deviceId = `user_${user.id}`;
  const profile = getOrCreatePlayer(deviceId, user.display_name);
  const isFree = !!row.is_free || row.price === 0;
  const price = isFree ? 0 : row.price;

  if (price > 0 && profile.coins < price) {
    return { error: `رصيد العملات غير كافٍ — تحتاج ${price} 🪙 ولديك ${profile.coins} 🪙` };
  }

  let expiresAt = null;
  if (row.ownership_type === 'rental') {
    const days = row.rental_days || 7;
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  if (price > 0) {
    profile.coins -= price;
    savePlayer(profile);
  }

  db.prepare('INSERT INTO player_purchases (user_id, product_id, expires_at) VALUES (?, ?, ?)').run(
    user.id, productId, expiresAt,
  );
  if (!isFree) {
    db.prepare(`UPDATE store_products SET sold_count = sold_count + 1, updated_at = datetime('now') WHERE id = ?`).run(productId);
  }

  const updatedProfile = enrichProfile(getOrCreatePlayer(deviceId, user.display_name));
  return {
    ok: true,
    coins: updatedProfile.coins,
    gems: updatedProfile.gems,
    profile: updatedProfile,
    bag: getBag(user.id),
    purchase: { product_id: productId, name: row.name, expires_at: expiresAt },
  };
}

module.exports = {
  migrateInventoryColumns,
  migrateBagColumns,
  getBag,
  getBagStoreItems,
  getBagAchievements,
  userOwnsProduct,
  markProductsOwned,
  purchaseWithCoins,
  grantAchievement,
  getPlayerShowcase,
  getGlobalDefaultProducts,
  getEquippedCardDeck,
  getEquippedSessionBg,
  getDefaultSessionBgUrl,
  getGlobalDefaultSessionBg,
  getDeckGlowColor,
  equipItem,
};
