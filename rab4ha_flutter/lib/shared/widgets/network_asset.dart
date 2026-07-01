import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../shared/models/user_models.dart';

class NetworkAssetImage extends ConsumerWidget {
  const NetworkAssetImage({
    super.key,
    required this.path,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.errorWidget,
  });

  final String path;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget? errorWidget;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final url = ref.read(apiClientProvider).assetUrl(path);
    return CachedNetworkImage(
      imageUrl: url,
      width: width,
      height: height,
      fit: fit,
      errorWidget: (_, __, ___) =>
          errorWidget ??
          Container(
            width: width,
            height: height,
            color: const Color(0xFF334155),
            child: const Icon(Icons.broken_image, color: Colors.white54),
          ),
    );
  }
}

Widget buildStatusStar(PlayerProfile? profile) {
  String? type = profile?.star;
  if (type == null) {
    if (profile?.isAdmin == true) type = 'admin';
    else if (profile?.isFamous == true) type = 'famous';
    else if (profile?.isVip == true) type = 'vip';
  }
  if (type == null) return const SizedBox.shrink();
  final color = switch (type) {
    'admin' => Colors.redAccent,
    'famous' => Colors.purpleAccent,
    'vip' => const Color(0xFFFFD700),
    _ => Colors.white54,
  };
  return Padding(
    padding: const EdgeInsets.only(right: 4),
    child: Text('★', style: TextStyle(color: color, fontSize: 16)),
  );
}
