import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rab4ha_theme.dart';
import 'tournament_bracket.dart';
import 'tournament_hero_card.dart';

class TournamentDetailScreen extends ConsumerStatefulWidget {
  const TournamentDetailScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<TournamentDetailScreen> createState() => _TournamentDetailScreenState();
}

class _TournamentDetailScreenState extends ConsumerState<TournamentDetailScreen> {
  Map<String, dynamic>? _data;
  Timer? _poll;

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
      if (mounted) setState(() => _data = data);
    } catch (_) {
      if (!silent && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذّر تحميل البطولة')),
        );
      }
    }
  }

  Future<void> _join() async {
    final api = ref.read(apiClientProvider);
    await api.post('/api/tournaments/${widget.id}/join');
    await _load();
  }

  Future<void> _enter() async {
    final api = ref.read(apiClientProvider);
    await api.post('/api/tournaments/${widget.id}/enter');
    await _load();
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
            onWatch: () {},
            onEnter: _enter,
          ),
          if (t['status'] == 'registration') ...[
            const SizedBox(height: 20),
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
