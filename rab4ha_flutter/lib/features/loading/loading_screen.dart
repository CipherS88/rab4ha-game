import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/rab4ha_theme.dart';

/// شاشة تحميل — التوجيه يتم عبر GoRouter عند انتهاء bootstrap الجلسة.
class LoadingScreen extends ConsumerStatefulWidget {
  const LoadingScreen({super.key});

  @override
  ConsumerState<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends ConsumerState<LoadingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    const suits = [
      ('♠', Color(0xFFE2E8F0)),
      ('♦', Color(0xFFEF4444)),
      ('♣', Color(0xFFE2E8F0)),
      ('♥', Color(0xFFEF4444)),
    ];
    return Scaffold(
      backgroundColor: c.bgDark,
      body: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [c.accent.withValues(alpha: 0.15), Colors.transparent],
                  radius: 0.8,
                ),
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'رِبْعِهَا',
                  style: GoogleFonts.cairo(
                    fontSize: 48,
                    fontWeight: FontWeight.w900,
                    color: c.gold,
                  ),
                ),
                const SizedBox(height: 32),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(4, (i) {
                    return AnimatedBuilder(
                      animation: _ctrl,
                      builder: (_, child) {
                        final offset = (i * 0.25 + _ctrl.value) % 1.0;
                        return Transform.translate(
                          offset: Offset(
                            0,
                            -8 *
                                (offset < 0.5 ? offset * 2 : (1 - offset) * 2),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Text(
                              suits[i].$1,
                              style: TextStyle(fontSize: 36, color: suits[i].$2),
                            ),
                          ),
                        );
                      },
                    );
                  }),
                ),
                const SizedBox(height: 40),
                Text('جاري تحميل مجلس البلوت...', style: TextStyle(color: c.textMuted)),
                const SizedBox(height: 16),
                SizedBox(
                  width: 200,
                  child: LinearProgressIndicator(
                    backgroundColor: c.inputBorder,
                    color: c.accent,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
