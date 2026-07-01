import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/rab4ha_theme.dart';
import '../../shared/widgets/network_asset.dart';
import 'card_utils.dart';
import 'game_controller.dart';
import 'game_seats.dart';

const seatSpreadAnchors = {
  'top': Alignment(0, -0.72),
  'bottom': Alignment(0, 0.55),
  'left': Alignment(-0.82, 0),
  'right': Alignment(0.82, 0),
};

Widget spreadCardsPanel({
  required List cards,
  required String backUrl,
  required Rab4haDimensions dims,
  String? label,
}) {
  return Container(
    padding: const EdgeInsets.all(8),
    decoration: BoxDecoration(
      color: const Color(0xFF121212),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: Colors.amber.withValues(alpha: 0.85), width: 1.5),
      boxShadow: const [
        BoxShadow(color: Colors.black54, blurRadius: 10, offset: Offset(0, 4)),
      ],
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null && label.isNotEmpty)
          Text(label, style: const TextStyle(fontSize: 10, color: Colors.amber)),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: cards.take(8).map((c) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: SizedBox(
                width: dims.cardSmW * 0.85,
                height: dims.cardSmH * 0.85,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: Colors.white70, width: 1),
                    boxShadow: const [
                      BoxShadow(color: Colors.black54, blurRadius: 4),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: NetworkAssetImage(
                      path: cardImagePath(Map<String, dynamic>.from(c as Map), backUrl: backUrl),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    ),
  );
}

/// P25 — overlay توزيع الأوراق.
class DealingOverlay extends StatelessWidget {
  const DealingOverlay({super.key});
  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Container(
        color: Colors.black54,
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Colors.amber),
              SizedBox(height: 16),
              Text(
                'جاري التوزيع...',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// P29 — عرض المشاريع المكشوفة.
class ProjectSpreadsOverlay extends StatelessWidget {
  const ProjectSpreadsOverlay({required this.game, super.key});
  final GameState game;

  static const _anchors = seatSpreadAnchors;

  @override
  Widget build(BuildContext context) {
    final gs = game.gs!;
    if (gs['phase'] != 'PLAYING' || gs['sawa_declaration'] != null) {
      return const SizedBox.shrink();
    }
    final spreads = gs['spreads'] as Map? ?? {};
    final reveals = gs['reveals'] as Map? ?? {};
    final names = gs['declared_project_names'] as Map? ?? {};
    final counts = gs['hand_counts'] as List? ?? [];
    final back = gs['card_back_url']?.toString() ?? '/cards/back_dark.png';
    final dims = rab4haDims(context);
    final mySeat = game.mySeat ?? 0;

    return Stack(
      children: visualPositions.map((pos) {
        final gSeat = getGlobalSeat(pos, mySeat);
        if (gSeat >= counts.length || (counts[gSeat] as int? ?? 0) <= 6) {
          return const SizedBox.shrink();
        }
        final spreadCards = (spreads['$gSeat'] as List?) ??
            (reveals['$gSeat'] is Map ? (reveals['$gSeat'] as Map)['cards'] as List? : null);
        if (spreadCards == null || spreadCards.isEmpty) return const SizedBox.shrink();
        final labelList = reveals['$gSeat'] is Map
            ? ((reveals['$gSeat'] as Map)['names'] as List?)?.cast<String>()
            : (names['$gSeat'] as List?)?.cast<String>();
        final label = labelList?.join(' · ') ?? '';
        return Align(
          alignment: _anchors[pos] ?? Alignment.center,
          child: spreadCardsPanel(
            cards: spreadCards,
            backUrl: back,
            dims: dims,
            label: label.isNotEmpty ? label : null,
          ),
        );
      }).toList(),
    );
  }
}

/// P30 — سوا: كروت المُعلِن في الوسط + كروت الخصم كمشاريع.
class SawaSpreadsOverlay extends ConsumerStatefulWidget {
  const SawaSpreadsOverlay({required this.game, super.key});
  final GameState game;

  @override
  ConsumerState<SawaSpreadsOverlay> createState() => _SawaSpreadsOverlayState();
}

class _SawaSpreadsOverlayState extends ConsumerState<SawaSpreadsOverlay> {
  Timer? _tick;
  int _objectionLeft = 0;

  @override
  void initState() {
    super.initState();
    _syncTimer();
  }

  @override
  void didUpdateWidget(covariant SawaSpreadsOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncTimer();
  }

  void _syncTimer() {
    _tick?.cancel();
    final decl = widget.game.gs?['sawa_declaration'] as Map?;
    if (decl == null) return;
    final deadline = decl['objection_deadline'];
    if (deadline == null) return;
    void update() {
      if (!mounted) return;
      final ms = deadline is int
          ? deadline
          : int.tryParse('$deadline') ?? 0;
      setState(() => _objectionLeft = ((ms - DateTime.now().millisecondsSinceEpoch) / 1000).ceil());
    }
    update();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => update());
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  List<Widget> _opponentSpreads(
    Map<String, dynamic> decl,
    List hands,
    String back,
    Rab4haDimensions dims,
    int? mySeat,
  ) {
    return visualPositions.map((pos) {
      final gSeat = getGlobalSeat(pos, mySeat);
      if (!isSawaOpponentSeat(gSeat, decl)) return const SizedBox.shrink();
      List? cards;
      String? name;
      for (final h in hands) {
        final m = Map<String, dynamic>.from(h as Map);
        if (m['seat'] == gSeat) {
          cards = m['cards'] as List?;
          name = m['name']?.toString();
          break;
        }
      }
      if (cards == null || cards.isEmpty) return const SizedBox.shrink();
      return Align(
        alignment: seatSpreadAnchors[pos] ?? Alignment.center,
        child: spreadCardsPanel(
          cards: cards,
          backUrl: back,
          dims: dims,
          label: name,
        ),
      );
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final gs = widget.game.gs!;
    final decl = Map<String, dynamic>.from(gs['sawa_declaration'] as Map);
    final hands = (gs['sawa_hands'] as List?) ?? [];
    final back = gs['card_back_url']?.toString() ?? '/cards/back_dark.png';
    final dims = rab4haDims(context);
    final qaid = gs['qaid_session'] != null;
    final phase = decl['phase']?.toString() ?? '';
    final declarerSeat = decl['seat'] as int?;
    Map<String, dynamic>? declarerHand;
    for (final h in hands) {
      final m = Map<String, dynamic>.from(h as Map);
      if (m['seat'] == declarerSeat) {
        declarerHand = m;
        break;
      }
    }
    final cards = declarerHand?['cards'] as List? ?? [];
    final scatterKey = '$declarerSeat-${decl['declared_at']}';

    return Stack(
      children: [
        ..._opponentSpreads(decl, hands, back, dims, widget.game.mySeat),
        if (cards.isNotEmpty)
          Positioned.fill(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final rnd = math.Random(scatterKey.hashCode);
                final cx = constraints.maxWidth / 2;
                final cy = constraints.maxHeight * 0.44;
                final spreadW = constraints.maxWidth * 0.34;
                final spreadH = constraints.maxHeight * 0.26;
                final cardW = dims.cardSmW * 0.92;
                final cardH = dims.cardSmH * 0.92;

                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      left: cx - 24,
                      top: cy - spreadH * 0.85,
                      child: const Text(
                        'سوا',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: Color(0xFFFFE08A),
                          shadows: [Shadow(color: Colors.black87, blurRadius: 6)],
                        ),
                      ),
                    ),
                    ...List.generate(cards.length, (i) {
                      final dx = (rnd.nextDouble() - 0.5) * spreadW;
                      final dy = (rnd.nextDouble() - 0.5) * spreadH;
                      final rot = (rnd.nextDouble() - 0.5) * 0.5;
                      return Positioned(
                        left: cx + dx - cardW / 2,
                        top: cy + dy - cardH / 2,
                        child: TweenAnimationBuilder<double>(
                          key: ValueKey('$scatterKey-$i'),
                          tween: Tween(begin: 0, end: 1),
                          duration: Duration(milliseconds: 320 + i * 45),
                          curve: Curves.easeOutBack,
                          builder: (context, t, child) {
                            return Opacity(
                              opacity: t.clamp(0.0, 1.0),
                              child: Transform.scale(
                                scale: 0.55 + t * 0.45,
                                child: Transform.rotate(angle: rot * t, child: child),
                              ),
                            );
                          },
                          child: Container(
                            width: cardW,
                            height: cardH,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFF0C96A).withValues(alpha: 0.65)),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x59F0C96A),
                                  blurRadius: 10,
                                  offset: Offset(0, 4),
                                ),
                              ],
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: NetworkAssetImage(
                                path: cardImagePath(
                                  Map<String, dynamic>.from(cards[i] as Map),
                                  backUrl: back,
                                ),
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                );
              },
            ),
          ),
        if (!qaid && (phase == 'objection' || phase == 'reveal') && _objectionLeft > 0)
          Positioned(
            top: MediaQuery.paddingOf(context).top + 90,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF7F1D1D),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('سوا — فرصة اعتراض', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('$_objectionLeft ث', style: const TextStyle(color: Colors.amber, fontSize: 18)),
                  TextButton(
                    onPressed: () => ref.read(gameControllerProvider.notifier).qaidStart(),
                    child: const Text('قيد'),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// P40 — أنيميشن طيران هدية الطاولة.
class TableGiftFlyOverlay extends ConsumerWidget {
  const TableGiftFlyOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fly = ref.watch(gameControllerProvider.select((s) => s.tableGiftFly));
    if (fly == null) return const SizedBox.shrink();
    final emoji = fly['emoji']?.toString() ?? '🎁';
    return Positioned.fill(
      child: IgnorePointer(
        child: TweenAnimationBuilder<double>(
          key: ValueKey(fly['at']),
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 680),
          builder: (context, t, child) {
            final from = fly['fromAlign'] as Alignment? ?? Alignment.center;
            final to = fly['toAlign'] as Alignment? ?? Alignment.center;
            return Align(
              alignment: Alignment.lerp(from, to, Curves.easeInOut.transform(t))!,
              child: Text(emoji, style: const TextStyle(fontSize: 36)),
            );
          },
        ),
      ),
    );
  }
}

/// P26/P67 — overlay جمع الكروت.
class TrickCollectOverlay extends StatelessWidget {
  const TrickCollectOverlay({required this.game, super.key});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    final collect = game.trickCollect;
    if (collect == null) return const SizedBox.shrink();
    final dims = rab4haDims(context);
    final back = game.gs?['card_back_url']?.toString() ?? '/cards/back_dark.png';
    final cards = collect['cards'] as List? ?? [];
    return Center(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 360),
        builder: (context, t, _) {
          return Opacity(
            opacity: 1 - t,
            child: Transform.scale(
              scale: 1 - t * 0.3,
              child: Wrap(
                spacing: 6,
                children: cards.map((item) {
                  final card = Map<String, dynamic>.from((item as Map)['card'] as Map? ?? {});
                  return SizedBox(
                    width: dims.cardSmW,
                    height: dims.cardSmH,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: NetworkAssetImage(path: cardImagePath(card, backUrl: back)),
                    ),
                  );
                }).toList(),
              ),
            ),
          );
        },
      ),
    );
  }
}
