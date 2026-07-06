import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rab4ha_theme.dart';
import '../../shared/widgets/buttons.dart';
import '../auth/auth_provider.dart';
import 'settings_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _email = TextEditingController();
  final _phone = TextEditingController();
  String? _msg;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final data = await ref.read(authProvider.notifier).refreshMe();
    if (!mounted) return;
    final user = data['user'] as Map?;
    _email.text = user?['email']?.toString() ?? '';
    _phone.text = user?['phone_sa']?.toString() ?? '';
    setState(() {});
  }

  Future<void> _save() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.patch('/api/auth/settings', body: {
        'email': _email.text.trim(),
        'phone_sa': _phone.text.trim(),
      });
      await api.parseJson(res, fallback: 'فشل الحفظ');
      if (mounted) setState(() => _msg = 'تم الحفظ');
    } catch (e) {
      if (mounted) setState(() => _msg = e.toString());
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('الإعدادات'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: BackButton(onPressed: () => context.go('/home')),
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(gradient: c.screenGradient),
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              const _GraphicsSection(),
              const SizedBox(height: 18),
              const _AudioSection(),
              const SizedBox(height: 18),
              _SettingsCard(
                icon: Icons.person_outline,
                title: 'الحساب',
                children: [
                  TextField(
                    controller: _email,
                    decoration: const InputDecoration(labelText: 'البريد الإلكتروني'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _phone,
                    decoration: const InputDecoration(labelText: 'رقم الجوال'),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'لتحويل الجوائز المالية عبر تطبيق محفظة برق',
                    style: TextStyle(color: c.textMuted, fontSize: 12),
                  ),
                  if (_msg != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      _msg!,
                      style: TextStyle(
                        color: _msg == 'تم الحفظ' ? c.success : c.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  PrimaryButton(label: 'حفظ', onPressed: _save),
                ],
              ),
              const SizedBox(height: 20),
              SecondaryButton(
                label: 'تسجيل الخروج',
                onPressed: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/login');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GraphicsSection extends ConsumerWidget {
  const _GraphicsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = rab4haColors(context);
    final fps = ref.watch(settingsProvider.select((s) => s.fpsTarget));
    final lowEnd = ref.watch(settingsProvider.select((s) => s.lowEndMode));
    final notifier = ref.read(settingsProvider.notifier);

    return _SettingsCard(
      icon: Icons.speed_rounded,
      title: 'الرسومات والأداء',
      children: [
        Text(
          'معدل الإطارات (FPS)',
          style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        _FpsSelector(
          value: fps,
          onChanged: notifier.setFpsTarget,
        ),
        const SizedBox(height: 6),
        Text(
          '120 إطار موصى به للأجهزة الداعمة لأقصى سلاسة.',
          style: TextStyle(color: c.textMuted, fontSize: 12),
        ),
        const _SaduDivider(),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeColor: c.gold,
          title: Text(
            'وضع الأجهزة الضعيفة',
            style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700),
          ),
          subtitle: Text(
            'يوقف الأنميشن العالي لتحسين الأداء',
            style: TextStyle(color: c.textMuted, fontSize: 12),
          ),
          value: lowEnd,
          onChanged: notifier.setLowEndMode,
        ),
      ],
    );
  }
}

class _AudioSection extends ConsumerWidget {
  const _AudioSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sfx = ref.watch(settingsProvider.select((s) => s.sfxVolume));
    final voice = ref.watch(settingsProvider.select((s) => s.voiceVolume));
    final notifier = ref.read(settingsProvider.notifier);

    return _SettingsCard(
      icon: Icons.graphic_eq_rounded,
      title: 'الصوتيات',
      children: [
        _VolumeSlider(
          label: 'مؤثرات اللعب',
          hint: 'رمي الكروت والتوزيع',
          icon: Icons.style_rounded,
          value: sfx,
          onChanged: notifier.setSfxVolume,
        ),
        const _SaduDivider(),
        _VolumeSlider(
          label: 'الشات الصوتي',
          hint: 'التفاعلات والرسائل الصوتية',
          icon: Icons.record_voice_over_rounded,
          value: voice,
          onChanged: notifier.setVoiceVolume,
        ),
      ],
    );
  }
}

class _FpsSelector extends StatelessWidget {
  const _FpsSelector({required this.value, required this.onChanged});
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return Row(
      children: kFpsOptions.map((opt) {
        final selected = opt == value;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: GestureDetector(
              onTap: () => onChanged(opt),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  gradient: selected ? c.primaryButtonGradient : null,
                  color: selected ? null : c.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: selected ? c.gold : Colors.white.withValues(alpha: 0.12),
                    width: selected ? 2 : 1,
                  ),
                  boxShadow: selected
                      ? [BoxShadow(color: c.gold.withValues(alpha: 0.4), blurRadius: 12)]
                      : null,
                ),
                child: Text(
                  '$opt',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: selected ? const Color(0xFF1A140A) : c.textMuted,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _VolumeSlider extends StatelessWidget {
  const _VolumeSlider({
    required this.label,
    required this.hint,
    required this.icon,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final String hint;
  final IconData icon;
  final double value;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: c.goldLight),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: c.bgSurface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: c.borderGold),
              ),
              child: Text(
                '${(value * 100).round()}%',
                style: TextStyle(color: c.gold, fontWeight: FontWeight.w800, fontSize: 12),
              ),
            ),
          ],
        ),
        Text(hint, style: TextStyle(color: c.textMuted, fontSize: 12)),
        SliderTheme(
          data: SliderThemeData(
            activeTrackColor: c.gold,
            inactiveTrackColor: c.bgSurface,
            thumbColor: c.goldLight,
            overlayColor: c.gold.withValues(alpha: 0.18),
            trackHeight: 4,
          ),
          child: Slider(
            value: value,
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }
}

/// بطاقة إعداد فاخرة بحواف ذهبية.
class _SettingsCard extends StatelessWidget {
  const _SettingsCard({
    required this.icon,
    required this.title,
    required this.children,
  });

  final IconData icon;
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF16120A), Color(0xFF0C0C0C)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.gold.withValues(alpha: 0.4), width: 1.3),
        boxShadow: [
          BoxShadow(color: c.gold.withValues(alpha: 0.1), blurRadius: 18),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: c.gold, size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  color: c.gold,
                  fontWeight: FontWeight.w900,
                  fontSize: 17,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const _SaduDivider(top: 8, bottom: 12),
          ...children,
        ],
      ),
    );
  }
}

/// فاصل بنقوش السدو التراثية.
class _SaduDivider extends StatelessWidget {
  const _SaduDivider({this.top = 14, this.bottom = 14});
  final double top;
  final double bottom;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: top, bottom: bottom),
      child: SizedBox(
        height: 6,
        width: double.infinity,
        child: CustomPaint(painter: _SaduLinePainter()),
      ),
    );
  }
}

class _SaduLinePainter extends CustomPainter {
  const _SaduLinePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..shader = const LinearGradient(
        colors: [
          Color(0x008B0000),
          Color(0xFF8B0000),
          Color(0xFFD4AF37),
          Color(0xFF8B0000),
          Color(0x008B0000),
        ],
        stops: [0.0, 0.25, 0.5, 0.75, 1.0],
      ).createShader(Offset.zero & size)
      ..strokeWidth = 1.4;
    final y = size.height / 2;
    canvas.drawLine(Offset(0, y), Offset(size.width, y), line);

    // معينات السدو الصغيرة على طول الفاصل.
    final diamond = Paint()..color = const Color(0xFFD4AF37);
    const step = 22.0;
    final r = size.height / 2;
    for (double x = step / 2; x < size.width; x += step) {
      final path = Path()
        ..moveTo(x, y - r)
        ..lineTo(x + r, y)
        ..lineTo(x, y + r)
        ..lineTo(x - r, y)
        ..close();
      canvas.drawPath(path, diamond);
    }
  }

  @override
  bool shouldRepaint(covariant _SaduLinePainter oldDelegate) => false;
}
