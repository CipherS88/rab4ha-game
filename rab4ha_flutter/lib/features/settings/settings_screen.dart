import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../shared/widgets/buttons.dart';
import '../auth/auth_provider.dart';

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
      setState(() => _msg = 'تم الحفظ');
    } catch (e) {
      setState(() => _msg = e.toString());
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('الإعدادات'),
        leading: BackButton(onPressed: () => context.go('/home')),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            TextField(controller: _email, decoration: const InputDecoration(labelText: 'البريد')),
            const SizedBox(height: 12),
            TextField(controller: _phone, decoration: const InputDecoration(labelText: 'الجوال')),
            const SizedBox(height: 8),
            Text(
              'لتحويل الجوائز المالية عبر تطبيق محفظة برق',
              style: TextStyle(color: Theme.of(context).colorScheme.outline, fontSize: 13),
            ),
            if (_msg != null) ...[
              const SizedBox(height: 12),
              Text(_msg!),
            ],
            const SizedBox(height: 20),
            PrimaryButton(label: 'حفظ', onPressed: _save),
            const SizedBox(height: 12),
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
    );
  }
}
