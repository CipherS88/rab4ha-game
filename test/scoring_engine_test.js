const assert = require('assert');
const {
  BalootEngine,
  GamePhase,
  SUN_VALUES,
  HAKAM_VALUES,
  PROJECT_RAW_PTS,
  SCORING,
  abnatToBoardScore,
  settleNormalRound,
} = require('../server/engine.js');

function playingEngine(opts = {}) {
  const e = new BalootEngine({ initialScores: opts.scores || { 1: 0, 2: 0 } });
  e.phase = GamePhase.PLAYING;
  e.bid = { type: opts.bidType || 'SUN', suit: opts.bidSuit || null, bidder: opts.bidder ?? 0 };
  e.buyer_team = opts.buyerTeam ?? 1;
  e.double_level = opts.doubleLevel ?? 1;
  e.sun_over100_special = !!opts.sunOver100Special;
  return e;
}

// ── قيم الأوراق ──
assert.strictEqual(SUN_VALUES.A, 11);
assert.strictEqual(SUN_VALUES['10'], 10);
assert.strictEqual(SUN_VALUES.K, 4);
assert.strictEqual(SUN_VALUES.Q, 3);
assert.strictEqual(SUN_VALUES.J, 2);
assert.strictEqual(SUN_VALUES['9'], 0);
assert.strictEqual(HAKAM_VALUES.J, 20);
assert.strictEqual(HAKAM_VALUES['9'], 14);
assert.strictEqual(HAKAM_VALUES.A, 11);
assert.strictEqual(HAKAM_VALUES['8'], 0);

// ── التجبير ──
assert.strictEqual(abnatToBoardScore(26, true), 6); // floor(31/10)*2 = 6
assert.strictEqual(abnatToBoardScore(26, false), 3); // floor(31/10)*1 = 3
assert.strictEqual(abnatToBoardScore(4, true), 0);
assert.strictEqual(abnatToBoardScore(5, true), 2);

// ── مشاريع خام ──
assert.deepStrictEqual(PROJECT_RAW_PTS.سرا, [20, 20]);
assert.deepStrictEqual(PROJECT_RAW_PTS.أربعمية, [200, 0]);

// ── فوز طبيعي (المشتري أعلى) ──
{
  const e = playingEngine();
  e.round_points = { 1: 80, 2: 40 };
  e.tricks_won = { 1: 5, 2: 3 };
  e.last_trick_winner_team = 1;
  e.finalize_round();
  assert.strictEqual(e.summary_data.is_fall, false);
  assert.strictEqual(e.summary_data.final[1], e.summary_data.base_final[1]);
  assert.strictEqual(e.summary_data.final[2], e.summary_data.base_final[2]);
}

// ── سقوط المشتري ──
{
  const e = playingEngine();
  e.round_points = { 1: 30, 2: 70 };
  e.tricks_won = { 1: 3, 2: 5 };
  e.last_trick_winner_team = 2;
  e.finalize_round();
  assert.strictEqual(e.summary_data.is_fall, true);
  assert.strictEqual(e.summary_data.final[1], 0);
  assert.strictEqual(
    e.summary_data.final[2],
    e.summary_data.base_final[1] + e.summary_data.base_final[2],
  );
}

// ── كبوت صن: 44 + مشاريع الفائز فقط ──
{
  const e = playingEngine();
  e.tricks_won = { 1: 8, 2: 0 };
  e.winning_project_team = 1;
  e.declared_projects = { 0: ['سرا'], 1: [], 2: [], 3: [] };
  e.finalize_round();
  assert.strictEqual(e.summary_data.is_kaput, true);
  assert.strictEqual(e.summary_data.final[1], 44 + abnatToBoardScore(20, true));
  assert.strictEqual(e.summary_data.final[2], 0);
}

// ── كبوت حكم: 25 ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'HEARTS' });
  e.tricks_won = { 1: 0, 2: 8 };
  e.finalize_round();
  assert.strictEqual(e.summary_data.final[2], 25);
  assert.strictEqual(e.summary_data.final[1], 0);
}

// ── تدبيل: 16 × المعامل ──
for (const level of [2, 3, 4]) {
  const settled = settleNormalRound({
    baseFinal: { 1: 10, 2: 6 },
    buyerTeam: 1,
    isDoubled: true,
    doubleLevel: level,
    sunOver100Special: false,
  });
  assert.strictEqual(settled.scores[1], SCORING.DOUBLE_POINTS_BASE * level);
  assert.strictEqual(settled.scores[2], 0);
  assert.strictEqual(settled.is_fall, false);
}

// ── تدبيل: المدافع يفوز ──
{
  const settled = settleNormalRound({
    baseFinal: { 1: 4, 2: 8 },
    buyerTeam: 1,
    isDoubled: true,
    doubleLevel: 2,
    sunOver100Special: false,
  });
  assert.strictEqual(settled.scores[2], 32);
  assert.strictEqual(settled.scores[1], 0);
  assert.strictEqual(settled.is_fall, true);
}

// ── صن فوق 100 + دبل = 60 ──
{
  const e = playingEngine({ sunOver100Special: true, doubleLevel: 2 });
  e.round_points = { 1: 80, 2: 40 };
  e.tricks_won = { 1: 5, 2: 3 };
  e.last_trick_winner_team = 1;
  e.finalize_round();
  assert.strictEqual(e.summary_data.final[1], SCORING.SUN_OVER100_DOUBLE);
  assert.strictEqual(e.summary_data.final[2], 0);
}

{
  const e = playingEngine({ sunOver100Special: true, doubleLevel: 2, buyerTeam: 1 });
  e.round_points = { 1: 20, 2: 90 };
  e.tricks_won = { 1: 2, 2: 6 };
  e.last_trick_winner_team = 2;
  e.finalize_round();
  assert.strictEqual(e.summary_data.final[2], SCORING.SUN_OVER100_DOUBLE);
  assert.strictEqual(e.summary_data.final[1], 0);
  assert.strictEqual(e.summary_data.is_fall, true);
}

// ── قهوة = 152 ──
{
  const e = playingEngine({ doubleLevel: 5 });
  e.round_points = { 1: 50, 2: 60 };
  e.tricks_won = { 1: 4, 2: 4 };
  e.last_trick_winner_team = 2;
  e.finalize_round();
  assert.strictEqual(e.summary_data.is_qahwa, true);
  assert.strictEqual(e.summary_data.final[2], SCORING.GAHWA_POINTS);
  assert.strictEqual(e.summary_data.final[1], 0);
}

// ── مشاريع: الفريق الفائز فقط (صن) ──
{
  const e = playingEngine();
  e.round_points = { 1: 40, 2: 40 };
  e.tricks_won = { 1: 4, 2: 4 };
  e.last_trick_winner_team = 1;
  e.winning_project_team = 1;
  e.declared_projects = { 0: ['سرا'], 1: ['مية'], 2: [], 3: [] };
  e.finalize_round();
  assert.strictEqual(e.summary_data.projects[1], 20);
  assert.strictEqual(e.summary_data.projects[2], 0);
}

// ── حكم مفتوح: الأكلة كصن على لون البداية ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'CLUBS' });
  e.double_level = 2;
  e.hakam_locked = false;
  e.buyer_seat = 0;
  e.current_trick = [
    { player: 0, card: { suit: 'HEARTS', rank: 'A' } },
    { player: 1, card: { suit: 'HEARTS', rank: 'J' } },
    { player: 2, card: { suit: 'HEARTS', rank: '10' } },
    { player: 3, card: { suit: 'HEARTS', rank: 'K' } },
  ];
  const [winner] = e.evaluate_trick();
  assert.strictEqual(winner, 0, 'آس الهاص يأخذ الأكلة على ولد الهاص في الحكم المفتوح');
}

// ── حكم مفتوح: الحكم لا يأكل إلا إذا المشتري وحده دقّ ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'CLUBS' });
  e.double_level = 2;
  e.hakam_locked = false;
  e.buyer_seat = 0;
  e.current_trick = [
    { player: 0, card: { suit: 'HEARTS', rank: 'A' } },
    { player: 1, card: { suit: 'CLUBS', rank: 'J' } },
    { player: 2, card: { suit: 'HEARTS', rank: '10' } },
    { player: 3, card: { suit: 'HEARTS', rank: 'K' } },
  ];
  const [winner] = e.evaluate_trick();
  assert.strictEqual(winner, 0, 'الحكم لا يأكل تلقائياً في المفتوح');
}

// ── حكم مفتوح: المشتري وحده دقّ بالحكم ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'CLUBS' });
  e.double_level = 2;
  e.hakam_locked = false;
  e.buyer_seat = 0;
  e.current_trick = [
    { player: 0, card: { suit: 'CLUBS', rank: '9' } },
    { player: 1, card: { suit: 'HEARTS', rank: 'A' } },
    { player: 2, card: { suit: 'HEARTS', rank: '10' } },
    { player: 3, card: { suit: 'HEARTS', rank: 'K' } },
  ];
  const [winner] = e.evaluate_trick();
  assert.strictEqual(winner, 0, 'المشتري وحده دقّ بالحكم فيأخذ الأكلة');
}

// ── حكم مقفل: الحكم يأكل كالعادة ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'CLUBS' });
  e.double_level = 2;
  e.hakam_locked = true;
  e.current_trick = [
    { player: 0, card: { suit: 'HEARTS', rank: 'A' } },
    { player: 1, card: { suit: 'CLUBS', rank: 'J' } },
    { player: 2, card: { suit: 'HEARTS', rank: '10' } },
    { player: 3, card: { suit: 'HEARTS', rank: 'K' } },
  ];
  const [winner] = e.evaluate_trick();
  assert.strictEqual(winner, 1, 'في المقفل الحكم يأخذ الأكلة');
}

console.log('scoring_engine_test: ok');
