import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/theme/rab4ha_theme.dart';
import '../../core/theme/rank_themes.dart';
import '../../shared/widgets/buttons.dart';
import '../auth/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  var _tab = 0;
  final _loginId = TextEditingController();
  final _loginPass = TextEditingController();
  final _regName = TextEditingController();
  final _regPass = TextEditingController();
  final _regPass2 = TextEditingController();

  @override
  void dispose() {
    _loginId.dispose();
    _loginPass.dispose();
    _regName.dispose();
    _regPass.dispose();
    _regPass2.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    ref.read(authProvider.notifier).clearError();
    try {
      await ref.read(authProvider.notifier).login(_loginId.text, _loginPass.text);
    } catch (_) {
      // الخطأ في authProvider.error — لا setState هنا
    }
  }

  Future<void> _register() async {
    ref.read(authProvider.notifier).clearError();
    try {
      final data = await ref.read(authProvider.notifier).register(
            displayName: _regName.text,
            password: _regPass.text,
            passwordConfirm: _regPass2.text,
          );
      if (!mounted) return;
      final code = formatPlayerCode(data['user']?['player_code']?.toString());
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('تم إنشاء حسابك'),
          content: Text('معرّفك: $code\nاحفظه لتسجيل الدخول لاحقاً'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('حسناً')),
          ],
        ),
      );
      ref.read(homeToastProvider.notifier).show('مرحباً! معرّفك $code');
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    final auth = ref.watch(authProvider);
    final error = auth.error;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                children: [
                  const Text('🃏', style: TextStyle(fontSize: 56)),
                  Text('رِبْعِهَا', style: Theme.of(context).textTheme.headlineLarge),
                  Text(
                    'بلوت أونلاين — سجّل دخولك أو أنشئ حساباً',
                    style: TextStyle(color: c.textMuted),
                  ),
                  const SizedBox(height: 24),
                  SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(value: 0, label: Text('دخول')),
                      ButtonSegment(value: 1, label: Text('حساب جديد')),
                    ],
                    selected: {_tab},
                    onSelectionChanged: auth.loading
                        ? null
                        : (s) {
                            ref.read(authProvider.notifier).clearError();
                            setState(() => _tab = s.first);
                          },
                  ),
                  const SizedBox(height: 20),
                  if (_tab == 0) ...[
                    _field('معرّف اللاعب', _loginId, ltr: true),
                    const SizedBox(height: 12),
                    _field('كلمة المرور', _loginPass, obscure: true),
                  ] else ...[
                    _field('اسم العرض', _regName),
                    const SizedBox(height: 12),
                    _field('كلمة المرور', _regPass, obscure: true),
                    const SizedBox(height: 12),
                    _field('تأكيد كلمة المرور', _regPass2, obscure: true),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    Text(error, style: TextStyle(color: c.danger), textAlign: TextAlign.center),
                  ],
                  const SizedBox(height: 20),
                  PrimaryButton(
                    label: auth.loading
                        ? 'جاري المعالجة...'
                        : (_tab == 0 ? 'دخول' : 'إنشاء الحساب'),
                    enabled: !auth.loading,
                    onPressed: auth.loading ? null : (_tab == 0 ? _login : _register),
                  ),
                  if (AppConfig.isDev) ...[
                    const SizedBox(height: 16),
                    Text(
                      'للتطوير: npm start ثم http://localhost:3000/app/',
                      style: TextStyle(color: c.textMuted, fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    ExpansionTile(
                      title: const Text('دخول سريع (تجريبي)'),
                      children: [
                        for (final i in [1, 2, 3])
                          ListTile(
                            title: Text('لاعب $i'),
                            onTap: auth.loading
                                ? null
                                : () {
                                    _loginId.text = '$i';
                                    _loginPass.text = '$i';
                                    _login();
                                  },
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {bool obscure = false, bool ltr = false}) {
    final c = rab4haColors(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: c.textMuted, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          obscureText: obscure,
          enabled: !ref.watch(authProvider).loading,
          textDirection: ltr ? TextDirection.ltr : TextDirection.rtl,
          decoration: InputDecoration(
            filled: true,
            fillColor: c.inputBg,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: c.inputBorder),
            ),
          ),
        ),
      ],
    );
  }
}
