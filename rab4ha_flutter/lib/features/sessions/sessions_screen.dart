import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rank_themes.dart';
import 'session_board.dart';

class SessionsScreen extends ConsumerStatefulWidget {
  const SessionsScreen({super.key});

  @override
  ConsumerState<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends ConsumerState<SessionsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  var _filter = 'open';
  List<dynamic> _sessions = [];
  Map<String, dynamic>? _bagOptions;

  final _title = TextEditingController(text: 'جلسة بلوت');
  var _isOpen = true;
  var _stake = 0;
  var _minRank = 0;
  var _minSub = 0;
  String? _deckKey;
  String? _bgKey;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _tabs.addListener(() {
      if (!_tabs.indexIsChanging) {
        _filter = ['open', 'mine', 'full'][_tabs.index];
        _load();
      }
    });
    _load();
    _loadBagOptions();
  }

  Future<void> _loadBagOptions() async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/api/sessions/bag-options');
    final data = await api.parseJson(res);
    setState(() => _bagOptions = data);
  }

  Future<void> _load() async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/api/sessions', query: {'filter': _filter});
    final data = await api.parseJson(res);
    setState(() => _sessions = data['sessions'] as List? ?? []);
  }

  Future<void> _create() async {
    final api = ref.read(apiClientProvider);
    final res = await api.post('/api/sessions', body: {
      'title': _title.text.trim(),
      'is_open': _isOpen,
      'min_rank': _minRank,
      'min_sub_rank': _minSub,
      'stake': _stake,
      if (_deckKey != null && _deckKey!.isNotEmpty) 'deck_asset_key': _deckKey,
      if (_bgKey != null && _bgKey!.isNotEmpty) 'bg_asset_key': _bgKey,
    });
    final data = await api.parseJson(res);
    final id = data['session']?['id']?.toString();
    if (id != null && mounted) context.push('/sessions/$id');
    await _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _title.dispose();
    super.dispose();
  }

  List<DropdownMenuItem<int>> _rankItems() {
    final items = <DropdownMenuItem<int>>[];
    var idx = 0;
    for (var r = 0; r < rankTiers.length; r++) {
      for (var s = 0; s < subSuitLabels.length; s++) {
        items.add(DropdownMenuItem(
          value: idx,
          child: Text('${rankTiers[r].name} ${subSuitLabels[s]}'),
        ));
        idx++;
      }
    }
    return items;
  }

  int get _rankIndex => _minRank * subSuitLabels.length + _minSub;

  @override
  Widget build(BuildContext context) {
    final decks = (_bagOptions?['decks'] as List?) ?? [];
    final bgs = (_bagOptions?['backgrounds'] as List?) ?? [];
    return Scaffold(
      appBar: AppBar(
        title: const Text('جلسات VIP'),
        leading: BackButton(onPressed: () => context.go('/home')),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'مفتوحة'),
            Tab(text: 'جلساتي'),
            Tab(text: 'ممتلئة'),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('إنشاء جلسة', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _title,
                    decoration: const InputDecoration(labelText: 'عنوان الجلسة'),
                  ),
                  SwitchListTile(
                    title: const Text('جلسة مفتوحة'),
                    value: _isOpen,
                    onChanged: (v) => setState(() => _isOpen = v),
                  ),
                  TextField(
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'الرهان (ذهب)'),
                    onChanged: (v) => _stake = int.tryParse(v) ?? 0,
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    value: _rankIndex.clamp(0, rankTiers.length * subSuitLabels.length - 1),
                    decoration: const InputDecoration(labelText: 'الحد الأدنى للتصنيف'),
                    items: _rankItems(),
                    onChanged: (v) {
                      if (v == null) return;
                      setState(() {
                        _minRank = v ~/ subSuitLabels.length;
                        _minSub = v % subSuitLabels.length;
                      });
                    },
                  ),
                  if (decks.isNotEmpty)
                    DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'ظهر الكروت'),
                      items: [
                        const DropdownMenuItem(value: '', child: Text('افتراضي')),
                        ...decks.map((d) {
                          final m = d as Map;
                          return DropdownMenuItem(
                            value: m['asset_key']?.toString() ?? '',
                            child: Text(m['name']?.toString() ?? ''),
                          );
                        }),
                      ],
                      onChanged: (v) => setState(() => _deckKey = v),
                    ),
                  if (bgs.isNotEmpty)
                    DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'خلفية الجلسة'),
                      items: [
                        const DropdownMenuItem(value: '', child: Text('افتراضي')),
                        ...bgs.map((d) {
                          final m = d as Map;
                          return DropdownMenuItem(
                            value: m['asset_key']?.toString() ?? '',
                            child: Text(m['name']?.toString() ?? ''),
                          );
                        }),
                      ],
                      onChanged: (v) => setState(() => _bgKey = v),
                    ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: _create,
                    icon: const Icon(Icons.add),
                    label: const Text('إنشاء'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          ..._sessions.map((s) {
            return SessionCardPreview(
              session: Map<String, dynamic>.from(s as Map),
              onTap: () => context.push('/sessions/${(s as Map)['id']}'),
            );
          }),
        ],
      ),
    );
  }
}
