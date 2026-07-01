export 'game_seats.dart';

const defaultSessionBgUrl = '/backgrounds/default.jpg';

String resolveSessionBgUrl(Map<String, dynamic>? gs, Map<String, dynamic>? room) {
  final fromGs = gs?['session_bg_url']?.toString();
  if (fromGs != null && fromGs.isNotEmpty) return fromGs;
  final fromRoom = room?['sessionBgUrl']?.toString();
  if (fromRoom != null && fromRoom.isNotEmpty) return fromRoom;
  return defaultSessionBgUrl;
}

const suitAr = {
  'HEARTS': 'هاص',
  'DIAMONDS': 'ديمن',
  'CLUBS': 'شيريا',
  'SPADES': 'سبيت',
};

const suitSym = {
  'HEARTS': '♥',
  'DIAMONDS': '♦',
  'CLUBS': '♣',
  'SPADES': '♠',
};

const rankAr = {
  'A': 'آس',
  'K': 'شايب',
  'Q': 'بنت',
  'J': 'ولد',
  '10': '10',
  '9': '9',
  '8': '8',
  '7': '7',
};

String formatBidLabel(Map<String, dynamic>? bidState) {
  if (bidState == null || bidState['bid_type'] == null) return '';
  if (bidState['bid_type'] == 'SUN') return 'صن';
  final suit = bidState['bid_suit']?.toString();
  final ar = suit != null ? (suitAr[suit] ?? suit) : '';
  return ar.isNotEmpty
      ? 'حكم ${suitSym[suit] ?? ''} $ar'
      : 'حكم';
}

const phaseLabels = {
  'INIT': 'استعداد',
  'PHASE_1': 'المزايدة الأولى',
  'GABLAK_PHASE': 'قبلك',
  'HAKAM_COUNTER': 'رد الحكم',
  'HAKAM_CONFIRM': 'تأكيد الحكم',
  'PHASE_2': 'المزايدة الثانية',
  'DOUBLING': 'التدبيل',
  'PLAYING': 'اللعب',
  'SCORE_SUMMARY': 'النتيجة',
};

const quickChatMessages = [
  'السلام عليكم', 'وعليكم السلام', 'فنااان', 'كفو خوي!', 'كفوك الطيب',
  'كبوت!', 'فدا', 'طرا', 'تسلم ليا', 'هههههه', 'بسرعة!!', 'حرام عليك',
  'صحصح خوي', 'سموحة', 'ابشر بالعوض', 'بطل!', 'طيار!!', 'ارحب',
  'ما قصرت', 'يا ساتر',
];

const tableGifts = {
  'wolf': '🐺',
  'coffee': '☕',
  'tea': '🍵',
  'plane': '✈️',
  'cigarette': '🚬',
  'rose': '🌹',
  'heart': '❤️',
};
const tableGiftCost = 5;

const projectNames = ['سرا', 'خمسين', 'مية', 'أربعمية'];
const projectMax = {'سرا': 2, 'خمسين': 2, 'مية': 2, 'أربعمية': 1};

/// نص الزر في الواجهة (المفتاح يبقى للسيرفر).
String projectDisplayLabel(String key) => switch (key) {
      'سرا' => 'السرا',
      'خمسين' => '50',
      'مية' => '100',
      'أربعمية' => '400',
      _ => key,
    };
