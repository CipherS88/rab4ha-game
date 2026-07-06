import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rab4ha/core/network/api_client.dart';
import 'package:rab4ha/core/network/socket_service.dart';
import 'package:rab4ha/features/game/game_controller.dart';

import 'recording_socket.dart';

/// حالة لعبة جاهزة لمعالج القيد (المُعترض = مقعد 2).
Map<String, dynamic> qaidGameState({
  bool withSawaObjection = false,
  String bidType = 'HAKAM',
  List<dynamic>? trickHistory,
}) {
  final gs = <String, dynamic>{
    'phase': 'PLAYING',
    'bid': {'type': bidType},
    'qaid_session': {'seat': 2},
    'qaid_reasons': ['قاطع', 'ما كبر بالحكم'],
    'dealer_idx': 3,
    'turn': 2,
    'trick_history': trickHistory ??
        [
          [
            {'player': 0, 'card': {'suit': 'SPADES', 'rank': 'A'}},
            {'player': 1, 'card': {'suit': 'SPADES', 'rank': '7'}},
          ],
        ],
    'current_trick': <dynamic>[],
    'all_hands': [
      {'seat': 0, 'cards': [{'suit': 'HEARTS', 'rank': '8'}], 'name': 'شريك'},
      {
        'seat': 1,
        'cards': [
          {'suit': 'CLUBS', 'rank': 'K'},
          {'suit': 'CLUBS', 'rank': 'Q'},
        ],
        'name': 'خصم 1',
      },
      {'seat': 2, 'cards': <dynamic>[], 'name': 'أنا'},
      {'seat': 3, 'cards': [{'suit': 'DIAMONDS', 'rank': '10'}], 'name': 'خصم 2'},
    ],
    'card_back_url': '/cards/back.png',
  };
  if (withSawaObjection) {
    gs['sawa_declaration'] = {
      'seat': 0,
      'team': 1,
      'phase': 'objection',
      'objection_deadline': DateTime.now().millisecondsSinceEpoch + 60000,
      'declared_at': DateTime.now().millisecondsSinceEpoch,
    };
    gs['sawa_hands'] = [
      {
        'seat': 0,
        'cards': [{'suit': 'HEARTS', 'rank': 'A'}],
        'name': 'المُعلِن',
      },
    ];
  }
  return gs;
}

Map<String, dynamic> playingGameState({
  required String bidType,
  required int mySeat,
  required int turn,
  List<dynamic>? currentTrick,
}) {
  return {
    'phase': 'PLAYING',
    'bid': {'type': bidType},
    'turn': turn,
    'dealer_idx': 3,
    'current_trick': currentTrick ?? [],
    'trick_history': [],
    'my_hand': [
      {'suit': 'HEARTS', 'rank': 'A'},
      {'suit': 'SPADES', 'rank': 'K'},
    ],
    'all_hands': [
      {'seat': mySeat, 'cards': [], 'name': 'أنا'},
    ],
    'card_back_url': '/cards/back.png',
  };
}

Map<String, dynamic> scoreSummaryAfterQaid() {
  return {
    'phase': 'SCORE_SUMMARY',
    'turn': -1,
    'bid': {'type': 'HAKAM'},
    'qaid_session': null,
    'summary_data': {
      'is_qaid': true,
      'is_qaid_normal': true,
      'final': {'1': 8, '2': 0},
      'raw': {'1': 8, '2': 0},
    },
    'card_back_url': '/cards/back.png',
  };
}

ProviderContainer createQaidTestContainer(RecordingSocketService socket) {
  return ProviderContainer(
    overrides: [
      socketServiceProvider.overrideWith((_) => socket),
      apiClientProvider.overrideWith(
        (_) => ApiClient(tokenReader: () => null, onUnauthorized: () {}),
      ),
    ],
  );
}

Widget wrapQaidTest(ProviderContainer container, Widget child) {
  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          body: SizedBox(width: 480, height: 1200, child: child),
        ),
      ),
    ),
  );
}

void ignoreLayoutOverflowInTests() {
  final previous = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.exceptionAsString().contains('overflowed')) return;
    previous?.call(details);
  };
}

Future<void> flushPendingTimers(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 1));
}

Future<void> pumpQaid(WidgetTester tester, Widget widget) async {
  await tester.pumpWidget(widget);
  await tester.pump();
  final ex = tester.takeException();
  if (ex != null && !ex.toString().contains('overflowed')) {
    throw ex;
  }
}

void seedQaidController(
  ProviderContainer container, {
  bool withSawa = false,
  String bidType = 'HAKAM',
  int step = 1,
  String? reason,
  List<Map<String, dynamic>> cards = const [],
  List<dynamic>? trickHistory,
}) {
  container.read(gameControllerProvider.notifier).state = GameState(
    mySeat: 2,
    gameState: qaidGameState(
      withSawaObjection: withSawa,
      bidType: bidType,
      trickHistory: trickHistory,
    ),
    qaidModalOpen: true,
    qaidStep: step,
    qaidReason: reason,
    qaidCards: cards,
  );
}

/// مرآة منطق ظهور زر الإكة في الواجهة.
class EkkahVisibilityProbe extends ConsumerWidget {
  const EkkahVisibilityProbe({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final game = ref.watch(gameControllerProvider);
    if (!game.canDeclareEkkah) {
      return const SizedBox(key: Key('ekkah_hidden'));
    }
    return TextButton(
      key: const Key('ekkah_btn'),
      onPressed: () => ref.read(gameControllerProvider.notifier).toggleEkkah(),
      child: const Text('إكة'),
    );
  }
}

/// مرآة شرط عرض النشرة في GameScreen.
class ScoreboardProbe extends StatelessWidget {
  const ScoreboardProbe({super.key, required this.game});
  final GameState game;

  @override
  Widget build(BuildContext context) {
    final gs = game.gs;
    if (gs == null) return const SizedBox.shrink();
    if (gs['phase'] == 'SCORE_SUMMARY' && gs['summary_data'] != null) {
      return const Text('النشرة', key: Key('scoreboard'));
    }
    return const SizedBox(key: Key('no_scoreboard'));
  }
}

bool containerHasAllyGlow(WidgetTester tester) {
  return tester.widgetList<Container>(find.byType(Container)).any((w) {
    final shadows = w.decoration is BoxDecoration
        ? (w.decoration! as BoxDecoration).boxShadow
        : null;
    if (shadows == null) return false;
    return shadows.any(
      (s) => s.color.value == const Color(0xFF38BDF8).withValues(alpha: 0.5).value,
    );
  });
}

List<double> trickCardRightOffsets(WidgetTester tester) {
  final stacks = tester.widgetList<Stack>(
    find.descendant(
      of: find.byType(SingleChildScrollView),
      matching: find.byType(Stack),
    ),
  );
  if (stacks.isEmpty) return [];
  final stackFinder = find.descendant(
    of: find.byType(SingleChildScrollView),
    matching: find.byType(Stack),
  ).first;
  return tester
      .widgetList<Positioned>(
        find.descendant(of: stackFinder, matching: find.byType(Positioned)),
      )
      .map((p) => p.right ?? 0)
      .toList();
}

Finder nextStepButton(WidgetTester tester, String labelPart) {
  return find.ancestor(
    of: find.textContaining(labelPart),
    matching: find.byType(TextButton),
  );
}

String cardKey(Map<String, dynamic> c) => '${c['suit']}:${c['rank']}';
