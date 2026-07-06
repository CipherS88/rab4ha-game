import 'package:flutter/foundation.dart';

enum AppFlavor { dev, staging, prod }

class AppConfig {
  AppConfig._();

  static const flavorName = String.fromEnvironment('FLAVOR', defaultValue: 'dev');

  static AppFlavor get flavor => switch (flavorName) {
        'staging' => AppFlavor.staging,
        'prod' => AppFlavor.prod,
        _ => AppFlavor.dev,
      };

  /// override صريح: `--dart-define=API_BASE_URL=http://localhost:3000`
  static const apiBaseOverride = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (apiBaseOverride.isNotEmpty) return apiBaseOverride;

    if (kIsWeb) {
      final uri = Uri.base;
      // مُقدَّم من Express على /app/ — نفس المنفذ 3000
      if (uri.port == 3000 || (uri.port == 80 && uri.host == 'localhost')) {
        return uri.origin;
      }
      // flutter run -d chrome على منفذ آخر → API على 3000 (يتطلب CORS على السيرفر)
      return 'http://localhost:3000';
    }

    return switch (flavor) {
      AppFlavor.dev => 'http://localhost:3000',
      AppFlavor.staging => 'https://staging.rab4ha.example',
      AppFlavor.prod => 'https://api.rab4ha.example',
    };
  }

  static bool get isDev => flavor == AppFlavor.dev;

  /// تعطيل مؤقت لزر/صفحة البطولات — غيّره إلى true عند التفعيل.
  static const tournamentsEnabled = false;

  static const authTokenKey = 'baloot_auth_token';
  static const authUserKey = 'baloot_user';
  static const playerNameKey = 'baloot_player_name';
  static const activeGameKey = 'baloot_active_game';
}
