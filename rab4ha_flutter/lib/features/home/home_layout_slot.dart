import 'package:flutter/material.dart';

import 'home_layout.dart';
import 'home_theme.dart';

class HomeLayoutSlot extends StatefulWidget {
  const HomeLayoutSlot({
    super.key,
    required this.id,
    required this.box,
    required this.canvasSize,
    required this.editMode,
    required this.onChanged,
    required this.child,
  });

  final String id;
  final HomeLayoutBox box;
  final Size canvasSize;
  final bool editMode;
  final ValueChanged<HomeLayoutBox> onChanged;
  final Widget child;

  @override
  State<HomeLayoutSlot> createState() => _HomeLayoutSlotState();
}

class _HomeLayoutSlotState extends State<HomeLayoutSlot> {
  _DragMode? _drag;

  @override
  Widget build(BuildContext context) {
    final w = widget.canvasSize.width;
    final h = widget.canvasSize.height;
    final left = widget.box.x * w;
    final top = widget.box.y * h;
    final width = widget.box.w * w;
    final height = widget.box.h * h;

    return Positioned(
      left: left,
      top: top,
      width: width,
      height: height,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          GestureDetector(
            onPanStart: widget.editMode ? _onPanStartMove : null,
            onPanUpdate: widget.editMode ? _onPanUpdate : null,
            onPanEnd: widget.editMode ? _onPanEnd : null,
            child: Container(
              decoration: widget.editMode
                  ? BoxDecoration(
                      border: Border.all(
                        color: HomeBlackGold.gold.withValues(alpha: 0.75),
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    )
                  : null,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: widget.child,
              ),
            ),
          ),
          if (widget.editMode)
            Positioned(
              right: 0,
              bottom: 0,
              child: GestureDetector(
                onPanStart: _onPanStartResize,
                onPanUpdate: _onPanUpdate,
                onPanEnd: _onPanEnd,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: HomeBlackGold.gold.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: Colors.black87),
                  ),
                  child: const Icon(Icons.open_in_full, size: 12, color: Colors.black87),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _onPanStartMove(DragStartDetails d) {
    _drag = _DragMode(mode: _DragKind.move, start: d.globalPosition, orig: widget.box);
  }

  void _onPanStartResize(DragStartDetails d) {
    _drag = _DragMode(mode: _DragKind.resize, start: d.globalPosition, orig: widget.box);
  }

  void _onPanUpdate(DragUpdateDetails d) {
    if (_drag == null) return;
    final w = widget.canvasSize.width;
    final h = widget.canvasSize.height;
    final dx = (d.globalPosition.dx - _drag!.start.dx) / w;
    final dy = (d.globalPosition.dy - _drag!.start.dy) / h;
    final orig = _drag!.orig;

    if (_drag!.mode == _DragKind.move) {
      widget.onChanged(orig.copyWith(
        x: _clamp(orig.x + dx),
        y: _clamp(orig.y + dy),
      ));
    } else {
      widget.onChanged(orig.copyWith(
        w: _clamp(orig.w + dx, min: 0.06),
        h: _clamp(orig.h + dy, min: 0.05),
      ));
    }
  }

  void _onPanEnd(DragEndDetails d) => _drag = null;

  double _clamp(double v, {double min = 0, double max = 1}) {
    return v.clamp(min, max);
  }
}

enum _DragKind { move, resize }

class _DragMode {
  _DragMode({required this.mode, required this.start, required this.orig});
  final _DragKind mode;
  final Offset start;
  final HomeLayoutBox orig;
}
