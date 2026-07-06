import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rab4ha_theme.dart';
import '../../core/theme/rank_themes.dart';
import '../../shared/widgets/network_asset.dart';
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
    final c = rab4haColors(context);
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
      body: Container(
        decoration: BoxDecoration(gradient: c.screenGradient),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            _buildCreateCard(context, c, decks, bgs),
            const SizedBox(height: 16),
            ..._sessions.map((s) {
              return SessionCardPreview(
                session: Map<String, dynamic>.from(s as Map),
                onTap: () => context.push('/sessions/${(s as Map)['id']}'),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildCreateCard(
    BuildContext context,
    Rab4haColors c,
    List<dynamic> decks,
    List<dynamic> bgs,
  ) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF16120A), Color(0xFF0C0C0C)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: c.gold.withValues(alpha: 0.45), width: 1.4),
        boxShadow: [
          BoxShadow(color: c.gold.withValues(alpha: 0.12), blurRadius: 22, spreadRadius: 1),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.workspace_premium, color: c.gold, size: 22),
              const SizedBox(width: 8),
              Text(
                'إنشاء صالة VIP',
                style: TextStyle(
                  color: c.gold,
                  fontWeight: FontWeight.w900,
                  fontSize: 19,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'عنوان الجلسة'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            activeColor: c.gold,
            title: const Text('جلسة مفتوحة'),
            value: _isOpen,
            onChanged: (v) => setState(() => _isOpen = v),
          ),
          TextField(
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'الرهان (ذهب)'),
            onChanged: (v) => _stake = int.tryParse(v) ?? 0,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            value: _rankIndex.clamp(0, rankTiers.length * subSuitLabels.length - 1),
            decoration: const InputDecoration(labelText: 'الحد الأدنى للتصنيف'),
            dropdownColor: c.bgElevated,
            items: _rankItems(),
            onChanged: (v) {
              if (v == null) return;
              setState(() {
                _minRank = v ~/ subSuitLabels.length;
                _minSub = v % subSuitLabels.length;
              });
            },
          ),
          if (decks.isNotEmpty) ...[
            const SizedBox(height: 18),
            _AssetCarousel(
              title: 'ظهر الكروت',
              leadingIcon: const Icon(Icons.style, size: 16, color: Color(0xFFF0C96A)),
              items: decks,
              selectedKey: _deckKey ?? '',
              portrait: true,
              onSelect: (k) => setState(() => _deckKey = k),
            ),
          ],
          if (bgs.isNotEmpty) ...[
            const SizedBox(height: 18),
            _AssetCarousel(
              title: 'خلفية الطاولة',
              leadingIcon: const Icon(Icons.image_outlined, size: 16, color: Color(0xFFF0C96A)),
              items: bgs,
              selectedKey: _bgKey ?? '',
              portrait: false,
              onSelect: (k) => setState(() => _bgKey = k),
            ),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _create,
              style: FilledButton.styleFrom(
                backgroundColor: c.gold,
                foregroundColor: const Color(0xFF1A140A),
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.add),
              label: const Text(
                'إنشاء الجلسة',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// معرض أفقي فاخر لاختيار ظهر الكروت أو خلفية الطاولة.
class _AssetCarousel extends StatelessWidget {
  const _AssetCarousel({
    required this.title,
    required this.leadingIcon,
    required this.items,
    required this.selectedKey,
    required this.onSelect,
    required this.portrait,
  });

  final String title;
  final Widget leadingIcon;
  final List<dynamic> items;
  final String selectedKey;
  final void Function(String key) onSelect;
  final bool portrait;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    final tileW = portrait ? 96.0 : 150.0;
    final tileH = portrait ? 130.0 : 108.0;
    // العنصر الأول = افتراضي، ثم عناصر الشنطة.
    final entries = <Map<String, String>>[
      {'asset_key': '', 'name': 'افتراضي', 'image_url': ''},
      ...items.map((e) {
        final m = e as Map;
        return {
          'asset_key': m['asset_key']?.toString() ?? '',
          'name': m['name']?.toString() ?? '',
          'image_url': m['image_url']?.toString() ?? '',
        };
      }),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            leadingIcon,
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                color: c.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: tileH + 26,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: entries.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final item = entries[i];
              final key = item['asset_key'] ?? '';
              final selected = key == selectedKey;
              final img = item['image_url'] ?? '';
              return GestureDetector(
                onTap: () => onSelect(key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: tileW,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: tileW,
                        height: tileH,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: selected ? c.gold : Colors.white.withValues(alpha: 0.12),
                            width: selected ? 3 : 1,
                          ),
                          boxShadow: selected
                              ? [BoxShadow(color: c.gold.withValues(alpha: 0.5), blurRadius: 14)]
                              : const [BoxShadow(color: Colors.black45, blurRadius: 6)],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(13),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              if (img.isEmpty)
                                Container(
                                  color: c.bgElevated,
                                  child: Icon(
                                    portrait ? Icons.hide_image_outlined : Icons.grid_view_rounded,
                                    color: c.textMuted,
                                    size: 30,
                                  ),
                                )
                              else
                                NetworkAssetImage(path: img, fit: BoxFit.cover),
                              if (selected)
                                Positioned(
                                  top: 4,
                                  right: 4,
                                  child: Container(
                                    padding: const EdgeInsets.all(3),
                                    decoration: BoxDecoration(
                                      color: c.gold,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.check,
                                        size: 13, color: Color(0xFF1A140A)),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item['name'] ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                          color: selected ? c.gold : c.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
