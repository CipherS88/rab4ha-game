const assert = require('assert');
const { BalootEngine, GamePhase } = require('../server/engine.js');

function playingEngine() {
  const e = new BalootEngine({ initialScores: { 1: 0, 2: 0 } });
  e.phase = GamePhase.PLAYING;
  e.bid = { type: 'SUN', suit: null, bidder: 0 };
  e.buyer_team = 1;
  return e;
}

// الأرض لآكل آخر أكلة — وليس لمن أكَل أكثر أكلات
{
  const e = playingEngine();
  e.round_points = { 1: 50, 2: 70 };
  e.tricks_won = { 1: 5, 2: 3 };
  e.last_trick_winner_team = 2;
  e.finalize_round();
  assert.strictEqual(e.summary_data.ground[1], 0);
  assert.strictEqual(e.summary_data.ground[2], 10);
}

// سوا → الأرض للمُعلِن
{
  const e = playingEngine();
  e.round_points = { 1: 30, 2: 20 };
  e.tricks_won = { 1: 2, 2: 1 };
  e.last_trick_winner_team = 2;
  e.finalize_round(1, 'sawa');
  assert.strictEqual(e.summary_data.ground[1], 10);
  assert.strictEqual(e.summary_data.ground[2], 0);
  assert.strictEqual(e.summary_data.final[1], 44);
}

// قيد → لا أرض
{
  const e = playingEngine();
  e.round_points = { 1: 30, 2: 20 };
  e.tricks_won = { 1: 3, 2: 2 };
  e.last_trick_winner_team = 2;
  e.finalize_round(1, 'qaid', { qaid_loser_tricks: 0 });
  assert.strictEqual(e.summary_data.ground[1], 0);
  assert.strictEqual(e.summary_data.ground[2], 0);
}

// سوا بدون أكلات سابقة
{
  const e = playingEngine();
  e.tricks_won = { 1: 0, 2: 0 };
  e.last_trick_winner_team = null;
  e.finalize_round(2, 'sawa');
  assert.strictEqual(e.summary_data.ground[2], 10);
}

console.log('ground_scoring_test: ok');
