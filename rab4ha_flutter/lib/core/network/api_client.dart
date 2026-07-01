import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../logging/app_logger.dart';

typedef TokenReader = String? Function();
typedef OnUnauthorized = void Function();

class ApiClient {
  ApiClient({
    required this.tokenReader,
    required this.onUnauthorized,
  }) : _dio = Dio(BaseOptions(
          baseUrl: AppConfig.baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = tokenReader();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        AppLogger.instance.debug('HTTP ${options.method} ${options.uri}');
        handler.next(options);
      },
      onError: (e, handler) {
        final path = e.requestOptions.path;
        final isAuthAttempt =
            path.contains('/auth/login') || path.contains('/auth/register');
        if (e.response?.statusCode == 401 && !isAuthAttempt) {
          onUnauthorized();
        }
        AppLogger.instance.error('HTTP error', e.message, e.stackTrace);
        handler.next(e);
      },
    ));
  }

  final Dio _dio;
  final TokenReader tokenReader;
  final OnUnauthorized onUnauthorized;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? query}) =>
      _dio.get<T>(path, queryParameters: query);

  Future<Response<T>> post<T>(String path, {Object? body}) =>
      _dio.post<T>(path, data: _encodeBody(body));

  Future<Response<T>> patch<T>(String path, {Object? body}) =>
      _dio.patch<T>(path, data: _encodeBody(body));

  Future<Response<T>> put<T>(String path, {Object? body}) =>
      _dio.put<T>(path, data: _encodeBody(body));

  Future<Response<T>> delete<T>(String path) => _dio.delete<T>(path);

  static Object? _encodeBody(Object? body) {
    if (body == null) return null;
    if (body is String) return body;
    return jsonEncode(body);
  }

  Future<Map<String, dynamic>> parseJson(Response<dynamic> res,
      {String fallback = 'خطأ من السيرفر'}) async {
    final ct = res.headers.value('content-type') ?? '';
    if (!ct.contains('application/json')) {
      if (res.statusCode == 404) {
        throw ApiException('السيرفر قديم — أعد تشغيله');
      }
      throw ApiException('استجابة غير متوقعة من السيرفر');
    }
    final data = res.data is Map<String, dynamic>
        ? res.data as Map<String, dynamic>
        : jsonDecode(res.data as String) as Map<String, dynamic>;
    if (res.statusCode != null && res.statusCode! >= 400) {
      throw ApiException(data['error']?.toString() ?? fallback);
    }
    return data;
  }

  String assetUrl(String path) {
    if (path.startsWith('http')) return path;
    final base = AppConfig.baseUrl;
    if (base.isEmpty) return path.startsWith('/') ? path : '/$path';
    final normalized =
        base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    return '$normalized${path.startsWith('/') ? path : '/$path'}';
  }

  static ApiException mapError(Object e, {String fallback = 'خطأ في الاتصال'}) {
    if (e is ApiException) return e;
    if (e is DioException) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout) {
        return ApiException(
          'تعذّر الاتصال بالسيرفر — شغّل npm start ثم افتح http://localhost:3000/app/',
        );
      }
      final data = e.response?.data;
      if (data is Map && data['error'] != null) {
        return ApiException(data['error'].toString());
      }
      if (e.response?.statusCode == 401) {
        return ApiException('فشل تسجيل الدخول — تحقق من المعرّف وكلمة المرور');
      }
    }
    return ApiException(e.toString().replaceFirst('ApiException: ', ''));
  }
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

final apiClientProvider = Provider<ApiClient>((ref) {
  throw UnimplementedError('apiClientProvider must be overridden in main');
});
