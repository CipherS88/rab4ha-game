import 'dart:async';
import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/socket_service.dart';
import '../auth/auth_provider.dart';
import 'gift_receive_popup.dart';

class GiftController extends Notifier<Gift?> {
  final _queue = Queue<Map<String, dynamic>>();
  Timer? _poll;

  @override
  Gift? build() {
    ref.onDispose(() => _poll?.cancel());
    return null;
  }

  void startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 15), (_) => loadPending());
    unawaited(loadPending());
  }

  Future<void> loadPending() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/api/gifts/pending');
      final data = await api.parseJson(res);
      for (final g in (data['gifts'] as List? ?? [])) {
        enqueue(Map<String, dynamic>.from(g as Map));
      }
    } catch (_) {}
  }

  void enqueue(Map<String, dynamic> gift) {
    final id = gift['id'];
    if (_queue.any((g) => g['id'] == id) || state?['id'] == id) return;
    _queue.add(gift);
    _showNext();
  }

  void _showNext() {
    if (state != null || _queue.isEmpty) return;
    state = _queue.removeFirst();
  }

  Future<void> markSeen() async {
    final current = state;
    if (current == null) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/api/gifts/${current['id']}/seen');
    } catch (_) {}
    state = null;
    _showNext();
    await ref.read(profileProvider.notifier).fetch();
  }

  void onSocketReceived(Map<String, dynamic> data) {
    final gift = data['gift'];
    if (gift is Map) enqueue(Map<String, dynamic>.from(gift));
  }

  void handleChatAuthResponse(dynamic data) {
    if (data is! Map) return;
    for (final g in (data['pending_gifts'] as List? ?? [])) {
      if (g is Map) enqueue(Map<String, dynamic>.from(g));
    }
  }
}

typedef Gift = Map<String, dynamic>;

final giftControllerProvider = NotifierProvider<GiftController, Gift?>(GiftController.new);

class GiftReceiveOverlay extends ConsumerWidget {
  const GiftReceiveOverlay({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gift = ref.watch(giftControllerProvider);
    return Stack(
      children: [
        child,
        if (gift != null)
          Positioned.fill(
            child: GiftReceivePopup(
              gift: gift,
              onClose: () => ref.read(giftControllerProvider.notifier).markSeen(),
              onLike: () => ref.read(giftControllerProvider.notifier).markSeen(),
            ),
          ),
      ],
    );
  }
}

void wireGiftListeners(WidgetRef ref) {
  ref.read(giftControllerProvider.notifier).startPolling();
  ref.read(socketServiceProvider).on<Map<String, dynamic>>('gift:received').listen((d) {
    ref.read(giftControllerProvider.notifier).onSocketReceived(d);
  });
}
