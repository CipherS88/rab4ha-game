import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../shared/widgets/buttons.dart';
import '../auth/auth_provider.dart';
import '../game/game_controller.dart';
import 'session_board.dart';

class SessionLobbyScreen extends ConsumerStatefulWidget {
  const SessionLobbyScreen({super.key, required this.sessionId});
  final String sessionId;

  @override
  ConsumerState<SessionLobbyScreen> createState() => _SessionLobbyScreenState();
}

class _SessionLobbyScreenState extends ConsumerState<SessionLobbyScreen> {
  Map<String, dynamic>? _detail;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 1), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/api/sessions/${widget.sessionId}');
      final data = await api.parseJson(res);
      if (!mounted) return;
      setState(() => _detail = data);
      final session = data['session'] as Map? ?? {};
      final isMember = session['is_member'] == true;
      // اللاعب العضو ينضم تلقائياً عند بدء المباراة. غير الأعضاء يشاهدون بزر منفصل.
      if (data['started'] == true && data['roomId'] != null && isMember) {
        _poll?.cancel();
        final profile = ref.read(profileProvider);
        await ref.read(gameControllerProvider.notifier).joinRoom(
              roomId: data['roomId'] as String,
              name: profile?.name ?? 'لاعب',
              mode: 'session',
              sessionId: widget.sessionId,
            );
        if (mounted) context.go('/game');
      }
    } catch (e) {
      if (!silent && mounted) {
        ref.read(homeToastProvider.notifier).show(e.toString());
      }
    }
  }

  Future<void> _joinSeat(int seat) async {
    final api = ref.read(apiClientProvider);
    await api.post('/api/sessions/${widget.sessionId}/join', body: {'seat': seat});
    ref.read(homeToastProvider.notifier).show('انضممت للمقعد');
    await _load();
  }

  Future<void> _spectate(String roomId) async {
    final profile = ref.read(profileProvider);
    _poll?.cancel();
    final res = await ref.read(gameControllerProvider.notifier).spectateRoom(
          roomId: roomId,
          name: profile?.name ?? 'مشاهد',
          sessionId: widget.sessionId,
        );
    if (res != null && res['error'] != null) {
      ref.read(homeToastProvider.notifier).show(res['error'].toString());
      _poll = Timer.periodic(const Duration(seconds: 1), (_) => _load(silent: true));
      return;
    }
    if (mounted) context.go('/game');
  }

  Future<void> _leave() async {
    final api = ref.read(apiClientProvider);
    await api.post('/api/sessions/${widget.sessionId}/leave');
    await ref.read(gameControllerProvider.notifier).clearActiveGame();
    ref.read(homeToastProvider.notifier).show('غادرت الجلسة');
    if (mounted) context.go('/sessions');
  }

  @override
  Widget build(BuildContext context) {
    if (_detail == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final session = Map<String, dynamic>.from(_detail!['session'] as Map? ?? {});
    final seats = session['seats'] as List? ?? [];
    final countdown = session['in_countdown'] == true ? session['countdown_seconds'] as int? : null;
    final isPlaying = _detail!['started'] == true || session['status'] == 'playing';
    final isMember = session['is_member'] == true;
    final canSpectate = isPlaying && !isMember && _detail!['roomId'] != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(session['title']?.toString() ?? 'اللوبي'),
        actions: [
          TextButton(onPressed: _leave, child: const Text('مغادرة')),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(session['status']?.toString() ?? '', style: const TextStyle(fontSize: 18)),
            if (session['stake'] != null && (session['stake'] as num) > 0)
              Text('الرهان: 🪙 ${session['stake']}'),
            if (countdown != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  'البدء خلال $countdown...',
                  style: const TextStyle(fontSize: 22, color: Colors.amber, fontWeight: FontWeight.bold),
                ),
              ),
            const SizedBox(height: 16),
            Expanded(
              child: Center(
                child: SessionTeamsBoard(
                  seats: seats,
                  onJoinSeat: _joinSeat,
                  canJoin: session['is_member'] != true,
                  sessionOpen: session['is_open'] == true,
                  isFull: session['is_full'] == true,
                ),
              ),
            ),
            if (canSpectate)
              _SpectatorEntry(
                onSpectate: () => _spectate(_detail!['roomId'] as String),
              ),
            if (session['can_force_start'] == true)
              PrimaryButton(
                label: 'بدء الآن',
                onPressed: () async {
                  final api = ref.read(apiClientProvider);
                  await api.post('/api/sessions/${widget.sessionId}/start');
                  await _load();
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _SpectatorEntry extends StatelessWidget {
  const _SpectatorEntry({required this.onSpectate});
  final VoidCallback onSpectate;

  @override
  Widget build(BuildContext context) {
    const gold = Color(0xFFD4AF37);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF14251C), Color(0xFF0B1712)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: gold.withValues(alpha: 0.5), width: 1.4),
        boxShadow: [
          BoxShadow(color: gold.withValues(alpha: 0.15), blurRadius: 16),
        ],
      ),
      child: Column(
        children: [
          const Text(
            'الجلسة ممتلئة والمباراة جارية',
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onSpectate,
              style: FilledButton.styleFrom(
                backgroundColor: gold,
                foregroundColor: const Color(0xFF1A140A),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.visibility),
              label: const Text(
                'دخول كمشاهد',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
