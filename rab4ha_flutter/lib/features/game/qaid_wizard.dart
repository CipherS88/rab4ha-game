import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/logging/app_logger.dart';
import '../../shared/widgets/network_asset.dart';
import 'card_utils.dart';
import 'game_controller.dart';
import 'game_labels.dart';
import 'hand_fan.dart';
import 'qaid_ui.dart';

class QaidWizardOverlay extends ConsumerStatefulWidget {
  const QaidWizardOverlay({super.key, required this.game});
  final GameState game;

  @override
  ConsumerState<QaidWizardOverlay> createState() => _QaidWizardOverlayState();
}

class _QaidWizardOverlayState extends ConsumerState<QaidWizardOverlay> {
  List<String> _reasons(GameState game) {
    final base = (game.gs!['qaid_reasons'] as List?)?.cast<String>() ?? [];
    final list = [...base];
    if (game.gs!['sawa_declaration'] != null) list.insert(0, 'سوا غلط');
    return list;
  }

  bool _isAlly(int seat, GameState game) {
    return isQaidAllySeat(seat, getQaidObjectorSeat(game));
  }

  int? getQaidObjectorSeat(GameState game) {
    final session = game.gs?['qaid_session'] as Map?;
    return session?['seat'] as int?;
  }

  String _playerName(GameState game, int seat) {
    final hands = (game.gs?['all_hands'] as List?) ?? [];
    for (final h in hands) {
      final m = Map<String, dynamic>.from(h as Map);
      if (m['seat'] == seat) return m['name']?.toString() ?? 'مقعد $seat';
    }
    final seats = (game.gs?['seats'] as List?) ?? [];
    if (seat < seats.length) {
      return Map<String, dynamic>.from(seats[seat] as Map? ?? {})['name']?.toString() ?? 'مقعد $seat';
    }
    return 'مقعد $seat';
  }

  @override
  Widget build(BuildContext context) {
    final game = ref.watch(gameControllerProvider);
    final ctrl = ref.read(gameControllerProvider.notifier);
    final objector = ctrl.isQaidObjector();
    final step = game.qaidStep;

    return Container(
      color: Colors.black54,
      child: Center(
        child: SizedBox(
          width: 420,
          height: 520,
          child: Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF121212),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    objector ? 'اعتراض — قيد' : 'قيد جاري',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  if (objector)
                    const Text('الوقت متوقف', style: TextStyle(color: Colors.amber, fontSize: 13)),
                ],
              ),
              if (!objector) ...[
                const SizedBox(height: 6),
                Text(
                  '${_playerName(game, getQaidObjectorSeat(game) ?? 0)} يقيد الآن — شاهد الاختيارات',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.amber.shade200, fontSize: 13),
                ),
              ],
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [1, 2, 3].map((n) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: CircleAvatar(
                      radius: 14,
                      backgroundColor: step >= n ? const Color(0xFFD4AF37) : Colors.white24,
                      child: Text('$n', style: const TextStyle(fontSize: 12)),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: SingleChildScrollView(
                  child: switch (step) {
                    1 => _stepReasons(game, ctrl, objector),
                    2 => _stepProof(game, ctrl, objector),
                    _ => _stepConfirm(game),
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(onPressed: () => ctrl.qaidCancel(), child: const Text('إلغاء')),
                  if (objector && step > 1)
                    TextButton(
                      onPressed: () => ctrl.setQaidStep(step - 1),
                      child: const Text('رجوع'),
                    ),
                  if (objector && step == 1 && game.qaidReason != null)
                    TextButton(
                      onPressed: () {
                        final next = qaidReasonNeedsProof(game.qaidReason) ? 2 : 3;
                        ctrl.setQaidStep(next);
                      },
                      child: const Text('التالي'),
                    ),
                  if (objector && step == 2)
                    TextButton(
                      onPressed: game.qaidCards.length >= 2
                          ? () => ctrl.setQaidStep(3)
                          : null,
                      child: Text('التالي (${game.qaidCards.length}/2)'),
                    ),
                  if (objector && step == 3)
                    TextButton(onPressed: () => ctrl.qaidSubmit(), child: const Text('إرسال')),
                ],
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }

  Widget _stepReasons(GameState game, GameController ctrl, bool objector) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _reasons(game).map((r) {
        return ChoiceChip(
          label: Text(r),
          selected: game.qaidReason == r,
          onSelected: objector
              ? (_) {
                  ctrl.qaidUpdate(reason: r, cards: []);
                }
              : null,
        );
      }).toList(),
    );
  }

  Widget _stepProof(GameState game, GameController ctrl, bool objector) {
    final gs = game.gs!;
    final history = (gs['trick_history'] as List?) ?? [];
    final current = (gs['current_trick'] as List?) ?? [];
    final allTricks = [...history, if (current.isNotEmpty) current];
    final hands = (gs['all_hands'] as List?) ?? [];
    final dealerIdx = gs['dealer_idx'] as int?;
    AppLogger.instance.debug('Qaid proof step', {'tricks': allTricks.length, 'hands': hands.length});

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('2. إثبات', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 4),
        const Text(
          'راجع الأكلات — من اليمين أول لعب، من اليسار آخر لعب — واختر الكروت المخالفة',
          style: TextStyle(color: Colors.white70, fontSize: 13),
        ),
        const SizedBox(height: 10),
        ...allTricks.map((trick) => _QaidTrickRow(
              trick: trick as List,
              selected: game.qaidCards,
              objector: objector,
              onTap: (card) => _toggleCard(ctrl, game, card),
            )),
        const Divider(),
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            '${game.qaidCards.length} / 2 كروت',
            style: const TextStyle(color: Colors.white54, fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ),
        ...hands.map((h) {
          final entry = Map<String, dynamic>.from(h as Map);
          final seat = entry['seat'] as int? ?? 0;
          final cards = (entry['cards'] as List?) ?? [];
          if (cards.isEmpty) return const SizedBox.shrink();
          final pos = qaidDealerPosition(seat, dealerIdx);
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _playerName(game, seat),
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                      ),
                    ),
                    if (pos.label.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.cyan.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(99),
                          border: Border.all(color: Colors.cyan.withValues(alpha: 0.28)),
                        ),
                        child: Text(
                          pos.arrow.isNotEmpty ? '${pos.arrow} ${pos.label}' : pos.label,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: cards.map((c) {
                    final card = Map<String, dynamic>.from(c as Map);
                    return _QaidCardTile(
                      card: card,
                      selected: game.qaidCards.any((x) => cardEquals(x, card)),
                      onTap: objector && !_isAlly(seat, game)
                          ? () => _toggleCard(ctrl, game, card)
                          : null,
                    );
                  }).toList(),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  void _toggleCard(GameController ctrl, GameState game, Map<String, dynamic> card) {
    var cards = List<Map<String, dynamic>>.from(game.qaidCards);
    if (cards.any((c) => cardEquals(c, card))) {
      cards.removeWhere((c) => cardEquals(c, card));
    } else if (cards.length < 2) {
      cards.add(card);
    }
    ctrl.qaidUpdate(reason: game.qaidReason, cards: cards);
  }

  Widget _stepConfirm(GameState game) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('السبب: ${game.qaidReason ?? "—"}', style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text('الكروت: ${game.qaidCards.length}/2'),
        Wrap(
          spacing: 6,
          children: game.qaidCards.map((c) {
            return Chip(label: Text('${suitSym[c['suit']] ?? ''} ${c['rank']}'));
          }).toList(),
        ),
      ],
    );
  }
}

class _QaidTrickRow extends StatelessWidget {
  const _QaidTrickRow({
    required this.trick,
    required this.selected,
    required this.objector,
    required this.onTap,
  });

  final List trick;
  final List<Map<String, dynamic>> selected;
  final bool objector;
  final void Function(Map<String, dynamic> card) onTap;

  @override
  Widget build(BuildContext context) {
    if (trick.isEmpty) return const SizedBox.shrink();
    final n = trick.length;
    final layout = OpponentFanLayout.forCount(count: n, scale: 2.35, overlapMul: 1.2);
    final leadSuit = _cardOf(trick.first)['suit']?.toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (leadSuit != null)
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                suitSym[leadSuit] ?? '',
                style: TextStyle(
                  fontSize: 16,
                  color: (leadSuit == 'HEARTS' || leadSuit == 'DIAMONDS')
                      ? const Color(0xFFF87171)
                      : const Color(0xFFE2E8F0),
                ),
              ),
            ),
          SizedBox(
            height: layout.height,
            child: Center(
              child: SizedBox(
                width: layout.width,
                height: layout.height,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    for (var i = 0; i < n; i++)
                      Positioned(
                        right: i * layout.step,
                        bottom: 0,
                        child: _QaidCardTile(
                          card: _cardOf(trick[i]),
                          width: layout.cardW,
                          height: layout.cardH,
                          selected: selected.any((c) => cardEquals(c, _cardOf(trick[i]))),
                          onTap: objector ? () => onTap(_cardOf(trick[i])) : null,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _cardOf(dynamic item) {
    final m = Map<String, dynamic>.from(item as Map);
    return Map<String, dynamic>.from(m['card'] as Map? ?? {});
  }
}

class _QaidCardTile extends StatelessWidget {
  const _QaidCardTile({
    required this.card,
    required this.selected,
    this.onTap,
    this.width = 40,
    this.height = 58,
  });

  final Map<String, dynamic> card;
  final bool selected;
  final VoidCallback? onTap;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: selected ? Colors.amber : Colors.white24,
            width: selected ? 2 : 1,
          ),
          boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 6, offset: Offset(0, 2))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: NetworkAssetImage(path: cardImagePath(card), fit: BoxFit.cover),
        ),
      ),
    );
  }
}
