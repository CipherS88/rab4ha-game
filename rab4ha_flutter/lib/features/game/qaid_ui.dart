// منطق واجهة خطوة إثبات القيد — أسباب، مسارات الإرسال، مواقع الموزع.

const qaidNeedsProof = {'قاطع', 'ما كبر بالحكم', 'ما دق بالحكم'};

const qaidDirectSubmit = {'سوا غلط', 'إكة خاطئة'};

const qaidSunReasons = ['قاطع', 'سوا غلط'];

const qaidHakamReasons = [
  'قاطع',
  'ما كبر بالحكم',
  'ما دق بالحكم',
  'سوا غلط',
  'إكة خاطئة',
];

/// قيم wire المدعومة في السيرفر (QAID_REASON_ALIASES) — الواجهة تبقى عربية.
const qaidReasonWireValues = {
  'سوا غلط': 'sawa_ghalat',
  'إكة خاطئة': 'wrong_ekkah',
};

String qaidReasonForWire(String? reason) {
  if (reason == null || reason.isEmpty) return '';
  return qaidReasonWireValues[reason] ?? reason;
}

/// تحويل سبب الجلسة الوارد من السيرفر إلى نص العرض العربي.
String qaidReasonFromWire(String? reason) {
  if (reason == null || reason.isEmpty) return '';
  for (final entry in qaidReasonWireValues.entries) {
    if (entry.value == reason) return entry.key;
  }
  return reason;
}

bool qaidReasonNeedsProof(String? reason) =>
    reason != null && qaidNeedsProof.contains(reason);

bool qaidReasonNeedsDirectSubmit(String? reason) =>
    reason != null && qaidDirectSubmit.contains(reason);

bool isSunRound(Map<String, dynamic>? gs) {
  final bid = gs?['bid'];
  if (bid is! Map) return true;
  final type = bid['type']?.toString();
  if (type == 'SUN') return true;
  if (bid['is_ashkal'] == true) return true;
  return type != 'HAKAM';
}

/// أسباب القيد المعروضة في الواجهة حسب نوع الجولة.
List<String> qaidReasonsForRound(Map<String, dynamic>? gs) {
  final sawaActive = gs?['sawa_declaration'] != null;
  if (isSunRound(gs)) {
    return sawaActive ? List<String>.from(qaidSunReasons) : ['قاطع'];
  }
  if (!sawaActive) {
    return qaidHakamReasons.where((r) => r != 'سوا غلط').toList();
  }
  return List<String>.from(qaidHakamReasons);
}

int inferQaidStepFromSession(
  Map<String, dynamic>? session,
  bool objector,
  int localStep,
  String? reason,
) {
  if (session == null) return 1;
  if (objector) return localStep;
  final r = session['reason']?.toString() ?? reason;
  if (r == null || r.isEmpty) return 1;
  if (qaidReasonNeedsDirectSubmit(r)) return 1;
  if (qaidReasonNeedsProof(r) && ((session['cards'] as List?)?.length ?? 0) < 2) {
    return 2;
  }
  return 3;
}

int qaidNextStepAfterReason(String? reason) {
  if (reason == null) return 1;
  if (qaidReasonNeedsDirectSubmit(reason)) return 1;
  if (qaidReasonNeedsProof(reason)) return 2;
  return 3;
}

bool canSubmitQaid({required String? reason, required List cards, required bool submitting}) {
  if (submitting || reason == null || reason.isEmpty) return false;
  if (qaidReasonNeedsDirectSubmit(reason)) return true;
  if (qaidReasonNeedsProof(reason)) return cards.length >= 2;
  return false;
}

class QaidDealerPosition {
  const QaidDealerPosition({required this.arrow, required this.label});
  final String arrow;
  final String label;
}

bool isQaidAllySeat(int seat, int? objectorSeat) {
  if (objectorSeat == null) return false;
  return seat == objectorSeat || seat == (objectorSeat + 2) % 4;
}

QaidDealerPosition qaidDealerPosition(int seat, int? dealerIdx) {
  if (dealerIdx == null) return const QaidDealerPosition(arrow: '', label: '');
  final diff = (seat - dealerIdx + 4) % 4;
  return switch (diff) {
    0 => const QaidDealerPosition(arrow: '♦', label: 'موزع'),
    1 => const QaidDealerPosition(arrow: '→', label: 'يمين'),
    2 => const QaidDealerPosition(arrow: '↑', label: 'شريك'),
    3 => const QaidDealerPosition(arrow: '←', label: 'يسار'),
    _ => const QaidDealerPosition(arrow: '', label: ''),
  };
}
