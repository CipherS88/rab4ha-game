import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/socket_service.dart';

/// طبقة الوصول لواجهات لوحة الإدارة (Admin API).
class AdminApi {
  AdminApi(this._api);
  final ApiClient _api;

  Future<Map<String, dynamic>> stats() async {
    final res = await _api.get('/api/admin/dashboard/stats');
    final data = await _api.parseJson(res);
    return Map<String, dynamic>.from(data['stats'] as Map? ?? {});
  }

  Future<List<dynamic>> rooms() async {
    final res = await _api.get('/api/admin/dashboard/rooms');
    final data = await _api.parseJson(res);
    return data['rooms'] as List? ?? [];
  }

  Future<void> killRoom(String roomId) async {
    final res = await _api.post('/api/admin/dashboard/rooms/$roomId/kill');
    await _api.parseJson(res);
  }

  Future<List<dynamic>> searchUsers(String q) async {
    final res = await _api.get('/api/admin/dashboard/users/search', query: {'q': q});
    final data = await _api.parseJson(res);
    return data['users'] as List? ?? [];
  }

  Future<Map<String, dynamic>> banUser(int id, String reason) async {
    final res = await _api.post('/api/admin/dashboard/users/$id/ban', body: {'reason': reason});
    final data = await _api.parseJson(res);
    return Map<String, dynamic>.from(data['user'] as Map? ?? {});
  }

  Future<Map<String, dynamic>> unbanUser(int id) async {
    final res = await _api.post('/api/admin/dashboard/users/$id/unban');
    final data = await _api.parseJson(res);
    return Map<String, dynamic>.from(data['user'] as Map? ?? {});
  }

  Future<Map<String, dynamic>> adjustBalance(int id, {int coins = 0, int gems = 0}) async {
    final res = await _api.post('/api/admin/dashboard/users/$id/balance',
        body: {'coins': coins, 'gems': gems});
    final data = await _api.parseJson(res);
    return Map<String, dynamic>.from(data['user'] as Map? ?? {});
  }

  Future<void> warnUser(int id, String message) async {
    final res = await _api.post('/api/admin/dashboard/users/$id/warn', body: {'message': message});
    await _api.parseJson(res);
  }

  Future<Map<String, dynamic>> getMaintenance() async {
    final res = await _api.get('/api/admin/dashboard/maintenance');
    return await _api.parseJson(res);
  }

  Future<Map<String, dynamic>> setMaintenance(bool enabled, String message) async {
    final res = await _api.post('/api/admin/dashboard/maintenance',
        body: {'enabled': enabled, 'message': message});
    return await _api.parseJson(res);
  }

  Future<void> announce(String message) async {
    final res = await _api.post('/api/admin/dashboard/announce', body: {'message': message});
    await _api.parseJson(res);
  }

  // ── الهدايا ──
  Future<Map<String, dynamic>> sendGift({
    required int userId,
    int coins = 0,
    int gems = 0,
    int vipDays = 0,
    int? productId,
    int rentalDays = 0,
    String message = '',
  }) async {
    final res = await _api.post('/api/admin/gifts', body: {
      'user_id': userId,
      'coins': coins,
      'gems': gems,
      'vip_days': vipDays,
      'product_id': productId,
      'rental_days': rentalDays,
      'message': message,
    });
    return await _api.parseJson(res);
  }

  Future<List<dynamic>> giftLog({int limit = 60}) async {
    final res = await _api.get('/api/admin/dashboard/gifts/log', query: {'limit': limit});
    final data = await _api.parseJson(res);
    return data['log'] as List? ?? [];
  }

  // ── المتجر / كتالوج الهدايا ──
  Future<List<dynamic>> storeCategories() async {
    final res = await _api.get('/api/admin/store/categories');
    final data = await _api.parseJson(res);
    return data['categories'] as List? ?? [];
  }

  Future<List<dynamic>> storeProducts({String? category}) async {
    final res = await _api.get('/api/admin/store/products',
        query: category != null ? {'category': category} : null);
    final data = await _api.parseJson(res);
    return data['products'] as List? ?? [];
  }

  Future<void> createProduct(Map<String, dynamic> body) async {
    final res = await _api.post('/api/admin/store/products', body: body);
    await _api.parseJson(res);
  }

  Future<void> updateProduct(int id, Map<String, dynamic> body) async {
    final res = await _api.put('/api/admin/store/products/$id', body: body);
    await _api.parseJson(res);
  }

  Future<void> deleteProduct(int id) async {
    final res = await _api.delete('/api/admin/store/products/$id');
    await _api.parseJson(res);
  }

  // ── التبليغات والمحظورون ──
  Future<List<dynamic>> chatReports({String status = 'pending'}) async {
    final res = await _api.get('/api/admin/chat/reports', query: {'status': status});
    final data = await _api.parseJson(res);
    return data['reports'] as List? ?? [];
  }

  Future<void> resolveReport(int id, {required String action, int muteDays = 0, String notes = ''}) async {
    final res = await _api.post('/api/admin/chat/reports/$id/resolve',
        body: {'action': action, 'muteDays': muteDays, 'notes': notes});
    await _api.parseJson(res);
  }

  Future<List<dynamic>> bannedUsers() async {
    final res = await _api.get('/api/admin/chat/banned');
    final data = await _api.parseJson(res);
    return data['users'] as List? ?? [];
  }

  Future<void> unbanChatUser(int userId) async {
    final res = await _api.post('/api/admin/chat/banned/$userId/unban');
    await _api.parseJson(res);
  }

  // ── المتصلون الآن ──
  Future<List<dynamic>> onlinePlayers() async {
    final res = await _api.get('/api/admin/online');
    final data = await _api.parseJson(res);
    return data['players'] as List? ?? [];
  }
}

final adminApiProvider = Provider<AdminApi>((ref) {
  return AdminApi(ref.read(apiClientProvider));
});

// ── إشعارات الإدارة العامة (تظهر لكل اللاعبين) ──────────────
class AdminNotice {
  const AdminNotice({required this.message, required this.kind, required this.level});
  final String message;
  final String kind; // 'announcement' | 'warning'
  final String level; // 'info' | 'maintenance'
}

class AdminNoticeController extends Notifier<AdminNotice?> {
  @override
  AdminNotice? build() => null;

  void showAnnouncement(String message, String level) {
    if (message.trim().isEmpty) return;
    state = AdminNotice(message: message, kind: 'announcement', level: level);
  }

  void showWarning(String message) {
    if (message.trim().isEmpty) return;
    state = AdminNotice(message: message, kind: 'warning', level: 'warning');
  }

  void dismiss() => state = null;
}

final adminNoticeProvider =
    NotifierProvider<AdminNoticeController, AdminNotice?>(AdminNoticeController.new);

void wireAdminListeners(WidgetRef ref) {
  final socket = ref.read(socketServiceProvider);
  socket.on<Map<String, dynamic>>('admin_announcement').listen((d) {
    ref.read(adminNoticeProvider.notifier).showAnnouncement(
          d['message']?.toString() ?? '',
          d['level']?.toString() ?? 'info',
        );
  });
  socket.on<Map<String, dynamic>>('admin_warning').listen((d) {
    ref.read(adminNoticeProvider.notifier).showWarning(d['message']?.toString() ?? '');
  });
}

/// طبقة عرض إشعارات الإدارة فوق التطبيق كاملاً.
class AdminNoticeOverlay extends ConsumerWidget {
  const AdminNoticeOverlay({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notice = ref.watch(adminNoticeProvider);
    return Stack(
      children: [
        child,
        if (notice != null)
          Positioned(
            top: MediaQuery.paddingOf(context).top + 8,
            left: 12,
            right: 12,
            child: _AdminNoticeBanner(
              notice: notice,
              onDismiss: () => ref.read(adminNoticeProvider.notifier).dismiss(),
            ),
          ),
      ],
    );
  }
}

class _AdminNoticeBanner extends StatelessWidget {
  const _AdminNoticeBanner({required this.notice, required this.onDismiss});
  final AdminNotice notice;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final isWarn = notice.kind == 'warning';
    final isMaint = notice.level == 'maintenance';
    final accent = isWarn
        ? const Color(0xFFEF4444)
        : isMaint
            ? const Color(0xFFF59E0B)
            : const Color(0xFFD4AF37);
    final title = isWarn
        ? 'تحذير من الإدارة'
        : isMaint
            ? 'وضع الصيانة'
            : 'إعلان عام';
    final icon = isWarn
        ? Icons.warning_amber_rounded
        : isMaint
            ? Icons.build_circle_outlined
            : Icons.campaign_rounded;

    return Material(
      color: Colors.transparent,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1A1206), Color(0xFF120C0C)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: accent, width: 1.6),
            boxShadow: [BoxShadow(color: accent.withValues(alpha: 0.4), blurRadius: 16)],
          ),
          child: Row(
            children: [
              Icon(icon, color: accent, size: 26),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: TextStyle(color: accent, fontWeight: FontWeight.w900, fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      notice.message,
                      style: const TextStyle(color: Color(0xFFF5F5F5), fontSize: 13, height: 1.3),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                onPressed: onDismiss,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
