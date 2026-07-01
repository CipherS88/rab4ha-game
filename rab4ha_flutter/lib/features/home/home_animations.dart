import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'home_theme.dart';

/// رموز الألوان المتحركة في بطاقة المصنّف.
class RankedSuitsBackground extends StatefulWidget {
  const RankedSuitsBackground({super.key});

  @override
  State<RankedSuitsBackground> createState() => _RankedSuitsBackgroundState();
}

class _RankedSuitsBackgroundState extends State<RankedSuitsBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  static const _suits = ['♠', '♥', '♣', '♦'];
  static const _colors = [
    Colors.white70,
    Color(0xFFEF4444),
    Colors.white70,
    Color(0xFFEF4444),
  ];

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 5))
      ..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        return Stack(
          clipBehavior: Clip.none,
          children: List.generate(_suits.length, (i) {
            final t = _ctrl.value * 2 * math.pi + i * 1.4;
            final x = 0.12 + (i * 0.22) + math.sin(t) * 0.04;
            final y = 0.15 + math.cos(t + i) * 0.12;
            final rot = math.sin(t * 0.7 + i) * 0.35;
            return Positioned.fill(
              child: Align(
                alignment: Alignment(x * 2 - 1, y * 2 - 1),
                child: Transform.rotate(
                  angle: rot,
                  child: Text(
                    _suits[i],
                    style: TextStyle(
                      fontSize: 28 + i * 4.0,
                      color: _colors[i].withValues(alpha: 0.22),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}

/// كأس + كروت متحركة في بطاقة البطولات.
class TournamentsMotionBackground extends StatefulWidget {
  const TournamentsMotionBackground({super.key, this.compact = false});

  final bool compact;

  @override
  State<TournamentsMotionBackground> createState() => _TournamentsMotionBackgroundState();
}

class _TournamentsMotionBackgroundState extends State<TournamentsMotionBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 3))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final compact = widget.compact;
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, child) {
        final drift = (_ctrl.value - 0.5) * (compact ? 6.0 : 10.0);
        final trophySize = compact ? 44.0 : 56.0;
        final cardW = compact ? 24.0 : 28.0;
        final cardH = compact ? 32.0 : 38.0;
        final spread = compact ? 14.0 : 18.0;
        return Stack(
          alignment: Alignment.bottomCenter,
          children: [
            Positioned(
              left: 0,
              right: 0,
              bottom: compact ? 22 : 28,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Transform.translate(
                    offset: Offset(-spread + drift, 0),
                    child: Transform.rotate(
                      angle: -0.25,
                      child: _miniCard(cardW, cardH),
                    ),
                  ),
                  SizedBox(width: compact ? 4 : 8),
                  Transform.translate(
                    offset: Offset(spread - drift, 0),
                    child: Transform.rotate(
                      angle: 0.25,
                      child: _miniCard(cardW, cardH),
                    ),
                  ),
                ],
              ),
            ),
            Transform.translate(
              offset: Offset(0, compact ? -14 + drift * 0.3 : -24 + drift * 0.3),
              child: Icon(
                Icons.emoji_events_outlined,
                size: trophySize,
                color: HomeBlackGold.gold.withValues(alpha: compact ? 0.38 : 0.4),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _miniCard(double w, double h) {
    return Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: HomeBlackGold.gold.withValues(alpha: 0.45)),
      ),
    );
  }
}
