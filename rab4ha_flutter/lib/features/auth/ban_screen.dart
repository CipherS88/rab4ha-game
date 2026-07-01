import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/buttons.dart';
import 'auth_provider.dart';

/// P06 — شاشة حظر الحساب مع السبب.
class BanScreen extends ConsumerWidget {
  const BanScreen({super.key, required this.reason});
  final String reason;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.block, size: 72, color: Color(0xFFEF4444)),
              const SizedBox(height: 16),
              const Text(
                'حسابك محظور',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                reason,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Color(0xFF9CA3AF)),
              ),
              const SizedBox(height: 32),
              PrimaryButton(
                label: 'العودة لتسجيل الدخول',
                onPressed: () => ref.read(authProvider.notifier).clearBan(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
