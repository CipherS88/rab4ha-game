import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/rab4ha_theme.dart';
import '../../core/network/api_client.dart';
import '../../shared/widgets/buttons.dart';
import '../../shared/widgets/network_asset.dart';
import '../auth/auth_provider.dart';

class StoreScreen extends ConsumerStatefulWidget {
  const StoreScreen({super.key});

  @override
  ConsumerState<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends ConsumerState<StoreScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  var _tab = 'cards';
  List<dynamic> _products = [];
  var _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(() {
      if (!_tabs.indexIsChanging) {
        _tab = _tabs.index == 0 ? 'cards' : 'session_bg';
        _load();
      }
    });
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/api/store/products', query: {'category': _tab});
      final data = await api.parseJson(res);
      setState(() {
        _products = data['products'] as List? ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _purchase(String id) async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/store/purchase/$id');
      await api.parseJson(res);
      await ref.read(profileProvider.notifier).fetch();
      await _load();
      if (mounted) {
        ref.read(homeToastProvider.notifier).show('تم الشراء');
      }
    } catch (e) {
      if (mounted) {
        ref.read(homeToastProvider.notifier).show(e.toString());
      }
    }
  }

  String _ownershipLabel(Map p) {
    if (p['ownership_type'] == 'rental') {
      final days = p['rental_days'] ?? 7;
      return 'إيجار $days يوم';
    }
    return 'شراء دائم';
  }

  Widget _ownershipChip(Map p) {
    final rental = p['ownership_type'] == 'rental';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: rental ? const Color(0x33F0C96A) : const Color(0x334ADE80),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        _ownershipLabel(p),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: rental ? const Color(0xFFF0C96A) : const Color(0xFF4ADE80),
        ),
      ),
    );
  }

  Widget _previewImage(Map<String, dynamic> p, BuildContext ctx) {
    final url = p['image_url']?.toString();
    if (url == null) return const SizedBox.shrink();
    final isBg = p['category'] == 'session_bg';
    final maxHeight = isBg ? MediaQuery.sizeOf(ctx).height * 0.58 : 220.0;

    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: isBg ? 9 / 16 : 1,
            child: ColoredBox(
              color: Rab4haColors.dark.bgSurface,
              child: NetworkAssetImage(path: url, fit: BoxFit.contain),
            ),
          ),
        ),
      ),
    );
  }

  void _openPreview(Map<String, dynamic> p) {
    final owned = p['owned'] == true;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Rab4haColors.dark.bgElevated,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.paddingOf(ctx).bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(p['name']?.toString() ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _previewImage(p, ctx),
            const SizedBox(height: 12),
            Text(p['description']?.toString() ?? '', style: TextStyle(color: Rab4haColors.dark.textMuted)),
            const SizedBox(height: 8),
            _ownershipChip(p),
            const SizedBox(height: 8),
            Text(
              p['is_free'] == true ? 'مجاني' : '${p['price']} 🪙',
              style: const TextStyle(fontSize: 18, color: Color(0xFFD4AF37)),
            ),
            const SizedBox(height: 16),
            if (!owned)
              PrimaryButton(
                label: 'شراء',
                onPressed: () {
                  Navigator.pop(ctx);
                  _purchase(p['id'].toString());
                },
              )
            else
              const Center(child: Text('مملوك ✓')),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('المتجر'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'أوراق'), Tab(text: 'خلفيات')],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _products.isEmpty
                  ? const Center(child: Text('لا توجد منتجات'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _products.length,
                      itemBuilder: (_, i) {
                        final p = _products[i] as Map;
                        final img = p['image_url']?.toString();
                        final desc = p['description']?.toString() ?? '';
                        return Card(
                          child: ListTile(
                            leading: img != null
                                ? SizedBox(
                                    width: 48,
                                    height: 48,
                                    child: NetworkAssetImage(path: img),
                                  )
                                : const Icon(Icons.shopping_bag),
                            title: Text(p['name']?.toString() ?? ''),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (desc.isNotEmpty) ...[
                                  Text(desc),
                                  const SizedBox(height: 4),
                                ],
                                _ownershipChip(p),
                              ],
                            ),
                            isThreeLine: desc.isNotEmpty,
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                TextButton(
                                  onPressed: () => _openPreview(Map<String, dynamic>.from(p)),
                                  child: const Text('معاينة'),
                                ),
                                if (p['owned'] == true)
                                  const Text('مملوك')
                                else
                                  TextButton(
                                    onPressed: () => _purchase(p['id'].toString()),
                                    child: Text(p['is_free'] == true ? 'مجاني' : '${p['price']} 🪙'),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
