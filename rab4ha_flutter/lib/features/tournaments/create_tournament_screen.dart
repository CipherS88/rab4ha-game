import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/theme/rab4ha_theme.dart';
import '../../shared/widgets/buttons.dart';
import '../auth/auth_provider.dart';

class CreateTournamentScreen extends ConsumerStatefulWidget {
  const CreateTournamentScreen({super.key});

  @override
  ConsumerState<CreateTournamentScreen> createState() => _CreateTournamentScreenState();
}

class _CreateTournamentScreenState extends ConsumerState<CreateTournamentScreen> {
  final _title = TextEditingController(text: 'بطولة بلوت');
  var _size = 8;
  var _format = 'bo1';
  var _customDeckKey = '';
  var _customBgKey = '';
  var _enableCustom = false;
  var _creating = false;
  Map<String, dynamic>? _fees;
  List<dynamic> _deckOptions = [];
  List<dynamic> _bgOptions = [];

  @override
  void initState() {
    super.initState();
    _loadMeta();
  }

  Future<void> _loadMeta() async {
    final api = ref.read(apiClientProvider);
    try {
      final feesRes = await api.get('/api/tournaments/meta/fees');
      final fees = await api.parseJson(feesRes);
      final bagRes = await api.get('/api/store/bag');
      final bag = await api.parseJson(bagRes);
      final items = bag['store_items'] as List? ?? [];
      if (mounted) {
        setState(() {
          _fees = Map<String, dynamic>.from(fees as Map);
          _deckOptions = items.where((i) => (i as Map)['category'] == 'cards').toList();
          _bgOptions = items.where((i) => (i as Map)['category'] == 'session_bg').toList();
        });
      }
    } catch (_) {}
  }

  int get _totalFee {
    final base = (_fees?['create_fee'] as num?)?.toInt() ?? 500;
    final custom = (_fees?['customize_fee'] as num?)?.toInt() ?? 100;
    final hasCustom = _enableCustom && (_customDeckKey.isNotEmpty || _customBgKey.isNotEmpty);
    return base + (hasCustom ? custom : 0);
  }

  Future<void> _create() async {
    if (_creating) return;
    setState(() => _creating = true);
    try {
      final api = ref.read(apiClientProvider);
      final body = <String, dynamic>{
        'type': 'casual',
        'title': _title.text.trim(),
        'size': _size,
        'match_format': _format,
      };
      if (_enableCustom) {
        if (_customDeckKey.isNotEmpty) body['custom_deck_key'] = _customDeckKey;
        if (_customBgKey.isNotEmpty) body['custom_bg_key'] = _customBgKey;
      }
      final res = await api.post('/api/tournaments', body: body);
      final data = await api.parseJson(res);
      await ref.read(profileProvider.notifier).fetch();
      final created = data['tournament'] as Map?;
      if (mounted && created != null) {
        context.go('/tournaments/${created['id']}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تعذّر الإنشاء: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    final coins = ref.watch(profileProvider)?.coins ?? 0;
    final createFee = (_fees?['create_fee'] as num?)?.toInt() ?? 500;
    final customFee = (_fees?['customize_fee'] as num?)?.toInt() ?? 100;

    return Scaffold(
      backgroundColor: c.bgDark,
      appBar: AppBar(
        title: const Text('إنشاء بطولة ترفيهية'),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'رسوم الإنشاء: $createFee عملة'
                    '${_enableCustom && (_customDeckKey.isNotEmpty || _customBgKey.isNotEmpty) ? ' + $customFee تخصيص' : ''}'
                    ' — الإجمالي: $_totalFee',
                    style: TextStyle(color: c.textMuted, fontSize: 13),
                  ),
                  Text(
                    'رصيدك: $coins عملة',
                    style: TextStyle(
                      color: coins >= _totalFee ? Colors.green : Colors.redAccent,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _title,
                    decoration: const InputDecoration(labelText: 'اسم البطولة'),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    initialValue: _size,
                    decoration: const InputDecoration(labelText: 'عدد اللاعبين'),
                    items: [8, 16, 32, 64]
                        .map((n) => DropdownMenuItem(value: n, child: Text('$n')))
                        .toList(),
                    onChanged: (v) => setState(() => _size = v ?? 8),
                  ),
                  const SizedBox(height: 8),
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
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: SwitchListTile(
              title: const Text('تخصيص البطولة'),
              subtitle: Text('ظهر الكروت و/أو خلفية الطاولة (+$customFee عملة)'),
              value: _enableCustom,
              onChanged: (v) => setState(() {
                _enableCustom = v;
                if (!v) {
                  _customDeckKey = '';
                  _customBgKey = '';
                }
              }),
            ),
          ),
          if (_enableCustom) ...[
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: _customDeckKey.isEmpty ? null : _customDeckKey,
                      decoration: const InputDecoration(labelText: 'ظهر الكروت (اختياري)'),
                      items: [
                        const DropdownMenuItem(value: '', child: Text('— بدون —')),
                        ..._deckOptions.map((raw) {
                          final m = raw as Map;
                          return DropdownMenuItem(
                            value: m['asset_key']?.toString() ?? '',
                            child: Text(m['name']?.toString() ?? ''),
                          );
                        }),
                      ],
                      onChanged: (v) => setState(() => _customDeckKey = v ?? ''),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: _customBgKey.isEmpty ? null : _customBgKey,
                      decoration: const InputDecoration(labelText: 'خلفية الطاولة (اختياري)'),
                      items: [
                        const DropdownMenuItem(value: '', child: Text('— بدون —')),
                        ..._bgOptions.map((raw) {
                          final m = raw as Map;
                          return DropdownMenuItem(
                            value: m['asset_key']?.toString() ?? '',
                            child: Text(m['name']?.toString() ?? ''),
                          );
                        }),
                      ],
                      onChanged: (v) => setState(() => _customBgKey = v ?? ''),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (_size == 32 || _size == 64)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                'ملاحظة: مباريات التصفيات في بطولات 32/64 تبدأ بنتيجة 52-52 (النهائي 0-0)',
                style: TextStyle(color: c.gold.withValues(alpha: 0.8), fontSize: 12),
              ),
            ),
          const SizedBox(height: 20),
          PrimaryButton(
            label: _creating ? 'جاري الإنشاء...' : 'إنشاء ($_totalFee عملة)',
            onPressed: _creating || coins < _totalFee ? null : _create,
          ),
        ],
      ),
    );
  }
}
