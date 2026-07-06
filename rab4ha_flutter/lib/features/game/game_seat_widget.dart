import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/rank_themes.dart';
import '../../shared/widgets/network_asset.dart';
import '../../shared/widgets/player_avatar.dart';
import '../auth/auth_provider.dart';
import 'game_controller.dart';
import 'game_labels.dart';
import 'turn_timer_ring.dart';

/// شارة الموزّع — تظهر على مقعد اللاعب الذي وزّع الجولة الحالية.
class DealerBadge extends StatelessWidget {
  const DealerBadge({super.key, this.size = 20});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [Color(0xFFF6D976), Color(0xFFB8860B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0xFF3A2A05), width: 1.2),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 3, offset: const Offset(0, 1)),
        ],
      ),
      child: Text(
        'D',
        style: TextStyle(
          color: const Color(0xFF2A1C02),
          fontWeight: FontWeight.w900,
          fontSize: size * 0.6,
          height: 1,
        ),
      ),
    );
  }
}

/// P39 — 3 فتحات هدية فوق المقعد.
class TableGiftSlots extends StatelessWidget {
  const TableGiftSlots({super.key, required this.slots});
  final List<dynamic> slots;

  @override
  Widget build(BuildContext context) {
    final items = slots.take(3).toList();
    while (items.length < 3) {
      items.add(null);
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: items.map((s) {
        final emoji = s is Map ? s['emoji']?.toString() : null;
        return Container(
          width: 20,
          height: 20,
          margin: const EdgeInsets.symmetric(horizontal: 1),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: emoji != null ? const Color(0xFF1A1A1A) : const Color(0xFF121212),
            borderRadius: BorderRadius.circular(5),
            border: Border.all(
              color: emoji != null ? Colors.amber.withValues(alpha: 0.55) : Colors.white54,
              width: 1.2,
            ),
            boxShadow: const [
              BoxShadow(color: Colors.black45, blurRadius: 4, offset: Offset(0, 1)),
            ],
          ),
          child: Text(emoji ?? '', style: const TextStyle(fontSize: 11)),
        );
      }).toList(),
    );
  }
}

Color? _parseGlow(String? hex) {
  if (hex == null || hex.isEmpty) return null;
  var h = hex.replaceFirst('#', '');
  if (h.length == 6) h = 'FF$h';
  final v = int.tryParse(h, radix: 16);
  return v != null ? Color(v) : null;
}

/// P21 — مقعد بصري كامل.
class GameSeatWidget extends StatelessWidget {
  const GameSeatWidget({
    super.key,
    required this.seatData,
    required this.name,
    required this.isTurn,
    required this.isPartner,
    required this.isDealer,
    required this.bidLabel,
    required this.handCount,
    required this.backUrl,
    required this.giftSlots,
    required this.bubble,
    required this.turnStartedAtMs,
    required this.showFan,
    this.verticalFan = false,
    this.fanAnchor,
  });

  final Map<String, dynamic>? seatData;
  final String name;
  final bool isTurn;
  final bool isPartner;
  final bool isDealer;
  final String? bidLabel;
  final int handCount;
  final String backUrl;
  final List<dynamic> giftSlots;
  final String? bubble;
  final int? turnStartedAtMs;
  final bool showFan;
  final bool verticalFan;
  /// `top` | `left` | `right` — يدخل نصف المروحة خلف الأفتار باتجاه الطاولة.
  final String? fanAnchor;

  static Offset _fanBehindAvatarOffset(String? anchor) {
    return switch (anchor) {
      'top' => const Offset(0, 18),
      'left' => const Offset(12, 2),
      'right' => const Offset(-12, 2),
      _ => Offset.zero,
    };
  }

  @override
  Widget build(BuildContext context) {
    final player = seatData ?? {'name': name};
    final glow = _parseGlow(player['deck_glow_color']?.toString());
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (bubble != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            margin: const EdgeInsets.only(bottom: 6),
            decoration: BoxDecoration(
              color: Colors.black87,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(bubble!, style: const TextStyle(fontSize: 12)),
          ),
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: isPartner && !isTurn
                ? Border.all(color: Colors.green.withValues(alpha: 0.5))
                : null,
            boxShadow: [
              if (glow != null) BoxShadow(color: glow.withValues(alpha: 0.5), blurRadius: 10),
            ],
          ),
          child: Column(
            children: [
              SizedBox(
                width: showFan && handCount > 0 && fanAnchor == 'top'
                    ? 72
                    : (verticalFan ? 52 : 56),
                height: showFan && handCount > 0 && fanAnchor == 'top' ? 70 : 56,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    if (showFan && handCount > 0)
                      Transform.translate(
                        offset: _fanBehindAvatarOffset(fanAnchor),
                        child: _SeatFan(
                          count: handCount,
                          backUrl: backUrl,
                          vertical: verticalFan,
                        ),
                      ),
                    Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.center,
                      children: [
                        TurnTimerRing(active: isTurn, startedAtMs: turnStartedAtMs, size: 56),
                        PlayerAvatar(data: player, size: 48, vipFrame: true),
                        if (isDealer)
                          const Positioned(
                            bottom: -6,
                            right: -6,
                            child: DealerBadge(),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              TableGiftSlots(slots: giftSlots),
              const SizedBox(height: 2),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      name,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  buildStatusBadgeFromMap(player, size: 14),
                ],
              ),
              buildRankPill(player, fontSize: 10),
              if (bidLabel != null)
                Text(
                  bidLabel!,
                  style: TextStyle(
                    color: bidLabel == 'صن' ? const Color(0xFFFBBF24) : Colors.white70,
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SeatFan extends StatelessWidget {
  const _SeatFan({required this.count, required this.backUrl, this.vertical = false});
  final int count;
  final String backUrl;
  final bool vertical;

  static const _cardW = 18.0;
  static const _cardH = 26.0;

  @override
  Widget build(BuildContext context) {
    final n = count.clamp(1, 8);
    final overlap = vertical ? 5.0 : 8.0;
    final totalW = vertical ? _cardW + 10 : _cardW + overlap * (n - 1);
    final totalH = vertical ? _cardH + overlap * (n - 1) : _cardH + 8;
    final back = backUrl.isNotEmpty ? backUrl : '/cards/back_dark.png';

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: SizedBox(
        width: totalW,
        height: totalH,
        child: Stack(
          clipBehavior: Clip.none,
          children: List.generate(n, (i) {
            final angle = (i - (n - 1) / 2) * (vertical ? 0.10 : 0.12);
            return Positioned(
              left: vertical ? 4 + (i - (n - 1) / 2) * 1.5 : i * overlap,
              top: vertical ? i * overlap : 0,
              child: Transform.rotate(
                angle: angle,
                child: Container(
                  width: _cardW,
                  height: _cardH,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    border: Border.all(color: Colors.white24),
                    color: const Color(0xFF3D2914),
                    boxShadow: const [
                      BoxShadow(color: Colors.black45, blurRadius: 2, offset: Offset(1, 1)),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: NetworkAssetImage(path: back, fit: BoxFit.cover),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

/// P38 — اختيار هدية + مستلم.
void showTableGiftFlow(BuildContext context, WidgetRef ref, GameController ctrl, GameState game) {
  final profile = ref.read(profileProvider);
  final coins = profile?.coins ?? 0;

  void pickRecipient(String giftId) {
    final gs = game.gs!;
    final mySeat = game.mySeat ?? 0;
    final seats = (gs['seats'] as List?) ?? [];
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text('اختر المستلم', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            ListTile(
              leading: const Text('👥', style: TextStyle(fontSize: 24)),
              title: const Text('الجميع'),
              onTap: () {
                Navigator.pop(ctx);
                ctrl.sendTableGift(giftId, 'all');
              },
            ),
            ...List.generate(4, (i) {
              // المشاهد يهدي كل اللاعبين الأربعة؛ اللاعب لا يهدي نفسه
              if (!game.isSpectator && i == mySeat) return const SizedBox.shrink();
              final seat = i < seats.length
                  ? Map<String, dynamic>.from(seats[i] as Map? ?? {})
                  : <String, dynamic>{};
              return ListTile(
                leading: PlayerAvatar(data: seat, size: 36),
                title: Text(seat['name']?.toString() ?? 'مقعد $i'),
                onTap: () {
                  Navigator.pop(ctx);
                  ctrl.sendTableGift(giftId, i);
                },
              );
            }),
          ],
        ),
      ),
    );
  }

  showModalBottomSheet(
    context: context,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('هدايا الطاولة — $tableGiftCost 🪙 لكل مستلم'),
            Text('رصيدك: ${formatCoins(coins)} 🪙', style: const TextStyle(color: Color(0xFF9CA3AF))),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: tableGifts.entries.map((e) {
                return IconButton(
                  icon: Text(e.value, style: const TextStyle(fontSize: 32)),
                  onPressed: () {
                    Navigator.pop(ctx);
                    pickRecipient(e.key);
                  },
                );
              }).toList(),
            ),
          ],
        ),
      ),
    ),
  );
}
