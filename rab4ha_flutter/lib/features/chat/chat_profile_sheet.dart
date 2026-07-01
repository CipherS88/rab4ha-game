import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/rab4ha_theme.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/rank_themes.dart';
import '../../shared/widgets/buttons.dart';
import '../../shared/widgets/player_avatar.dart';
import '../../shared/widgets/skill_radar.dart';
import '../auth/auth_provider.dart';
import '../gifts/gift_send_modal.dart';

Future<void> openChatProfileSheet(
  BuildContext context,
  WidgetRef ref,
  String userId, {
  int? messageId,
  String? reportType,
}) async {
  final api = ref.read(apiClientProvider);
  try {
    final res = await api.get('/api/chat/users/$userId');
    final data = await api.parseJson(res);
    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Rab4haColors.dark.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _ChatProfileSheet(
        user: Map<String, dynamic>.from(data['user'] as Map),
        giftOptions: Map<String, dynamic>.from(data['gift_options'] as Map? ?? {}),
        messageId: messageId,
        reportType: reportType,
      ),
    );
  } catch (e) {
    if (context.mounted) {
      ref.read(homeToastProvider.notifier).show(e.toString());
    }
  }
}

class _ChatProfileSheet extends ConsumerStatefulWidget {
  const _ChatProfileSheet({
    required this.user,
    required this.giftOptions,
    this.messageId,
    this.reportType,
  });

  final Map<String, dynamic> user;
  final Map<String, dynamic> giftOptions;
  final int? messageId;
  final String? reportType;

  @override
  ConsumerState<_ChatProfileSheet> createState() => _ChatProfileSheetState();
}

class _ChatProfileSheetState extends ConsumerState<_ChatProfileSheet> {
  late Map<String, dynamic> _user;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
  }

  Future<void> _friendAction(String method, String path) async {
    final api = ref.read(apiClientProvider);
    if (method == 'POST') {
      await api.post(path);
    } else {
      await api.delete(path);
    }
    await _reload();
  }

  Future<void> _reload() async {
    final id = _user['user_id']?.toString() ?? '';
    final api = ref.read(apiClientProvider);
    final res = await api.get('/api/chat/users/$id');
    final data = await api.parseJson(res);
    setState(() => _user = Map<String, dynamic>.from(data['user'] as Map));
  }

  Future<void> _report({required String type, int? messageId}) async {
    final details = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final ctrl = TextEditingController();
        return AlertDialog(
          title: const Text('تبليغ'),
          content: TextField(
            controller: ctrl,
            decoration: const InputDecoration(hintText: 'سبب التبليغ (اختياري)'),
            maxLines: 3,
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
            TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('إرسال')),
          ],
        );
      },
    );
    if (details == null) return;
    final api = ref.read(apiClientProvider);
    await api.post('/api/chat/report', body: {
      'reported_user_id': _user['user_id'],
      if (messageId != null) 'message_id': messageId,
      'report_type': type,
      'details': details,
    });
    if (mounted) {
      ref.read(homeToastProvider.notifier).show('تم إرسال التبليغ');
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friendship = _user['friendship']?.toString() ?? 'none';
    final radar = Map<String, num>.from(
      (_user['radarStats'] as Map?)?.map((k, v) => MapEntry(k.toString(), v as num)) ?? {},
    );
    final isSelf = friendship == 'self';

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.paddingOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                PlayerAvatar(data: _user, size: 64, vipFrame: true),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              _user['name']?.toString() ?? '',
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                            ),
                          ),
                          buildStatusBadgeFromMap(_user, size: 20),
                        ],
                      ),
                      if (_user['player_code'] != null)
                        Text(formatPlayerCode(_user['player_code']?.toString())),
                      buildRankPill(_user),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text('${_user['wins'] ?? 0} ف — ${_user['losses'] ?? 0} خ'),
            if (radar.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(height: 140, child: SkillRadarChart(stats: radar)),
            ],
            const SizedBox(height: 16),
            if (!isSelf) ..._actionButtons(friendship),
            if (widget.messageId != null)
              OutlinedButton(
                onPressed: () => _report(
                  type: widget.reportType ?? 'message',
                  messageId: widget.messageId,
                ),
                child: const Text('تبليغ على هذه الرسالة'),
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _actionButtons(String friendship) {
    final id = _user['user_id']?.toString() ?? '';
    final name = _user['name']?.toString() ?? '';
    final buttons = <Widget>[];

    void add(String label, VoidCallback onTap, {bool primary = false}) {
      buttons.add(Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: primary
            ? PrimaryButton(label: label, onPressed: onTap)
            : OutlinedButton(onPressed: onTap, child: Text(label)),
      ));
    }

    switch (friendship) {
      case 'none':
        add('طلب صداقة', () => _friendAction('POST', '/api/chat/friends/$id/request'));
        add('🎁 إهداء', () => showGiftSendModal(context, ref, _user, widget.giftOptions));
        add('حظر', () => _friendAction('POST', '/api/chat/block/$id'));
        add('تبليغ', () => _report(type: 'account'));
        add('مراسلة خاصة', () {
          Navigator.pop(context);
          context.go('/chat?dm=$id&name=${Uri.encodeComponent(name)}');
        }, primary: true);
      case 'pending_sent':
        add('طلب مرسل — بانتظار القبول', () {}, primary: false);
      case 'pending_received':
        add('قبول الصداقة', () => _friendAction('POST', '/api/chat/friends/$id/accept'), primary: true);
      case 'friends':
        add('حذف صديق', () => _friendAction('DELETE', '/api/chat/friends/$id'));
        add('🎁 إهداء', () => showGiftSendModal(context, ref, _user, widget.giftOptions));
        add('حظر', () => _friendAction('POST', '/api/chat/block/$id'));
        add('تبليغ', () => _report(type: 'account'));
        add('مراسلة خاصة', () {
          Navigator.pop(context);
          context.go('/chat?dm=$id&name=${Uri.encodeComponent(name)}');
        }, primary: true);
      case 'blocked_by_me':
        add('إلغاء الحظر', () => _friendAction('DELETE', '/api/chat/block/$id'), primary: true);
      case 'blocked_me':
        add('هذا اللاعب حظرك', () {});
      default:
        break;
    }
    return buttons;
  }
}
