import 'package:flutter/material.dart';

/// ثيم الرئيسية — أسود وذهبي.
abstract final class HomeBlackGold {
  static const bg = Color(0xFF080808);
  static const surface = Color(0xFF121212);
  static const surfaceElevated = Color(0xFF1A1A1A);
  static const gold = Color(0xFFD4AF37);
  static const goldLight = Color(0xFFF0C96A);
  static const goldDim = Color(0xFF8B6914);
  static const border = Color(0x66D4AF37);
  static const textMuted = Color(0xFF9CA3AF);

  static BoxDecoration cardDecoration({double radius = 16}) => BoxDecoration(
        color: surfaceElevated,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: border, width: 1.2),
        boxShadow: const [
          BoxShadow(color: Color(0x40000000), blurRadius: 12, offset: Offset(0, 4)),
        ],
      );

  static LinearGradient rankedGradient = const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1A1508), Color(0xFF0F0D08), Color(0xFF1A1206)],
  );

  static LinearGradient tournamentsGradient = const LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF151008), Color(0xFF0C0A06)],
  );

  static BoxDecoration cubeDecoration({bool tournaments = false}) => BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        gradient: tournaments
            ? tournamentsGradient
            : const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1F1F1F), Color(0xFF141414), Color(0xFF0A0A0A)],
              ),
        border: Border.all(color: gold.withValues(alpha: 0.45), width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0xFF050505),
            offset: Offset(0, 7),
            blurRadius: 0,
          ),
          BoxShadow(
            color: Color(0x59000000),
            offset: Offset(0, 10),
            blurRadius: 14,
          ),
        ],
      );
}
