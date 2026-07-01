import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';

class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> {
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = ref.read(apiClientProvider);
    final res = await api.get('/api/chat/friends');
    final data = await api.parseJson(res);
    setState(() => _data = data);
  }

  Future<void> _accept(String userId) async {
    final api = ref.read(apiClientProvider);
    await api.post('/api/chat/friends/$userId/accept');
    await _load();
  }

  Future<void> _remove(String userId) async {
    final api = ref.read(apiClientProvider);
    await api.delete('/api/chat/friends/$userId');
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_data == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('الأصدقاء')),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          const Text('الأصدقاء', style: TextStyle(fontWeight: FontWeight.bold)),
          ..._rows(_data!['friends'] as List? ?? [], 'friend'),
          const SizedBox(height: 16),
          const Text('طلبات واردة'),
          ..._rows(_data!['pending_received'] as List? ?? [], 'pending'),
          const SizedBox(height: 16),
          const Text('طلبات مرسلة'),
          ..._rows(_data!['pending_sent'] as List? ?? [], 'sent'),
        ],
      ),
    );
  }

  List<Widget> _rows(List items, String mode) {
    if (items.isEmpty) return [const ListTile(title: Text('—'))];
    return items.map((u) {
      final user = u as Map;
      final id = user['user_id']?.toString() ?? user['id']?.toString() ?? '';
      return ListTile(
        title: Text(user['name']?.toString() ?? ''),
        subtitle: Text(user['rank_label']?.toString() ?? ''),
        trailing: mode == 'pending'
            ? TextButton(onPressed: () => _accept(id), child: const Text('قبول'))
            : mode == 'friend'
                ? Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.chat),
                        onPressed: () {
                          final n = Uri.encodeComponent(user['name']?.toString() ?? '');
                          context.go('/chat?dm=$id&name=$n');
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.person_remove),
                        onPressed: () => _remove(id),
                      ),
                    ],
                  )
                : null,
      );
    }).toList();
  }
}
