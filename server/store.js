const { db, getOrCreatePlayer, savePlayer } = require('./db');

const STORE_CATEGORIES = {
  cards: { id: 'cards', label: 'أوراق اللعب' },
  session_bg: { id: 'session_bg', label: 'خلفيات الجلسات' },
};

/** منتجات مدمجة — بدون رفع صور من الداشبورد */
const BUILTIN_PRODUCTS = [
  {
    category: 'session_bg',
    name: 'الجلسة العادية',
    description: 'خلفية الجلسة الافتراضية للجميع',
    asset_key: 'default_session',
    image_url: '/backgrounds/default.jpg',
    is_global_default: 1,
  },
  {
    category: 'cards',
    name: 'كلاسيك أسود',
    description: 'ظهر أوراق داكن',
    asset_key: 'deck_dark',
    image_url: '/cards/back_dark.png',
    is_global_default: 1,
  },
  {
    category: 'cards',
    name: 'كلاسيك فاتح',
    description: 'ظهر أوراق فاتح',
    asset_key: 'deck_light',
    image_url: '/cards/back_light.png',
    is_global_default: 1,
  },
];

const DEFAULT_DECK_KEY = 'deck_dark';
const DEFAULT_BG_KEY = 'default_session';

/** منتجات يدوية — مرتبطة بملفات في المجلدات */
const MANUAL_STORE_PRODUCTS = [
  {
    category: 'cards',
    name: 'ملك الديمن',
    description: 'ظهر أوراق ملك الديمن',
    asset_key: 'kingofd',
    image_url: '/cards/kingofd.jpg',
    price: 1000,
    ownership_type: 'permanent',
    rental_days: null,
  },
  {
    category: 'session_bg',
    name: 'الجوكر',
    description: 'خلفية جلسة الجوكر',
    asset_key: 'darl',
    image_url: '/backgrounds/darl.jpg',
    price: 700,
    ownership_type: 'rental',
    rental_days: 7,
  },
];

function initStoreSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      asset_key TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      is_free INTEGER NOT NULL DEFAULT 0,
      ownership_type TEXT NOT NULL DEFAULT 'permanent',
      rental_days INTEGER,
      stock_limit INTEGER,
      sold_count INTEGER NOT NULL DEFAULT 0,
      available_until TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS player_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES store_products(id)
    );
  `);
}

function migrateStoreGlobals() {
  try {
    db.exec(`ALTER TABLE store_products ADD COLUMN is_global_default INTEGER NOT NULL DEFAULT 0`);
  } catch (_) {}
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT)`);
  } catch (_) {}
  const done = db.prepare(`SELECT value FROM app_meta WHERE key = 'store_v2_builtin'`).get();
  if (!done) {
    resetStoreToBuiltinDefaults();
    db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('store_v2_builtin', '1')`).run();
  }
}

function resetStoreToBuiltinDefaults() {
  db.exec('DELETE FROM player_purchases');
  db.exec('DELETE FROM store_products');
  const insert = db.prepare(`
    INSERT INTO store_products (
      category, name, description, image_url, asset_key, price, is_free,
      ownership_type, rental_days, stock_limit, is_active, is_global_default
    ) VALUES (?, ?, ?, ?, ?, 0, 1, 'permanent', NULL, NULL, 1, ?)
  `);
  for (const p of BUILTIN_PRODUCTS) {
    insert.run(p.category, p.name, p.description || '', p.image_url, p.asset_key, p.is_global_default ? 1 : 0);
  }
  db.prepare(`
    UPDATE users SET equipped_deck_key = ?, equipped_bg_key = ?
    WHERE equipped_deck_key = '' OR equipped_deck_key IS NULL
       OR equipped_bg_key = '' OR equipped_bg_key IS NULL
  `).run(DEFAULT_DECK_KEY, DEFAULT_BG_KEY);
  db.prepare(`
    UPDATE users SET equipped_deck_key = ?
    WHERE equipped_deck_key NOT IN (SELECT asset_key FROM store_products WHERE category = 'cards')
  `).run(DEFAULT_DECK_KEY);
  db.prepare(`
    UPDATE users SET equipped_bg_key = ?
    WHERE equipped_bg_key NOT IN (SELECT asset_key FROM store_products WHERE category = 'session_bg')
  `).run(DEFAULT_BG_KEY);
}

function syncManualStoreProducts() {
  const find = db.prepare('SELECT id FROM store_products WHERE category = ? AND asset_key = ?');
  const insert = db.prepare(`
    INSERT INTO store_products (
      category, name, description, image_url, asset_key, price, is_free,
      ownership_type, rental_days, stock_limit, is_active, is_global_default
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, 1, 0)
  `);
  const update = db.prepare(`
    UPDATE store_products SET
      name = ?, description = ?, image_url = ?, price = ?,
      ownership_type = ?, rental_days = ?, is_active = 1, is_global_default = 0,
      updated_at = datetime('now')
    WHERE id = ?
  `);
  for (const p of MANUAL_STORE_PRODUCTS) {
    const row = find.get(p.category, p.asset_key);
    if (row) {
      update.run(p.name, p.description || '', p.image_url, p.price, p.ownership_type, p.rental_days, row.id);
    } else {
      insert.run(
        p.category, p.name, p.description || '', p.image_url, p.asset_key, p.price,
        p.ownership_type, p.rental_days,
      );
    }
  }
}

function clearCategoryGlobalDefault(category, exceptId = null) {
  if (exceptId) {
    db.prepare('UPDATE store_products SET is_global_default = 0 WHERE category = ? AND id != ?').run(category, exceptId);
  } else {
    db.prepare('UPDATE store_products SET is_global_default = 0 WHERE category = ?').run(category);
  }
}

function migrateTournamentColumns() {
  const cols = [
    ['image_url', 'TEXT'],
    ['banner_url', 'TEXT'],
    ['sponsor_name', 'TEXT'],
    ['sponsor_url', 'TEXT'],
  ];
  for (const [name, type] of cols) {
    try {
      db.exec(`ALTER TABLE tournaments ADD COLUMN ${name} ${type}`);
    } catch (_) { /* exists */ }
  }
}

function productToPublic(row, { admin = false } = {}) {
  const now = new Date().toISOString();
  const expired = row.available_until && row.available_until < now;
  const outOfStock = row.stock_limit != null && row.sold_count >= row.stock_limit;
  const available = row.is_active && !expired && !outOfStock;
  return {
    id: row.id,
    category: row.category,
    category_label: STORE_CATEGORIES[row.category]?.label || row.category,
    name: row.name,
    description: row.description || '',
    image_url: row.image_url || '',
    asset_key: row.asset_key,
    price: row.price,
    is_free: !!row.is_free || row.price === 0,
    ownership_type: row.ownership_type,
    rental_days: row.rental_days,
    stock_limit: row.stock_limit,
    sold_count: row.sold_count,
    available_until: row.available_until,
    is_active: !!row.is_active,
    is_global_default: !!row.is_global_default,
    available,
    expired,
    out_of_stock: outOfStock,
    ...(admin ? { created_at: row.created_at, updated_at: row.updated_at } : {}),
  };
}

function listStoreProducts({ category = null, admin = false } = {}) {
  let rows;
  if (category) {
    rows = db.prepare('SELECT * FROM store_products WHERE category = ? ORDER BY created_at DESC').all(category);
  } else {
    rows = db.prepare('SELECT * FROM store_products ORDER BY created_at DESC').all();
  }
  const mapped = rows.map((r) => productToPublic(r, { admin }));
  if (admin) return mapped;
  return mapped.filter((p) => p.available && !p.is_global_default);
}

function getStoreProduct(id) {
  const row = db.prepare('SELECT * FROM store_products WHERE id = ?').get(id);
  return row ? productToPublic(row, { admin: true }) : null;
}

function validateProductData(data, isUpdate = false) {
  const category = data.category;
  if (!isUpdate && !STORE_CATEGORIES[category]) return { error: 'قسم المتجر غير صالح' };
  const name = (data.name || '').trim();
  if (!isUpdate && !name) return { error: 'اسم المنتج مطلوب' };
  const ownership = data.ownership_type || 'permanent';
  if (!['permanent', 'rental'].includes(ownership)) return { error: 'نوع الملكية غير صالح' };
  if (ownership === 'rental') {
    const days = parseInt(data.rental_days, 10);
    if (![7, 30].includes(days)) return { error: 'مدة الإيجار: 7 أو 30 يوم' };
  }
  const price = parseInt(data.price, 10);
  if (Number.isNaN(price) || price < 0) return { error: 'السعر غير صالح' };
  return null;
}

function createStoreProduct(data) {
  const err = validateProductData(data);
  if (err) return err;
  const { normalizeProductImageUrl } = require('./assetFolders');
  const imageUrl = normalizeProductImageUrl(data.category, data.image_url);
  const isGlobalDefault = !!data.is_global_default;
  if (isGlobalDefault) clearCategoryGlobalDefault(data.category);
  const isFree = isGlobalDefault || !!data.is_free || parseInt(data.price, 10) === 0;
  const ownership = data.ownership_type || 'permanent';
  const rentalDays = ownership === 'rental' ? parseInt(data.rental_days, 10) : null;
  const stockLimit = data.stock_limit === '' || data.stock_limit == null
    ? null
    : parseInt(data.stock_limit, 10);
  const info = db.prepare(`
    INSERT INTO store_products (
      category, name, description, image_url, asset_key, price, is_free,
      ownership_type, rental_days, stock_limit, available_until, is_active, is_global_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.category,
    data.name.trim().slice(0, 80),
    (data.description || '').slice(0, 300),
    imageUrl.slice(0, 500),
    (data.asset_key || `item_${Date.now()}`).slice(0, 80),
    isFree ? 0 : parseInt(data.price, 10),
    isFree ? 1 : 0,
    ownership,
    rentalDays,
    stockLimit,
    data.available_until || null,
    data.is_active === false || data.is_active === 0 ? 0 : 1,
    isGlobalDefault ? 1 : 0,
  );
  return { product: getStoreProduct(info.lastInsertRowid) };
}

function updateStoreProduct(id, data) {
  const existing = db.prepare('SELECT * FROM store_products WHERE id = ?').get(id);
  if (!existing) return { error: 'المنتج غير موجود' };
  const err = validateProductData({ ...existing, ...data, category: data.category || existing.category }, true);
  if (err) return err;
  const { normalizeProductImageUrl } = require('./assetFolders');
  const category = data.category || existing.category;
  const imageUrl = data.image_url !== undefined
    ? normalizeProductImageUrl(category, data.image_url)
    : existing.image_url;
  const isGlobalDefault = data.is_global_default != null
    ? !!data.is_global_default
    : !!existing.is_global_default;
  if (isGlobalDefault) clearCategoryGlobalDefault(data.category || existing.category, id);
  const isFree = isGlobalDefault
    ? true
    : (data.is_free != null ? !!data.is_free : !!existing.is_free);
  const price = data.price != null ? parseInt(data.price, 10) : existing.price;
  const ownership = data.ownership_type || existing.ownership_type;
  const rentalDays = ownership === 'rental'
    ? parseInt(data.rental_days ?? existing.rental_days, 10)
    : null;
  const stockLimit = data.stock_limit !== undefined
    ? (data.stock_limit === '' || data.stock_limit == null ? null : parseInt(data.stock_limit, 10))
    : existing.stock_limit;
  db.prepare(`
    UPDATE store_products SET
      category = ?, name = ?, description = ?, image_url = ?, asset_key = ?,
      price = ?, is_free = ?, ownership_type = ?, rental_days = ?,
      stock_limit = ?, available_until = ?, is_active = ?, is_global_default = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.category || existing.category,
    (data.name || existing.name).slice(0, 80),
    ((data.description ?? existing.description) || '').slice(0, 300),
    (imageUrl || '').slice(0, 500),
    (data.asset_key || existing.asset_key).slice(0, 80),
    isFree ? 0 : price,
    isFree ? 1 : 0,
    ownership,
    rentalDays,
    stockLimit,
    data.available_until !== undefined ? (data.available_until || null) : existing.available_until,
    data.is_active != null ? (data.is_active ? 1 : 0) : existing.is_active,
    isGlobalDefault ? 1 : 0,
    id,
  );
  return { product: getStoreProduct(id) };
}

function deleteStoreProduct(id) {
  const r = db.prepare('DELETE FROM store_products WHERE id = ?').run(id);
  if (!r.changes) return { error: 'المنتج غير موجود' };
  return { ok: true };
}

function getUserPurchases(userId) {
  return db.prepare(`
    SELECT p.*, pr.name AS product_name, pr.category, pr.image_url, pr.asset_key, pr.ownership_type
    FROM player_purchases p
    JOIN store_products pr ON pr.id = p.product_id
    WHERE p.user_id = ?
    ORDER BY p.purchased_at DESC
  `).all(userId);
}

function hasActivePurchase(userId, productId) {
  const row = db.prepare(`
    SELECT * FROM player_purchases
    WHERE user_id = ? AND product_id = ?
    ORDER BY purchased_at DESC LIMIT 1
  `).get(userId, productId);
  if (!row) return false;
  if (!row.expires_at) return true;
  return row.expires_at > new Date().toISOString();
}

function purchaseProduct(user, productId) {
  const row = db.prepare('SELECT * FROM store_products WHERE id = ?').get(productId);
  if (!row) return { error: 'المنتج غير موجود' };
  const product = productToPublic(row);
  if (!product.available) return { error: 'المنتج غير متاح في المتجر' };

  if (product.ownership_type === 'permanent' && hasActivePurchase(user.id, productId)) {
    return { error: 'تملك هذا المنتج مسبقاً' };
  }

  const deviceId = `user_${user.id}`;
  const profile = getOrCreatePlayer(deviceId, user.display_name);
  const price = product.is_free ? 0 : product.price;
  if (profile.coins < price) return { error: 'رصيد العملات غير كافٍ' };

  let expiresAt = null;
  if (product.ownership_type === 'rental') {
    const days = product.rental_days || 7;
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  profile.coins -= price;
  savePlayer(profile);

  db.prepare('INSERT INTO player_purchases (user_id, product_id, expires_at) VALUES (?, ?, ?)').run(
    user.id, productId, expiresAt,
  );
  db.prepare('UPDATE store_products SET sold_count = sold_count + 1, updated_at = datetime(\'now\') WHERE id = ?').run(productId);

  return {
    ok: true,
    coins: profile.coins,
    purchase: { product_id: productId, expires_at: expiresAt },
  };
}

module.exports = {
  STORE_CATEGORIES,
  BUILTIN_PRODUCTS,
  DEFAULT_DECK_KEY,
  DEFAULT_BG_KEY,
  initStoreSchema,
  migrateStoreGlobals,
  resetStoreToBuiltinDefaults,
  syncManualStoreProducts,
  MANUAL_STORE_PRODUCTS,
  migrateTournamentColumns,
  listStoreProducts,
  getStoreProduct,
  createStoreProduct,
  updateStoreProduct,
  deleteStoreProduct,
  getUserPurchases,
  purchaseProduct,
  productToPublic,
};
