import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/rank_themes.dart';
import '../../shared/widgets/buttons.dart';
import '../../shared/widgets/skill_radar.dart';
import '../auth/auth_provider.dart';
import '../game/game_controller.dart';

class RankedScreen extends ConsumerStatefulWidget {
  const RankedScreen({super.key});

  @override
  ConsumerState<RankedScreen> createState() => _RankedScreenState();
}

class _RankedScreenState extends ConsumerState<RankedScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(profileProvider.notifier).fetch();
    });
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider);
    if (profile == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final theme = rankThemeFor(profile.rankTheme);
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('مصنّف'),
        leading: BackButton(onPressed: () => context.go('/home')),
      ),
      body: Container(
        decoration: rankScreenDecoration(profile.rankTheme),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: theme.bannerColors),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Text(rankFullLabel(profile.rank, profile.subRank),
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: theme.text)),
                  if (profile.nextRankLabel != null) ...[
                    const SizedBox(height: 4),
                    Text('التالي: ${profile.nextRankLabel}',
                        style: TextStyle(color: theme.text.withValues(alpha: 0.85), fontSize: 14)),
                  ],
                  const SizedBox(height: 8),
                  LinearProgressIndicator(value: profile.progressPercent / 100, color: theme.secondary),
                  Text(
                    profile.pointsToNext != null
                        ? '${profile.rankPoints} / 100 — باقي ${profile.pointsToNext} نقطة للترقية'
                        : '${profile.rankPoints} / 100',
                  ),
                  SkillRadarChart(stats: profile.effectiveRadar),
                ],
              ),
            ),
            const Spacer(),
            PrimaryButton(
              label: 'العب مصنّف',
              onPressed: () async {
                final ok = await ref.read(matchmakingProvider.notifier).start(
                      solo: false,
                      mode: 'ranked',
                      name: profile.name,
                    );
                if (context.mounted && ok) context.go('/matchmaking');
              },
            ),
          ],
            ),
          ),
        ),
      ),
    );
  }
}
