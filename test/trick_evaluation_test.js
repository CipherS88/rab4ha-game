const assert = require('assert');
const { BalootEngine, GamePhase } = require('../server/engine.js');

function trickEngine(opts) {
  const e = new BalootEngine();
  e.phase = GamePhase.PLAYING;
  e.bid = { type: opts.bidType || 'SUN', suit: opts.bidSuit ?? null, bidder: 0 };
  e.double_level = opts.doubleLevel ?? 1;
  e.hakam_locked = opts.hakamLocked ?? false;
  e.buyer_seat = opts.buyerSeat ?? null;
  e.current_trick = opts.trick;
  return e;
}

// ── صن: آس يأكل ولد ──
{
  const e = trickEngine({
    bidType: 'SUN',
    trick: [
      { player: 0, card: { suit: 'HEARTS', rank: 'J' } },
      { player: 1, card: { suit: 'HEARTS', rank: 'A' } },
      { player: 2, card: { suit: 'HEARTS', rank: '10' } },
      { player: 3, card: { suit: 'HEARTS', rank: 'K' } },
    ],
  });
  assert.strictEqual(e.evaluate_trick()[0], 1);
}

// ── حكم مقفل (مطابق 1.py): الحكم يأكل ──
{
  const e = trickEngine({
    bidType: 'HAKAM',
    bidSuit: 'CLUBS',
    doubleLevel: 2,
    hakamLocked: true,
    trick: [
      { player: 0, card: { suit: 'HEARTS', rank: 'A' } },
      { player: 1, card: { suit: 'CLUBS', rank: 'J' } },
      { player: 2, card: { suit: 'HEARTS', rank: '10' } },
      { player: 3, card: { suit: 'HEARTS', rank: 'K' } },
    ],
  });
  assert.strictEqual(e.evaluate_trick()[0], 1);
}

// ── حكم بدون دبل: آس هاص على ولد هاص ──
{
  const e = trickEngine({
    bidType: 'HAKAM',
    bidSuit: 'CLUBS',
    trick: [
      { player: 0, card: { suit: 'HEARTS', rank: 'J' } },
      { player: 1, card: { suit: 'HEARTS', rank: 'A' } },
      { player: 2, card: { suit: 'HEARTS', rank: '10' } },
      { player: 3, card: { suit: 'HEARTS', rank: 'K' } },
    ],
  });
  assert.strictEqual(e.evaluate_trick()[0], 1);
}

// ── حكم: ولد الحكم يأكل ولد الحكم الأعلى ──
{
  const e = trickEngine({
    bidType: 'HAKAM',
    bidSuit: 'CLUBS',
    trick: [
      { player: 0, card: { suit: 'CLUBS', rank: 'J' } },
      { player: 1, card: { suit: 'CLUBS', rank: '9' } },
      { player: 2, card: { suit: 'CLUBS', rank: 'A' } },
      { player: 3, card: { suit: 'CLUBS', rank: '10' } },
    ],
  });
  assert.strictEqual(e.evaluate_trick()[0], 0);
}

// ── حكم مفتوح: الفائز يُحدَّد كـ 1.py (الحكم يأكل غير الحكم) ──
{
  const e = trickEngine({
    bidType: 'HAKAM',
    bidSuit: 'CLUBS',
    doubleLevel: 2,
    hakamLocked: false,
    trick: [
      { player: 0, card: { suit: 'HEARTS', rank: 'A' } },
      { player: 1, card: { suit: 'CLUBS', rank: 'J' } },
      { player: 2, card: { suit: 'HEARTS', rank: '10' } },
      { player: 3, card: { suit: 'HEARTS', rank: 'K' } },
    ],
  });
  assert.strictEqual(e.evaluate_trick()[0], 1);
}

// ── حكم سبيت: شيرية لا تأكل سبيت الحكم ──
{
  const e = trickEngine({
    bidType: 'HAKAM',
    bidSuit: 'SPADES',
    trick: [
      { player: 0, card: { suit: 'SPADES', rank: 'A' } },
      { player: 1, card: { suit: 'CLUBS', rank: 'J' } },
      { player: 2, card: { suit: 'SPADES', rank: '10' } },
      { player: 3, card: { suit: 'SPADES', rank: 'K' } },
    ],
  });
  assert.strictEqual(e.evaluate_trick()[0], 0);
}

// ── get_legal_cards: وجوب الدق بالحكم عند الفراغ (مطابق 1.py) ──
{
  const e = trickEngine({
    bidType: 'HAKAM',
    bidSuit: 'CLUBS',
    trick: [{ player: 0, card: { suit: 'HEARTS', rank: 'A' } }],
  });
  e.hands[1] = [
    { suit: 'CLUBS', rank: '7' },
    { suit: 'SPADES', rank: '8' },
  ];
  const legal = e.get_legal_cards(1);
  assert.deepStrictEqual(legal, [0]);
}

// ── إكة: فقاعة عند فتح أكلة في حكم (غير حكم، ليس آس، أقوى متبقٍ) ──
{
  const e = new BalootEngine();
  e.phase = GamePhase.PLAYING;
  e.bid = { type: 'HAKAM', suit: 'CLUBS', bidder: 0 };
  e.played_cards = [
    { suit: 'HEARTS', rank: 'A' },
    { suit: 'HEARTS', rank: 'K' },
  ];
  const card = { suit: 'HEARTS', rank: '10' };
  assert.strictEqual(e.is_akka(card), true);
  const bubbles = e.getPlayChatBubbles(0, card);
  assert.strictEqual(bubbles.length, 1);
  assert.strictEqual(bubbles[0], 'اكه');
  assert.strictEqual(e.getPlayChatBubbles(0, { suit: 'HEARTS', rank: 'A' }).length, 0);
}

// ── غش مسموح: ما دق بالحكم يُسجّل في mistakes ──
{
  const e = new BalootEngine();
  e.phase = GamePhase.PLAYING;
  e.bid = { type: 'HAKAM', suit: 'CLUBS', bidder: 0 };
  e.trick_count = 2;
  e.turn = 1;
  e.current_trick = [{ player: 0, card: { suit: 'HEARTS', rank: '7' } }];
  e.hands[1] = [
    { suit: 'CLUBS', rank: '7' },
    { suit: 'SPADES', rank: '8' },
  ];
  e.play_card(1, 1);
  assert.strictEqual(e.mistakes.length, 1);
  assert.strictEqual(e.mistakes[0].type, 'ما دق بالحكم');
}

console.log('trick_evaluation_test: ok');
