import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../shared/widgets/buttons.dart';
import '../auth/auth_provider.dart';

import '../../core/theme/rab4ha_theme.dart';

Future<void> showGiftSendModal(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> targetUser,
  Map<String, dynamic> options,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Rab4haColors.dark.bgElevated,
    builder: (ctx) => _GiftSendSheet(
      targetUser: targetUser,
      options: options,
    ),
  );
}

class _GiftSendSheet extends ConsumerStatefulWidget {
  const _GiftSendSheet({required this.targetUser, required this.options});
  final Map<String, dynamic> targetUser;
  final Map<String, dynamic> options;

  @override
  ConsumerState<_GiftSendSheet> createState() => _GiftSendSheetState();
}

class _GiftSendSheetState extends ConsumerState<_GiftSendSheet> {
  var _type = 'coins';
  final _amount = TextEditingController(text: '100');
  final _message = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final api = ref.read(apiClientProvider);
    final body = <String, dynamic>{
      'to_user_id': widget.targetUser['user_id'],
      'type': _type,
      'message': _message.text.trim(),
    };
    if (_type == 'coins') {
      body['amount'] = int.tryParse(_amount.text.trim()) ?? 0;
    }
    final res = await api.post('/api/gifts', body: body);
    await api.parseJson(res);
    await ref.read(profileProvider.notifier).fetch();
    if (mounted) {
      ref.read(homeToastProvider.notifier).show('تم إرسال الهدية');
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final myCoins = widget.options['my_coins'] ?? ref.watch(profileProvider)?.coins ?? 0;
    final vipCost = widget.options['vip_7d_cost'] ?? 2500;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.paddingOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'إهداء لـ ${widget.targetUser['name']}',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          Text('رصيدك: 🪙 $myCoins'),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'coins', label: Text('ذهب')),
              ButtonSegment(value: 'vip_7d', label: Text('VIP 7 أيام')),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          const SizedBox(height: 12),
          if (_type == 'coins')
            TextField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'المبلغ (${widget.options['min_coins'] ?? 50} — ${widget.options['max_coins'] ?? 100000})',
              ),
            )
          else
            Text('تكلفة VIP: 🪙 $vipCost'),
          const SizedBox(height: 8),
          TextField(
            controller: _message,
            maxLength: 200,
            decoration: const InputDecoration(labelText: 'رسالة (اختياري)'),
          ),
          const SizedBox(height: 12),
          PrimaryButton(label: 'إرسال الهدية', onPressed: _send),
        ],
      ),
    );
  }
}
