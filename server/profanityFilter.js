/**
 * فلتر الكلمات المسيئة — تطبيع عربي + تكرار الحروف + قائمة قوية
 */

const BANNED_ROOTS = [
  'كس ام', 'كس ابو', 'كسم', 'كسب', 'قحب', 'خنيث', 'ديوث', 'عرضك',
  'زب', 'سالب', 'موجب', 'مبادل', 'لوطي', 'مببادل', 'زبي', 'كسس',
  'شرموط', 'شرموطة', 'منيوك', 'متناك', 'طيز', 'نيك', 'ينيك', 'انيك',
  'ابن الكلب', 'ابن القحبه', 'ابن القحبة', 'يلعن', 'كلب', 'حيوان',
  'عرص', 'معرص', 'فحل', 'شاذ', 'مخنث',
];

const CHAR_MAP = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه',
  'ﻻ': 'لا', 'لآ': 'لا', 'لأ': 'لا', 'لإ': 'لا',
};

const DIGIT_LEET = {
  '0': 'و', '1': 'ي', '2': 'ء', '3': 'ع', '4': 'ا', '5': 'خ',
  '6': 'ط', '7': 'ح', '8': 'ق', '9': 'ص',
};

function stripDiacritics(text) {
  return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
}

function normalizeArabic(text) {
  let s = stripDiacritics(String(text || '').toLowerCase());
  for (const [from, to] of Object.entries(CHAR_MAP)) {
    s = s.split(from).join(to);
  }
  for (const [from, to] of Object.entries(DIGIT_LEET)) {
    s = s.split(from).join(to);
  }
  s = s.replace(/[^\u0600-\u06FFa-z\s]/gi, ' ');
  s = s.replace(/[@$*#_\-+.]/g, ' ');
  return s;
}

function collapseRepeats(text, maxRun = 2) {
  let out = '';
  let prev = '';
  let run = 0;
  for (const ch of text) {
    if (ch === prev) {
      run += 1;
      if (run <= maxRun) out += ch;
    } else {
      prev = ch;
      run = 1;
      out += ch;
    }
  }
  return out;
}

function squashSpaces(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function prepareForScan(text) {
  const n = normalizeArabic(text);
  const collapsed = collapseRepeats(n.replace(/\s/g, ''), 2);
  const spaced = squashSpaces(collapseRepeats(n, 2));
  return { compact: collapsed, spaced };
}

function containsRoot(compact, spaced, root) {
  const rCompact = root.replace(/\s/g, '');
  const rSpaced = squashSpaces(root);
  if (rCompact.length >= 3 && compact.includes(rCompact)) return true;
  if (rSpaced.length >= 3 && spaced.includes(rSpaced)) return true;
  return false;
}

function scanProfanity(text) {
  if (!text || !String(text).trim()) return { blocked: false };
  const { compact, spaced } = prepareForScan(text);
  for (const root of BANNED_ROOTS) {
    if (containsRoot(compact, spaced, root)) {
      return { blocked: true, matched: root };
    }
  }
  return { blocked: false };
}

function maskProfanity(text) {
  const result = scanProfanity(text);
  if (!result.blocked) return text;
  return '***';
}

module.exports = {
  scanProfanity,
  maskProfanity,
  prepareForScan,
  BANNED_ROOTS,
};
