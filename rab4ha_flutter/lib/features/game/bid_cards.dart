import 'package:flutter/material.dart';

import '../../core/theme/rab4ha_theme.dart';

/// كرت مزايدة — أسود وذهبي.
class BidCardButton extends StatelessWidget {
  const BidCardButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.compact = false,
  });

  final String label;
  final VoidCallback onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final c = rab4haColors(context);
    final w = compact ? 56.0 : 68.0;
    final h = compact ? 82.0 : 100.0;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(8),
        child: Ink(
          width: w,
          height: h,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF141414), Color(0xFF050505)],
            ),
            border: Border.all(color: c.gold, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: c.gold.withValues(alpha: 0.22),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
              const BoxShadow(
                color: Colors.black54,
                blurRadius: 6,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned(
                top: 6,
                right: 8,
                child: Text(
                  '♠',
                  style: TextStyle(
                    fontSize: compact ? 11 : 13,
                    color: c.gold.withValues(alpha: 0.35),
                  ),
                ),
              ),
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: c.goldLight,
                      fontWeight: FontWeight.w800,
                      fontSize: compact ? 13 : 15,
                      height: 1.15,
                      shadows: [
                        Shadow(
                          color: c.gold.withValues(alpha: 0.45),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// صف كروt المزايدة داخل slot التخطيط.
class BidCardRow extends StatelessWidget {
  const BidCardRow({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 340 || children.length > 4;
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) SizedBox(width: compact ? 6 : 10),
                children[i],
              ],
            ],
          ),
        );
      },
    );
  }
}
