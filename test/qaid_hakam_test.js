const assert = require('assert');
const { BalootEngine, GamePhase, qaidProofMatches } = require('../server/engine.js');

function hakamEngine(opts = {}) {
  const e = new BalootEngine();
  e.phase = GamePhase.PLAYING;
  e.bid = { type: 'HAKAM', suit: opts.trump || 'CLUBS', bidder: 0 };
  e.buyer_team = 1;
  e.buyer_seat = 0;
  e.double_level = opts.doubleLevel ?? 1;
  e.hakam_locked = opts.hakamLocked ?? false;
  e.trick_history = [[{ player: 0, card: { suit: 'HEARTS', rank: 'A' } }]];
  return e;
}

// ── قاطع في حكم ──
{
  const e = hakamEngine();
  e.turn = 1;
  e.current_trick = [{ player: 0, card: { suit: 'SPADES', rank: 'A' } }];
  e.hands[1] = [
    { suit: 'SPADES', rank: '10' },
    { suit: 'HEARTS', rank: '7' },
  ];
  e.play_card(1, 1);
  assert.strictEqual(e.mistakes[0].type, 'قاطع');
  const m = e.mistakes[0];
  assert.strictEqual(e.validate_qaid('قاطع', [m.played_card, m.legal_cards_held[0]], 2).valid, true);
}

// ── ما دق بالحكم: الخصم فائز + يملك حكم ──
{
  const e = hakamEngine();
  e.turn = 2;
  e.current_trick = [
    { player: 0, card: { suit: 'HEARTS', rank: '7' } },
    { player: 1, card: { suit: 'HEARTS', rank: 'A' } },
  ];
  e.hands[2] = [
    { suit: 'CLUBS', rank: '8' },
    { suit: 'SPADES', rank: '9' },
  ];
  assert.deepStrictEqual(e.get_legal_cards(2), [0]);
  e.play_card(2, 1);
  assert.strictEqual(e.mistakes[0].type, 'ما دق بالحكم');
}

// ── تهريب: الشريك فائز بالأكلة ──
{
  const e = hakamEngine();
  e.turn = 2;
  e.current_trick = [
    { player: 0, card: { suit: 'HEARTS', rank: 'A' } },
    { player: 1, card: { suit: 'HEARTS', rank: '7' } },
  ];
  e.hands[2] = [
    { suit: 'CLUBS', rank: 'J' },
    { suit: 'SPADES', rank: '9' },
  ];
  assert.strictEqual(e.get_legal_cards(2).length, 2);
  e.play_card(2, 1);
  assert.strictEqual(e.mistakes.length, 0);
}

// ── ما كبر بالحكم: عدم العلو ──
{
  const e = hakamEngine();
  e.turn = 2;
  e.current_trick = [
    { player: 0, card: { suit: 'HEARTS', rank: '7' } },
    { player: 1, card: { suit: 'CLUBS', rank: '8' } },
  ];
  e.hands[2] = [
    { suit: 'CLUBS', rank: 'J' },
    { suit: 'CLUBS', rank: '7' },
  ];
  assert.deepStrictEqual(e.get_legal_cards(2), [0]);
  e.play_card(2, 1);
  assert.strictEqual(e.mistakes[0].type, 'ما كبر بالحكم');
}

// ── ربع في المقفل: إثبات كرت حكم + غير حكم ──
{
  const e = hakamEngine({ doubleLevel: 2, hakamLocked: true });
  e.turn = 0;
  e.current_trick = [];
  e.hands[0] = [
    { suit: 'CLUBS', rank: 'J' },
    { suit: 'HEARTS', rank: 'A' },
    { suit: 'SPADES', rank: '10' },
  ];
  e.play_card(0, 0);
  assert.strictEqual(e.mistakes[0].type, 'ربع في المقفل');
  const m = e.mistakes[0];
  assert.strictEqual(
    qaidProofMatches(m, [m.played_card, { suit: 'HEARTS', rank: 'A' }], {
      muqfalProof: true,
      hakamSuit: 'CLUBS',
    }),
    true,
  );
  assert.strictEqual(
    e.validate_qaid('ربع في المقفل', [m.played_card, { suit: 'HEARTS', rank: 'A' }], 2).valid,
    true,
  );
  assert.strictEqual(
    qaidProofMatches(m, [m.played_card, { suit: 'CLUBS', rank: '9' }], {
      muqfalProof: true,
      hakamSuit: 'CLUBS',
    }),
    false,
  );
}

// ── نقاط قيد حكم × التدبيل ──
for (const [level, expected] of [[1, 16], [2, 32], [3, 48], [4, 64]]) {
  const e = hakamEngine({ doubleLevel: level });
  e.tricks_won = { 1: 2, 2: 3 };
  e.finalize_round(2, 'qaid', { qaid_loser_tricks: 2 });
  assert.strictEqual(e.summary_data.final[2], expected, `double level ${level}`);
  assert.strictEqual(e.summary_data.final[1], 0);
}

// ── قيد حكم + مشاريع الفائز فقط ──
{
  const e = hakamEngine();
  e.declared_projects = { 0: [], 1: ['سرا'], 2: ['مية'], 3: [] };
  e.tricks_won = { 1: 1, 2: 4 };
  e.finalize_round(2, 'qaid', { qaid_loser_tricks: 1 });
  assert.strictEqual(e.summary_data.projects[2], 20);
  assert.strictEqual(e.summary_data.projects[1], 0);
  assert.strictEqual(e.summary_data.final[2], 16 + 2);
}

// ── قهوة + قيد = 152 ──
{
  const e = hakamEngine({ doubleLevel: 5 });
  e.tricks_won = { 1: 2, 2: 2 };
  e.finalize_round(2, 'qaid', { qaid_loser_tricks: 2 });
  assert.strictEqual(e.summary_data.final[2], 152);
  assert.strictEqual(e.summary_data.final[1], 0);
}

// ── سوا غلط في حكم ──
{
  const e = hakamEngine();
  e.turn = 0;
  e.hands = [
    [{ suit: 'HEARTS', rank: '7' }],
    [{ suit: 'HEARTS', rank: 'A' }],
    [{ suit: 'SPADES', rank: '8' }],
    [{ suit: 'SPADES', rank: '9' }],
  ];
  assert.strictEqual(e.validate_sawa_correctness(0), false);
}

console.log('qaid_hakam_test: ok');
