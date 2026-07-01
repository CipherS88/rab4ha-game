const assert = require('assert');
const {
  BalootEngine,
  GamePhase,
  qaidProofMatches,
  isSunBid,
} = require('../server/engine.js');

function sunPlayingEngine() {
  const e = new BalootEngine();
  e.phase = GamePhase.PLAYING;
  e.bid = { type: 'SUN', suit: null, bidder: 0, is_ashkal: true };
  e.buyer_team = 1;
  e.trick_history = [[{ player: 0, card: { suit: 'HEARTS', rank: 'A' } }]];
  return e;
}

// ── صن / أشكل / قبلك = صن ──
{
  assert.strictEqual(isSunBid({ type: 'SUN' }), true);
  assert.strictEqual(isSunBid({ type: 'SUN', is_ashkal: true }), true);
  assert.strictEqual(isSunBid({ type: 'HAKAM', suit: 'CLUBS' }), false);

  const e = sunPlayingEngine();
  assert.deepStrictEqual(e.get_qaid_reasons(), ['قاطع', 'سوا غلط']);
}

// ── قاطع: تسجيل الخطأ + أكثر من كرت صحيح ──
{
  const e = sunPlayingEngine();
  e.turn = 1;
  e.current_trick = [{ player: 0, card: { suit: 'SPADES', rank: 'A' } }];
  e.hands[1] = [
    { suit: 'SPADES', rank: '10' },
    { suit: 'SPADES', rank: 'K' },
    { suit: 'HEARTS', rank: '7' },
  ];
  e.play_card(1, 2);
  assert.strictEqual(e.mistakes.length, 1);
  assert.strictEqual(e.mistakes[0].type, 'قاطع');
  assert.strictEqual(e.mistakes[0].legal_cards_held.length, 2);

  const mistake = e.mistakes[0];
  const played = mistake.played_card;
  const legalA = mistake.legal_cards_held[0];
  const legalB = mistake.legal_cards_held[1];

  assert.strictEqual(
    e.validate_qaid('قاطع', [played, legalA], 2).valid,
    true,
  );
  assert.strictEqual(
    e.validate_qaid('قاطع', [legalA, played], 2).valid,
    true,
  );
  assert.strictEqual(
    e.validate_qaid('قاطع', [played, legalB], 2).valid,
    true,
  );
  assert.strictEqual(
    e.validate_qaid('قاطع', [legalB, played], 2).valid,
    true,
  );
  assert.strictEqual(
    e.validate_qaid('قاطع', [played, { suit: 'HEARTS', rank: '8' }], 2).valid,
    false,
  );
}

// ── qaidProofMatches مستقل عن الترتيب ──
{
  const mistake = {
    played_card: { suit: 'SPADES', rank: '7' },
    legal_cards_held: [{ suit: 'SPADES', rank: '10' }, { suit: 'SPADES', rank: 'K' }],
  };
  assert.strictEqual(
    qaidProofMatches(mistake, [
      { suit: 'SPADES', rank: 'K' },
      { suit: 'SPADES', rank: '7' },
    ]),
    true,
  );
  assert.strictEqual(
    qaidProofMatches(mistake, [
      { suit: 'SPADES', rank: '7' },
      { suit: 'SPADES', rank: '10' },
    ]),
    true,
  );
}

// ── قيد خاطئ: لا mistakes ──
{
  const e = sunPlayingEngine();
  const r = e.validate_qaid('قاطع', [{ suit: 'HEARTS', rank: 'A' }], 2);
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.mistake_team, 2);
}

// ── سوا: تحقق تلقائي — سوا غلط ──
{
  const e = sunPlayingEngine();
  e.turn = 0;
  e.current_trick = [];
  e.hands = [
    [{ suit: 'HEARTS', rank: '7' }],
    [{ suit: 'HEARTS', rank: 'A' }],
    [{ suit: 'CLUBS', rank: '8' }],
    [{ suit: 'CLUBS', rank: '9' }],
  ];
  assert.strictEqual(e.validate_sawa_correctness(0), false);
}

// ── سوا: تحقق تلقائي — سوا صحيح ──
{
  const e = sunPlayingEngine();
  e.turn = 0;
  e.current_trick = [];
  e.hands = [
    [{ suit: 'HEARTS', rank: 'A' }],
    [{ suit: 'HEARTS', rank: '7' }],
    [{ suit: 'CLUBS', rank: '8' }],
    [{ suit: 'CLUBS', rank: '9' }],
  ];
  assert.strictEqual(e.validate_sawa_correctness(0), true);
}

// ── سوا غلط عبر validate_qaid_sawa (بدون اختيار كروت) ──
{
  const e = sunPlayingEngine();
  e.turn = 0;
  e.hands = [
    [{ suit: 'HEARTS', rank: '7' }],
    [{ suit: 'HEARTS', rank: 'A' }],
    [{ suit: 'CLUBS', rank: '8' }],
    [{ suit: 'CLUBS', rank: '9' }],
  ];
  e.sawa_declaration = { seat: 0, team: 1, phase: 'objection' };
  const r = e.validate_qaid_sawa(2);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.win_team, 2);
  assert.strictEqual(r.mistake_team, 1);
  assert.strictEqual(r.sawa_was_valid, false);
}

// ── نقاط القيد في صن: 30 + مشاريع ──
{
  const e = sunPlayingEngine();
  e.round_points = { 1: 40, 2: 20 };
  e.tricks_won = { 1: 3, 2: 2 };
  e.declared_projects = { 0: ['سرا'], 1: [], 2: [], 3: [] };
  e.winning_project_team = 1;
  e.finalize_round(2, 'qaid', { qaid_loser_tricks: 2 });
  assert.strictEqual(e.summary_data.is_qaid, true);
  assert.strictEqual(e.summary_data.is_qaid_normal, true);
  assert.strictEqual(e.summary_data.is_sun, true);
  assert.ok(e.summary_data.final[2] >= 30);
}

console.log('qaid_logic_test: ok');
