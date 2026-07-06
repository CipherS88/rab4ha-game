import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../shared/widgets/network_asset.dart';
import '../auth/auth_provider.dart';

class BagScreen extends ConsumerStatefulWidget {
  const BagScreen({super.key});

  @override
  ConsumerState<BagScreen> createState() => _BagScreenState();
}

class _BagScreenState extends ConsumerState<BagScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  List<dynamic> _storeItems = [];
  List<dynamic> _achievements = [];
  List<dynamic> _badges = [];
  Map<String, dynamic>? _tournamentPoints;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/api/store/bag');
      final data = await api.parseJson(res);
      setState(() {
        _storeItems = data['store_items'] as List? ?? [];
        _achievements = data['achievements'] as List? ?? [];
        _badges = data['badges'] as List? ?? [];
        final tp = data['tournament_points'];
        _tournamentPoints = tp is Map ? Map<String, dynamic>.from(tp) : null;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _equip(String category, String assetKey) async {
    final api = ref.read(apiClientProvider);
    final res = await api.post('/api/store/equip', body: {
      'category': category,
      'asset_key': assetKey,
    });
    await api.parseJson(res);
    await _load();
    await ref.read(profileProvider.notifier).fetch();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الحقيبة'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'المتجر'), Tab(text: 'الإنجازات')],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: [
                ListView.builder(
                  itemCount: _storeItems.length,
                  itemBuilder: (_, i) {
                    final item = _storeItems[i] as Map;
                    final cat = item['category']?.toString() ?? '';
                    final equipped = item['equipped'] == true;
                    final canEquip = cat == 'cards' || cat == 'session_bg';
                    return ListTile(
                      leading: item['image_url'] != null
                          ? SizedBox(
                              width: 40,
                              height: 40,
                              child: NetworkAssetImage(path: item['image_url'] as String),
                            )
                          : null,
                      title: Text(item['name']?.toString() ?? ''),
                      subtitle: Text(item['category_label']?.toString() ?? cat),
                      trailing: canEquip
                          ? TextButton(
                              onPressed: () => _equip(
                                cat,
                                equipped && item['is_default'] != true
                                    ? ''
                                    : item['asset_key']?.toString() ?? '',
                              ),
                              child: Text(equipped ? 'إلغاء' : 'تجهيز'),
                            )
                          : null,
                    );
                  },
                ),
                ListView.builder(
                  itemCount: _achievements.length + _badges.length + (_tournamentPoints != null ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (_tournamentPoints != null && i == 0) {
                      return ListTile(
                        leading: const Text('🏅', style: TextStyle(fontSize: 28)),
                        title: Text(_tournamentPoints!['label']?.toString() ?? 'نقاط البطولات'),
                        subtitle: const Text('غير قابل للتداول أو البيع'),
                      );
                    }
                    final offset = (_tournamentPoints != null ? 1 : 0);
                    if (i - offset < _badges.length) {
                      final b = _badges[i - offset] as Map;
                      return ListTile(
                        leading: const Icon(Icons.military_tech, color: Colors.amber),
                        title: Text(b['label']?.toString() ?? 'شارة'),
                        subtitle: const Text('شارة بطولة — غير قابلة للتداول'),
                      );
                    }
                    final a = _achievements[i - offset - _badges.length] as Map;
                    return ListTile(
                      title: Text(a['label']?.toString() ?? a['name']?.toString() ?? ''),
                      subtitle: Text(a['description']?.toString() ?? ''),
                      trailing: a['earned'] == true ? const Icon(Icons.check, color: Colors.green) : null,
                    );
                  },
                ),
              ],
            ),
    );
  }
}
