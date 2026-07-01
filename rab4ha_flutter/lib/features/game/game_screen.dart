import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/rab4ha_theme.dart';
import '../../core/theme/rank_themes.dart';
import '../../shared/widgets/buttons.dart';
import '../../shared/widgets/network_asset.dart';
import '../auth/auth_provider.dart';
import 'card_utils.dart';
import 'game_controller.dart';
import 'game_labels.dart';
import 'game_seats.dart';
import 'game_overlays.dart';
import 'game_seat_widget.dart';
import 'hand_fan.dart';
import 'trick_table.dart';
import 'qaid_wizard.dart';
import 'game_layout.dart';
import 'game_layout_provider.dart';
import 'game_layout_slot.dart';
import 'layout_anim.dart';
import 'bid_cards.dart';
import 'buyer_badge.dart';
import 'sandbox_toolbar.dart';
import 'sandbox_layout_parts.dart';

class GameScreen extends ConsumerWidget {
  const GameScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final game = ref.watch(gameControllerProvider);
    final gs = game.gs;
    ref.listen(gameControllerProvider.select((s) => s.error), (_, err) {
      if (err != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      }
    });
    ref.listen(gameControllerProvider.select((s) => s.roomCloseSignal), (prev, next) {
      if (next > 0 && context.mounted) context.go('/home');
    });
    if (gs == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('اللعب')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (game.matchEnd != null) {
      return _MatchEndOverlay(
        matchEnd: game.matchEnd!,
        matchMode: game.matchMode,
        mySeat: game.mySeat,
        onLeave: () async {
          await ref.read(gameControllerProvider.notifier).leaveGame();
          if (context.mounted) context.go('/home');
        },
        onPlayAgain: () async {
          await ref.read(gameControllerProvider.notifier).leaveGame();
          if (!context.mounted) return;
          final profile = ref.read(profileProvider);
          final name = profile?.name ?? 'لاعب';
          final mode = game.matchMode;
          final ok = await ref.read(matchmakingProvider.notifier).start(
                solo: false,
                mode: mode,
                name: name,
              );
          if (context.mounted && ok) context.go('/matchmaking');
        },
      );
    }
    if (game.matchMode == 'sandbox') {
      return _LayoutGameScreen(
        game: game,
        sandbox: true,
        onLeave: () => _confirmLeave(context, ref, game.matchMode),
      );
    }
    return Scaffold(
      body: Stack(
        children: [
          _LayoutGameScreen(
            game: game,
            sandbox: false,
            onLeave: () => _confirmLeave(context, ref, game.matchMode),
            showBidPanel: _showBidPanel(game),
            showProjectPanel: _showProjectBar(game),
          ),
          if (game.soloMode) _SoloBanner(controlSeat: game.controlSeat),
          if (game.dealingVisible) const DealingOverlay(),
          ProjectSpreadsOverlay(game: game),
          if (gs['sawa_declaration'] != null) SawaSpreadsOverlay(game: game),
          TrickCollectFlyLayer(),
          const TableGiftFlyOverlay(),
          if (game.tableGiftToast != null)
            Positioned(
              top: MediaQuery.paddingOf(context).top + 100,
              left: 24,
              right: 24,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.black87,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(game.tableGiftToast!, style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ),
          if (game.qaidModalOpen || gs['qaid_session'] != null) QaidWizardOverlay(game: game),
          if (gs['phase'] == 'SCORE_SUMMARY' && gs['summary_data'] != null)
            _ScoreSummaryOverlay(game: game),
        ],
      ),
    );
  }

  static int _handCountForLayout(GameState game, int previewCount) {
    if (game.matchMode == 'sandbox') return previewCount;
    final gs = game.gs;
    if (gs == null) return 8;
    final hand = (gs['my_hand'] as List?) ?? [];
    final capped = isPreSecondDealHand(gs) ? hand.take(5).toList() : hand;
    return capped.isEmpty ? 8 : capped.length.clamp(1, 8);
  }

  static ResolvedGameLayout _resolvedLayout(GameLayoutState layout, GameState game) {
    final count = _handCountForLayout(game, layout.previewCardCount);
    if (game.matchMode == 'sandbox' && layout.editMode && layout.draft != null) {
      return layout.active;
    }
    return layout.config.resolve(count);
  }

  bool _showBidPanel(GameState game) {
    final gs = game.gs!;
    final bids = gs['available_bids'] as List? ?? [];
    return bids.isNotEmpty &&
        game.isMyTurnToAct() &&
        gs['phase'] != 'SCORE_SUMMARY';
  }

  bool _showProjectBar(GameState game) {
    final gs = game.gs!;
    final played = (gs['played_in_trick1'] as Map?)?['${game.controlSeat}'];
    return gs['phase'] == 'PLAYING' &&
        gs['trick_count'] == 1 &&
        played != true;
  }

  Future<void> _confirmLeave(BuildContext context, WidgetRef ref, String mode) async {
    if (mode == 'ranked' && ref.read(gameControllerProvider).gs?['phase'] != 'SCORE_SUMMARY') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('مغادرة المباراة'),
          content: const Text(
            'تحذير: الخروج من مباراة مصنّفة يخصم منك 100 نقطة.\n\nهل تريد المغادرة؟',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('مغادرة')),
          ],
        ),
      );
      if (ok != true) return;
    }
    await ref.read(gameControllerProvider.notifier).leaveGame();
    if (context.mounted) context.go('/home');
  }

  List<Widget> _buildSeats(BuildContext context, WidgetRef ref, GameState game) {
    final gs = game.gs!;
    final mySeat = game.mySeat ?? 0;
    final globalBack = gs['card_back_url']?.toString();
    final slots = game.tableGiftSlots ?? List.generate(4, (_) => []);
    final partnerSeat = (mySeat + 2) % 4;
    final sawaDecl = gs['sawa_declaration'] as Map?;
    final sawaDeclarer = sawaDecl?['seat'] as int?;

    return visualPositions.map((pos) {
      final gSeat = getGlobalSeat(pos, mySeat);
      final seat = gSeat < (gs['seats'] as List? ?? []).length
          ? Map<String, dynamic>.from((gs['seats'] as List)[gSeat] as Map? ?? {})
          : null;
      final name = seat?['name']?.toString() ?? '';
      final isBottom = pos == 'bottom';
      final handCount = (gs['hand_counts'] as List?)?[gSeat] as int? ?? 0;
      final back = seatDeckBackUrl(seat, globalBack);
      final qaidActive = gs['qaid_session'] != null;
      final isTurn = !qaidActive && gs['turn'] == gSeat && gs['phase'] != 'SCORE_SUMMARY';
      final bubble = game.chatBubbles[gSeat];
      final bidLabel = gs['bid']?['bidder'] == gSeat &&
              ['PLAYING', 'DOUBLING', 'SCORE_SUMMARY'].contains(gs['phase'])
          ? (gs['bid']?['type'] == 'SUN' ? 'صن' : 'حكم')
          : null;
      final giftSlots = gSeat < slots.length ? (slots[gSeat] as List? ?? []) : [];
      Alignment align = switch (pos) {
        'top' => Alignment.topCenter,
        'bottom' => Alignment.bottomCenter,
        'left' => Alignment.centerLeft,
        'right' => Alignment.centerRight,
        _ => Alignment.center,
      };
      if (isBottom) return const SizedBox.shrink();

      return Align(
        alignment: align,
        child: Padding(
          padding: EdgeInsets.only(
            top: pos == 'top' ? 80 : 0,
            bottom: pos == 'bottom' ? 12 : 0,
            left: pos == 'left' ? 12 : 0,
            right: pos == 'right' ? 12 : 0,
          ),
          child: GameSeatWidget(
            seatData: seat,
            name: name,
            isTurn: isTurn,
            isPartner: gSeat == partnerSeat,
            isDealer: gs['dealer_idx'] == gSeat,
            bidLabel: bidLabel,
            handCount: handCount,
            backUrl: back,
            giftSlots: giftSlots,
            bubble: bubble,
            turnStartedAtMs: isTurn ? game.turnStartedAtMs : null,
            showFan: !isBottom &&
                (sawaDecl == null ||
                    (gSeat != sawaDeclarer &&
                        !isSawaOpponentSeat(gSeat, Map<String, dynamic>.from(sawaDecl)))),
            verticalFan: pos == 'left' || pos == 'right',
            fanAnchor: pos,
          ),
        ),
      );
    }).whereType<Align>().toList();
  }
}

class _BottomPlayerSeat extends StatelessWidget {
  const _BottomPlayerSeat({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    final gs = game.gs!;
    final sawaDeclarer = (gs['sawa_declaration'] as Map?)?['seat'] as int?;
    if (sawaDeclarer == game.mySeat) return const SizedBox.shrink();
    final mySeat = game.mySeat ?? 0;
    final seats = (gs['seats'] as List?) ?? [];
    final seat = mySeat < seats.length
        ? Map<String, dynamic>.from(seats[mySeat] as Map? ?? {})
        : null;
    final name = seat?['name']?.toString() ?? '';
    final qaidActive = gs['qaid_session'] != null;
    final isTurn = !qaidActive && gs['turn'] == mySeat && gs['phase'] != 'SCORE_SUMMARY';
    final bubble = game.chatBubbles[mySeat];
    final partnerSeat = (mySeat + 2) % 4;
    final slots = game.tableGiftSlots ?? [];
    final giftSlots = mySeat < slots.length ? (slots[mySeat] as List? ?? []) : [];
    final bidLabel = gs['bid']?['bidder'] == mySeat &&
            ['PLAYING', 'DOUBLING', 'SCORE_SUMMARY'].contains(gs['phase'])
        ? (gs['bid']?['type'] == 'SUN' ? 'صن' : 'حكم')
        : null;

    return GameSeatWidget(
      seatData: seat,
      name: name,
      isTurn: isTurn,
      isPartner: mySeat == partnerSeat,
      isDealer: gs['dealer_idx'] == mySeat,
      bidLabel: bidLabel,
      handCount: 0,
      backUrl: seatDeckBackUrl(seat, gs['card_back_url']?.toString()),
      giftSlots: giftSlots,
      bubble: bubble,
      turnStartedAtMs: isTurn ? game.turnStartedAtMs : null,
      showFan: false,
    );
  }
}

class _FeltPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..shader = const RadialGradient(
        colors: [Color(0xFF2D5A45), Color(0xFF1A3D2E), Color(0xFF0F2619)],
        stops: [0.0, 0.6, 1.0],
      ).createShader(rect);
    canvas.drawRect(rect, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ScoreBar extends StatelessWidget {
  const _ScoreBar({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    final gs = game.gs!;
    final us = getMyTeam(game.mySeat);
    final them = us == 1 ? 2 : 1;
    final scores = gs['total_scores'] as Map? ?? {};
    var phase = phaseLabels[gs['phase']] ?? gs['phase']?.toString() ?? '';
    if (gs['sun_over100_special'] == true) phase = 'صن فوق المية · دبل فقط';
    if (gs['qaid_session'] != null) phase = 'قيد جاري — الوقت متوقف';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('نحن: ${scores['$us'] ?? 0}'),
          Flexible(child: Text(phase, textAlign: TextAlign.center)),
          Text('هم: ${scores['$them'] ?? 0}'),
        ],
      ),
    );
  }
}

class _MyHand extends ConsumerWidget {
  const _MyHand({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gs = game.gs!;
    final sawaDecl = gs['sawa_declaration'] as Map?;
    final sawaDeclarer = sawaDecl?['seat'] as int?;
    final mySeat = game.mySeat ?? 3;
    if (sawaDecl != null) {
      final decl = Map<String, dynamic>.from(sawaDecl);
      if (sawaDeclarer == mySeat) return const SizedBox.shrink();
      if (isSawaOpponentSeat(mySeat, decl)) return const SizedBox.shrink();
    }
    final hand = (gs['my_hand'] as List?) ?? [];
    final bid = gs['bid'] as Map<String, dynamic>?;
    final seats = (gs['seats'] as List?) ?? [];
    final seatMap = mySeat < seats.length
        ? Map<String, dynamic>.from(seats[mySeat] as Map? ?? {})
        : null;
    final back = seatDeckBackUrl(seatMap, gs['card_back_url']?.toString());
    final showFaces = shouldShowHandFaces(gs);
    final layoutState = ref.watch(gameLayoutProvider);
    final handCount = game.matchMode == 'sandbox'
        ? layoutState.previewCardCount
        : GameScreen._handCountForLayout(game, layoutState.previewCardCount);
    final resolved = game.matchMode == 'sandbox' && layoutState.editMode
        ? layoutState.active
        : layoutState.config.resolve(handCount);
    final rawHand = game.matchMode == 'sandbox'
        ? sandboxMockHand(handCount)
        : (isPreSecondDealHand(gs) ? hand.take(5).toList() : hand);
    final sorted = sortHandForDisplay(rawHand, bid);
    final ctrl = ref.read(gameControllerProvider.notifier);
    final screenW = MediaQuery.sizeOf(context).width;
    final showFacesSandbox = game.matchMode == 'sandbox' || showFaces;

    return LayoutBuilder(
      builder: (context, constraints) {
        final count = sorted.length;
        if (count == 0) return const SizedBox.shrink();

        final layout = HandFanLayout.forScreen(
          count: count,
          screenWidth: screenW,
          maxWidth: constraints.maxWidth,
          cardScale: resolved.handCardScale,
          gapMul: resolved.handCardGap,
        );
        final suits = sorted.map((e) => e.value['suit']?.toString()).toList();
        final lefts = layout.cardLefts(suits);

        return AnimatedContainer(
          duration: kLayoutAnimDuration,
          curve: kLayoutAnimCurve,
          height: layout.height,
          width: constraints.maxWidth,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.bottomCenter,
            children: sorted.asMap().entries.map((e) {
              final serverIdx = e.value.key;
              final card = e.value.value;
              final displayIdx = e.key;
              final pose = handFanPose(displayIdx, count);
              final selected = game.preSelectedIndex == serverIdx;
              return AnimatedPositioned(
                duration: kLayoutAnimDuration,
                curve: kLayoutAnimCurve,
                left: lefts[displayIdx],
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
                        angle: rot * 3.141592653589793 / 180,
                        alignment: Alignment.bottomCenter,
                        child: child,
                      ),
                    ),
                    child: child,
                  ),
                  child: Material(
                    elevation: selected ? 8 : 2,
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.transparent,
                    child: GestureDetector(
                      onTap: () => ctrl.onCardTap(serverIdx, card),
                      child: AnimatedContainer(
                        duration: kLayoutAnimDuration,
                        curve: kLayoutAnimCurve,
                        width: layout.cardW,
                        height: layout.cardH,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          border: selected
                              ? Border.all(color: Colors.cyan, width: 3)
                              : Border.all(color: Colors.white.withValues(alpha: 0.12)),
                          boxShadow: const [
                            BoxShadow(
                              color: Colors.black54,
                              blurRadius: 8,
                              offset: Offset(-2, 4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: NetworkAssetImage(
                            path: showFacesSandbox
                                ? cardImagePath(card, backUrl: back)
                                : back,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        );
      },
    );
  }
}

class _BidPanel extends ConsumerWidget {
  const _BidPanel({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bids = (game.gs!['available_bids'] as List?) ?? [];
    final ctrl = ref.read(gameControllerProvider.notifier);
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 340 || bids.length > 4;
        return BidCardRow(
          children: bids.map((b) {
            final bid = Map<String, dynamic>.from(b as Map);
            final action = bid['action']?.toString() ?? '';
            final label = bid['label']?.toString() ?? action;
            return BidCardButton(
              compact: compact,
              label: label,
              onPressed: () {
                if (bid['needsSuitPicker'] == true ||
                    (action == 'HAKAM' && game.gs!['phase'] == 'PHASE_2')) {
                  _pickHakamSuit(context, ctrl, game.gs!['floor_card']);
                } else if (bid['needsLockChoice'] == true) {
                  _pickLock(context, ctrl, bid);
                } else {
                  String? suit;
                  if (bid['needsFloorSuit'] == true) {
                    suit = (game.gs!['floor_card'] as Map?)?['suit']?.toString();
                  }
                  ctrl.bid(bid, suit: suit);
                }
              },
            );
          }).toList(),
        );
      },
    );
  }

  void _pickHakamSuit(BuildContext context, GameController ctrl, dynamic floorCard) {
    final floorSuit = (floorCard as Map?)?['suit']?.toString();
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'].map((s) {
            final disabled = s == floorSuit;
            return ListTile(
              enabled: !disabled,
              title: Text('${suitSym[s] ?? ''} ${suitAr[s] ?? s}'),
              onTap: disabled ? null : () {
                Navigator.pop(ctx);
                ctrl.bid({'action': 'HAKAM'}, suit: s);
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  void _pickLock(BuildContext context, GameController ctrl, Map<String, dynamic> bid) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('مقفل أو مفتوح؟'),
        actions: [
          TextButton(onPressed: () {
            Navigator.pop(ctx);
            ctrl.bid(bid, locked: false);
          }, child: const Text('مفتوح')),
          TextButton(onPressed: () {
            Navigator.pop(ctx);
            ctrl.bid(bid, locked: true);
          }, child: const Text('مقفل')),
        ],
      ),
    );
  }
}

class _ProjectBar extends ConsumerWidget {
  const _ProjectBar({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = rab4haColors(context);
    final ctrl = ref.read(gameControllerProvider.notifier);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: projectNames.map((name) {
        final count = game.pendingProjects[name] ?? 0;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: OutlinedButton(
            onPressed: () => ctrl.cycleProject(name),
            style: OutlinedButton.styleFrom(
              backgroundColor: count > 0
                  ? const Color(0xFF166534)
                  : c.bgElevated,
              foregroundColor: Colors.white,
              side: BorderSide(
                color: count > 0 ? const Color(0xFF86EFAC) : Colors.white38,
              ),
            ),
            child: Text('${projectDisplayLabel(name)} ($count)'),
          ),
        );
      }).toList(),
    );
  }
}

class _FloorCard extends StatefulWidget {
  const _FloorCard({required this.game});
  final GameState game;

  @override
  State<_FloorCard> createState() => _FloorCardState();
}

class _FloorCardState extends State<_FloorCard> {
  bool _revealed = false;
  String? _lastKey;

  @override
  void didUpdateWidget(covariant _FloorCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    final gs = widget.game.gs;
    if (gs == null) return;
    final fc = gs['floor_card'] as Map?;
    final key = fc == null ? null : '${fc['suit']}_${fc['rank']}_${gs['phase']}';
    if (key != _lastKey) {
      _lastKey = key;
      _revealed = false;
      if (fc != null && isBiddingFloorPhase(gs)) {
        Future.delayed(const Duration(milliseconds: 400), () {
          if (mounted) setState(() => _revealed = true);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final gs = widget.game.gs;
    if (gs == null || !isBiddingFloorPhase(gs)) return const SizedBox.shrink();
    final fc = Map<String, dynamic>.from(gs['floor_card'] as Map? ?? {});
    if (fc.isEmpty) return const SizedBox.shrink();
    final dims = rab4haDims(context);
    final back = gs['card_back_url']?.toString() ?? '/cards/back_dark.png';
    final path = _revealed ? cardImagePath(fc, backUrl: back) : back;
    return Center(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 40),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Container(
            key: ValueKey(path),
            width: dims.cardSmW * 1.2,
            height: dims.cardSmH * 1.2,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              boxShadow: const [
                BoxShadow(color: Colors.black54, blurRadius: 8, offset: Offset(0, 4)),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: NetworkAssetImage(path: path, fit: BoxFit.cover),
            ),
          ),
        ),
      ),
    );
  }
}

class _SoloBanner extends StatelessWidget {
  const _SoloBanner({required this.controlSeat});
  final int? controlSeat;
  @override
  Widget build(BuildContext context) {
    const labels = ['يمين', 'فوق', 'يسار', 'أنت'];
    final cs = controlSeat ?? 3;
    return Positioned(
      top: MediaQuery.paddingOf(context).top + 44,
      left: 0,
      right: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xEB3B82F6),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            'تجربة فردية — تلعب الآن كمقعد $cs (${labels[cs]})',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          ),
        ),
      ),
    );
  }
}

class _SideGameButton extends StatelessWidget {
  const _SideGameButton({
    required this.label,
    required this.onPressed,
    required this.borderColor,
    required this.fillColor,
    this.enabled = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final Color borderColor;
  final Color fillColor;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onPressed : null,
          borderRadius: BorderRadius.circular(12),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: fillColor.withValues(alpha: 0.88),
              border: Border.all(color: borderColor, width: 2),
              boxShadow: [
                BoxShadow(color: borderColor.withValues(alpha: 0.22), blurRadius: 10),
              ],
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Text(
              label,
              style: TextStyle(
                color: borderColor,
                fontWeight: FontWeight.w800,
                fontSize: 15,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SawaSideButton extends ConsumerWidget {
  const _SawaSideButton({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gs = game.gs!;
    if (gs['phase'] != 'PLAYING' || gs['qaid_session'] != null) {
      return const SizedBox.shrink();
    }
    final ctrl = ref.read(gameControllerProvider.notifier);
    final enabled = gs['can_sawa'] == true && gs['sawa_declaration'] == null;
    return _SideGameButton(
      label: 'سوا',
      enabled: enabled,
      borderColor: const Color(0xFFF0C96A),
      fillColor: const Color(0xFF8B6914),
      onPressed: () => ctrl.sawa(),
    );
  }
}

class _QaidSideButton extends ConsumerWidget {
  const _QaidSideButton({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gs = game.gs!;
    if (gs['phase'] != 'PLAYING' || gs['qaid_session'] != null) {
      return const SizedBox.shrink();
    }
    final ctrl = ref.read(gameControllerProvider.notifier);
    final sawaDecl = gs['sawa_declaration'] as Map?;
    final enabled = sawaDecl == null || sawaDecl['phase'] == 'objection';
    return _SideGameButton(
      label: 'قيد',
      enabled: enabled,
      borderColor: const Color(0xFFFCA5A5),
      fillColor: const Color(0xFF991B1B),
      onPressed: () => ctrl.qaidStart(),
    );
  }
}

class _SideUtilityActions extends ConsumerWidget {
  const _SideUtilityActions({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctrl = ref.read(gameControllerProvider.notifier);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        IconButton(
          icon: const Icon(Icons.chat_bubble_outline),
          tooltip: 'رسائل سريعة',
          onPressed: () => _quickChat(context, ctrl),
        ),
        IconButton(
          icon: const Icon(Icons.card_giftcard),
          tooltip: 'هدايا الطاولة',
          onPressed: () => _tableGifts(context, ref, ctrl),
        ),
      ],
    );
  }

  void _quickChat(BuildContext context, GameController ctrl) {
    final c = rab4haColors(context);
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: c.bgElevated,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: c.borderGold),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380, maxHeight: 420),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'رسائل سريعة',
                  style: TextStyle(
                    color: c.gold,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 10),
                Flexible(
                  child: GridView.builder(
                    shrinkWrap: true,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 6,
                      crossAxisSpacing: 6,
                      childAspectRatio: 2.4,
                    ),
                    itemCount: quickChatMessages.length,
                    itemBuilder: (_, i) {
                      final m = quickChatMessages[i];
                      return Material(
                        color: c.bgSurface,
                        borderRadius: BorderRadius.circular(10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onTap: () {
                            ctrl.sendQuickChat(m);
                            Navigator.pop(ctx);
                          },
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: Text(
                                m,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 11, height: 1.2),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _tableGifts(BuildContext context, WidgetRef ref, GameController ctrl) {
    showTableGiftFlow(context, ref, ctrl, game);
  }
}

class _ScoreSummaryOverlay extends StatelessWidget {
  const _ScoreSummaryOverlay({required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    final gs = game.gs!;
    final s = Map<String, dynamic>.from(gs['summary_data'] as Map);
    final us = getMyTeam(game.mySeat ?? 3);
    final them = us == 1 ? 2 : 1;
    final gainedUs = (s['final'] as Map?)?['$us'] ?? 0;
    final gainedThem = (s['final'] as Map?)?['$them'] ?? 0;
    final roundWon = (gainedUs as num) > (gainedThem as num);
    final roundLost = (gainedThem as num) > (gainedUs as num);

    String note = '';
    if (s['is_qahwa'] == true) note = 'قهوة';
    else if (s['is_sawa'] == true) note = 'سوا';
    else if (s['is_qaid'] == true) note = s['is_qaid_normal'] == true ? 'قيد' : 'قيد كبوت';
    else if (s['is_kaput'] == true) note = 'كبوت';
    else if (s['is_fall'] == true) note = 'سقوط المشتري';
    else if (s['is_doubled'] == true && s['multiplier'] != null) {
      note = (s['multiplier'] as num) < 5 ? 'تدبيل ×${s['multiplier']}' : 'قهوة';
    }

    Widget row(String label, dynamic usVal, dynamic themVal) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(flex: 2, child: Text(label)),
            Expanded(child: Text('$usVal', textAlign: TextAlign.center)),
            Expanded(child: Text('$themVal', textAlign: TextAlign.center)),
          ],
        ),
      );
    }

    return Positioned.fill(
      child: Container(
        color: Colors.black54,
        child: Center(
          child: Container(
            margin: const EdgeInsets.all(20),
            padding: const EdgeInsets.all(20),
            constraints: const BoxConstraints(maxWidth: 400),
            decoration: BoxDecoration(
              color: rab4haColors(context).bgElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: roundWon
                    ? Colors.green
                    : roundLost
                        ? Colors.red
                        : Colors.white24,
              ),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'النشرة',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (note.isNotEmpty)
                    Text(note, textAlign: TextAlign.center, style: const TextStyle(color: Colors.amber)),
                  const SizedBox(height: 12),
                  const Row(
                    children: [
                      Expanded(flex: 2, child: SizedBox()),
                      Expanded(child: Text('لنا', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold))),
                      Expanded(child: Text('لهم', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold))),
                    ],
                  ),
                  row('الأكلات', (s['raw_tricks'] as Map?)?['$us'], (s['raw_tricks'] as Map?)?['$them']),
                  row('الأرض', (s['ground'] as Map?)?['$us'], (s['ground'] as Map?)?['$them']),
                  row('المشاريع', (s['projects'] as Map?)?['$us'], (s['projects'] as Map?)?['$them']),
                  row('الأبناط', (s['abnat'] as Map?)?['$us'], (s['abnat'] as Map?)?['$them']),
                  row('على الورقة', (s['base_final'] as Map?)?['$us'], (s['base_final'] as Map?)?['$them']),
                  row('نقاط الجولة', gainedUs, gainedThem),
                  const Divider(),
                  Text(
                    'مجموع المباراة: لنا ${(s['total_scores'] as Map?)?['$us'] ?? gs['total_scores']?['$us'] ?? 0} — لهم ${(s['total_scores'] as Map?)?['$them'] ?? gs['total_scores']?['$them'] ?? 0}',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    roundWon ? 'فزتم الجولة' : roundLost ? 'خسرتم الجولة' : 'تعادل',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: roundWon ? Colors.greenAccent : roundLost ? Colors.redAccent : Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MatchEndOverlay extends ConsumerWidget {
  const _MatchEndOverlay({
    required this.matchEnd,
    required this.matchMode,
    required this.mySeat,
    required this.onLeave,
    required this.onPlayAgain,
  });
  final Map<String, dynamic> matchEnd;
  final String matchMode;
  final int? mySeat;
  final VoidCallback onLeave;
  final VoidCallback onPlayAgain;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final winner = matchEnd['winner'];
    final scores = matchEnd['scores'] as Map? ?? {};
    final us = mySeat != null ? getMyTeam(mySeat!) : 1;
    final won = winner == us;
    final rankResult = matchEnd['rankResult'] as Map?;
    final pointsDelta = rankResult?['pointsDelta'];
    final rankedUp = matchEnd['rankedUp'] == true || rankResult?['rankedUp'] == true;
    final profile = ref.watch(profileProvider);

    return Scaffold(
      backgroundColor: Colors.black87,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                won ? '🏆 فوز!' : '😔 خسارة',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              Text('الفريق ${won ? us : (us == 1 ? 2 : 1)} فاز'),
              Text('النتيجة: ${scores['$us'] ?? 0} — ${scores['${us == 1 ? 2 : 1}'] ?? 0}'),
              if (matchMode == 'ranked' && pointsDelta != null)
                Text(
                  'نقاط التصنيف: ${pointsDelta > 0 ? '+' : ''}$pointsDelta',
                  style: TextStyle(color: (pointsDelta as num) > 0 ? Colors.greenAccent : Colors.redAccent),
                ),
              if (rankedUp && profile != null)
                Text('🎉 ترقية! ${profile.rankLabel ?? rankFullLabel(profile.rank, profile.subRank)}'),
              const SizedBox(height: 24),
              PrimaryButton(label: 'قهوة جديدة', onPressed: onPlayAgain, width: 220),
              const SizedBox(height: 12),
              SizedBox(
                width: 220,
                child: SecondaryButton(label: 'العودة', onPressed: onLeave),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LayoutGameScreen extends ConsumerWidget {
  const _LayoutGameScreen({
    required this.game,
    required this.sandbox,
    required this.onLeave,
    this.showBidPanel,
    this.showProjectPanel,
  });

  final GameState game;
  final bool sandbox;
  final VoidCallback onLeave;
  final bool? showBidPanel;
  final bool? showProjectPanel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gs = game.gs!;
    final qaidActive = gs['qaid_session'] != null;
    final layout = ref.watch(gameLayoutProvider);
    final resolved = GameScreen._resolvedLayout(layout, game);
    final handCount = GameScreen._handCountForLayout(game, layout.previewCardCount);
    final editMode = sandbox && layout.editMode;
    final showBid = showBidPanel ?? layout.showBidPanel;
    final showProject = showProjectPanel ?? layout.showProjectBar;

    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final canvas = Size(constraints.maxWidth, constraints.maxHeight);

          Widget slot(String id, Widget child) {
            final box = resolved.elements[id];
            if (box == null) return child;
            return GameLayoutSlot(
              id: id,
              box: box,
              canvasSize: canvas,
              editMode: editMode,
              onChanged: (b) => ref.read(gameLayoutProvider.notifier).updateBox(id, b),
              child: child,
            );
          }

          List<Widget> opponentPartSlots(String pos) {
            final mySeat = game.mySeat ?? 0;
            final gSeat = getGlobalSeat(pos, mySeat);
            final oppHandCount = sandbox
                ? layout.previewCardCount
                : ((gs['hand_counts'] as List?)?[gSeat] as int? ?? handCount);
            final ctx = SandboxSeatContext.forPosition(
              game: game,
              pos: pos,
              handCount: oppHandCount > 0 ? oppHandCount : handCount,
            );
            if (ctx == null) return const [];
            return [
              slot(
                seatPartId(pos, 'cards'),
                OpponentHandFan(
                  count: ctx.handCount,
                  backUrl: ctx.backUrl,
                  scale: resolved.tuning.opponentCardScale,
                  overlapMul: resolved.tuning.opponentCardOverlap,
                ),
              ),
              slot(
                seatPartId(pos, 'avatar'),
                Center(
                  child: SandboxSeatAvatarWithBubble(
                    seatData: ctx.seatData,
                    isTurn: !qaidActive && gs['turn'] == ctx.globalSeat && gs['phase'] != 'SCORE_SUMMARY',
                    isDealer: gs['dealer_idx'] == ctx.globalSeat,
                    turnStartedAtMs: !qaidActive && gs['turn'] == ctx.globalSeat ? game.turnStartedAtMs : null,
                    bubble: game.chatBubbles[ctx.globalSeat],
                    buyerBadge: seatBuyerBadge(gs, ctx.globalSeat),
                  ),
                ),
              ),
              slot(
                seatPartId(pos, 'gifts'),
                Center(
                  child: SandboxSeatGifts(
                    slots: ctx.giftSlots.isEmpty && sandbox
                        ? [
                            {'emoji': '🎁'},
                            {'emoji': '⭐'},
                            null,
                          ]
                        : ctx.giftSlots,
                  ),
                ),
              ),
              slot(
                seatPartId(pos, 'name'),
                Center(
                  child: SandboxSeatName(
                    seatData: ctx.seatData,
                    name: ctx.name,
                    globalSeat: ctx.globalSeat,
                  ),
                ),
              ),
            ];
          }

          final bottom = bottomContext(game);

          return Stack(
            clipBehavior: Clip.none,
            children: [
              Padding(
                padding: EdgeInsets.only(bottom: sandbox ? 150 : 0),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: NetworkAssetImage(
                        path: resolveSessionBgUrl(gs, game.room),
                        fit: BoxFit.cover,
                        errorWidget: CustomPaint(painter: _FeltPainter()),
                      ),
                    ),
                    Positioned.fill(child: ColoredBox(color: Colors.black.withValues(alpha: 0.25))),
                    const Positioned.fill(child: TrickTableLayer()),
                    slot('table_center', const SizedBox.shrink()),
                    slot('floor_card', _SandboxFloorCard(game: game, tuning: resolved.tuning)),
                    ...sandboxSeatPositions.expand(opponentPartSlots),
                    slot(
                      'seat_bottom_avatar',
                      Center(
                        child: SandboxSeatAvatarWithBubble(
                          seatData: bottom.seatData,
                          isTurn: !qaidActive && gs['turn'] == bottom.globalSeat && gs['phase'] != 'SCORE_SUMMARY',
                          isDealer: gs['dealer_idx'] == bottom.globalSeat,
                          turnStartedAtMs: !qaidActive && gs['turn'] == bottom.globalSeat ? game.turnStartedAtMs : null,
                          bubble: game.chatBubbles[bottom.globalSeat],
                          buyerBadge: seatBuyerBadge(gs, bottom.globalSeat),
                        ),
                      ),
                    ),
                    slot(
                      'seat_bottom_gifts',
                      Center(
                        child: SandboxSeatGifts(
                          slots: bottom.giftSlots.isEmpty && sandbox
                              ? [
                                  {'emoji': '🎁'},
                                  {'emoji': '⭐'},
                                  null,
                                ]
                              : bottom.giftSlots,
                        ),
                      ),
                    ),
                    slot(
                      'seat_bottom_name',
                      Center(
                        child: SandboxSeatName(
                          seatData: bottom.seatData,
                          name: bottom.name,
                          globalSeat: bottom.globalSeat,
                        ),
                      ),
                    ),
                    slot('my_hand', _MyHand(game: game)),
                    if (showBid)
                      slot(
                        'bid_buttons',
                        sandbox ? const _SandboxBidPreview() : _BidPanel(game: game),
                      ),
                    if (showProject) slot('project_bar', _ProjectBar(game: game)),
                    slot('btn_sawa', _SawaSideButton(game: game)),
                    slot('btn_qaid', _QaidSideButton(game: game)),
                    slot('side_utils', FittedBox(fit: BoxFit.contain, child: _SideUtilityActions(game: game))),
                    slot('back_btn', IconButton(icon: const Icon(Icons.arrow_back), onPressed: onLeave)),
                    slot('score_bar', _ScoreBar(game: game)),
                  ],
                ),
              ),
              if (sandbox)
                Positioned(
                  top: MediaQuery.paddingOf(context).top + 4,
                  left: 12,
                  right: 12,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFD4AF37).withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.45)),
                      ),
                      child: const Text(
                        'ساندبوكس — تعديل الواجهة (بدون لعب)',
                        style: TextStyle(color: Color(0xFFF0C96A), fontSize: 11, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ),
              if (sandbox) const Positioned(left: 0, right: 0, bottom: 0, child: SandboxToolbar()),
            ],
          );
        },
      ),
    );
  }
}

class _SandboxFloorCard extends StatelessWidget {
  const _SandboxFloorCard({required this.game, required this.tuning});
  final GameState game;
  final GameLayoutTuning tuning;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: FittedBox(
        fit: BoxFit.contain,
        child: Transform.scale(
          scale: tuning.floorCardScale,
          child: _FloorCard(game: game),
        ),
      ),
    );
  }
}

class _SandboxBidPreview extends StatelessWidget {
  const _SandboxBidPreview();

  @override
  Widget build(BuildContext context) {
    return const BidCardRow(
      children: [
        BidCardButton(label: 'صن', onPressed: _noop, compact: true),
        BidCardButton(label: 'حكم', onPressed: _noop, compact: true),
        BidCardButton(label: 'بس', onPressed: _noop, compact: true),
        BidCardButton(label: 'أشكل', onPressed: _noop, compact: true),
      ],
    );
  }

  static void _noop() {}
}