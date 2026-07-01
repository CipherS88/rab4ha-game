import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/rab4ha_theme.dart';
import '../../shared/widgets/buttons.dart';
import 'game_layout_provider.dart';

class SandboxToolbar extends ConsumerWidget {
  const SandboxToolbar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final layout = ref.watch(gameLayoutProvider);
    final c = rab4haColors(context);
    final notifier = ref.read(gameLayoutProvider.notifier);

    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
        decoration: BoxDecoration(
          color: c.bgElevated.withValues(alpha: 0.96),
          border: Border(top: BorderSide(color: c.borderGold)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.45), blurRadius: 12, offset: const Offset(0, -4)),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (layout.editMode)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    'كل عنصر منفصل: كروت · أفتار · اسم · هدايا — اسحب/كبّر/دوّر',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: c.goldLight, fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                alignment: WrapAlignment.center,
                children: [
                  _ToolBtn(
                    label: layout.editMode ? '✓ إيقاف الأدوات' : '📐 تفعيل الأدوات',
                    active: layout.editMode,
                    onTap: () => notifier.toggleEdit(),
                  ),
                  _ToolBtn(
                    label: '5 كروت',
                    active: layout.previewCardCount == 5,
                    onTap: () => notifier.setPreviewCardCount(5),
                  ),
                  _ToolBtn(
                    label: '6 كروت',
                    active: layout.previewCardCount == 6,
                    onTap: () => notifier.setPreviewCardCount(6),
                  ),
                  _ToolBtn(
                    label: '7 كروت',
                    active: layout.previewCardCount == 7,
                    onTap: () => notifier.setPreviewCardCount(7),
                  ),
                  _ToolBtn(
                    label: '8 كروت',
                    active: layout.previewCardCount == 8,
                    onTap: () => notifier.setPreviewCardCount(8),
                  ),
                  Text(
                    'تعدّل وضع ${layout.previewCardCount} كروت',
                    style: TextStyle(color: c.goldLight, fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                  _ToolBtn(
                    label: '💾 حفظ',
                    active: true,
                    onTap: () async {
                      final ok = await notifier.save();
                      if (!context.mounted) return;
                      final err = ref.read(gameLayoutProvider).lastSaveError;
                      ref.read(homeToastProvider.notifier).show(
                            ok ? 'تم حفظ التخطيط — سيُطبَّق على ساحة اللعب' : (err ?? 'فشل الحفظ'),
                          );
                    },
                  ),
                  if (layout.editMode) ...[
                    _ToolBtn(label: 'إلغاء', onTap: () => notifier.cancelEdit()),
                    _ToolBtn(
                      label: 'إعادة ضبط',
                      onTap: () async {
                        final ok = await notifier.resetToDefault();
                        if (context.mounted) {
                          ref.read(homeToastProvider.notifier).show(ok ? 'تم إعادة الضبط' : 'فشل');
                        }
                      },
                    ),
                  ],
                  _ToolBtn(
                    label: 'المشاريع',
                    active: layout.showProjectBar,
                    onTap: () => notifier.setShowProjectBar(!layout.showProjectBar),
                  ),
                  _ToolBtn(
                    label: 'المزايدة',
                    active: layout.showBidPanel,
                    onTap: () => notifier.setShowBidPanel(!layout.showBidPanel),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'إعدادات اليد (${layout.previewCardCount} كروت)',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.gold, fontSize: 11, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                alignment: WrapAlignment.center,
                children: [
                  _TunePair(
                    label: 'مسافة كروتك',
                    value: layout.active.handCardGap,
                    onMinus: () => notifier.bumpTuning('handCardGap', -0.08),
                    onPlus: () => notifier.bumpTuning('handCardGap', 0.08),
                  ),
                  _TunePair(
                    label: 'حجم كروتك',
                    value: layout.active.handCardScale,
                    onMinus: () => notifier.bumpTuning('handCardScale', -0.08),
                    onPlus: () => notifier.bumpTuning('handCardScale', 0.08),
                  ),
                  _TunePair(
                    label: 'كرت الوسط',
                    value: layout.active.tuning.floorCardScale,
                    onMinus: () => notifier.bumpTuning('floorCardScale', -0.08),
                    onPlus: () => notifier.bumpTuning('floorCardScale', 0.08),
                  ),
                  _TunePair(
                    label: 'كروت الخصوم',
                    value: layout.active.tuning.opponentCardScale,
                    onMinus: () => notifier.bumpTuning('opponentCardScale', -0.08),
                    onPlus: () => notifier.bumpTuning('opponentCardScale', 0.08),
                  ),
                  _TunePair(
                    label: 'تداخل خصوم',
                    value: layout.active.tuning.opponentCardOverlap,
                    onMinus: () => notifier.bumpTuning('opponentCardOverlap', -0.08),
                    onPlus: () => notifier.bumpTuning('opponentCardOverlap', 0.08),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToolBtn extends StatelessWidget {
  const _ToolBtn({required this.label, this.onTap, this.active = false});

  final String label;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: active ? c.gold.withValues(alpha: 0.22) : c.bgSurface,
            border: Border.all(color: active ? c.gold : c.borderGold.withValues(alpha: 0.5)),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: active ? c.goldLight : c.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}

class _TunePair extends StatelessWidget {
  const _TunePair({
    required this.label,
    required this.value,
    required this.onMinus,
    required this.onPlus,
  });

  final String label;
  final double value;
  final VoidCallback onMinus;
  final VoidCallback onPlus;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.borderGold.withValues(alpha: 0.35)),
        color: c.bgSurface,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: TextStyle(color: c.textMuted, fontSize: 10, fontWeight: FontWeight.w700)),
          IconButton(
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            icon: Icon(Icons.remove, color: c.goldLight, size: 16),
            onPressed: onMinus,
          ),
          Text(
            value.toStringAsFixed(2),
            style: TextStyle(color: c.goldLight, fontSize: 11, fontWeight: FontWeight.w800),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            icon: Icon(Icons.add, color: c.goldLight, size: 16),
            onPressed: onPlus,
          ),
        ],
      ),
    );
  }
}
