import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rab4ha_theme.dart';
import 'tournament_hero_card.dart';
import 'tournament_captcha_dialog.dart';

class TournamentsScreen extends ConsumerStatefulWidget {
  const TournamentsScreen({super.key});

  @override
  ConsumerState<TournamentsScreen> createState() => _TournamentsScreenState();
}

class _TournamentsScreenState extends ConsumerState<TournamentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  var _type = 'casual';
  List<dynamic> _items = [];
  Map<String, dynamic>? _meta;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(() {
      if (!_tabs.indexIsChanging) {
        _type = _tabs.index == 0 ? 'casual' : 'pro';
        _load();
      }
    });
    _load();
  }

  Future<void> _load() async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/api/tournaments', query: {'type': _type});
    final data = await api.parseJson(res);
    setState(() {
      _items = data['tournaments'] as List? ?? [];
      _meta = data;
    });
  }

  Future<void> _join(String id) async {
    final cap = await showTournamentCaptchaDialog(context, ref);
    if (cap == null) return;
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/tournaments/$id/join', body: {
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

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    final quota = _meta?['quota'] as Map?;
    return Scaffold(
      backgroundColor: c.bgDark,
      appBar: AppBar(
        title: const Text('البطولات'),
        leading: BackButton(onPressed: () => context.go('/home')),
        actions: [
          if (_type == 'casual')
            IconButton(
              icon: Icon(Icons.add, color: c.goldLight),
              tooltip: 'إنشاء بطولة',
              onPressed: () => context.push('/tournaments/create'),
            ),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'ترفيهية'), Tab(text: 'احترافية')],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          if (_type == 'casual' && quota != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                'حصة إنشاء البطولات: ${quota['used']}/${quota['limit']} — رسوم الإنشاء 500 عملة',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textMuted),
              ),
            ),
          if (_items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'لا توجد بطولات حالياً',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textMuted),
              ),
            )
          else
            ..._items.map((raw) {
              final m = Map<String, dynamic>.from(raw as Map);
              final id = m['id'].toString();
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: TournamentHeroCard(
                  tournament: m,
                  compact: true,
                  onReserve: () => _join(id),
                  onWatch: () => context.push('/tournaments/$id'),
                  onEnter: () => context.push('/tournaments/$id'),
                ),
              );
            }),
        ],
      ),
      floatingActionButton: _type == 'casual'
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/tournaments/create'),
              icon: const Icon(Icons.emoji_events_outlined),
              label: const Text('إنشاء بطولة'),
            )
          : null,
    );
  }
}
