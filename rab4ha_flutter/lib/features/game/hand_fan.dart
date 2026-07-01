import 'package:flutter/material.dart';

import 'card_utils.dart';
import 'game_controller.dart';

/// تخطيط مروحة اليد — مطابق cards_style.html و public/js/app.js
class HandFanPose {
  const HandFanPose({
    required this.translateY,
    required this.rotationDeg,
    required this.zIndex,
  });

  final double translateY;
  final double rotationDeg;
  final int zIndex;
}

const _handFanCurve = [
  (y: 22.0, r: -9.0),
  (y: 14.0, r: -6.0),
  (y: 6.0, r: -3.0),
  (y: 2.0, r: -1.0),
  (y: 2.0, r: 1.0),
  (y: 6.0, r: 3.0),
  (y: 14.0, r: 6.0),
  (y: 22.0, r: 9.0),
];

HandFanPose handFanPose(int displayIdx, int count) {
  if (count <= 1) {
    return const HandFanPose(translateY: 0, rotationDeg: 0, zIndex: 1);
  }
  final t = displayIdx / (count - 1);
  final pos = t * 7;
  final i0 = pos.floor().clamp(0, 7);
  final i1 = (i0 + 1).clamp(0, 7);
  final f = pos - i0;
  final a = _handFanCurve[i0];
  final b = _handFanCurve[i1];
  return HandFanPose(
    translateY: a.y + (b.y - a.y) * f,
    rotationDeg: a.r + (b.r - a.r) * f,
    zIndex: displayIdx + 1,
  );
}

class HandFanLayout {
  HandFanLayout({
    required this.cardW,
    required this.cardH,
    required this.step,
    required this.count,
    required this.maxWidth,
    this.suitGap = 10,
  });

  final double cardW;
  final double cardH;
  final double step;
  final int count;
  final double maxWidth;
  final double suitGap;

  double get height => cardH + 36;

  double totalWidth(List<String?> suitKeys) {
    if (count <= 0) return 0;
    var w = cardW;
    for (var i = 1; i < count; i++) {
      w += step;
      if (suitKeys[i] != null &&
          suitKeys[i - 1] != null &&
          suitKeys[i] != suitKeys[i - 1]) {
        w += suitGap;
      }
    }
    return w;
  }

  double startX(double totalW) => ((maxWidth - totalW) / 2).clamp(0, double.infinity);

  /// موضع أفقي لكل كرت مع فجوة بسيطة بين الألوان.
  List<double> cardLefts(List<String?> suitKeys) {
    final totalW = totalWidth(suitKeys);
    var x = startX(totalW);
    final xs = <double>[];
    for (var i = 0; i < count; i++) {
      xs.add(x);
      if (i < count - 1) {
        x += step;
        if (suitKeys[i] != null &&
            suitKeys[i + 1] != null &&
            suitKeys[i] != suitKeys[i + 1]) {
          x += suitGap;
        }
      }
    }
    return xs;
  }

  static HandFanLayout forScreen({
    required int count,
    required double screenWidth,
    required double maxWidth,
    double cardScale = 1.0,
    double gapMul = 1.0,
  }) {
    final cardW = (screenWidth * 0.145).clamp(72.0, 148.0) * cardScale;
    final cardH = cardW * 1.48;
    final suitGap = (count >= 8 ? 5.0 : 10.0) * gapMul;
    var step = _stepForCount(
      cardW: cardW,
      count: count,
      maxWidth: maxWidth,
      suitGap: suitGap,
    );
    step *= gapMul;
    return HandFanLayout(
      cardW: cardW,
      cardH: cardH,
      step: step,
      count: count,
      maxWidth: maxWidth,
      suitGap: suitGap,
    );
  }

  /// 5 كروت — مروحة أوسع شوي. 8 كروت — متلاصقة وتملأ عرض الشاشة.
  static double _stepForCount({
    required double cardW,
    required int count,
    required double maxWidth,
    required double suitGap,
  }) {
    if (count <= 1) return 0;
    if (count >= 8) {
      const maxSuitGaps = 3;
      final budget = maxWidth * 0.94 - cardW - (maxSuitGaps * suitGap);
      final step = budget / (count - 1);
      return step.clamp(18.0, cardW - 14.0);
    }
    if (count >= 6) {
      final overlap = (maxWidth * 0.048).clamp(32.0, 52.0);
      return cardW - overlap;
    }
    final overlap = (maxWidth * 0.032).clamp(12.0, 28.0);
    return cardW - overlap;
  }
}

/// ارتفاع/عرض منطقة اليد للموضعة (أفاتار فوق، كروت تحت).
HandFanLayout myHandLayout(BuildContext context, GameState game, {double? maxWidth}) {
  final gs = game.gs!;
  final hand = (gs['my_hand'] as List?) ?? [];
  final hidden = isPreSecondDealHand(gs);
  final rawHand = hidden ? hand.take(5).toList() : hand;
  final count = rawHand.isEmpty ? 5 : rawHand.length;
  final screenW = MediaQuery.sizeOf(context).width;
  return HandFanLayout.forScreen(
    count: count,
    screenWidth: screenW,
    maxWidth: maxWidth ?? screenW,
  );
}

/// تخطيط مروحة كروت الخصم/الشريك — نفس شكل مروحة المقعد العلوي (صديقي).
class OpponentFanLayout {
  OpponentFanLayout({
    required this.cardW,
    required this.cardH,
    required this.step,
    required this.count,
    required this.width,
    required this.height,
  });

  final double cardW;
  final double cardH;
  final double step;
  final int count;
  final double width;
  final double height;

  static OpponentFanLayout forCount({
    required int count,
    double scale = 1.0,
    double overlapMul = 1.0,
  }) {
    const baseW = 18.0;
    const baseH = 26.0;
    final cardW = baseW * scale;
    final cardH = baseH * scale;
    final n = count.clamp(1, 8);
    final overlap = 8.0 * overlapMul;
    final step = cardW - overlap;
    final mainSpan = step * (n - 1);
    return OpponentFanLayout(
      cardW: cardW,
      cardH: cardH,
      step: step,
      count: n,
      width: cardW + mainSpan,
      height: cardH + 28,
    );
  }
}
