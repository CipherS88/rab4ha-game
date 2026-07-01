/**
 * Bot AI — تقييم مستمر، ذاكرة، إشارات (برقية/تهريب)، شراء، تدبيل، قيد
 */

const SUITS = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const RED_SUITS = new Set(['HEARTS', 'DIAMONDS']);
const BLACK_SUITS = new Set(['CLUBS', 'SPADES']);
const SUN_RANKING = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const HAKAM_RANKING = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const SUN_VALUES = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
const HAKAM_VALUES = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
const SERIAL_PROJECTS = new Set(['سرا', 'خمسين', 'مية']);
const QAID_NEEDS_PROOF = new Set(['قاطع', 'ما كبر بالحكم', 'ما دق بالحكم', 'ربع في المقفل']);

const GamePhase = {
  PHASE_1: 'PHASE_1',
  PHASE_2: 'PHASE_2',
  GABLAK_PHASE: 'GABLAK_PHASE',
  HAKAM_COUNTER: 'HAKAM_COUNTER',
  HAKAM_CONFIRM: 'HAKAM_CONFIRM',
  DOUBLING: 'DOUBLING',
  PLAYING: 'PLAYING',
};

function cardKey(c) {
  return `${c.rank}_of_${c.suit}`;
}

function isSunLogic(engine) {
  return engine.bid?.type === 'SUN';
}

function cardValue(engine, card) {
  if (isSunLogic(engine)) return SUN_VALUES[card.rank] ?? 0;
  const trump = engine.bid?.suit;
  return card.suit === trump ? (HAKAM_VALUES[card.rank] ?? 0) : (SUN_VALUES[card.rank] ?? 0);
}

/** مصفوفة الذاكرة — كل كرت مكشوف أو مُلْعَب */
function buildMemory(engine) {
  const seen = new Set();
  const mark = (c) => {
    if (c?.suit && c?.rank) seen.add(cardKey(c));
  };
  for (const c of engine.played_cards || []) mark(c);
  for (const t of engine.current_trick || []) mark(t.card);
  for (let seat = 0; seat < 4; seat++) {
    const rev = engine.project_reveals_public?.[seat];
    if (rev?.cards) rev.cards.forEach(mark);
    const declared = engine.declared_projects?.[seat] || [];
    if (declared.length) {
      for (const det of engine._getProjectDetails(seat)) {
        if (declared.includes(det.name)) det.cards.forEach(mark);
      }
    }
  }
  return seen;
}

function isCardSeen(memory, suit, rank) {
  return memory.has(cardKey({ suit, rank }));
}

function isAcePlayed(memory, suit) {
  return isCardSeen(memory, suit, 'A');
}

function isSunCardGuaranteed(memory, card) {
  const idx = SUN_RANKING.indexOf(card.rank);
  for (let i = 0; i < idx; i++) {
    if (!isCardSeen(memory, card.suit, SUN_RANKING[i])) return false;
  }
  return true;
}

function isTrumpGuaranteed(memory, card, trump) {
  if (card.suit !== trump) return false;
  const idx = HAKAM_RANKING.indexOf(card.rank);
  for (let i = 0; i < idx; i++) {
    if (!isCardSeen(memory, trump, HAKAM_RANKING[i])) return false;
  }
  return true;
}

function isGuaranteedLead(engine, playerIdx, cardIndex, memory) {
  const hand = engine.hands[playerIdx];
  const card = hand[cardIndex];
  if (engine.current_trick.length) return false;
  if (isSunLogic(engine)) return isSunCardGuaranteed(memory, card);
  const trump = engine.bid.suit;
  if (card.suit === trump) return isTrumpGuaranteed(memory, card, trump);
  return engine.is_akka(card);
}

function simulateWinningMoves(engine, playerIdx, legalMoves) {
  const hand = engine.hands[playerIdx];
  const winners = [];
  for (const idx of legalMoves) {
    const card = hand[idx];
    engine.current_trick.push({ player: playerIdx, card, angle: 0, dx: 0, dy: 0 });
    const [tempWinner] = engine.evaluate_trick();
    engine.current_trick.pop();
    if (tempWinner === playerIdx) winners.push(idx);
  }
  return winners;
}

function isGuaranteedWin(engine, playerIdx, cardIndex) {
  return simulateWinningMoves(engine, playerIdx, [cardIndex]).length === 1;
}

/** كل الكروت المتبقية أكلات أكيدة عند فتح الأكلة */
function botHasSawa(engine, playerIdx) {
  const hand = engine.hands[playerIdx] || [];
  if (!hand.length) return false;
  const memory = buildMemory(engine);
  if (!engine.current_trick.length) {
    return hand.every((_, i) => isGuaranteedLead(engine, playerIdx, i, memory));
  }
  const legal = engine.get_legal_cards(playerIdx);
  return legal.length > 0 && legal.every((i) => isGuaranteedWin(engine, playerIdx, i));
}

function pickLowestValue(engine, legalMoves, hand) {
  return legalMoves.reduce(
    (best, i) => (cardValue(engine, hand[i]) < cardValue(engine, hand[best]) ? i : best),
    legalMoves[0],
  );
}

function pickHighestValue(engine, legalMoves, hand) {
  return legalMoves.reduce(
    (best, i) => (cardValue(engine, hand[i]) > cardValue(engine, hand[best]) ? i : best),
    legalMoves[0],
  );
}

/** تحليل إشارات الشريك من تاريخ الأكلات */
function analyzePartnerSignals(engine, playerIdx) {
  const partnerIdx = (playerIdx + 2) % 4;
  const requestedSuits = new Set();
  let wantsRed = false;
  let barqiyyahSuit = null;

  const history = engine.trick_history || [];
  for (let t = 0; t < history.length; t++) {
    const trick = history[t];
    if (!trick?.length) continue;

    const blacks = trick.filter(({ card }) => BLACK_SUITS.has(card.suit));
    if (blacks.length >= 2) wantsRed = true;

    for (let i = 0; i < trick.length; i++) {
      const { player, card } = trick[i];
      if (player !== partnerIdx) continue;
      if (i > 0 && trick[i - 1].player === partnerIdx) {
        const prev = trick[i - 1].card;
        if (prev.suit === card.suit
          && SUN_RANKING.indexOf(card.rank) < SUN_RANKING.indexOf(prev.rank)) {
          requestedSuits.add(card.suit);
        }
      }
    }

    if (t > 0) {
      const prevTrick = history[t - 1];
      const prevLead = prevTrick[0]?.card?.suit;
      const myPrev = prevTrick.find((p) => p.player === playerIdx);
      const partnerPrev = prevTrick.find((p) => p.player === partnerIdx);
      if (myPrev?.card.rank === 'A' && partnerPrev
        && partnerPrev.card.suit === prevLead
        && SUN_RANKING.indexOf(partnerPrev.card.rank) > SUN_RANKING.indexOf('J')) {
        // شريك ضعيف في اللون — لا نطلبه
      }
    }
  }

  if (history.length) {
    const last = history[history.length - 1];
    if (last.length === 4) {
      const lead = last[0].card.suit;
      const savedTrick = engine.current_trick;
      engine.current_trick = last.map((x) => ({ player: x.player, card: { ...x.card } }));
      const [winner] = engine.evaluate_trick();
      engine.current_trick = savedTrick;
      if (winner === partnerIdx) {
        const partnerCard = last.find((p) => p.player === partnerIdx)?.card;
        if (partnerCard && partnerCard.suit !== lead) {
          barqiyyahSuit = partnerCard.suit;
        }
      }
    }
  }

  for (const trick of history) {
    if (trick[0]?.player === partnerIdx) requestedSuits.add(trick[0].card.suit);
  }

  return { requestedSuits, wantsRed, barqiyyahSuit };
}

function opponentMayBeat(engine, memory, card) {
  if (isSunLogic(engine)) {
    const idx = SUN_RANKING.indexOf(card.rank);
    for (let i = 0; i < idx; i++) {
      if (!isCardSeen(memory, card.suit, SUN_RANKING[i])) return true;
    }
    return false;
  }
  const trump = engine.bid.suit;
  if (card.suit === trump) {
    const idx = HAKAM_RANKING.indexOf(card.rank);
    for (let i = 0; i < idx; i++) {
      if (!isCardSeen(memory, trump, HAKAM_RANKING[i])) return true;
    }
    return false;
  }
  if (!isCardSeen(memory, trump, 'J')) return true;
  if (!isCardSeen(memory, card.suit, 'A')) return true;
  return false;
}

function filterStatisticalSafe(engine, playerIdx, legalMoves, memory) {
  const hand = engine.hands[playerIdx];
  const safe = legalMoves.filter((i) => {
    const c = hand[i];
    if (isGuaranteedWin(engine, playerIdx, i)) return true;
    return !opponentMayBeat(engine, memory, c);
  });
  return safe.length ? safe : legalMoves;
}

function getPartnerBuyerSeat(engine) {
  return engine.buyer_seat ?? engine.bid?.bidder ?? null;
}

function chooseBarqiyyahPlay(engine, playerIdx, legalMoves, hand, partnerIdx, memory) {
  if (!botHasSawa(engine, playerIdx)) return null;
  const [currentWinner] = engine.evaluate_trick();
  if (currentWinner !== partnerIdx) return null;

  const leadSuit = engine.current_trick[0].card.suit;
  const offSuitGuaranteed = legalMoves.filter((i) => {
    const c = hand[i];
    if (c.suit === leadSuit) return false;
    if (isSunLogic(engine)) return isSunCardGuaranteed(memory, c);
    const trump = engine.bid.suit;
    if (c.suit === trump) return isTrumpGuaranteed(memory, c, trump);
    return engine.is_akka(c);
  });
  if (!offSuitGuaranteed.length) return null;
  return pickHighestValue(engine, offSuitGuaranteed, hand);
}

function findMethlothPlay(legalMoves, hand) {
  for (const suit of SUITS) {
    const inSuit = hand.map((c, i) => ({ c, i })).filter(({ c }) => c.suit === suit);
    const ranks = new Set(inSuit.map(({ c }) => c.rank));
    if (ranks.has('J') && ranks.has('8') && ranks.has('7')) {
      const seven = inSuit.find(({ c }) => c.rank === '7');
      if (seven && legalMoves.includes(seven.i)) return seven.i;
    }
  }
  return null;
}

function filterGuardTenOnLead(legalMoves, hand, memory) {
  const filtered = legalMoves.filter((i) => {
    const c = hand[i];
    if (c.rank !== '10') return true;
    const hasSmaller = hand.some(
      (h, j) => j !== i && h.suit === c.suit
        && SUN_RANKING.indexOf(h.rank) > SUN_RANKING.indexOf('10'),
    );
    if (hasSmaller && !isAcePlayed(memory, c.suit)) return false;
    return true;
  });
  return filtered.length ? filtered : legalMoves;
}

function chooseLead(engine, playerIdx, legalMoves, hand, partnerIdx, memory, signals) {
  const guaranteed = legalMoves.filter((i) => isGuaranteedLead(engine, playerIdx, i, memory));
  if (guaranteed.length) {
    return pickLowestValue(engine, guaranteed, hand);
  }

  const buyerSeat = getPartnerBuyerSeat(engine);
  const partnerIsBuyer = buyerSeat === partnerIdx;
  const buyerTeam = engine.buyer_team;
  const myTeam = playerIdx % 2 === 0 ? 1 : 2;
  if (partnerIsBuyer && buyerTeam === myTeam && isSunLogic(engine)) {
    const low = pickLowestValue(engine, legalMoves, hand);
    return low;
  }

  let candidates = [...legalMoves];

  if (signals.barqiyyahSuit) {
    const barq = candidates.filter((i) => hand[i].suit === signals.barqiyyahSuit);
    if (barq.length) return pickLowestValue(engine, barq, hand);
  }

  if (signals.wantsRed) {
    const red = candidates.filter((i) => RED_SUITS.has(hand[i].suit));
    if (red.length) candidates = red;
  }

  if (signals.requestedSuits.size) {
    const req = candidates.filter((i) => signals.requestedSuits.has(hand[i].suit));
    if (req.length) candidates = req;
  } else {
    const partnerLeads = candidates.filter((i) => {
      for (const trick of engine.trick_history || []) {
        if (trick[0]?.player === partnerIdx && trick[0].card.suit === hand[i].suit) return true;
      }
      return false;
    });
    if (partnerLeads.length) candidates = partnerLeads;
  }

  candidates = filterStatisticalSafe(engine, playerIdx, candidates, memory);

  const methloth = findMethlothPlay(candidates, hand);
  if (methloth !== null) return methloth;

  candidates = filterGuardTenOnLead(candidates, hand, memory);
  return pickLowestValue(engine, candidates, hand);
}

function chooseFollow(engine, playerIdx, legalMoves, hand, partnerIdx, memory, signals) {
  const [currentWinner] = engine.evaluate_trick();
  const winningMoves = simulateWinningMoves(engine, playerIdx, legalMoves);

  const barq = chooseBarqiyyahPlay(engine, playerIdx, legalMoves, hand, partnerIdx, memory);
  if (barq !== null) return barq;

  const guaranteedWins = winningMoves.filter((i) => isGuaranteedWin(engine, playerIdx, i));
  if (guaranteedWins.length) {
    return pickLowestValue(engine, guaranteedWins, hand);
  }

  if (currentWinner === partnerIdx) {
    let dumpCandidates = legalMoves.filter((i) => {
      const c = hand[i];
      return c.rank !== '10' && c.rank !== 'A';
    });
    if (!dumpCandidates.length) dumpCandidates = [...legalMoves];

    const leadSuit = engine.current_trick[0].card.suit;
    const offSuit = dumpCandidates.filter((i) => hand[i].suit !== leadSuit);
    if (offSuit.length) return pickLowestValue(engine, offSuit, hand);
    return pickLowestValue(engine, dumpCandidates, hand);
  }

  if (winningMoves.length) {
    const safe = filterStatisticalSafe(engine, playerIdx, winningMoves, memory);
    return pickLowestValue(engine, safe, hand);
  }

  const leadSuit = engine.current_trick[0].card.suit;
  const following = legalMoves.filter((i) => hand[i].suit === leadSuit);
  if (following.length) {
    const withoutTen = following.filter((i) => hand[i].rank !== '10');
    const pool = withoutTen.length ? withoutTen : following;
    return pickLowestValue(engine, pool, hand);
  }

  const dumpPool = legalMoves.filter((i) => hand[i].rank !== '10' && hand[i].rank !== 'A');
  if (dumpPool.length) return pickLowestValue(engine, dumpPool, hand);
  return pickLowestValue(engine, legalMoves, hand);
}

function chooseBotCard(engine, playerIdx) {
  const hand = engine.hands[playerIdx];
  const legalMoves = engine.get_legal_cards(playerIdx);

  if (Math.random() < 0.03 && hand.length > 1) {
    const allMoves = hand.map((_, i) => i);
    const illegalMoves = allMoves.filter((m) => !legalMoves.includes(m));
    if (illegalMoves.length) {
      return illegalMoves[Math.floor(Math.random() * illegalMoves.length)];
    }
  }

  if (!legalMoves.length) return 0;
  if (legalMoves.length === 1) return legalMoves[0];
  const partnerIdx = (playerIdx + 2) % 4;
  const memory = buildMemory(engine);
  const signals = analyzePartnerSignals(engine, playerIdx);

  if (!engine.current_trick.length) {
    return chooseLead(engine, playerIdx, legalMoves, hand, partnerIdx, memory, signals);
  }
  return chooseFollow(engine, playerIdx, legalMoves, hand, partnerIdx, memory, signals);
}

function hasMandatorySunProject(engine, botIdx) {
  const projects = engine._getProjectDetails(botIdx);
  return projects.some((p) => p.name === 'أربعمية' || p.name === 'مية');
}

function shouldLethalDouble(engine, botIdx) {
  if (engine.phase !== GamePhase.DOUBLING) return false;
  if (engine.bid?.type !== 'HAKAM') return false;
  if (engine.double_level !== 1) return false;
  const botTeam = botIdx % 2 === 0 ? 1 : 2;
  if (botTeam === engine.buyer_team) return false;
  const trump = engine.bid.suit;
  const hand = engine.hands[botIdx] || [];
  const trumpCards = hand.filter((c) => c.suit === trump);
  if (trumpCards.length < 3) return false;
  if (!trumpCards.some((c) => c.rank === '9')) return false;
  return hand.some((c) => c.suit !== trump && c.rank === 'A');
}

function chooseBotBid(engine, botIdx) {
  const hand = engine.hands[botIdx] || [];
  const floor = engine.floor_card;

  if ([GamePhase.PHASE_1, GamePhase.PHASE_2, GamePhase.HAKAM_COUNTER].includes(engine.phase)) {
    if (hasMandatorySunProject(engine, botIdx)) return { action: 'SUN' };
  }

  if (engine.phase === GamePhase.PHASE_1) {
    const floorCount = hand.filter((c) => c.suit === floor.suit).length;
    if (floorCount >= 3) return { action: 'HAKAM', suit: floor.suit };
    const highCards = hand.filter((c) => ['A', '10', 'K'].includes(c.rank)).length;
    if (highCards >= 4) return { action: 'SUN' };
    return { action: 'PASS' };
  }

  if (engine.phase === GamePhase.GABLAK_PHASE) {
    const floorCount = hand.filter((c) => c.suit === floor.suit).length;
    if (floorCount >= 2) return { action: 'GABLAK' };
    return { action: 'PASS' };
  }

  if (engine.phase === GamePhase.HAKAM_COUNTER) {
    if (hasMandatorySunProject(engine, botIdx)) return { action: 'SUN' };
    const highCards = hand.filter((c) => ['A', '10', 'K'].includes(c.rank)).length;
    if (highCards >= 3) return { action: 'SUN' };
    return { action: 'PASS' };
  }

  if (engine.phase === GamePhase.HAKAM_CONFIRM) {
    if (botIdx !== engine.bid.bidder) return { action: 'PASS' };
    if (hasMandatorySunProject(engine, botIdx)) return { action: 'SUN' };
    const trump = engine.bid.suit;
    const trumpCount = hand.filter((c) => c.suit === trump).length;
    if (trumpCount >= 3) return { action: 'CONFIRM_HAKAM' };
    return { action: 'SUN' };
  }

  if (engine.phase === GamePhase.PHASE_2) {
    if (hasMandatorySunProject(engine, botIdx)) return { action: 'SUN' };
    for (const s of SUITS.filter((x) => x !== floor.suit)) {
      const count = hand.filter((c) => c.suit === s).length;
      if (count >= 4) return { action: 'HAKAM', suit: s };
    }
    const highCards = hand.filter((c) => ['A', '10', 'K'].includes(c.rank)).length;
    if (highCards >= 3) return { action: 'SUN' };
    return { action: 'PASS' };
  }

  if (engine.phase === GamePhase.DOUBLING) {
    if (shouldLethalDouble(engine, botIdx)) {
      return { action: 'DOUBLE' };
    }
    if (engine.sun_over100_special) {
      const defenders = engine._defenderSeats(engine.bid.bidder);
      if (defenders.includes(botIdx) && engine.double_level === 1) {
        const trump = engine.bid?.suit;
        const trumpCards = trump ? hand.filter((c) => c.suit === trump).length : 0;
        if (trumpCards >= 2) return { action: 'DOUBLE' };
      }
      return { action: 'PASS' };
    }
    if (engine.double_level === 1 && botIdx !== engine.bid.bidder) {
      const trump = engine.bid?.suit;
      if (engine.bid?.type === 'HAKAM' && trump) {
        const tc = hand.filter((c) => c.suit === trump).length;
        if (tc >= 2) return { action: 'DOUBLE' };
      }
    }
    return { action: 'PASS' };
  }

  return { action: 'PASS' };
}

function chooseBotProjects(engine, botIdx) {
  const projects = engine._getProjectDetails(botIdx);
  const counts = { سرا: 0, خمسين: 0, مية: 0, أربعمية: 0 };
  for (const p of projects) {
    if (p.name === 'أربعمية' || p.name === 'مية') counts[p.name] = 1;
    else if (p.name === 'خمسين') counts.خمسين = 1;
    else if (p.name === 'سرا') counts.سرا = 1;
  }
  return counts;
}

/** اكتشاف غش الخصم — يُرجع { reason, cards } أو null */
function detectBotQaid(engine, botIdx) {
  const botTeam = botIdx % 2 === 0 ? 1 : 2;
  const mistakes = (engine.mistakes || []).filter((m) => {
    const mTeam = m.player % 2 === 0 ? 1 : 2;
    return mTeam !== botTeam;
  });
  if (!mistakes.length) return null;

  const latest = mistakes[mistakes.length - 1];
  const reason = latest.type || 'قاطع';
  const cards = [{ ...latest.played_card }];
  if (QAID_NEEDS_PROOF.has(reason) && latest.legal_cards_held?.length) {
    const proof = latest.legal_cards_held.find(
      (c) => c.rank !== latest.played_card.rank || c.suit !== latest.played_card.suit,
    ) || latest.legal_cards_held[0];
    if (proof) cards.push({ ...proof });
  }
  if (QAID_NEEDS_PROOF.has(reason) && cards.length < 2) return null;
  return { reason, cards };
}

module.exports = {
  chooseBotCard,
  chooseBotBid,
  chooseBotProjects,
  detectBotQaid,
  botHasSawa,
  buildMemory,
  isSunLogic,
  chooseEmergencyCard: chooseBotCard,
};
