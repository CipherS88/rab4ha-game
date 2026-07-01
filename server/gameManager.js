const { BalootEngine, GamePhase, normalizeQaidReason, qaidNeedsProof } = require('./engine');
const { getSeatMeta } = require('./playerMeta');
const { getEquippedSessionBg, getDefaultSessionBgUrl } = require('./bag');
const { startMatch, logRound, endMatch } = require('./matchLog');
const { RadarMatchTracker, applyRadarMatchResults } = require('./playRadar');
const { chooseEmergencyCard } = require('./emergencyBot');
const { chooseBotProjects, botHasSawa } = require('./botBrain');
const {
  TABLE_GIFT_COST,
  isValidTableGiftId,
  getTableGiftEmoji,
  deductTableGiftCoins,
  pushTableGiftSlot,
} = require('./tableGifts');

const BOT_NAMES = ['خالد', 'سعود', 'فهد'];
const TURN_TIMEOUT_BOT = 900;
const TURN_TIMEOUT_HUMAN = 5000;
const TRICK_RESOLVE_DELAY = 400;
const SUMMARY_DELAY = 3500;
const MATCHMAKING_DELAY = 8000;
const SAWA_REVEAL_MS = 700;
const SAWA_OBJECTION_MS = 4000;
const QAID_SESSION_MS = 59000;
const IDLE_CLEANUP_MS = 30000;

function resolveGameMode(roomId) {
  if (roomId === 'match52') return 'match52';
  if (roomId === 'ranked') return 'ranked';
  if (roomId.startsWith('session_')) return 'session';
  return 'friendly';
}

function normalizeRoomId(roomId) {
  if (roomId === 'main') return 'friendly';
  return roomId || 'friendly';
}

/** غرفة خاصة لكل لاعب — ودية/solo مع بوتات لا تختلط مع غيرهم */
function resolveJoinRoomId(roomId, { solo = false, userId = null, socketId = null } = {}) {
  const key = userId ? String(userId) : (socketId ? `s_${socketId}` : 'guest');
  if (solo) return `solo_${key}`;
  if (roomId && String(roomId).startsWith('sandbox_')) return String(roomId);
  const norm = normalizeRoomId(roomId);
  if (norm === 'friendly') return `friendly_${key}`;
  return norm;
}

function isBotPracticeRoomId(roomId) {
  return roomId.startsWith('friendly_') || roomId.startsWith('solo_') || roomId.startsWith('sandbox_');
}

function isSandboxRoomId(roomId) {
  return roomId.startsWith('sandbox_');
}

class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.seats = [null, null, null, null]; // { id, name, isBot, socketId, userId }
    this.engine = null;
    this.status = 'lobby'; // lobby | playing
    this.botTimer = null;
    this.trickTimer = null;
    this.summaryTimer = null;
    this.sawaTimer = null;
    this.sawaRevealTimer = null;
    this.qaidSession = null;
    this.qaidSessionTimer = null;
    this.sawaObjectionRemainingMs = null;
    this.chatBubbles = {};
    this.tableGiftSlots = [[], [], [], []];
    this.onBroadcast = null;
    this.onAbandoned = null;
    this.idleCleanupTimer = null;
    this.soloMode = false;
    this.sandboxMode = isSandboxRoomId(roomId);
    this.gameMode = resolveGameMode(roomId);
    this.cardBackUrl = '/cards/back_dark.png';
    this.sessionBgUrl = getDefaultSessionBgUrl();
    this.stake = 0;
    this.sessionId = roomId.startsWith('session_') ? parseInt(roomId.slice(8), 10) : null;
    this.matchLogId = null;
    this.summaryLoggedForRound = false;
  }

  enrichSummaryData(summary) {
    if (!summary) return summary;
    const bidder = summary.buyer_seat;
    const seat = bidder != null ? this.seats[bidder] : null;
    return {
      ...summary,
      buyer_name: seat?.name || null,
      buyer_seat: bidder,
    };
  }

  setBroadcast(fn) {
    this.onBroadcast = fn;
  }

  setOnAbandoned(fn) {
    this.onAbandoned = fn;
  }

  isOrphaned() {
    if (this.isBotPracticeRoom()) return this.countConnectedHumans() === 0;
    if (this.soloMode || this.countConnectedHumans() > 0) return false;
    if (this.status === 'playing') return true;
    return this.seats.some((s) => s && !s.isBot);
  }

  isBotPracticeRoom() {
    return isBotPracticeRoomId(this.roomId) || this.soloMode;
  }

  countHumansInRoom() {
    return this.seats.filter((s) => s && !s.isBot).length;
  }

  scheduleIdleCleanup() {
    if (this.idleCleanupTimer) clearTimeout(this.idleCleanupTimer);
    this.idleCleanupTimer = setTimeout(() => {
      this.idleCleanupTimer = null;
      if (this.countConnectedHumans() > 0) return;
      if (!this.isOrphaned()) return;
      this.abandonInactiveRoom();
    }, IDLE_CLEANUP_MS);
  }

  cancelIdleCleanup() {
    if (this.idleCleanupTimer) {
      clearTimeout(this.idleCleanupTimer);
      this.idleCleanupTimer = null;
    }
  }

  abandonInactiveRoom({ reason = 'idle' } = {}) {
    this.clearTimers();
    this.clearSawaTimer();
    this.clearQaidSession();
    this.cancelIdleCleanup();
    const wasPlaying = this.status === 'playing';
    this.seats = [null, null, null, null];
    this.status = 'lobby';
    this.engine = null;
    this.soloMode = false;
    this.sandboxMode = isSandboxRoomId(this.roomId);
    this.chatBubbles = {};
    this.tableGiftSlots = [[], [], [], []];
    this.broadcast('room_abandoned', { reason, wasPlaying, roomId: this.roomId });
    if (this.onAbandoned) this.onAbandoned();
  }

  reclaimIfOrphaned() {
    if (this.isOrphaned()) this.abandonInactiveRoom();
  }

  broadcast(event, data) {
    if (this.onBroadcast) this.onBroadcast(event, data);
  }

  findSeatBySocket(socketId) {
    return this.seats.findIndex((s) => s && s.socketId === socketId);
  }

  findReconnectSeat(userId) {
    if (!userId) return -1;
    const key = String(userId);
    return this.seats.findIndex((s) => s && !s.isBot && String(s.userId) === key);
  }

  tryReconnect(socketId, userId, name) {
    const idx = this.findReconnectSeat(userId);
    if (idx < 0) return null;
    const seat = this.seats[idx];
    if (seat.socketId && seat.socketId !== socketId) {
      return { error: 'حسابك متصل من مكان آخر' };
    }
    seat.socketId = socketId;
    seat.disconnected = false;
    if (name) seat.name = String(name).slice(0, 20);
    if (seat.userId) seat.meta = getSeatMeta(seat.userId);
    this.cancelIdleCleanup();
    if (!this.soloMode) this.resolveSessionBackgroundFromPlayers();
    this.broadcast('room_update', this.getRoomState());
    if (this.status === 'playing') this.scheduleBotTurn();
    return { seat: idx, player: seat, reconnected: true };
  }

  countConnectedHumans() {
    return this.seats.filter((s) => s && !s.isBot && s.socketId).length;
  }

  shouldDestroy() {
    return !this.soloMode && this.countConnectedHumans() === 0;
  }

  applyRoomCosmetics({ cardBackUrl, sessionBgUrl, stake } = {}) {
    if (cardBackUrl) this.cardBackUrl = cardBackUrl;
    if (sessionBgUrl) this.sessionBgUrl = sessionBgUrl;
    if (stake != null) this.stake = stake;
  }

  makePlayer(socketId, name, userId = null) {
    const meta = userId ? getSeatMeta(userId) : null;
    return {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      isBot: false,
      socketId,
      userId: userId || null,
      meta,
    };
  }

  seatToPublic(s, i) {
    if (!s) return { idx: i, name: null, isBot: false };
    const botRanks = [
      { rank_label: 'متقدم ♣️♦️', rank_theme: 'gold' },
      { rank_label: 'مبتدئ ♣️', rank_theme: 'wood' },
      { rank_label: 'خبير ♣️♦️♠️', rank_theme: 'ruby' },
    ];
    const botRank = s.isBot ? botRanks[i % botRanks.length] : null;
    return {
      idx: i,
      name: s.name,
      isBot: !!s.isBot,
      avatar_url: s.meta?.avatar_url || null,
      deck_back_url: s.meta?.deck_back_url || null,
      deck_glow_color: s.meta?.deck_glow_color || null,
      star: s.meta?.star || null,
      rank_label: s.meta?.rank_label || s.meta?.rankLabel || botRank?.rank_label || null,
      rank_theme: s.meta?.rank_theme || s.meta?.rankTheme || botRank?.rank_theme || null,
    };
  }

  resolveSessionBackgroundFromPlayers() {
    const candidates = [];
    for (const seat of this.seats) {
      if (!seat || seat.isBot || !seat.userId) continue;
      const bg = getEquippedSessionBg(seat.userId);
      if (bg?.contributes_to_room && bg.image_url) candidates.push(bg);
    }
    const unique = [];
    const seen = new Set();
    for (const c of candidates) {
      if (seen.has(c.image_url)) continue;
      seen.add(c.image_url);
      unique.push(c);
    }
    const fallbackUrl = getDefaultSessionBgUrl();
    if (unique.length === 0) {
      this.sessionBgUrl = fallbackUrl;
    } else if (unique.length === 1) {
      this.sessionBgUrl = unique[0].image_url || fallbackUrl;
    } else {
      const pick = unique[Math.floor(Math.random() * unique.length)];
      this.sessionBgUrl = pick.image_url || fallbackUrl;
    }
  }

  joinSolo(socketId, name) {
    this.clearTimers();
    this.soloMode = true;
    this.status = 'lobby';
    this.engine = null;
    const seatLabels = ['يمين', 'فوق', 'يسار', 'أنت'];
    for (let i = 0; i < 4; i++) {
      this.seats[i] = {
        id: `solo_${i}`,
        name: `${name} (${seatLabels[i]})`,
        isBot: false,
        socketId,
      };
    }
    this.resolveSessionBackgroundFromPlayers();
    this.broadcast('room_update', this.getRoomState());
    setTimeout(() => {
      if (this.soloMode && this.status === 'lobby') this.startGame();
    }, 400);
    return { seat: 3, player: this.seats[3], soloMode: true };
  }

  resolveActingSeat(socketId, actAs = null) {
    if (this.soloMode) {
      if (actAs === null || actAs === undefined) return this.engine?.turn ?? 3;
      if (actAs >= 0 && actAs <= 3 && this.seats[actAs]?.socketId === socketId) return actAs;
      return -1;
    }
    return this.findSeatBySocket(socketId);
  }

  addPlayer(socketId, name, preferredSeat = null, userId = null) {
    if (this.soloMode) return { error: 'الغرفة في وضع التجربة الفردية' };
    if (this.status === 'playing') return { error: 'اللعبة جارية' };
    const existing = this.findSeatBySocket(socketId);
    if (existing >= 0) return { seat: existing, player: this.seats[existing] };

    if (this.isBotPracticeRoom()) {
      const reconnect = userId ? this.findReconnectSeat(userId) : -1;
      if (reconnect < 0 && this.countConnectedHumans() >= 1) {
        return { error: 'هذه غرفة خاصة — العب مع البوتات وحدك' };
      }
    }

    if (preferredSeat !== null && preferredSeat >= 0 && preferredSeat <= 3) {
      const occupant = this.seats[preferredSeat];
      if (occupant && !occupant.isBot) {
        if (occupant.socketId === socketId) return { seat: preferredSeat, player: occupant };
        return { error: `المقعد ${preferredSeat} مشغول — جرّب مقعداً آخر` };
      }
    }

    let seat = preferredSeat;
    if (seat === null || seat < 0 || seat > 3 || this.seats[seat]) {
      if (!this.seats[3]) seat = 3;
      else seat = this.seats.findIndex((s) => s === null);
    }
    if (seat < 0) return { error: 'الغرفة ممتلئة' };

    const player = this.makePlayer(socketId, name, userId);
    this.seats[seat] = player;
    this.cancelIdleCleanup();
    if (!this.soloMode) this.resolveSessionBackgroundFromPlayers();
    this.broadcast('room_update', this.getRoomState());
    this.checkAutoStart();
    return { seat, player };
  }

  removePlayer(socketId, options = {}) {
    const intentional = !!options.intentional;
    if (this.soloMode && this.seats.some((s) => s && s.socketId === socketId)) {
      this.abandonInactiveRoom({ reason: 'player_left' });
      return { type: 'solo_left' };
    }
    const idx = this.findSeatBySocket(socketId);
    if (idx < 0) return null;

    const player = this.seats[idx];
    if (this.isBotPracticeRoom() && player && !player.isBot) {
      this.abandonInactiveRoom({ reason: 'player_left' });
      return { type: 'bot_practice_ended', intentional };
    }
    const wasPlaying = this.status === 'playing';
    const leaverTeam = idx % 2 === 0 ? 1 : 2;
    const winnerTeam = leaverTeam === 1 ? 2 : 1;

    if (wasPlaying && this.gameMode === 'ranked' && player && !player.isBot && intentional) {
      const remaining = this.seats
        .map((s, i) => (s && !s.isBot && s.socketId && i !== idx
          ? { seat: i, userId: s.userId, socketId: s.socketId, team: i % 2 === 0 ? 1 : 2 }
          : null))
        .filter(Boolean);
      this.seats[idx] = null;
      this.endGameForfeit({
        leaverSeat: idx,
        leaverTeam,
        winnerTeam,
        leaverUserId: player.userId,
        remainingPlayers: remaining.filter((p) => p.team === winnerTeam),
      });
      return {
        type: 'ranked_forfeit',
        leaverSeat: idx,
        leaverTeam,
        winnerTeam,
        leaverUserId: player.userId,
        winnerUserIds: remaining.filter((p) => p.team === winnerTeam).map((p) => p.userId).filter(Boolean),
      };
    }

    if (wasPlaying && !intentional && player && !player.isBot) {
      this.seats[idx] = { ...player, socketId: null, disconnected: true };
      this.broadcast('room_update', this.getRoomState());
      if (this.countConnectedHumans() === 0) {
        this.scheduleIdleCleanup();
      }
      return { type: 'disconnected', seat: idx };
    }

    this.seats[idx] = null;
    this.broadcast('room_update', this.getRoomState());

    if (wasPlaying) {
      this.broadcast('player_left', { seat: idx, name: player?.name });
    }

    if (this.shouldDestroy()) {
      if (wasPlaying) this.clearTimers();
      this.status = 'lobby';
      this.engine = null;
      return { type: 'room_empty', wasPlaying, gameMode: this.gameMode };
    }

    return { type: 'left', seat: idx, player, intentional };
  }

  endGameForfeit({ leaverSeat, winnerTeam, leaverUserId, remainingPlayers }) {
    this.clearTimers();
    this.status = 'lobby';
    this.engine = null;
    this.broadcast('match_forfeit', {
      leaverSeat,
      winnerTeam,
      leaverUserId,
      penalty: 100,
      winPoints: 10,
      reason: 'leave',
    });
  }

  fillBots() {
    if (this.countConnectedHumans() !== 1) {
      return { error: 'يجب أن تكون وحدك في الغرفة لملء البوتات' };
    }
    if (this.countHumansInRoom() > 1) {
      return { error: 'لا يمكن ملء البوتات مع أكثر من لاعب' };
    }
    for (let i = 0; i < 4; i++) {
      if (!this.seats[i]) {
        this.seats[i] = {
          id: `bot_${i}`,
          name: BOT_NAMES[i % BOT_NAMES.length] + (i > 2 ? '' : ''),
          isBot: true,
          socketId: null,
        };
      }
    }
    this.broadcast('room_update', this.getRoomState());
    this.startGame();
    return { ok: true };
  }

  checkAutoStart() {
    const humans = this.seats.filter((s) => s && !s.isBot).length;
    if (humans === 4 && this.status === 'lobby') {
      setTimeout(() => {
        const h = this.seats.filter((s) => s && !s.isBot).length;
        if (h === 4 && this.status === 'lobby') this.startGame();
      }, 800);
    }
  }

  scheduleMatchmaking() {
    /* لا بوتات تلقائية — انتظر 4 لاعبين بشريين */
  }

  startGame() {
    if (this.seats.filter(Boolean).length < 4) return;
    this.cancelIdleCleanup();
    for (const seat of this.seats) {
      if (seat?.userId) seat.meta = getSeatMeta(seat.userId);
    }
    this.resolveSessionBackgroundFromPlayers();
    const mySeatDeck = this.seats.find((s) => s?.meta?.deck_back_url)?.meta?.deck_back_url;
    if (mySeatDeck) this.cardBackUrl = mySeatDeck;
    this.status = 'playing';
    const engineOpts = this.gameMode === 'match52'
      ? { initialScores: { 1: 52, 2: 52 }, matchMode: 'match52' }
      : {};
    this.engine = new BalootEngine(engineOpts);
    if (this.sandboxMode) {
      this.matchLogId = null;
      this.radarTracker = null;
    } else {
      this.matchLogId = startMatch(this);
      this.radarTracker = this.gameMode === 'ranked'
        ? new RadarMatchTracker(this.seats)
        : null;
    }
    this.summaryLoggedForRound = false;
    this.broadcast('game_start', { dealer_idx: this.engine.dealer_idx, gameMode: this.gameMode });
    this.broadcastState();
    this.scheduleBotTurn();
  }

  clearTimers() {
    if (this.botTimer) clearTimeout(this.botTimer);
    if (this.trickTimer) clearTimeout(this.trickTimer);
    if (this.summaryTimer) clearTimeout(this.summaryTimer);
    this.botTimer = null;
    this.trickTimer = null;
    this.summaryTimer = null;
  }

  clearSawaTimer() {
    if (this.sawaTimer) clearTimeout(this.sawaTimer);
    if (this.sawaRevealTimer) clearTimeout(this.sawaRevealTimer);
    this.sawaTimer = null;
    this.sawaRevealTimer = null;
  }

  startSawaObjectionTimer(remainingMs = SAWA_OBJECTION_MS) {
    if (this.sawaTimer) clearTimeout(this.sawaTimer);
    const decl = this.engine?.sawa_declaration;
    if (decl) {
      decl.objection_started_at = Date.now();
      decl.objection_deadline = Date.now() + remainingMs;
    }
    this.sawaObjectionRemainingMs = null;
    this.sawaTimer = setTimeout(() => {
      this._resolveSawaObjectionTimeout();
    }, remainingMs);
  }

  /** بعد انتهاء مهلة الاعتراض: سوا صحيح = فوز، سوا غلط = قيد تلقائي */
  _resolveSawaObjectionTimeout() {
    const e = this.engine;
    if (!e?.sawa_declaration || this.qaidSession) return;
    const decl = e.sawa_declaration;
    if (decl.phase !== 'objection') return;

    const sawaValid = e.validate_sawa_correctness(decl.seat);
    e.clear_sawa_declaration();
    this.clearSawaTimer();

    if (sawaValid) {
      e.finalize_round(decl.team, 'sawa');
    } else {
      const objectorTeam = decl.team === 1 ? 2 : 1;
      this.addChat(decl.seat, 'سوا غلط — قيد تلقائي');
      e.finalize_round(objectorTeam, 'qaid', {
        qaid_loser_tricks: e.tricks_won[decl.team],
      });
    }
    this.broadcastState();
    this.scheduleBotTurn();
  }

  /** فحص تلقائي فور بدء مرحلة الاعتراض — سوا غلط يُقيد مباشرة */
  _autoQaidInvalidSawa() {
    const e = this.engine;
    const decl = e?.sawa_declaration;
    if (!decl || decl.phase !== 'objection' || this.qaidSession) return false;

    const sawaValid = e.validate_sawa_correctness(decl.seat);
    if (sawaValid) return false;

    const objectorTeam = decl.team === 1 ? 2 : 1;
    e.clear_sawa_declaration();
    this.clearSawaTimer();
    this.addChat(decl.seat, 'سوا غلط — قيد تلقائي');
    e.finalize_round(objectorTeam, 'qaid', {
      qaid_loser_tricks: e.tricks_won[decl.team],
    });
    this.broadcastState();
    this.scheduleBotTurn();
    return true;
  }

  pauseSawaObjectionTimer() {
    if (!this.sawaTimer || !this.engine?.sawa_declaration) return;
    clearTimeout(this.sawaTimer);
    this.sawaTimer = null;
    const decl = this.engine.sawa_declaration;
    if (decl.objection_deadline) {
      this.sawaObjectionRemainingMs = Math.max(0, decl.objection_deadline - Date.now());
    }
  }

  resumeSawaObjectionTimer() {
    const remaining = this.sawaObjectionRemainingMs;
    this.sawaObjectionRemainingMs = null;
    if (!remaining || remaining <= 0) return;
    if (!this.engine?.sawa_declaration || this.engine.sawa_declaration.phase !== 'objection') return;
    if (this.qaidSession) return;
    this.startSawaObjectionTimer(remaining);
  }

  clearQaidSession() {
    if (this.qaidSessionTimer) clearTimeout(this.qaidSessionTimer);
    this.qaidSessionTimer = null;
    this.qaidSession = null;
  }

  canStartQaid(seatIdx) {
    const e = this.engine;
    if (!e || e.phase !== GamePhase.PLAYING) return { error: 'لا يمكن القيد الآن' };
    if (this.qaidSession && this.qaidSession.seat !== seatIdx) {
      return { error: 'قيد جاري من لاعب آخر' };
    }
    if (e.sawa_declaration) {
      if (e.sawa_declaration.phase !== 'objection') {
        return { error: 'انتظر انتهاء عرض كروت السوا' };
      }
      const objectorTeam = seatIdx % 2 === 0 ? 1 : 2;
      if (e.sawa_declaration.team === objectorTeam) {
        return { error: 'لا يمكنك الاعتراض على سوا فريقك' };
      }
      return { ok: true };
    }
    if (!e.trick_history || e.trick_history.length < 1) {
      return { error: 'لا يمكن القيد قبل انتهاء أول أكلة' };
    }
    return { ok: true };
  }

  handleQaidStart(seatIdx) {
    const check = this.canStartQaid(seatIdx);
    if (check.error) return check;
    if (this.qaidSession?.seat === seatIdx) return { ok: true };

    this.qaidSession = {
      seat: seatIdx,
      reason: null,
      cards: [],
      started_at: Date.now(),
    };
    this.clearTimers();
    this.pauseSawaObjectionTimer();

    if (this.qaidSessionTimer) clearTimeout(this.qaidSessionTimer);
    this.qaidSessionTimer = setTimeout(() => {
      if (this.qaidSession?.seat === seatIdx) this.handleQaidCancel(seatIdx, true);
    }, QAID_SESSION_MS);

    this.broadcast('qaid_started', { seat: seatIdx });
    this.broadcastState();
    return { ok: true };
  }

  handleQaidUpdate(seatIdx, { reason, cards } = {}) {
    if (!this.qaidSession) return { error: 'لا يوجد قيد نشط' };
    if (this.qaidSession.seat !== seatIdx) return { error: 'ليس قيدك' };
    if (reason !== undefined && reason !== null) this.qaidSession.reason = reason;
    if (cards !== undefined) this.qaidSession.cards = cards.map((c) => ({ ...c }));
    this.broadcastState();
    return { ok: true };
  }

  handleQaidCancel(seatIdx, timedOut = false) {
    if (!this.qaidSession) return { ok: true };
    if (!timedOut && this.qaidSession.seat !== seatIdx) return { error: 'ليس قيدك' };
    this.clearQaidSession();
    this.resumeSawaObjectionTimer();
    this.broadcast('qaid_ended', {});
    this.broadcastState();
    return { ok: true };
  }

  handleQaidSubmit(seatIdx, reason = null, cards = null) {
    if (!this.qaidSession) return { error: 'لا يوجد قيد نشط' };
    if (this.qaidSession.seat !== seatIdx) return { error: 'ليس قيدك' };

    const sessionReason = normalizeQaidReason(reason ?? this.qaidSession.reason ?? '');
    if (sessionReason) this.qaidSession.reason = sessionReason;
    if (cards !== null && cards !== undefined) {
      this.qaidSession.cards = cards.map((c) => ({ ...c }));
    }

    const sessionCards = this.qaidSession.cards || [];
    if (!sessionReason) return { error: 'اختر سبب القيد' };
    if (qaidNeedsProof(sessionReason) && sessionCards.length < 2) {
      return { error: 'اختر كرتين إثبات' };
    }

    this.clearQaidSession();
    this.clearSawaTimer();
    return this._resolveQaid(seatIdx, sessionReason, sessionCards);
  }

  _resolveQaid(seatIdx, reason, selectedCards) {
    const e = this.engine;
    if (!e || e.phase !== GamePhase.PLAYING) return { error: 'لا يمكن القيد الآن' };

    if (reason === 'سوا غلط' || normalizeQaidReason(reason) === 'سوا غلط') {
      if (!e.sawa_declaration || e.sawa_declaration.phase !== 'objection') {
        return { error: 'لا يوجد سوا للاعتراض عليه' };
      }
      const objectorTeam = seatIdx % 2 === 0 ? 1 : 2;
      const result = e.validate_qaid_sawa(objectorTeam);
      if (result.error) return result;
      if (result.valid) {
        this.addChat(seatIdx, 'صادوه! سوا غلط');
        e.finalize_round(result.win_team, 'qaid', {
          qaid_loser_tricks: e.tricks_won[result.mistake_team],
        });
      } else {
        this.addChat(seatIdx, 'السوا كان صحيحاً — قيد خاسر');
        e.finalize_round(result.win_team, 'sawa');
      }
      if (this.radarTracker) {
        this.radarTracker.recordQaidOutcome(this.seats, seatIdx, result);
      }
      this.broadcast('qaid_ended', {});
      this.broadcastState();
      this.scheduleBotTurn();
      return { ok: true, ...result };
    }

    if (!e.trick_history || e.trick_history.length < 1) {
      return { error: 'لا يمكن القيد قبل انتهاء أول أكلة' };
    }
    const objectorTeam = seatIdx % 2 === 0 ? 1 : 2;
    const result = e.validate_qaid(normalizeQaidReason(reason), selectedCards, objectorTeam);
    const loserTricks = e.tricks_won[result.mistake_team];
    if (result.valid) {
      this.addChat(seatIdx, 'صادوه! قيد صحيح');
      e.finalize_round(result.win_team, 'qaid', { qaid_loser_tricks: loserTricks });
    } else {
      this.addChat(seatIdx, result.win_team === objectorTeam ? 'اختيار خاطئ! قيد خاسر' : 'اللعب كان صحيح! قيد خاسر');
      e.finalize_round(result.win_team, 'qaid', { qaid_loser_tricks: loserTricks });
    }
    if (this.radarTracker) {
      this.radarTracker.recordQaidOutcome(this.seats, seatIdx, result);
    }
    this.broadcast('qaid_ended', {});
    this.broadcastState();
    this.scheduleBotTurn();
    return { ok: true, ...result };
  }

  getPublicState() {
    const e = this.engine;
    if (!e) return null;
    return {
      phase: e.phase,
      dealer_idx: e.dealer_idx,
      turn: e.turn,
      floor_card: e.floor_card,
      bid: e.bid,
      current_trick: e.current_trick,
      trick_count: e.trick_count,
      total_scores: e.total_scores,
      hands_revealed: e.isPreSecondDeal() ? false : e.hands_revealed,
      hand_hidden: e.isPreSecondDeal(),
      hand_counts: e.hands.map((_, i) => e.getVisibleHandCount(i)),
      double_level: e.double_level,
      hakam_locked: e.hakam_locked,
      buyer_seat: e.buyer_seat ?? e.bid?.bidder ?? null,
      last_doubling_seat: e.last_doubling_seat,
      hakam_pre_deal: !!e.hakam_pre_deal,
      sun_over100_special: !!e.sun_over100_special,
      summary_data: this.enrichSummaryData(e.summary_data),
      sawa_declaration: e.sawa_declaration
        ? {
          seat: e.sawa_declaration.seat,
          team: e.sawa_declaration.team,
          phase: e.sawa_declaration.phase,
          declared_at: e.sawa_declaration.declared_at,
          objection_started_at: e.sawa_declaration.objection_started_at,
          objection_deadline: e.sawa_declaration.objection_deadline,
        }
        : null,
      sawa_reveal_ms: e.sawa_declaration ? SAWA_REVEAL_MS : null,
      sawa_objection_ms: e.sawa_declaration?.phase === 'objection' ? SAWA_OBJECTION_MS : null,
      sawa_objection_paused: !!(this.qaidSession && e.sawa_declaration),
      qaid_session: this.qaidSession
        ? {
          seat: this.qaidSession.seat,
          reason: this.qaidSession.reason,
          cards: (this.qaidSession.cards || []).map((c) => ({ ...c })),
          started_at: this.qaidSession.started_at,
        }
        : null,
      sawa_hands: e.sawa_declaration
        ? e.hands.map((hand, i) => ({
          seat: i,
          name: this.seats[i]?.name || null,
          cards: hand.map((c) => ({ ...c })),
        }))
        : null,
      seats: this.seats.map((s, i) => this.seatToPublic(s, i)),
      chatBubbles: this.chatBubbles,
      table_gift_slots: this.getTableGiftSlotsPublic(),
      card_back_url: this.cardBackUrl,
      session_bg_url: this.sessionBgUrl || getDefaultSessionBgUrl(),
      stake: this.stake,
      gameMode: this.gameMode,
      winning_project_team: e.winning_project_team,
      trick_history: e.trick_history || [],
      all_hands: this.qaidSession && e.phase === GamePhase.PLAYING
        ? e.hands.map((hand, i) => ({
          seat: i,
          name: this.seats[i]?.name || null,
          cards: hand.map((c) => ({ ...c })),
        }))
        : [],
      ...e.get_public_project_state(),
    };
  }

  getPlayerState(seatIdx) {
    const e = this.engine;
    const pub = this.getPublicState();
    if (!e || seatIdx < 0) return pub;

    const hand = e.getVisibleHand(seatIdx);

    return {
      ...pub,
      my_seat: seatIdx,
      my_hand: hand.map((c) => ({ ...c })),
      my_hand_count: hand.length,
      legal_cards: e.phase === GamePhase.PLAYING && e.turn === seatIdx
        && !e.sawa_declaration && !this.qaidSession
        ? e.get_legal_cards(seatIdx)
        : [],
      available_bids: e.get_available_bids(seatIdx),
      project_details: e._getProjectDetails(seatIdx),
      can_ashkal: e.can_ashkal(seatIdx),
      qaid_reasons: e.get_qaid_reasons(),
      can_sawa: e.can_declare_sawa(seatIdx),
      trick_history: e.trick_history,
    };
  }

  getRoomState() {
    return {
      roomId: this.roomId,
      status: this.status,
      soloMode: this.soloMode,
      sandboxMode: this.sandboxMode,
      gameMode: this.gameMode,
      cardBackUrl: this.cardBackUrl,
      sessionBgUrl: this.sessionBgUrl || getDefaultSessionBgUrl(),
      stake: this.stake,
      seats: this.seats.map((s, i) => ({
        idx: i,
        name: s ? s.name : null,
        isBot: s ? s.isBot : false,
        occupied: !!s,
      })),
    };
  }

  broadcastState() {
    if (this.soloMode) {
      const sid = this.seats[3]?.socketId;
      if (sid) {
        const states = {};
        for (let i = 0; i < 4; i++) states[i] = this.getPlayerState(i);
        this.broadcast('solo_game_state', { viewSeat: 3, states }, sid);
      }
      this.broadcast('game_public', this.getPublicState());
      return;
    }
    for (let i = 0; i < 4; i++) {
      const seat = this.seats[i];
      if (seat && !seat.isBot && seat.socketId) {
        this.broadcast('game_state', { seat: i, state: this.getPlayerState(i) }, seat.socketId);
      }
    }
    // Also send public updates to spectators
    this.broadcast('game_public', this.getPublicState());
  }

  scheduleBotTurn() {
    this.clearTimers();
    const e = this.engine;
    if (!e || e.phase === GamePhase.SCORE_SUMMARY) {
      if (e && e.phase === GamePhase.SCORE_SUMMARY) {
        if (!this.summaryLoggedForRound) {
          this.summaryLoggedForRound = true;
          logRound(this.matchLogId, this, e);
          if (this.radarTracker) {
            this.radarTracker.onRoundEnd(e, this.seats);
          }
        }
        this.summaryTimer = setTimeout(() => {
          if (e.summary_data?.match_winner) {
            const winner = e.summary_data.match_winner;
            endMatch(this.matchLogId, winner, e.total_scores);
            if (this.radarTracker) {
              const radarResults = this.radarTracker.finalizeMatch(e, winner, this.seats);
              applyRadarMatchResults(radarResults);
            }
            this.broadcast('match_over', {
              winner,
              scores: { ...e.total_scores },
              gameMode: this.gameMode,
              summary: this.enrichSummaryData(e.summary_data),
              matchLogId: this.matchLogId,
              seats: this.seats.map((s, i) => this.seatToPublic(s, i)),
            });
            return;
          }
          this.summaryLoggedForRound = false;
          e.start_new_round();
          this.broadcast('new_round', { dealer_idx: e.dealer_idx });
          this.broadcastState();
          this.scheduleBotTurn();
        }, SUMMARY_DELAY);
      }
      return;
    }

    if (e.sawa_declaration || this.qaidSession) return;

    if (e.turn === -1 && e.current_trick.length === 4) {
      this.trickTimer = setTimeout(() => {
        const trickCards = e.current_trick.map((t) => ({ ...t, card: { ...t.card } }));
        const winner = e.resolve_trick();
        this.broadcast('trick_resolved', { winner, cards: trickCards });
        this.broadcastState();
        this.scheduleBotTurn();
      }, TRICK_RESOLVE_DELAY);
      return;
    }

    if (e.turn < 0) return;

    if (this.soloMode || this.sandboxMode) return;

    const currentSeat = this.seats[e.turn];
    if (!currentSeat) return;

    const isBot = currentSeat.isBot;
    const delay = isBot ? TURN_TIMEOUT_BOT + Math.random() * 800 : TURN_TIMEOUT_HUMAN;

    this.botTimer = setTimeout(() => {
      if (!this.engine || this.engine.turn !== e.turn) return;

      if (isBot) {
        this.executeBotTurn(e.turn);
      } else {
        this.executeEmergencyTurn(e.turn);
      }
    }, delay);
  }

  executeEmergencyTurn(seatIdx) {
    const e = this.engine;
    if (!e) return;

    if (e.phase === GamePhase.PLAYING) {
      if (e.trick_count === 1 && !e.played_in_trick1[seatIdx]) {
        e.apply_project_declarations(seatIdx, {});
      }
      const legal = e.get_legal_cards(seatIdx);
      if (legal.length) {
        let move = chooseEmergencyCard(e, seatIdx);
        if (!legal.includes(move)) move = legal[0];
        e.play_card(seatIdx, move);
      }
      this.addPlayChatBubbles(seatIdx, e);
      this.broadcast('card_thrown', { player: seatIdx });
      this.broadcast('emergency_play', { seat: seatIdx });
      this.broadcastState();
      this.scheduleBotTurn();
      return;
    }

    if ([
      GamePhase.PHASE_1, GamePhase.PHASE_2, GamePhase.GABLAK_PHASE,
      GamePhase.HAKAM_COUNTER, GamePhase.HAKAM_CONFIRM,
    ].includes(e.phase)) {
      const bid = e.get_bot_bid_action(seatIdx);
      const labels = {
        PASS: [GamePhase.PHASE_2, GamePhase.HAKAM_COUNTER, GamePhase.HAKAM_CONFIRM].includes(e.phase) ? 'بس' : (e.phase === GamePhase.PHASE_2 ? 'ولا' : 'بس'),
        SUN: 'صن', HAKAM: 'حكم', ASHKAL: 'أشكل', GABLAK: 'قبلك', CONFIRM_HAKAM: 'تأكيد حكم',
      };
      if (e.phase === GamePhase.PHASE_2) labels.PASS = 'ولا';
      this.addChat(seatIdx, labels[bid.action] || bid.action);
      if (bid.action === 'HAKAM' && e.phase === GamePhase.PHASE_2) {
        e.process_bidding('HAKAM', seatIdx, bid.suit);
      } else {
        e.process_bidding(bid.action, seatIdx, bid.suit || (e.floor_card ? e.floor_card.suit : null));
      }
      this.broadcast('emergency_play', { seat: seatIdx });
      this.broadcastState();
      this.scheduleBotTurn();
      return;
    }

    if (e.phase === GamePhase.DOUBLING) {
      e.process_doubling('PASS', seatIdx, false);
      this.addChat(seatIdx, 'بس');
      this.broadcast('emergency_play', { seat: seatIdx });
      this.broadcastState();
      this.scheduleBotTurn();
    }
  }

  executeBotTurn(seatIdx) {
    const e = this.engine;
    if (e.phase === GamePhase.PLAYING) {
      if (e.can_declare_sawa(seatIdx) && botHasSawa(e, seatIdx) && e.validate_sawa_correctness(seatIdx)) {
        e.try_declare_sawa(seatIdx);
        this.addChat(seatIdx, 'سوا');
        this.broadcastState();
        this.scheduleBotTurn();
        return;
      }

      let projBubble = null;
      if (e.trick_count === 1 && !e.played_in_trick1[seatIdx]) {
        const counts = chooseBotProjects(e, seatIdx);
        const { valid } = e.apply_project_declarations(seatIdx, counts);
        if (valid.length) projBubble = valid.join(' · ');
      }
      const legal = e.get_legal_cards(seatIdx);
      if (legal.length) {
        let move = e.get_bot_best_move(seatIdx);
        if (!legal.includes(move)) move = legal[0];
        e.play_card(seatIdx, move);
      }
      if (projBubble) this.addChat(seatIdx, projBubble);
      this.addPlayChatBubbles(seatIdx, e);
      this.broadcast('card_thrown', { player: seatIdx });
      this.broadcastState();
      this.scheduleBotTurn();
    } else if ([
      GamePhase.PHASE_1, GamePhase.PHASE_2, GamePhase.GABLAK_PHASE,
      GamePhase.HAKAM_COUNTER, GamePhase.HAKAM_CONFIRM,
    ].includes(e.phase)) {
      const bid = e.get_bot_bid_action(seatIdx);
      const labels = {
        PASS: [GamePhase.PHASE_2, GamePhase.HAKAM_COUNTER, GamePhase.HAKAM_CONFIRM].includes(e.phase) ? 'بس' : (e.phase === GamePhase.PHASE_2 ? 'ولا' : 'بس'),
        SUN: 'صن', HAKAM: 'حكم', ASHKAL: 'أشكل', GABLAK: 'قبلك', CONFIRM_HAKAM: 'تأكيد حكم',
      };
      if (e.phase === GamePhase.PHASE_2) labels.PASS = 'ولا';
      this.addChat(seatIdx, labels[bid.action] || bid.action);
      if (bid.action === 'HAKAM' && e.phase === GamePhase.PHASE_2) {
        e.process_bidding('HAKAM', seatIdx, bid.suit);
      } else {
        e.process_bidding(bid.action, seatIdx, bid.suit || (e.floor_card ? e.floor_card.suit : null));
      }
      this.broadcastState();
      this.scheduleBotTurn();
    } else if (e.phase === GamePhase.DOUBLING) {
      const bid = e.get_bot_bid_action(seatIdx);
      const labels = { PASS: 'بس', DOUBLE: 'دبل', THREE: 'ثري', FOUR: 'فور', GAHWA: 'قهوة' };
      let locked = false;
      if (['DOUBLE', 'THREE', 'FOUR'].includes(bid.action) && !e.sun_over100_special) {
        const trump = e.bid?.suit;
        const hand = e.hands[seatIdx] || [];
        const trumpCount = trump ? hand.filter((c) => c.suit === trump).length : 0;
        locked = trumpCount < 3;
      }
      e.process_doubling(bid.action, seatIdx, locked);
      if (bid.action === 'GAHWA') {
        this.addChat(seatIdx, labels.GAHWA);
      } else if (['DOUBLE', 'THREE', 'FOUR'].includes(bid.action) && !e.sun_over100_special) {
        this.addChat(seatIdx, `${labels[bid.action]} ${locked ? 'مقفل' : 'مفتوح'}`);
      } else {
        this.addChat(seatIdx, labels[bid.action] || bid.action);
      }
      this.broadcastState();
      this.scheduleBotTurn();
    }
  }

  addChat(seatIdx, text) {
    this.chatBubbles[seatIdx] = { text, time: Date.now() };
    this.broadcast('chat', { seat: seatIdx, text });
    setTimeout(() => {
      if (this.chatBubbles[seatIdx]?.text === text) delete this.chatBubbles[seatIdx];
    }, 3000);
  }

  addPlayChatBubbles(seatIdx, engine) {
    const msgs = engine.getLastPlayChatBubbles();
    if (msgs.length) this.addChat(seatIdx, msgs.join(' · '));
  }

  handleTableGift(senderSeat, { giftId, target } = {}) {
    const sender = this.seats[senderSeat];
    if (!sender || sender.isBot || !sender.userId) {
      return { error: 'لا يمكن إرسال هدايا من هذا المقعد' };
    }
    if (!isValidTableGiftId(giftId)) return { error: 'هدية غير صالحة' };

    const emoji = getTableGiftEmoji(giftId);
    let recipientSeats = [];

    if (target === 'all') {
      recipientSeats = [0, 1, 2, 3].filter((i) => i !== senderSeat && this.seats[i]);
    } else {
      const toSeat = parseInt(target, 10);
      if (!Number.isFinite(toSeat) || toSeat < 0 || toSeat > 3) {
        return { error: 'مستلم غير صالح' };
      }
      if (toSeat === senderSeat) return { error: 'لا يمكن إهداء نفسك' };
      if (!this.seats[toSeat]) return { error: 'المقعد فارغ' };
      recipientSeats = [toSeat];
    }

    if (!recipientSeats.length) return { error: 'لا يوجد مستلمون' };

    const totalCost = recipientSeats.length * TABLE_GIFT_COST;
    const paid = deductTableGiftCoins(sender.userId, totalCost);
    if (paid.error) return paid;

    if (!this.tableGiftSlots) this.tableGiftSlots = [[], [], [], []];

    const deliveries = recipientSeats.map((toSeat) => {
      this.tableGiftSlots[toSeat] = pushTableGiftSlot(
        this.tableGiftSlots[toSeat],
        giftId,
        emoji,
        senderSeat,
      );
      return { toSeat, slots: this.tableGiftSlots[toSeat].map((s) => ({ ...s })) };
    });

    const payload = {
      fromSeat: senderSeat,
      giftId,
      emoji,
      deliveries,
      senderCoins: paid.coins,
      table_gift_slots: this.tableGiftSlots.map((row) => row.map((s) => ({ ...s }))),
    };

    this.broadcast('table_gift', payload);
    return { ok: true, ...payload };
  }

  getTableGiftSlotsPublic() {
    return (this.tableGiftSlots || [[], [], [], []]).map((row) => row.map((s) => ({ ...s })));
  }

  handleBid(seatIdx, action, suit = null, locked = false) {
    if (this.sandboxMode) return { error: 'وضع تعديل الواجهة — اللعب متوقف' };
    const e = this.engine;
    if (!e) return { error: 'لا توجد لعبة' };
    if (e.turn !== seatIdx) return { error: 'ليس دورك' };

    const phaseBefore = e.phase;
    const passLabel = phaseBefore === GamePhase.PHASE_2 ? 'ولا' : 'بس';
    const chatLabels = {
      PASS: passLabel, SUN: 'صن', HAKAM: 'حكم', ASHKAL: 'أشكل', GABLAK: 'قبلك',
      CONFIRM_HAKAM: 'تأكيد حكم',
      DOUBLE: 'دبل', THREE: 'ثري', FOUR: 'فور', GAHWA: 'قهوة',
    };

    if (e.phase === GamePhase.DOUBLING) {
      const result = e.process_doubling(action, seatIdx, locked);
      if (result?.error) return result;
      if (action === 'GAHWA') {
        this.addChat(seatIdx, chatLabels.GAHWA);
      } else if (['DOUBLE', 'THREE', 'FOUR'].includes(action) && !e.sun_over100_special) {
        this.addChat(seatIdx, `${chatLabels[action]} ${locked ? 'مقفل' : 'مفتوح'}`);
      } else {
        this.addChat(seatIdx, chatLabels[action] || action);
      }
    } else {
      const result = e.process_bidding(action, seatIdx, suit);
      if (result?.error) return result;
      this.addChat(seatIdx, chatLabels[action] || action);
    }
    this.broadcastState();
    this.scheduleBotTurn();
    return { ok: true };
  }

  handlePlayCard(seatIdx, cardIndex, projectCounts = null, playMs = null) {
    if (this.sandboxMode) return { error: 'وضع تعديل الواجهة — اللعب متوقف' };
    const e = this.engine;
    if (!e || e.phase !== GamePhase.PLAYING) return { error: 'ليست مرحلة اللعب' };
    if (e.sawa_declaration) return { error: 'سوا معلن — انتظر الاعتراض' };
    if (this.qaidSession) return { error: 'قيد جاري — انتظر انتهاءه' };
    if (e.turn !== seatIdx) return { error: 'ليس دورك' };

    if (e.trick_count === 1 && !e.played_in_trick1[seatIdx]) {
      const { valid } = e.apply_project_declarations(seatIdx, projectCounts || {});
      if (valid.length) this.addChat(seatIdx, valid.join(' · '));
    }

    const ok = e.play_card(seatIdx, cardIndex);
    if (!ok) return { error: 'حركة غير صالحة' };

    if (this.radarTracker) {
      const seat = this.seats[seatIdx];
      if (seat?.userId) {
        this.radarTracker.recordPlay(parseInt(seat.userId, 10), playMs);
      }
    }

    const rev = e.project_reveals_public[seatIdx];
    if (rev?.names?.length) this.addChat(seatIdx, rev.names.join(' · '));

    this.addPlayChatBubbles(seatIdx, e);
    this.broadcast('card_thrown', { player: seatIdx });
    this.broadcastState();
    this.scheduleBotTurn();
    return { ok: true };
  }

  handleDeclareProject(seatIdx, projName) {
    const e = this.engine;
    if (!e) return { error: 'لا توجد لعبة' };
    const ok = e.declare_project(seatIdx, projName);
    if (ok) this.addChat(seatIdx, projName);
    this.broadcastState();
    return { ok };
  }

  handleQaid(seatIdx, reason, selectedCards) {
    if (this.qaidSession) {
      return this.handleQaidSubmit(seatIdx, reason, selectedCards);
    }
    const start = this.handleQaidStart(seatIdx);
    if (start.error) return start;
    if (reason) {
      this.handleQaidUpdate(seatIdx, { reason, cards: selectedCards || [] });
      return this.handleQaidSubmit(seatIdx);
    }
    return start;
  }

  handleSawa(seatIdx) {
    const e = this.engine;
    if (!e) return { error: 'لا توجد لعبة' };
    if (this.qaidSession) return { error: 'قيد جاري — انتظر انتهاءه' };
    const result = e.try_declare_sawa(seatIdx);
    if (result.error) return result;

    this.clearSawaTimer();
    this.addChat(seatIdx, 'سوا');
    this.broadcast('sawa_declared', { seat: seatIdx, team: result.team });

    this.sawaRevealTimer = setTimeout(() => {
      const decl = this.engine?.sawa_declaration;
      if (!decl || decl.phase !== 'reveal') return;
      decl.phase = 'objection';
      decl.objection_started_at = Date.now();
      this.broadcastState();
      if (this._autoQaidInvalidSawa()) return;
      this.startSawaObjectionTimer();
    }, SAWA_REVEAL_MS);

    this.broadcastState();
    return { ok: true };
  }

  joinSeat(socketId, seatIdx, name, userId = null) {
    if (this.soloMode) return { error: 'استخدم وضع التجربة الفردية' };
    if (this.status === 'playing') return { error: 'اللعبة جارية - انتظر الجولة التالية' };
    if (seatIdx < 0 || seatIdx > 3) return { error: 'مقعد غير صالح' };

    const existingSocket = this.findSeatBySocket(socketId);
    if (this.isBotPracticeRoom() && existingSocket < 0) {
      const reconnect = userId ? this.findReconnectSeat(userId) : -1;
      if (reconnect < 0 && this.countConnectedHumans() >= 1) {
        return { error: 'هذه غرفة خاصة — العب مع البوتات وحدك' };
      }
    }

    const occupant = this.seats[seatIdx];
    if (occupant && !occupant.isBot) {
      if (occupant.socketId === socketId) return { seat: seatIdx, player: occupant };
      return { error: `المقعد ${seatIdx} مشغول` };
    }

    if (existingSocket >= 0) this.seats[existingSocket] = null;

    const player = this.makePlayer(socketId, name, userId);
    this.seats[seatIdx] = player;
    this.cancelIdleCleanup();
    if (!this.soloMode) this.resolveSessionBackgroundFromPlayers();
    this.broadcast('room_update', this.getRoomState());
    this.checkAutoStart();
    return { seat: seatIdx, player };
  }
}

class GameManager {
  constructor() {
    this.rooms = new Map();
    this.onlineRegistry = new Map();
  }

  registerOnline(socket, { userId, name, roomId, roomStatus, gameMode }) {
    const uid = userId ? String(userId) : null;
    this.onlineRegistry.set(socket.id, {
      socket_id: socket.id,
      user_id: uid,
      name: name || 'لاعب',
      room_id: roomId,
      room_status: roomStatus || 'lobby',
      game_mode: gameMode || 'friendly',
      connected_at: new Date().toISOString(),
    });
  }

  unregisterOnline(socketId) {
    this.onlineRegistry.delete(socketId);
  }

  listOnlinePlayers() {
    const { getUserById, deviceIdForUser } = require('./auth');
    const { getOrCreatePlayer } = require('./db');
    const rows = [];
    for (const info of this.onlineRegistry.values()) {
      const uid = info.user_id ? parseInt(info.user_id, 10) : null;
      let extra = {};
      if (uid) {
        const user = getUserById(uid);
        const profile = getOrCreatePlayer(deviceIdForUser(uid), user?.display_name);
        extra = {
          display_name: user?.display_name,
          username: user?.username,
          is_vip: !!user?.is_vip,
          is_famous: !!user?.is_famous,
          is_admin: user?.role === 'admin',
          coins: profile?.coins,
          gems: profile?.gems,
        };
      }
      rows.push({ ...info, ...extra });
    }
    return rows;
  }

  getOrCreateRoom(roomId = 'main') {
    if (!this.rooms.has(roomId)) {
      const room = new GameRoom(roomId);
      room.setBroadcast((event, data, targetSocketId) => {
        this._emit(roomId, event, data, targetSocketId);
      });
      room.setOnAbandoned(() => {
        this.rooms.delete(roomId);
      });
      this.rooms.set(roomId, room);
    }
    return this.rooms.get(roomId);
  }

  setIO(io) {
    this.io = io;
  }

  _emit(roomId, event, data, targetSocketId) {
    if (!this.io) return;
    if (targetSocketId) {
      const sock = this.io.sockets.sockets.get(targetSocketId);
      if (sock) sock.emit(event, data);
    } else {
      this.io.to(roomId).emit(event, data);
    }
  }

  joinRoom(socket, data = {}) {
    let {
      roomId = 'friendly', name, seat = null, solo = false,
      userId = null, cardBackUrl, sessionBgUrl, stake, seatOrder,
    } = data;
    const resolvedId = resolveJoinRoomId(roomId, {
      solo,
      userId,
      socketId: socket.id,
    });
    roomId = resolvedId;
    let room = this.getOrCreateRoom(roomId);
    if (!solo && !isBotPracticeRoomId(roomId) && room.isOrphaned()) {
      room.abandonInactiveRoom();
      room = this.getOrCreateRoom(roomId);
    }
    room.applyRoomCosmetics({ cardBackUrl, sessionBgUrl, stake });
    socket.join(roomId);
    socket.roomId = roomId;

    let result = null;
    if (!solo && userId) {
      result = room.tryReconnect(socket.id, userId, name);
      if (result?.error) return result;
    }

    if (!result) {
      if (solo) {
        result = room.joinSolo(socket.id, name);
      } else if (seat !== null && seat !== undefined) {
        result = room.joinSeat(socket.id, seat, name, userId);
      } else if (Array.isArray(seatOrder) && userId) {
        const idx = seatOrder.indexOf(userId);
        const assignedSeat = idx >= 0 && idx <= 3 ? idx : null;
        if (assignedSeat !== null) {
          result = room.joinSeat(socket.id, assignedSeat, name, userId);
        } else {
          result = room.addPlayer(socket.id, name, null, userId);
        }
      } else {
        result = room.addPlayer(socket.id, name, seat, userId);
      }
    }

    if (result.error) return result;

    this.registerOnline(socket, {
      userId,
      name,
      roomId,
      roomStatus: room.status,
      gameMode: room.gameMode,
    });

    if (!solo && room.status === 'lobby') {
      room.scheduleMatchmaking();
    }

    if (room.sandboxMode && room.status === 'lobby' && room.countConnectedHumans() === 1) {
      room.fillBots();
    }

    if (room.engine && !room.soloMode) {
      socket.emit('game_state', { seat: result.seat, state: room.getPlayerState(result.seat) });
    } else if (room.engine && room.soloMode) {
      const states = {};
      for (let i = 0; i < 4; i++) states[i] = room.getPlayerState(i);
      socket.emit('solo_game_state', { viewSeat: 3, states });
    }

    return {
      seat: result.seat,
      room: room.getRoomState(),
      roomId: room.roomId,
      soloMode: !!result.soloMode,
      sandboxMode: !!room.sandboxMode,
      gameMode: room.gameMode,
      reconnected: !!result.reconnected,
    };
  }

  getRoom(socket) {
    return this.rooms.get(socket.roomId);
  }

  resolveSeat(socket, actAs) {
    const room = this.getRoom(socket);
    if (!room) return -1;
    return room.resolveActingSeat(socket.id, actAs);
  }

  leaveRoom(socket, options = {}) {
    const roomId = socket.roomId;
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const result = room.removePlayer(socket.id, options);
    this.unregisterOnline(socket.id);
    socket.leave(roomId);
    socket.roomId = null;

    if (result?.type === 'ranked_forfeit' && this.onRankedForfeit) {
      this.onRankedForfeit(result);
    }

    if (result?.type === 'bot_practice_ended' || result?.type === 'solo_left') {
      this.rooms.delete(roomId);
    } else if (room.shouldDestroy()) {
      room.clearTimers();
      this.rooms.delete(roomId);
    }

    return result;
  }

  setRankedForfeitHandler(fn) {
    this.onRankedForfeit = fn;
  }

  resetSandboxRoom(userId) {
    const roomId = `sandbox_${userId}`;
    const existing = this.rooms.get(roomId);
    if (existing) {
      existing.clearTimers();
      this.rooms.delete(roomId);
    }
    return roomId;
  }

  getSandboxRoomId(userId) {
    return `sandbox_${userId}`;
  }
}

module.exports = { GameManager, GameRoom, isSandboxRoomId };
