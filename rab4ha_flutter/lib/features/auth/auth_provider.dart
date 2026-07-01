import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/app_config.dart';
import '../../core/logging/app_logger.dart';
import '../../core/network/api_client.dart';
import '../../shared/models/user_models.dart';

class AuthState {
  const AuthState({
    this.token,
    this.user,
    this.initializing = false,
    this.loading = false,
    this.error,
    this.banReason,
  });
  final String? token;
  final AuthUser? user;
  /// تحميل أولي للجلسة المحفوظة فقط — يُستخدم في redirect إلى /loading
  final bool initializing;
  /// جاري login/register — يبقى المستخدم على شاشة الدخول
  final bool loading;
  final String? error;
  final String? banReason;

  bool get isLoggedIn => token != null && token!.isNotEmpty;
  bool get isBanned => banReason != null && banReason!.isNotEmpty;

  AuthState copyWith({
    String? token,
    AuthUser? user,
    bool? initializing,
    bool? loading,
    String? error,
    String? banReason,
    bool clearError = false,
    bool clearBan = false,
  }) =>
      AuthState(
        token: token ?? this.token,
        user: user ?? this.user,
        initializing: initializing ?? this.initializing,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        banReason: clearBan ? null : (banReason ?? this.banReason),
      );
}

class AuthNotifier extends Notifier<AuthState> {
  late ApiClient _api;
  SharedPreferences? _prefs;
  var _bootstrapped = false;

  @override
  AuthState build() {
    _api = ref.read(apiClientProvider);
    if (!_bootstrapped) {
      _bootstrapped = true;
      Future.microtask(_loadStored);
    }
    return const AuthState(initializing: true);
  }

  void clearError() {
    if (state.error != null) {
      state = state.copyWith(clearError: true);
    }
  }

  Future<void> _loadStored() async {
    _prefs = await SharedPreferences.getInstance();
    final token = _prefs!.getString(AppConfig.authTokenKey);
    AuthUser? user;
    final raw = _prefs!.getString(AppConfig.authUserKey);
    if (raw != null) {
      try {
        user = AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } catch (e) {
        AppLogger.instance.warn('Bad cached user', e);
      }
    }
    state = AuthState(token: token, user: user, initializing: false);
    if (token != null) {
      try {
        await refreshMe();
      } catch (e) {
        final msg = e is ApiException ? e.message : e.toString();
        if (msg.contains('محظور') || msg.toLowerCase().contains('ban')) {
          await _prefs!.remove(AppConfig.authTokenKey);
          await _prefs!.remove(AppConfig.authUserKey);
          state = AuthState(banReason: msg, initializing: false);
        } else {
          await logout(silent: true);
        }
      }
    }
  }

  void clearBan() {
    state = const AuthState();
  }

  Future<void> _persist(String token, AuthUser user) async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(AppConfig.authTokenKey, token);
    await _prefs!.setString(AppConfig.authUserKey, jsonEncode(user.toJson()));
    state = AuthState(token: token, user: user, loading: false);
  }

  Future<void> login(String loginId, String password) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final res = await _api.post('/api/auth/login', body: {
        'login_id': loginId.trim(),
        'password': password,
      });
      final data = await _api.parseJson(res, fallback: 'فشل تسجيل الدخول');
      final user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
      await _persist(data['token'] as String, user);
      ref.read(profileProvider.notifier).setFromAuth(data);
      AppLogger.instance.info('Login OK', user.playerCode);
    } on DioException catch (e) {
      final err = ApiClient.mapError(e, fallback: 'فشل تسجيل الدخول');
      state = AuthState(loading: false, error: err.message);
      throw err;
    } catch (e) {
      final msg = e is ApiException ? e.message : e.toString();
      state = AuthState(loading: false, error: msg);
      rethrow;
    }
  }

  Future<Map<String, dynamic>> register({
    required String displayName,
    required String password,
    required String passwordConfirm,
  }) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final res = await _api.post('/api/auth/register', body: {
        'display_name': displayName.trim(),
        'password': password,
        'password_confirm': passwordConfirm,
      });
      final data = await _api.parseJson(res, fallback: 'فشل إنشاء الحساب');
      final user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
      await _persist(data['token'] as String, user);
      ref.read(profileProvider.notifier).setFromAuth(data);
      return data;
    } on DioException catch (e) {
      final err = ApiClient.mapError(e, fallback: 'فشل إنشاء الحساب');
      state = AuthState(loading: false, error: err.message);
      throw err;
    } catch (e) {
      final msg = e is ApiException ? e.message : e.toString();
      state = AuthState(loading: false, error: msg);
      rethrow;
    }
  }

  Future<Map<String, dynamic>> refreshMe() async {
    final res = await _api.get('/api/auth/me');
    if (res.statusCode != 200) throw ApiException('فشل تحميل الحساب');
    final data = await _api.parseJson(res);
    if (data['ban']?['banned'] == true) {
      final reason = data['ban']?['reason']?.toString() ?? 'حسابك محظور';
      state = AuthState(banReason: reason, loading: false);
      throw ApiException(reason);
    }
    final user = AuthUser.fromJson(data['user'] as Map<String, dynamic>);
    final token = state.token ?? _prefs?.getString(AppConfig.authTokenKey);
    if (token != null) {
      state = AuthState(token: token, user: user, loading: false);
      await _prefs?.setString(AppConfig.authTokenKey, token);
      await _prefs?.setString(AppConfig.authUserKey, jsonEncode(user.toJson()));
    }
    ref.read(profileProvider.notifier).setFromAuth(data);
    return data;
  }

  Future<void> logout({bool silent = false}) async {
    if (!silent) {
      try {
        await _api.post('/api/auth/logout');
      } catch (_) {}
    }
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.remove(AppConfig.authTokenKey);
    await _prefs!.remove(AppConfig.authUserKey);
    ref.read(profileProvider.notifier).clear();
    state = const AuthState();
    AppLogger.instance.info('Logged out');
  }

  void onUnauthorized() {
    logout(silent: true);
  }
}

class ProfileNotifier extends Notifier<PlayerProfile?> {
  @override
  PlayerProfile? build() => null;

  void setFromAuth(Map<String, dynamic> data) {
    if (data['profile'] != null) {
      state = PlayerProfile.fromJson(data['profile'] as Map<String, dynamic>);
    }
  }

  void clear() => state = null;

  Future<PlayerProfile> fetch() async {
    if (!ref.read(authProvider).isLoggedIn) throw ApiException('غير مسجل');
    final data = await ref.read(authProvider.notifier).refreshMe();
    if (data['profile'] != null) {
      state = PlayerProfile.fromJson(data['profile'] as Map<String, dynamic>);
    }
    return state!;
  }

  Future<PlayerProfile> updateName(String name) async {
    final api = ref.read(apiClientProvider);
    final res = await api.patch('/api/auth/profile', body: {'display_name': name});
    final data = await api.parseJson(res, fallback: 'فشل تحديث الاسم');
    state = PlayerProfile.fromJson(data['profile'] as Map<String, dynamic>);
    return state!;
  }

  Future<PlayerProfile> updateAvatar(String dataUrl) async {
    final api = ref.read(apiClientProvider);
    final res = await api.post('/api/auth/profile/avatar', body: {'image': dataUrl});
    final data = await api.parseJson(res, fallback: 'فشل رفع الصورة');
    state = PlayerProfile.fromJson(data['profile'] as Map<String, dynamic>);
    return state!;
  }

  void update(PlayerProfile p) => state = p;
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
final profileProvider = NotifierProvider<ProfileNotifier, PlayerProfile?>(ProfileNotifier.new);
