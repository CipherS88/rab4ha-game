const crypto = require('crypto');

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const SECRET = process.env.TOURNAMENT_CAPTCHA_SECRET || 'rab4ha-rec-tourney-captcha-v1';

function signPayload(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

/** إنشاء لغز بسيط (جمع رقمين) مع توكن موقّع. */
function createJoinCaptcha() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 9);
  const answer = a + b;
  const exp = Date.now() + CAPTCHA_TTL_MS;
  const payload = `${a}|${b}|${answer}|${exp}`;
  return {
    question: `${a} + ${b} = ?`,
    token: `${Buffer.from(payload).toString('base64url')}.${signPayload(payload)}`,
    expires_in_sec: Math.floor(CAPTCHA_TTL_MS / 1000),
  };
}

function verifyJoinCaptcha(token, userAnswer) {
  if (!token || userAnswer == null || userAnswer === '') {
    return { error: 'أكمل اللغز للتسجيل' };
  }
  const parts = String(token).split('.');
  if (parts.length !== 2) return { error: 'انتهت صلاحية اللغز — حاول مجدداً' };
  const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
  if (signPayload(payload) !== parts[1]) return { error: 'لغز غير صالح' };
  const segs = payload.split('|');
  if (segs.length !== 4) return { error: 'لغز غير صالح' };
  const expected = parseInt(segs[2], 10);
  const exp = parseInt(segs[3], 10);
  if (Date.now() > exp) return { error: 'انتهت صلاحية اللغز — حاول مجدداً' };
  const given = parseInt(String(userAnswer).trim(), 10);
  if (!Number.isFinite(given) || given !== expected) {
    return { error: 'إجابة خاطئة — حاول مجدداً' };
  }
  return { ok: true };
}

module.exports = { createJoinCaptcha, verifyJoinCaptcha };
