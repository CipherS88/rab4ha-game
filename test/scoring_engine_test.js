const assert = require('assert');
const {
  BalootEngine,
  GamePhase,
  SUN_VALUES,
  HAKAM_VALUES,
  PROJECT_RAW_PTS,
  SCORING,
  abnatToBoardScore,
  projectsBoardScore,
  settleNormalRound,
  multipliedTeamBoard,
  applyJabirOnRawTie,
} = require('../server/engine.js');

function playingEngine(opts = {}) {
  const e = new BalootEngine({ initialScores: opts.scores || { 1: 0, 2: 0 } });
  e.phase = GamePhase.PLAYING;
  e.bid = { type: opts.bidType || 'SUN', suit: opts.bidSuit || null, bidder: opts.bidder ?? 0 };
  e.buyer_team = opts.buyerTeam ?? 1;
  e.double_level = opts.doubleLevel ?? 1;
  return e;
}

// ── قيم الأوراق ──
assert.strictEqual(SUN_VALUES.A, 11);
assert.strictEqual(HAKAM_VALUES.J, 20);

// ── التجبير ──
assert.strictEqual(abnatToBoardScore(26, true), 6);
assert.strictEqual(abnatToBoardScore(26, false), 3);

// ── السيناريو 1: المشتري فاز صن ──
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

// ── السيناريو 2: سقوط المشتري صن = 30 + مشاريع المدافع ──
{
  const e = playingEngine();
  e.round_points = { 1: 30, 2: 70 };
  e.tricks_won = { 1: 3, 2: 5 };
  e.last_trick_winner_team = 2;
  e.finalize_round();
  assert.strictEqual(e.summary_data.is_fall, true);
  assert.strictEqual(e.summary_data.final[1], 0);
  assert.strictEqual(e.summary_data.final[2], SCORING.FALL_BASE.SUN);
}

{
  const e = playingEngine();
  e.round_points = { 1: 30, 2: 70 };
  e.tricks_won = { 1: 3, 2: 5 };
  e.last_trick_winner_team = 2;
  e.winning_project_team = 2;
  e.declared_projects = { 0: [], 1: [], 2: [], 3: ['سرا'] };
  e.finalize_round();
  assert.strictEqual(
    e.summary_data.final[2],
    SCORING.FALL_BASE.SUN + abnatToBoardScore(20, true),
  );
}

// ── السيناريو 3: كبوت صن ──
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

// ── السيناريو 5: سقوط المشتري حكم = 16 + مشاريع المدافع ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'HEARTS' });
  e.round_points = { 1: 20, 2: 60 };
  e.tricks_won = { 1: 2, 2: 6 };
  e.last_trick_winner_team = 2;
  e.finalize_round();
  assert.strictEqual(e.summary_data.is_fall, true);
  assert.strictEqual(e.summary_data.final[1], 0);
  assert.strictEqual(e.summary_data.final[2], SCORING.FALL_BASE.HAKAM);
}

// ── السيناريو 6: كبوت حكم ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'HEARTS' });
  e.tricks_won = { 1: 0, 2: 8 };
  e.finalize_round();
  assert.strictEqual(e.summary_data.final[2], 25);
  assert.strictEqual(e.summary_data.final[1], 0);
}

// ── السيناريو 7: المشتري فاز دبل — الفريقان يأخذان (أبناط×2) ──
{
  const settled = settleNormalRound({
    isSun: false,
    baseFinal: { 1: 10, 2: 6 },
    buyerTeam: 1,
    rawTricks: { 1: 85, 2: 45 },
    groundPts: { 1: 0, 2: 0 },
    rawProj: { 1: 0, 2: 0 },
    isDoubled: true,
    doubleLevel: 2,
  });
  assert.strictEqual(settled.scores[1], multipliedTeamBoard(
    { 1: 85, 2: 45 }, { 1: 0, 2: 0 }, { 1: 0, 2: 0 }, 1, false, 2,
  ));
  assert.strictEqual(settled.scores[2], multipliedTeamBoard(
    { 1: 85, 2: 45 }, { 1: 0, 2: 0 }, { 1: 0, 2: 0 }, 2, false, 2,
  ));
  assert.strictEqual(settled.is_fall, false);
}

// ── السيناريو 8: المشتري خسر دبل = 32 + مشاريع المدافع ──
{
  const settled = settleNormalRound({
    isSun: false,
    baseFinal: { 1: 4, 2: 8 },
    buyerTeam: 1,
    rawTricks: { 1: 20, 2: 80 },
    groundPts: { 1: 0, 2: 0 },
    rawProj: { 1: 0, 2: 20 },
    isDoubled: true,
    doubleLevel: 2,
  });
  assert.strictEqual(settled.scores[1], 0);
  assert.strictEqual(settled.scores[2], 32 + abnatToBoardScore(20, false));
  assert.strictEqual(settled.is_fall, true);
}

for (const [level, pts] of [[2, 32], [3, 48], [4, 64]]) {
  const settled = settleNormalRound({
    isSun: false,
    baseFinal: { 1: 4, 2: 8 },
    buyerTeam: 1,
    rawTricks: { 1: 20, 2: 80 },
    groundPts: { 1: 0, 2: 0 },
    rawProj: { 1: 0, 2: 0 },
    isDoubled: true,
    doubleLevel: level,
  });
  assert.strictEqual(settled.scores[2], pts, `fall level ${level}`);
}

// ── السيناريو 9: قهوة = 150 ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'CLUBS', doubleLevel: 5 });
  e.round_points = { 1: 50, 2: 60 };
  e.tricks_won = { 1: 4, 2: 4 };
  e.last_trick_winner_team = 2;
  e.finalize_round();
  assert.strictEqual(e.summary_data.is_qahwa, true);
  assert.strictEqual(e.summary_data.final[2], SCORING.GAHWA_POINTS);
  assert.strictEqual(e.summary_data.final[1], 0);
}

// ── السيناريو 10: سوا = حساب طبيعي + أرض للمُعلِن ──
{
  const e = playingEngine();
  e.round_points = { 1: 30, 2: 20 };
  e.tricks_won = { 1: 2, 2: 1 };
  e.last_trick_winner_team = 2;
  e.finalize_round(1, 'sawa');
  assert.strictEqual(e.summary_data.is_sawa, true);
  assert.strictEqual(e.summary_data.ground[1], 10);
  assert.strictEqual(e.summary_data.final[1], e.summary_data.base_final[1]);
  assert.strictEqual(e.summary_data.final[2], e.summary_data.base_final[2]);
  assert.notStrictEqual(e.summary_data.final[2], 0);
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

// ══════════════════════════════════════════════════════════════
// Regression — جبر الستة، تعادل التدبيل/القهوة، ثري/فور + مشاريع
// ══════════════════════════════════════════════════════════════

// ── R1: تعادل الأبناط في اللعب العادي → جبر الستة → خسارة المشتري ──
{
  const e = playingEngine({ bidType: 'SUN', doubleLevel: 1, buyerTeam: 1 });
  e.round_points = { 1: 53, 2: 53 };
  e.tricks_won = { 1: 4, 2: 4 };
  e.last_trick_winner_team = null;
  e.finalize_round();
  assert.strictEqual(e.summary_data.abnat[1], 48, 'جبر الستة: −5 من المشتري');
  assert.strictEqual(e.summary_data.abnat[2], 58, 'جبر الستة: +5 للمدافع');
  assert.strictEqual(e.summary_data.is_fall, true, 'خسارة المشتري');
  assert.strictEqual(e.summary_data.final[1], 0);
  assert.strictEqual(e.summary_data.final[2], SCORING.FALL_BASE.SUN);
}

// ── R1b: 106 مقابل 106 (أكلات + مشاريع + أرض) — صن ──
{
  const e = playingEngine({ bidType: 'SUN', doubleLevel: 1, buyerTeam: 1 });
  e.round_points = { 1: 86, 2: 96 };
  e.tricks_won = { 1: 4, 2: 4 };
  e.last_trick_winner_team = 2; // أرض 10 → فريق 2 = 96+10 = 106
  e.winning_project_team = 1;
  e.declared_projects = { 0: ['سرا'], 1: [], 2: [], 3: [] }; // فريق 1 = 86+20 = 106
  e.finalize_round();
  assert.strictEqual(e.summary_data.abnat[1], 101);
  assert.strictEqual(e.summary_data.abnat[2], 111);
  assert.strictEqual(e.summary_data.is_fall, true);
  assert.strictEqual(e.summary_data.final[1], 0);
  assert.strictEqual(e.summary_data.final[2], SCORING.FALL_BASE.SUN);
}

// ── R2: تعادل في دبل → خسارة فريق المدبل (المدافع طلب الدبل) ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'HEARTS', doubleLevel: 2, buyerTeam: 1 });
  e.last_doubling_seat = 1; // مقعد 1 = فريق 2 (المدافع) طلب الدبل
  e.round_points = { 1: 50, 2: 50 };
  e.tricks_won = { 1: 4, 2: 4 };
  e.last_trick_winner_team = null;
  e.finalize_round();
  const expectedWinner = multipliedTeamBoard(
    { 1: 50, 2: 50 }, { 1: 0, 2: 0 }, { 1: 0, 2: 0 }, 1, false, 2,
  );
  assert.strictEqual(e.summary_data.final[2], 0, 'المدبل (فريق 2) = 0');
  assert.strictEqual(e.summary_data.final[1], expectedWinner, 'الفائز = نقاط مضاعفة');
  assert.strictEqual(e.summary_data.is_fall, false, 'المشتري لم يخسر');
}

// ── R2b: تعادل دبل — المشتري هو المدبل → خسارة المشتري ──
{
  const settled = settleNormalRound({
    isSun: false,
    baseFinal: { 1: 10, 2: 10 },
    buyerTeam: 1,
    rawTricks: { 1: 50, 2: 50 },
    groundPts: { 1: 0, 2: 0 },
    rawProj: { 1: 0, 2: 0 },
    isDoubled: true,
    doubleLevel: 2,
    doublerTeam: 1,
  });
  assert.strictEqual(settled.scores[1], 0);
  assert.strictEqual(
    settled.scores[2],
    multipliedTeamBoard(
      { 1: 50, 2: 50 }, { 1: 0, 2: 0 }, { 1: 0, 2: 0 }, 2, false, 2,
    ),
  );
  assert.strictEqual(settled.is_fall, true);
}

// ── R3: تعادل في القهوة → المدبل يخسر، الخصم 150 ──
{
  const e = playingEngine({ bidType: 'HAKAM', bidSuit: 'CLUBS', doubleLevel: 5, buyerTeam: 1 });
  e.last_doubling_seat = 0; // المشتري (مقعد 0) طلب القهوة
  e.round_points = { 1: 50, 2: 50 };
  e.tricks_won = { 1: 4, 2: 4 };
  e.last_trick_winner_team = null;
  e.finalize_round();
  assert.strictEqual(e.summary_data.is_qahwa, true);
  assert.strictEqual(e.summary_data.final[1], 0, 'المدبل = 0');
  assert.strictEqual(e.summary_data.final[2], SCORING.GAHWA_POINTS, 'الخصم = 150');
  assert.strictEqual(e.summary_data.is_fall, true, 'خسارة المشتري (المدبل)');
}

// ── R3b: تعادل قهوة — المدافع طلب القهوة ──
{
  const settled = settleNormalRound({
    isSun: false,
    baseFinal: { 1: 8, 2: 8 },
    buyerTeam: 1,
    rawTricks: { 1: 40, 2: 40 },
    groundPts: { 1: 0, 2: 0 },
    rawProj: { 1: 0, 2: 0 },
    isDoubled: true,
    doubleLevel: 5,
    doublerTeam: 2,
  });
  assert.strictEqual(settled.scores[2], 0);
  assert.strictEqual(settled.scores[1], SCORING.GAHWA_POINTS);
  assert.strictEqual(settled.is_fall, false);
}

// ── R4: ثري/فور في الحكم — الأكلات × المضاعف، المشاريع 1x فقط ──
for (const mult of [3, 4]) {
  const rawTricks = { 1: 60, 2: 40 };
  const groundPts = { 1: 0, 2: 0 };
  const rawProj = { 1: 20, 2: 0 };
  const tricksOnlyMult = abnatToBoardScore(60 * mult, false) + projectsBoardScore(20, false);
  const allMultWrong = abnatToBoardScore((60 + 20) * mult, false);

  assert.strictEqual(
    multipliedTeamBoard(rawTricks, groundPts, rawProj, 1, false, mult),
    tricksOnlyMult,
    `ثري/فور ${mult}: أكلات مضاعفة + مشاريع 1x`,
  );
  assert.notStrictEqual(tricksOnlyMult, allMultWrong, `ثري/فور ${mult}: المشاريع لا تُضرب`);

  const settled = settleNormalRound({
    isSun: false,
    baseFinal: { 1: 12, 2: 6 },
    buyerTeam: 1,
    rawTricks,
    groundPts,
    rawProj,
    isDoubled: true,
    doubleLevel: mult,
    doublerTeam: 2,
  });
  assert.strictEqual(settled.scores[1], tricksOnlyMult, `فوز المشتري ثري/فور ${mult}`);
  assert.strictEqual(settled.scores[2], multipliedTeamBoard(rawTricks, groundPts, rawProj, 2, false, mult));
  assert.strictEqual(settled.is_fall, false);
}

// ── R4b: دبل (2) في الحكم — المشاريع تُضرب مع الأكلات ──
{
  const rawTricks = { 1: 60, 2: 40 };
  const rawProj = { 1: 20, 2: 0 };
  const doubleAll = abnatToBoardScore((60 + 20) * 2, false);
  assert.strictEqual(
    multipliedTeamBoard(rawTricks, { 1: 0, 2: 0 }, rawProj, 1, false, 2),
    doubleAll,
    'دبل: أكلات + مشاريع ×2 معاً',
  );
}

// ── وحدة: applyJabirOnRawTie ──
{
  const abnat = { 1: 106, 2: 106 };
  assert.strictEqual(applyJabirOnRawTie(abnat, 1), true);
  assert.strictEqual(abnat[1], 101);
  assert.strictEqual(abnat[2], 111);
  assert.strictEqual(applyJabirOnRawTie({ 1: 80, 2: 90 }, 1), false);
}

console.log('scoring_engine_test: ok');
