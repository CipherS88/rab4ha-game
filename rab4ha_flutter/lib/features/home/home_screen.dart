import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/rank_themes.dart';
import '../../shared/models/user_models.dart';
import '../../shared/widgets/buttons.dart';
import '../../shared/widgets/deck_stack.dart';
import '../../shared/widgets/network_asset.dart';
import '../auth/auth_provider.dart';
import '../game/game_controller.dart';
import '../game/rejoin_prompt.dart';
import 'home_animations.dart';
import 'home_layout.dart';
import 'home_layout_provider.dart';
import 'home_layout_slot.dart';
import 'home_theme.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      await ref.read(profileProvider.notifier).fetch();
      if (mounted) await showRejoinDialogIfNeeded(context, ref);
    } catch (_) {
      if (mounted) context.go('/login');
    }
  }

  Future<void> _startFriendly() async {
    final p = ref.read(profileProvider);
    final name = p?.name ?? 'لاعب';
    try {
      final ok = await ref.read(matchmakingProvider.notifier).start(
            solo: false,
            mode: 'friendly',
            name: name,
          );
      if (!mounted) return;
      if (ok) {
        context.go('/matchmaking');
      } else {
        final err = ref.read(matchmakingProvider).error;
        ref.read(homeToastProvider.notifier).show(err ?? 'تعذّر بدء المباراة الودّية');
      }
    } catch (e) {
      if (mounted) {
        ref.read(homeToastProvider.notifier).show('تعذّر بدء المباراة الودّية');
      }
    }
  }

  Future<void> _startAdminSandbox() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/api/admin/sandbox/start');
      final data = await api.parseJson(res, fallback: 'تعذّر فتح sandbox');
      final roomId = data['roomId']?.toString();
      if (roomId == null || !mounted) return;
      final name = ref.read(profileProvider)?.name ?? 'لاعب';
      final joinRes = await ref.read(gameControllerProvider.notifier).joinRoom(
            roomId: roomId,
            name: name,
            mode: 'sandbox',
          );
      if (!mounted) return;
      if (joinRes?['error'] != null) {
        ref.read(homeToastProvider.notifier).show(joinRes!['error'].toString());
        return;
      }
      final status = joinRes?['room']?['status']?.toString();
      if (status == 'playing') {
        context.go('/game');
      } else {
        context.go('/matchmaking');
      }
    } catch (e) {
      if (mounted) {
        ref.read(homeToastProvider.notifier).show(e.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider);
    final layout = ref.watch(homeLayoutProvider);
    if (profile == null || layout.loading) {
      return const Scaffold(
        backgroundColor: HomeBlackGold.bg,
        body: Center(child: CircularProgressIndicator(color: HomeBlackGold.gold)),
      );
    }
    return Scaffold(
      backgroundColor: HomeBlackGold.bg,
      body: SafeArea(
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final canvas = Size(constraints.maxWidth, constraints.maxHeight);
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      for (final id in HomeLayoutConfig.ids)
                        if (layout.active.elements.containsKey(id))
                          HomeLayoutSlot(
                            id: id,
                            box: layout.active.elements[id]!,
                            canvasSize: canvas,
                            editMode: layout.editMode,
                            onChanged: (box) =>
                                ref.read(homeLayoutProvider.notifier).updateBox(id, box),
                            child: _layoutChild(id, profile, layout.active.elements[id]!, canvas),
                          ),
                    ],
                  );
                },
              ),
            ),
            if (profile.isAdmin && !layout.editMode)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(4, 2, 8, 0),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.admin_panel_settings, color: Color(0xFFEF4444)),
                          tooltip: 'لوحة الإدارة',
                          onPressed: () => context.push('/admin'),
                        ),
                        IconButton(
                          icon: const Icon(Icons.dashboard_customize_outlined, color: Colors.redAccent),
                          tooltip: 'تعديل التخطيط',
                          onPressed: () => ref.read(homeLayoutProvider.notifier).startEdit(),
                        ),
                        Expanded(
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: _startAdminSandbox,
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: HomeBlackGold.gold.withValues(alpha: 0.55)),
                                  color: HomeBlackGold.surface.withValues(alpha: 0.95),
                                ),
                                child: const Text(
                                  '🎴 ساندبوكس — تعديل طاولة اللعب',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: HomeBlackGold.goldLight,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            if (layout.editMode)
              Positioned(
                top: 8,
                left: 16,
                right: 16,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: HomeBlackGold.gold.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: HomeBlackGold.gold.withValues(alpha: 0.35)),
                    ),
                    child: const Text(
                      'اسحب للتحريك — الزاوية للتكبير',
                      style: TextStyle(color: HomeBlackGold.goldLight, fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ),
            if (layout.editMode) _buildEditorBar(context),
          ],
        ),
      ),
    );
  }

  Widget _buildEditorBar(BuildContext context) {
    return Positioned(
      left: 16,
      right: 16,
      bottom: 12,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: HomeBlackGold.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: HomeBlackGold.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton(
              onPressed: () async {
                final ok = await ref.read(homeLayoutProvider.notifier).save();
                if (mounted) {
                  ref.read(homeToastProvider.notifier).show(ok ? 'تم حفظ التخطيط' : 'فشل الحفظ');
                }
              },
              child: const Text('حفظ', style: TextStyle(color: HomeBlackGold.goldLight, fontWeight: FontWeight.w800)),
            ),
            TextButton(
              onPressed: () => ref.read(homeLayoutProvider.notifier).cancelEdit(),
              child: const Text('إلغاء', style: TextStyle(color: HomeBlackGold.textMuted)),
            ),
            TextButton(
              onPressed: () async {
                final ok = await ref.read(homeLayoutProvider.notifier).resetToDefault();
                if (mounted) {
                  ref.read(homeToastProvider.notifier).show(ok ? 'تم إعادة الضبط — اضغط حفظ' : 'فشل');
                }
              },
              child: const Text('إعادة ضبط', style: TextStyle(color: HomeBlackGold.textMuted)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _layoutChild(String id, PlayerProfile profile, HomeLayoutBox box, Size canvas) {
    final layout = ref.read(homeLayoutProvider);
    final slotW = box.w * canvas.width;
    final slotH = box.h * canvas.height;
    switch (id) {
      case 'settings':
        return IconButton(
          icon: const Icon(Icons.settings_outlined, color: HomeBlackGold.goldLight),
          onPressed: layout.editMode ? null : () => context.push('/settings'),
        );
      case 'stats':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _StatLine(label: 'فلوس', value: formatCoins(profile.coins)),
            _StatLine(label: 'إعجابات', value: '${profile.wins}'),
            _StatLine(label: 'البطولات', value: '${profile.championshipStars}'),
          ],
        );
      case 'avatar':
        return Center(
          child: _HomeAvatar(
            profile: profile,
            enabled: !layout.editMode,
            diameter: math.min(slotW, slotH) * 0.92,
          ),
        );
      case 'deck':
        return Center(
          child: HomeDeckStack(
            deckBackUrl: profile.deckBackUrl ?? '/cards/back_dark.png',
            cardWidth: slotW * 0.58,
            cardHeight: slotH * 0.92,
          ),
        );
      case 'identity':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                buildStatusStar(profile),
                Flexible(
                  child: Text(
                    profile.name,
                    textAlign: TextAlign.end,
                    style: const TextStyle(
                      color: HomeBlackGold.goldLight,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (!layout.editMode)
                  IconButton(
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    icon: const Icon(Icons.edit_outlined, size: 16, color: HomeBlackGold.textMuted),
                    onPressed: () => _editName(context, profile),
                  ),
              ],
            ),
            Text(
              rankFullLabel(profile.rank, profile.subRank),
              style: const TextStyle(color: HomeBlackGold.gold, fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ],
        );
      case 'ranked':
        return _RankedCard(
          rankLabel: rankFullLabel(profile.rank, profile.subRank),
          onTap: layout.editMode ? () {} : () => context.push('/ranked'),
        );
      case 'friendly':
        return Center(
          child: _HomeCubeCard(
            size: math.min(slotW, slotH),
            label: 'ودّية',
            icon: Icons.handshake_outlined,
            onTap: layout.editMode ? () {} : _startFriendly,
          ),
        );
      case 'tournaments':
        return Center(
          child: _HomeCubeCard(
            size: math.min(slotW, slotH),
            label: 'البطولات',
            locked: !AppConfig.tournamentsEnabled,
            onTap: layout.editMode
                ? () {}
                : () {
                    if (!AppConfig.tournamentsEnabled) {
                      ref.read(homeToastProvider.notifier).show(
                            'البطولات قيد التنفيذ — ستتوفر قريباً',
                          );
                      return;
                    }
                    context.push('/tournaments');
                  },
            tournaments: true,
          ),
        );
      case 'leaderboards':
        return Center(
          child: _HomeCubeCard(
            size: math.min(slotW, slotH),
            label: 'المتصدرين',
            icon: Icons.leaderboard_outlined,
            onTap: layout.editMode ? () {} : () => context.push('/leaderboards'),
          ),
        );
      case 'sessions':
        return Center(
          child: _HomeCubeCard(
            size: math.min(slotW, slotH),
            label: 'الجلسات',
            icon: Icons.groups_outlined,
            onTap: layout.editMode ? () {} : () => context.push('/sessions'),
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Future<void> _editName(BuildContext context, PlayerProfile profile) async {
    final ctrl = TextEditingController(text: profile.name);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: HomeBlackGold.surface,
        title: const Text('تعديل الاسم', style: TextStyle(color: HomeBlackGold.goldLight)),
        content: TextField(
          controller: ctrl,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            filled: true,
            fillColor: HomeBlackGold.bg,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('حفظ')),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    try {
      await ref.read(profileProvider.notifier).updateName(name);
      ref.read(homeToastProvider.notifier).show('تم تحديث الاسم');
    } catch (e) {
      ref.read(homeToastProvider.notifier).show(e.toString());
    }
  }
}

class _StatLine extends StatelessWidget {
  const _StatLine({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(fontSize: 12, color: HomeBlackGold.textMuted, height: 1.35),
          children: [
            TextSpan(text: '$label: '),
            TextSpan(
              text: value,
              style: const TextStyle(
                color: HomeBlackGold.goldLight,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeAvatar extends ConsumerWidget {
  const _HomeAvatar({
    required this.profile,
    this.enabled = true,
    this.diameter = 100,
  });
  final PlayerProfile profile;
  final bool enabled;
  final double diameter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: enabled ? () => _pickAvatar(context, ref) : null,
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: HomeBlackGold.gold, width: 2),
          boxShadow: [
            BoxShadow(
              color: HomeBlackGold.gold.withValues(alpha: 0.25),
              blurRadius: 14,
            ),
          ],
        ),
        child: CircleAvatar(
          radius: diameter / 2,
          backgroundColor: HomeBlackGold.surface,
          child: ClipOval(child: _content(ref)),
        ),
      ),
    );
  }

  Widget _content(WidgetRef ref) {
    if (profile.avatarUrl != null && !profile.avatarRemoved) {
      return Image.network(
        ref.read(apiClientProvider).assetUrl(profile.avatarUrl!),
        width: diameter,
        height: diameter,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _initial(),
      );
    }
    return _initial();
  }

  Widget _initial() {
    return Center(
      child: Text(
        profile.avatarRemoved ? '🚫' : profile.name.characters.first,
        style: TextStyle(fontSize: diameter * 0.36, color: HomeBlackGold.goldLight),
      ),
    );
  }

  Future<void> _pickAvatar(BuildContext context, WidgetRef ref) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, maxWidth: 800);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    final dataUrl = 'data:${file.mimeType ?? 'image/jpeg'};base64,${base64Encode(bytes)}';
    try {
      await ref.read(profileProvider.notifier).updateAvatar(dataUrl);
      ref.read(homeToastProvider.notifier).show('تم تحديث صورة العرض');
    } catch (e) {
      ref.read(homeToastProvider.notifier).show(e.toString());
    }
  }
}

class _RankedCard extends StatelessWidget {
  const _RankedCard({required this.rankLabel, required this.onTap});
  final String rankLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: HomeBlackGold.rankedGradient,
            border: Border.all(color: HomeBlackGold.gold.withValues(alpha: 0.55), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: HomeBlackGold.gold.withValues(alpha: 0.12),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Stack(
            children: [
              const Positioned.fill(child: RankedSuitsBackground()),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'لعب مصنّف',
                      style: TextStyle(
                        color: HomeBlackGold.goldLight,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'تصنيفك: $rankLabel',
                      style: TextStyle(
                        color: HomeBlackGold.gold.withValues(alpha: 0.85),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
    );
  }
}

class _HomeCubeCard extends StatelessWidget {
  const _HomeCubeCard({
    required this.size,
    required this.label,
    required this.onTap,
    this.icon,
    this.tournaments = false,
    this.locked = false,
  });

  final double size;
  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final bool tournaments;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: locked ? 0.58 : 1,
      child: SizedBox(
      width: size,
      height: size,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          splashColor: HomeBlackGold.gold.withValues(alpha: 0.12),
          highlightColor: HomeBlackGold.gold.withValues(alpha: 0.06),
          child: Ink(
            decoration: HomeBlackGold.cubeDecoration(tournaments: tournaments),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (tournaments)
                    const TournamentsMotionBackground(compact: true),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 10, 8, 10),
                    child: Column(
                      children: [
                        if (icon != null) ...[
                          Expanded(
                            child: Center(
                              child: Container(
                                width: 54,
                                height: 54,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: HomeBlackGold.gold.withValues(alpha: 0.08),
                                  border: Border.all(
                                    color: HomeBlackGold.gold.withValues(alpha: 0.35),
                                  ),
                                ),
                                child: Icon(icon, color: HomeBlackGold.goldLight, size: 30),
                              ),
                            ),
                          ),
                        ] else
                          const Spacer(),
                        Text(
                          label,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: HomeBlackGold.goldLight,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
    );
  }
}
