/**
 * حزمة اختبارات نقاط القيد (Qaid Scoring)
 * تغطي: صن / حكم / تدبيل / قهوة / كبوت قيد / سوا غلط / مشاريع / أرض
 * القوانين المرجعية: GAME_POINT_BEFORE_UPDATE.TXT §8
 */
const assert = require('assert');
const {
  BalootEngine,
  GamePhase,
  SCORING,
  abnatToBoardScore,
} = require('../server/engine.js');

/** @typedef {{ id: string, name: string, bid: object, doubleLevel: number, loserTricks: number, winnerTeam: number, loserTeam: number, winnerProjects?: object, loserProjects?: object, officialBase: number }} QaidScenario */

/** @type {QaidScenario[]} */
const SCENARIOS = [
  {
    id: 'sun-normal',
    name: 'قيد صن — عادي (المقيد له أكلات)',
    bid: { type: 'SUN', suit: null, bidder: 0 },
    doubleLevel: 1,
    loserTricks: 3,
    winnerTeam: 2,
    loserTeam: 1,
    winnerProjects: { 1: ['سرا'], 3: [] },
    loserProjects: { 0: ['مية'], 2: [] },
    officialBase: SCORING.FALL_BASE.SUN,
  },
  {
    id: 'sun-kaput',
    name: 'قيد صن — كبوت (0 أكلات للمقيد)',
    bid: { type: 'SUN', suit: null, bidder: 0 },
    doubleLevel: 1,
    loserTricks: 0,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.KAPUT_BASE.SUN,
  },
  {
    id: 'sun-kaput-projects',
    name: 'قيد صن — كبوت + مشاريع الفائز',
    bid: { type: 'SUN', suit: null, bidder: 0 },
    doubleLevel: 1,
    loserTricks: 0,
    winnerTeam: 2,
    loserTeam: 1,
    winnerProjects: { 1: ['سرا'], 3: [] },
    loserProjects: { 0: ['خمسين'], 2: [] },
    officialBase: SCORING.KAPUT_BASE.SUN,
  },
  {
    id: 'hakam-normal',
    name: 'قيد حكم — عادي (بدون تدبيل)',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 1,
    loserTricks: 2,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.FALL_BASE.HAKAM,
  },
  {
    id: 'hakam-double',
    name: 'قيد حكم — دبل (×2)',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 2,
    loserTricks: 1,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.DOUBLE_POINTS_BASE * 2,
  },
  {
    id: 'hakam-three',
    name: 'قيد حكم — ثري (×3)',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 3,
    loserTricks: 4,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.DOUBLE_POINTS_BASE * 3,
  },
  {
    id: 'hakam-four',
    name: 'قيد حكم — فور (×4)',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 4,
    loserTricks: 2,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.DOUBLE_POINTS_BASE * 4,
  },
  {
    id: 'hakam-gahwa',
    name: 'قيد حكم — قهوة',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 5,
    loserTricks: 2,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.GAHWA_POINTS,
  },
  {
    id: 'hakam-kaput-normal',
    name: 'قيد حكم — كبوت (×1)',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 1,
    loserTricks: 0,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.KAPUT_BASE.HAKAM,
  },
  {
    id: 'hakam-kaput-double',
    name: 'قيد حكم — كبوت + دبل (×2)',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 2,
    loserTricks: 0,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.KAPUT_BASE.HAKAM * 2,
  },
  {
    id: 'hakam-kaput-three',
    name: 'قيد حكم — كبوت + ثري (×3)',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 3,
    loserTricks: 0,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.KAPUT_BASE.HAKAM * 3,
  },
  {
    id: 'hakam-kaput-four',
    name: 'قيد حكم — كبوت + فور (×4)',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 4,
    loserTricks: 0,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.KAPUT_BASE.HAKAM * 4,
  },
  {
    id: 'false-sawa-sun',
    name: 'سوا غلط → قيد صن',
    bid: { type: 'SUN', suit: null, bidder: 0, is_ashkal: true },
    doubleLevel: 1,
    loserTricks: 2,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.FALL_BASE.SUN,
    viaFalseSawa: true,
  },
  {
    id: 'false-sawa-hakam-three',
    name: 'سوا غلط → قيد حكم ثري',
    bid: { type: 'HAKAM', suit: 'HEARTS', bidder: 0 },
    doubleLevel: 3,
    loserTricks: 1,
    winnerTeam: 2,
    loserTeam: 1,
    officialBase: SCORING.DOUBLE_POINTS_BASE * 3,
    viaFalseSawa: true,
  },
  {
    id: 'qaid-projects-wipe',
    name: 'مشاريع القيد — مسح خاسر + احتساب فائز',
    bid: { type: 'HAKAM', suit: 'CLUBS', bidder: 0 },
    doubleLevel: 1,
    loserTricks: 3,
    winnerTeam: 2,
    loserTeam: 1,
    winnerProjects: { 1: ['سرا'], 3: ['مية'] },
    loserProjects: { 0: ['خمسين'], 2: ['أربعمية'] },
    officialBase: SCORING.FALL_BASE.HAKAM,
    assertProjects: true,
  },
  {
    id: 'qaid-no-ground',
    name: 'الأرض في القيد = 0',
    bid: { type: 'SUN', suit: null, bidder: 0 },
    doubleLevel: 1,
    loserTricks: 0,
    winnerTeam: 1,
    loserTeam: 2,
    officialBase: SCORING.KAPUT_BASE.SUN,
    assertGround: true,
    lastTrickWinner: 2,
  },
];

function applySeatProjects(declared, seatProjects) {
  if (!seatProjects) return;
  for (const [seatStr, projs] of Object.entries(seatProjects)) {
    const seat = Number(seatStr);
    declared[seat] = projs.slice();
  }
}

function runQaidScenario(scenario) {
  const e = new BalootEngine({ initialScores: { 1: 0, 2: 0 } });
  e.phase = GamePhase.PLAYING;
  e.bid = scenario.bid;
  e.buyer_team = scenario.loserTeam;
  e.buyer_seat = scenario.loserTeam === 1 ? 0 : 1;
  e.double_level = scenario.doubleLevel;
  e.tricks_won = {
    1: scenario.loserTeam === 1 ? scenario.loserTricks : 8 - scenario.loserTricks,
    2: scenario.loserTeam === 2 ? scenario.loserTricks : 8 - scenario.loserTricks,
  };
  e.last_trick_winner_team = scenario.lastTrickWinner ?? scenario.winnerTeam;
  e.round_points = { 1: 40, 2: 40 };

  const declared = { 0: [], 1: [], 2: [], 3: [] };
  applySeatProjects(declared, scenario.winnerProjects);
  applySeatProjects(declared, scenario.loserProjects);
  e.declared_projects = declared;
  e.winning_project_team = scenario.winnerTeam;

  if (scenario.viaFalseSawa) {
    e.sawa_declaration = { seat: scenario.loserTeam === 1 ? 0 : 1, team: scenario.loserTeam, phase: 'objection' };
    const validation = e.validate_qaid_sawa(scenario.winnerTeam);
    assert.strictEqual(validation.valid, true, `${scenario.name}: سوا غلط يجب أن يُقبل`);
    assert.strictEqual(validation.sawa_was_valid, false);
    assert.strictEqual(validation.win_team, scenario.winnerTeam);
  }

  e.finalize_round(scenario.winnerTeam, 'qaid', { qaid_loser_tricks: scenario.loserTricks });

  const wt = scenario.winnerTeam;
  const lt = scenario.loserTeam;
  const isSun = scenario.bid.type === 'SUN';
  const idx = isSun ? 0 : 1;

  const winnerRawProj = e.summary_data.projects[wt] ?? 0;
  const loserRawProj = e.summary_data.projects[lt] ?? 0;
  const winnerProjBoard = abnatToBoardScore(winnerRawProj, isSun);
  const loserProjBoard = abnatToBoardScore(loserRawProj, isSun);
  const winnerTotal = e.summary_data.final[wt];
  const loserTotal = e.summary_data.final[lt];
  const winnerBase = winnerTotal - winnerProjBoard;

  return {
    isSun,
    idx,
    isQaid: e.summary_data.is_qaid,
    isKaput: e.summary_data.is_kaput,
    isQaidNormal: e.summary_data.is_qaid_normal,
    ground: { ...e.summary_data.ground },
    winnerRawProj,
    loserRawProj,
    winnerProjBoard,
    loserProjBoard,
    winnerBase,
    winnerTotal,
    loserTotal,
  };
}

/** @type {Array<object>} */
const reportRows = [];

for (const scenario of SCENARIOS) {
  const result = runQaidScenario(scenario);

  assert.strictEqual(result.isQaid, true, `${scenario.name}: is_qaid`);
  assert.strictEqual(result.loserTotal, 0, `${scenario.name}: الخاسر = 0`);

  assert.strictEqual(
    result.winnerBase,
    scenario.officialBase,
    `${scenario.name}: أساس الفائز`,
  );

  if (scenario.loserTricks === 0) {
    assert.strictEqual(result.isKaput, true, `${scenario.name}: is_kaput`);
    assert.strictEqual(result.isQaidNormal, false, `${scenario.name}: ليس قيداً عادياً`);
  } else if (scenario.doubleLevel !== 5) {
    assert.strictEqual(result.isKaput, false, `${scenario.name}: ليس كبوت`);
    assert.strictEqual(result.isQaidNormal, true, `${scenario.name}: قيد عادي`);
  } else {
    assert.strictEqual(result.isKaput, false, `${scenario.name}: قهوة — ليس كبوت`);
  }

  if (scenario.assertProjects) {
    assert.strictEqual(result.loserRawProj, 0, `${scenario.name}: مشاريع الخاسر = 0`);
    assert.ok(result.winnerRawProj > 0, `${scenario.name}: مشاريع الفائز > 0`);
    assert.strictEqual(
      result.winnerTotal,
      scenario.officialBase + result.winnerProjBoard,
      `${scenario.name}: إجمالي الفائز`,
    );
  }

  if (scenario.assertGround) {
    assert.strictEqual(result.ground[1], 0, `${scenario.name}: أرض فريق 1`);
    assert.strictEqual(result.ground[2], 0, `${scenario.name}: أرض فريق 2`);
  }

  reportRows.push({
    name: scenario.name,
    winnerBase: result.winnerBase,
    winnerProjects: result.winnerProjBoard,
    winnerTotal: result.winnerTotal,
    loserTotal: result.loserTotal,
    officialBase: scenario.officialBase,
  });
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  تقرير نقاط القيد (Qaid Scoring Report)');
console.log('══════════════════════════════════════════════════════════════\n');

for (let i = 0; i < reportRows.length; i++) {
  const r = reportRows[i];
  console.log(`${i + 1}. ✅ ${r.name}`);
  console.log(`   الفائز: ${r.winnerTotal} (أساسي ${r.winnerBase} + مشاريع ${r.winnerProjects})`);
  console.log(`   الخاسر: ${r.loserTotal}`);
  console.log('');
}

console.log('──────────────────────────────────────────────────────────────');
console.log(`  المجموع: ${reportRows.length} سيناريو — الكل متوافق`);
console.log('══════════════════════════════════════════════════════════════\n');

console.log('qaid_scoring_test: ok');
