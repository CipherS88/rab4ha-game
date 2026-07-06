import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
      return Map<String, dynamic>.from(seats[seat] as Map? ?? {})['name']?.toString() ??
          'مقعد $seat';
    }
    return 'مقعد $seat';
  }

  void _selectReason(GameController ctrl, String reason) {
    ctrl.qaidUpdate(reason: reason, cards: const []);
  }

  void _submitIfReady(GameController ctrl, GameState game) {
    if (!canSubmitQaid(
      reason: game.qaidReason,
      cards: game.qaidCards,
      submitting: game.qaidSubmitting,
    )) {
      return;
    }
    ctrl.qaidSubmit();
  }

  @override
  Widget build(BuildContext context) {
    final game = ref.watch(gameControllerProvider);
    final ctrl = ref.read(gameControllerProvider.notifier);
    final objector = ctrl.isQaidObjector();
    final step = game.qaidStep;
    final reason = game.qaidReason;
    final directSubmit = qaidReasonNeedsDirectSubmit(reason);
    final needsProof = qaidReasonNeedsProof(reason);
    final canSubmit = canSubmitQaid(
      reason: reason,
      cards: game.qaidCards,
      submitting: game.qaidSubmitting,
    );

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
                    Flexible(
                      child: Text(
                        objector ? 'اعتراض — قيد' : 'قيد جاري',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ),
                    if (objector)
                      const Text(
                        'الوقت متوقف',
                        style: TextStyle(color: Colors.amber, fontSize: 13),
                      ),
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
                    final active = directSubmit ? n == 1 : step >= n;
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: CircleAvatar(
                        radius: 14,
                        backgroundColor: active ? const Color(0xFFD4AF37) : Colors.white24,
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
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 4,
                  runSpacing: 4,
                  children: [
                    TextButton(
                      onPressed: game.qaidSubmitting ? null : () => ctrl.qaidCancel(),
                      child: const Text('إلغاء'),
                    ),
                    if (objector && step > 1 && !game.qaidSubmitting)
                      TextButton(
                        onPressed: () => ctrl.setQaidStep(step - 1),
                        child: const Text('رجوع'),
                      ),
                    if (objector && step == 1 && reason != null && needsProof)
                      TextButton(
                        onPressed: () => ctrl.setQaidStep(2),
                        child: const Text('التالي'),
                      ),
                    if (objector && step == 2 && needsProof)
                      TextButton(
                        onPressed: game.qaidCards.length >= 2
                            ? () => ctrl.setQaidStep(3)
                            : null,
                        child: Text('التالي (${game.qaidCards.length}/2)'),
                      ),
                    if (objector && step == 1 && directSubmit)
                      _SubmitButton(
                        enabled: canSubmit,
                        onPressed: () => _submitIfReady(ctrl, game),
                      ),
                    if (objector && step == 3)
                      _SubmitButton(
                        enabled: canSubmit,
                        onPressed: () => _submitIfReady(ctrl, game),
                      ),
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
    final reasons = qaidReasonsForRound(game.gs);
    final isSun = isSunRound(game.gs);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          isSun ? 'صن — اختر سبب القيد' : 'حكم — اختر سبب القيد',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Colors.white70),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: reasons.map((r) {
            return ChoiceChip(
              label: Text(r),
              selected: game.qaidReason == r,
              onSelected: objector ? (_) => _selectReason(ctrl, r) : null,
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _stepProof(GameState game, GameController ctrl, bool objector) {
    final gs = game.gs!;
    final history = (gs['trick_history'] as List?) ?? [];
    final current = (gs['current_trick'] as List?) ?? [];
    final allTricks = [...history, if (current.isNotEmpty) current];
    final hands = (gs['all_hands'] as List?) ?? [];
    final dealerIdx = gs['dealer_idx'] as int?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('2. إثبات', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 4),
        const Text(
          'الكروت من اليمين (أول لعب) إلى اليسار — اختر كرتين (الترتيب لا يهم)',
          style: TextStyle(color: Colors.white70, fontSize: 13),
        ),
        const SizedBox(height: 10),
        ...allTricks.map(
          (trick) => _QaidTrickRow(
            trick: trick as List,
            selected: game.qaidCards,
            objector: objector,
            leadPlayerName: _leadPlayerName(game, trick as List),
            onTap: (card) => _toggleCard(ctrl, game, card),
          ),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            '${game.qaidCards.length} / 2 كروت',
            style: TextStyle(
              color: game.qaidCards.length >= 2 ? Colors.greenAccent : Colors.white54,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
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
                    final isAlly = _isAlly(seat, game);
                    return _QaidCardTile(
                      card: card,
                      selected: game.qaidCards.any((x) => cardEquals(x, card)),
                      allyHighlight: isAlly,
                      onTap: objector ? () => _toggleCard(ctrl, game, card) : null,
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

  String _leadPlayerName(GameState game, List trick) {
    if (trick.isEmpty) return '';
    final first = Map<String, dynamic>.from(trick.first as Map);
    final seat = first['player'] as int?;
    if (seat == null) return '';
    return _playerName(game, seat);
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
    final direct = qaidReasonNeedsDirectSubmit(game.qaidReason);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('السبب: ${game.qaidReason ?? "—"}', style: const TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (direct)
          const Text('إرسال مباشر — بدون كروت إثبات', style: TextStyle(color: Colors.white70))
        else ...[
          Text('الكروت: ${game.qaidCards.length}/2'),
          Wrap(
            spacing: 6,
            children: game.qaidCards.map((c) {
              return Chip(label: Text('${suitSym[c['suit']] ?? ''} ${c['rank']}'));
            }).toList(),
          ),
        ],
      ],
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({required this.enabled, required this.onPressed});

  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: enabled ? onPressed : null,
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xFF991B1B),
        disabledBackgroundColor: const Color(0xFF4B1C1C),
      ),
      child: const Text('إرسال'),
    );
  }
}

class _QaidTrickRow extends StatelessWidget {
  const _QaidTrickRow({
    required this.trick,
    required this.selected,
    required this.objector,
    required this.leadPlayerName,
    required this.onTap,
  });

  final List trick;
  final List<Map<String, dynamic>> selected;
  final bool objector;
  final String leadPlayerName;
  final void Function(Map<String, dynamic> card) onTap;

  @override
  Widget build(BuildContext context) {
    if (trick.isEmpty) return const SizedBox.shrink();
    final n = trick.length;
    const cardGap = 6.0;
    final layout = OpponentFanLayout.forCount(count: n, scale: 2.35, overlapMul: 1.05);
    final step = layout.step + cardGap;
    final totalW = layout.cardW + step * (n - 1);
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (leadPlayerName.isNotEmpty)
                Text(
                  'افتتاح: $leadPlayerName',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF93C5FD),
                  ),
                ),
              if (leadSuit != null)
                Text(
                  suitSym[leadSuit] ?? '',
                  style: TextStyle(
                    fontSize: 16,
                    color: (leadSuit == 'HEARTS' || leadSuit == 'DIAMONDS')
                        ? const Color(0xFFF87171)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: layout.height,
            child: Center(
              child: SizedBox(
                width: totalW,
                height: layout.height,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    for (var i = 0; i < n; i++)
                      Positioned(
                        right: i * step,
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
    this.allyHighlight = false,
    this.width = 40,
    this.height = 58,
  });

  final Map<String, dynamic> card;
  final bool selected;
  final VoidCallback? onTap;
  final bool allyHighlight;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final allyGlow = allyHighlight && !selected;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: selected
                ? Colors.amber
                : (allyHighlight ? const Color(0xFF38BDF8) : Colors.white24),
            width: selected ? 2 : (allyHighlight ? 1.5 : 1),
          ),
          boxShadow: [
            if (allyGlow)
              BoxShadow(
                color: const Color(0xFF38BDF8).withValues(alpha: 0.5),
                blurRadius: 10,
                spreadRadius: 1,
              ),
            const BoxShadow(color: Colors.black45, blurRadius: 6, offset: Offset(0, 2)),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: NetworkAssetImage(path: cardImagePath(card), fit: BoxFit.cover),
        ),
      ),
    );
  }
}
