/**
 * محاكي جولتي حكم + دبل (مقفل / مفتوح) — قراءة وتشغيل فقط.
 */
const { BalootEngine, GamePhase } = require('../server/engine.js');

const SUN_RANKING = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const HAKAM_RANKING = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];

const SUIT_AR = { HEARTS: 'هاص', DIAMONDS: 'ديمن', CLUBS: 'شيريا', SPADES: 'سبيت' };
const RANK_AR = { A: 'إكة', 10: 'عشرة', K: 'ملك', Q: 'بنت', J: 'ولد', 9: 'تسعة', 8: 'ثمانية', 7: 'سبعة' };

function cardLabel(c) {
  return `${RANK_AR[c.rank] || c.rank} ${SUIT_AR[c.suit] || c.suit}`;
}

function seatTeam(seat) {
  return seat % 2 === 0 ? 1 : 2;
}

function teamLabel(team) {
  return team === 1 ? 'الفريق 1 (مقاعد 1 و 3)' : 'الفريق 2 (مقاعد 2 و 4)';
}

function playerLabel(seat) {
  return `اللاعب ${seat + 1} (${teamLabel(seatTeam(seat))})`;
}

function explainTrickWin(e, trick, winnerSeat) {
  const isSun = e.bid.type === 'SUN';
  const hakam = e.bid.suit;
  const lead = trick[0].card.suit;
  const winnerCard = trick.find((t) => t.player === winnerSeat).card;

  if (isSun) {
    return `أعلى كرت في لون الورقة (${SUIT_AR[lead]}) — ${cardLabel(winnerCard)}`;
  }

  const trumpsInTrick = trick.filter((t) => t.card.suit === hakam);
  if (trumpsInTrick.length > 0) {
    if (winnerCard.suit === hakam) {
      return `أعلى حكم (${SUIT_AR[hakam]}) — ${cardLabel(winnerCard)} [ترتيب: ${HAKAM_RANKING.join('>')}]`;
    }
    return `حكم ${SUIT_AR[hakam]} يقطع اللون — ${cardLabel(winnerCard)}`;
  }

  return `لا حكم في الأكلة — أعلى ${SUIT_AR[lead]}: ${cardLabel(winnerCard)} [ترتيب صن: ${SUN_RANKING.join('>')}]`;
}

function cardIndex(hand, suit, rank) {
  const i = hand.findIndex((c) => c.suit === suit && c.rank === rank);
  if (i < 0) throw new Error(`الكرت غير موجود → ${cardLabel({ suit, rank })}`);
  return i;
}

function playTrickByCards(e, cardsInOrder, mistakeLog) {
  const beforeMistakes = e.mistakes.length;
  for (const [suit, rank] of cardsInOrder) {
    const seat = e.turn;
    const idx = cardIndex(e.hands[seat], suit, rank);
    if (!e.play_card(seat, idx)) {
      throw new Error(`play_card رفض: ${playerLabel(seat)} → ${cardLabel({ suit, rank })}`);
    }
  }
  const newMistakes = e.mistakes.slice(beforeMistakes);
  const winner = e.resolve_trick();
  if (newMistakes.length) mistakeLog.push(...newMistakes);
  return winner;
}

function evalTrick(e, trick) {
  const snap = e.current_trick;
  e.current_trick = trick;
  const res = e.evaluate_trick();
  e.current_trick = snap;
  return res;
}

function buildTrickReport(e, trickHistory, mistakesByTrick) {
  return trickHistory.map((trick, i) => {
    const [winner, pts] = evalTrick(e, trick);
    const trickMistakes = mistakesByTrick[i] || [];
    return {
      num: i + 1,
      plays: trick.map((t) => ({ seat: t.player, card: t.card })),
      winner,
      team: seatTeam(winner),
      points: pts,
      explain: explainTrickWin(e, trick, winner),
      mistakes: trickMistakes.map((m) => ({
        seat: m.player,
        type: m.type,
        played: m.played_card,
        legal: m.legal_cards_held,
      })),
    };
  });
}

const SHARED_HANDS = [
  [
    { suit: 'HEARTS', rank: '7' }, { suit: 'HEARTS', rank: '8' }, { suit: 'HEARTS', rank: 'K' },
    { suit: 'DIAMONDS', rank: 'Q' }, { suit: 'CLUBS', rank: '7' }, { suit: 'CLUBS', rank: '8' },
    { suit: 'SPADES', rank: '7' }, { suit: 'SPADES', rank: '8' },
  ],
  [
    { suit: 'SPADES', rank: 'J' }, { suit: 'SPADES', rank: '9' }, { suit: 'SPADES', rank: '10' },
    { suit: 'HEARTS', rank: '10' }, { suit: 'HEARTS', rank: '9' },
    { suit: 'DIAMONDS', rank: 'K' }, { suit: 'CLUBS', rank: 'Q' }, { suit: 'CLUBS', rank: 'K' },
  ],
  [
    { suit: 'HEARTS', rank: 'A' }, { suit: 'HEARTS', rank: 'Q' }, { suit: 'HEARTS', rank: 'J' },
    { suit: 'CLUBS', rank: 'A' }, { suit: 'CLUBS', rank: '10' }, { suit: 'CLUBS', rank: '9' },
    { suit: 'SPADES', rank: 'K' }, { suit: 'DIAMONDS', rank: '9' },
  ],
  [
    { suit: 'DIAMONDS', rank: 'A' }, { suit: 'DIAMONDS', rank: '10' }, { suit: 'DIAMONDS', rank: 'J' },
    { suit: 'DIAMONDS', rank: '8' }, { suit: 'SPADES', rank: 'Q' },
    { suit: 'HEARTS', rank: '8' }, { suit: 'CLUBS', rank: 'J' }, { suit: 'DIAMONDS', rank: '7' },
  ],
];

/** ترتيب الأوراق حسب دور اللعب (e.turn) وليس مقعد ثابت */
const SHARED_TRICKS = [
  [['HEARTS', '10'], ['HEARTS', 'A'], ['HEARTS', '8'], ['HEARTS', 'K']],
  [['CLUBS', 'A'], ['CLUBS', 'J'], ['CLUBS', '7'], ['CLUBS', 'K']],
  [['HEARTS', 'Q'], ['DIAMONDS', 'A'], ['HEARTS', '7'], ['SPADES', 'J']],
  [['SPADES', '9'], ['SPADES', 'K'], ['SPADES', 'Q'], ['SPADES', '8']],
  [['SPADES', '10'], ['DIAMONDS', '9'], ['DIAMONDS', '10'], ['DIAMONDS', 'Q']],
  [['HEARTS', '9'], ['HEARTS', 'J'], ['DIAMONDS', 'J'], ['CLUBS', '8']],
  [['CLUBS', '10'], ['DIAMONDS', '8'], ['SPADES', '7'], ['CLUBS', 'Q']],
  [['HEARTS', '8'], ['DIAMONDS', 'K'], ['CLUBS', '9'], ['DIAMONDS', '7']],
];

function setupHakamDoubled(locked) {
  const e = new BalootEngine();
  e.dealer_idx = 0;
  e.floor_card = { suit: 'SPADES', rank: 'A' };
  e.phase = GamePhase.PHASE_1;
  e.turn = e.get_next_turn(e.dealer_idx);
  e.pass_count = 0;

  e.process_bidding('HAKAM', 1);
  e.process_bidding('PASS', 2);
  e.process_bidding('PASS', 3);
  e.process_bidding('PASS', 0);
  e.process_bidding('CONFIRM_HAKAM', 1);

  const doublerSeat = e._firstDefenderAfterBidder(e.bid.bidder);
  e.process_doubling('DOUBLE', doublerSeat, locked);
  e.process_doubling('PASS', e.bid.bidder);

  e.hands = JSON.parse(JSON.stringify(SHARED_HANDS));
  e.trick_count = 1;
  e.current_trick = [];
  e.round_points = { 1: 0, 2: 0 };
  e.tricks_won = { 1: 0, 2: 0 };
  e.trick_history = [];
  e.played_cards = [];
  e.mistakes = [];
  e.played_in_trick1 = { 0: false, 1: false, 2: false, 3: false };
  e.played_in_trick2 = { 0: false, 1: false, 2: false, 3: false };
  e.trick_akka_player = null;

  return { e, doublerSeat };
}

function runDoubleScenario(locked) {
  const { e, doublerSeat } = setupHakamDoubled(locked);
  const mistakesByTrick = Array.from({ length: 8 }, () => []);

  SHARED_TRICKS.forEach((trick, i) => {
    const batch = [];
    playTrickByCards(e, trick, batch);
    mistakesByTrick[i] = batch;
  });

  e.finalize_round();

  return {
    title: locked ? 'السيناريو 1: دبل مقفل — حكم سبيت' : 'السيناريو 2: دبل مفتوح — حكم سبيت',
    doubleType: locked ? 'دبل مقفل (hakam_locked = true)' : 'دبل مفتوح (hakam_locked = false)',
    doubleLevel: e.double_level,
    hakamType: 'حكم أول',
    hakamSuit: 'SPADES',
    buyer: playerLabel(e.bid.bidder),
    doubler: playerLabel(doublerSeat),
    trickResults: buildTrickReport(e, e.trick_history, mistakesByTrick),
    finalAbnat: { ...e.round_points },
    tricksWon: { ...e.tricks_won },
    boardScore: { ...e.summary_data.final },
    isFall: e.summary_data.is_fall,
    totalMistakes: e.mistakes.length,
    mistakeSummary: e.mistakes.map((m) => ({
      seat: m.player,
      type: m.type,
      played: cardLabel(m.played_card),
    })),
  };
}

function printMistakeLine(m) {
  const legal = m.legal.map(cardLabel).join('، ') || '—';
  console.log(`    ⚠ غلطة مسجّلة: ${playerLabel(m.seat)} — ${m.type}`);
  console.log(`      لعب: ${cardLabel(m.played)} | كان يجب/يُسمح: ${legal}`);
}

function printReport(report) {
  console.log('\n' + '═'.repeat(72));
  console.log(report.title);
  console.log('═'.repeat(72));
  console.log(`نوع الدبل: ${report.doubleType}`);
  console.log(`مستوى التدبيل: ${report.doubleLevel}×`);
  console.log(`نوع الحكم: ${report.hakamType}`);
  console.log(`لون الحكم: ${SUIT_AR[report.hakamSuit]} (${report.hakamSuit})`);
  console.log(`المشتري: ${report.buyer}`);
  console.log(`المدبِّل: ${report.doubler}`);
  console.log('');

  for (const t of report.trickResults) {
    console.log(`── أكلة ${t.num} ──`);
    for (const p of t.plays) {
      console.log(`  ${playerLabel(p.seat)} لعب: ${cardLabel(p.card)}`);
    }
    console.log(`  ► النتيجة: ${playerLabel(t.winner)} أكل الأكلة — ${teamLabel(t.team)}`);
    console.log(`    السبب (evaluate_trick): ${t.explain}`);
    console.log(`    نقاط الأكلة (أبناط خام): ${t.points}`);
    for (const m of t.mistakes) printMistakeLine(m);
    console.log('');
  }

  console.log('── النتيجة النهائية ──');
  console.log(`  أبناط الأكلات: الفريق 1 = ${report.finalAbnat[1]} | الفريق 2 = ${report.finalAbnat[2]}`);
  console.log(`  عدد الأكلات: الفريق 1 = ${report.tricksWon[1]} | الفريق 2 = ${report.tricksWon[2]}`);
  console.log(`  نقاط اللوحة (finalize_round): الفريق 1 = ${report.boardScore[1]} | الفريق 2 = ${report.boardScore[2]}`);
  if (report.isFall) console.log('  ► حالة: فال (سقوط المشتري)');
  console.log(`  إجمالي الأخطاء المسجّلة: ${report.totalMistakes}`);
  if (report.mistakeSummary.length) {
    console.log('  ملخص الأخطاء:');
    for (const m of report.mistakeSummary) {
      console.log(`    - ${playerLabel(m.seat)}: ${m.type} (${m.played})`);
    }
  }
  console.log('═'.repeat(72));
}

console.log('محاكاة دبل مقفل + دبل مفتوح — Trick-by-Trick (بدون تعديل server/engine.js)\n');
printReport(runDoubleScenario(true));
printReport(runDoubleScenario(false));
console.log('\n✓ انتهت المحاكاة');
