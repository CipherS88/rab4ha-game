import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/rab4ha_theme.dart';
import '../../shared/widgets/deck_stack.dart';
import '../../shared/widgets/player_avatar.dart';

/// بطاقة البطولة — منشئ + كروت + تفاصيل + أزرار (مطابق للمخطط).
class TournamentHeroCard extends ConsumerWidget {
  const TournamentHeroCard({
    super.key,
    required this.tournament,
    this.onReserve,
    this.onWatch,
    this.onEnter,
    this.compact = false,
  });

  final Map<String, dynamic> tournament;
  final VoidCallback? onReserve;
  final VoidCallback? onWatch;
  final VoidCallback? onEnter;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = rab4haColors(context);
    final creator = Map<String, dynamic>.from(
      tournament['creator'] as Map? ?? {'name': tournament['creator_name']},
    );
    final rank = creator['rankLabel']?.toString() ??
        creator['rank_label']?.toString() ??
        '';
    final deckUrl = creator['deck_back_url']?.toString() ?? '/cards/back_dark.png';
    final title = tournament['title']?.toString() ?? 'بطولة';
    final canJoin = tournament['can_join'] == true;
    final isRegistered = tournament['is_registered'] == true;
    final canEnter = tournament['can_enter'] == true;
    final secs = tournament['seconds_left'];
    final avatarSize = compact ? 84.0 : 100.0;
    final deckW = compact ? 52.0 : 65.0;
    final deckH = deckW * 1.38;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(compact ? 14 : 18),
      decoration: c.panelDecoration(radius: 16),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              PlayerAvatar(data: creator, size: avatarSize, vipFrame: true),
              const SizedBox(width: 10),
              HomeDeckStack(
                deckBackUrl: deckUrl,
                cardWidth: deckW,
                cardHeight: deckH,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            creator['name']?.toString() ?? tournament['creator_name']?.toString() ?? 'منظم',
            style: TextStyle(
              color: c.goldLight,
              fontWeight: FontWeight.w700,
              fontSize: compact ? 14 : 15,
            ),
            textAlign: TextAlign.center,
          ),
          if (rank.isNotEmpty) ...[
            const SizedBox(height: 4),
            buildRankPill(creator, fontSize: compact ? 10 : 11),
          ],
          const SizedBox(height: 14),
          Text(
            title,
            style: TextStyle(
              color: c.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: compact ? 18 : 22,
            ),
            textAlign: TextAlign.center,
          ),
          if (secs != null && (tournament['status'] == 'registration' || tournament['status'] == 'lobby'))
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '⏱ ${secs}s · ${tournament['phase_label'] ?? ''}',
                style: TextStyle(color: c.gold, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          const SizedBox(height: 16),
          _DetailRow(
            label: 'رتبة المشاركة:',
            value: tournament['participation_rank_label']?.toString() ?? 'مفتوحة للجميع',
          ),
          _DetailRow(
            label: 'الجائزة:',
            value: tournament['prize_label']?.toString() ?? 'مجتمعية',
          ),
          _DetailRow(
            label: 'النوع:',
            value: tournament['type_label']?.toString() ?? 'ترفيهية',
          ),
          _DetailRow(
            label: 'نظام البطولة:',
            value: _formatShort(tournament['format_label']?.toString()),
          ),
          _DetailRow(
            label: 'المقاعد:',
            value: '${tournament['entry_count'] ?? 0} / ${tournament['size'] ?? 0}',
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _HeroBtn(
                  label: isRegistered
                      ? 'مسجّل ✓'
                      : canJoin
                          ? 'حجز مقعد'
                          : 'ممتلئة',
                  enabled: canJoin,
                  onPressed: canJoin ? onReserve : null,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _HeroBtn(
                  label: canEnter ? 'ادخل الآن!' : 'مشاهدة',
                  outline: !canEnter,
                  onPressed: canEnter ? onEnter : onWatch,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _formatShort(String? label) {
    if (label == null || label.isEmpty) return 'خروج المغلوب';
    if (label.contains('خروج المغلوب')) return 'خروج المغلوب';
    return label;
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              color: c.gold.withValues(alpha: 0.85),
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: TextStyle(color: c.textPrimary, fontSize: 13),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroBtn extends StatelessWidget {
  const _HeroBtn({
    required this.label,
    this.onPressed,
    this.enabled = true,
    this.outline = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;
  final bool outline;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onPressed : null,
        borderRadius: BorderRadius.circular(12),
        child: Ink(
          height: 46,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: !outline && enabled ? c.primaryButtonGradient : null,
            color: outline ? c.bgSurface : (enabled ? null : c.bgElevated),
            border: Border.all(
              color: outline ? c.gold.withValues(alpha: 0.55) : Colors.transparent,
              width: 1.4,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: !outline && enabled
                    ? const Color(0xFF080808)
                    : (enabled ? c.goldLight : c.textMuted),
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
