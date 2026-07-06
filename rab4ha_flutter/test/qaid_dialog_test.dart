import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rab4ha/core/network/api_client.dart';
import 'package:rab4ha/core/network/socket_service.dart';
import 'package:rab4ha/features/game/game_controller.dart';
import 'package:rab4ha/features/game/game_overlays.dart';
import 'package:rab4ha/features/game/qaid_wizard.dart';

import 'helpers/recording_socket.dart';

/// حالة لعبة جاهزة لمعالج القيد (المُعترض = مقعد 2).
Map<String, dynamic> qaidGameState({
  bool withSawaObjection = false,
  String bidType = 'HAKAM',
}) {
  final gs = <String, dynamic>{
    'phase': 'PLAYING',
    'bid': {'type': bidType},
    'qaid_session': {'seat': 2},
    'qaid_reasons': ['قاطع', 'ما كبر بالحكم'],
    'dealer_idx': 3,
    'trick_history': [
      [
        {'player': 0, 'card': {'suit': 'SPADES', 'rank': 'A'}},
        {'player': 1, 'card': {'suit': 'SPADES', 'rank': '7'}},
      ],
    ],
    'current_trick': <dynamic>[],
    'all_hands': [
      {'seat': 0, 'cards': [{'suit': 'HEARTS', 'rank': '8'}], 'name': 'لاعب 0'},
      {'seat': 1, 'cards': <dynamic>[], 'name': 'لاعب 1'},
      {'seat': 2, 'cards': <dynamic>[], 'name': 'لاعب 2'},
      {'seat': 3, 'cards': <dynamic>[], 'name': 'لاعب 3'},
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

Map<String, dynamic> sawaObjectionGameState() {
  return {
    'phase': 'PLAYING',
    'sawa_declaration': {
      'seat': 0,
      'team': 1,
      'phase': 'objection',
      'objection_deadline': DateTime.now().millisecondsSinceEpoch + 60000,
      'declared_at': DateTime.now().millisecondsSinceEpoch,
    },
    'sawa_hands': [
      {
        'seat': 0,
        'cards': [{'suit': 'HEARTS', 'rank': 'A'}],
        'name': 'المُعلِن',
      },
    ],
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
          body: SizedBox(width: 900, height: 1200, child: child),
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
  int step = 1,
  String? reason,
  List<Map<String, dynamic>> cards = const [],
}) {
  container.read(gameControllerProvider.notifier).state = GameState(
    mySeat: 2,
    gameState: qaidGameState(withSawaObjection: withSawa),
    qaidModalOpen: true,
    qaidStep: step,
    qaidReason: reason,
    qaidCards: cards,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(ignoreLayoutOverflowInTests);

  group('قيد السوا — SawaSpreadsOverlay', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
      container.read(gameControllerProvider.notifier).state = GameState(
        mySeat: 2,
        gameState: sawaObjectionGameState(),
      );
    });

    tearDown(() => container.dispose());

    testWidgets('يظهر زر قيد أثناء مؤقت الاعتراض', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        wrapQaidTest(
          container,
          SawaSpreadsOverlay(game: container.read(gameControllerProvider)),
        ),
      );
      await tester.pump();

      expect(find.text('سوا — فرصة اعتراض'), findsOneWidget);
      expect(find.text('قيد'), findsOneWidget);
    });

    testWidgets('الضغط على قيد يُرسل qaid_start للسيرفر', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        wrapQaidTest(
          container,
          SawaSpreadsOverlay(game: container.read(gameControllerProvider)),
        ),
      );
      await tester.pump();

      final qaidBtn = find.widgetWithText(TextButton, 'قيد');
      await tester.ensureVisible(qaidBtn);
      await tester.tap(qaidBtn);
      await tester.pump();

      expect(socket.lastPayload('qaid_start'), isNotNull);
    });

    test('qaidStart أثناء اعتراض السوا يُرسل qaid_start', () {
      container.read(gameControllerProvider.notifier).qaidStart();
      expect(socket.lastPayload('qaid_start'), isNotNull);
    });
  });

  group('QaidWizardOverlay — قيد سوا غلط', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
      seedQaidController(container, withSawa: true);
    });

    tearDown(() => container.dispose());

    testWidgets('يظهر سبب سوا غلط عند وجود إعلان سوا', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      expect(find.text('سوا غلط'), findsOneWidget);
    });

    testWidgets('إرسال قيد سوا غلط — مباشرة بدون التالي', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      await tester.tap(find.text('سوا غلط'));
      await tester.pump();
      tester.takeException();

      expect(find.text('التالي'), findsNothing);

      await tester.tap(find.text('إرسال'));
      await tester.pump();

      final submit = socket.lastPayload('qaid_submit');
      expect(submit, isNotNull);
      expect(submit!['reason'], 'sawa_ghalat');
      expect(submit['cards'], isEmpty);
      expect(container.read(gameControllerProvider).qaidModalOpen, isFalse);
    });

    test('قيد سوا غلط — payload مكافئ sawa_qaid عبر qaid_submit', () {
      final ctrl = container.read(gameControllerProvider.notifier);
      ctrl.state = ctrl.state.copyWith(qaidReason: 'سوا غلط', qaidCards: const []);
      ctrl.qaidSubmit();
      final submit = socket.lastPayload('qaid_submit');
      expect(submit!['reason'], 'sawa_ghalat');
      expect(submit['cards'], isEmpty);
    });
  });

  group('QaidWizardOverlay — أسباب حسب الجولة', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
    });

    tearDown(() => container.dispose());

    testWidgets('صن — قاطع و سوا غلط فقط', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      seedQaidController(container, withSawa: true);
      container.read(gameControllerProvider.notifier).state =
          container.read(gameControllerProvider).copyWith(
                gameState: qaidGameState(withSawaObjection: true, bidType: 'SUN'),
              );

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      expect(find.text('صن — اختر سبب القيد'), findsOneWidget);
      expect(find.text('قاطع'), findsOneWidget);
      expect(find.text('سوا غلط'), findsOneWidget);
      expect(find.text('ما كبر بالحكم'), findsNothing);
      expect(find.text('إكة خاطئة'), findsNothing);
    });

    testWidgets('حكم — خمسة أسباب مع سوا', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      seedQaidController(container, withSawa: true);

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      expect(find.text('حكم — اختر سبب القيد'), findsOneWidget);
      expect(find.text('قاطع'), findsOneWidget);
      expect(find.text('ما كبر بالحكم'), findsOneWidget);
      expect(find.text('ما دق بالحكم'), findsOneWidget);
      expect(find.text('سوا غلط'), findsOneWidget);
      expect(find.text('إكة خاطئة'), findsOneWidget);
    });

    testWidgets('إكة خاطئة — إرسال مباشر', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      seedQaidController(container);

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      await tester.tap(find.text('إكة خاطئة'));
      await tester.pump();

      expect(find.text('التالي'), findsNothing);
      await tester.tap(find.text('إرسال'));
      await tester.pump();

      final submit = socket.lastPayload('qaid_submit');
      expect(submit!['reason'], 'wrong_ekkah');
      expect(submit['cards'], isEmpty);
    });
  });

  group('QaidWizardOverlay — قيد يدوي (قاطع)', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
      seedQaidController(container);
    });

    tearDown(() => container.dispose());

    testWidgets('اختيار السبب والكروت ثم الإرسال', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      expect(find.text('قاطع'), findsOneWidget);
      expect(find.text('ما كبر بالحكم'), findsOneWidget);

      await tester.tap(find.text('قاطع'));
      await tester.pump();
      tester.takeException();

      await tester.tap(find.text('التالي'));
      await flushPendingTimers(tester);
      tester.takeException();

      expect(find.textContaining('إثبات'), findsOneWidget);

      final cardTiles = find.descendant(
        of: find.byType(SingleChildScrollView),
        matching: find.byType(GestureDetector),
      );
      expect(cardTiles, findsWidgets);

      await tester.tap(cardTiles.at(0));
      await tester.pump();
      tester.takeException();
      await tester.tap(cardTiles.at(1));
      await tester.pump();
      tester.takeException();

      await tester.tap(find.textContaining('2/2'));
      await tester.pump();
      tester.takeException();

      await tester.tap(find.text('إرسال'));
      await tester.pump();

      final submit = socket.lastPayload('qaid_submit');
      expect(submit, isNotNull);
      expect(submit!['reason'], 'قاطع');
      expect(submit['cards'], isA<List>());
      expect((submit['cards'] as List).length, 2);
      final first = Map<String, dynamic>.from((submit['cards'] as List).first as Map);
      expect(first['suit'], isNotNull);
      expect(first['rank'], isNotNull);

      await flushPendingTimers(tester);
    });

    testWidgets('يمكن اختيار كروت الخصم من اليد', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final gs = qaidGameState();
      gs['trick_history'] = [];
      gs['all_hands'] = [
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
      ];
      container.read(gameControllerProvider.notifier).state = GameState(
        mySeat: 2,
        gameState: gs,
        qaidModalOpen: true,
        qaidStep: 2,
        qaidReason: 'قاطع',
      );

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      expect(find.text('خصم 1'), findsOneWidget);

      final cardTiles = find.descendant(
        of: find.byType(SingleChildScrollView),
        matching: find.byType(GestureDetector),
      );
      expect(cardTiles, findsNWidgets(4));

      await tester.ensureVisible(cardTiles.at(1));
      await tester.tap(cardTiles.at(1));
      await tester.pump();
      await tester.ensureVisible(cardTiles.at(3));
      await tester.tap(cardTiles.at(3));
      await tester.pump();

      final selected = container.read(gameControllerProvider).qaidCards;
      expect(selected.length, 2);
      expect(selected.any((c) => c['suit'] == 'CLUBS' && c['rank'] == 'K'), isTrue);
      expect(selected.any((c) => c['suit'] == 'DIAMONDS' && c['rank'] == '10'), isTrue);
    });

    test('قيد يدوي — payload مكافئ manual_qaid عبر qaid_submit', () {
      final ctrl = container.read(gameControllerProvider.notifier);
      const cardA = {'suit': 'SPADES', 'rank': 'A'};
      const card7 = {'suit': 'SPADES', 'rank': '7'};
      ctrl.state = ctrl.state.copyWith(
        qaidReason: 'قاطع',
        qaidCards: [cardA, card7],
        qaidStep: 3,
      );
      ctrl.qaidSubmit();
      final submit = socket.lastPayload('qaid_submit');
      expect(submit!['reason'], 'قاطع');
      expect((submit['cards'] as List).length, 2);
    });
  });

  group('UX — إغلاق نافذة القيد', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
      seedQaidController(container);
    });

    tearDown(() => container.dispose());

    test('qaidSubmit لا يُرسل أثناء qaidSubmitting', () {
      final ctrl = container.read(gameControllerProvider.notifier);
      ctrl.state = ctrl.state.copyWith(
        qaidReason: 'سوا غلط',
        qaidSubmitting: true,
      );
      ctrl.qaidSubmit();
      expect(socket.lastPayload('qaid_submit'), isNull);
    });

    testWidgets('تُغلق النافذة فور الإرسال', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      seedQaidController(container, withSawa: true);

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      await tester.tap(find.text('سوا غلط'));
      await tester.pump();

      await tester.tap(find.text('إرسال'));
      await tester.pump();

      expect(container.read(gameControllerProvider).qaidModalOpen, isFalse);
      expect(socket.allPayloads('qaid_submit').length, 1);
    });

    testWidgets('تُغلق النافذة بعد qaid_ended', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          QaidWizardOverlay(game: container.read(gameControllerProvider)),
        ),
      );

      expect(find.text('اعتراض — قيد'), findsOneWidget);

      socket.push('qaid_ended', {});
      await tester.pump();

      expect(container.read(gameControllerProvider).qaidModalOpen, isFalse);
    });

    test('qaid_start الناجح يفتح النافذة', () {
      container.read(gameControllerProvider.notifier).qaidStart();
      expect(container.read(gameControllerProvider).qaidModalOpen, isTrue);
    });
  });
}
