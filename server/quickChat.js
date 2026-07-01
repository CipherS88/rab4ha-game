const QUICK_CHAT_MESSAGES = [
  'السلام عليكم',
  'وعليكم السلام',
  'فنااان',
  'كفو خوي!',
  'كفوك الطيب',
  'كبوت!',
  'فدا',
  'طرا',
  'تسلم ليا',
  'هههههه',
  'بسرعة!!',
  'حرام عليك',
  'صحصح خوي',
  'سموحة',
  'ابشر بالعوض',
  'بطل!',
  'طيار!!',
  'ارحب',
  'ما قصرت',
  'يا ساتر',
];

const ALLOWED = new Set(QUICK_CHAT_MESSAGES);

function isAllowedQuickChat(text) {
  return ALLOWED.has(String(text || '').trim());
}

module.exports = { QUICK_CHAT_MESSAGES, isAllowedQuickChat };
