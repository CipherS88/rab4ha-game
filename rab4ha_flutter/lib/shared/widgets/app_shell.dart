import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../features/home/home_theme.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loc = GoRouterState.of(context).uri.path;
    final showNav = showBottomNav(loc);
    return Scaffold(
      backgroundColor: HomeBlackGold.bg,
      body: child,
      bottomNavigationBar: showNav
          ? NavigationBarTheme(
              data: NavigationBarThemeData(
                backgroundColor: const Color(0xFF0B0B0B),
                indicatorColor: HomeBlackGold.gold.withValues(alpha: 0.18),
                height: 68,
                labelTextStyle: WidgetStateProperty.resolveWith((states) {
                  final selected = states.contains(WidgetState.selected);
                  return TextStyle(
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? HomeBlackGold.goldLight : HomeBlackGold.textMuted,
                  );
                }),
                iconTheme: WidgetStateProperty.resolveWith((states) {
                  final selected = states.contains(WidgetState.selected);
                  return IconThemeData(
                    color: selected ? HomeBlackGold.goldLight : HomeBlackGold.textMuted,
                    size: 22,
                  );
                }),
              ),
              child: NavigationBar(
                selectedIndex: _indexFor(loc),
                onDestinationSelected: (i) => context.go(_pathFor(i)),
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.home_outlined),
                    selectedIcon: Icon(Icons.home),
                    label: 'الرئيسية',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.store_outlined),
                    selectedIcon: Icon(Icons.store),
                    label: 'المتجر',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.people_outline),
                    selectedIcon: Icon(Icons.people),
                    label: 'الأصدقاء',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.backpack_outlined),
                    selectedIcon: Icon(Icons.backpack),
                    label: 'الحقيبة',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.chat_outlined),
                    selectedIcon: Icon(Icons.chat),
                    label: 'الشات',
                  ),
                ],
              ),
            )
          : null,
    );
  }

  int _indexFor(String path) => switch (path) {
        '/store' => 1,
        '/friends' => 2,
        '/bag' => 3,
        '/chat' => 4,
        _ => 0,
      };

  String _pathFor(int i) => switch (i) {
        1 => '/store',
        2 => '/friends',
        3 => '/bag',
        4 => '/chat',
        _ => '/home',
      };
}
