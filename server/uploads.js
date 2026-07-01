const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_ROOT = path.join(__dirname, '..', 'public', 'uploads');
const ALLOWED_FOLDERS = new Set(['products', 'tournaments', 'chat', 'avatars']);
const MAX_BYTES = 50 * 1024 * 1024;
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function ensureUploadDirs() {
  for (const folder of ALLOWED_FOLDERS) {
    const dir = path.join(UPLOADS_ROOT, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function saveUploadedImage(dataUrl, folder = 'products') {
  if (!ALLOWED_FOLDERS.has(folder)) return { error: 'مجلد غير صالح' };
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

  if (buffer.length > MAX_BYTES) return { error: 'حجم الصورة أكبر من 50 ميجا — صغّر الصورة وحاول مجدداً' };

  ensureUploadDirs();
  const name = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const filePath = path.join(UPLOADS_ROOT, folder, name);
  fs.writeFileSync(filePath, buffer);

  return { url: `/uploads/${folder}/${name}` };
}

module.exports = {
  UPLOADS_ROOT,
  ensureUploadDirs,
  saveUploadedImage,
};
