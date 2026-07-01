import 'package:flutter/material.dart';

class RankTier {
  const RankTier({required this.id, required this.name, required this.theme});
  final String id;
  final String name;
  final String theme;
}

const rankTiers = [
  RankTier(id: 'beginner', name: 'مبتدئ', theme: 'wood'),
  RankTier(id: 'intermediate', name: 'متوسط', theme: 'silver'),
  RankTier(id: 'advanced', name: 'متقدم', theme: 'gold'),
  RankTier(id: 'pro', name: 'محترف', theme: 'green'),
  RankTier(id: 'expert', name: 'خبير', theme: 'ruby'),
  RankTier(id: 'genius', name: 'نابغ', theme: 'genius'),
];

const subSuitLabels = ['♣️', '♣️♦️', '♣️♦️♠️', '♣️♦️♠️♥️'];

class RankThemeData {
  const RankThemeData({
    required this.primary,
    required this.secondary,
    required this.glow,
    required this.text,
    required this.bannerColors,
  });

  final Color primary;
  final Color secondary;
  final Color glow;
  final Color text;
  final List<Color> bannerColors;
}

const rankThemes = <String, RankThemeData>{
  'wood': RankThemeData(
    primary: Color(0xFF8B5A2B),
    secondary: Color(0xFFD4A574),
    glow: Color(0x738B5A2B),
    text: Color(0xFFFEF3C7),
    bannerColors: [Color(0xFF5D3A1A), Color(0xFF8B5A2B), Color(0xFFC49A6C)],
  ),
  'silver': RankThemeData(
    primary: Color(0xFF94A3B8),
    secondary: Color(0xFFE2E8F0),
    glow: Color(0x8094A3B8),
    text: Color(0xFFF8FAFC),
    bannerColors: [Color(0xFF475569), Color(0xFF94A3B8), Color(0xFFE2E8F0)],
  ),
  'gold': RankThemeData(
    primary: Color(0xFFEAB308),
    secondary: Color(0xFFFDE047),
    glow: Color(0x80EAB308),
    text: Color(0xFF1E293B),
    bannerColors: [Color(0xFF854D0E), Color(0xFFEAB308), Color(0xFFFEF08A)],
  ),
  'green': RankThemeData(
    primary: Color(0xFF22C55E),
    secondary: Color(0xFF86EFAC),
    glow: Color(0x7322C55E),
    text: Color(0xFFF0FDF4),
    bannerColors: [Color(0xFF14532D), Color(0xFF22C55E), Color(0xFF86EFAC)],
  ),
  'ruby': RankThemeData(
    primary: Color(0xFFE11D48),
    secondary: Color(0xFFFB7185),
    glow: Color(0x80E11D48),
    text: Color(0xFFFFF1F2),
    bannerColors: [Color(0xFF881337), Color(0xFFE11D48), Color(0xFFFDA4AF)],
  ),
  'genius': RankThemeData(
    primary: Color(0xFFFFD700),
    secondary: Color(0xFF1A1A1A),
    glow: Color(0x8CFFD700),
    text: Color(0xFFFFD700),
    bannerColors: [Color(0xFF0A0A0A), Color(0xFF1A1A1A), Color(0xFFB8860B), Color(0xFFFFD700)],
  ),
};

RankThemeData rankThemeFor(String? theme) =>
    rankThemes[theme] ?? rankThemes['wood']!;

/// خلفية شاشة كاملة حسب رتبة اللاعب (P13 / P70).
BoxDecoration rankScreenDecoration(String? theme) {
  final t = rankThemeFor(theme);
  return BoxDecoration(
    gradient: RadialGradient(
      center: Alignment.topCenter,
      radius: 1.5,
      colors: [
        Color.lerp(t.primary, const Color(0xFF121212), 0.35)!,
        const Color(0xFF121212),
        const Color(0xFF020617),
      ],
      stops: const [0.0, 0.5, 1.0],
    ),
  );
}

String seatDeckBackUrl(Map<String, dynamic>? seat, String? globalBack) {
  final seatBack = seat?['deck_back_url']?.toString();
  if (seatBack != null && seatBack.isNotEmpty) return seatBack;
  return globalBack ?? '/cards/back_dark.png';
}

RankTier rankInfo(int rank, int subRank) {
  return rankTiers[rank.clamp(0, rankTiers.length - 1)];
}

String rankFullLabel(int rank, int subRank) {
  final r = rankTiers[rank.clamp(0, rankTiers.length - 1)];
  final s = subRank.clamp(0, subSuitLabels.length - 1);
  return '${r.name} ${subSuitLabels[s]}';
}

String formatCoins(num n) {
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
  return n.toString();
}

String formatPlayerCode(String? code) {
  final c = (code ?? '').trim().toUpperCase();
  return c.isEmpty ? '' : '#$c';
}
