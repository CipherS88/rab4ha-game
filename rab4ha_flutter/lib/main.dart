import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/app_config.dart';
import 'core/logging/app_logger.dart';
import 'core/network/api_client.dart';
import 'core/network/socket_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/rab4ha_theme.dart';
import 'features/admin/admin_provider.dart';
import 'features/auth/auth_provider.dart';
import 'features/game/game_layout_provider.dart';
import 'features/gifts/gift_controller.dart';
import 'features/game/game_controller.dart';
import 'shared/widgets/buttons.dart';

class Rab4haApp extends ConsumerStatefulWidget {
  const Rab4haApp({super.key});

  @override
  ConsumerState<Rab4haApp> createState() => _Rab4haAppState();
}

class _Rab4haAppState extends ConsumerState<Rab4haApp> {
  var _giftsWired = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(socketServiceProvider).connect();
      ref.read(gameLayoutProvider.notifier).load();
    });
  }

  void _ensureGiftListeners() {
    if (_giftsWired) return;
    if (ref.read(authProvider).isLoggedIn) {
      _giftsWired = true;
      wireGiftListeners(ref);
      wireAdminListeners(ref);
    }
  }

  @override
  Widget build(BuildContext context) {
    _ensureGiftListeners();
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'ربعها - بلوت',
      debugShowCheckedModeBanner: false,
      theme: buildRab4haTheme(),
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: AdminNoticeOverlay(
          child: GiftReceiveOverlay(
            child: HomeToastOverlay(child: child ?? const SizedBox.shrink()),
          ),
        ),
      ),
      routerConfig: router,
    );
  }
}

void main() {
  AppLogger.instance.info('Rab4ha start', AppConfig.flavorName);
  runApp(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWith((ref) {
          final auth = ref.read(authProvider.notifier);
          return ApiClient(
            tokenReader: () => ref.read(authProvider).token,
            onUnauthorized: auth.onUnauthorized,
          );
        }),
        socketServiceProvider.overrideWith((ref) {
          late final SocketService socketService;
          socketService = SocketService(
            onConnect: () {
              ref.read(gameControllerProvider.notifier).onSocketConnect();
              final token = ref.read(authProvider).token;
              if (token != null) {
                socketService.emitChatAuth(token, (data) {
                  ref.read(giftControllerProvider.notifier).handleChatAuthResponse(data);
                });
              }
            },
            onDisconnect: () {},
          );
          ref.onDispose(socketService.dispose);
          return socketService;
        }),
      ],
      child: const Rab4haApp(),
    ),
  );
}
