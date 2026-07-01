import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'network_asset.dart';

/// كرتان فوق الصورة الرمزية — خلفيتهما من `deck_back_url` المجهّز في الحقيبة.
class HomeDeckStack extends ConsumerWidget {
  const HomeDeckStack({
    super.key,
    required this.deckBackUrl,
    this.cardWidth = 22,
    this.cardHeight = 32,
  });

  final String deckBackUrl;
  final double cardWidth;
  final double cardHeight;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final path =
        deckBackUrl.isNotEmpty ? deckBackUrl : '/cards/back_dark.png';
    return SizedBox(
      width: cardWidth + cardWidth * 0.54,
      height: cardHeight + 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            bottom: 0,
            child: Transform.rotate(
              angle: -10 * math.pi / 180,
              child: _DeckMiniCard(
                path: path,
                width: cardWidth,
                height: cardHeight,
              ),
            ),
          ),
          Positioned(
            left: cardWidth * 0.46,
            bottom: 0,
            child: Transform.rotate(
              angle: 12 * math.pi / 180,
              child: _DeckMiniCard(
                path: path,
                width: cardWidth,
                height: cardHeight,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeckMiniCard extends StatelessWidget {
  const _DeckMiniCard({
    required this.path,
    required this.width,
    required this.height,
  });

  final String path;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white.withValues(alpha: 0.4)),
        boxShadow: const [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: NetworkAssetImage(path: path, fit: BoxFit.cover),
      ),
    );
  }
}
