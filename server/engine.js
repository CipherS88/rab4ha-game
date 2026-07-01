/**
 * Baloot Game Engine - ported from 1.py
 */

const SUIT_SORT_ORDER = { HEARTS: 0, SPADES: 1, DIAMONDS: 2, CLUBS: 3 };
const SUN_VALUES = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
const HAKAM_VALUES = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
const SUN_RANKING = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];
const HAKAM_RANKING = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const RANK_ORDER_PROJECTS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const PROJECT_RAW_PTS = {
  سرا: [20, 20], خمسين: [50, 50], مية: [100, 100], أربعمية: [200, 0], بلوت: [0, 20],
};

/** ثوابت نهاية الجولة — حسب rules المحددة */
const SCORING = {
  KAPUT_BASE: { SUN: 44, HAKAM: 25 },
  DOUBLE_POINTS_BASE: 16,
  SUN_OVER100_DOUBLE: 60,
  GAHWA_POINTS: 152,
};

function abnatToBoardScore(abnatPts, isSun) {
  return Math.floor((abnatPts + 5) / 10) * (isSun ? 2 : 1);
}

function projectsBoardScore(rawProjTeam, isSun) {
  return abnatToBoardScore(rawProjTeam, isSun);
}

function kaputBaseScore(isSun) {
  return isSun ? SCORING.KAPUT_BASE.SUN : SCORING.KAPUT_BASE.HAKAM;
}

/**
 * تسوية جولة عادية (بدون كبوت/سوا/قيد) بعد التجبير.
 * @returns {{ scores: {1:number,2:number}, is_fall: boolean }}
 */
function settleNormalRound({
  baseFinal,
  buyerTeam,
  isDoubled,
  doubleLevel,
  sunOver100Special,
}) {
  const buyer = buyerTeam;
  const defender = buyer === 1 ? 2 : 1;
  const bScore = baseFinal[buyer];
  const dScore = baseFinal[defender];
  const scores = { 1: 0, 2: 0 };
  let isFall = false;

  if (isDoubled) {
    if (doubleLevel === 5) {
      const winner = bScore > dScore ? buyer : dScore > bScore ? defender : buyer;
      scores[winner] = SCORING.GAHWA_POINTS;
      if (winner === defender) isFall = true;
      return { scores, is_fall: isFall };
    }
    if (sunOver100Special && doubleLevel === 2) {
      const winner = bScore > dScore ? buyer : defender;
      scores[winner] = SCORING.SUN_OVER100_DOUBLE;
      if (winner === defender) isFall = true;
      return { scores, is_fall: isFall };
    }
    const pts = SCORING.DOUBLE_POINTS_BASE * doubleLevel;
    const winner = bScore > dScore ? buyer : defender;
    scores[winner] = pts;
    if (winner === defender || bScore <= dScore) isFall = true;
    return { scores, is_fall: isFall };
  }

  if (bScore > dScore) {
    scores[1] = baseFinal[1];
    scores[2] = baseFinal[2];
  } else {
    scores[defender] = baseFinal[1] + baseFinal[2];
    isFall = true;
  }
  return { scores, is_fall: isFall };
}

const SUITS = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const SUIT_AR = { HEARTS: 'هاص', DIAMONDS: 'ديمن', CLUBS: 'شيريا', SPADES: 'سبيت' };

const GamePhase = {
  INIT: 'INIT',
  PHASE_1: 'PHASE_1',
  GABLAK_PHASE: 'GABLAK_PHASE',
  HAKAM_COUNTER: 'HAKAM_COUNTER',
  HAKAM_CONFIRM: 'HAKAM_CONFIRM',
  PHASE_2: 'PHASE_2',
  DOUBLING: 'DOUBLING',
  PLAYING: 'PLAYING',
  SCORE_SUMMARY: 'SCORE_SUMMARY',
};

const QAID_REASONS = {
  SUN: ['قاطع', 'سوا غلط'],
  HAKAM: ['قاطع', 'ربع في المقفل', 'ما كبر بالحكم', 'سوا غلط', 'ما دق بالحكم'],
};

const QAID_NEEDS_PROOF = new Set(['قاطع', 'ما كبر بالحكم', 'ما دق بالحكم', 'ربع في المقفل']);

const QAID_REASON_ALIASES = {
  'سوا خاطئ': 'سوا غلط',
  'ما كبر بحكم': 'ما كبر بالحكم',
};

function normalizeQaidReason(reason) {
  if (!reason) return '';
  const t = String(reason).trim();
  return QAID_REASON_ALIASES[t] || t;
}

function qaidNeedsProof(reason) {
  return QAID_NEEDS_PROOF.has(normalizeQaidReason(reason));
}

/** صن / أشكل / قبلك — كلها تُعامل كصن في القيد */
function isSunBid(bid) {
  return bid?.type === 'SUN';
}

function qaidProofMatches(mistake, selected_cards, options = {}) {
  const played = mistake.played_card;
  const legal = mistake.legal_cards_held || [];
  if (!selected_cards?.length) return false;
  const hasPlayed = selected_cards.some((c) => cardEquals(c, played));
  if (!hasPlayed) return false;
  if (selected_cards.length === 1) return true;
  const proofCards = selected_cards.filter((c) => !cardEquals(c, played));
  if (proofCards.length !== 1) return false;
  const other = proofCards[0];
  if (options.muqfalProof && options.hakamSuit) {
    if (other.suit === options.hakamSuit) return false;
    return legal.some((lc) => cardEquals(lc, other));
  }
  return legal.some((lc) => cardEquals(lc, other));
}

function cardKey(c) {
  return `${c.rank}_of_${c.suit}`;
}

function cardEquals(a, b) {
  return a.suit === b.suit && a.rank === b.rank;
}

function createCard(suit, rank) {
  return { suit, rank };
}

class BalootEngine {
  constructor(options = {}) {
    this.phase = GamePhase.INIT;
    this.dealer_idx = Math.floor(Math.random() * 4);
    this.turn = 0;
    this.floor_card = null;
    this.hands = [[], [], [], []];
    this.bid = { type: null, suit: null, bidder: null, is_ashkal: false };
    this.buyer_seat = null;
    this.last_doubling_seat = null;
    this.pass_count = 0;
    this.current_trick = [];
    this.trick_count = 1;
    this.round_points = { 1: 0, 2: 0 };
    this.tricks_won = { 1: 0, 2: 0 };
    this.last_trick_winner_team = null;
    this.double_level = 1;
    this.doubler_idx = null;
    this.hakam_locked = false;
    this.buyer_team = 1;
    this.initial_project_hands = { 0: [], 1: [], 2: [], 3: [] };
    this.declared_projects = { 0: [], 1: [], 2: [], 3: [] };
    this.winning_project_team = null;
    this.summary_data = {};
    const initScores = options.initialScores || { 1: 0, 2: 0 };
    this.total_scores = { 1: initScores[1] ?? 0, 2: initScores[2] ?? 0 };
    this.match_mode = options.matchMode || 'standard';
    this.played_cards = [];
    this.trick_akka_player = null;
    this.trick_history = [];
    this.mistakes = [];
    this.sawa_declaration = null;
    this.hands_revealed = false;
    this.played_in_trick1 = { 0: false, 1: false, 2: false, 3: false };
    this.played_in_trick2 = { 0: false, 1: false, 2: false, 3: false };
    this.project_reveals_public = { 0: null, 1: null, 2: null, 3: null };
    this.baloot_trump_played = { 0: 0, 1: 0, 2: 0, 3: 0 };
    this.baloot_announced = { 0: false, 1: false, 2: false, 3: false };
    this._last_play_chat_bubbles = [];
    this.hakam_pre_deal = false;
    this.sun_over100_special = false;
    this.deal_cards();
  }

  _generateDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANK_ORDER_PROJECTS) {
        deck.push(createCard(suit, rank));
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  get_next_turn(current) {
    return (current + 1) % 4;
  }

  get_prev_turn(current) {
    return (current - 1 + 4) % 4;
  }

  /** يمين الموزع — أول مزايد في اللفة */
  _firstBidderSeat() {
    return this.get_next_turn(this.dealer_idx);
  }

  _isFirstBidder(seat) {
    return seat === this._firstBidderSeat();
  }

  /** موقع المقعد في ترتيب المزايدة (0 = يمين الموزع) */
  _bidOrderIndex(seat) {
    const first = this._firstBidderSeat();
    for (let i = 0; i < 4; i++) {
      if ((first + i) % 4 === seat) return i;
    }
    return -1;
  }

  /** المقعد الذي يسبقه في ترتيب المزايدة (ليس get_prev_turn) */
  _bidOrderPrev(seat) {
    const idx = this._bidOrderIndex(seat);
    if (idx <= 0) return null;
    return (this._firstBidderSeat() + idx - 1) % 4;
  }

  _enterGablakPhase(buyer_idx) {
    this.bid = { type: 'SUN', suit: null, bidder: buyer_idx };
    this.phase = GamePhase.GABLAK_PHASE;
    const prev = this._bidOrderPrev(buyer_idx);
    if (prev === null) {
      this.finalize_bid(buyer_idx, 'SUN');
      return;
    }
    this.turn = prev;
  }

  _sortHand(hand) {
    const isHakam = this.bid?.type === 'HAKAM' && this.bid?.suit;
    const hakamSuit = isHakam ? this.bid.suit : null;
    hand.sort((a, b) => {
      const sa = SUIT_SORT_ORDER[a.suit] - SUIT_SORT_ORDER[b.suit];
      if (sa !== 0) return sa;
      const ranks = isHakam && a.suit === hakamSuit ? HAKAM_RANKING : SUN_RANKING;
      return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
    });
  }

  deal_cards() {
    this.deck = this._generateDeck();
    for (let i = 0; i < 4; i++) {
      this.hands[i] = [];
      for (let j = 0; j < 5; j++) this.hands[i].push(this.deck.pop());
      this._sortHand(this.hands[i]);
    }
    this.floor_card = this.deck.pop();
    this.phase = GamePhase.PHASE_1;
    this.turn = this.get_next_turn(this.dealer_idx);
    this.pass_count = 0;
    this.trick_count = 1;
    this.bid = { type: null, suit: null, bidder: null, is_ashkal: false };
    this.buyer_seat = null;
    this.last_doubling_seat = null;
    this.declared_projects = { 0: [], 1: [], 2: [], 3: [] };
    this.winning_project_team = null;
    this.played_cards = [];
    this.trick_akka_player = null;
    this.trick_history = [];
    this.mistakes = [];
    this.sawa_declaration = null;
    this.hands_revealed = false;
    this.played_in_trick1 = { 0: false, 1: false, 2: false, 3: false };
    this.played_in_trick2 = { 0: false, 1: false, 2: false, 3: false };
    this.project_reveals_public = { 0: null, 1: null, 2: null, 3: null };
    this._resetBalootState();
    this.current_trick = [];
    this.round_points = { 1: 0, 2: 0 };
    this.tricks_won = { 1: 0, 2: 0 };
    this.last_trick_winner_team = null;
    this.double_level = 1;
    this.doubler_idx = null;
    this.hakam_locked = false;
    this.hakam_pre_deal = false;
    this.sun_over100_special = false;
    this.summary_data = {};
  }

  _defenderSeats(bidder_idx) {
    return [(bidder_idx + 1) % 4, (bidder_idx + 3) % 4];
  }

  _firstDefenderAfterBidder(bidder_idx) {
    return this._defenderSeats(bidder_idx)[0];
  }

  _isSunOver100Special(buyer_team) {
    const other = buyer_team === 1 ? 2 : 1;
    return this.total_scores[buyer_team] >= 100 && this.total_scores[other] < 100;
  }

  _deal_second_phase(is_ashkal, buyer_idx, options = {}) {
    const preserveDouble = !!options.preserveDouble;
    const recipient_idx = is_ashkal ? (buyer_idx + 2) % 4 : buyer_idx;
    for (let i = 0; i < 4; i++) {
      if (i === recipient_idx) {
        this.hands[i].push(this.floor_card, this.deck.pop(), this.deck.pop());
      } else {
        this.hands[i].push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      }
      this._sortHand(this.hands[i]);
      this.initial_project_hands[i] = [...this.hands[i]];
    }
    this.floor_card = null;
    this.trick_count = 1;
    this.round_points = { 1: 0, 2: 0 };
    this.tricks_won = { 1: 0, 2: 0 };
    this.last_trick_winner_team = null;
    this.declared_projects = { 0: [], 1: [], 2: [], 3: [] };
    this.winning_project_team = null;
    if (!preserveDouble) {
      this.double_level = 1;
      this.doubler_idx = null;
      this.hakam_locked = false;
    }
    this.played_cards = [];
    this.trick_akka_player = null;
    this.trick_history = [];
    this.mistakes = [];
    this.hands_revealed = true;
    this.played_in_trick1 = { 0: false, 1: false, 2: false, 3: false };
    this.played_in_trick2 = { 0: false, 1: false, 2: false, 3: false };
    this.sawa_declaration = null;
    this.project_reveals_public = { 0: null, 1: null, 2: null, 3: null };
    this._resetBalootState();
  }

  _resetBalootState() {
    this.baloot_trump_played = { 0: 0, 1: 0, 2: 0, 3: 0 };
    this.baloot_announced = { 0: false, 1: false, 2: false, 3: false };
    this._last_play_chat_bubbles = [];
  }

  _getBalootDetail(player_idx) {
    if (this.bid.type !== 'HAKAM' || !this.bid.suit) return null;
    const hand = this.initial_project_hands[player_idx];
    if (!hand?.length) return null;
    const trump = this.bid.suit;
    const queen = hand.find((c) => c.suit === trump && c.rank === 'Q');
    const king = hand.find((c) => c.suit === trump && c.rank === 'K');
    if (!queen || !king) return null;
    return { name: 'بلوت', cards: [queen, king] };
  }

  _playerHasBaloot(player_idx) {
    return this._getBalootDetail(player_idx) !== null;
  }

  _onBalootCardPlayed(player_idx, card) {
    if (this.bid.type !== 'HAKAM' || !this.bid.suit) return null;
    if (!this._playerHasBaloot(player_idx)) return null;
    if (card.suit !== this.bid.suit || !['Q', 'K'].includes(card.rank)) return null;
    this.baloot_trump_played[player_idx] += 1;
    if (this.baloot_trump_played[player_idx] === 2) {
      this.baloot_announced[player_idx] = true;
      return 'بلوت';
    }
    return null;
  }

  getPlayChatBubbles(player_idx, card) {
    const msgs = [];
    // إكة: بداية أكلة في حكم — كرت غير حكم وليس آس وأقوى متبقٍ في سلسلته
    if (
      this.bid.type === 'HAKAM'
      && this.current_trick.length === 0
      && card.suit !== this.bid.suit
      && card.rank !== 'A'
      && this.is_akka(card)
    ) {
      msgs.push('اكه');
    }
    const baloot = this._onBalootCardPlayed(player_idx, card);
    if (baloot) msgs.push(baloot);
    return msgs;
  }

  getLastPlayChatBubbles() {
    return this._last_play_chat_bubbles || [];
  }

  _computeRoundProjects(is_sun, idx_pts) {
    const raw_proj = { 1: 0, 2: 0 };

    if (is_sun) {
      if (this.winning_project_team !== null) {
        for (let p_idx = 0; p_idx < 4; p_idx++) {
          const t_id = p_idx % 2 === 0 ? 1 : 2;
          if (t_id === this.winning_project_team) {
            for (const proj of this.declared_projects[p_idx]) {
              raw_proj[t_id] += PROJECT_RAW_PTS[proj][idx_pts];
            }
          }
        }
      }
      return raw_proj;
    }

    const baloot_team = { 1: false, 2: false };
    for (let p_idx = 0; p_idx < 4; p_idx++) {
      if (this.baloot_announced[p_idx]) {
        baloot_team[p_idx % 2 === 0 ? 1 : 2] = true;
      }
    }
    const any_baloot = baloot_team[1] || baloot_team[2];

    if (any_baloot) {
      for (let p_idx = 0; p_idx < 4; p_idx++) {
        const t_id = p_idx % 2 === 0 ? 1 : 2;
        for (const proj of this.declared_projects[p_idx]) {
          raw_proj[t_id] += PROJECT_RAW_PTS[proj][idx_pts];
        }
      }
    } else if (this.winning_project_team !== null) {
      for (let p_idx = 0; p_idx < 4; p_idx++) {
        const t_id = p_idx % 2 === 0 ? 1 : 2;
        if (t_id === this.winning_project_team) {
          for (const proj of this.declared_projects[p_idx]) {
            raw_proj[t_id] += PROJECT_RAW_PTS[proj][idx_pts];
          }
        }
      }
    }

    for (const t of [1, 2]) {
      if (baloot_team[t]) raw_proj[t] += PROJECT_RAW_PTS.بلوت[idx_pts];
    }
    return raw_proj;
  }

  _groundBoardScore(ground_pts, team, is_sun) {
    return ground_pts[team] ? this._abnatToBoardScore(ground_pts[team], is_sun) : 0;
  }

  _computeGroundPoints(forced_win_team, end_reason) {
    const ground_pts = { 1: 0, 2: 0 };
    if (end_reason === 'qaid') return ground_pts;
    const isSawaEnd = end_reason === 'sawa' || end_reason === 'qaid_sawa';
    if (isSawaEnd && forced_win_team !== null) {
      ground_pts[forced_win_team] = 10;
      return ground_pts;
    }
    if (this.last_trick_winner_team != null && this.tricks_won[1] + this.tricks_won[2] > 0) {
      ground_pts[this.last_trick_winner_team] = 10;
    }
    return ground_pts;
  }

  _abnatToBoardScore(abnatPts, is_sun) {
    return abnatToBoardScore(abnatPts, is_sun);
  }

  _projectsBoardScore(rawProjTeam, is_sun) {
    return projectsBoardScore(rawProjTeam, is_sun);
  }

  _qaidForcedScore(is_sun, loserTricks, doubleLevel = 1) {
    if (is_sun) {
      if (loserTricks === 0) {
        return { base: 44, is_kaput: true, is_qaid_normal: false };
      }
      return { base: 30, is_kaput: false, is_qaid_normal: true };
    }
    let base = loserTricks === 0 ? 25 : 16;
    const is_kaput = loserTricks === 0;
    if (doubleLevel >= 2 && doubleLevel <= 4) {
      base *= doubleLevel;
    }
    return { base, is_kaput, is_qaid_normal: !is_kaput };
  }

  /** من يفوز بالأكلة حتى الآن (للأكلة الجارية) */
  _currentTrickWinner() {
    if (!this.current_trick.length) return null;
    return this.evaluate_trick()[0];
  }

  /** شريك اللاعب يفوز بالأكلة حالياً → يحق له التهريب دون إجبار الحكم */
  _isPartnerWinningTrick(player_idx) {
    if (this.bid.type === 'SUN' || !this.current_trick.length) return false;
    const winner = this._currentTrickWinner();
    return winner === (player_idx + 2) % 4;
  }

  _computeQaidProjects(winnerTeam, is_sun, idx_pts) {
    const raw_proj = { 1: 0, 2: 0 };
    for (let p_idx = 0; p_idx < 4; p_idx++) {
      const t_id = p_idx % 2 === 0 ? 1 : 2;
      if (t_id !== winnerTeam) continue;
      for (const proj of this.declared_projects[p_idx]) {
        raw_proj[t_id] += PROJECT_RAW_PTS[proj][idx_pts];
      }
    }
    if (!is_sun) {
      for (let p_idx = 0; p_idx < 4; p_idx++) {
        const t_id = p_idx % 2 === 0 ? 1 : 2;
        if (t_id === winnerTeam && this.baloot_announced[p_idx]) {
          raw_proj[winnerTeam] += PROJECT_RAW_PTS.بلوت[idx_pts];
        }
      }
    }
    return raw_proj;
  }

  seatTeam(seat) {
    return seat % 2 === 0 ? 1 : 2;
  }

  /** حكم مُدَبَّل ومقفل: يُمنع فتح الأكلة بكرت حكم إن وُجد غير حكم في اليد */
  is_muqfal_lead_restricted() {
    return this.bid.type === 'HAKAM' && this.double_level > 1 && this.hakam_locked;
  }

  get_qaid_reasons() {
    const reasons = [...QAID_REASONS[isSunBid(this.bid) ? 'SUN' : 'HAKAM']];
    if (!this.is_muqfal_lead_restricted()) {
      return reasons.filter((r) => r !== 'ربع في المقفل');
    }
    return reasons;
  }

  isSunMode() {
    return isSunBid(this.bid);
  }

  can_declare_sawa(player_idx) {
    if (this.phase !== GamePhase.PLAYING) return false;
    if (this.turn !== player_idx) return false;
    if (this.current_trick.length > 0) return false;
    if (this.sawa_declaration) return false;
    const n = this.hands[player_idx]?.length ?? 0;
    return n > 0 && n <= 4;
  }

  try_declare_sawa(player_idx) {
    if (!this.can_declare_sawa(player_idx)) {
      return { error: 'السوا متاح فقط في دورك مع 4 كروت أو أقل وبداية أكلة فارغة' };
    }
    const team = this.seatTeam(player_idx);
    this.sawa_declaration = {
      seat: player_idx,
      team,
      trick_count: this.trick_count,
      phase: 'reveal',
      declared_at: Date.now(),
      objection_started_at: null,
    };
    return { ok: true, team, seat: player_idx };
  }

  clear_sawa_declaration() {
    this.sawa_declaration = null;
  }

  validate_sawa_correctness(declaring_seat) {
    return !this._withSimSnapshot(() => this._canSawaBeInvalidated(declaring_seat));
  }

  _canSawaBeInvalidated(declaring_seat) {
    if (this.current_trick.length === 4) {
      const [winner_idx] = this.evaluate_trick();
      const declarerTeam = this.seatTeam(declaring_seat);
      const winnerTeam = this.seatTeam(winner_idx);
      const declarerPlayed = this.current_trick.some((t) => t.player === declaring_seat);

      if (winnerTeam !== declarerTeam) {
        this._resolveTrickSim();
        return true;
      }
      if (declarerPlayed && winner_idx !== declaring_seat) {
        this._resolveTrickSim();
        return true;
      }

      this._resolveTrickSim();
      if (this._handsEmpty()) return false;
      return this._canSawaBeInvalidated(declaring_seat);
    }

    if (this._handsEmpty()) return false;

    const player = this.turn;
    if (player < 0) return false;

    const legal = this.get_legal_cards(player);
    if (!legal.length) return false;

    const declarerTeam = this.seatTeam(declaring_seat);
    const isDeclarer = player === declaring_seat;
    const isOpponent = this.seatTeam(player) !== declarerTeam;

    if (isDeclarer) {
      for (const idx of legal) {
        const snap = this._snapshotForSim();
        this._playCardSim(player, idx);
        const fails = this._canSawaBeInvalidated(declaring_seat);
        this._restoreFromSim(snap);
        if (!fails) return false;
      }
      return true;
    }

    if (isOpponent) {
      for (const idx of legal) {
        const snap = this._snapshotForSim();
        this._playCardSim(player, idx);
        const fails = this._canSawaBeInvalidated(declaring_seat);
        this._restoreFromSim(snap);
        if (fails) return true;
      }
      return false;
    }

    for (const idx of legal) {
      const snap = this._snapshotForSim();
      this._playCardSim(player, idx);
      const fails = this._canSawaBeInvalidated(declaring_seat);
      this._restoreFromSim(snap);
      if (fails) return true;
    }
    return false;
  }

  _snapshotForSim() {
    return {
      hands: this.hands.map((h) => h.map((c) => ({ ...c }))),
      current_trick: this.current_trick.map((t) => ({ player: t.player, card: { ...t.card } })),
      turn: this.turn,
      trick_count: this.trick_count,
      played_cards: this.played_cards.map((c) => ({ ...c })),
      trick_akka_player: this.trick_akka_player,
      tricks_won: { ...this.tricks_won },
      round_points: { ...this.round_points },
    };
  }

  _restoreFromSim(snap) {
    this.hands = snap.hands.map((h) => h.map((c) => ({ ...c })));
    this.current_trick = snap.current_trick.map((t) => ({ player: t.player, card: { ...t.card } }));
    this.turn = snap.turn;
    this.trick_count = snap.trick_count;
    this.played_cards = snap.played_cards.map((c) => ({ ...c }));
    this.trick_akka_player = snap.trick_akka_player;
    this.tricks_won = { ...snap.tricks_won };
    this.round_points = { ...snap.round_points };
  }

  _withSimSnapshot(fn) {
    const snap = this._snapshotForSim();
    try {
      return fn();
    } finally {
      this._restoreFromSim(snap);
    }
  }

  _handsEmpty() {
    return this.hands.every((h) => h.length === 0);
  }

  _resolveTrickSim() {
    const [winner_idx] = this.evaluate_trick();
    const win_team = winner_idx % 2 === 0 ? 1 : 2;
    this.round_points[win_team] += this._trickPoints();
    this.current_trick = [];
    this.turn = winner_idx;
    this.trick_akka_player = null;
    this.trick_count += 1;
    this.tricks_won[win_team] += 1;
    return winner_idx;
  }

  _trickPoints() {
    const is_sun = this.bid.type === 'SUN';
    const hakam_suit = this.bid.suit;
    let pts = 0;
    for (const item of this.current_trick) {
      const { card } = item;
      pts += is_sun ? SUN_VALUES[card.rank] : card.suit === hakam_suit ? HAKAM_VALUES[card.rank] : SUN_VALUES[card.rank];
    }
    return pts;
  }

  _playCardSim(player_idx, card_index) {
    const card = this.hands[player_idx][card_index];
    if (this.is_akka(card)) this.trick_akka_player = player_idx;
    this.hands[player_idx].splice(card_index, 1);
    this.current_trick.push({ player: player_idx, card, angle: 0, dx: 0, dy: 0 });
    this.played_cards.push({ ...card });
    if (this.current_trick.length < 4) {
      this.turn = this.get_next_turn(this.turn);
    } else {
      this.turn = -1;
    }
  }

  _canOpponentsStealTrick(declarerTeam) {
    if (this.current_trick.length === 4) {
      const [winner_idx] = this.evaluate_trick();
      const winnerTeam = this.seatTeam(winner_idx);
      this._resolveTrickSim();
      if (winnerTeam !== declarerTeam) return true;
      if (this._handsEmpty()) return false;
      return this._canOpponentsStealTrick(declarerTeam);
    }

    if (this._handsEmpty()) return false;

    const player = this.turn;
    if (player < 0) return false;

    const legal = this.get_legal_cards(player);
    if (!legal.length) return false;
    const onDeclarerSide = this.seatTeam(player) === declarerTeam;

    if (!onDeclarerSide) {
      for (const idx of legal) {
        const snap = this._snapshotForSim();
        this._playCardSim(player, idx);
        const stolen = this._canOpponentsStealTrick(declarerTeam);
        this._restoreFromSim(snap);
        if (stolen) return true;
      }
      return false;
    }

    for (const idx of legal) {
      const snap = this._snapshotForSim();
      this._playCardSim(player, idx);
      const stolen = this._canOpponentsStealTrick(declarerTeam);
      this._restoreFromSim(snap);
      if (!stolen) return false;
    }
    return true;
  }

  validate_qaid_sawa(objector_team) {
    if (!this.sawa_declaration) return { error: 'لا يوجد سوا معلن للاعتراض عليه' };
    if (this.sawa_declaration.phase !== 'objection') {
      return { error: 'انتظر انتهاء عرض كروت السوا' };
    }
    const { seat, team } = this.sawa_declaration;
    if (objector_team === team) return { error: 'لا يمكن اعتراض سوا فريقك' };
    const sawaValid = this.validate_sawa_correctness(seat);
    this.clear_sawa_declaration();
    if (!sawaValid) {
      return { valid: true, win_team: objector_team, mistake_team: team, sawa_was_valid: false };
    }
    return { valid: false, win_team: team, mistake_team: objector_team, sawa_was_valid: true };
  }

  finalize_bid(player_idx, action_type, selected_suit = null) {
    const is_ashkal = action_type === 'ASHKAL';
    const suit = action_type === 'HAKAM' ? selected_suit : null;
    this.bid = {
      type: action_type === 'SUN' || action_type === 'ASHKAL' ? 'SUN' : 'HAKAM',
      suit,
      bidder: player_idx,
      is_ashkal,
    };
    this.buyer_seat = player_idx;
    this.last_doubling_seat = null;
    this.buyer_team = player_idx % 2 === 0 ? 1 : 2;
    this.round_floor_card = this.floor_card
      ? { suit: this.floor_card.suit, rank: this.floor_card.rank }
      : null;
    this._deal_second_phase(is_ashkal, player_idx);
    if (this.bid.type === 'SUN' && this._isSunOver100Special(this.buyer_team)) {
      this.sun_over100_special = true;
      this.phase = GamePhase.DOUBLING;
      this.pass_count = 0;
      this.turn = this._firstDefenderAfterBidder(player_idx);
      return;
    }
    if (this.bid.type === 'SUN') {
      this.phase = GamePhase.PLAYING;
      this.turn = this.get_next_turn(this.dealer_idx);
    } else {
      this.phase = GamePhase.DOUBLING;
      this.turn = this.get_next_turn(this.bid.bidder);
      this.pass_count = 0;
    }
  }

  _getProjectDetails(player_idx) {
    const hand = this.initial_project_hands[player_idx];
    if (hand.length < 8) return [];
    const is_sun = this.bid.type === 'SUN';
    const projects = [];
    const rank_counts = {};
    for (const r of RANK_ORDER_PROJECTS) rank_counts[r] = [];
    for (const c of hand) rank_counts[c.rank].push(c);
    for (const rank of RANK_ORDER_PROJECTS) {
      const cards = rank_counts[rank];
      if (cards.length === 4) {
        if (rank === 'A' && is_sun) projects.push({ name: 'أربعمية', cards: [...cards] });
        else if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) projects.push({ name: 'مية', cards: [...cards] });
      }
    }
    const suits_groups = {};
    for (const s of SUITS) suits_groups[s] = [];
    for (const c of hand) suits_groups[c.suit].push(c);
    for (const suit of SUITS) {
      const cards = suits_groups[suit];
      if (cards.length < 3) continue;
      cards.sort((a, b) => RANK_ORDER_PROJECTS.indexOf(a.rank) - RANK_ORDER_PROJECTS.indexOf(b.rank));
      let current_seq = [cards[0]];
      for (let i = 1; i < cards.length; i++) {
        if (RANK_ORDER_PROJECTS.indexOf(cards[i].rank) === RANK_ORDER_PROJECTS.indexOf(current_seq[current_seq.length - 1].rank) + 1) {
          current_seq.push(cards[i]);
        } else {
          if (current_seq.length >= 3) {
            const name = current_seq.length >= 5 ? 'مية' : current_seq.length === 4 ? 'خمسين' : 'سرا';
            projects.push({ name, cards: [...current_seq] });
          }
          current_seq = [cards[i]];
        }
      }
      if (current_seq.length >= 3) {
        const name = current_seq.length >= 5 ? 'مية' : current_seq.length === 4 ? 'خمسين' : 'سرا';
        projects.push({ name, cards: [...current_seq] });
      }
    }
    return projects;
  }

  declare_project(player_idx, proj_name) {
    const details = this._getProjectDetails(player_idx);
    const available_names = details.map((p) => p.name);
    if (this.declared_projects[player_idx].filter((n) => n === proj_name).length < available_names.filter((n) => n === proj_name).length) {
      this.declared_projects[player_idx].push(proj_name);
      return true;
    }
    return false;
  }

  apply_project_declarations(player_idx, counts = {}) {
    if (this.played_in_trick1[player_idx]) return { valid: [] };
    this.played_in_trick1[player_idx] = true;

    const details = this._getProjectDetails(player_idx);
    const requested = [];
    for (const name of ['سرا', 'خمسين', 'مية', 'أربعمية']) {
      const max = name === 'أربعمية' ? 1 : 2;
      const n = Math.min(Math.max(0, counts[name] || 0), max);
      for (let i = 0; i < n; i++) requested.push(name);
    }

    const valid = [];
    const remaining = [...requested];
    for (const d of details) {
      const idx = remaining.indexOf(d.name);
      if (idx !== -1) {
        valid.push(d.name);
        remaining.splice(idx, 1);
      }
    }
    this.declared_projects[player_idx] = valid;
    return { valid };
  }

  get_active_project_spread(player_idx) {
    const handCount = this.hands[player_idx]?.length ?? 0;
    if (handCount <= 6) return [];

    if (this.trick_count !== 2) return [];
    const team = player_idx % 2 === 0 ? 1 : 2;
    if (this.winning_project_team !== team) return [];
    if (!this.declared_projects[player_idx]?.length) return [];
    if (this.played_in_trick2[player_idx]) return [];

    return this.get_declared_project_cards(player_idx);
  }

  get_public_project_state() {
    if (this.phase !== GamePhase.PLAYING) {
      return {
        spreads: { 0: [], 1: [], 2: [], 3: [] },
        reveals: { 0: null, 1: null, 2: null, 3: null },
        declared_project_names: { 0: [], 1: [], 2: [], 3: [] },
        played_in_trick1: { ...this.played_in_trick1 },
        played_in_trick2: { ...this.played_in_trick2 },
      };
    }
    const spreads = {};
    const reveals = {};
    const declared_project_names = {};
    for (let i = 0; i < 4; i++) {
      const handCount = this.hands[i]?.length ?? 0;
      declared_project_names[i] = [...(this.declared_projects[i] || [])];
      spreads[i] = this.get_active_project_spread(i);
      if (handCount > 6 && this.project_reveals_public[i]) {
        reveals[i] = this.project_reveals_public[i];
      } else {
        reveals[i] = null;
      }
    }
    return {
      spreads,
      reveals,
      declared_project_names,
      played_in_trick1: { ...this.played_in_trick1 },
      played_in_trick2: { ...this.played_in_trick2 },
    };
  }

  _evaluateWinningProjects() {
    let t1_best = [0, -1];
    let t2_best = [0, -1];
    const proj_weights = { سرا: 1, خمسين: 2, مية: 3, أربعمية: 4 };
    for (let p_idx = 0; p_idx < 4; p_idx++) {
      const declared = [...this.declared_projects[p_idx]];
      if (!declared.length) continue;
      for (const p_det of this._getProjectDetails(p_idx)) {
        const idx = declared.indexOf(p_det.name);
        if (idx !== -1) {
          declared.splice(idx, 1);
          const weight = proj_weights[p_det.name];
          const max_rank_idx = Math.max(...p_det.cards.map((c) => RANK_ORDER_PROJECTS.indexOf(c.rank)));
          const score_tuple = [weight, max_rank_idx];
          if (p_idx % 2 === 0) t1_best = score_tuple[0] > t1_best[0] || (score_tuple[0] === t1_best[0] && score_tuple[1] > t1_best[1]) ? score_tuple : t1_best;
          else t2_best = score_tuple[0] > t2_best[0] || (score_tuple[0] === t2_best[0] && score_tuple[1] > t2_best[1]) ? score_tuple : t2_best;
        }
      }
    }
    if (t1_best[0] === 0 && t2_best[0] === 0) this.winning_project_team = null;
    else if (t1_best[0] > t2_best[0] || (t1_best[0] === t2_best[0] && t1_best[1] > t2_best[1])) this.winning_project_team = 1;
    else if (t2_best[0] > t1_best[0] || (t2_best[0] === t1_best[0] && t2_best[1] > t1_best[1])) this.winning_project_team = 2;
    else this.winning_project_team = this.buyer_team;
  }

  get_declared_project_cards(player_idx) {
    const pTeam = player_idx % 2 === 0 ? 1 : 2;
    if (this.winning_project_team !== pTeam) return [];
    const declared_names = [...this.declared_projects[player_idx]];
    const cards_to_show = [];
    for (const p of this._getProjectDetails(player_idx)) {
      const idx = declared_names.indexOf(p.name);
      if (idx !== -1) {
        cards_to_show.push(...p.cards);
        declared_names.splice(idx, 1);
      }
    }
    const seen = new Set();
    return cards_to_show.filter((c) => {
      const k = cardKey(c);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  is_akka(card) {
    if (this.current_trick.length > 0) return false;
    if (this.bid.type !== 'HAKAM' || card.suit === this.bid.suit) return false;
    const stronger_ranks = SUN_RANKING.slice(0, SUN_RANKING.indexOf(card.rank));
    for (const r of stronger_ranks) {
      const stronger_card = createCard(card.suit, r);
      if (!this.played_cards.some((c) => cardEquals(c, stronger_card))) return false;
    }
    return true;
  }

  _classifyMistake(player_idx, card_index) {
    const hand = this.hands[player_idx];
    const card = hand[card_index];

    if (!this.current_trick.length) {
      if (this.is_muqfal_lead_restricted() && card.suit === this.bid.suit) {
        const hasNonTrump = hand.some((c) => c.suit !== this.bid.suit);
        if (hasNonTrump) return 'ربع في المقفل';
      }
    }

    const legal_moves = this.get_legal_cards(player_idx);
    if (legal_moves.includes(card_index)) return null;

    if (!this.current_trick.length) {
      return 'قاطع';
    }

    const lead_suit = this.current_trick[0].card.suit;
    const is_sun = this.bid.type === 'SUN';
    const hakam_suit = this.bid.suit;

    if (is_sun) return 'قاطع';

    const hasLeadSuit = hand.some((c) => c.suit === lead_suit);
    const hasTrump = hand.some((c) => c.suit === hakam_suit);
    const trickHasTrump = this.current_trick.some((t) => t.card.suit === hakam_suit);

    if (lead_suit === hakam_suit) {
      if (card.suit !== hakam_suit) return 'قاطع';
      return 'ما كبر بالحكم';
    }

    if (hasLeadSuit) return 'قاطع';

    const partner_idx = (player_idx + 2) % 4;
    const is_partner_akka = this.trick_akka_player === partner_idx;
    const partnerWinning = this._isPartnerWinningTrick(player_idx);
    if (hasTrump && !is_partner_akka && !partnerWinning) {
      const hakam_card_idxs = hand.map((c, i) => (c.suit === hakam_suit ? i : -1)).filter((i) => i >= 0);
      if (card.suit !== hakam_suit) return 'ما دق بالحكم';
      if (trickHasTrump) {
        const trick_hakams = this.current_trick.filter((t) => t.card.suit === hakam_suit);
        const best_hakam_idx = Math.min(...trick_hakams.map((t) => HAKAM_RANKING.indexOf(t.card.rank)));
        const can_over = hakam_card_idxs.some((i) => HAKAM_RANKING.indexOf(hand[i].rank) < best_hakam_idx);
        if (can_over && HAKAM_RANKING.indexOf(card.rank) >= best_hakam_idx) return 'ما كبر بالحكم';
      }
      return 'ما دق بالحكم';
    }

    return 'قاطع';
  }

  get_legal_cards(player_idx) {
    const hand = this.hands[player_idx];
    if (!this.current_trick.length) {
      return hand.map((_, i) => i);
    }

    const lead_suit = this.current_trick[0].card.suit;
    const is_sun = this.bid.type === 'SUN';
    const hakam_suit = this.bid.suit;
    const cards_of_lead = hand.map((c, i) => (c.suit === lead_suit ? i : -1)).filter((i) => i >= 0);

    if (is_sun) return cards_of_lead.length ? cards_of_lead : hand.map((_, i) => i);

    if (lead_suit === hakam_suit) {
      if (cards_of_lead.length) {
        const trick_hakams = this.current_trick.filter((t) => t.card.suit === hakam_suit);
        const best_rank_idx = trick_hakams.length
          ? Math.min(...trick_hakams.map((t) => HAKAM_RANKING.indexOf(t.card.rank)))
          : 99;
        const over_trumps = cards_of_lead.filter((i) => HAKAM_RANKING.indexOf(hand[i].rank) < best_rank_idx);
        return over_trumps.length ? over_trumps : cards_of_lead;
      }
      return hand.map((_, i) => i);
    }

    if (cards_of_lead.length) return cards_of_lead;

    const partner_idx = (player_idx + 2) % 4;
    const is_partner_akka = this.trick_akka_player === partner_idx;
    const partnerWinning = this._isPartnerWinningTrick(player_idx);
    const hakam_cards = hand.map((c, i) => (c.suit === hakam_suit ? i : -1)).filter((i) => i >= 0);

    if (hakam_cards.length && !is_partner_akka && !partnerWinning) {
      const trick_hakams = this.current_trick.filter((t) => t.card.suit === hakam_suit);
      if (trick_hakams.length) {
        const best_hakam_idx = Math.min(...trick_hakams.map((t) => HAKAM_RANKING.indexOf(t.card.rank)));
        const over_trumps = hakam_cards.filter((i) => HAKAM_RANKING.indexOf(hand[i].rank) < best_hakam_idx);
        return over_trumps.length ? over_trumps : hakam_cards;
      }
      return hakam_cards;
    }

    return hand.map((_, i) => i);
  }

  get_bot_best_move(bot_idx) {
    const { chooseBotCard } = require('./botBrain');
    return chooseBotCard(this, bot_idx);
  }

  get_bot_bid_action(bot_idx) {
    const { chooseBotBid } = require('./botBrain');
    return chooseBotBid(this, bot_idx);
  }

  evaluate_trick() {
    const lead_suit = this.current_trick[0].card.suit;
    let winner_idx = this.current_trick[0].player;
    let winning_card = this.current_trick[0].card;
    let trick_points = 0;
    const is_sun = this.bid.type === 'SUN';
    const hakam_suit = this.bid.suit;

    for (const item of this.current_trick) {
      const { player: player_idx, card } = item;
      trick_points += is_sun ? SUN_VALUES[card.rank] : card.suit === hakam_suit ? HAKAM_VALUES[card.rank] : SUN_VALUES[card.rank];

      if (is_sun) {
        if (
          card.suit === lead_suit
          && SUN_RANKING.indexOf(card.rank) < SUN_RANKING.indexOf(winning_card.rank)
        ) {
          winning_card = card;
          winner_idx = player_idx;
        }
      } else if (winning_card.suit === hakam_suit) {
        if (card.suit === hakam_suit && HAKAM_RANKING.indexOf(card.rank) < HAKAM_RANKING.indexOf(winning_card.rank)) {
          winning_card = card;
          winner_idx = player_idx;
        }
      } else if (card.suit === hakam_suit) {
        winning_card = card;
        winner_idx = player_idx;
      } else if (
        card.suit === lead_suit
        && SUN_RANKING.indexOf(card.rank) < SUN_RANKING.indexOf(winning_card.rank)
      ) {
        winning_card = card;
        winner_idx = player_idx;
      }
    }

    return [winner_idx, trick_points];
  }

  play_card(player_idx, card_index) {
    if (this.phase !== GamePhase.PLAYING || this.turn !== player_idx) return false;
    if (this.sawa_declaration) return false;
    if (card_index < 0 || card_index >= this.hands[player_idx].length) return false;
    if (this.current_trick.length >= 4) return false;

    const legal_moves = this.get_legal_cards(player_idx);
    const mistakeType = this._classifyMistake(player_idx, card_index);
    const is_mistake = !legal_moves.includes(card_index) || mistakeType !== null;
    const card = this.hands[player_idx][card_index];

    if (is_mistake) {
      const legal_cards = legal_moves.map((i) => this.hands[player_idx][i]);
      this.mistakes.push({
        player: player_idx,
        played_card: { ...card },
        legal_cards_held: legal_cards,
        type: mistakeType || 'قاطع',
      });
    }

    if (this.trick_count === 2 && !this.played_in_trick2[player_idx]) {
      const team = player_idx % 2 === 0 ? 1 : 2;
      if (this.winning_project_team === team) {
        const spread = this.get_declared_project_cards(player_idx);
        if (spread.length) {
          this.project_reveals_public[player_idx] = {
            cards: spread.map((c) => ({ ...c })),
            names: [...this.declared_projects[player_idx]],
          };
        }
      }
      this.played_in_trick2[player_idx] = true;
    }

    if (this.is_akka(card)) this.trick_akka_player = player_idx;

    this._last_play_chat_bubbles = this.getPlayChatBubbles(player_idx, card);

    const angle = 0;
    const dx = 0;
    const dy = 0;
    this.hands[player_idx].splice(card_index, 1);
    this.current_trick.push({ player: player_idx, card, angle, dx, dy });
    this.played_cards.push({ ...card });

    if (this.current_trick.length < 4) {
      this.turn = this.get_next_turn(this.turn);
    } else {
      this.turn = -1;
    }
    return true;
  }

  resolve_trick() {
    this.trick_history.push(this.current_trick.map((t) => ({ ...t, card: { ...t.card } })));
    const [winner_idx, trick_points] = this.evaluate_trick();
    const win_team = winner_idx % 2 === 0 ? 1 : 2;
    this.round_points[win_team] += trick_points;
    this.current_trick = [];
    this.turn = winner_idx;
    this.trick_akka_player = null;
    if (this.trick_count === 1) this._evaluateWinningProjects();
    this.trick_count += 1;
    this.tricks_won[win_team] += 1;
    this.last_trick_winner_team = win_team;
    if (!this.hands[0].length) this.finalize_round();
    return winner_idx;
  }

  finalize_round(forced_win_team = null, end_reason = null, meta = {}) {
    const is_sun = this.bid.type === 'SUN';
    const idx_pts = is_sun ? 0 : 1;
    const buyer = this.buyer_team;
    const defender = buyer === 1 ? 2 : 1;
    const raw_tricks = { 1: this.round_points[1], 2: this.round_points[2] };
    const ground_pts = this._computeGroundPoints(forced_win_team, end_reason);
    this.project_reveals_public = { 0: null, 1: null, 2: null, 3: null };
    const raw_proj = this._computeRoundProjects(is_sun, idx_pts);
    const abnat = {
      1: raw_tricks[1] + ground_pts[1] + raw_proj[1],
      2: raw_tricks[2] + ground_pts[2] + raw_proj[2],
    };
    const base_final = {
      1: this._abnatToBoardScore(abnat[1], is_sun),
      2: this._abnatToBoardScore(abnat[2], is_sun),
    };
    let is_kaput = false;
    let kaput_team = null;
    let is_sawa = false;
    let sawa_team = null;
    let is_qaid = false;
    let is_qaid_normal = false;
    const is_doubled = this.double_level > 1;
    let is_fall = false;
    const final_round_score = { 1: 0, 2: 0 };

    const winnerProjScore = (winnerTeam) => this._projectsBoardScore(raw_proj[winnerTeam], is_sun);

    if (forced_win_team !== null) {
      const winner = forced_win_team;
      const sawaEnd = end_reason === 'sawa' || end_reason === 'qaid_sawa';

      if (sawaEnd) {
        is_sawa = true;
        sawa_team = winner;
        final_round_score[winner] = kaputBaseScore(is_sun) + winnerProjScore(winner);
        final_round_score[3 - winner] = 0;
      } else if (end_reason === 'qaid') {
        const loserTricks = meta.qaid_loser_tricks ?? this.tricks_won[3 - winner];
        const qaidScore = this._qaidForcedScore(is_sun, loserTricks, this.double_level);
        is_kaput = qaidScore.is_kaput;
        is_qaid = true;
        is_qaid_normal = qaidScore.is_qaid_normal;
        if (is_kaput) kaput_team = winner;
        const qaidProj = this._computeQaidProjects(winner, is_sun, idx_pts);
        raw_proj[1] = winner === 1 ? qaidProj[1] : 0;
        raw_proj[2] = winner === 2 ? qaidProj[2] : 0;
        final_round_score[winner] = qaidScore.base + this._projectsBoardScore(qaidProj[winner], is_sun);
        final_round_score[3 - winner] = 0;
      } else {
        is_kaput = true;
        kaput_team = winner;
        final_round_score[winner] = kaputBaseScore(is_sun) + winnerProjScore(winner);
        final_round_score[3 - winner] = 0;
      }
    } else {
      if (this.tricks_won[1] === 8) {
        is_kaput = true;
        kaput_team = 1;
      } else if (this.tricks_won[2] === 8) {
        is_kaput = true;
        kaput_team = 2;
      }
      if (is_kaput) {
        final_round_score[kaput_team] = kaputBaseScore(is_sun) + winnerProjScore(kaput_team);
        final_round_score[3 - kaput_team] = 0;
      } else {
        const settled = settleNormalRound({
          baseFinal: base_final,
          buyerTeam: buyer,
          isDoubled: is_doubled,
          doubleLevel: this.double_level,
          sunOver100Special: this.sun_over100_special,
        });
        final_round_score[1] = settled.scores[1];
        final_round_score[2] = settled.scores[2];
        is_fall = settled.is_fall;
      }
    }
    this.total_scores[1] += final_round_score[1];
    this.total_scores[2] += final_round_score[2];
    const is_qahwa = this.double_level === 5;
    if (is_qahwa) {
      let rw = forced_win_team ?? kaput_team ?? null;
      if (rw === null) {
        if (final_round_score[1] > final_round_score[2]) rw = 1;
        else if (final_round_score[2] > final_round_score[1]) rw = 2;
        else rw = base_final[buyer] > base_final[defender] ? buyer : defender;
      }
      this.total_scores[1] -= final_round_score[1];
      this.total_scores[2] -= final_round_score[2];
      final_round_score[1] = rw === 1 ? SCORING.GAHWA_POINTS : 0;
      final_round_score[2] = rw === 2 ? SCORING.GAHWA_POINTS : 0;
      this.total_scores[1] += final_round_score[1];
      this.total_scores[2] += final_round_score[2];
    }
    let match_winner = null;
    if (is_qahwa) {
      match_winner = final_round_score[1] === 152 ? 1 : 2;
    } else if (this.total_scores[1] >= 152) {
      match_winner = 1;
    } else if (this.total_scores[2] >= 152) {
      match_winner = 2;
    }
    this.summary_data = {
      raw_tricks,
      ground: ground_pts,
      projects: raw_proj,
      abnat,
      base_final,
      final: final_round_score,
      is_kaput,
      kaput_team,
      is_sawa,
      sawa_team,
      is_qaid,
      is_qaid_normal,
      end_reason,
      is_fall,
      is_doubled,
      multiplier: this.double_level,
      buyer,
      buyer_seat: this.buyer_seat ?? this.bid?.bidder ?? null,
      bid_type: this.bid?.type ?? null,
      bid_suit: this.bid?.suit ?? null,
      floor_card: this.round_floor_card ? { ...this.round_floor_card } : null,
      is_sun: is_sun,
      is_qahwa,
      sun_over100_special: this.sun_over100_special,
      match_winner,
      total_scores: { ...this.total_scores },
    };
    this.phase = GamePhase.SCORE_SUMMARY;
    this.turn = -1;
  }

  validate_qaid(reason, selected_cards, objector_team) {
    const other_team = objector_team === 1 ? 2 : 1;
    reason = normalizeQaidReason(reason);

    if (reason === 'ربع في المقفل') {
      if (!this.is_muqfal_lead_restricted()) {
        return { valid: false, win_team: other_team, mistake_team: objector_team };
      }
      const hakamSuit = this.bid.suit;
      for (const mistake of this.mistakes) {
        if (mistake.type !== 'ربع في المقفل') continue;
        if (!qaidProofMatches(mistake, selected_cards, { muqfalProof: true, hakamSuit })) continue;
        if (selected_cards.length < 2) {
          return { valid: false, win_team: other_team, mistake_team: objector_team };
        }
        return {
          valid: true,
          win_team: objector_team,
          mistake_team: this.seatTeam(mistake.player),
        };
      }
      return { valid: false, win_team: other_team, mistake_team: objector_team };
    }

    if (!this.mistakes.length) {
      return { valid: false, win_team: other_team, mistake_team: objector_team };
    }

    for (const mistake of this.mistakes) {
      if (mistake.type && normalizeQaidReason(reason) !== normalizeQaidReason(mistake.type)) {
        continue;
      }
      if (!qaidProofMatches(mistake, selected_cards)) continue;

      const needsProof = qaidNeedsProof(reason) || qaidNeedsProof(mistake.type);
      if (needsProof && selected_cards.length < 2) {
        return { valid: false, win_team: other_team, mistake_team: objector_team };
      }

      return {
        valid: true,
        win_team: objector_team,
        mistake_team: this.seatTeam(mistake.player),
      };
    }

    return { valid: false, win_team: other_team, mistake_team: objector_team };
  }

  start_new_round() {
    this.dealer_idx = this.get_next_turn(this.dealer_idx);
    this.deal_cards();
  }

  isPreSecondDeal() {
    return !!this.hakam_pre_deal
      || this.phase === GamePhase.HAKAM_COUNTER
      || this.phase === GamePhase.HAKAM_CONFIRM;
  }

  getVisibleHand(seatIdx) {
    const hand = this.hands[seatIdx] || [];
    return this.isPreSecondDeal() ? hand.slice(0, 5) : hand;
  }

  getVisibleHandCount(seatIdx) {
    return this.getVisibleHand(seatIdx).length;
  }

  can_ashkal(player_idx) {
    const phaseOk = this.phase === GamePhase.PHASE_1 || this.phase === GamePhase.HAKAM_COUNTER;
    return phaseOk && (player_idx === this.dealer_idx || player_idx === (this.dealer_idx + 3) % 4);
  }

  get_available_bids(player_idx) {
    if (this.turn !== player_idx) return [];
    if (this.phase === GamePhase.PHASE_1) {
      const bids = [{ action: 'PASS', label: 'بس' }, { action: 'SUN', label: 'صن' }, { action: 'HAKAM', label: 'حكم', needsFloorSuit: true }];
      if (this.can_ashkal(player_idx)) bids.push({ action: 'ASHKAL', label: 'أشكل' });
      return bids;
    }
    if (this.phase === GamePhase.GABLAK_PHASE) {
      return [{ action: 'PASS', label: 'بس' }, { action: 'GABLAK', label: 'قبلك' }];
    }
    if (this.phase === GamePhase.HAKAM_COUNTER) {
      const bids = [{ action: 'PASS', label: 'بس' }, { action: 'SUN', label: 'صن' }];
      if (this.can_ashkal(player_idx)) bids.push({ action: 'ASHKAL', label: 'أشكل' });
      return bids;
    }
    if (this.phase === GamePhase.HAKAM_CONFIRM) {
      if (player_idx !== this.bid.bidder) return [];
      return [
        { action: 'CONFIRM_HAKAM', label: 'تأكيد حكم' },
        { action: 'SUN', label: 'صن' },
      ];
    }
    if (this.phase === GamePhase.PHASE_2) {
      return [{ action: 'PASS', label: 'ولا' }, { action: 'SUN', label: 'صن' }, { action: 'HAKAM', label: 'حكم ثاني', needsSuitPicker: true }];
    }
    if (this.phase === GamePhase.DOUBLING) {
      if (this.sun_over100_special) {
        const defenders = this._defenderSeats(this.bid.bidder);
        if (!defenders.includes(player_idx)) return [];
        const bids = [{ action: 'PASS', label: 'بس' }];
        if (this.double_level === 1) bids.push({ action: 'DOUBLE', label: 'دبل' });
        return bids;
      }
      const bids = [{ action: 'PASS', label: 'بس' }];
      const is_buyer = player_idx === this.bid.bidder;
      if (this.double_level === 1 && !is_buyer) bids.push({ action: 'DOUBLE', label: 'دبل', needsLockChoice: true });
      else if (this.double_level === 2 && is_buyer) bids.push({ action: 'THREE', label: 'ثري', needsLockChoice: true });
      else if (this.double_level === 3 && player_idx === this.doubler_idx) {
        bids.push({ action: 'FOUR', label: 'فور', needsLockChoice: true });
      }
      else if (this.double_level === 4 && is_buyer) bids.push({ action: 'GAHWA', label: 'قهوة' });
      return bids;
    }
    return [];
  }

  process_bidding(action_type, player_idx, selected_suit = null) {
    if (
      this.phase === GamePhase.PHASE_2
      && action_type === 'HAKAM'
      && selected_suit === this.floor_card?.suit
    ) {
      return { ok: false, error: 'حكم ثاني يجب أن يكون بلون مختلف عن كرت الأرض' };
    }

    if (this.phase === GamePhase.PHASE_1) {
      if (action_type === 'PASS') {
        this.pass_count += 1;
        if (this.pass_count === 4) {
          this.phase = GamePhase.PHASE_2;
          this.turn = this.get_next_turn(this.dealer_idx);
          this.pass_count = 0;
        } else {
          this.turn = this.get_next_turn(this.turn);
        }
      } else if (action_type === 'SUN') {
        if (this._isFirstBidder(player_idx)) {
          this.finalize_bid(player_idx, 'SUN');
        } else {
          this._enterGablakPhase(player_idx);
        }
      } else if (action_type === 'ASHKAL') {
        this.finalize_bid(player_idx, 'ASHKAL');
      } else {
        this.bid = {
          type: 'HAKAM',
          suit: this.floor_card.suit,
          bidder: player_idx,
          is_ashkal: false,
        };
        this.buyer_seat = player_idx;
        this.buyer_team = player_idx % 2 === 0 ? 1 : 2;
        this.phase = GamePhase.HAKAM_COUNTER;
        this.pass_count = 0;
        this.turn = this.get_next_turn(player_idx);
      }
    } else if (this.phase === GamePhase.HAKAM_COUNTER) {
      if (action_type === 'PASS') {
        this.pass_count += 1;
        if (this.pass_count >= 3) {
          this.phase = GamePhase.HAKAM_CONFIRM;
          this.turn = this.bid.bidder;
          this.pass_count = 0;
        } else {
          this.turn = this.get_next_turn(this.turn);
        }
      } else if (action_type === 'SUN') {
        if (this._isFirstBidder(player_idx)) {
          this.finalize_bid(player_idx, 'SUN');
        } else {
          this.buyer_team = player_idx % 2 === 0 ? 1 : 2;
          this._enterGablakPhase(player_idx);
        }
      } else if (action_type === 'ASHKAL') {
        this.finalize_bid(player_idx, 'ASHKAL');
      }
    } else if (this.phase === GamePhase.HAKAM_CONFIRM) {
      if (player_idx !== this.bid.bidder) {
        return { ok: false, error: 'ليس دور المشتري' };
      }
      if (action_type === 'SUN') {
        this.finalize_bid(player_idx, 'SUN');
      } else if (action_type === 'CONFIRM_HAKAM') {
        this.hakam_pre_deal = true;
        this.phase = GamePhase.DOUBLING;
        this.pass_count = 0;
        this.turn = this._firstDefenderAfterBidder(this.bid.bidder);
      }
    } else if (this.phase === GamePhase.GABLAK_PHASE) {
      if (this._isFirstBidder(player_idx)) {
        if (action_type === 'PASS') {
          this.finalize_bid(this.bid.bidder, 'SUN');
        } else if (action_type === 'GABLAK') {
          this.finalize_bid(player_idx, 'SUN');
        }
      } else if (action_type === 'PASS') {
        this.finalize_bid(this.bid.bidder, 'SUN');
      } else if (action_type === 'GABLAK') {
        this.bid.bidder = player_idx;
        const prev = this._bidOrderPrev(player_idx);
        if (prev === null) {
          this.finalize_bid(player_idx, 'SUN');
        } else {
          this.turn = prev;
        }
      }
    } else if (this.phase === GamePhase.PHASE_2) {
      if (action_type === 'PASS') {
        this.pass_count += 1;
        if (this.pass_count === 4) {
          this.start_new_round();
        } else {
          this.turn = this.get_next_turn(this.turn);
        }
      } else if (action_type === 'SUN') {
        this.finalize_bid(player_idx, 'SUN');
      } else {
        this.finalize_bid(player_idx, action_type, selected_suit);
      }
    }
    return { ok: true };
  }

  process_doubling(action_type, player_idx, locked = false) {
    const finishPlay = () => {
      if (this.hakam_pre_deal) {
        this.round_floor_card = this.floor_card
          ? { suit: this.floor_card.suit, rank: this.floor_card.rank }
          : null;
        this._deal_second_phase(false, this.bid.bidder, { preserveDouble: true });
        this.hakam_pre_deal = false;
      }
      this.phase = GamePhase.PLAYING;
      this.turn = this.get_next_turn(this.dealer_idx);
    };

    if (this.sun_over100_special) {
      const defenders = this._defenderSeats(this.bid.bidder);
      if (action_type === 'PASS') {
        if (player_idx === defenders[0]) {
          this.turn = defenders[1];
        } else {
          finishPlay();
        }
      } else if (action_type === 'DOUBLE') {
        this.double_level = 2;
        this.last_doubling_seat = player_idx;
        this.hakam_locked = false;
        finishPlay();
      }
      return { ok: true };
    }

    if (action_type === 'PASS') {
      if (this.double_level === 1) {
        this.pass_count += 1;
        if (this.pass_count === 1) {
          this.turn = (this.bid.bidder + 3) % 4;
        } else {
          finishPlay();
        }
      } else {
        this.buyer_seat = player_idx;
        finishPlay();
      }
    } else if (action_type === 'DOUBLE') {
      this.double_level = 2;
      this.doubler_idx = player_idx;
      this.last_doubling_seat = player_idx;
      this.hakam_locked = !!locked;
      this.turn = this.bid.bidder;
    } else if (action_type === 'THREE') {
      this.double_level = 3;
      this.last_doubling_seat = player_idx;
      this.hakam_locked = !!locked;
      this.turn = this.doubler_idx;
    } else if (action_type === 'FOUR') {
      this.double_level = 4;
      this.last_doubling_seat = player_idx;
      this.hakam_locked = !!locked;
      this.turn = this.bid.bidder;
    } else if (action_type === 'GAHWA') {
      this.double_level = 5;
      this.hakam_locked = false;
      this.buyer_seat = player_idx;
      this.last_doubling_seat = player_idx;
      if (this.hakam_pre_deal) {
        this.round_floor_card = this.floor_card
          ? { suit: this.floor_card.suit, rank: this.floor_card.rank }
          : null;
        this._deal_second_phase(false, this.bid.bidder, { preserveDouble: true });
        this.hakam_pre_deal = false;
      }
      this.phase = GamePhase.PLAYING;
      this.turn = this.get_next_turn(this.dealer_idx);
    }
    return { ok: true };
  }
}

module.exports = {
  BalootEngine,
  GamePhase,
  SUITS,
  SUIT_AR,
  QAID_REASONS,
  QAID_NEEDS_PROOF,
  normalizeQaidReason,
  qaidNeedsProof,
  qaidProofMatches,
  isSunBid,
  cardKey,
  cardEquals,
  SUN_VALUES,
  HAKAM_VALUES,
  PROJECT_RAW_PTS,
  SCORING,
  abnatToBoardScore,
  projectsBoardScore,
  kaputBaseScore,
  settleNormalRound,
};
