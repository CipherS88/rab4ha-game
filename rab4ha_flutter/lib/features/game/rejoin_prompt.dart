import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/app_config.dart';
import '../auth/auth_provider.dart';
import 'game_controller.dart';

class RejoinData {
  const RejoinData({
    required this.saved,
    required this.title,
    required this.subtitle,
  });

  final Map<String, dynamic> saved;
  final String title;
  final String subtitle;
}

class RejoinPromptNotifier extends Notifier<RejoinData?> {
  @override
  RejoinData? build() => null;

  Future<void> checkPending() async {
    if (state != null) return;
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(AppConfig.activeGameKey);
    if (raw == null) return;
    try {
      final saved = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      if (saved['roomId'] == 'friendly' || saved['roomId'] == 'solo') {
        await ref.read(gameControllerProvider.notifier).clearActiveGame();
        return;
      }
      if (saved['solo'] == true || (saved['roomId']?.toString().startsWith('solo_') ?? false)) return;
      final mode = saved['mode']?.toString() ?? 'friendly';
      if (mode == 'session' && saved['sessionId'] != null && saved['inGame'] != true) {
        state = RejoinData(
          saved: saved,
          title: 'عودة للجلسة',
          subtitle: 'لديك جلسة VIP نشطة — تريد العودة للوبي؟',
        );
        return;
      }
      if (saved['roomId'] != null && saved['inGame'] == true) {
        state = RejoinData(
          saved: saved,
          title: 'عودة للمباراة',
          subtitle: 'لديك مباراة جارية — تريد العودة للطاولة؟',
        );
        return;
      }
      if (saved['roomId'] != null && saved['inGame'] != true) {
        state = RejoinData(
          saved: saved,
          title: 'عودة للانتظار',
          subtitle: 'أنت في غرفة انتظار — تريد العودة؟',
        );
      }
    } catch (_) {}
  }

  void clear() => state = null;

  Future<void> accept(BuildContext context) async {
    final data = state;
    if (data == null) return;
    final saved = data.saved;
    state = null;
    final mode = saved['mode']?.toString() ?? 'friendly';
    if (mode == 'session' && saved['sessionId'] != null && saved['inGame'] != true) {
      if (context.mounted) context.push('/sessions/${saved['sessionId']}');
      return;
    }
    final profile = ref.read(profileProvider);
    final res = await ref.read(gameControllerProvider.notifier).joinRoom(
          roomId: saved['roomId']?.toString() ?? '',
          name: saved['name']?.toString() ?? profile?.name ?? 'لاعب',
          solo: saved['solo'] == true,
          mode: mode,
          sessionId: saved['sessionId']?.toString(),
        );
    if (!context.mounted) return;
    if (res?['error'] != null) {
      await ref.read(gameControllerProvider.notifier).clearActiveGame();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res!['error'].toString())),
      );
      return;
    }
    final room = res?['room'] as Map?;
    if (room?['status'] == 'playing') {
      context.go('/game');
    } else {
      context.go('/matchmaking');
    }
  }

  Future<void> decline() async {
    await ref.read(gameControllerProvider.notifier).clearActiveGame();
    state = null;
  }
}

final rejoinPromptProvider =
    NotifierProvider<RejoinPromptNotifier, RejoinData?>(RejoinPromptNotifier.new);

Future<void> showRejoinDialogIfNeeded(BuildContext context, WidgetRef ref) async {
  await ref.read(rejoinPromptProvider.notifier).checkPending();
  final data = ref.read(rejoinPromptProvider);
  if (data == null || !context.mounted) return;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(data.title),
      content: Text(data.subtitle),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('لا'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('نعم، العودة'),
        ),
      ],
    ),
  );
  if (ok == true) {
    await ref.read(rejoinPromptProvider.notifier).accept(context);
  } else {
    await ref.read(rejoinPromptProvider.notifier).decline();
  }
}
