import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/rab4ha_theme.dart';
import 'game_layout.dart';
import 'layout_anim.dart';

/// مقاعد الأفتار/الاسم/الكروت تحتاج تجاوز حدود الصندوق بدون قص.
bool gameLayoutSlotOverflow(String id) {
  return id.contains('_avatar') ||
      id.contains('_gifts') ||
      id.contains('_name') ||
      id.contains('_cards');
}

/// الكروt فقط تملأ الصندوق؛ الباقي loose للأفاتار وما حوله.
bool gameLayoutSlotLoose(String id) {
  return id.contains('_avatar') ||
      id.contains('_gifts') ||
      id.contains('_name');
}

class GameLayoutSlot extends StatefulWidget {
  const GameLayoutSlot({
    super.key,
    required this.id,
    required this.box,
    required this.canvasSize,
    required this.editMode,
    required this.onChanged,
    required this.child,
    this.animate = false,
  });

  final String id;
  final GameLayoutBox box;
  final Size canvasSize;
  final bool editMode;
  final ValueChanged<GameLayoutBox> onChanged;
  final Widget child;
  final bool animate;

  @override
  State<GameLayoutSlot> createState() => _GameLayoutSlotState();
}

class _GameLayoutSlotState extends State<GameLayoutSlot> {
  _DragMode? _drag;

  @override
  Widget build(BuildContext context) {
    final w = widget.canvasSize.width;
    final h = widget.canvasSize.height;
    final left = widget.box.x * w;
    final top = widget.box.y * h;
    final width = widget.box.w * w;
    final height = widget.box.h * h;
    final c = rab4haColors(context);
    final overflow = gameLayoutSlotOverflow(widget.id);
    final loose = gameLayoutSlotLoose(widget.id);

    final content = Stack(
      clipBehavior: Clip.none,
      fit: loose && !widget.editMode ? StackFit.loose : StackFit.expand,
      alignment: loose && !widget.editMode ? Alignment.center : Alignment.center,
      children: [
        GestureDetector(
          onPanStart: widget.editMode ? _onPanStartMove : null,
          onPanUpdate: widget.editMode ? _onPanUpdate : null,
          onPanEnd: widget.editMode ? _onPanEnd : null,
          child: Container(
            decoration: widget.editMode
                ? BoxDecoration(
                    border: Border.all(color: c.gold.withValues(alpha: 0.85), width: 2),
                    borderRadius: BorderRadius.circular(8),
                  )
                : null,
            child: widget.editMode
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: widget.child,
                  )
                : widget.child,
          ),
        ),
        if (widget.editMode) ...[
          Positioned(
            right: 0,
            bottom: 0,
            child: _Handle(
              icon: Icons.open_in_full,
              onPanStart: _onPanStartResize,
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
            ),
          ),
          Positioned(
            top: -16,
            left: 0,
            right: 0,
            child: Center(
              child: _Handle(
                icon: Icons.rotate_right,
                onPanStart: _onPanStartRotate,
                onPanUpdate: _onPanUpdate,
                onPanEnd: _onPanEnd,
              ),
            ),
          ),
        ],
      ],
    );

    final rotated = Transform.rotate(
      angle: widget.box.r * math.pi / 180,
      alignment: Alignment.center,
      child: content,
    );

    final useAnim = widget.animate && !widget.editMode;
    if (useAnim) {
      return AnimatedPositioned(
        duration: kLayoutAnimDuration,
        curve: kLayoutAnimCurve,
        left: left,
        top: top,
        width: width,
        height: height,
        child: TweenAnimationBuilder<double>(
          tween: Tween(end: widget.box.r),
          duration: kLayoutAnimDuration,
          curve: kLayoutAnimCurve,
          builder: (context, angle, child) => Transform.rotate(
            angle: angle * math.pi / 180,
            alignment: Alignment.center,
            child: child,
          ),
          child: content,
        ),
      );
    }

    return Positioned(
      left: left,
      top: top,
      width: width,
      height: height,
      child: rotated,
    );
  }

  void _onPanStartMove(DragStartDetails d) {
    _drag = _DragMode(kind: _DragKind.move, start: d.globalPosition, orig: widget.box);
  }

  void _onPanStartResize(DragStartDetails d) {
    _drag = _DragMode(kind: _DragKind.resize, start: d.globalPosition, orig: widget.box);
  }

  void _onPanStartRotate(DragStartDetails d) {
    final rect = context.findRenderObject() as RenderBox?;
    final center = rect?.localToGlobal(rect.size.center(Offset.zero)) ?? d.globalPosition;
    _drag = _DragMode(
      kind: _DragKind.rotate,
      start: d.globalPosition,
      orig: widget.box,
      center: center,
    );
  }

  void _onPanUpdate(DragUpdateDetails d) {
    if (_drag == null) return;
    final w = widget.canvasSize.width;
    final h = widget.canvasSize.height;
    final orig = _drag!.orig;

    if (_drag!.kind == _DragKind.move) {
      final dx = (d.globalPosition.dx - _drag!.start.dx) / w;
      final dy = (d.globalPosition.dy - _drag!.start.dy) / h;
      widget.onChanged(orig.copyWith(
        x: _clamp(orig.x + dx),
        y: _clamp(orig.y + dy),
      ));
    } else if (_drag!.kind == _DragKind.resize) {
      final dx = (d.globalPosition.dx - _drag!.start.dx) / w;
      final dy = (d.globalPosition.dy - _drag!.start.dy) / h;
      widget.onChanged(orig.copyWith(
        w: _clamp(orig.w + dx, min: 0.04),
        h: _clamp(orig.h + dy, min: 0.04),
      ));
    } else if (_drag!.kind == _DragKind.rotate && _drag!.center != null) {
      final c = _drag!.center!;
      final angle = math.atan2(d.globalPosition.dy - c.dy, d.globalPosition.dx - c.dx);
      widget.onChanged(orig.copyWith(r: angle * 180 / math.pi));
    }
  }

  void _onPanEnd(DragEndDetails d) => _drag = null;

  double _clamp(double v, {double min = 0, double max = 1}) => v.clamp(min, max);
}

class _Handle extends StatelessWidget {
  const _Handle({
    required this.icon,
    required this.onPanStart,
    required this.onPanUpdate,
    required this.onPanEnd,
  });

  final IconData icon;
  final GestureDragStartCallback onPanStart;
  final GestureDragUpdateCallback onPanUpdate;
  final GestureDragEndCallback onPanEnd;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanStart: onPanStart,
      onPanUpdate: onPanUpdate,
      onPanEnd: onPanEnd,
      child: Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: rab4haColors(context).gold.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.black87),
        ),
        child: Icon(icon, size: 14, color: Colors.black87),
      ),
    );
  }
}

enum _DragKind { move, resize, rotate }

class _DragMode {
  _DragMode({
    required this.kind,
    required this.start,
    required this.orig,
    this.center,
  });

  final _DragKind kind;
  final Offset start;
  final GameLayoutBox orig;
  final Offset? center;
}
