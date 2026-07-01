const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'الملفات');

const ASSET_DIRS = {
  cards: {
    dir: path.join(ROOT, 'cards'),
    urlPrefix: '/cards/',
    folderLabel: 'الملفات/cards',
  },
  session_bg: {
    dir: path.join(ROOT, 'roomsbackground'),
    urlPrefix: '/backgrounds/',
    folderLabel: 'الملفات/roomsbackground',
  },
};

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function ensureAssetDirs() {
  for (const cfg of Object.values(ASSET_DIRS)) {
    try {
      fs.mkdirSync(cfg.dir, { recursive: true });
    } catch (_) {}
  }
}

const FACE_CARD = /^[CDHS][0-9AJQK]{1,2}\.(png|jpg|jpeg|webp|gif)$/i;

function isStoreCardAsset(filename) {
  const lower = filename.toLowerCase();
  if (lower.startsWith('back')) return true;
  if (FACE_CARD.test(filename)) return false;
  return true;
}

function listCategoryAssets(category, { storePicker = false } = {}) {
  const cfg = ASSET_DIRS[category];
  if (!cfg) return { error: 'قسم غير مدعوم' };
  ensureAssetDirs();
  let files = [];
  try {
    files = fs.readdirSync(cfg.dir)
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .filter((f) => !storePicker || category !== 'cards' || isStoreCardAsset(f))
      .sort((a, b) => a.localeCompare(b, 'ar'))
      .map((filename) => ({
        filename,
        url: cfg.urlPrefix + filename,
      }));
  } catch (_) {
    files = [];
  }
  return {
    category,
    files,
    folder_label: cfg.folderLabel,
    url_prefix: cfg.urlPrefix,
  };
}

function normalizeProductImageUrl(category, imageUrl) {
  const raw = (imageUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/cards/') || raw.startsWith('/backgrounds/')) return raw;
  if (raw.startsWith('/')) return raw;
  const cfg = ASSET_DIRS[category];
  if (!cfg) return raw;
  const filename = raw.replace(/^.*[\\/]/, '');
  return cfg.urlPrefix + filename;
}

const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function sanitizeAssetKey(name) {
  const base = (name || 'asset')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  return base || `item_${Date.now()}`;
}

function uniqueFilename(dir, baseName, ext) {
  let candidate = `${baseName}${ext}`;
  let n = 0;
  while (fs.existsSync(path.join(dir, candidate))) {
    n += 1;
    candidate = `${baseName}_${n}${ext}`;
  }
  return candidate;
}

function saveStoreAssetImage(dataUrl, category, originalName = '') {
  const cfg = ASSET_DIRS[category];
  if (!cfg) return { error: 'قسم غير مدعوم' };
  if (!dataUrl || typeof dataUrl !== 'string') return { error: 'لم تُرفع صورة' };

  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
  if (!match) return { error: 'صيغة الصورة غير مدعومة — استخدم JPG أو PNG أو WebP' };

  const mime = match[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) return { error: 'نوع الصورة غير مدعوم' };

  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return { error: 'فشل قراءة الصورة' };
  }
  if (buffer.length > MAX_ASSET_BYTES) {
    return { error: 'حجم الصورة أكبر من 50 ميجا — صغّر الصورة وحاول مجدداً' };
  }

  ensureAssetDirs();

  let assetKey = sanitizeAssetKey(originalName);
  let fileBase = assetKey;
  if (category === 'cards' && !fileBase.toLowerCase().startsWith('back')) {
    fileBase = `back_${fileBase}`;
  }

  const filename = uniqueFilename(cfg.dir, fileBase, ext);
  const filePath = path.join(cfg.dir, filename);
  fs.writeFileSync(filePath, buffer);

  const finalAssetKey = sanitizeAssetKey(path.basename(filename, ext));

  return {
    url: cfg.urlPrefix + filename,
    filename,
    asset_key: finalAssetKey,
    folder: cfg.folderLabel,
  };
}

function saveStoreAssetBuffer(buffer, mime, category, originalName = '') {
  const cfg = ASSET_DIRS[category];
  if (!cfg) return { error: 'قسم غير مدعوم' };
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) return { error: 'لم تُرفع صورة' };
  if (buffer.length > MAX_ASSET_BYTES) {
    return { error: 'حجم الصورة أكبر من 50 ميجا — صغّر الصورة وحاول مجدداً' };
  }
  const ext = MIME_EXT[(mime || '').toLowerCase()] || path.extname(originalName).toLowerCase();
  if (!ext || !IMAGE_EXT.has(ext)) {
    return { error: 'نوع الصورة غير مدعوم — استخدم JPG أو PNG أو WebP' };
  }
  ensureAssetDirs();
  let fileBase = sanitizeAssetKey(originalName);
  if (category === 'cards' && !fileBase.toLowerCase().startsWith('back')) {
    fileBase = `back_${fileBase}`;
  }
  const filename = uniqueFilename(cfg.dir, fileBase, ext);
  fs.writeFileSync(path.join(cfg.dir, filename), buffer);
  const finalAssetKey = sanitizeAssetKey(path.basename(filename, ext));
  return {
    url: cfg.urlPrefix + filename,
    filename,
    asset_key: finalAssetKey,
    folder: cfg.folderLabel,
  };
}

module.exports = {
  ASSET_DIRS,
  ensureAssetDirs,
  listCategoryAssets,
  normalizeProductImageUrl,
  saveStoreAssetImage,
  saveStoreAssetBuffer,
  sanitizeAssetKey,
  MAX_ASSET_BYTES,
};
