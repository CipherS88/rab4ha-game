import 'dart:async';

import 'package:flutter/material.dart';

/// P36 — حلقة عد تنازلي حول أفاتار صاحب الدور.
class TurnTimerRing extends StatefulWidget {
  const TurnTimerRing({
    super.key,
    required this.active,
    required this.startedAtMs,
    this.durationMs = 30000,
    this.size = 52,
  });

  final bool active;
  final int? startedAtMs;
  final int durationMs;
  final double size;

  @override
  State<TurnTimerRing> createState() => _TurnTimerRingState();
}

class _TurnTimerRingState extends State<TurnTimerRing> {
  Timer? _tick;
  double _progress = 1;

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void didUpdateWidget(covariant TurnTimerRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active != widget.active || oldWidget.startedAtMs != widget.startedAtMs) {
      _schedule();
    }
  }

  void _schedule() {
    _tick?.cancel();
    if (!widget.active || widget.startedAtMs == null) {
      setState(() => _progress = 1);
      return;
    }
    _update();
    _tick = Timer.periodic(const Duration(milliseconds: 200), (_) => _update());
  }

  void _update() {
    if (!mounted) return;
    final elapsed = DateTime.now().millisecondsSinceEpoch - widget.startedAtMs!;
    final p = (1 - elapsed / widget.durationMs).clamp(0.0, 1.0);
    setState(() => _progress = p);
    if (p <= 0) _tick?.cancel();
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return SizedBox(width: widget.size, height: widget.size);
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: CustomPaint(
        painter: _RingPainter(progress: _progress),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 2;
    final bg = Paint()
      ..color = Colors.white12
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    canvas.drawCircle(center, radius, bg);
    if (progress <= 0) return;
    final fg = Paint()
      ..color = progress < 0.25 ? const Color(0xFFEF4444) : const Color(0xFFD4AF37)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -3.14159 / 2,
      2 * 3.14159 * progress,
      false,
      fg,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
