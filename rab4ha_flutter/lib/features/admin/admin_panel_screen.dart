import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../auth/auth_provider.dart';
import 'admin_provider.dart';

// ── ألوان لوحة الإدارة (مميزة عن واجهة اللاعب) ─────────────
abstract final class AdminColors {
  static const bg = Color(0xFF0A0608);
  static const surface = Color(0xFF140C10);
  static const card = Color(0xFF1A1014);
  static const accent = Color(0xFFB91C1C);
  static const accentLight = Color(0xFFEF4444);
  static const gold = Color(0xFFD4AF37);
  static const text = Color(0xFFF5F0EB);
  static const muted = Color(0xFF9CA3AF);
  static const border = Color(0xFF3D2028);
  static const success = Color(0xFF22C55E);
}

enum AdminSection { dashboard, users, sessions, gifts, store, reports, online, system }

class AdminPanelScreen extends ConsumerStatefulWidget {
  const AdminPanelScreen({super.key});

  @override
  ConsumerState<AdminPanelScreen> createState() => _AdminPanelScreenState();
}

class _AdminPanelScreenState extends ConsumerState<AdminPanelScreen> {
  AdminSection _section = AdminSection.dashboard;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _refreshTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider);
    if (profile == null || !profile.isAdmin) {
      return Scaffold(
        backgroundColor: AdminColors.bg,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock, color: AdminColors.accentLight, size: 48),
              const SizedBox(height: 12),
              const Text('صلاحية أدمن مطلوبة', style: TextStyle(color: AdminColors.text)),
              const SizedBox(height: 16),
              TextButton(onPressed: () => context.go('/home'), child: const Text('العودة')),
            ],
          ),
        ),
      );
    }

    final wide = MediaQuery.sizeOf(context).width >= 900;

    return Scaffold(
      backgroundColor: AdminColors.bg,
      appBar: AppBar(
        backgroundColor: AdminColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AdminColors.gold),
          onPressed: () => context.go('/home'),
        ),
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shield, color: AdminColors.accentLight, size: 22),
            SizedBox(width: 8),
            Text(
              'لوحة الإدارة',
              style: TextStyle(
                color: AdminColors.gold,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ],
        ),
        actions: [
          if (!wide)
            IconButton(
              icon: const Icon(Icons.menu, color: AdminColors.gold),
              onPressed: () => Scaffold.of(context).openEndDrawer(),
            ),
        ],
      ),
      endDrawer: wide ? null : _AdminDrawer(section: _section, onSelect: _select),
      body: Row(
        children: [
          if (wide) _AdminSideNav(section: _section, onSelect: _select),
          Expanded(child: _buildSection()),
        ],
      ),
    );
  }

  void _select(AdminSection s) {
    setState(() => _section = s);
    if (Scaffold.maybeOf(context)?.isEndDrawerOpen ?? false) {
      Navigator.of(context).pop();
    }
  }

  Widget _buildSection() {
    return switch (_section) {
      AdminSection.dashboard => const _DashboardTab(),
      AdminSection.users => const _UsersTab(),
      AdminSection.sessions => const _SessionsTab(),
      AdminSection.gifts => const _GiftsTab(),
      AdminSection.store => const _StoreTab(),
      AdminSection.reports => const _ReportsTab(),
      AdminSection.online => const _OnlineTab(),
      AdminSection.system => const _SystemTab(),
    };
  }
}

// ── التنقل الجانبي ───────────────────────────────────────────
class _AdminSideNav extends StatelessWidget {
  const _AdminSideNav({required this.section, required this.onSelect});
  final AdminSection section;
  final ValueChanged<AdminSection> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      decoration: const BoxDecoration(
        color: AdminColors.surface,
        border: Border(left: BorderSide(color: AdminColors.border)),
      ),
      child: _AdminNavList(section: section, onSelect: onSelect),
    );
  }
}

class _AdminDrawer extends StatelessWidget {
  const _AdminDrawer({required this.section, required this.onSelect});
  final AdminSection section;
  final ValueChanged<AdminSection> onSelect;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: AdminColors.surface,
      child: SafeArea(
        child: _AdminNavList(section: section, onSelect: onSelect),
      ),
    );
  }
}

class _AdminNavList extends StatelessWidget {
  const _AdminNavList({required this.section, required this.onSelect});
  final AdminSection section;
  final ValueChanged<AdminSection> onSelect;

  static const _items = [
    (AdminSection.dashboard, Icons.dashboard_rounded, 'الرئيسية'),
    (AdminSection.users, Icons.people_alt_rounded, 'إدارة اللاعبين'),
    (AdminSection.sessions, Icons.meeting_room_rounded, 'إدارة الجلسات'),
    (AdminSection.gifts, Icons.card_giftcard_rounded, 'إدارة الهدايا'),
    (AdminSection.store, Icons.storefront_rounded, 'المتجر'),
    (AdminSection.reports, Icons.report_rounded, 'التبليغات'),
    (AdminSection.online, Icons.wifi_tethering_rounded, 'المتصلون'),
    (AdminSection.system, Icons.settings_applications_rounded, 'إعدادات النظام'),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      children: [
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'Rab4ha Admin',
            style: TextStyle(
              color: AdminColors.gold,
              fontWeight: FontWeight.w900,
              fontSize: 16,
              letterSpacing: 1,
            ),
          ),
        ),
        const Divider(color: AdminColors.border, height: 1),
        const SizedBox(height: 8),
        for (final (s, icon, label) in _items)
          _NavTile(
            icon: icon,
            label: label,
            selected: section == s,
            onTap: () => onSelect(s),
          ),
      ],
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: selected ? AdminColors.accent.withValues(alpha: 0.25) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: selected ? Border.all(color: AdminColors.accent) : null,
            ),
            child: Row(
              children: [
                Icon(icon, color: selected ? AdminColors.accentLight : AdminColors.muted, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: selected ? AdminColors.text : AdminColors.muted,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                      fontSize: 14,
                    ),
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

// ── بطاقة إحصائية ────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AdminColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AdminColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 28),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 26,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: AdminColors.muted, fontSize: 12)),
        ],
      ),
    );
  }
}

class _AdminCard extends StatelessWidget {
  const _AdminCard({required this.title, required this.child, this.icon});
  final String title;
  final Widget child;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AdminColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AdminColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, color: AdminColors.gold, size: 20),
                const SizedBox(width: 8),
              ],
              Text(
                title,
                style: const TextStyle(
                  color: AdminColors.gold,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

String _fmtNum(dynamic v) {
  final n = v is num ? v : int.tryParse(v?.toString() ?? '') ?? 0;
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
  return n.toString();
}

void _snack(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(msg, textDirection: TextDirection.rtl),
      backgroundColor: error ? AdminColors.accent : AdminColors.success,
    ),
  );
}

// ── تبويب الرئيسية (Dashboard) ───────────────────────────────
class _DashboardTab extends ConsumerWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(adminApiProvider);
    return FutureBuilder<Map<String, dynamic>>(
      future: api.stats(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: AdminColors.gold));
        }
        if (snap.hasError) {
          return Center(
            child: Text(
              ApiClient.mapError(snap.error!).message,
              style: const TextStyle(color: AdminColors.accentLight),
            ),
          );
        }
        final s = snap.data ?? {};
        return RefreshIndicator(
          color: AdminColors.gold,
          onRefresh: () async {
            (context as Element).markNeedsBuild();
          },
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'إحصائيات النظام الحية',
                style: TextStyle(color: AdminColors.text, fontWeight: FontWeight.w900, fontSize: 20),
              ),
              const SizedBox(height: 16),
              GridView.count(
                crossAxisCount: MediaQuery.sizeOf(context).width >= 700 ? 3 : 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.4,
                children: [
                  _StatCard(
                    icon: Icons.wifi_tethering,
                    label: 'متصل الآن',
                    value: _fmtNum(s['online']),
                    color: AdminColors.success,
                  ),
                  _StatCard(
                    icon: Icons.videogame_asset,
                    label: 'جلسات نشطة',
                    value: _fmtNum(s['active_rooms']),
                    color: AdminColors.accentLight,
                  ),
                  _StatCard(
                    icon: Icons.visibility,
                    label: 'مشاهدون',
                    value: _fmtNum(s['spectators']),
                    color: const Color(0xFF60A5FA),
                  ),
                  _StatCard(
                    icon: Icons.people,
                    label: 'إجمالي الحسابات',
                    value: _fmtNum(s['total_users']),
                    color: AdminColors.gold,
                  ),
                  _StatCard(
                    icon: Icons.monetization_on,
                    label: 'عملات متداولة',
                    value: _fmtNum(s['total_coins']),
                    color: const Color(0xFFFBBF24),
                  ),
                  _StatCard(
                    icon: Icons.diamond,
                    label: 'جواهر متداولة',
                    value: _fmtNum(s['total_gems']),
                    color: const Color(0xFFA78BFA),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _AdminCard(
                title: 'ملخص سريع',
                icon: Icons.analytics_outlined,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SummaryRow('حسابات محظورة', _fmtNum(s['banned_users'])),
                    _SummaryRow('غرف لعب نشطة', _fmtNum(s['active_rooms'])),
                    _SummaryRow('لاعبون متصلون', _fmtNum(s['online'])),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AdminColors.muted)),
          Text(value, style: const TextStyle(color: AdminColors.text, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

// ── تبويب إدارة اللاعبين ─────────────────────────────────────
class _UsersTab extends ConsumerStatefulWidget {
  const _UsersTab();

  @override
  ConsumerState<_UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends ConsumerState<_UsersTab> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _users = [];
  Map<String, dynamic>? _selected;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ref.read(adminApiProvider).searchUsers(q);
      setState(() {
        _users = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = ApiClient.mapError(e).message;
        _loading = false;
      });
    }
  }

  Future<void> _action(Future<void> Function() fn, String ok) async {
    try {
      await fn();
      if (mounted) _snack(context, ok);
      await _search(_searchCtrl.text.trim());
      if (_selected != null) {
        final id = _selected!['id'];
        final updated = _users.firstWhere((u) => u['id'] == id, orElse: () => _selected!);
        setState(() => _selected = updated);
      }
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  Future<void> _showBalanceDialog() async {
    final u = _selected;
    if (u == null) return;
    final coinsCtrl = TextEditingController(text: '0');
    final gemsCtrl = TextEditingController(text: '0');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.card,
        title: const Text('تعديل الرصيد', style: TextStyle(color: AdminColors.gold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: coinsCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'عملات (+/-)'),
            ),
            TextField(
              controller: gemsCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'جواهر (+/-)'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AdminColors.accent),
            child: const Text('تطبيق'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _action(
      () => ref.read(adminApiProvider).adjustBalance(
            u['id'] as int,
            coins: int.tryParse(coinsCtrl.text) ?? 0,
            gems: int.tryParse(gemsCtrl.text) ?? 0,
          ),
      'تم تعديل الرصيد',
    );
  }

  Future<void> _showWarnDialog() async {
    final u = _selected;
    if (u == null) return;
    final msgCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.card,
        title: const Text('رسالة تحذير', style: TextStyle(color: AdminColors.gold)),
        content: TextField(
          controller: msgCtrl,
          maxLines: 3,
          decoration: const InputDecoration(hintText: 'نص التحذير للاعب...'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AdminColors.accent),
            child: const Text('إرسال'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _action(
      () => ref.read(adminApiProvider).warnUser(u['id'] as int, msgCtrl.text.trim()),
      'تم إرسال التحذير',
    );
  }

  Future<void> _showBanDialog() async {
    final u = _selected;
    if (u == null) return;
    final reasonCtrl = TextEditingController(text: 'مخالفة قوانين اللعبة');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.card,
        title: const Text('حظر الحساب', style: TextStyle(color: AdminColors.accentLight)),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(labelText: 'سبب الحظر'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AdminColors.accent),
            child: const Text('حظر'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _action(
      () => ref.read(adminApiProvider).banUser(u['id'] as int, reasonCtrl.text.trim()),
      'تم حظر الحساب',
    );
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 800;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'إدارة اللاعبين',
            style: TextStyle(color: AdminColors.text, fontWeight: FontWeight.w900, fontSize: 20),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'بحث بالاسم، ID، أو رمز اللاعب...',
              prefixIcon: const Icon(Icons.search, color: AdminColors.gold),
              filled: true,
              fillColor: AdminColors.card,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AdminColors.border),
              ),
              suffixIcon: IconButton(
                icon: const Icon(Icons.refresh, color: AdminColors.muted),
                onPressed: () => _search(_searchCtrl.text.trim()),
              ),
            ),
            onSubmitted: _search,
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AdminColors.gold))
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: AdminColors.accentLight)))
                    : wide
                        ? Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(flex: 2, child: _userList()),
                              const SizedBox(width: 12),
                              Expanded(flex: 3, child: _userDetail()),
                            ],
                          )
                        : _userList(),
          ),
        ],
      ),
    );
  }

  Widget _userList() {
    return ListView.builder(
      itemCount: _users.length,
      itemBuilder: (_, i) {
        final u = _users[i];
        final selected = _selected?['id'] == u['id'];
        final banned = u['is_banned'] == true;
        return Card(
          color: selected ? AdminColors.accent.withValues(alpha: 0.15) : AdminColors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: selected ? AdminColors.accent : AdminColors.border,
            ),
          ),
          child: ListTile(
            onTap: () {
              setState(() => _selected = u);
              if (MediaQuery.sizeOf(context).width < 800) _showMobileDetail(u);
            },
            leading: CircleAvatar(
              backgroundColor: banned ? AdminColors.accent : AdminColors.border,
              child: Text('${u['id']}', style: const TextStyle(color: AdminColors.text, fontSize: 12)),
            ),
            title: Text(
              u['display_name']?.toString() ?? '—',
              style: const TextStyle(color: AdminColors.text, fontWeight: FontWeight.w700),
            ),
            subtitle: Text(
              'ID: ${u['id']} • ${u['rank_label'] ?? ''}',
              style: const TextStyle(color: AdminColors.muted, fontSize: 12),
            ),
            trailing: banned
                ? const Icon(Icons.block, color: AdminColors.accentLight, size: 18)
                : null,
          ),
        );
      },
    );
  }

  Future<void> _showMobileDetail(Map<String, dynamic> u) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AdminColors.surface,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
        child: DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.55,
          minChildSize: 0.35,
          maxChildSize: 0.9,
          builder: (_, scrollCtrl) => SingleChildScrollView(
            controller: scrollCtrl,
            padding: const EdgeInsets.all(16),
            child: _userDetailBody(u),
          ),
        ),
      ),
    );
  }

  Widget _userDetailBody(Map<String, dynamic> u) {
    final banned = u['is_banned'] == true;
    return _AdminCard(
      title: u['display_name']?.toString() ?? 'لاعب',
      icon: Icons.person,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SummaryRow('المعرّف', '${u['id']}'),
          _SummaryRow('رمز اللاعب', u['player_code']?.toString() ?? '—'),
          _SummaryRow('الرتبة', u['rank_label']?.toString() ?? '—'),
          _SummaryRow('عملات', _fmtNum(u['coins'])),
          _SummaryRow('جواهر', _fmtNum(u['gems'])),
          _SummaryRow('فوز / خسارة', '${u['wins'] ?? 0} / ${u['losses'] ?? 0}'),
          _SummaryRow('الحالة', banned ? 'محظور' : 'نشط'),
          if (banned && (u['ban_reason']?.toString().isNotEmpty ?? false))
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'سبب: ${u['ban_reason']}',
                style: const TextStyle(color: AdminColors.accentLight, fontSize: 12),
              ),
            ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (!banned)
                _ActionBtn(
                  label: 'حظر',
                  icon: Icons.block,
                  color: AdminColors.accent,
                  onTap: _showBanDialog,
                )
              else
                _ActionBtn(
                  label: 'فك الحظر',
                  icon: Icons.check_circle,
                  color: AdminColors.success,
                  onTap: () => _action(
                    () => ref.read(adminApiProvider).unbanUser(u['id'] as int),
                    'تم فك الحظر',
                  ),
                ),
              _ActionBtn(
                label: 'تعديل الرصيد',
                icon: Icons.account_balance_wallet,
                color: AdminColors.gold,
                onTap: _showBalanceDialog,
              ),
              _ActionBtn(
                label: 'تحذير',
                icon: Icons.warning_amber,
                color: const Color(0xFFF59E0B),
                onTap: _showWarnDialog,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _userDetail() {
    final u = _selected;
    if (u == null) {
      return const _AdminCard(
        title: 'ملف اللاعب',
        child: Center(
          child: Text('اختر لاعباً من القائمة', style: TextStyle(color: AdminColors.muted)),
        ),
      );
    }
    return SingleChildScrollView(child: _userDetailBody(u));
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18, color: color),
      label: Text(label, style: TextStyle(color: color)),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: color.withValues(alpha: 0.6)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
    );
  }
}

// ── تبويب إدارة الجلسات ─────────────────────────────────────
class _SessionsTab extends ConsumerStatefulWidget {
  const _SessionsTab();

  @override
  ConsumerState<_SessionsTab> createState() => _SessionsTabState();
}

class _SessionsTabState extends ConsumerState<_SessionsTab> {
  List<Map<String, dynamic>> _rooms = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ref.read(adminApiProvider).rooms();
      setState(() {
        _rooms = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = ApiClient.mapError(e).message;
        _loading = false;
      });
    }
  }

  Future<void> _kill(String roomId) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.card,
        title: const Text('إغلاق الجلسة', style: TextStyle(color: AdminColors.accentLight)),
        content: Text('هل تريد إغلاق الغرفة $roomId بالقوة؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AdminColors.accent),
            child: const Text('إغلاق'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(adminApiProvider).killRoom(roomId);
      if (mounted) _snack(context, 'تم إغلاق الجلسة');
      await _load();
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'الجلسات النشطة',
                  style: TextStyle(color: AdminColors.text, fontWeight: FontWeight.w900, fontSize: 20),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: AdminColors.gold),
                onPressed: _load,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AdminColors.gold))
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: AdminColors.accentLight)))
                    : _rooms.isEmpty
                        ? const Center(
                            child: Text('لا توجد غرف نشطة', style: TextStyle(color: AdminColors.muted)),
                          )
                        : ListView.builder(
                            itemCount: _rooms.length,
                            itemBuilder: (_, i) {
                              final r = _rooms[i];
                              final players = (r['players'] as List?) ?? [];
                              final roomId = r['roomId']?.toString() ?? '—';
                              return Card(
                                color: AdminColors.card,
                                margin: const EdgeInsets.only(bottom: 10),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  side: const BorderSide(color: AdminColors.border),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              roomId,
                                              style: const TextStyle(
                                                color: AdminColors.gold,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ),
                                          _StatusChip(r['status']?.toString() ?? ''),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'لاعبون: ${r['player_count'] ?? players.length} • بوتات: ${r['bot_count'] ?? 0} • مشاهدون: ${r['spectator_count'] ?? 0}',
                                        style: const TextStyle(color: AdminColors.muted, fontSize: 13),
                                      ),
                                      if (players.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          players.map((p) => (p as Map)['name']).join(' • '),
                                          style: const TextStyle(color: AdminColors.text, fontSize: 12),
                                        ),
                                      ],
                                      const SizedBox(height: 10),
                                      Align(
                                        alignment: Alignment.centerLeft,
                                        child: FilledButton.icon(
                                          onPressed: () => _kill(roomId),
                                          icon: const Icon(Icons.power_settings_new, size: 18),
                                          label: const Text('إغلاق بالقوة'),
                                          style: FilledButton.styleFrom(
                                            backgroundColor: AdminColors.accent,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    final playing = status == 'playing';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: playing ? AdminColors.success.withValues(alpha: 0.2) : AdminColors.border,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: playing ? AdminColors.success : AdminColors.muted),
      ),
      child: Text(
        playing ? 'جارية' : status,
        style: TextStyle(
          color: playing ? AdminColors.success : AdminColors.muted,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ── تبويب إعدادات النظام ─────────────────────────────────────
class _SystemTab extends ConsumerStatefulWidget {
  const _SystemTab();

  @override
  ConsumerState<_SystemTab> createState() => _SystemTabState();
}

class _SystemTabState extends ConsumerState<_SystemTab> {
  bool _maintEnabled = false;
  final _maintMsgCtrl = TextEditingController();
  final _announceCtrl = TextEditingController();
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadMaint();
  }

  @override
  void dispose() {
    _maintMsgCtrl.dispose();
    _announceCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMaint() async {
    try {
      final data = await ref.read(adminApiProvider).getMaintenance();
      setState(() {
        _maintEnabled = data['enabled'] == true;
        _maintMsgCtrl.text = data['message']?.toString() ?? '';
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _toggleMaint(bool v) async {
    try {
      final data = await ref.read(adminApiProvider).setMaintenance(v, _maintMsgCtrl.text.trim());
      setState(() => _maintEnabled = data['enabled'] == true);
      if (mounted) {
        _snack(context, v ? 'تم تفعيل وضع الصيانة' : 'تم إيقاف وضع الصيانة');
      }
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  Future<void> _sendAnnounce() async {
    final msg = _announceCtrl.text.trim();
    if (msg.isEmpty) return;
    try {
      await ref.read(adminApiProvider).announce(msg);
      _announceCtrl.clear();
      if (mounted) _snack(context, 'تم إرسال الإعلان لجميع اللاعبين');
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AdminColors.gold));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'إعدادات النظام',
          style: TextStyle(color: AdminColors.text, fontWeight: FontWeight.w900, fontSize: 20),
        ),
        const SizedBox(height: 16),
        _AdminCard(
          title: 'وضع الصيانة',
          icon: Icons.build_circle_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'يمنع دخول لاعبين جدد ويرسل تنبيهاً للمتواجدين',
                style: TextStyle(color: AdminColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('تفعيل الصيانة', style: TextStyle(color: AdminColors.text)),
                value: _maintEnabled,
                activeThumbColor: AdminColors.accentLight,
                onChanged: _toggleMaint,
              ),
              TextField(
                controller: _maintMsgCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: 'رسالة الصيانة',
                  filled: true,
                  fillColor: AdminColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _AdminCard(
          title: 'إعلان عام',
          icon: Icons.campaign_rounded,
          child: Column(
            children: [
              const Text(
                'يظهر كإشعار لجميع اللاعبين المتصلين',
                style: TextStyle(color: AdminColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _announceCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'اكتب رسالة الإعلان...',
                  filled: true,
                  fillColor: AdminColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _sendAnnounce,
                  icon: const Icon(Icons.send),
                  label: const Text('إرسال للجميع'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AdminColors.gold,
                    foregroundColor: AdminColors.bg,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── تبويب إدارة الهدايا ──────────────────────────────────────
class _GiftsTab extends ConsumerStatefulWidget {
  const _GiftsTab();

  @override
  ConsumerState<_GiftsTab> createState() => _GiftsTabState();
}

class _GiftsTabState extends ConsumerState<_GiftsTab> {
  final _searchCtrl = TextEditingController();
  final _coinsCtrl = TextEditingController(text: '0');
  final _gemsCtrl = TextEditingController(text: '0');
  final _vipCtrl = TextEditingController(text: '0');
  final _rentalCtrl = TextEditingController(text: '7');
  final _msgCtrl = TextEditingController();

  List<Map<String, dynamic>> _results = [];
  Map<String, dynamic>? _target;
  List<Map<String, dynamic>> _products = [];
  int? _productId;
  List<Map<String, dynamic>> _log = [];
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _loadLog();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _coinsCtrl.dispose();
    _gemsCtrl.dispose();
    _vipCtrl.dispose();
    _rentalCtrl.dispose();
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    try {
      final list = await ref.read(adminApiProvider).storeProducts();
      setState(() => _products = list.map((e) => Map<String, dynamic>.from(e as Map)).toList());
    } catch (_) {}
  }

  Future<void> _loadLog() async {
    try {
      final list = await ref.read(adminApiProvider).giftLog();
      setState(() => _log = list.map((e) => Map<String, dynamic>.from(e as Map)).toList());
    } catch (_) {}
  }

  Future<void> _search(String q) async {
    try {
      final list = await ref.read(adminApiProvider).searchUsers(q);
      setState(() => _results = list.map((e) => Map<String, dynamic>.from(e as Map)).toList());
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  Future<void> _send() async {
    final t = _target;
    if (t == null) {
      _snack(context, 'اختر لاعباً أولاً', error: true);
      return;
    }
    setState(() => _sending = true);
    try {
      await ref.read(adminApiProvider).sendGift(
            userId: t['id'] as int,
            coins: int.tryParse(_coinsCtrl.text) ?? 0,
            gems: int.tryParse(_gemsCtrl.text) ?? 0,
            vipDays: int.tryParse(_vipCtrl.text) ?? 0,
            productId: _productId,
            rentalDays: _productId != null ? (int.tryParse(_rentalCtrl.text) ?? 0) : 0,
            message: _msgCtrl.text.trim(),
          );
      if (mounted) {
        _snack(context, 'تم إرسال الهدية إلى ${t['display_name']}');
        _coinsCtrl.text = '0';
        _gemsCtrl.text = '0';
        _vipCtrl.text = '0';
        _msgCtrl.clear();
        setState(() => _productId = null);
      }
      await _loadLog();
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'إدارة الهدايا',
          style: TextStyle(color: AdminColors.text, fontWeight: FontWeight.w900, fontSize: 20),
        ),
        const SizedBox(height: 16),
        _AdminCard(
          title: 'إرسال هدية مجانية للاعب',
          icon: Icons.redeem,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _searchCtrl,
                decoration: InputDecoration(
                  hintText: 'ابحث عن لاعب بالاسم أو ID...',
                  prefixIcon: const Icon(Icons.search, color: AdminColors.gold),
                  filled: true,
                  fillColor: AdminColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onSubmitted: _search,
              ),
              if (_results.isNotEmpty && _target == null)
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  constraints: const BoxConstraints(maxHeight: 180),
                  decoration: BoxDecoration(
                    color: AdminColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AdminColors.border),
                  ),
                  child: ListView(
                    shrinkWrap: true,
                    children: _results
                        .map((u) => ListTile(
                              dense: true,
                              title: Text(u['display_name']?.toString() ?? '—',
                                  style: const TextStyle(color: AdminColors.text)),
                              subtitle: Text('ID: ${u['id']}',
                                  style: const TextStyle(color: AdminColors.muted, fontSize: 12)),
                              onTap: () => setState(() {
                                _target = u;
                                _results = [];
                                _searchCtrl.text = u['display_name']?.toString() ?? '';
                              }),
                            ))
                        .toList(),
                  ),
                ),
              if (_target != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Chip(
                    backgroundColor: AdminColors.accent.withValues(alpha: 0.2),
                    label: Text(
                      'المستلم: ${_target!['display_name']} (#${_target!['id']})',
                      style: const TextStyle(color: AdminColors.text),
                    ),
                    deleteIcon: const Icon(Icons.close, size: 16, color: AdminColors.muted),
                    onDeleted: () => setState(() {
                      _target = null;
                      _searchCtrl.clear();
                    }),
                  ),
                ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _numField(_coinsCtrl, 'عملات', Icons.monetization_on)),
                  const SizedBox(width: 10),
                  Expanded(child: _numField(_gemsCtrl, 'جواهر', Icons.diamond)),
                ],
              ),
              const SizedBox(height: 10),
              _numField(_vipCtrl, 'أيام VIP', Icons.workspace_premium),
              const SizedBox(height: 10),
              DropdownButtonFormField<int?>(
                initialValue: _productId,
                dropdownColor: AdminColors.card,
                decoration: InputDecoration(
                  labelText: 'منتج (اشتراك اختياري)',
                  filled: true,
                  fillColor: AdminColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                style: const TextStyle(color: AdminColors.text),
                items: [
                  const DropdownMenuItem<int?>(value: null, child: Text('بدون منتج')),
                  ..._products.map((p) => DropdownMenuItem<int?>(
                        value: p['id'] as int,
                        child: Text('${p['name']} (${p['category_label'] ?? p['category']})'),
                      )),
                ],
                onChanged: (v) => setState(() => _productId = v),
              ),
              if (_productId != null) ...[
                const SizedBox(height: 10),
                _numField(_rentalCtrl, 'أيام الاشتراك', Icons.calendar_month),
              ],
              const SizedBox(height: 10),
              TextField(
                controller: _msgCtrl,
                maxLines: 2,
                style: const TextStyle(color: AdminColors.text),
                decoration: InputDecoration(
                  labelText: 'رسالة (اختياري)',
                  filled: true,
                  fillColor: AdminColors.surface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(
                          width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send),
                  label: Text(_sending ? 'جارٍ الإرسال...' : 'إرسال الهدية'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AdminColors.accent,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _AdminCard(
          title: 'سجل الهدايا',
          icon: Icons.history,
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _loadLog,
                  icon: const Icon(Icons.refresh, size: 18, color: AdminColors.muted),
                  label: const Text('تحديث', style: TextStyle(color: AdminColors.muted)),
                ),
              ),
              if (_log.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text('لا يوجد سجل', style: TextStyle(color: AdminColors.muted)),
                )
              else
                ..._log.map((g) => _GiftLogRow(g)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _numField(TextEditingController c, String label, IconData icon) {
    return TextField(
      controller: c,
      keyboardType: const TextInputType.numberWithOptions(signed: true),
      style: const TextStyle(color: AdminColors.text),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: AdminColors.gold, size: 20),
        filled: true,
        fillColor: AdminColors.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}

class _GiftLogRow extends StatelessWidget {
  const _GiftLogRow(this.g);
  final Map<String, dynamic> g;

  @override
  Widget build(BuildContext context) {
    final isAdmin = g['is_admin'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AdminColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AdminColors.border),
      ),
      child: Row(
        children: [
          Icon(
            isAdmin ? Icons.shield : Icons.card_giftcard,
            color: isAdmin ? AdminColors.gold : AdminColors.accentLight,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${g['from_name'] ?? '—'} ← ${g['to_name'] ?? '—'}',
                  style: const TextStyle(color: AdminColors.text, fontWeight: FontWeight.w700, fontSize: 13),
                ),
                Text(
                  '${g['gift_type']} • ${_fmtNum(g['amount'])}${(g['message']?.toString().isNotEmpty ?? false) ? ' • ${g['message']}' : ''}',
                  style: const TextStyle(color: AdminColors.muted, fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── تبويب المتجر (كتالوج المنتجات والأسعار) ──────────────────
class _StoreTab extends ConsumerStatefulWidget {
  const _StoreTab();

  @override
  ConsumerState<_StoreTab> createState() => _StoreTabState();
}

class _StoreTabState extends ConsumerState<_StoreTab> {
  List<Map<String, dynamic>> _products = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ref.read(adminApiProvider).storeProducts();
      setState(() {
        _products = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = ApiClient.mapError(e).message;
        _loading = false;
      });
    }
  }

  Future<void> _editDialog({Map<String, dynamic>? existing}) async {
    final isEdit = existing != null;
    final nameCtrl = TextEditingController(text: existing?['name']?.toString() ?? '');
    final descCtrl = TextEditingController(text: existing?['description']?.toString() ?? '');
    final priceCtrl = TextEditingController(text: (existing?['price'] ?? 0).toString());
    final imgCtrl = TextEditingController(text: existing?['image_url']?.toString() ?? '');
    final assetCtrl = TextEditingController(text: existing?['asset_key']?.toString() ?? '');
    String category = existing?['category']?.toString() ?? 'cards';
    bool isActive = existing?['is_active'] != false;

    final cats = await ref.read(adminApiProvider).storeCategories();
    if (!mounted) return;
    final catList = cats.map((e) => Map<String, dynamic>.from(e as Map)).toList();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          backgroundColor: AdminColors.card,
          title: Text(isEdit ? 'تعديل منتج' : 'منتج جديد',
              style: const TextStyle(color: AdminColors.gold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'الاسم')),
                TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'الوصف')),
                TextField(
                  controller: priceCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'السعر (عملات)'),
                ),
                TextField(controller: assetCtrl, decoration: const InputDecoration(labelText: 'asset_key')),
                TextField(controller: imgCtrl, decoration: const InputDecoration(labelText: 'رابط الصورة')),
                const SizedBox(height: 8),
                if (!isEdit)
                  DropdownButtonFormField<String>(
                    initialValue: category,
                    dropdownColor: AdminColors.card,
                    decoration: const InputDecoration(labelText: 'القسم'),
                    items: catList
                        .map((c) => DropdownMenuItem(
                              value: c['id']?.toString(),
                              child: Text(c['label']?.toString() ?? c['id'].toString()),
                            ))
                        .toList(),
                    onChanged: (v) => category = v ?? category,
                  ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('مفعّل', style: TextStyle(color: AdminColors.text)),
                  value: isActive,
                  activeThumbColor: AdminColors.success,
                  onChanged: (v) => setD(() => isActive = v),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: AdminColors.accent),
              child: const Text('حفظ'),
            ),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    final body = {
      'name': nameCtrl.text.trim(),
      'description': descCtrl.text.trim(),
      'price': int.tryParse(priceCtrl.text) ?? 0,
      'asset_key': assetCtrl.text.trim(),
      'image_url': imgCtrl.text.trim(),
      'is_active': isActive,
      if (!isEdit) 'category': category,
    };
    try {
      if (isEdit) {
        await ref.read(adminApiProvider).updateProduct(existing['id'] as int, body);
      } else {
        await ref.read(adminApiProvider).createProduct(body);
      }
      if (mounted) _snack(context, 'تم الحفظ');
      await _load();
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.card,
        title: const Text('حذف المنتج', style: TextStyle(color: AdminColors.accentLight)),
        content: Text('حذف "${p['name']}"؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AdminColors.accent),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(adminApiProvider).deleteProduct(p['id'] as int);
      if (mounted) _snack(context, 'تم الحذف');
      await _load();
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('المتجر — كتالوج المنتجات',
                    style: TextStyle(color: AdminColors.text, fontWeight: FontWeight.w900, fontSize: 20)),
              ),
              FilledButton.icon(
                onPressed: () => _editDialog(),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('جديد'),
                style: FilledButton.styleFrom(backgroundColor: AdminColors.gold, foregroundColor: AdminColors.bg),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AdminColors.gold))
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: AdminColors.accentLight)))
                    : _products.isEmpty
                        ? const Center(child: Text('لا توجد منتجات', style: TextStyle(color: AdminColors.muted)))
                        : ListView.builder(
                            itemCount: _products.length,
                            itemBuilder: (_, i) {
                              final p = _products[i];
                              final active = p['is_active'] == true;
                              return Card(
                                color: AdminColors.card,
                                margin: const EdgeInsets.only(bottom: 8),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: const BorderSide(color: AdminColors.border),
                                ),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: AdminColors.surface,
                                    child: Icon(
                                      p['category'] == 'cards' ? Icons.style : Icons.wallpaper,
                                      color: AdminColors.gold, size: 20,
                                    ),
                                  ),
                                  title: Text(p['name']?.toString() ?? '—',
                                      style: const TextStyle(color: AdminColors.text, fontWeight: FontWeight.w700)),
                                  subtitle: Text(
                                    '${p['category_label'] ?? p['category']} • ${_fmtNum(p['price'])} عملة${active ? '' : ' • غير مفعّل'}',
                                    style: TextStyle(
                                      color: active ? AdminColors.muted : AdminColors.accentLight, fontSize: 12),
                                  ),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.edit, color: AdminColors.gold, size: 20),
                                        onPressed: () => _editDialog(existing: p),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete, color: AdminColors.accentLight, size: 20),
                                        onPressed: () => _delete(p),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

// ── تبويب التبليغات والمحظورون ───────────────────────────────
class _ReportsTab extends ConsumerStatefulWidget {
  const _ReportsTab();

  @override
  ConsumerState<_ReportsTab> createState() => _ReportsTabState();
}

class _ReportsTabState extends ConsumerState<_ReportsTab> {
  int _sub = 0;
  List<Map<String, dynamic>> _reports = [];
  List<Map<String, dynamic>> _banned = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(adminApiProvider);
      final reports = await api.chatReports();
      final banned = await api.bannedUsers();
      setState(() {
        _reports = reports.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _banned = banned.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  Future<void> _resolve(int id, String action) async {
    try {
      await ref.read(adminApiProvider).resolveReport(id, action: action);
      if (mounted) _snack(context, 'تم تنفيذ الإجراء');
      await _load();
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  Future<void> _unban(int userId) async {
    try {
      await ref.read(adminApiProvider).unbanChatUser(userId);
      if (mounted) _snack(context, 'تم فك الحظر');
      await _load();
    } catch (e) {
      if (mounted) _snack(context, ApiClient.mapError(e).message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('التبليغات والحظر',
                    style: TextStyle(color: AdminColors.text, fontWeight: FontWeight.w900, fontSize: 20)),
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: AdminColors.gold),
                onPressed: _load,
              ),
            ],
          ),
          const SizedBox(height: 8),
          SegmentedButton<int>(
            segments: [
              ButtonSegment(value: 0, label: Text('تبليغات (${_reports.length})')),
              ButtonSegment(value: 1, label: Text('محظورون (${_banned.length})')),
            ],
            selected: {_sub},
            onSelectionChanged: (s) => setState(() => _sub = s.first),
            style: ButtonStyle(
              foregroundColor: WidgetStateProperty.resolveWith(
                (s) => s.contains(WidgetState.selected) ? AdminColors.bg : AdminColors.muted,
              ),
              backgroundColor: WidgetStateProperty.resolveWith(
                (s) => s.contains(WidgetState.selected) ? AdminColors.gold : AdminColors.card,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AdminColors.gold))
                : _sub == 0
                    ? _reportsList()
                    : _bannedList(),
          ),
        ],
      ),
    );
  }

  Widget _reportsList() {
    if (_reports.isEmpty) {
      return const Center(child: Text('لا توجد تبليغات معلّقة', style: TextStyle(color: AdminColors.muted)));
    }
    return ListView.builder(
      itemCount: _reports.length,
      itemBuilder: (_, i) {
        final r = _reports[i];
        return Card(
          color: AdminColors.card,
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AdminColors.border),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${r['reporter_name'] ?? '—'} ⟶ ${r['reported_name'] ?? '—'}',
                    style: const TextStyle(color: AdminColors.text, fontWeight: FontWeight.w700)),
                if (r['message_body'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('"${r['message_body']}"',
                        style: const TextStyle(color: AdminColors.muted, fontSize: 12)),
                  ),
                if (r['details'] != null && r['details'].toString().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('السبب: ${r['details']}',
                        style: const TextStyle(color: AdminColors.muted, fontSize: 12)),
                  ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    _ActionBtn(
                      label: 'تجاهل',
                      icon: Icons.check,
                      color: AdminColors.muted,
                      onTap: () => _resolve(r['id'] as int, 'dismiss'),
                    ),
                    _ActionBtn(
                      label: 'حذف الرسالة',
                      icon: Icons.delete_sweep,
                      color: const Color(0xFFF59E0B),
                      onTap: () => _resolve(r['id'] as int, 'delete_message'),
                    ),
                    _ActionBtn(
                      label: 'حظر',
                      icon: Icons.block,
                      color: AdminColors.accent,
                      onTap: () => _resolve(r['id'] as int, 'ban'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _bannedList() {
    if (_banned.isEmpty) {
      return const Center(child: Text('لا يوجد محظورون', style: TextStyle(color: AdminColors.muted)));
    }
    return ListView.builder(
      itemCount: _banned.length,
      itemBuilder: (_, i) {
        final u = _banned[i];
        return Card(
          color: AdminColors.card,
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AdminColors.border),
          ),
          child: ListTile(
            leading: const CircleAvatar(
              backgroundColor: AdminColors.accent,
              child: Icon(Icons.block, color: AdminColors.text, size: 18),
            ),
            title: Text(u['display_name']?.toString() ?? '—',
                style: const TextStyle(color: AdminColors.text, fontWeight: FontWeight.w700)),
            subtitle: Text('ID: ${u['id']} • ${u['ban_reason'] ?? ''}',
                style: const TextStyle(color: AdminColors.muted, fontSize: 12)),
            trailing: TextButton(
              onPressed: () => _unban(u['id'] as int),
              child: const Text('فك الحظر', style: TextStyle(color: AdminColors.success)),
            ),
          ),
        );
      },
    );
  }
}

// ── تبويب المتصلون الآن ──────────────────────────────────────
class _OnlineTab extends ConsumerStatefulWidget {
  const _OnlineTab();

  @override
  ConsumerState<_OnlineTab> createState() => _OnlineTabState();
}

class _OnlineTabState extends ConsumerState<_OnlineTab> {
  List<Map<String, dynamic>> _players = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ref.read(adminApiProvider).onlinePlayers();
      setState(() {
        _players = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = ApiClient.mapError(e).message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('المتصلون الآن (${_players.length})',
                    style: const TextStyle(color: AdminColors.text, fontWeight: FontWeight.w900, fontSize: 20)),
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: AdminColors.gold),
                onPressed: _load,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AdminColors.gold))
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: AdminColors.accentLight)))
                    : _players.isEmpty
                        ? const Center(child: Text('لا يوجد متصلون', style: TextStyle(color: AdminColors.muted)))
                        : ListView.builder(
                            itemCount: _players.length,
                            itemBuilder: (_, i) {
                              final p = _players[i];
                              final isAdmin = p['is_admin'] == true;
                              return Card(
                                color: AdminColors.card,
                                margin: const EdgeInsets.only(bottom: 6),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: const BorderSide(color: AdminColors.border),
                                ),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: isAdmin ? AdminColors.accent : AdminColors.surface,
                                    child: Icon(
                                      isAdmin ? Icons.shield : Icons.person,
                                      color: AdminColors.gold, size: 18,
                                    ),
                                  ),
                                  title: Text(
                                    p['display_name']?.toString() ?? p['name']?.toString() ?? 'ضيف',
                                    style: const TextStyle(color: AdminColors.text, fontWeight: FontWeight.w700),
                                  ),
                                  subtitle: Text(
                                    'عملات: ${_fmtNum(p['coins'] ?? 0)} • جواهر: ${_fmtNum(p['gems'] ?? 0)}',
                                    style: const TextStyle(color: AdminColors.muted, fontSize: 12),
                                  ),
                                  trailing: p['is_vip'] == true
                                      ? const Icon(Icons.workspace_premium, color: AdminColors.gold, size: 18)
                                      : null,
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
