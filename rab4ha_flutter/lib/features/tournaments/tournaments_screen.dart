import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rab4ha_theme.dart';
import '../../shared/widgets/buttons.dart';
import 'tournament_hero_card.dart';

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
  final _title = TextEditingController(text: 'بطولة بلوت');
  var _size = 8;
  var _format = 'bo1';
  var _showCreate = false;

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

  Future<void> _create() async {
    final api = ref.read(apiClientProvider);
    final res = await api.post('/api/tournaments', body: {
      'type': _type,
      'title': _title.text.trim(),
      'size': _size,
      'match_format': _format,
    });
    final data = await api.parseJson(res);
    setState(() => _showCreate = false);
    await _load();
    final created = data['tournament'] as Map?;
    if (created != null && mounted) {
      context.push('/tournaments/${created['id']}');
    }
  }

  Future<void> _join(String id) async {
    final api = ref.read(apiClientProvider);
    await api.post('/api/tournaments/$id/join');
    await _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _title.dispose();
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
              icon: Icon(_showCreate ? Icons.close : Icons.add, color: c.goldLight),
              onPressed: () => setState(() => _showCreate = !_showCreate),
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
                'حصة إنشاء البطولات: ${quota['used']}/${quota['limit']}',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.textMuted),
              ),
            ),
          if (_showCreate && _type == 'casual') ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  children: [
                    TextField(
                      controller: _title,
                      decoration: const InputDecoration(labelText: 'اسم البطولة'),
                    ),
                    DropdownButtonFormField<int>(
                      initialValue: _size,
                      decoration: const InputDecoration(labelText: 'عدد اللاعبين'),
                      items: [8, 16, 32, 64]
                          .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                          .toList(),
                      onChanged: (v) => setState(() => _size = v ?? 8),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: _format,
                      decoration: const InputDecoration(labelText: 'نظام المباريات'),
                      items: const [
                        DropdownMenuItem(value: 'bo1', child: Text('جولة واحدة')),
                        DropdownMenuItem(value: 'bo3', child: Text('أفضل من 3')),
                        DropdownMenuItem(value: 'elim_bo3_final', child: Text('إقصاء + نهائي BO3')),
                      ],
                      onChanged: (v) => setState(() => _format = v ?? 'bo1'),
                    ),
                    const SizedBox(height: 8),
                    PrimaryButton(label: 'إنشاء البطولة', onPressed: _create),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
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
    );
  }
}
