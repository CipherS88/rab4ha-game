import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/deck_stack.dart';
import '../../shared/widgets/player_avatar.dart';

String giftRewardIcon(String? type, dynamic amount) {
  switch (type) {
    case 'vip_7d':
      return '👑';
    case 'gems':
      return '💎';
    case 'admin_bundle':
      return '🎁';
    default:
      return '🪙';
  }
}

String giftRewardLabel(Map<String, dynamic> gift) {
  final type = gift['gift_type']?.toString();
  final amount = gift['amount'];
  final n = amount is int ? amount : int.tryParse('$amount') ?? 0;
  switch (type) {
    case 'vip_7d':
      return 'VIP لمدة ${n > 0 ? n : 7} أيام';
    case 'gems':
      return '$n جواهر 💎';
    case 'admin_bundle':
      return gift['message']?.toString() ?? 'هدية من الإدارة';
    case 'coins':
      return '$n ذهب 🪙';
    default:
      return gift['message']?.toString() ?? 'هدية';
  }
}

/// نافذة استلام الهدية — أفاتار + كرتان + نجمة + رسالة المُهدي.
class GiftReceivePopup extends ConsumerWidget {
  const GiftReceivePopup({
    super.key,
    required this.gift,
    required this.onClose,
    this.onSendBack,
    this.onLike,
    this.onFriend,
  });

  final Map<String, dynamic> gift;
  final VoidCallback onClose;
  final VoidCallback? onSendBack;
  final VoidCallback? onLike;
  final VoidCallback? onFriend;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sender = Map<String, dynamic>.from(gift['sender'] as Map? ?? {});
    final isAdmin = gift['is_admin'] == true;
    final name = sender['name']?.toString() ?? (isAdmin ? 'الإدارة' : 'لاعب');
    final deckUrl = sender['deck_back_url']?.toString() ?? '/cards/back_dark.png';
    final message = gift['message']?.toString().trim() ?? '';
    final displayMessage = message.isNotEmpty ? message : giftRewardLabel(gift);

    return Material(
      color: Colors.black.withValues(alpha: 0.72),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.topCenter,
                  children: [
                    Container(
                      width: 340,
                      margin: const EdgeInsets.only(top: 72),
                      padding: const EdgeInsets.fromLTRB(20, 52, 20, 18),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(22),
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFFFDF6E8), Color(0xFFF3E4C8), Color(0xFFE8D4A8)],
                        ),
                        border: Border.all(color: const Color(0xFFC69C48).withValues(alpha: 0.55), width: 2),
                        boxShadow: const [
                          BoxShadow(color: Colors.black45, blurRadius: 30, offset: Offset(0, 12)),
                        ],
                      ),
                      child: Column(
                        children: [
                          _SenderNameRow(name: name, sender: sender, isAdmin: isAdmin),
                          const SizedBox(height: 10),
                          Text(
                            giftRewardIcon(gift['gift_type']?.toString(), gift['amount']),
                            style: const TextStyle(fontSize: 52),
                          ),
                          if (displayMessage.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                              child: Text(
                                displayMessage,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF4A3B28),
                                  height: 1.5,
                                ),
                              ),
                            ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              _GiftActionBtn(
                                icon: '🎁',
                                label: 'إهداء',
                                highlight: true,
                                onTap: onSendBack ?? onClose,
                              ),
                              _GiftActionBtn(icon: '❤️', label: 'معجب', onTap: onLike ?? () {}),
                              _GiftActionBtn(icon: '👤', label: 'صديق', onTap: onFriend ?? () {}),
                            ],
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: TextButton(
                              onPressed: onClose,
                              style: TextButton.styleFrom(
                                backgroundColor: Colors.white.withValues(alpha: 0.55),
                                foregroundColor: const Color(0xFF475569),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  side: BorderSide(color: Colors.black.withValues(alpha: 0.1)),
                                ),
                              ),
                              child: const Text('عودة', style: TextStyle(fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      top: 0,
                      child: SizedBox(
                        width: 200,
                        height: 140,
                        child: Stack(
                          clipBehavior: Clip.none,
                          alignment: Alignment.bottomCenter,
                          children: [
                            const Positioned(
                              top: 0,
                              child: Text('🎁', style: TextStyle(fontSize: 48)),
                            ),
                            Positioned(
                              bottom: 4,
                              child: SizedBox(
                                width: 110,
                                height: 90,
                                child: Stack(
                                  clipBehavior: Clip.none,
                                  alignment: Alignment.bottomCenter,
                                  children: [
                                    Positioned(
                                      bottom: 8,
                                      child: HomeDeckStack(
                                        deckBackUrl: deckUrl,
                                        cardWidth: 34,
                                        cardHeight: 50,
                                      ),
                                    ),
                                    PlayerAvatar(data: sender, size: 68, vipFrame: true),
                                    Positioned(
                                      bottom: 2,
                                      right: 18,
                                      child: _GiftStarBadge(sender: sender, isAdmin: isAdmin),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SenderNameRow extends StatelessWidget {
  const _SenderNameRow({
    required this.name,
    required this.sender,
    required this.isAdmin,
  });

  final String name;
  final Map<String, dynamic> sender;
  final bool isAdmin;

  @override
  Widget build(BuildContext context) {
    final isVip = sender['is_vip'] == true;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFC69C48).withValues(alpha: 0.35)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8)],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isVip || isAdmin) const Text('👑', style: TextStyle(fontSize: 16)),
          if (isVip || isAdmin) const SizedBox(width: 6),
          Text(
            name,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: Color(0xFF3D2F1A),
            ),
          ),
          buildStatusBadgeFromMap(sender, size: 18),
        ],
      ),
    );
  }
}

class _GiftStarBadge extends StatelessWidget {
  const _GiftStarBadge({required this.sender, required this.isAdmin});

  final Map<String, dynamic> sender;
  final bool isAdmin;

  @override
  Widget build(BuildContext context) {
    String? type = sender['star']?.toString();
    if (type == null || type.isEmpty) {
      if (isAdmin || sender['is_admin'] == true) {
        type = 'admin';
      } else if (sender['is_famous'] == true) {
        type = 'famous';
      } else if (sender['is_vip'] == true) {
        type = 'vip';
      }
    }
    if (type == null || type.isEmpty) return const SizedBox.shrink();

    final (icon, color, _) = switch (type) {
      'admin' => ('★', Colors.redAccent, 'إدارة'),
      'famous' => ('★', Colors.blueAccent, 'مشهور'),
      'vip' => ('★', const Color(0xFFFFD700), 'VIP'),
      _ => ('★', Colors.amber, type),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(icon, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}

class _GiftActionBtn extends StatelessWidget {
  const _GiftActionBtn({
    required this.icon,
    required this.label,
    this.highlight = false,
    required this.onTap,
  });

  final String icon;
  final String label;
  final bool highlight;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Material(
          color: highlight
              ? const Color(0xFFFBBF24)
              : Colors.white.withValues(alpha: 0.72),
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Column(
                children: [
                  Text(icon, style: const TextStyle(fontSize: 20)),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: highlight ? const Color(0xFF3D2A08) : const Color(0xFF334155),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
