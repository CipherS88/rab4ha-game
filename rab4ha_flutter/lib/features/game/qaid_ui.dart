// منطق واجهة خطوة إثبات القيد — مواقع الموزع + حلفاء المُعترض.

const qaidNeedsProof = {'قاطع', 'ما كبر بالحكم', 'ما دق بالحكم'};

bool qaidReasonNeedsProof(String? reason) =>
    reason != null && qaidNeedsProof.contains(reason);

int inferQaidStepFromSession(Map<String, dynamic>? session, bool objector, int localStep) {
  if (session == null) return 1;
  if (objector) return localStep;
  final reason = session['reason']?.toString();
  if (reason == null || reason.isEmpty) return 1;
  if (qaidReasonNeedsProof(reason) && ((session['cards'] as List?)?.length ?? 0) < 2) return 2;
  return 3;
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
