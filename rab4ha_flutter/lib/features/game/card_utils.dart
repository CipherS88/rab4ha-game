const suitPrefix = {
  'HEARTS': 'H',
  'DIAMONDS': 'D',
  'CLUBS': 'C',
  'SPADES': 'S',
};

const suitSortOrder = {
  'HEARTS': 0,
  'SPADES': 1,
  'DIAMONDS': 2,
  'CLUBS': 3,
};

const sunRanking = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const hakamRanking = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];

String cardImagePath(Map<String, dynamic>? card, {String? backUrl}) {
  if (card == null || card['hidden'] == true) {
    return backUrl ?? '/cards/back_dark.png';
  }
  final suit = card['suit']?.toString() ?? '';
  final rank = card['rank']?.toString() ?? '';
  return '/cards/${suitPrefix[suit] ?? 'H'}$rank.png';
}

bool cardEquals(Map<String, dynamic>? a, Map<String, dynamic>? b) =>
    a != null &&
    b != null &&
    a['suit'] == b['suit'] &&
    a['rank'] == b['rank'];

/// قبل التوزيع الثاني — نعرض 5 كروت فقط (لكنها مكشوفة).
bool isPreSecondDealHand(Map<String, dynamic> gs) {
  if (gs['hand_hidden'] == true) return true;
  final phase = gs['phase']?.toString() ?? '';
  return phase == 'HAKAM_COUNTER' ||
      phase == 'HAKAM_CONFIRM' ||
      (gs['hakam_pre_deal'] == true && phase == 'DOUBLING');
}

bool isHandHiddenPhase(Map<String, dynamic> gs) => isPreSecondDealHand(gs);

/// الكروت مكشوفة طول مرحلة الشراء والمزايدة.
bool shouldShowHandFaces(Map<String, dynamic> gs, {bool floorRevealed = true}) {
  final phase = gs['phase']?.toString() ?? '';
  if (phase == 'PLAYING' || phase == 'SCORE_SUMMARY') return true;
  if (gs['hands_revealed'] == true) return true;
  if ([
    'PHASE_1',
    'PHASE_2',
    'GABLAK_PHASE',
    'HAKAM_COUNTER',
    'HAKAM_CONFIRM',
    'DOUBLING',
  ].contains(phase)) {
    return true;
  }
  return false;
}

bool isBiddingFloorPhase(Map<String, dynamic> gs) {
  final fc = gs['floor_card'];
  if (fc == null) return false;
  final phase = gs['phase']?.toString() ?? '';
  return [
    'PHASE_1',
    'PHASE_2',
    'GABLAK_PHASE',
    'HAKAM_COUNTER',
    'HAKAM_CONFIRM',
    'DOUBLING',
  ].contains(phase);
}

List<MapEntry<int, Map<String, dynamic>>> sortHandForDisplay(
  List<dynamic> hand,
  Map<String, dynamic>? bid,
) {
  final isHakam = bid?['type'] == 'HAKAM' && bid?['suit'] != null;
  final hakamSuit = bid?['suit']?.toString();
  final indexed = hand.asMap().entries.map((e) {
    final c = Map<String, dynamic>.from(e.value as Map);
    return MapEntry(e.key, c);
  }).toList();
  indexed.sort((a, b) {
    final sa = (suitSortOrder[a.value['suit']] ?? 0) -
        (suitSortOrder[b.value['suit']] ?? 0);
    if (sa != 0) return sa;
    final ranks = isHakam && a.value['suit'] == hakamSuit
        ? hakamRanking
        : sunRanking;
    return ranks.indexOf(a.value['rank']) -
        ranks.indexOf(b.value['rank']);
  });
  return indexed;
}

List<Map<String, dynamic>> sandboxMockHand(int count) {
  const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return List.generate(count.clamp(1, 8), (i) {
    return {
      'suit': suits[i % suits.length],
      'rank': ranks[i % ranks.length],
    };
  });
}
