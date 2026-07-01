import 'dart:math' as math;

import 'package:flutter/material.dart';

const radarAxes = [
  ('fair', 'الغش'),
  ('buy', 'الشراء'),
  ('qaid', 'القيد'),
  ('kaboot', 'الكبوت'),
  ('speed', 'السرعة'),
  ('projects', 'المشاريع'),
];

class SkillRadarChart extends StatelessWidget {
  const SkillRadarChart({super.key, required this.stats, this.size = 140});
  final Map<String, num> stats;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _RadarPainter(stats),
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  _RadarPainter(this.stats);
  final Map<String, num> stats;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final maxR = size.width * 0.31;
    const n = 6;
    const levels = 4;
    const startAngle = -math.pi / 2;

    math.Point<double> pointAt(int i, double radius) {
      final a = startAngle + i * (2 * math.pi / n);
      return math.Point(cx + radius * math.cos(a), cy + radius * math.sin(a));
    }

    final gridPaint = Paint()
      ..color = const Color(0x66D4AF37)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    for (var lv = 1; lv <= levels; lv++) {
      final r = maxR * lv / levels;
      final path = Path();
      for (var i = 0; i < n; i++) {
        final p = pointAt(i, r);
        if (i == 0) {
          path.moveTo(p.x, p.y);
        } else {
          path.lineTo(p.x, p.y);
        }
      }
      path.close();
      canvas.drawPath(path, gridPaint);
    }

    for (var i = 0; i < n; i++) {
      final p = pointAt(i, maxR);
      canvas.drawLine(Offset(cx, cy), Offset(p.x, p.y), gridPaint);
    }

    final statPath = Path();
    for (var i = 0; i < n; i++) {
      final key = radarAxes[i].$1;
      final val = (stats[key] ?? 0).clamp(0, 100) / 100.0;
      final p = pointAt(i, maxR * val);
      if (i == 0) {
        statPath.moveTo(p.x, p.y);
      } else {
        statPath.lineTo(p.x, p.y);
      }
    }
    statPath.close();
    canvas.drawPath(
      statPath,
      Paint()
        ..color = const Color(0xFFD4AF37).withValues(alpha: 0.45)
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      statPath,
      Paint()
        ..color = const Color(0xFFD4AF37)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    final tp = TextPainter(textDirection: TextDirection.rtl);
    for (var i = 0; i < n; i++) {
      final p = pointAt(i, maxR + 14);
      tp.text = TextSpan(
        text: radarAxes[i].$2,
        style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 9),
      );
      tp.layout();
      tp.paint(canvas, Offset(p.x - tp.width / 2, p.y - tp.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant _RadarPainter old) => old.stats != stats;
}
