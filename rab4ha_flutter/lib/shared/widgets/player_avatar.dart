import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/rank_themes.dart';
import 'network_asset.dart';

/// صورة لاعب من بيانات API (chat / leaderboards / game).
class PlayerAvatar extends ConsumerWidget {
  const PlayerAvatar({
    super.key,
    required this.data,
    this.size = 44,
    this.vipFrame = false,
  });

  final Map<String, dynamic>? data;
  final double size;
  final bool vipFrame;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = data ?? {};
    final url = d['avatar_url']?.toString();
    final removed = d['avatar_removed'] == true;
    final initial = d['avatar_initial']?.toString() ??
        (d['name']?.toString().isNotEmpty == true
            ? d['name'].toString().characters.first
            : '?');
    final themeKey =
        d['rankTheme']?.toString() ?? d['rank_theme']?.toString() ?? 'wood';
    final theme = rankThemeFor(themeKey);
    final isVip = d['is_vip'] == true || d['isVip'] == true;

    Widget inner;
    if (url != null && url.isNotEmpty && !removed) {
      inner = ClipOval(
        child: NetworkAssetImage(path: url, width: size, height: size, fit: BoxFit.cover),
      );
    } else {
      inner = CircleAvatar(
        radius: size / 2,
        backgroundColor: theme.primary.withValues(alpha: 0.35),
        child: Text(
          initial,
          style: TextStyle(
            color: theme.text,
            fontWeight: FontWeight.bold,
            fontSize: size * 0.38,
          ),
        ),
      );
    }

    final avatar = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: theme.primary, width: 2),
        boxShadow: [
          BoxShadow(color: theme.glow, blurRadius: 6),
        ],
      ),
      child: inner,
    );

    if (vipFrame && isVip) {
      return Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(colors: [theme.primary, theme.secondary]),
        ),
        child: avatar,
      );
    }
    return avatar;
  }
}

Widget buildStatusBadgeFromMap(Map<String, dynamic>? data, {double size = 16}) {
  final d = data ?? {};
  String? type = d['star']?.toString();
  if (type == null || type.isEmpty) {
    if (d['is_admin'] == true || d['isAdmin'] == true || d['role'] == 'admin') {
      type = 'admin';
    } else if (d['is_famous'] == true || d['isFamous'] == true) {
      type = 'famous';
    } else if (d['is_vip'] == true || d['isVip'] == true) {
      type = 'vip';
    }
  }
  if (type == null || type.isEmpty) return const SizedBox.shrink();

  final (icon, color, label) = switch (type) {
    'admin' => ('🛡️', Colors.redAccent, 'إدارة'),
    'famous' => ('⭐', Colors.purpleAccent, 'مشهور'),
    'vip' => ('👑', const Color(0xFFFFD700), 'VIP'),
    _ => ('★', Colors.white54, type),
  };

  return Tooltip(
    message: label,
    child: Padding(
      padding: const EdgeInsetsDirectional.only(start: 4),
      child: Text(icon, style: TextStyle(fontSize: size)),
    ),
  );
}

Widget buildRankPill(Map<String, dynamic>? data, {double fontSize = 11}) {
  final label = data?['rankLabel']?.toString() ??
      data?['rank_label']?.toString() ??
      '';
  if (label.isEmpty) return const SizedBox.shrink();
  final themeKey = data?['rankTheme']?.toString() ??
      data?['rank_theme']?.toString() ??
      'wood';
  final theme = rankThemeFor(themeKey);
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
      color: theme.primary.withValues(alpha: 0.25),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: theme.primary.withValues(alpha: 0.5)),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: theme.text,
        fontSize: fontSize,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}
