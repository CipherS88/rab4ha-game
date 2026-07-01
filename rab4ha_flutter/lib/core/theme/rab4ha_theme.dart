import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class Rab4haColors extends ThemeExtension<Rab4haColors> {
  const Rab4haColors({
    required this.bgDark,
    required this.bgSurface,
    required this.bgElevated,
    required this.bgTable,
    required this.accent,
    required this.gold,
    required this.goldLight,
    required this.danger,
    required this.success,
    required this.textPrimary,
    required this.textMuted,
    required this.inputBg,
    required this.inputBorder,
    required this.borderGold,
  });

  final Color bgDark;
  final Color bgSurface;
  final Color bgElevated;
  final Color bgTable;
  final Color accent;
  final Color gold;
  final Color goldLight;
  final Color danger;
  final Color success;
  final Color textPrimary;
  final Color textMuted;
  final Color inputBg;
  final Color inputBorder;
  final Color borderGold;

  static const dark = Rab4haColors(
    bgDark: Color(0xFF080808),
    bgSurface: Color(0xFF121212),
    bgElevated: Color(0xFF1A1A1A),
    bgTable: Color(0xFF1E3A2F),
    accent: Color(0xFFF0C96A),
    gold: Color(0xFFD4AF37),
    goldLight: Color(0xFFF0C96A),
    danger: Color(0xFFEF4444),
    success: Color(0xFF22C55E),
    textPrimary: Color(0xFFF5F5F5),
    textMuted: Color(0xFF9CA3AF),
    inputBg: Color(0xFF121212),
    inputBorder: Color(0x66D4AF37),
    borderGold: Color(0x66D4AF37),
  );

  LinearGradient get screenGradient => const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFF1A1508), Color(0xFF080808), Color(0xFF050505)],
        stops: [0.0, 0.45, 1.0],
      );

  LinearGradient get feltGradient => const LinearGradient(
        begin: Alignment.center,
        end: Alignment.bottomCenter,
        colors: [Color(0xFF2D5A45), Color(0xFF1A3D2E), Color(0xFF0F2619)],
        stops: [0.0, 0.6, 1.0],
      );

  LinearGradient get primaryButtonGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF8B6914), Color(0xFFD4AF37), Color(0xFFF0C96A)],
      );

  LinearGradient get cardGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF1F1F1F), Color(0xFF141414), Color(0xFF0A0A0A)],
      );

  BoxDecoration panelDecoration({double radius = 14}) => BoxDecoration(
        color: bgElevated,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderGold, width: 1.2),
        boxShadow: const [
          BoxShadow(color: Color(0x40000000), blurRadius: 12, offset: Offset(0, 4)),
        ],
      );

  @override
  Rab4haColors copyWith({
    Color? bgDark,
    Color? bgSurface,
    Color? bgElevated,
    Color? bgTable,
    Color? accent,
    Color? gold,
    Color? goldLight,
    Color? danger,
    Color? success,
    Color? textPrimary,
    Color? textMuted,
    Color? inputBg,
    Color? inputBorder,
    Color? borderGold,
  }) {
    return Rab4haColors(
      bgDark: bgDark ?? this.bgDark,
      bgSurface: bgSurface ?? this.bgSurface,
      bgElevated: bgElevated ?? this.bgElevated,
      bgTable: bgTable ?? this.bgTable,
      accent: accent ?? this.accent,
      gold: gold ?? this.gold,
      goldLight: goldLight ?? this.goldLight,
      danger: danger ?? this.danger,
      success: success ?? this.success,
      textPrimary: textPrimary ?? this.textPrimary,
      textMuted: textMuted ?? this.textMuted,
      inputBg: inputBg ?? this.inputBg,
      inputBorder: inputBorder ?? this.inputBorder,
      borderGold: borderGold ?? this.borderGold,
    );
  }

  @override
  Rab4haColors lerp(ThemeExtension<Rab4haColors>? other, double t) {
    if (other is! Rab4haColors) return this;
    return Rab4haColors(
      bgDark: Color.lerp(bgDark, other.bgDark, t)!,
      bgSurface: Color.lerp(bgSurface, other.bgSurface, t)!,
      bgElevated: Color.lerp(bgElevated, other.bgElevated, t)!,
      bgTable: Color.lerp(bgTable, other.bgTable, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      gold: Color.lerp(gold, other.gold, t)!,
      goldLight: Color.lerp(goldLight, other.goldLight, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      success: Color.lerp(success, other.success, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      inputBg: Color.lerp(inputBg, other.inputBg, t)!,
      inputBorder: Color.lerp(inputBorder, other.inputBorder, t)!,
      borderGold: Color.lerp(borderGold, other.borderGold, t)!,
    );
  }
}

class Rab4haDimensions {
  Rab4haDimensions(this.width);

  final double width;

  double get cardW => (width * 0.17).clamp(58, 92);
  double get cardH => cardW * 1.48;
  double get cardSmW => (width * 0.10).clamp(34, 48);
  double get cardSmH => cardSmW * 1.48;
  double get fanW => 38;
  double get fanH => 56;
  double get shellGutter => (width * 0.05).clamp(16, 28);
}

ThemeData buildRab4haTheme() {
  const c = Rab4haColors.dark;
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: c.bgDark,
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFFD4AF37),
      onPrimary: Color(0xFF080808),
      secondary: Color(0xFFF0C96A),
      surface: Color(0xFF121212),
      onSurface: Color(0xFFF5F5F5),
      error: Color(0xFFEF4444),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFF080808),
      foregroundColor: Color(0xFFF0C96A),
      elevation: 0,
      centerTitle: true,
    ),
    cardTheme: CardThemeData(
      color: c.bgElevated,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: c.borderGold, width: 1.2),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: const Color(0xFF0B0B0B),
      indicatorColor: c.gold.withValues(alpha: 0.15),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const TextStyle(color: Color(0xFFF0C96A), fontWeight: FontWeight.w700, fontSize: 11);
        }
        return TextStyle(color: c.textMuted.withValues(alpha: 0.95), fontSize: 11);
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: Color(0xFFF0C96A));
        }
        return IconThemeData(color: c.textMuted.withValues(alpha: 0.95));
      }),
    ),
    dividerTheme: DividerThemeData(color: c.borderGold.withValues(alpha: 0.35)),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: Color(0xFFD4AF37)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.inputBg,
      labelStyle: TextStyle(color: c.textMuted),
      hintStyle: TextStyle(color: c.textMuted.withValues(alpha: 0.8)),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c.inputBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c.inputBorder.withValues(alpha: 0.6)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFD4AF37), width: 1.5),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: c.bgElevated,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: c.borderGold),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: c.goldLight,
      unselectedLabelColor: c.textMuted,
      indicatorColor: c.gold,
    ),
    extensions: const [Rab4haColors.dark],
  );
  return base.copyWith(
    textTheme: GoogleFonts.tajawalTextTheme(base.textTheme).apply(
      bodyColor: c.textPrimary,
      displayColor: c.textPrimary,
    ),
  );
}

Rab4haColors rab4haColors(BuildContext context) =>
    Theme.of(context).extension<Rab4haColors>() ?? Rab4haColors.dark;

Rab4haDimensions rab4haDims(BuildContext context) =>
    Rab4haDimensions(MediaQuery.sizeOf(context).width);
