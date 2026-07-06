/// عناصر مقعد منفصلة للساندبوكس — تحكم مستقل بالأفتار والكروت والهدايا والاسم.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/rank_themes.dart';
import '../../shared/widgets/network_asset.dart';
import '../../shared/widgets/player_avatar.dart';
import 'buyer_badge.dart';
import 'game_controller.dart';
import 'game_labels.dart';
import 'game_layout.dart';
import 'game_seat_widget.dart';
import 'hand_fan.dart';
import 'layout_anim.dart';
import 'turn_timer_ring.dart';

const _botRankPresets = [
  (label: 'متقدم ♣️♦️', theme: 'gold'),
  (label: 'مبتدئ ♣️', theme: 'wood'),
  (label: 'خبير ♣️♦️♠️', theme: 'ruby'),
];

/// بيانات مقعد للعرض — يضيف تصنيفاً للبوتات إن لم يُرسل من السيرفر.
Map<String, dynamic> seatDisplayData(Map<String, dynamic>? seat, int globalSeat) {
  final m = Map<String, dynamic>.from(seat ?? {});
  final hasRank = (m['rank_label']?.toString().isNotEmpty == true) ||
      (m['rankLabel']?.toString().isNotEmpty == true);
  if (!hasRank) {
    final preset = _botRankPresets[globalSeat % _botRankPresets.length];
    m['rank_label'] = preset.label;
    m['rank_theme'] = preset.theme;
  }
  return m;
}

class OpponentHandFan extends StatelessWidget {
  const OpponentHandFan({
    super.key,
    required this.count,
    required this.backUrl,
    this.scale = 1.0,
    this.overlapMul = 1.0,
  });

  final int count;
  final String backUrl;
  final double scale;
  final double overlapMul;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();

    return LayoutBuilder(
      builder: (context, constraints) {
        final layout = OpponentFanLayout.forCount(
          count: count,
          scale: scale,
          overlapMul: overlapMul,
        );
        final back = backUrl.isNotEmpty ? backUrl : '/cards/back_dark.png';
        final maxW = constraints.maxWidth.isFinite ? constraints.maxWidth : layout.width;
        final maxH = constraints.maxHeight.isFinite ? constraints.maxHeight : layout.height;
        final fitScale = math.min(maxW / layout.width, maxH / layout.height);

        final fan = SizedBox(
          width: layout.width,
          height: layout.height,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.bottomCenter,
            children: List.generate(layout.count, (i) {
              final pose = handFanPose(i, layout.count);
              return AnimatedPositioned(
                duration: kLayoutAnimDuration,
                curve: kLayoutAnimCurve,
                left: i * layout.step,
                bottom: 0,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(end: pose.translateY),
                  duration: kLayoutAnimDuration,
                  curve: kLayoutAnimCurve,
                  builder: (context, ty, child) => TweenAnimationBuilder<double>(
                    tween: Tween(end: pose.rotationDeg),
                    duration: kLayoutAnimDuration,
                    curve: kLayoutAnimCurve,
                    builder: (context, rot, child) => Transform.translate(
                      offset: Offset(0, ty),
                      child: Transform.rotate(
                        angle: rot * math.pi / 180,
                        alignment: Alignment.bottomCenter,
                        child: child,
                      ),
                    ),
                    child: child,
                  ),
                  child: _fanCard(layout.cardW, layout.cardH, back),
                ),
              );
            }),
          ),
        );

        if (fitScale.isFinite && (fitScale - 1).abs() > 0.02) {
          return Center(
            child: Transform.scale(
              scale: fitScale,
              alignment: Alignment.bottomCenter,
              child: fan,
            ),
          );
        }
        return Center(child: fan);
      },
    );
  }

  Widget _fanCard(double w, double h, String back) {
    return AnimatedContainer(
      duration: kLayoutAnimDuration,
      curve: kLayoutAnimCurve,
      width: w,
      height: h,
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
    );
  }
}

class SandboxSeatAvatar extends StatelessWidget {
  const SandboxSeatAvatar({
    super.key,
    required this.seatData,
    required this.isTurn,
    required this.isDealer,
    required this.turnStartedAtMs,
  });

  final Map<String, dynamic>? seatData;
  final bool isTurn;
  final bool isDealer;
  final int? turnStartedAtMs;

  @override
  Widget build(BuildContext context) {
    final player = seatData ?? const {};
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        TurnTimerRing(active: isTurn, startedAtMs: turnStartedAtMs, size: 56),
        PlayerAvatar(data: player, size: 48, vipFrame: true),
        if (isDealer)
          const Positioned(bottom: -6, right: -6, child: DealerBadge()),
      ],
    );
  }
}

class SandboxSeatName extends StatelessWidget {
  const SandboxSeatName({
    super.key,
    required this.seatData,
    required this.name,
    required this.globalSeat,
  });

  final Map<String, dynamic>? seatData;
  final String name;
  final int globalSeat;

  @override
  Widget build(BuildContext context) {
    final player = seatDisplayData(seatData, globalSeat);
    if (name.isNotEmpty && player['name'] == null) {
      player['name'] = name;
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Flexible(
              child: Text(
                name,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ),
            buildStatusBadgeFromMap(player, size: 14),
          ],
        ),
        buildRankPill(player, fontSize: 10),
      ],
    );
  }
}

class SandboxSeatGifts extends StatelessWidget {
  const SandboxSeatGifts({super.key, required this.slots});
  final List<dynamic> slots;

  @override
  Widget build(BuildContext context) {
    return TableGiftSlots(slots: slots);
  }
}

class SandboxChatBubble extends StatelessWidget {
  const SandboxChatBubble({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white24),
      ),
      child: Text(text, style: const TextStyle(fontSize: 12, color: Colors.white)),
    );
  }
}

class SandboxSeatAvatarWithBubble extends StatelessWidget {
  const SandboxSeatAvatarWithBubble({
    super.key,
    required this.seatData,
    required this.isTurn,
    required this.isDealer,
    required this.turnStartedAtMs,
    this.bubble,
    this.buyerBadge,
  });

  final Map<String, dynamic>? seatData;
  final bool isTurn;
  final bool isDealer;
  final int? turnStartedAtMs;
  final String? bubble;
  final SeatBuyerBadgeInfo? buyerBadge;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (bubble != null) SandboxChatBubble(text: bubble!),
        Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            SandboxSeatAvatar(
              seatData: seatData,
              isTurn: isTurn,
              isDealer: isDealer,
              turnStartedAtMs: turnStartedAtMs,
            ),
            if (buyerBadge != null)
              Positioned(
                top: -12,
                child: SeatBuyerBadge(info: buyerBadge!),
              ),
          ],
        ),
      ],
    );
  }
}

/// بيانات مقعد للساندبوكس حسب الموضع البصري.
class SandboxSeatContext {
  SandboxSeatContext({
    required this.globalSeat,
    required this.seatData,
    required this.name,
    required this.backUrl,
    required this.giftSlots,
    required this.handCount,
    required this.fanAnchor,
  });

  final int globalSeat;
  final Map<String, dynamic>? seatData;
  final String name;
  final String backUrl;
  final List<dynamic> giftSlots;
  final int handCount;
  final String? fanAnchor;

  static SandboxSeatContext? forPosition({
    required GameState game,
    required String pos,
    required int handCount,
  }) {
    final gs = game.gs!;
    final mySeat = game.mySeat ?? 0;
    final gSeat = getGlobalSeat(pos, mySeat);
    if (pos == 'bottom') return null;
    final seats = (gs['seats'] as List?) ?? [];
    final seat = gSeat < seats.length
        ? Map<String, dynamic>.from(seats[gSeat] as Map? ?? {})
        : null;
    final slots = game.tableGiftSlots ?? List.generate(4, (_) => []);
    return SandboxSeatContext(
      globalSeat: gSeat,
      seatData: seatDisplayData(seat, gSeat),
      name: seat?['name']?.toString() ?? '',
      backUrl: seatDeckBackUrl(seat, gs['card_back_url']?.toString()),
      giftSlots: gSeat < slots.length ? (slots[gSeat] as List? ?? []) : [],
      handCount: handCount,
      fanAnchor: pos,
    );
  }
}

SandboxSeatContext bottomContext(GameState game) {
  final gs = game.gs!;
  final mySeat = game.mySeat ?? 0;
  final seats = (gs['seats'] as List?) ?? [];
  final seat = mySeat < seats.length
      ? Map<String, dynamic>.from(seats[mySeat] as Map? ?? {})
      : null;
  final slots = game.tableGiftSlots ?? [];
  return SandboxSeatContext(
    globalSeat: mySeat,
    seatData: seatDisplayData(seat, mySeat),
    name: seat?['name']?.toString() ?? '',
    backUrl: seatDeckBackUrl(seat, gs['card_back_url']?.toString()),
    giftSlots: mySeat < slots.length ? (slots[mySeat] as List? ?? []) : [],
    handCount: 0,
    fanAnchor: null,
  );
}

const sandboxSeatPositions = ['top', 'left', 'right'];

String seatPartId(String pos, String part) => 'seat_${pos}_$part';

List<String> allSandboxLayoutIds() => [
      ...GameLayoutConfig.ids,
      for (final p in sandboxSeatPositions) ...[
        seatPartId(p, 'avatar'),
        seatPartId(p, 'cards'),
        seatPartId(p, 'gifts'),
        seatPartId(p, 'name'),
      ],
      'seat_bottom_avatar',
      'seat_bottom_gifts',
      'seat_bottom_name',
      'floor_card',
    ];
