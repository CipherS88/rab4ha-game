import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/rab4ha_theme.dart';
import '../../shared/widgets/buttons.dart';
import '../game/game_controller.dart';

class MatchmakingScreen extends ConsumerWidget {
  const MatchmakingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(gameControllerProvider, (prev, next) {
      if (next.gs != null || next.room?['status'] == 'playing') {
        Future.microtask(() {
          if (context.mounted) context.go('/game');
        });
      }
      if ((prev?.roomCloseSignal ?? 0) < next.roomCloseSignal && context.mounted) {
        context.go('/home');
      }
    });

    final mm = ref.watch(matchmakingProvider);
    final room = ref.watch(gameControllerProvider).room;
    final seats = (room?['seats'] as List?) ?? [];
    final filled = seats.where((s) {
      final m = s as Map?;
      return m?['occupied'] == true || m?['name'] != null;
    }).length;
    final c = rab4haColors(context);

    String title;
    String sub;
    if (mm.solo) {
      title = 'وضع التجربة الفردية';
      sub = 'تتحكم بكل المقاعد';
    } else if (mm.mode == 'ranked') {
      title = 'جاري البحث عن خصوم...';
      sub = 'مباراة مصنّفة — بانتظار 4 لاعبين';
    } else if (mm.mode == 'match52') {
      title = 'مباراة 52';
      sub = 'ودّية — يبدأ الفريقان من 52 نقطة';
    } else {
      title = 'غرفة ودّية';
      sub = 'لاعب واحد + بوتات — اضغط «ملء بالروبوت»';
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('الانتظار'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () async {
            await ref.read(gameControllerProvider.notifier).leaveGame();
            if (context.mounted) context.go('/home');
          },
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            Text(sub, style: TextStyle(color: c.textMuted)),
            const SizedBox(height: 8),
            Text('$filled / 4', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            _SeatsPreview(seats: seats),
            const SizedBox(height: 24),
            if (mm.error != null) Text(mm.error!, style: TextStyle(color: c.danger)),
            const Spacer(),
            if (!mm.solo && mm.mode != 'ranked')
              PrimaryButton(
                label: 'ملء بالروبوت',
                onPressed: () => ref.read(gameControllerProvider.notifier).fillBots(),
              ),
            if (!mm.solo && mm.mode != 'ranked') const SizedBox(height: 12),
            SecondaryButton(
              label: 'مغادرة',
              onPressed: () async {
                await ref.read(gameControllerProvider.notifier).leaveGame();
                if (context.mounted) context.go('/home');
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _SeatsPreview extends StatelessWidget {
  const _SeatsPreview({required this.seats});
  final List<dynamic> seats;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    if (seats.isEmpty) {
      return Text('بانتظار اللاعبين...', style: TextStyle(color: c.textMuted));
    }
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      alignment: WrapAlignment.center,
      children: List.generate(4, (i) {
        final seat = i < seats.length ? seats[i] as Map? : null;
        final name = seat?['name']?.toString();
        final occupied = seat?['occupied'] == true || (name != null && name.isNotEmpty);
        return Container(
          width: 72,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
          decoration: BoxDecoration(
            color: occupied ? c.accent.withValues(alpha: 0.15) : c.inputBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: occupied ? c.accent : c.inputBorder,
            ),
          ),
          child: Column(
            children: [
              Icon(
                occupied ? Icons.person : Icons.person_outline,
                color: occupied ? c.accent : c.textMuted,
              ),
              const SizedBox(height: 4),
              Text(
                occupied ? (name ?? 'لاعب') : 'فارغ',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: occupied ? null : c.textMuted),
              ),
            ],
          ),
        );
      }),
    );
  }
}
