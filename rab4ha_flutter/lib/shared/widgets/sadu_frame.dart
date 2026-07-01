import 'package:flutter/material.dart';

/// Sadu repeating pattern — from frames-banners.html cube-2
class SaduPatternBorder extends StatelessWidget {
  const SaduPatternBorder({super.key, required this.child, this.borderWidth = 4});
  final Widget child;
  final double borderWidth;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _SaduPainter(borderWidth: borderWidth),
      child: Padding(padding: EdgeInsets.all(borderWidth + 2), child: child),
    );
  }
}

class _SaduPainter extends CustomPainter {
  _SaduPainter({required this.borderWidth});
  final double borderWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF8B0000),
          Color(0xFF1A1A1A),
          Color(0xFFD4AF37),
          Color(0xFF8B0000),
          Color(0xFF1A1A1A),
        ],
        stops: [0.0, 0.25, 0.5, 0.75, 1.0],
        tileMode: TileMode.repeated,
      ).createShader(rect);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(999)),
      paint..style = PaintingStyle.stroke..strokeWidth = borderWidth,
    );
  }

  @override
  bool shouldRepaint(covariant _SaduPainter old) => false;
}

/// VIP avatar frame with Sadu + gold crown accent
class VipAvatarFrame extends StatelessWidget {
  const VipAvatarFrame({super.key, required this.child, this.size = 72});
  final Widget child;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size + 12,
      height: size + 20,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          SaduPatternBorder(
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFFD700), width: 2),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFD4AF37).withValues(alpha: 0.45),
                    blurRadius: 12,
                  ),
                ],
              ),
              child: ClipOval(child: child),
            ),
          ),
          const Positioned(
            top: -4,
            child: Text('👑', style: TextStyle(fontSize: 22)),
          ),
        ],
      ),
    );
  }
}
