import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rab4ha/features/game/game_controller.dart';
import 'package:rab4ha/features/game/qaid_wizard.dart';

import 'helpers/qaid_test_helpers.dart';
import 'helpers/recording_socket.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(ignoreLayoutOverflowInTests);

  group('Scenario 1 — صن: مسار الإرسال المباشر (سوا غلط)', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
      seedQaidController(container, withSawa: true, bidType: 'SUN');
    });

    tearDown(() => container.dispose());

    testWidgets('خياران فقط → سوا غلط → إرسال مباشر بدون كروت', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpQaid(
        tester,
        wrapQaidTest(container, QaidWizardOverlay(game: container.read(gameControllerProvider))),
      );

      expect(find.text('صن — اختر سبب القيد'), findsOneWidget);
      expect(find.text('قاطع'), findsOneWidget);
      expect(find.text('سوا غلط'), findsOneWidget);
      expect(find.text('ما كبر بالحكم'), findsNothing);
      expect(find.text('إكة خاطئة'), findsNothing);

      await tester.tap(find.text('سوا غلط'));
      await tester.pump();

      expect(find.text('التالي'), findsNothing);
      expect(find.widgetWithText(FilledButton, 'إرسال'), findsOneWidget);

      await tester.tap(find.text('إرسال'));
      await tester.pump();

      final submit = socket.lastPayload('qaid_submit');
      expect(submit, isNotNull);
      expect(submit!['reason'], 'sawa_ghalat');
      expect(submit['cards'], isEmpty);
      expect(container.read(gameControllerProvider).qaidModalOpen, isFalse);
      expect(tester.takeException(), isNull);
    });
  });

  group('Scenario 2 — صن: مسار الإثبات (قاطع)', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
      seedQaidController(container, withSawa: true, bidType: 'SUN');
    });

    tearDown(() => container.dispose());

    testWidgets('RTL + ظل الفريق + اختيار الجميع + تعطيل الإرسال حتى 2 كروت', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpQaid(
        tester,
        wrapQaidTest(container, QaidWizardOverlay(game: container.read(gameControllerProvider))),
      );

      await tester.tap(find.text('قاطع'));
      await tester.pump();
      await tester.tap(find.text('التالي'));
      await flushPendingTimers(tester);
      tester.takeException();

      expect(find.textContaining('إثبات'), findsOneWidget);

      final rtlOffsets = trickCardRightOffsets(tester);
      expect(rtlOffsets.length, 2);
      expect(rtlOffsets.first, lessThan(rtlOffsets.last));

      expect(containerHasAllyGlow(tester), isTrue);

      final cardTiles = find.descendant(
        of: find.byType(SingleChildScrollView),
        matching: find.byType(GestureDetector),
      );
      expect(cardTiles.evaluate().length, greaterThanOrEqualTo(4));

      expect(find.textContaining('0/2'), findsOneWidget);
      expect(tester.widget<TextButton>(nextStepButton(tester, '0/2')).onPressed, isNull);

      await tester.ensureVisible(cardTiles.at(4));
      await tester.tap(cardTiles.at(4));
      await tester.pump();
      await tester.ensureVisible(cardTiles.at(5));
      await tester.tap(cardTiles.at(5));
      await tester.pump();

      expect(container.read(gameControllerProvider).qaidCards.length, 2);

      await tester.tap(nextStepButton(tester, '2/2'));
      await tester.pump();
      tester.takeException();
      await tester.tap(find.text('إرسال'));
      await tester.pump();

      final submit = socket.lastPayload('qaid_submit');
      expect(submit!['reason'], 'قاطع');
      expect((submit['cards'] as List).length, 2);
      expect(tester.takeException(), isNull);
    });

    testWidgets('زر التالي معطل بكرت واحد فقط', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      container.read(gameControllerProvider.notifier).state =
          container.read(gameControllerProvider).copyWith(
                qaidStep: 2,
                qaidReason: 'قاطع',
                qaidCards: const [
                  {'suit': 'CLUBS', 'rank': 'K'},
                ],
              );

      await pumpQaid(
        tester,
        wrapQaidTest(container, QaidWizardOverlay(game: container.read(gameControllerProvider))),
      );

      expect(find.textContaining('1/2'), findsOneWidget);
      expect(tester.widget<TextButton>(nextStepButton(tester, '1/2')).onPressed, isNull);
      expect(find.widgetWithText(FilledButton, 'إرسال'), findsNothing);
    });
  });

  group('Scenario 3 — حكم: مسار الإرسال المباشر (إكة خاطئة)', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
      seedQaidController(container, bidType: 'HAKAM');
    });

    tearDown(() => container.dispose());

    testWidgets('5 خيارات → إكة خاطئة → إرسال مباشر', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final gs = qaidGameState(bidType: 'HAKAM');
      gs['sawa_declaration'] = {'seat': 0, 'phase': 'objection'};
      container.read(gameControllerProvider.notifier).state =
          container.read(gameControllerProvider).copyWith(gameState: gs, qaidModalOpen: true);

      await pumpQaid(
        tester,
        wrapQaidTest(container, QaidWizardOverlay(game: container.read(gameControllerProvider))),
      );

      expect(find.text('حكم — اختر سبب القيد'), findsOneWidget);
      for (final r in ['قاطع', 'ما كبر بالحكم', 'ما دق بالحكم', 'سوا غلط', 'إكة خاطئة']) {
        expect(find.text(r), findsOneWidget);
      }

      await tester.tap(find.text('إكة خاطئة'));
      await tester.pump();

      expect(find.text('التالي'), findsNothing);
      expect(find.textContaining('إثبات'), findsNothing);

      await tester.tap(find.text('إرسال'));
      await tester.pump();

      final submit = socket.lastPayload('qaid_submit');
      expect(submit!['reason'], 'wrong_ekkah');
      expect(submit['cards'], isEmpty);
      expect(container.read(gameControllerProvider).qaidModalOpen, isFalse);
      expect(tester.takeException(), isNull);
    });
  });

  group('Scenario 4 — حكم: مسار الإثبات (ما كبر / ما دق)', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
    });

    tearDown(() => container.dispose());

    testWidgets('ما كبر بالحكم — ترتيب الكروت لا يهم', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      seedQaidController(container, bidType: 'HAKAM', trickHistory: []);
      await pumpQaid(
        tester,
        wrapQaidTest(container, QaidWizardOverlay(game: container.read(gameControllerProvider))),
      );

      await tester.tap(find.text('ما كبر بالحكم'));
      await tester.pump();
      await tester.tap(find.text('التالي'));
      await flushPendingTimers(tester);

      final cardTiles = find.descendant(
        of: find.byType(SingleChildScrollView),
        matching: find.byType(GestureDetector),
      );

      await tester.ensureVisible(cardTiles.at(3));
      await tester.tap(cardTiles.at(3));
      await tester.pump();
      await tester.ensureVisible(cardTiles.at(1));
      await tester.tap(cardTiles.at(1));
      await tester.pump();

      await tester.tap(nextStepButton(tester, '2/2'));
      await tester.pump();
      tester.takeException();
      await tester.tap(find.text('إرسال'));
      await tester.pump();
      tester.takeException();

      final submit = socket.lastPayload('qaid_submit');
      expect(submit!['reason'], 'ما كبر بالحكم');
      final keys = (submit['cards'] as List)
          .map((c) => cardKey(Map<String, dynamic>.from(c as Map)))
          .toSet();
      expect(keys, containsAll({'CLUBS:K', 'DIAMONDS:10'}));
    });

    test('ما دق بالحكم — payload بكرتين بغض النظر عن الترتيب', () {
      seedQaidController(container, bidType: 'HAKAM', step: 3, reason: 'ما دق بالحكم');
      final ctrl = container.read(gameControllerProvider.notifier);
      ctrl.state = ctrl.state.copyWith(
        qaidCards: const [
          {'suit': 'DIAMONDS', 'rank': '10'},
          {'suit': 'CLUBS', 'rank': 'K'},
        ],
      );
      ctrl.qaidSubmit();

      final submit = socket.lastPayload('qaid_submit');
      expect(submit!['reason'], 'ما دق بالحكم');
      expect((submit['cards'] as List).length, 2);
    });
  });

  group('Scenario 5 — زر الإكة', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
    });

    tearDown(() => container.dispose());

    testWidgets('مخفي في الصن', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      container.read(gameControllerProvider.notifier).state = GameState(
        mySeat: 2,
        gameState: playingGameState(bidType: 'SUN', mySeat: 2, turn: 2),
      );

      await tester.pumpWidget(
        wrapQaidTest(container, const EkkahVisibilityProbe()),
      );
      await tester.pump();

      expect(find.byKey(const Key('ekkah_hidden')), findsOneWidget);
      expect(find.text('إكة'), findsNothing);
      expect(container.read(gameControllerProvider).canDeclareEkkah, isFalse);
    });

    testWidgets('يظهر في الحكم للاعب صاحب الدور الأول فقط', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      container.read(gameControllerProvider.notifier).state = GameState(
        mySeat: 2,
        gameState: playingGameState(bidType: 'HAKAM', mySeat: 2, turn: 2),
      );

      await tester.pumpWidget(
        wrapQaidTest(container, const EkkahVisibilityProbe()),
      );
      await tester.pump();

      expect(find.byKey(const Key('ekkah_btn')), findsOneWidget);
      expect(find.text('إكة'), findsOneWidget);
    });

    testWidgets('مخفي في الحكم إذا بدأت الأكلة', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      container.read(gameControllerProvider.notifier).state = GameState(
        mySeat: 2,
        gameState: playingGameState(
          bidType: 'HAKAM',
          mySeat: 2,
          turn: 2,
          currentTrick: [
            {'player': 2, 'card': {'suit': 'SPADES', 'rank': 'A'}},
          ],
        ),
      );

      await tester.pumpWidget(
        wrapQaidTest(container, const EkkahVisibilityProbe()),
      );
      await tester.pump();

      expect(find.byKey(const Key('ekkah_hidden')), findsOneWidget);
    });

    testWidgets('التفعيل + اللعب → is_ekkah_declared + Toast', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      container.read(gameControllerProvider.notifier).state = GameState(
        mySeat: 2,
        gameState: playingGameState(bidType: 'HAKAM', mySeat: 2, turn: 2),
      );

      await tester.pumpWidget(
        wrapQaidTest(
          container,
          Consumer(
            builder: (context, ref, _) {
              final game = ref.watch(gameControllerProvider);
              return Column(
                children: [
                  const EkkahVisibilityProbe(),
                  if (game.ekkahToast != null) Text(game.ekkahToast!),
                ],
              );
            },
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('ekkah_btn')));
      await tester.pump();
      expect(container.read(gameControllerProvider).ekkahToggle, isTrue);

      container.read(gameControllerProvider.notifier).playCard(0);
      final play = socket.lastPayload('play_card');
      expect(play!['is_ekkah_declared'], isTrue);
      expect(play['cardIndex'], 0);

      socket.push('ekkah_declared', {'name': 'أحمد', 'seat': 2});
      await tester.pump();

      expect(find.textContaining('إكة من اللاعب أحمد'), findsOneWidget);

      await tester.pump(const Duration(seconds: 4));
      await flushPendingTimers(tester);
    });
  });

  group('Post-Qaid — النشرة (Scoreboard)', () {
    late RecordingSocketService socket;
    late ProviderContainer container;

    setUp(() {
      socket = RecordingSocketService();
      container = createQaidTestContainer(socket);
      seedQaidController(container);
    });

    tearDown(() => container.dispose());

    testWidgets('تُغلق نافذة القيد وتظهر النشرة بعد qaid_ended + SCORE_SUMMARY', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1200));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpQaid(
        tester,
        wrapQaidTest(
          container,
          Consumer(
            builder: (context, ref, _) {
              final game = ref.watch(gameControllerProvider);
              return Column(
                children: [
                  if (game.qaidModalOpen && game.gs?['qaid_session'] != null) const Text('qaid_open'),
                  ScoreboardProbe(game: game),
                ],
              );
            },
          ),
        ),
      );

      expect(find.text('qaid_open'), findsOneWidget);

      socket.push('qaid_ended', {});
      await tester.pump();
      socket.push('game_public', scoreSummaryAfterQaid());
      await tester.pump();

      final game = container.read(gameControllerProvider);
      expect(game.qaidModalOpen, isFalse);
      expect(game.gs!['phase'], 'SCORE_SUMMARY');
      expect(game.gs!['summary_data'], isNotNull);
      expect(find.text('qaid_open'), findsNothing);
      expect(find.byKey(const Key('scoreboard')), findsOneWidget);
      expect(find.text('النشرة'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
