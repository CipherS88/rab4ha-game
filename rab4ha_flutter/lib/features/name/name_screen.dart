import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../shared/widgets/buttons.dart';
import '../game/game_controller.dart';

/// P04 — شاشة الاسم + solo + تلميحات dev.
class NameScreen extends ConsumerStatefulWidget {
  const NameScreen({super.key});

  @override
  ConsumerState<NameScreen> createState() => _NameScreenState();
}

class _NameScreenState extends ConsumerState<NameScreen> {
  late final TextEditingController _nameCtrl;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: 'لاعب');
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeAutoSolo());
  }

  Future<void> _maybeAutoSolo() async {
    final qp = GoRouterState.of(context).uri.queryParameters;
    if (qp['solo'] == '1') {
      await _start(solo: true, seat: int.tryParse(qp['seat'] ?? ''));
    }
  }

  Future<void> _start({required bool solo, int? seat}) async {
    final name = _nameCtrl.text.trim().isEmpty ? 'لاعب' : _nameCtrl.text.trim();
    if (solo && seat != null && seat >= 0 && seat <= 3) {
      final res = await ref.read(gameControllerProvider.notifier).joinRoom(
            roomId: 'friendly',
            name: name,
            seat: seat,
            solo: true,
            mode: 'friendly',
          );
      if (!mounted) return;
      if (res?['error'] == null) {
        context.go('/game');
      }
      return;
    }
    final ok = await ref.read(matchmakingProvider.notifier).start(
          solo: solo,
          mode: 'friendly',
          name: name,
        );
    if (!mounted || !ok) return;
    context.go(solo ? '/game' : '/matchmaking');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('🃏', style: TextStyle(fontSize: 48)),
              const Text('رِبْعِهَا', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text(
                '4 لاعبين — أو جرّب solo',
                style: TextStyle(color: Color(0xFF9CA3AF)),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _nameCtrl,
                textAlign: TextAlign.center,
                maxLength: 20,
                decoration: const InputDecoration(labelText: 'اسمك في اللعبة'),
              ),
              const SizedBox(height: 16),
              PrimaryButton(
                label: 'العب مع 4 لاعبين',
                onPressed: () => _start(solo: false),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => _start(solo: true),
                child: const Text('تجربة solo (4 مقاعد)'),
              ),
              if (AppConfig.isDev) ...[
                const SizedBox(height: 20),
                const Text(
                  'Dev: ?solo=1&seat=0..3',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
