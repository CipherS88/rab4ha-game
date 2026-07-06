import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rab4ha_theme.dart';
import '../auth/auth_provider.dart';
import '../game/game_controller.dart';
import 'tournament_bracket.dart';
import 'tournament_hero_card.dart';
import 'tournament_captcha_dialog.dart';

class TournamentDetailScreen extends ConsumerStatefulWidget {
  const TournamentDetailScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<TournamentDetailScreen> createState() => _TournamentDetailScreenState();
}

class _TournamentDetailScreenState extends ConsumerState<TournamentDetailScreen> {
  Map<String, dynamic>? _data;
  Timer? _poll;
  bool _routing = false;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 2), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/api/tournaments/${widget.id}');
      final data = await api.parseJson(res);
      if (!mounted) return;
      setState(() => _data = data);
      // انتقال تلقائي لطاولة اللعب بمجرد تجهيز مباراة اللاعب.
      final t = Map<String, dynamic>.from(data['tournament'] as Map? ?? {});
      final myMatch = t['my_match'];
      if (myMatch is Map && myMatch['room_id'] != null) {
        await _enterMatchRoom(myMatch['room_id'].toString());
      }
    } catch (_) {
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذّر تحميل البطولة')),
        );
      }
    }
  }

  Future<void> _join() async {
    final cap = await showTournamentCaptchaDialog(context, ref);
    if (cap == null) return;
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/tournaments/${widget.id}/join', body: {
        'captcha_token': cap.token,
        'captcha_answer': cap.answer,
      });
      final data = await api.parseJson(res);
      if (data['error'] != null) {
        throw ApiException(data['error'].toString());
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تم حجز مقعدك في البطولة ✓')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.mapError(e).message)),
        );
      }
    }
  }

  /// أدمن فقط: ملء البطولة بالبوتات لتجربة كل شيء.
  Future<void> _fillBots() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/tournaments/${widget.id}/fill-bots');
      final data = await api.parseJson(res);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تمت إضافة ${data['added'] ?? 0} بوت — اضغط "ادخل الآن" عند بدء اللوبي')),
        );
      }
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تعذّر ملء البوتات: $e')),
        );
      }
    }
  }

  Future<void> _enter() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/tournaments/${widget.id}/enter');
      await api.parseJson(res);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تعذّر الدخول: $e')),
        );
      }
    }
    // إن كانت المباراة جاهزة الآن ندخل مباشرة، وإلا فالبولينج سيدخلنا تلقائياً بمجرد جاهزيتها.
    await _load();
  }

  /// دخول طاولة مباراة البطولة كلاعب (بدون أخطاء توجيه).
  Future<void> _enterMatchRoom(String roomId) async {
    if (_routing) return;
    _routing = true;
    _poll?.cancel();
    try {
      final profile = ref.read(profileProvider);
      final result = await ref.read(gameControllerProvider.notifier).joinRoom(
            roomId: roomId,
            name: profile?.name ?? 'لاعب',
            mode: 'tournament',
          );
      if (result != null && result['error'] != null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result['error'].toString())),
          );
        }
        _routing = false;
        _poll = Timer.periodic(const Duration(seconds: 2), (_) => _load(silent: true));
        return;
      }
      if (mounted) context.go('/game');
    } catch (e) {
      _routing = false;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تعذّر دخول الطاولة: $e')),
        );
        _poll = Timer.periodic(const Duration(seconds: 2), (_) => _load(silent: true));
      }
    }
  }

  /// مشاهدة مباراة بطولة حية (وضع المشاهد).
  Future<void> _watch() async {
    if (_routing) return;
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/api/tournaments/${widget.id}/watch');
      final match = await api.parseJson(res);
      final roomId = match['room_id']?.toString();
      if (roomId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('لا توجد مباراة حية للمشاهدة الآن')),
          );
        }
        return;
      }
      _routing = true;
      _poll?.cancel();
      final profile = ref.read(profileProvider);
      final result = await ref.read(gameControllerProvider.notifier).spectateRoom(
            roomId: roomId,
            name: profile?.name ?? 'مشاهد',
          );
      if (result != null && result['error'] != null) {
        _routing = false;
        _poll = Timer.periodic(const Duration(seconds: 2), (_) => _load(silent: true));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result['error'].toString())),
          );
        }
        return;
      }
      if (mounted) context.go('/game');
    } catch (e) {
      _routing = false;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تعذّرت المشاهدة: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    if (_data == null) {
      return Scaffold(
        backgroundColor: c.bgDark,
        body: Center(child: CircularProgressIndicator(color: c.gold)),
      );
    }
    final t = Map<String, dynamic>.from(_data!['tournament'] as Map? ?? {});
    final players = _data!['registered_players'] as List? ?? [];
    final teams = _data!['teams'] as List? ?? [];
    final bracket = Map<String, dynamic>.from(_data!['bracket'] as Map? ?? {});

    return Scaffold(
      backgroundColor: c.bgDark,
      appBar: AppBar(
        title: const Text('البطولة'),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 24),
        children: [
          TournamentHeroCard(
            tournament: t,
            onReserve: _join,
            onWatch: _watch,
            onEnter: _enter,
          ),
          if (t['status'] == 'registration') ...[
            const SizedBox(height: 20),
            if (ref.watch(profileProvider)?.isAdmin == true) ...[
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _fillBots,
                  icon: const Icon(Icons.smart_toy_outlined),
                  label: const Text('ملء البطولة بالبوتات (أدمن)'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: c.goldLight,
                    side: BorderSide(color: c.gold.withValues(alpha: 0.6)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(height: 14),
            ],
            Text(
              'المسجلون (${t['entry_count']}/${t['size']})',
              style: TextStyle(color: c.goldLight, fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 8),
            TournamentPlayerGrid(players: players),
          ],
          if (teams.isNotEmpty && (t['status'] == 'lobby' || t['status'] == 'active')) ...[
            const SizedBox(height: 20),
            Text('الفرق', style: TextStyle(color: c.goldLight, fontWeight: FontWeight.w800)),
            ...teams.map((team) {
              final tm = Map<String, dynamic>.from(team as Map);
              return ListTile(
                title: Text(tm['name']?.toString() ?? 'فريق'),
                subtitle: Text('${(tm['members'] as List?)?.length ?? 0} أعضاء'),
                trailing: tm['all_checked_in'] == true
                    ? const Icon(Icons.check, color: Colors.green)
                    : null,
              );
            }),
          ],
          if (t['status'] == 'active' || t['status'] == 'completed') ...[
            const SizedBox(height: 20),
            Text('شجرة البطولة', style: TextStyle(color: c.goldLight, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            SizedBox(
              height: 280,
              child: TournamentBracketView(bracket: bracket),
            ),
          ],
        ],
      ),
    );
  }
}
