import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_provider.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/ban_screen.dart';
import '../../features/bag/bag_screen.dart';
import '../../features/chat/chat_screen.dart';
import '../../features/friends/friends_screen.dart';
import '../../features/game/game_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/leaderboards/leaderboards_screen.dart';
import '../../features/loading/loading_screen.dart';
import '../../features/matchmaking/matchmaking_screen.dart';
import '../../features/name/name_screen.dart';
import '../../features/ranked/ranked_screen.dart';
import '../../features/sessions/sessions_screen.dart';
import '../../features/sessions/session_lobby_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/store/store_screen.dart';
import '../../features/tournaments/tournament_detail_screen.dart';
import '../../features/tournaments/tournaments_screen.dart';
import '../../shared/widgets/app_shell.dart';

/// يُحدّث GoRouter عند تغيّر الجلسة دون إعادة إنشاء الموجّه (يمنع dispose أثناء login).
class RouterRefresh extends ChangeNotifier {
  RouterRefresh(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

final routerRefreshProvider = Provider<RouterRefresh>((ref) {
  final refresh = RouterRefresh(ref);
  ref.onDispose(refresh.dispose);
  return refresh;
});

String? _authRedirect(Ref ref, GoRouterState state) {
  final auth = ref.read(authProvider);
  final loc = state.matchedLocation;

  if (auth.initializing) {
    return loc == '/loading' ? null : '/loading';
  }

  if (loc == '/loading') {
    return auth.isLoggedIn ? '/home' : '/login';
  }

  if (auth.isBanned) {
    return loc == '/ban' ? null : '/ban';
  }
  if (loc == '/ban') return '/login';

  const public = {'/login', '/name', '/ban'};
  if (!auth.isLoggedIn && !public.contains(loc)) return '/login';
  if (auth.isLoggedIn && loc == '/login') return '/home';
  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ref.watch(routerRefreshProvider);

  return GoRouter(
    initialLocation: '/loading',
    refreshListenable: refresh,
    redirect: (context, state) => _authRedirect(ref, state),
    routes: [
      GoRoute(path: '/loading', builder: (_, s) => const LoadingScreen()),
      GoRoute(path: '/login', builder: (_, s) => const LoginScreen()),
      GoRoute(
        path: '/ban',
        builder: (_, s) => BanScreen(reason: ref.read(authProvider).banReason ?? 'حسابك محظور'),
      ),
      GoRoute(path: '/name', builder: (_, s) => const NameScreen()),
      GoRoute(path: '/settings', builder: (_, s) => const SettingsScreen()),
      GoRoute(path: '/ranked', builder: (_, s) => const RankedScreen()),
      GoRoute(path: '/sessions', builder: (_, s) => const SessionsScreen()),
      GoRoute(
        path: '/sessions/:id',
        builder: (_, s) => SessionLobbyScreen(sessionId: s.pathParameters['id']!),
      ),
      GoRoute(path: '/tournaments', builder: (_, s) => const TournamentsScreen()),
      GoRoute(
        path: '/tournaments/:id',
        builder: (_, s) => TournamentDetailScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(path: '/leaderboards', builder: (_, s) => const LeaderboardsScreen()),
      GoRoute(path: '/matchmaking', builder: (_, s) => const MatchmakingScreen()),
      GoRoute(path: '/game', builder: (_, s) => const GameScreen()),
      ShellRoute(
        builder: (_, s, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, s) => const HomeScreen()),
          GoRoute(path: '/store', builder: (_, s) => const StoreScreen()),
          GoRoute(path: '/friends', builder: (_, s) => const FriendsScreen()),
          GoRoute(path: '/bag', builder: (_, s) => const BagScreen()),
          GoRoute(path: '/chat', builder: (_, s) => const ChatScreen()),
        ],
      ),
    ],
  );
});

bool showBottomNav(String location) {
  const tabs = ['/home', '/store', '/friends', '/bag', '/chat'];
  return tabs.contains(location);
}
