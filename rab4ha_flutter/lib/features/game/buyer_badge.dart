import 'package:flutter/material.dart';

import '../../core/theme/rab4ha_theme.dart';
import 'game_labels.dart';

/// شارة المشتري — صن / أشكل / حكم (+ مقفل/مفتوح أثناء التدبيل).
class SeatBuyerBadgeInfo {
  const SeatBuyerBadgeInfo({
    required this.primary,
    this.secondary,
    this.kind = SeatBuyerBadgeKind.sun,
  });

  final String primary;
  final String? secondary;
  final SeatBuyerBadgeKind kind;
}

enum SeatBuyerBadgeKind { sun, ashkal, hakam, doubling }

const _badgePhases = {
  'PLAYING',
  'DOUBLING',
  'HAKAM_CONFIRM',
  'HAKAM_COUNTER',
};

SeatBuyerBadgeInfo? seatBuyerBadge(Map<String, dynamic>? gs, int globalSeat) {
  if (gs == null) return null;
  final phase = gs['phase']?.toString() ?? '';
  if (!_badgePhases.contains(phase)) return null;

  final bid = gs['bid'] as Map<String, dynamic>?;
  if (bid == null || bid['type'] == null) return null;

  final buyerSeat = gs['buyer_seat'] as int? ?? bid['bidder'] as int?;
  final doubleLevel = (gs['double_level'] as num?)?.toInt() ?? 1;
  final lastDoubling = gs['last_doubling_seat'] as int?;
  final locked = gs['hakam_locked'] == true;
  final isAshkal = bid['is_ashkal'] == true;
  final bidType = bid['type']?.toString();
  final suit = bid['suit']?.toString();

  if (phase == 'DOUBLING' &&
      doubleLevel >= 2 &&
      lastDoubling != null &&
      lastDoubling == globalSeat &&
      bidType == 'HAKAM' &&
      suit != null) {
    return SeatBuyerBadgeInfo(
      primary: suitSym[suit] ?? suit,
      secondary: locked ? 'مقفل' : 'مفتوح',
      kind: SeatBuyerBadgeKind.doubling,
    );
  }

  if (buyerSeat != globalSeat) return null;

  if (phase == 'DOUBLING' && doubleLevel >= 2) return null;

  if (isAshkal) {
    return const SeatBuyerBadgeInfo(primary: 'أشكل', kind: SeatBuyerBadgeKind.ashkal);
  }
  if (bidType == 'SUN') {
    return const SeatBuyerBadgeInfo(primary: 'صن', kind: SeatBuyerBadgeKind.sun);
  }
  if (bidType == 'HAKAM') {
    final sym = suit != null ? (suitSym[suit] ?? '') : '';
    return SeatBuyerBadgeInfo(
      primary: sym.isNotEmpty ? 'حكم $sym' : 'حكم',
      kind: SeatBuyerBadgeKind.hakam,
    );
  }
  return null;
}

class SeatBuyerBadge extends StatelessWidget {
  const SeatBuyerBadge({super.key, required this.info});

  final SeatBuyerBadgeInfo info;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    final (bg, fg) = switch (info.kind) {
      SeatBuyerBadgeKind.sun => (c.gold, const Color(0xFF1A1A1A)),
      SeatBuyerBadgeKind.ashkal => (const Color(0xFF7C3AED), Colors.white),
      SeatBuyerBadgeKind.hakam => (const Color(0xFFF59E0B), const Color(0xFF1A1A1A)),
      SeatBuyerBadgeKind.doubling => (const Color(0xFF1A1A1A), c.goldLight),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: info.kind == SeatBuyerBadgeKind.doubling
            ? Border.all(color: c.gold, width: 1.2)
            : Border.all(color: Colors.white.withValues(alpha: 0.35)),
        boxShadow: const [
          BoxShadow(color: Colors.black45, blurRadius: 4, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            info.primary,
            style: TextStyle(
              color: fg,
              fontSize: info.kind == SeatBuyerBadgeKind.doubling ? 14 : 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (info.secondary != null) ...[
            const SizedBox(width: 4),
            Text(
              info.secondary!,
              style: TextStyle(
                color: info.secondary == 'مقفل' ? c.goldLight : Colors.white70,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
