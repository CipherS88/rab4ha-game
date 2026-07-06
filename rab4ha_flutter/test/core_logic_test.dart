import 'package:flutter_test/flutter_test.dart';
import 'package:rab4ha/core/theme/rank_themes.dart';
import 'package:rab4ha/features/game/card_utils.dart';
import 'package:rab4ha/features/game/game_labels.dart';
import 'package:rab4ha/features/game/game_seats.dart';
import 'package:rab4ha/features/game/qaid_ui.dart';

void main() {
  test('sortHandForDisplay orders suits HEARTS before SPADES', () {
    final hand = [
      {'suit': 'SPADES', 'rank': 'A'},
      {'suit': 'HEARTS', 'rank': 'K'},
    ];
    final sorted = sortHandForDisplay(hand, {'type': 'SUN'});
    expect(sorted.first.value['suit'], 'HEARTS');
  });

  test('SUN bid label is صن', () {
    expect(formatBidLabel({'bid_type': 'SUN'}), 'صن');
  });

  test('expert rank id exists as خبير', () {
    expect(rankFullLabel(4, 0), contains('خبير'));
  });

  test('seat mapping local bottom is self', () {
    expect(getVisualPos(3, 3), 'bottom');
    expect(getGlobalSeat('bottom', 3), 3);
  });

  test('shouldShowHandFaces during HAKAM_COUNTER', () {
    expect(
      shouldShowHandFaces({'phase': 'HAKAM_COUNTER', 'hand_hidden': true}),
      isTrue,
    );
  });

  test('qaidDealerPosition relative to dealer', () {
    expect(qaidDealerPosition(3, 3).label, 'موزع');
    expect(qaidDealerPosition(0, 3).arrow, '→');
    expect(qaidDealerPosition(2, 3).label, 'يسار');
    expect(isQaidAllySeat(2, 0), isTrue);
    expect(isQaidAllySeat(1, 0), isFalse);
  });

  test('qaidReasonsForRound — صن vs حكم', () {
    final sunGs = {'bid': {'type': 'SUN'}, 'sawa_declaration': {}};
    final hakamGs = {'bid': {'type': 'HAKAM'}, 'sawa_declaration': {}};
    expect(qaidReasonsForRound(sunGs), ['قاطع', 'سوا غلط']);
    expect(qaidReasonsForRound(hakamGs), qaidHakamReasons);
    expect(qaidReasonsForRound({'bid': {'type': 'SUN'}}), ['قاطع']);
  });

  test('qaidReasonForWire — aliases إنجليزية', () {
    expect(qaidReasonForWire('سوا غلط'), 'sawa_ghalat');
    expect(qaidReasonForWire('إكة خاطئة'), 'wrong_ekkah');
    expect(qaidReasonForWire('قاطع'), 'قاطع');
    expect(qaidReasonFromWire('sawa_ghalat'), 'سوا غلط');
    expect(qaidReasonFromWire('wrong_ekkah'), 'إكة خاطئة');
  });

  test('canSubmitQaid — مسار مباشر vs إثبات', () {
    expect(
      canSubmitQaid(reason: 'سوا غلط', cards: const [], submitting: false),
      isTrue,
    );
    expect(
      canSubmitQaid(reason: 'إكة خاطئة', cards: const [], submitting: false),
      isTrue,
    );
    expect(
      canSubmitQaid(reason: 'قاطع', cards: const [], submitting: false),
      isFalse,
    );
    expect(
      canSubmitQaid(
        reason: 'قاطع',
        cards: const [
          {'suit': 'A', 'rank': 'A'},
          {'suit': 'B', 'rank': 'K'},
        ],
        submitting: false,
      ),
      isTrue,
    );
    expect(
      canSubmitQaid(reason: 'سوا غلط', cards: const [], submitting: true),
      isFalse,
    );
  });
}
