import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/rab4ha_theme.dart';
import '../../core/theme/rank_themes.dart';
import '../../shared/widgets/network_asset.dart';
import '../settings/settings_provider.dart';
import 'card_utils.dart';
import 'game_controller.dart';
import 'game_seats.dart';

const trickThrowMs = 380;
const trickCollectMs = 420;

Offset trickSlotOffset(String visualPos) => switch (visualPos) {
      'bottom' => const Offset(0, 54),
      'right' => const Offset(44, 0),
      'top' => const Offset(0, -54),
      'left' => const Offset(-44, 0),
      _ => Offset.zero,
    };

Offset throwStartOffset(String visualPos, Size size) => switch (visualPos) {
      'bottom' => Offset(0, size.height * 0.26),
      'top' => Offset(0, -size.height * 0.20),
      'left' => Offset(-size.width * 0.36, size.height * 0.05),
      'right' => Offset(size.width * 0.36, size.height * 0.05),
      _ => Offset.zero,
    };

Alignment seatCollectAlign(String visualPos) => switch (visualPos) {
      'bottom' => Alignment.bottomCenter,
      'top' => Alignment.topCenter,
      'left' => Alignment.centerLeft,
      'right' => Alignment.centerRight,
      _ => Alignment.center,
    };

double _throwProgress(int? startedAtMs) {
  if (startedAtMs == null) return 1;
  final elapsed = DateTime.now().millisecondsSinceEpoch - startedAtMs;
  if (elapsed >= trickThrowMs) return 1;
  return Curves.easeOutCubic.transform(elapsed / trickThrowMs);
}

/// كروت الأكلة في المنتصف — رمي من اتجاه كل لاعب.
class TrickTableLayer extends ConsumerStatefulWidget {
  const TrickTableLayer({super.key});

  @override
  ConsumerState<TrickTableLayer> createState() => _TrickTableLayerState();
}

class _TrickTableLayerState extends ConsumerState<TrickTableLayer>
    with SingleTickerProviderStateMixin {
  Ticker? _ticker;
  int _lastFrameMs = 0;
  int _frameIntervalMs = 8;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((_) {
      if (!mounted) return;
      // خنق معدل التحديث حسب FPS المستهدف لتقليل عبء إعادة الرسم.
      final now = DateTime.now().millisecondsSinceEpoch;
      if (now - _lastFrameMs < _frameIntervalMs) return;
      _lastFrameMs = now;
      setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  void _syncTicker(Map<int, int>? throwTimes, bool animationsEnabled) {
    if (_ticker == null) return;
    // في وضع الأجهزة الضعيفة لا نشغّل مؤقّت الأنميشن إطلاقاً.
    if (!animationsEnabled) {
      if (_ticker!.isActive) _ticker!.stop();
      return;
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    final animating = throwTimes?.values.any((t) => now - t < trickThrowMs) ?? false;
    if (animating && !_ticker!.isActive) {
      _ticker!.start();
    } else if (!animating && _ticker!.isActive) {
      _ticker!.stop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final game = ref.watch(gameControllerProvider);
    final animationsEnabled =
        ref.watch(settingsProvider.select((s) => s.animationsEnabled));
    _frameIntervalMs = ref.watch(settingsProvider.select((s) => s.frameIntervalMs));
    if (game.trickCollect != null) return const SizedBox.shrink();

    final trick = (game.gs?['current_trick'] as List?) ?? [];
    if (trick.isEmpty) return const SizedBox.shrink();

    final throwTimes = game.trickThrowAtMs;
    _syncTicker(throwTimes, animationsEnabled);

    final mySeat = game.mySeat ?? 0;
    final dims = rab4haDims(context);
    final cardW = dims.cardSmW * 1.35;
    final cardH = dims.cardSmH * 1.35;
    final globalBack = game.gs?['card_back_url']?.toString() ?? '/cards/back_dark.png';
    final seats = (game.gs?['seats'] as List?) ?? [];

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);
        final center = Offset(size.width / 2, size.height / 2);

        return RepaintBoundary(
          child: Stack(
          clipBehavior: Clip.none,
          children: [
            for (var i = 0; i < trick.length; i++)
              Builder(builder: (context) {
                final item = Map<String, dynamic>.from(trick[i] as Map);
                final card = Map<String, dynamic>.from(item['card'] as Map? ?? {});
                final player = item['player'] as int? ?? 0;
                final visualPos = getVisualPos(player, mySeat);
                final slot = trickSlotOffset(visualPos);
                final from = throwStartOffset(visualPos, size);
                final t = animationsEnabled ? _throwProgress(throwTimes[player]) : 1.0;
                final arc = math.sin(t * math.pi) * -26;
                final pos = Offset.lerp(from, slot, t)! + Offset(0, arc);
                final scale = 0.88 + 0.12 * t;
                final seatBack = player < seats.length
                    ? seatDeckBackUrl(
                        Map<String, dynamic>.from(seats[player] as Map? ?? {}),
                        globalBack,
                      )
                    : globalBack;

                return Positioned(
                  left: center.dx + pos.dx - cardW / 2,
                  top: center.dy + pos.dy - cardH / 2,
                  child: Transform.scale(
                    scale: scale,
                    child: Material(
                      elevation: 4 + i.toDouble(),
                      borderRadius: BorderRadius.circular(8),
                      color: Colors.transparent,
                      child: SizedBox(
                        width: cardW,
                        height: cardH,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: NetworkAssetImage(
                            path: cardImagePath(card, backUrl: seatBack),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
          ],
          ),
        );
      },
    );
  }
}

/// أنيميشن جمع الأكلة — الكروت تطير إلى الفائز.
class TrickCollectFlyLayer extends ConsumerStatefulWidget {
  const TrickCollectFlyLayer({super.key});

  @override
  ConsumerState<TrickCollectFlyLayer> createState() => _TrickCollectFlyLayerState();
}

class _TrickCollectFlyLayerState extends ConsumerState<TrickCollectFlyLayer>
    with SingleTickerProviderStateMixin {
  AnimationController? _ctrl;
  Map<String, dynamic>? _payload;
  int? _winner;
  List<Map<String, dynamic>> _cards = const [];

  @override
  void dispose() {
    _ctrl?.dispose();
    super.dispose();
  }

  void _syncCollect(Map<String, dynamic>? collect) {
    if (collect == null) {
      if (_payload != null) {
        _payload = null;
        _winner = null;
        _cards = const [];
        _ctrl?.dispose();
        _ctrl = null;
        if (mounted) setState(() {});
      }
      return;
    }
    if (collect == _payload) return;
    _payload = collect;
    _winner = collect['winner'] as int?;
    _cards = (collect['cards'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    _ctrl?.dispose();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: trickCollectMs),
    )..forward();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<Map<String, dynamic>?>(
      gameControllerProvider.select((s) => s.trickCollect),
      (prev, collect) => _syncCollect(collect),
    );
    if (_ctrl == null || _winner == null || _cards.isEmpty) {
      return const SizedBox.shrink();
    }
    // وضع الأجهزة الضعيفة: نتخطى أنميشن تجميع الأكلة (تُزال تلقائياً من المتحكم).
    final animationsEnabled =
        ref.watch(settingsProvider.select((s) => s.animationsEnabled));
    if (!animationsEnabled) return const SizedBox.shrink();

    final game = ref.watch(gameControllerProvider);
    final mySeat = game.mySeat ?? 0;
    final winnerPos = getVisualPos(_winner!, mySeat);
    final dims = rab4haDims(context);
    final cardW = dims.cardSmW * 1.35;
    final cardH = dims.cardSmH * 1.35;
    final globalBack = game.gs?['card_back_url']?.toString() ?? '/cards/back_dark.png';
    final seats = (game.gs?['seats'] as List?) ?? [];

    return RepaintBoundary(
      child: AnimatedBuilder(
      animation: _ctrl!,
      builder: (context, _) {
        return LayoutBuilder(
          builder: (context, constraints) {
            final size = Size(constraints.maxWidth, constraints.maxHeight);
            final center = Offset(size.width / 2, size.height / 2);
            final dest = _destOffset(winnerPos, size);

            return Stack(
              clipBehavior: Clip.none,
              children: [
                for (var i = 0; i < _cards.length; i++)
                  Builder(builder: (context) {
                    final item = _cards[i];
                    final card = Map<String, dynamic>.from(item['card'] as Map? ?? {});
                    final player = item['player'] as int? ?? 0;
                    final visualPos = getVisualPos(player, mySeat);
                    final slot = trickSlotOffset(visualPos);
                    final sx = center.dx + slot.dx - cardW / 2;
                    final sy = center.dy + slot.dy - cardH / 2;
                    final delay = i * 0.06;
                    final t = ((_ctrl!.value - delay) / (1 - delay)).clamp(0.0, 1.0);
                    final eased = Curves.easeInCubic.transform(t);
                    final arc = math.sin(eased * math.pi) * -18;
                    final x = sx + (dest.dx - cardW / 2 - sx) * eased;
                    final y = sy + (dest.dy - cardH / 2 - sy) * eased + arc;
                    final seatBack = player < seats.length
                        ? seatDeckBackUrl(
                            Map<String, dynamic>.from(seats[player] as Map? ?? {}),
                            globalBack,
                          )
                        : globalBack;

                    return Positioned(
                      left: x,
                      top: y,
                      child: Opacity(
                        opacity: 1 - eased * 0.35,
                        child: Transform.scale(
                          scale: 1 - eased * 0.15,
                          child: SizedBox(
                            width: cardW,
                            height: cardH,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: NetworkAssetImage(
                                path: cardImagePath(card, backUrl: seatBack),
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
              ],
            );
          },
        );
      },
      ),
    );
  }

  Offset _destOffset(String visualPos, Size size) {
    return switch (visualPos) {
      'bottom' => Offset(size.width / 2, size.height * 0.78),
      'top' => Offset(size.width / 2, size.height * 0.14),
      'left' => Offset(size.width * 0.12, size.height * 0.42),
      'right' => Offset(size.width * 0.88, size.height * 0.42),
      _ => Offset(size.width / 2, size.height / 2),
    };
  }
}
