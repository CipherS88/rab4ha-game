/**
 * محاكي جولات حكم — يستخدم engine.js فقط (بدون تعديله).
 * توزيع 32 كرتاً قياسياً | تسمية عربية صحيحة | 3 سيناريوهات.
 */
const { BalootEngine, GamePhase, SUITS } = require('../server/engine.js');

const DECK_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUN_RANKING = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const HAKAM_RANKING = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];

const SUIT_AR = { HEARTS: 'هاص', DIAMONDS: 'ديمن', CLUBS: 'شيريا', SPADES: 'سبيت' };
/** A = إكة (الآص) | 9 = تسعة — وليس «إكة» */
const RANK_AR = {
  A: 'إكة', 10: 'عشرة', K: 'ملك', Q: 'بنت', J: 'ولد', 9: 'تسعة', 8: 'ثمانية', 7: 'سبعة',
};

function cardLabel(c) {
  return `${RANK_AR[c.rank] || c.rank} ${SUIT_AR[c.suit] || c.suit}`;
}

function cardKey(c) {
  return `${c.suit}:${c.rank}`;
}

function buildStandardDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of DECK_RANKS) {
      deck.push({ suit, rank });
    }
  }
  if (deck.length !== 32) throw new Error(`الرزمة يجب أن تكون 32 كرتاً — حصلنا على ${deck.length}`);
  const keys = new Set(deck.map(cardKey));
  if (keys.size !== 32) throw new Error('رزمة غير صالحة: تكرار في الأوراق');
  return deck;
}

/** خلط حتمي (LCG) لإعادة إنتاج نفس التوزيعة عند نفس البذرة */
function shuffleDeck(deck, seed) {
  const arr = deck.slice();
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealFromDeck(shuffled) {
  if (shuffled.length !== 32) throw new Error('توزيع غير صالح');
  return [
    shuffled.slice(0, 8).map((c) => ({ ...c })),
    shuffled.slice(8, 16).map((c) => ({ ...c })),
    shuffled.slice(16, 24).map((c) => ({ ...c })),
    shuffled.slice(24, 32).map((c) => ({ ...c })),
  ];
}

function assertValidHands(hands) {
  const all = hands.flat();
  if (all.length !== 32) throw new Error(`مجموع الأوراق ${all.length} وليس 32`);
  const keys = new Set(all.map(cardKey));
  if (keys.size !== 32) throw new Error('أيدٍ غير صالحة: تكرار أو نقص');
  for (let i = 0; i < 4; i++) {
    if (hands[i].length !== 8) throw new Error(`اللاعب ${i + 1} لديه ${hands[i].length} كروت`);
  }
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
  const hakam = e.bid.suit;
  const lead = trick[0].card.suit;
  const winnerCard = trick.find((t) => t.player === winnerSeat).card;

  const trumpsInTrick = trick.filter((t) => t.card.suit === hakam);
  if (trumpsInTrick.length > 0) {
    if (winnerCard.suit === hakam) {
      return `أعلى حكم (${SUIT_AR[hakam]}) — ${cardLabel(winnerCard)} [${HAKAM_RANKING.join('>')}]`;
    }
    return `حكم ${SUIT_AR[hakam]} يقطع اللون — ${cardLabel(winnerCard)}`;
  }
  return `لا حكم — أعلى ${SUIT_AR[lead]}: ${cardLabel(winnerCard)} [${SUN_RANKING.join('>')}]`;
}

function pickLegalCard(e, seat, legal) {
  const hand = e.hands[seat];
  if (!e.current_trick.length && e.is_muqfal_lead_restricted?.()) {
    const hakam = e.bid.suit;
    const nonTrump = legal.filter((i) => hand[i].suit !== hakam);
    if (nonTrump.length) return nonTrump[0];
  }
  if (!e.current_trick.length) {
    const bySuit = {};
    for (const i of legal) {
      const s = hand[i].suit;
      bySuit[s] = (bySuit[s] || 0) + 1;
    }
    let best = legal[0];
    let bestCount = -1;
    for (const i of legal) {
      const c = bySuit[hand[i].suit];
      if (c > bestCount) {
        bestCount = c;
        best = i;
      }
    }
    return best;
  }
  return legal[legal.length - 1];
}

function resetPlayState(e) {
  e.turn = e.get_next_turn(e.dealer_idx);
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
}

function skipDoubling(e) {
  if (e.phase !== GamePhase.DOUBLING) return;
  const d1 = e._firstDefenderAfterBidder(e.bid.bidder);
  e.process_doubling('PASS', d1);
  if (e.phase === GamePhase.DOUBLING) {
    e.process_doubling('PASS', (e.bid.bidder + 3) % 4);
  }
}

function setupFirstHakamSpades(e) {
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
}

function applyDeck(e, seed) {
  const hands = dealFromDeck(shuffleDeck(buildStandardDeck(), seed));
  assertValidHands(hands);
  e.hands = hands;
  resetPlayState(e);
}

function autoPlayEightTricks(e) {
  for (let trickNum = 0; trickNum < 8; trickNum++) {
    for (let play = 0; play < 4; play++) {
      const seat = e.turn;
      if (seat < 0) throw new Error(`لا دور للعب — أكلة ${trickNum + 1}`);
      const legal = e.get_legal_cards(seat);
      if (!legal.length) throw new Error(`لا حركة قانونية: ${playerLabel(seat)}`);
      const idx = pickLegalCard(e, seat, legal);
      if (!e.play_card(seat, idx)) {
        throw new Error(`رفض play_card: ${playerLabel(seat)} → ${cardLabel(e.hands[seat][idx] || { suit: '?', rank: '?' })}`);
      }
    }
    e.resolve_trick();
  }
}

function evalTrick(e, trick) {
  const snap = e.current_trick;
  e.current_trick = trick;
  const res = e.evaluate_trick();
  e.current_trick = snap;
  return res;
}

function buildTrickReport(e) {
  return e.trick_history.map((trick, i) => {
    const [winner, pts] = evalTrick(e, trick);
    return {
      num: i + 1,
      plays: trick.map((t) => ({ seat: t.player, card: t.card })),
      winner,
      team: seatTeam(winner),
      points: pts,
      explain: explainTrickWin(e, trick, winner),
    };
  });
}

function runScenario(config) {
  const e = new BalootEngine();
  setupFirstHakamSpades(e);

  if (config.doubling === 'none') {
    skipDoubling(e);
  } else if (config.doubling === 'double') {
    const doubler = e._firstDefenderAfterBidder(e.bid.bidder);
    e.process_doubling('DOUBLE', doubler, config.locked);
    e.process_doubling('PASS', e.bid.bidder);
  } else if (config.doubling === 'three') {
    const doubler = e._firstDefenderAfterBidder(e.bid.bidder);
    e.process_doubling('DOUBLE', doubler, config.locked);
    e.process_doubling('THREE', e.bid.bidder, config.locked);
    e.process_doubling('PASS', doubler);
  } else {
    throw new Error(`نوع تدبيل غير معروف: ${config.doubling}`);
  }

  applyDeck(e, config.seed);
  autoPlayEightTricks(e);
  e.finalize_round();

  const totalAbnat = e.round_points[1] + e.round_points[2];
  return {
    title: config.title,
    hakamType: 'حكم أول — سبيت',
    hakamSuit: 'SPADES',
    buyer: playerLabel(e.bid.bidder),
    doubler: config.doubling !== 'none' ? playerLabel(e._firstDefenderAfterBidder(e.bid.bidder)) : null,
    doubleLevel: e.double_level,
    hakamLocked: e.hakam_locked,
    trickResults: buildTrickReport(e),
    finalAbnat: { ...e.round_points },
    tricksWon: { ...e.tricks_won },
    totalAbnat,
    boardScore: { ...e.summary_data.final },
    isFall: !!e.summary_data.is_fall,
    deckSeed: config.seed,
  };
}

function printHandsSample(hands) {
  for (let i = 0; i < 4; i++) {
    console.log(`  ${playerLabel(i)}: ${hands[i].map(cardLabel).join(' | ')}`);
  }
}

function printReport(report) {
  console.log('\n' + '═'.repeat(72));
  console.log(report.title);
  console.log('═'.repeat(72));
  console.log(`نوع الحكم: ${report.hakamType}`);
  console.log(`لون الحكم: ${SUIT_AR[report.hakamSuit]}`);
  console.log(`المشتري: ${report.buyer}`);
  if (report.doubler) {
    console.log(`المدبِّل: ${report.doubler}`);
    console.log(`مستوى التدبيل: ${report.doubleLevel}× | مقفل: ${report.hakamLocked ? 'نعم' : 'لا'}`);
  } else {
    console.log('التدبيل: لا يوجد (لعب عادي)');
  }
  console.log(`بذرة التوزيع: ${report.deckSeed} (32 كرتاً بدون تكرار)`);
  console.log('');

  for (const t of report.trickResults) {
    console.log(`── أكلة ${t.num} ──`);
    for (const p of t.plays) {
      console.log(`  ${playerLabel(p.seat)} لعب: ${cardLabel(p.card)}`);
    }
    console.log(`  ► الفائز: ${playerLabel(t.winner)} — ${teamLabel(t.team)}`);
    console.log(`    السبب: ${t.explain}`);
    console.log(`    أبناط الأكلة: ${t.points}`);
    console.log('');
  }

  console.log('── النتيجة النهائية ──');
  console.log(`  أبناط الأكلات: الفريق 1 = ${report.finalAbnat[1]} | الفريق 2 = ${report.finalAbnat[2]}`);
  console.log(`  مجموع الأبناط: ${report.totalAbnat}${report.totalAbnat === 152 ? ' ✓ (152)' : ' ⚠ (المتوقع 152)'}`);
  console.log(`  عدد الأكلات: الفريق 1 = ${report.tricksWon[1]} | الفريق 2 = ${report.tricksWon[2]}`);
  console.log(`  نقاط اللوحة (finalize_round): الفريق 1 = ${report.boardScore[1]} | الفريق 2 = ${report.boardScore[2]}`);
  if (report.isFall) console.log('  ► فال: المشتري لم يحقق الأكثر');
  console.log('═'.repeat(72));
}

console.log('محاكاة حكم — 3 سيناريوهات (engine.js دون تعديل)\n');

const s1 = runScenario({
  title: 'السيناريو 1: حكم عادي (بدون تدبيل)',
  doubling: 'none',
  seed: 42,
});

const s2 = runScenario({
  title: 'السيناريو 2: حكم + دبل (مستوى 2)',
  doubling: 'double',
  locked: false,
  seed: 137,
});

const s3 = runScenario({
  title: 'السيناريو 3: حكم + ثري مقفل (مستوى 3)',
  doubling: 'three',
  locked: true,
  seed: 256,
});

printReport(s1);
printReport(s2);
printReport(s3);

console.log('\n✓ انتهت المحاكاة — لم يُعدَّل server/engine.js');
