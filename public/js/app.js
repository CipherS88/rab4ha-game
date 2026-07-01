/**
 * Baloot Web Client
 */
const socket = io();

const PHASE_LABELS = {
  PHASE_1: 'لفة 1',
  PHASE_2: 'لفة 2',
  GABLAK_PHASE: 'قبلك',
  HAKAM_COUNTER: 'رد على الحكم',
  HAKAM_CONFIRM: 'تأكيد الحكم',
  DOUBLING: 'التدبيل',
  PLAYING: 'اللعب',
  SCORE_SUMMARY: 'النشرة',
};

const PROJECT_NAMES = ['سرا', 'خمسين', 'مية', 'أربعمية'];

/** نص الزر في الواجهة — المفتاح يبقى للسيرفر */
function projectDisplayLabel(key) {
  return ({ سرا: 'السرا', خمسين: '50', مية: '100', أربعمية: '400' })[key] || key;
}

const SUIT_SYM = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };
const SUIT_AR = { HEARTS: 'هاص', DIAMONDS: 'ديمن', CLUBS: 'شيريا', SPADES: 'سبيت' };
const RANK_AR = { A: 'آس', K: 'ملك', Q: 'بنت', J: 'ولد', '10': '10', '9': '9', '8': '8', '7': '7' };
const THROW_DURATION = 380;
const COLLECT_DURATION = 360;

let myTurnStartedAt = null;

let collectAnim = null;
let prevTrickLen = 0;

function getAvatarScreenPos(globalSeat) {
  const visualPos = getVisualPos(globalSeat, mySeat);
  const wrap = getSeatEl(visualPos)?.querySelector('.avatar-wrap');
  if (wrap) {
    const r = wrap.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function getHandThrowPos(globalSeat) {
  const visualPos = getVisualPos(globalSeat, mySeat);
  if (visualPos === 'bottom') {
    const hand = $('#my-hand');
    if (hand?.children.length) {
      const cards = [...hand.querySelectorAll('.hand-card')];
      const last = cards[cards.length - 1] || cards[0];
      const r = last.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.35 };
    }
    if (hand) {
      const r = hand.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 10 };
    }
  }
  const cardsPart = document.querySelector(`#game-board [data-game-layout-id="seat_${visualPos}_cards"]`);
  const fan = cardsPart?.querySelector('.fan-hand') || getSeatEl(visualPos)?.querySelector('.fan-hand');
  if (fan?.children.length) {
    const mid = fan.children[Math.floor(fan.children.length / 2)];
    const r = mid.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return getAvatarScreenPos(globalSeat);
}

function registerThrowAnim(player) {
  const pos = getHandThrowPos(player);
  throwAnims[player] = { startX: pos.x, startY: pos.y, startTime: performance.now() };
}

function getCardHalfSize() {
  const probe = document.querySelector('.hand-card') || document.querySelector('.trick-card');
  if (probe) return { hw: probe.offsetWidth / 2, hh: probe.offsetHeight / 2 };
  return { hw: 46, hh: 68 };
}
const SEAT_DIFF_TO_VISUAL = { 0: 'bottom', 1: 'right', 2: 'top', 3: 'left' };
const VISUAL_TO_SEAT_DIFF = { bottom: 0, right: 1, top: 2, left: 3 };
const VISUAL_POSITIONS = ['bottom', 'right', 'top', 'left'];

/** Trick card landing offsets by relative visual position */
const TRICK_OFFSETS_BY_POS = {
  bottom: { x: 0, y: 50 },
  right: { x: 40, y: 0 },
  top: { x: 0, y: -50 },
  left: { x: -40, y: 0 },
};

/** Screen coordinates (reserved for future animations) */
const SCREEN_POS_BY_VISUAL = {
  bottom: { x: () => window.innerWidth * 0.5, y: () => window.innerHeight * 0.82 },
  right: { x: () => window.innerWidth * 0.88, y: () => window.innerHeight * 0.42 },
  top: { x: () => window.innerWidth * 0.5, y: () => window.innerHeight * 0.12 },
  left: { x: () => window.innerWidth * 0.12, y: () => window.innerHeight * 0.42 },
};

/**
 * Map global server seat → visual position for this client.
 * Local player = bottom, partner (+2) = top, opponents = left/right.
 */
function getVisualPos(globalSeat, localSeat) {
  if (localSeat === null || localSeat === undefined) return 'bottom';
  const diff = (globalSeat - localSeat + 4) % 4;
  return SEAT_DIFF_TO_VISUAL[diff];
}

function getSeatPart(visualPos, part) {
  return document.querySelector(`#game-board [data-game-layout-id="seat_${visualPos}_${part}"]`);
}

function seatVisualNodes(visualPos) {
  const avatar = getSeatPart(visualPos, 'avatar');
  const cards = getSeatPart(visualPos, 'cards');
  const gifts = getSeatPart(visualPos, 'gifts');
  const name = getSeatPart(visualPos, 'name');
  const turnTargets = [avatar, cards, gifts, name].filter(Boolean);
  return {
    avatar,
    cards,
    gifts,
    name,
    turnTargets,
    nameEl: name?.querySelector('.player-name'),
    rankEl: name?.querySelector('.player-rank-pill'),
    handEl: cards?.querySelector('.fan-hand') || avatar?.querySelector('.fan-hand'),
    dealerBadge: avatar?.querySelector('.dealer-badge'),
    bidBadge: avatar?.querySelector('.bid-badge'),
    chatBubble: avatar?.querySelector('.chat-bubble') || name?.querySelector('.chat-bubble'),
  };
}

function setSeatVisualClass(visualPos, className, on) {
  seatVisualNodes(visualPos).turnTargets.forEach((el) => el.classList.toggle(className, on));
}

function getSeatEl(visualPos) {
  return getSeatPart(visualPos, 'avatar');
}

/** Which global seat occupies a visual slot on this client */
function getGlobalSeat(visualPos, localSeat) {
  if (localSeat === null || localSeat === undefined) return 0;
  const diff = VISUAL_TO_SEAT_DIFF[visualPos];
  return (localSeat + diff) % 4;
}

function getMyTeam() {
  const seat = mySeat ?? gameState?.my_seat;
  if (seat === null || seat === undefined) return 1;
  return seat % 2 === 0 ? 1 : 2;
}

let mySeat = null;
let soloMode = false;
let sandboxMode = false;
let lastControlSeat = null;
let gameState = null;

function getControlSeat() {
  if (soloMode && gameState?.turn >= 0) return gameState.turn;
  return mySeat;
}

function isMyTurnToAct() {
  if (!gameState) return false;
  if (soloMode) return gameState.turn >= 0;
  return gameState.turn === mySeat;
}

function isBottomHandSeat(globalSeat) {
  if (soloMode) return globalSeat === getControlSeat();
  return globalSeat === mySeat;
}

function mergeSoloGameState(states, viewSeat = 3) {
  const turn = states[0]?.turn ?? -1;
  const activeSeat = turn >= 0 ? turn : viewSeat;
  const base = states[viewSeat] || states[0];
  const active = states[activeSeat] || base;
  if (soloMode && lastControlSeat !== null && lastControlSeat !== activeSeat) {
    pendingProjects = { سرا: 0, خمسين: 0, مية: 0, أربعمية: 0 };
  }
  lastControlSeat = activeSeat;
  gameState = {
    ...base,
    my_hand: active.my_hand,
    my_hand_count: active.my_hand_count,
    available_bids: active.available_bids,
    legal_cards: active.legal_cards,
    project_details: active.project_details,
    can_sawa: active.can_sawa,
    soloStates: states,
    soloMode: true,
    controlSeat: activeSeat,
  };
}

function emitGameAction(event, data, cb) {
  const payload = soloMode ? { ...data, actAs: getControlSeat() } : data;
  socket.emit(event, payload, cb);
}
let preSelectedIndex = null;
let preSelectedCard = null;
let throwAnims = {};
let qaidData = { reason: null, cards: [], step: 1 };
let qaidTimerInterval = null;
let sawaQaidInterval = null;
let sawaBannerInterval = null;
let lastSawaSpreadKey = '';
let qaidModalOpen = false;
let pendingHakamBid = false;
let pendingLockBid = null;
let lastTrickKey = '';
let floorCardRevealed = false;
let floorRevealStarted = false;
let lastFloorKey = '';
let handsFlippedForRound = false;
let pendingProjects = { سرا: 0, خمسين: 0, مية: 0, أربعمية: 0 };

const PROJECT_MAX = { سرا: 2, خمسين: 2, مية: 2, أربعمية: 1 };

const QAID_NEEDS_PROOF = new Set(['قاطع', 'ما كبر بالحكم', 'ما دق بالحكم']);
const SUIT_SYMBOL = { HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣', SPADES: '♠' };

function sawaScatterPositions(count, key) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    let h = 0;
    const s = `${key}-${i}`;
    for (let j = 0; j < s.length; j++) h = ((h << 5) - h + s.charCodeAt(j)) | 0;
    const hx = ((h & 0xffff) / 0xffff) - 0.5;
    const hy = (((h >> 16) & 0xffff) / 0xffff) - 0.5;
    const rot = (((h >> 8) % 360) - 180) * 0.22;
    positions.push({
      x: 0.5 + hx * 0.34,
      y: 0.44 + hy * 0.26,
      rot,
    });
  }
  return positions;
}

function isSawaDeclarerSeat(globalSeat) {
  const decl = gameState?.sawa_declaration;
  return decl != null && decl.seat === globalSeat;
}

function isSawaOpponentSeat(globalSeat) {
  const decl = gameState?.sawa_declaration;
  if (!decl) return false;
  const declarerTeam = decl.team ?? (decl.seat % 2 === 0 ? 1 : 2);
  const seatTeam = globalSeat % 2 === 0 ? 1 : 2;
  return seatTeam !== declarerTeam;
}

const SPREAD_ANCHOR = {
  top: { x: 0.5, y: 0.18 },
  bottom: { x: 0.5, y: 0.78 },
  left: { x: 0.14, y: 0.48 },
  right: { x: 0.86, y: 0.48 },
};

// DOM refs ($ و $$ معرّفان في dom.js)
const screens = {
  login: $('#screen-login'),
  home: $('#screen-home'),
  sessions: $('#screen-sessions'),
  tournaments: $('#screen-tournaments'),
  tournamentDetail: $('#screen-tournament-detail'),
  leaderboards: $('#screen-leaderboards'),
  store: $('#screen-store'),
  bag: $('#screen-bag'),
  friends: $('#screen-friends'),
  ranked: $('#screen-ranked'),
  settings: $('#screen-settings'),
  chat: $('#screen-chat'),
  name: $('#screen-name'),
  matchmaking: $('#screen-matchmaking'),
  game: $('#screen-game'),
  sessionLobby: $('#screen-session-lobby'),
};

let currentMatchMode = 'friendly';
let currentSessionId = null;
const DEFAULT_SESSION_BG = '/backgrounds/default.jpg';

function applyGameCosmetics(state) {
  if (!state) return;
  if (state.card_back_url) setCardBackUrl(state.card_back_url);
  const bgEl = $('#room-bg');
  if (!bgEl) return;
  const bg = state.session_bg_url || DEFAULT_SESSION_BG;
  bgEl.style.backgroundImage = `url(${bg})`;
}

function seatDeckBackUrl(seatIdx) {
  const url = gameState?.seats?.[seatIdx]?.deck_back_url;
  return url || cardBackUrl();
}

function getJoinUserId() {
  if (typeof getCachedUser === 'function' && getCachedUser()?.id) {
    return String(getCachedUser().id);
  }
  return typeof getDeviceId === 'function' ? getDeviceId() : null;
}

const ACTIVE_GAME_KEY = 'baloot_active_game';
let restoreGamePending = false;

function getActiveGame() {
  try {
    const raw = sessionStorage.getItem(ACTIVE_GAME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}
window.getActiveGame = getActiveGame;
window.saveActiveGame = saveActiveGame;
window.clearActiveGame = clearActiveGame;
window.getGameMySeat = () => mySeat;
window.getGameStateRef = () => gameState;

function saveActiveGame(data) {
  const prev = getActiveGame() || {};
  sessionStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ ...prev, ...data }));
}

function clearActiveGame() {
  sessionStorage.removeItem(ACTIVE_GAME_KEY);
}

function resetClientGameState() {
  gameState = null;
  mySeat = null;
  soloMode = false;
  sandboxMode = false;
  setSandboxUI(false);
  preSelectedIndex = null;
  preSelectedCard = null;
  throwAnims = {};
  collectAnim = null;
  $('#modal-summary')?.classList.add('hidden');
  $('#modal-hakam')?.classList.add('hidden');
  $('#modal-lock')?.classList.add('hidden');
  $('#modal-qaid')?.classList.add('hidden');
}

function navigateAfterLeave() {
  resetClientGameState();
  if (currentMatchMode === 'ranked' && typeof initRankedLobby === 'function') {
    initRankedLobby();
  } else if (currentMatchMode === 'session') {
    initSessionsPage?.();
  } else if (typeof initHome === 'function') {
    initHome();
  } else {
    showScreen('home');
  }
}

const RANKED_LEAVE_WARNING =
  'تحذير: الخروج من مباراة مصنّفة يخصم منك 100 نقطة، والمباراة القادمة التي تفوز فيها تحصل على 10 نقاط فقط بدل 20.\n\nهل تريد المغادرة؟';

function requestLeaveGame() {
  if (soloMode) {
    clearActiveGame();
    socket.emit('leave_game', {}, () => {
      resetClientGameState();
      if (typeof initHome === 'function') initHome();
      else showScreen('home');
    });
    setTimeout(() => {
      resetClientGameState();
      showScreen('home');
    }, 1500);
    return;
  }
  if (currentMatchMode === 'ranked' && gameState?.phase && gameState.phase !== 'SCORE_SUMMARY') {
    if (!confirm(RANKED_LEAVE_WARNING)) return;
  }

  let finished = false;
  const finish = (res) => {
    if (finished) return;
    finished = true;
    clearActiveGame();
    if (res?.result?.type === 'ranked_forfeit') {
      alert('غادرت المباراة — خُصم 100 نقطة. المباراة القادمة التي تفوز فيها تحصل على 10 نقاط فقط.');
    }
    navigateAfterLeave();
  };

  if (!socket.connected) {
    finish(null);
    return;
  }

  socket.emit('leave_game', {}, finish);
  setTimeout(() => finish(null), 2000);
}

function getJoinName() {
  const cached = typeof getCachedProfile === 'function' ? getCachedProfile() : null;
  return ($('#player-name')?.value || cached?.name || getPlayerName?.() || '').trim() || 'لاعب';
}

function showScreen(name) {
  Object.values(screens).forEach((s) => {
    if (s) s.classList.remove('active');
  });
  if (screens[name]) screens[name].classList.add('active');
  if (typeof updateBottomNav === 'function') updateBottomNav(name);
  if (name === 'game') {
    requestAnimationFrame(() => {
      if (typeof loadAndApplyGameLayout === 'function') loadAndApplyGameLayout();
      if (typeof updateGameLayoutAdminButton === 'function') {
        updateGameLayoutAdminButton({
          sandboxMode,
          isAdmin: typeof isAdmin === 'function' && isAdmin(),
        });
      }
    });
  }
}

function setSandboxUI(active) {
  document.getElementById('game-sandbox-banner')?.classList.toggle('hidden', !active);
  if (typeof updateGameLayoutAdminButton === 'function') {
    updateGameLayoutAdminButton({
      sandboxMode: active,
      isAdmin: typeof isAdmin === 'function' && isAdmin(),
    });
  }
  if (active && typeof applySandboxPreviewUI === 'function') {
    requestAnimationFrame(() => applySandboxPreviewUI());
  }
}

async function startAdminGameSandbox() {
  if (typeof isAdmin === 'function' && !isAdmin()) {
    alert('للأدمن فقط');
    return;
  }
  try {
    const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
    const res = await fetch('/api/admin/sandbox/start', {
      method: 'POST',
      headers: token
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذّر فتح sandbox');

    sandboxMode = true;
    currentMatchMode = 'sandbox';
    soloMode = false;
    const name = getJoinName();
    const userId = getJoinUserId();

    socket.emit('join', { roomId: data.roomId, name, userId }, (joinRes) => {
      if (joinRes?.error) {
        alert(joinRes.error);
        sandboxMode = false;
        return;
      }
      mySeat = joinRes.seat;
      sandboxMode = !!joinRes.sandboxMode;
      applyGameCosmetics({
        session_bg_url: joinRes.room?.sessionBgUrl || DEFAULT_SESSION_BG,
        card_back_url: joinRes.room?.cardBackUrl,
      });
      saveActiveGame({
        roomId: joinRes.roomId || data.roomId,
        mode: 'sandbox',
        inGame: joinRes.room?.status === 'playing',
        userId,
        name,
        sandbox: sandboxMode,
        mySeat: joinRes.seat,
      });
      setSandboxUI(sandboxMode);
      if (joinRes.room?.status === 'playing') {
        showScreen('game');
      }
    });
  } catch (err) {
    alert(err.message);
  }
}

window.startAdminGameSandbox = startAdminGameSandbox;

// ---- Name & Matchmaking ----
$('#btn-start').addEventListener('click', () => startMatchmaking(false));
$('#btn-solo').addEventListener('click', () => startMatchmaking(true));
$('#player-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startMatchmaking(false);
});

async function startMatchmaking(solo = false, mode = 'friendly') {
  if (typeof isLoggedIn === 'function' && isLoggedIn()) {
    try {
      const me = await fetchMe();
      if (me.ban?.banned) {
        alert(me.ban.reason || 'حسابك محظور — ممنوع اللعب');
        return;
      }
    } catch (_) {}
  }

  currentMatchMode = mode;
  const name = ($('#player-name')?.value || getPlayerName?.() || '').trim() || 'لاعب';
  soloMode = solo;
  showScreen('matchmaking');

  const mmScreen = $('#screen-matchmaking');
  const panel = $('#matchmaking-panel');
  const profile = typeof getCachedProfile === 'function' ? getCachedProfile() : null;

  if (mode === 'ranked' && profile) {
    mmScreen?.classList.add('ranked-mode');
    panel?.classList.add('ranked-theme');
    applyRankTheme?.(panel, profile.rankTheme || 'wood');
  } else {
    mmScreen?.classList.remove('ranked-mode');
    panel?.classList.remove('ranked-theme');
  }

  const title = $('#matchmaking-title');
  const sub = $('#matchmaking-sub');
  if (solo) {
    if (title) title.textContent = 'وضع التجربة الفردية';
    if (sub) sub.textContent = 'تتحكم بكل المقاعد';
  } else if (mode === 'ranked') {
    if (title) title.textContent = 'جاري البحث عن خصوم...';
    if (sub) sub.textContent = 'مباراة مصنّفة — بانتظار 4 لاعبين';
  } else if (mode === 'match52') {
    if (title) title.textContent = 'مباراة 52';
    if (sub) sub.textContent = 'ودّية — يبدأ الفريقان من 52 نقطة';
  } else {
    if (title) title.textContent = 'غرفة ودّية';
    if (sub) sub.textContent = 'لاعب واحد + بوتات — اضغط «ملء بالروبوت»';
  }

  updateMatchmakingCount([]);
  renderSeatsPreview([]);

  const urlParams = new URLSearchParams(window.location.search);
  const seatParam = urlParams.get('seat');
  const seat = !solo && seatParam !== null ? parseInt(seatParam, 10) : null;

  const roomId = mode === 'match52' ? 'match52' : mode === 'ranked' ? 'ranked' : 'friendly';
  const userId = getJoinUserId();

  saveActiveGame({ roomId, mode, inGame: false, userId, name });

  socket.emit('join', { roomId, name, seat, solo, userId }, (res) => {
    if (res.error) {
      clearActiveGame();
      if (res.error !== 'اللعبة جارية') alert(res.error);
      soloMode = false;
      if (typeof initHome === 'function') initHome();
      else if (mode === 'ranked' && typeof initRankedLobby === 'function') {
        showScreen('ranked');
        initRankedLobby();
      } else showScreen('login');
      return;
    }
    mySeat = res.seat;
    soloMode = !!res.soloMode;
    applyGameCosmetics({
      session_bg_url: res.room?.sessionBgUrl || DEFAULT_SESSION_BG,
      card_back_url: res.room?.cardBackUrl,
    });
    const resolvedRoomId = res.roomId || roomId;
    saveActiveGame({
      roomId: resolvedRoomId,
      mode,
      inGame: res.room?.status === 'playing',
      userId,
      name,
      solo: !!res.soloMode,
      mySeat: res.seat,
      cardBackUrl: res.room?.cardBackUrl,
      sessionBgUrl: res.room?.sessionBgUrl,
    });
    if (res.room?.status === 'playing') {
      showScreen('game');
    }
    renderSeatsPreview(res.room.seats);
  });
}

if (new URLSearchParams(window.location.search).get('solo') === '1') {
  window.addEventListener('load', () => startMatchmaking(true));
}

$('#btn-fill-bots').addEventListener('click', () => {
  socket.emit('fill_bots');
});

$('#btn-cancel-match')?.addEventListener('click', () => {
  clearActiveGame();
  socket.emit('leave_game', {}, () => {
    if (currentMatchMode === 'ranked' && typeof initRankedLobby === 'function') {
      showScreen('ranked');
      initRankedLobby();
    } else if (typeof initHome === 'function') initHome();
  });
});

window.startSessionMatch = function startSessionMatch(session, roomId) {
  if (!session) return;
  currentMatchMode = 'session';
  currentSessionId = session.id;
  const name = getJoinName();
  const userId = getJoinUserId();
  const seatOrder = session.seat_order || (session.members || []).map((m) => m.user_id);
  const rid = roomId || `session_${session.id}`;
  showScreen('matchmaking');
  const title = $('#matchmaking-title');
  const sub = $('#matchmaking-sub');
  if (title) title.textContent = session.title || 'جلسة بلوت';
  if (sub) sub.textContent = session.stake ? `القيم: ${session.stake} — جاري الدخول...` : 'جاري الدخول للجلسة...';

  saveActiveGame({
    roomId: rid,
    mode: 'session',
    sessionId: session.id,
    inGame: false,
    userId,
    name,
    seatOrder,
    cardBackUrl: session.deck_back_url,
    sessionBgUrl: session.bg_image_url,
    stake: session.stake,
  });

  socket.emit('join', {
    roomId: rid,
    name,
    userId,
    cardBackUrl: session.deck_back_url || undefined,
    sessionBgUrl: session.bg_image_url || undefined,
    stake: session.stake,
    seatOrder,
  }, (res) => {
    if (res?.error) {
      alert(res.error);
      clearActiveGame();
      initSessionsPage?.();
      return;
    }
    mySeat = res.seat;
    if (res.room?.cardBackUrl) setCardBackUrl(res.room.cardBackUrl);
    applyGameCosmetics({
      session_bg_url: res.room?.sessionBgUrl || session.bg_image_url || DEFAULT_SESSION_BG,
      card_back_url: res.room?.cardBackUrl || session.deck_back_url,
    });
    saveActiveGame({
      roomId: rid,
      mode: 'session',
      sessionId: session.id,
      inGame: res.room?.status === 'playing',
      userId,
      name,
      mySeat: res.seat,
      seatOrder,
      cardBackUrl: res.room?.cardBackUrl || session.deck_back_url,
      sessionBgUrl: res.room?.sessionBgUrl || session.bg_image_url,
      stake: session.stake,
    });
    if (res.room?.status === 'playing') showScreen('game');
    renderSeatsPreview(res.room.seats);
  });
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#btn-leave-game');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  requestLeaveGame();
});

function tryRestoreActiveGame() {
  const saved = getActiveGame();
  if (restoreGamePending) return;
  if (!saved?.roomId && !(saved?.mode === 'session' && saved?.sessionId)) return;
  if (saved.mode === 'solo' || saved.roomId === 'solo') return;

  restoreGamePending = true;
  const name = saved.name || getJoinName();
  const userId = saved.userId || getJoinUserId();
  currentMatchMode = saved.mode || 'friendly';

  if (saved.mode === 'session' && saved.sessionId && !saved.inGame) {
    restoreGamePending = false;
    if (typeof openSessionLobby === 'function') {
      openSessionLobby(saved.sessionId);
    }
    return;
  }

  const payload = {
    roomId: saved.roomId,
    name,
    userId,
    cardBackUrl: saved.cardBackUrl,
    sessionBgUrl: saved.sessionBgUrl,
    stake: saved.stake,
    seatOrder: saved.seatOrder,
  };

  const done = (res) => {
    restoreGamePending = false;
    if (!res || res.error) {
      clearActiveGame();
      if (typeof initHome === 'function') initHome();
      return;
    }
    mySeat = res.seat;
    soloMode = !!res.soloMode;
    if (res.room?.cardBackUrl) setCardBackUrl(res.room.cardBackUrl);
    applyGameCosmetics({
      session_bg_url: res.room?.sessionBgUrl || saved.sessionBgUrl || DEFAULT_SESSION_BG,
      card_back_url: res.room?.cardBackUrl || saved.cardBackUrl,
    });
    saveActiveGame({ ...saved, inGame: res.room?.status === 'playing', mySeat: res.seat });
    if (res.room?.status === 'playing') {
      showScreen('game');
    } else {
      showScreen('matchmaking');
      renderSeatsPreview(res.room.seats);
    }
  };

  if (!socket.connected) {
    restoreGamePending = false;
    return;
  }
  socket.emit('join', payload, done);
  setTimeout(() => {
    if (restoreGamePending) {
      restoreGamePending = false;
    }
  }, 4000);
}

socket.on('connect', () => {
  setTimeout(tryRestoreActiveGame, 300);
});
if (socket.connected) setTimeout(tryRestoreActiveGame, 300);

socket.on('room_abandoned', () => {
  clearActiveGame();
  resetClientGameState();
  if (typeof initHome === 'function') initHome();
  else showScreen('home');
});

socket.on('room_update', (room) => {
  renderSeatsPreview(room.seats);
  updateMatchmakingCount(room.seats);
  if (room?.sessionBgUrl) {
    applyGameCosmetics({ session_bg_url: room.sessionBgUrl });
  }
});

function updateMatchmakingCount(seats) {
  const el = $('#matchmaking-count');
  if (!el || !seats?.length) {
    if (el) el.textContent = '1 / 4';
    return;
  }
  const filled = seats.filter((s) => s?.occupied || s?.name).length;
  el.textContent = `${filled} / 4`;
}

function renderSeatsPreview(seats) {
  updateMatchmakingCount(seats);
  const container = $('#seats-preview');
  const relLabels = { bottom: 'أنت', top: 'شريكك', left: 'خصم', right: 'خصم' };
  container.innerHTML = '';
  for (const pos of VISUAL_POSITIONS) {
    const globalIdx = mySeat !== null ? getGlobalSeat(pos, mySeat) : VISUAL_POSITIONS.indexOf(pos);
    const s = seats[globalIdx];
    const div = document.createElement('div');
    div.className = 'seat-slot' + (s?.occupied || s?.name ? ' filled' : '');
    div.textContent = s?.name ? `${s.name} (${relLabels[pos]})` : relLabels[pos];
    container.appendChild(div);
  }
}

// ---- Socket events ----
socket.on('game_start', (data) => {
  if (data?.gameMode) currentMatchMode = data.gameMode === 'session' ? 'session' : data.gameMode;
  saveActiveGame({ inGame: true });
  setSandboxUI(sandboxMode);
  showScreen('game');
  applyGameCosmetics({ session_bg_url: DEFAULT_SESSION_BG });
  preSelectedIndex = null;
  preSelectedCard = null;
  resetRoundVisuals();
  $('#btn-qaid')?.classList.remove('hidden');
  $('#btn-sawa')?.classList.remove('hidden');
});

function resetRoundVisuals() {
  floorCardRevealed = false;
  floorRevealStarted = false;
  lastFloorKey = '';
  handsFlippedForRound = false;
  pendingProjects = { سرا: 0, خمسين: 0, مية: 0, أربعمية: 0 };
}

socket.on('solo_game_state', ({ viewSeat, states }) => {
  soloMode = true;
  mySeat = viewSeat;
  const prevHandCount = gameState?.my_hand_count || 0;
  const prevHandsRevealed = gameState?.hands_revealed;
  mergeSoloGameState(states, viewSeat);
  applyGameCosmetics(gameState);

  if (gameState.hands_revealed && !prevHandsRevealed) {
    handsFlippedForRound = true;
    floorCardRevealed = true;
  }

  if (gameState.phase === 'PHASE_1' && gameState.my_hand_count === 5 && prevHandCount === 0) {
    resetRoundVisuals();
  }

  renderGame();
  handlePreSelectAutoPlay();
});

socket.on('game_state', ({ seat, state }) => {
  if (seat === mySeat) {
    const prevHandCount = gameState?.my_hand_count || 0;
    const prevHandsRevealed = gameState?.hands_revealed;
    const wasMyTurn = gameState?.phase === 'PLAYING' && gameState?.turn === mySeat;
    gameState = state;
    applyGameCosmetics(state);

    const isMyTurn = state.phase === 'PLAYING' && state.turn === mySeat;
    if (isMyTurn && !wasMyTurn) {
      myTurnStartedAt = Date.now();
    }

    if (state.hands_revealed && !prevHandsRevealed) {
      handsFlippedForRound = true;
      floorCardRevealed = true;
    }

    if (state.phase === 'PHASE_1' && state.my_hand_count === 5 && prevHandCount === 0) {
      resetRoundVisuals();
    }

    renderGame();
    handlePreSelectAutoPlay();
  }
});

socket.on('card_thrown', ({ player }) => {
  if (player === null || player === undefined) return;
  registerThrowAnim(player);
  if (gameState?.current_trick?.some((t) => t.player === player)) {
    renderTrick();
  }
});

socket.on('game_public', (state) => {
  const prevTrick = gameState?.current_trick || [];
  if (soloMode && gameState?.soloStates) {
    for (let i = 0; i < 4; i++) {
      const priv = {
        my_hand: gameState.soloStates[i].my_hand,
        my_hand_count: gameState.soloStates[i].my_hand_count,
        available_bids: gameState.soloStates[i].available_bids,
        legal_cards: gameState.soloStates[i].legal_cards,
        project_details: gameState.soloStates[i].project_details,
        can_ashkal: gameState.soloStates[i].can_ashkal,
        can_sawa: gameState.soloStates[i].can_sawa,
      };
      gameState.soloStates[i] = { ...gameState.soloStates[i], ...state, ...priv };
    }
    mergeSoloGameState(gameState.soloStates, mySeat);
  } else if (!gameState) {
    gameState = { ...state, my_seat: mySeat };
  } else {
    Object.assign(gameState, state);
  }
  applyGameCosmetics(state);

  const trick = state.current_trick || [];
  if (trick.length > prevTrick.length) {
    const newItem = trick[trick.length - 1];
    if (newItem && !throwAnims[newItem.player]) registerThrowAnim(newItem.player);
  }

  if (mySeat !== null) {
    if (soloMode) {
      renderGame();
    } else {
      renderPublicElements();
      renderTrick();
      renderProjectSpreads();
      renderQaidButton();
      renderSawaButton();
      renderSawaUI();
      syncQaidUI();
      if (gameState.phase === 'SCORE_SUMMARY') renderSummary();
    }
  }
});

socket.on('trick_resolved', ({ winner, cards }) => {
  if (cards?.length) startCollectAnimation(winner, cards);
  else setTimeout(() => renderTrick(), 100);
  setTimeout(() => renderProjectSpreads(), 100);
});

socket.on('chat', ({ seat, text }) => {
  showChatBubble(seat, text);
});

socket.on('qaid_started', (data) => {
  mergeQaidSessionFromEvent(data);
  syncQaidUI();
});
socket.on('qaid_ended', () => {
  closeQaidModal(true);
  resetQaidWizard();
  renderQaidButton();
  renderPublicElements();
  if (gameState?.phase === 'SCORE_SUMMARY') renderSummary();
});

socket.on('sawa_declared', () => {
  const layer = $('#project-spreads');
  if (layer) layer.innerHTML = '';
  renderSawaUI();
  renderQaidButton();
  renderSawaButton();
});

socket.on('match_over', async (payload) => {
  const winner = payload?.winner ?? payload;
  const scores = payload?.scores || gameState?.total_scores || {};
  const us = getMyTeam();
  const won = winner === us;
  $('#modal-summary')?.classList.add('hidden');

  let rankResult = null;
  const mode = payload?.gameMode || currentMatchMode;
  if (mode === 'ranked' && typeof window.onRankedMatchEnd === 'function') {
    rankResult = await window.onRankedMatchEnd(won);
  } else if (typeof reportMatchResult === 'function') {
    rankResult = await reportMatchResult(won, mode);
  }

  showMatchEndScreen({ won, scores, mode, rankResult });
});

function leaveMatchAfterEnd() {
  $('#modal-match-end')?.classList.add('hidden');
  clearActiveGame();
  if (currentMatchMode === 'ranked' && typeof initRankedLobby === 'function') initRankedLobby();
  else if (currentMatchMode === 'session') initSessionsPage?.();
  else if (typeof initHome === 'function') initHome();
}

function playAgainAfterMatch() {
  const mode = currentMatchMode;
  $('#modal-match-end')?.classList.add('hidden');
  clearActiveGame();
  if (mode === 'ranked' && typeof startRankedMatchmaking === 'function') {
    startRankedMatchmaking();
  } else if (mode === 'session') {
    initSessionsPage?.();
  } else if (typeof startMatchmaking === 'function') {
    startMatchmaking(false, 'friendly');
  }
}

$('#btn-match-leave')?.addEventListener('click', leaveMatchAfterEnd);
$('#btn-match-again')?.addEventListener('click', playAgainAfterMatch);

function formatBidLabel(s) {
  if (!s?.bid_type) return '';
  if (s.bid_type === 'SUN') return 'صن';
  const suit = s.bid_suit ? (SUIT_AR[s.bid_suit] || s.bid_suit) : '';
  return suit ? `حكم ${SUIT_SYM[s.bid_suit] || ''} ${suit}` : 'حكم';
}

function formatFloorCard(fc) {
  if (!fc?.suit || !fc?.rank) return '';
  const rank = RANK_AR[fc.rank] || fc.rank;
  const suit = SUIT_AR[fc.suit] || fc.suit;
  return `${rank} ${suit}`;
}

function showMatchEndScreen({ won, scores, mode, rankResult }) {
  const modal = $('#modal-match-end');
  const card = $('#match-end-card');
  if (!modal || !card) return;

  const us = getMyTeam();
  const them = us === 1 ? 2 : 1;
  const usScore = scores[us] ?? 0;
  const themScore = scores[them] ?? 0;

  card.classList.remove('match-win', 'match-lose');
  card.classList.add(won ? 'match-win' : 'match-lose');

  const title = $('#match-end-title');
  if (title) title.textContent = won ? 'مبروك' : 'انتهت المباراة';
  $('#match-end-us').textContent = usScore;
  $('#match-end-them').textContent = themScore;

  const profile = rankResult?.profile || getCachedProfile?.() || null;
  const name = profile?.name || getPlayerName?.() || 'لاعب';
  $('#match-end-name').textContent = name;
  $('#match-end-rank').textContent = profile?.rankLabel || 'مبتدئ ♣️';

  const avatarEl = $('#match-end-avatar');
  if (avatarEl) {
    const av = profile?.avatar_url || gameState?.seats?.[mySeat]?.avatar_url;
    if (av) {
      avatarEl.style.backgroundImage = `url(${av})`;
    } else {
      avatarEl.style.backgroundImage = '';
      avatarEl.textContent = name.charAt(0);
    }
  }

  const pct = profile?.progressPercent ?? 0;
  const fill = $('#match-end-progress-fill');
  if (fill) fill.style.width = `${pct}%`;
  const pts = profile?.rank_points ?? 0;
  const toNext = profile?.pointsToNext ?? (100 - pts);
  $('#match-end-progress-text').textContent = `${pts} / 100 — باقي ${toNext} للترقية`;

  const delta = rankResult?.pointsDelta ?? 0;
  const deltaEl = $('#match-end-points-delta');
  if (deltaEl) {
    deltaEl.classList.remove('negative', 'neutral');
    if (mode !== 'ranked') {
      deltaEl.textContent = 'ودية — بدون نقاط تصنيف';
      deltaEl.classList.add('neutral');
    } else if (delta > 0) {
      deltaEl.textContent = `+${delta} نقطة مكتسبة`;
    } else if (delta < 0) {
      deltaEl.textContent = `${delta} نقطة`;
      deltaEl.classList.add('negative');
    } else {
      deltaEl.textContent = '±0 نقطة';
      deltaEl.classList.add('neutral');
    }
  }

  modal.classList.remove('hidden');
}

socket.on('match_forfeit', ({ winnerTeam, penalty, winPoints, leaverUserId }) => {
  const us = getMyTeam();
  const won = winnerTeam === us;
  const myId = getJoinUserId();
  const iLeft = myId && leaverUserId === myId;
  let msg;
  if (iLeft) {
    msg = `غادرت المباراة المصنّفة — خُصم ${penalty} نقطة. المباراة القادمة التي تفوز فيها تحصل على 10 نقاط فقط.`;
  } else if (won) {
    msg = `فاز فريقكم بالانسحاب — +${winPoints} نقاط تصنيف`;
  } else {
    msg = 'انسحب أحد الخصوم — انتهت المباراة';
  }
  setTimeout(() => {
    alert(msg);
    clearActiveGame();
    if (currentMatchMode === 'ranked' && typeof initRankedLobby === 'function') initRankedLobby();
    else if (typeof initHome === 'function') initHome();
  }, 400);
});

socket.on('player_left', ({ name }) => {
  if (currentMatchMode === 'friendly' || currentMatchMode === 'session') {
    console.info('غادر اللاعب:', name);
  }
});

socket.on('new_round', () => {
  preSelectedIndex = null;
  preSelectedCard = null;
  throwAnims = {};
  collectAnim = null;
  $('#trick-collect')?.classList.add('hidden');
  resetRoundVisuals();
  lastSawaSpreadKey = '';
  const sawaLayer = $('#sawa-spreads');
  if (sawaLayer) sawaLayer.innerHTML = '';
  $('#sawa-objection-banner')?.classList.add('hidden');
  $('#game-board')?.classList.remove('sawa-active');
});

/** قبل التوزيع الثاني — 5 كروت فقط (لكن مكشوفة) */
function isPreSecondDealHand() {
  if (!gameState) return false;
  if (gameState.hand_hidden) return true;
  if (gameState.hakam_pre_deal && gameState.phase === 'DOUBLING') return true;
  return ['HAKAM_COUNTER', 'HAKAM_CONFIRM'].includes(gameState.phase);
}

function isHandHiddenPhase() {
  return isPreSecondDealHand();
}

/** الكروت مكشوفة طول مرحلة الشراء والمزايدة */
function shouldShowHandFaces() {
  if (!gameState) return false;
  if (['PLAYING', 'SCORE_SUMMARY'].includes(gameState.phase)) return true;
  if (gameState.hands_revealed) return true;
  if (['PHASE_1', 'PHASE_2', 'GABLAK_PHASE', 'HAKAM_COUNTER', 'HAKAM_CONFIRM', 'DOUBLING'].includes(gameState.phase)) {
    return true;
  }
  return false;
}

/** كشف كرت الأرض ثم قلب يد اللاعب */
function scheduleFloorReveal() {
  const el = $('#floor-card');
  const fc = gameState.floor_card;
  if (!fc) return;

  floorRevealStarted = true;
  el.classList.remove('revealed', 'flipping');
  el.style.backgroundImage = `url(${cardBackUrl()})`;

  setTimeout(() => {
    el.classList.add('flipping');
    setTimeout(() => {
      el.classList.add('revealed');
      el.style.backgroundImage = `url(${cardImageUrl(fc)})`;
      el.classList.remove('flipping');
      floorCardRevealed = true;
      handsFlippedForRound = true;
      renderMyHand(true);
    }, 200);
  }, 400);
}

// ---- Render ----
function renderSoloBanner() {
  let el = $('#solo-banner');
  if (!soloMode) {
    el?.classList.add('hidden');
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'solo-banner';
    el.className = 'solo-banner';
    $('#game-board')?.prepend(el);
  }
  el.classList.remove('hidden');
  const labels = ['يمين', 'فوق', 'يسار', 'أنت'];
  const cs = getControlSeat();
  el.textContent = `تجربة فردية — تلعب الآن كمقعد ${cs} (${labels[cs]})`;
}

function renderGame() {
  if (!gameState) return;
  renderSoloBanner();
  renderPublicElements();
  renderFloorCard();
  renderMyHand();
  renderBidButtons();
  renderProjects();
  renderTrick();
  renderProjectSpreads();
  renderSawaUI();
  renderQaidButton();
  renderSawaButton();
  syncQaidUI();
  renderSummary();
  if (typeof reapplyGameLayoutForHandCount === 'function') {
    reapplyGameLayoutForHandCount();
  }
}

function renderSeatAppearance(seatEl, seatInfo) {
  const avatar = seatEl.querySelector('.avatar');
  const star = seatEl.querySelector('.status-star');
  const glow = seatEl.querySelector('.deck-glow-ring');
  if (avatar) {
    if (seatInfo?.avatar_url) {
      avatar.style.backgroundImage = `url(${seatInfo.avatar_url})`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
      avatar.classList.add('has-photo');
    } else {
      avatar.style.backgroundImage = '';
      avatar.classList.remove('has-photo');
    }
  }
  if (glow) {
    if (seatInfo && !seatInfo.isBot && seatInfo.deck_glow_color) {
      glow.style.setProperty('--deck-glow', seatInfo.deck_glow_color);
      glow.classList.remove('hidden');
    } else {
      glow.classList.add('hidden');
    }
  }
  if (star) {
    star.className = 'status-star hidden';
    if (seatInfo?.star === 'admin') {
      star.classList.add('star-admin');
      star.classList.remove('hidden');
    } else if (seatInfo?.star === 'famous') {
      star.classList.add('star-famous');
      star.classList.remove('hidden');
    } else if (seatInfo?.star === 'vip') {
      star.classList.add('star-vip');
      star.classList.remove('hidden');
    }
  }
}

function getSeatBuyerBadge(globalSeat) {
  if (!gameState?.bid?.type) return null;
  const phase = gameState.phase;
  const badgePhases = ['PLAYING', 'DOUBLING', 'HAKAM_CONFIRM', 'HAKAM_COUNTER'];
  if (!badgePhases.includes(phase)) return null;

  const bid = gameState.bid;
  const buyerSeat = gameState.buyer_seat ?? bid.bidder;
  const doubleLevel = gameState.double_level ?? 1;
  const lastDoubling = gameState.last_doubling_seat;

  if (
    phase === 'DOUBLING'
    && doubleLevel >= 2
    && lastDoubling === globalSeat
    && bid.type === 'HAKAM'
    && bid.suit
  ) {
    return {
      kind: 'doubling',
      primary: SUIT_SYM[bid.suit] || bid.suit,
      secondary: gameState.hakam_locked ? 'مقفل' : 'مفتوح',
    };
  }

  if (buyerSeat !== globalSeat) return null;
  if (phase === 'DOUBLING' && doubleLevel >= 2) return null;

  if (bid.is_ashkal) return { kind: 'ashkal', primary: 'أشكل' };
  if (bid.type === 'SUN') return { kind: 'sun', primary: 'صن' };
  if (bid.type === 'HAKAM') {
    const sym = bid.suit ? (SUIT_SYM[bid.suit] || '') : '';
    return { kind: 'hakam', primary: sym ? `حكم ${sym}` : 'حكم' };
  }
  return null;
}

function renderPublicElements() {
  if (!gameState || mySeat === null) return;

  const us = getMyTeam();
  const them = us === 1 ? 2 : 1;
  $('#score-us').textContent = gameState.total_scores?.[us] ?? 0;
  $('#score-them').textContent = gameState.total_scores?.[them] ?? 0;
  let phaseText = PHASE_LABELS[gameState.phase] || gameState.phase;
  if (gameState.sun_over100_special) {
    phaseText = 'صن فوق المية · دبل فقط';
  } else if (gameState.hakam_pre_deal && gameState.phase === 'DOUBLING') {
    phaseText = 'تدبيل قبل التوزيع';
  } else if (gameState.bid?.type === 'HAKAM' && gameState.double_level > 1) {
    phaseText += gameState.hakam_locked ? ' · مقفل' : ' · مفتوح';
  }
  if (gameState.double_level === 5) phaseText = 'قهوة';
  if (gameState.qaid_session) phaseText = 'قيد جاري — الوقت متوقف';
  $('#phase-label').textContent = phaseText;

  // Clear all seats first
  for (const pos of VISUAL_POSITIONS) {
    const nodes = seatVisualNodes(pos);
    if (!nodes.avatar && !nodes.name) continue;
    setSeatVisualClass(pos, 'active-turn', false);
    setSeatVisualClass(pos, 'is-partner', false);
    setSeatVisualClass(pos, 'sawa-declarer-seat', false);
    if (nodes.nameEl) nodes.nameEl.textContent = '';
    if (nodes.rankEl) {
      nodes.rankEl.textContent = '';
      nodes.rankEl.classList.add('hidden');
    }
    if (nodes.dealerBadge) nodes.dealerBadge.classList.add('hidden');
    if (nodes.bidBadge) nodes.bidBadge.classList.add('hidden');
    if (nodes.handEl) nodes.handEl.innerHTML = '';
    if (nodes.avatar) renderSeatAppearance(nodes.avatar, null);
  }

  // Map each global seat → its visual slot on this client
  for (let globalSeat = 0; globalSeat < 4; globalSeat++) {
    const visualPos = getVisualPos(globalSeat, mySeat);
    const nodes = seatVisualNodes(visualPos);
    if (!nodes.avatar && !nodes.name) continue;

    const seatInfo = gameState.seats?.[globalSeat];
    if (nodes.nameEl && seatInfo) nodes.nameEl.textContent = seatInfo.name || '';
    if (nodes.rankEl && seatInfo) {
      const rank = seatInfo.rank_label || seatInfo.rankLabel || '';
      nodes.rankEl.textContent = rank;
      nodes.rankEl.classList.toggle('hidden', !rank);
      const theme = seatInfo.rank_theme || seatInfo.rankTheme || 'wood';
      nodes.rankEl.dataset.rankTheme = theme;
    }
    if (nodes.avatar) renderSeatAppearance(nodes.avatar, seatInfo);

    if (nodes.dealerBadge) {
      nodes.dealerBadge.classList.toggle('hidden', gameState.dealer_idx !== globalSeat);
    }

    if (nodes.bidBadge) {
      const badge = getSeatBuyerBadge(globalSeat);
      if (badge) {
        nodes.bidBadge.classList.remove('hidden', 'sun', 'hakam', 'ashkal', 'doubling');
        nodes.bidBadge.classList.add(badge.kind);
        if (badge.secondary) {
          nodes.bidBadge.innerHTML = `${badge.primary} <span class="bid-lock">${badge.secondary}</span>`;
        } else {
          nodes.bidBadge.textContent = badge.primary;
        }
      } else {
        nodes.bidBadge.classList.add('hidden');
      }
    }

    setSeatVisualClass(
      visualPos,
      'active-turn',
      gameState.turn === globalSeat && gameState.phase !== 'SCORE_SUMMARY',
    );

    setSeatVisualClass(visualPos, 'is-partner', visualPos === 'top');

    // Opponent/partner card backs — hide only declarer's fan during sawa
    if (!isBottomHandSeat(globalSeat) && !gameState.sawa_declaration) {
      const back = seatDeckBackUrl(globalSeat);
      if (nodes.handEl) {
        buildFanHand(
          nodes.handEl,
          gameState.hand_counts?.[globalSeat] || 0,
          false,
          back,
        );
      }
    } else if (!isBottomHandSeat(globalSeat) && gameState.sawa_declaration) {
      if (nodes.handEl) {
        if (isSawaDeclarerSeat(globalSeat) || isSawaOpponentSeat(globalSeat)) {
          nodes.handEl.innerHTML = '';
        } else {
          const back = seatDeckBackUrl(globalSeat);
          buildFanHand(
            nodes.handEl,
            gameState.hand_counts?.[globalSeat] || 0,
            false,
            back,
          );
        }
      }
    }
    setSeatVisualClass(visualPos, 'sawa-declarer-seat', isSawaDeclarerSeat(globalSeat));
  }
}

function buildFanHand(handEl, count, _vertical, backUrl) {
  handEl.innerHTML = '';
  if (!count) return;
  const back = backUrl || cardBackUrl();
  const step = 8;
  for (let c = 0; c < count; c++) {
    const card = document.createElement('div');
    card.className = 'fan-card';
    card.style.backgroundImage = `url(${back})`;
    const fan = getHandFanStyle(c, count);
    card.style.transform = `translate(${c * step}px, ${fan.y}px) rotate(${fan.r}deg)`;
    card.style.zIndex = c + 1;
    handEl.appendChild(card);
  }
}

/** منحنى المروحة — الأطراف تنزل شوي */
const HAND_FAN_CURVE = [
  { y: 22, r: -9 },
  { y: 14, r: -6 },
  { y: 6, r: -3 },
  { y: 2, r: -1 },
  { y: 2, r: 1 },
  { y: 6, r: 3 },
  { y: 14, r: 6 },
  { y: 22, r: 9 },
];

function getHandCardOverlap(count) {
  const w = window.innerWidth;
  const cardW = Math.min(148, Math.max(72, w * 0.145));
  if (count >= 8) {
    const budget = w * 0.94 - cardW - 15;
    const step = Math.max(18, budget / 7);
    return Math.min(cardW - 14, cardW - step);
  }
  if (count >= 6) {
    return Math.min(52, Math.max(32, w * 0.048));
  }
  return Math.min(28, Math.max(12, w * 0.032));
}

function getHandFanStyle(displayIdx, count) {
  if (count <= 1) return { y: 0, r: 0 };
  const t = displayIdx / (count - 1);
  const pos = t * 7;
  const i0 = Math.floor(pos);
  const i1 = Math.min(7, i0 + 1);
  const f = pos - i0;
  const a = HAND_FAN_CURVE[i0];
  const b = HAND_FAN_CURVE[i1];
  return {
    y: a.y + (b.y - a.y) * f,
    r: a.r + (b.r - a.r) * f,
  };
}

function applyMyHandCardFan(wrap, displayIdx, count) {
  const fan = getHandFanStyle(displayIdx, count);
  wrap.style.transform = `translateY(${fan.y}px) rotate(${fan.r}deg)`;
  wrap.style.zIndex = String(displayIdx + 1);
}

function renderMyHand(animateFlip = false) {
  const handEl = $('#my-hand');
  if (!gameState) return;
  if (gameState.sawa_declaration && (isSawaDeclarerSeat(mySeat) || isSawaOpponentSeat(mySeat))) {
    handEl.innerHTML = '';
    return;
  }

  const rawHand = gameState.my_hand || [];
  const isMyTurn = isMyTurnToAct() && gameState.phase === 'PLAYING' && !gameState.qaid_session;
  const showFaces = shouldShowHandFaces();
  const capped = isPreSecondDealHand() ? rawHand.slice(0, 5) : rawHand;
  const sorted = sortHandForDisplay(capped, gameState.bid);
  const count = sorted.length;

  handEl.className = 'my-hand';

  handEl.innerHTML = '';
  const overlap = getHandCardOverlap(count);
  const suitGapExtra = count >= 8 ? 5 : 10;
  sorted.forEach(({ card, serverIdx }, displayIdx) => {
    const wrap = document.createElement('div');
    wrap.className = 'hand-card-wrap';
    if (displayIdx > 0) {
      let ml = -overlap;
      if (sorted[displayIdx - 1].card.suit !== card.suit) ml += suitGapExtra;
      wrap.style.marginLeft = `${ml}px`;
    }
    applyMyHandCardFan(wrap, displayIdx, count);

    const div = document.createElement('div');
    div.className = 'hand-card';
    div.dataset.idx = serverIdx;

    const faceUrl = cardImageUrl(card);
    const backUrl = seatDeckBackUrl(mySeat);

    if (showFaces) {
      if (animateFlip) {
        div.style.backgroundImage = `url(${backUrl})`;
        div.style.setProperty('--flip-delay', `${displayIdx * 70}ms`);
        div.classList.add('flip-reveal');
        setTimeout(() => {
          div.style.backgroundImage = `url(${faceUrl})`;
        }, 200 + displayIdx * 70);
      } else {
        div.style.backgroundImage = `url(${faceUrl})`;
        div.classList.add('flipped');
      }
    } else {
      div.style.backgroundImage = `url(${backUrl})`;
    }

    if (preSelectedIndex === serverIdx) div.classList.add('preselected');
    if (isMyTurn) div.classList.add('playable');

    div.addEventListener('click', () => onCardClick(serverIdx, card));
    wrap.appendChild(div);
    handEl.appendChild(wrap);
  });
}

function renderSandboxMockHand(count = 8) {
  const handEl = $('#my-hand');
  if (!handEl) return;
  const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const n = Math.max(1, Math.min(8, count));
  const cards = Array.from({ length: n }, (_, i) => ({
    suit: suits[i % suits.length],
    rank: ranks[i % ranks.length],
  }));
  handEl.className = 'my-hand';
  handEl.innerHTML = '';
  const overlap = getHandCardOverlap(n);
  const suitGapExtra = n >= 8 ? 5 : 10;
  cards.forEach((card, displayIdx) => {
    const wrap = document.createElement('div');
    wrap.className = 'hand-card-wrap';
    if (displayIdx > 0) {
      let ml = -overlap;
      if (cards[displayIdx - 1].suit !== card.suit) ml += suitGapExtra;
      wrap.style.marginLeft = `${ml}px`;
    }
    applyMyHandCardFan(wrap, displayIdx, n);
    const div = document.createElement('div');
    div.className = 'hand-card';
    div.style.backgroundImage = `url(${cardImageUrl(card)})`;
    wrap.appendChild(div);
    handEl.appendChild(wrap);
  });
}

window.renderSandboxMockHand = renderSandboxMockHand;

function onCardClick(idx, card) {
  if (gameState.qaid_session) return;
  if (gameState.phase !== 'PLAYING') return;
  if (!shouldShowHandFaces()) return;

  const isMyTurn = isMyTurnToAct();

  if (!isMyTurn) {
    if (preSelectedIndex === idx) {
      preSelectedIndex = null;
      preSelectedCard = null;
    } else {
      preSelectedIndex = idx;
      preSelectedCard = card;
    }
    renderMyHand();
    return;
  }

  playCardWithAnimation(idx);
}

function handlePreSelectAutoPlay() {
  if (!isMyTurnToAct() || gameState.phase !== 'PLAYING') return;
  if (preSelectedIndex === null || preSelectedCard === null) return;

  const hand = gameState.my_hand || [];
  let idx = preSelectedIndex;
  if (!hand[idx] || !cardEquals(hand[idx], preSelectedCard)) {
    idx = hand.findIndex((c) => cardEquals(c, preSelectedCard));
  }

  if (idx >= 0) playCardWithAnimation(idx);
  else {
    preSelectedIndex = null;
    preSelectedCard = null;
    renderMyHand();
  }
}

function playCardWithAnimation(idx) {
  preSelectedIndex = null;
  preSelectedCard = null;

  const playMs = myTurnStartedAt ? Date.now() - myTurnStartedAt : null;
  myTurnStartedAt = null;

  if (mySeat != null) registerThrowAnim(mySeat);

  emitGameAction('play_card', { cardIndex: idx, projects: { ...pendingProjects }, playMs }, (res) => {
    if (res?.error) alert(res.error);
  });
}

function renderTrick() {
  if (collectAnim) return;
  const area = $('#trick-area');
  if (!area) return;
  const trick = gameState?.current_trick || [];
  const trickKey = trick.map((t) => `${t.player}-${t.card?.suit}-${t.card?.rank}`).join('|');

  area.innerHTML = '';
  if (!trick.length) {
    lastTrickKey = '';
    return;
  }

  const centerX = 100;
  const centerY = 100;
  const { hw, hh } = getCardHalfSize();
  let needsFrame = false;

  trick.forEach((item, trickIndex) => {
    const { player, card } = item;
    const visualPos = getVisualPos(player, mySeat);
    const off = TRICK_OFFSETS_BY_POS[visualPos] || { x: 0, y: 0 };
    const targetX = centerX + off.x;
    const targetY = centerY + off.y;

    const div = document.createElement('div');
    div.className = 'trick-card';
    div.style.backgroundImage = `url(${cardImageUrl(card)})`;
    div.style.zIndex = String(trickIndex + 1);

    const anim = throwAnims[player];
    const areaRect = area.getBoundingClientRect();

    if (anim) {
      const elapsed = performance.now() - anim.startTime;
      const p = Math.min(1, elapsed / THROW_DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      const endX = areaRect.left + targetX;
      const endY = areaRect.top + targetY;
      const cx = anim.startX + (endX - anim.startX) * eased;
      let cy = anim.startY + (endY - anim.startY) * eased;
      cy += Math.sin(p * Math.PI) * -28;
      div.style.left = `${cx - areaRect.left - hw}px`;
      div.style.top = `${cy - areaRect.top - hh}px`;
      div.style.transform = `scale(${0.9 + eased * 0.1})`;
      div.classList.add('throwing');
      if (p < 1) needsFrame = true;
      else delete throwAnims[player];
    } else {
      div.style.left = `${targetX - hw}px`;
      div.style.top = `${targetY - hh}px`;
      div.style.transform = '';
    }

    area.appendChild(div);
  });

  lastTrickKey = trickKey;
  if (needsFrame) requestAnimationFrame(() => renderTrick());
}

function startCollectAnimation(winner, cards) {
  collectAnim = true;
  const layer = $('#trick-collect');
  if (!layer) {
    collectAnim = null;
    return;
  }
  layer.classList.remove('hidden');
  layer.innerHTML = '';

  const area = $('#trick-area');
  const domCards = [...area.querySelectorAll('.trick-card')];
  const areaRect = area.getBoundingClientRect();
  const dest = getAvatarScreenPos(winner);
  const { hw, hh } = getCardHalfSize();
  const startTime = performance.now();

  const items = cards.map((item, i) => {
    const { player, card } = item;
    const el = document.createElement('div');
    el.className = 'fly-card';
    el.style.backgroundImage = `url(${cardImageUrl(card)})`;
    layer.appendChild(el);

    const dom = domCards[i];
    let sx;
    let sy;
    if (dom) {
      const r = dom.getBoundingClientRect();
      sx = r.left;
      sy = r.top;
    } else {
      const visualPos = getVisualPos(player, mySeat);
      const off = TRICK_OFFSETS_BY_POS[visualPos] || { x: 0, y: 0 };
      sx = areaRect.left + 100 + off.x - hw;
      sy = areaRect.top + 100 + off.y - hh;
    }

    return { el, sx, sy };
  });

  area.innerHTML = '';
  lastTrickKey = '';

  function tick(now) {
    const elapsed = now - startTime;
    let done = true;
    items.forEach(({ el, sx, sy }, i) => {
      const delay = i * 28;
      const local = elapsed - delay;
      const p = Math.min(1, Math.max(0, local / COLLECT_DURATION));
      const eased = p * (2 - p);
      const arc = Math.sin(eased * Math.PI) * -22;
      const x = sx + (dest.x - hw - sx) * eased;
      const y = sy + (dest.y - hh - sy) * eased + arc;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.opacity = String(1 - eased * 0.45);
      el.style.transform = `scale(${1 - eased * 0.12})`;
      if (p < 1) done = false;
    });
    if (!done) requestAnimationFrame(tick);
    else {
      layer.classList.add('hidden');
      layer.innerHTML = '';
      collectAnim = null;
      renderTrick();
    }
  }
  requestAnimationFrame(tick);
}

function renderFloorCard() {
  const el = $('#floor-card');
  const fc = gameState.floor_card;
  const inBidding = fc && [
    'PHASE_1', 'PHASE_2', 'GABLAK_PHASE', 'HAKAM_COUNTER', 'HAKAM_CONFIRM',
  ].includes(gameState.phase)
    || (gameState.phase === 'DOUBLING' && gameState.hakam_pre_deal);

  if (!inBidding) {
    el.classList.add('hidden');
    el.classList.remove('revealed', 'flipping');
    return;
  }

  el.classList.remove('hidden');
  const key = `${fc.suit}-${fc.rank}`;

  if (key !== lastFloorKey) {
    lastFloorKey = key;
    floorCardRevealed = false;
    floorRevealStarted = false;
    handsFlippedForRound = false;
  }

  if (floorCardRevealed) {
    el.classList.add('revealed');
    el.style.backgroundImage = `url(${cardImageUrl(fc)})`;
    return;
  }

  if (!floorRevealStarted) {
    scheduleFloorReveal();
  }
}

function renderBidButtons() {
  const container = $('#bid-buttons');
  const bids = gameState.available_bids || [];

  if (!bids.length || !isMyTurnToAct() || gameState.phase === 'SCORE_SUMMARY') {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = '';

  bids.forEach((bid) => {
    const btn = document.createElement('button');
    btn.className = 'bid-card';
    btn.type = 'button';
    btn.innerHTML = `<span class="bid-card-mark" aria-hidden="true">♠</span><span class="bid-card-label">${bid.label}</span>`;
    btn.addEventListener('click', () => onBidClick(bid));
    container.appendChild(btn);
  });
}

function onBidClick(bid) {
  if (bid.needsSuitPicker || (bid.action === 'HAKAM' && gameState.phase === 'PHASE_2')) {
    pendingHakamBid = true;
    showHakamModal();
    return;
  }

  if (bid.needsLockChoice || (['DOUBLE', 'THREE', 'FOUR'].includes(bid.action) && !gameState.sun_over100_special)) {
    showLockModal(bid);
    return;
  }

  let action = bid.action;
  let suit = null;
  if (bid.needsFloorSuit && gameState.floor_card) {
    suit = gameState.floor_card.suit;
  }

  emitGameAction('bid', { action, suit });
}

function showLockModal(bid) {
  pendingLockBid = bid;
  const modal = $('#modal-lock');
  const titles = { DOUBLE: 'الدبل — مقفل أو مفتوح؟', THREE: 'الثري — مقفل أو مفتوح؟', FOUR: 'الفور — مقفل أو مفتوح؟' };
  $('#lock-modal-title').textContent = titles[bid.action] || 'اختر نوع التدبيل';
  modal.classList.remove('hidden');
}

function submitLockChoice(locked) {
  if (!pendingLockBid) return;
  const { action } = pendingLockBid;
  pendingLockBid = null;
  $('#modal-lock').classList.add('hidden');
  emitGameAction('bid', { action, locked });
}

$('#btn-lock-open').addEventListener('click', () => submitLockChoice(false));
$('#btn-lock-closed').addEventListener('click', () => submitLockChoice(true));
$('.btn-cancel-lock').addEventListener('click', () => {
  pendingLockBid = null;
  $('#modal-lock').classList.add('hidden');
});

// ---- Hakam Modal ----
function showHakamModal() {
  const modal = $('#modal-hakam');
  modal.classList.remove('hidden');
  const floorSuit = gameState.floor_card?.suit;

  $$('.suit-btn').forEach((btn) => {
    const suit = btn.dataset.suit;
    btn.disabled = suit === floorSuit;
    btn.onclick = () => {
      modal.classList.add('hidden');
      pendingHakamBid = false;
      emitGameAction('bid', { action: 'HAKAM', suit });
    };
  });
}

$('.btn-cancel-modal').addEventListener('click', () => {
  $('#modal-hakam').classList.add('hidden');
  pendingHakamBid = false;
});

// ---- Projects ----
function cycleProject(name) {
  const max = PROJECT_MAX[name];
  pendingProjects[name] = (pendingProjects[name] + 1) % (max + 1);
  renderProjects();
}

function renderProjects() {
  const bar = $('#project-bar');
  const played = gameState.played_in_trick1?.[getControlSeat()];
  const show = gameState.phase === 'PLAYING' && gameState.trick_count === 1 && !played;

  if (!show) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  bar.innerHTML = '';

  PROJECT_NAMES.forEach((name) => {
    const count = pendingProjects[name] || 0;
    const btn = document.createElement('button');
    btn.className = 'proj-btn' + (count > 0 ? ' active' : '');
    btn.innerHTML = `<span>${projectDisplayLabel(name)}</span><span class="proj-count">${count}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleProject(name);
    });
    bar.appendChild(btn);
  });
}

function renderProjectSpreads() {
  const layer = $('#project-spreads');
  if (!layer || !gameState) return;
  layer.innerHTML = '';

  if (gameState.phase !== 'PLAYING' || gameState.sawa_declaration) return;

  for (let g = 0; g < 4; g++) {
    const handCount = gameState.hand_counts?.[g] ?? 0;
    if (handCount <= 6) continue;

    const revealed = gameState.reveals?.[g];
    const active = gameState.spreads?.[g] || [];
    const cards = active.length ? active : (revealed?.cards || []);
    if (!cards?.length) continue;

    const names = revealed?.names?.length
      ? revealed.names
      : (gameState.declared_project_names?.[g] || []);

    const visualPos = getVisualPos(g, mySeat);
    const anchor = SPREAD_ANCHOR[visualPos];
    const wrap = document.createElement('div');
    wrap.className = 'project-spread' + (revealed?.cards?.length ? ' revealed' : '');

    if (names.length) {
      const lbl = document.createElement('div');
      lbl.className = 'spread-label';
      lbl.textContent = names.map(projectDisplayLabel).join(' · ');
      wrap.appendChild(lbl);
    }

    wrap.style.left = `${anchor.x * 100}%`;
    wrap.style.top = `${anchor.y * 100}%`;
    wrap.style.transform = 'translate(-50%, -50%)';

    const row = document.createElement('div');
    row.className = 'spread-cards-row';

    cards.forEach((c, i) => {
      const cd = document.createElement('div');
      cd.className = 'spread-card';
      cd.style.backgroundImage = `url(${cardImageUrl(c)})`;
      cd.style.zIndex = String(i + 1);
      row.appendChild(cd);
    });
    wrap.appendChild(row);
    layer.appendChild(wrap);
  }
}

function renderSawaUI() {
  const board = $('#game-board');
  if (board) board.classList.toggle('sawa-active', !!gameState?.sawa_declaration);
  renderSawaSpreads();
  renderSawaObjectionBanner();
}

function renderSawaSpreads() {
  const layer = $('#sawa-spreads');
  if (!layer) return;
  const decl = gameState?.sawa_declaration;
  if (!decl || !gameState.sawa_hands?.length) {
    layer.innerHTML = '';
    lastSawaSpreadKey = '';
    return;
  }

  const spreadKey = `${decl.seat}-${decl.declared_at}`;
  if (spreadKey === lastSawaSpreadKey && layer.children.length > 0) return;
  lastSawaSpreadKey = spreadKey;

  layer.innerHTML = '';

  const entry = gameState.sawa_hands.find((h) => h.seat === decl.seat);
  if (entry?.cards?.length) {
    const lbl = document.createElement('div');
    lbl.className = 'sawa-center-label';
    lbl.textContent = 'سوا';
    layer.appendChild(lbl);

    const positions = sawaScatterPositions(entry.cards.length, spreadKey);
    entry.cards.forEach((c, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'sawa-scatter-wrap';
      wrap.style.left = `${positions[i].x * 100}%`;
      wrap.style.top = `${positions[i].y * 100}%`;
      wrap.style.setProperty('--sawa-rot', `${positions[i].rot}deg`);
      wrap.style.animationDelay = `${i * 45}ms`;

      const cd = document.createElement('div');
      cd.className = 'sawa-card sawa-scatter';
      cd.style.backgroundImage = `url(${cardImageUrl(c)})`;
      cd.style.zIndex = String(i + 1);
      wrap.appendChild(cd);
      layer.appendChild(wrap);
    });
  }

  for (let g = 0; g < 4; g++) {
    if (!isSawaOpponentSeat(g)) continue;
    const oppEntry = gameState.sawa_hands.find((h) => h.seat === g);
    if (!oppEntry?.cards?.length) continue;

    const visualPos = getVisualPos(g, mySeat);
    const anchor = SPREAD_ANCHOR[visualPos];
    const wrap = document.createElement('div');
    wrap.className = 'project-spread sawa-opponent-spread revealed';

    if (oppEntry.name) {
      const lbl = document.createElement('div');
      lbl.className = 'spread-label';
      lbl.textContent = oppEntry.name;
      wrap.appendChild(lbl);
    }

    wrap.style.left = `${anchor.x * 100}%`;
    wrap.style.top = `${anchor.y * 100}%`;
    wrap.style.transform = 'translate(-50%, -50%)';

    const row = document.createElement('div');
    row.className = 'spread-cards-row';

    oppEntry.cards.forEach((c, i) => {
      const cd = document.createElement('div');
      cd.className = 'spread-card';
      cd.style.backgroundImage = `url(${cardImageUrl(c)})`;
      cd.style.zIndex = String(i + 1);
      row.appendChild(cd);
    });
    wrap.appendChild(row);
    layer.appendChild(wrap);
  }
}

function renderSawaObjectionBanner() {
  const el = $('#sawa-objection-banner');
  if (!el) return;
  if (sawaBannerInterval) {
    clearInterval(sawaBannerInterval);
    sawaBannerInterval = null;
  }
  const decl = gameState?.sawa_declaration;
  if (!decl) {
    el.classList.add('hidden');
    return;
  }
  if (decl.phase === 'reveal') {
    el.textContent = 'عرض كروت السوا...';
    el.classList.remove('hidden');
    el.style.borderColor = '#f0c96a';
    el.style.color = '#fde68a';
    return;
  }
  if (gameState.qaid_session) {
    el.textContent = 'قيد جاري — الوقت متوقف';
    el.classList.remove('hidden');
    el.style.borderColor = '#ef4444';
    el.style.color = '#fecaca';
    return;
  }
  el.style.borderColor = '#ef4444';
  el.style.color = '#fecaca';
  if (decl.phase !== 'objection') {
    el.classList.add('hidden');
    return;
  }
  const ms = gameState.sawa_objection_ms || 4000;
  const deadline = decl.objection_deadline;
  const started = decl.objection_started_at || Date.now();
  const tick = () => {
    const left = deadline
      ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      : Math.max(0, Math.ceil((started + ms - Date.now()) / 1000));
    if (left > 0) {
      el.textContent = `وقت القيد: ${left} ث`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
      if (sawaBannerInterval) {
        clearInterval(sawaBannerInterval);
        sawaBannerInterval = null;
      }
    }
  };
  tick();
  sawaBannerInterval = setInterval(tick, 200);
}

// ---- Qaid ----
function getQaidControlSeat() {
  if (soloMode) return getControlSeat();
  return mySeat;
}

function isQaidObjector() {
  const session = gameState?.qaid_session;
  if (!session) return false;
  const seat = getQaidControlSeat();
  return seat !== null && seat !== undefined && seat === session.seat;
}

function canUseQaid() {
  if (gameState?.phase !== 'PLAYING') return false;
  if (gameState.qaid_session) return false;
  if (gameState.sawa_declaration) {
    if (gameState.sawa_declaration.phase !== 'objection') return false;
    return gameState.sawa_declaration.team !== getMyTeam();
  }
  return gameState.trick_history?.length >= 1;
}

function renderSawaButton() {
  const btn = $('#btn-sawa');
  if (!btn) return;
  const show = gameState?.phase === 'PLAYING';
  btn.classList.toggle('hidden', !show);
  if (!show) return;
  const enabled = !!gameState.can_sawa && !gameState.sawa_declaration;
  btn.disabled = !enabled;
  btn.classList.toggle('disabled', !enabled);
  btn.title = enabled
    ? 'إعلان سوا — كل كروتك تاكل'
    : gameState.sawa_declaration
      ? 'سوا معلن — انتظر الاعتراض'
      : 'السوا في دورك مع 4 كروت أو أقل وبداية أكلة فارغة';
}

$('#btn-sawa')?.addEventListener('click', () => {
  if (!gameState?.can_sawa || gameState.sawa_declaration) return;
  emitGameAction('sawa', {}, (res) => {
    if (res?.error) alert(res.error);
  });
});

function renderQaidButton() {
  const btn = $('#btn-qaid');
  if (!btn) return;
  btn.classList.remove('hidden');
  const enabled = canUseQaid();
  btn.disabled = !enabled;
  btn.classList.toggle('disabled', !enabled);

  if (sawaQaidInterval) {
    clearInterval(sawaQaidInterval);
    sawaQaidInterval = null;
  }

  if (gameState?.qaid_session) {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.textContent = 'قيد';
    btn.title = 'قيد جاري';
    return;
  }

  if (gameState?.sawa_declaration?.phase === 'reveal') {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.textContent = 'قيد';
    btn.title = 'جاري عرض كروت السوا...';
    return;
  }

  if (gameState?.sawa_declaration?.phase === 'objection' && enabled && !gameState.sawa_objection_paused) {
    const deadline = gameState.sawa_declaration.objection_deadline;
    const ms = gameState.sawa_objection_ms || 4000;
    const started = gameState.sawa_declaration.objection_started_at || Date.now();
    const updateCountdown = () => {
      const left = deadline
        ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        : Math.max(0, Math.ceil((started + ms - Date.now()) / 1000));
      btn.textContent = left > 0 ? `قيد ${left}` : 'قيد';
      if (left <= 0 && sawaQaidInterval) {
        clearInterval(sawaQaidInterval);
        sawaQaidInterval = null;
      }
    };
    updateCountdown();
    sawaQaidInterval = setInterval(updateCountdown, 200);
    btn.title = 'قيد — سوا غلط بدون كروت، أو سبب آخر مع كرتين';
  } else {
    btn.textContent = 'قيد';
    btn.title = enabled ? '' : 'القيد متاح بعد انتهاء أول أكلة';
  }
}

$('#btn-qaid').addEventListener('click', () => {
  if (!canUseQaid()) {
    if (gameState?.sawa_declaration) {
      alert('لا يمكنك الاعتراض على هذا السوا');
    } else if (gameState?.qaid_session) {
      alert('قيد جاري من لاعب آخر');
    } else {
      alert('لا يمكن القيد قبل انتهاء أول أكلة');
    }
    return;
  }
  resetQaidWizard();
  emitGameAction('qaid_start', {}, (res) => {
    if (res?.error) alert(res.error);
  });
});

function qaidReasonNeedsProof(reason) {
  return QAID_NEEDS_PROOF.has(reason);
}

function getQaidObjectorSeat() {
  return gameState?.qaid_session?.seat ?? null;
}

function isQaidAllySeat(seat) {
  return window.__qaidUi?.isQaidAllySeat(seat, getQaidObjectorSeat()) ?? false;
}

function getQaidSeatPositionLabel(seat) {
  const pos = window.__qaidUi?.qaidDealerPosition(seat, gameState?.dealer_idx) ?? { arrow: '', label: '' };
  if (!pos.label) return '';
  return pos.arrow ? `${pos.arrow} ${pos.label}` : pos.label;
}

function getQaidPlayerName(seat) {
  const hand = (gameState?.all_hands || []).find((h) => h.seat === seat);
  if (hand?.name) return hand.name;
  const pub = gameState?.seats?.[seat];
  return pub?.name || `لاعب ${seat + 1}`;
}

function resetQaidWizard() {
  qaidData = { reason: null, cards: [], step: 1 };
}

function inferQaidStepFromSession(session, objector) {
  if (!session) return 1;
  if (objector) return qaidData.step;
  if (!session.reason) return 1;
  if (qaidReasonNeedsProof(session.reason) && (session.cards?.length ?? 0) < 2) return 2;
  return 3;
}

function mergeQaidSessionFromEvent(data) {
  if (!gameState) return;
  const seat = data?.seat;
  if (seat == null) return;
  gameState = {
    ...gameState,
    qaid_session: {
      seat,
      reason: gameState.qaid_session?.reason ?? null,
      cards: gameState.qaid_session?.cards ?? [],
      started_at: gameState.qaid_session?.started_at ?? Date.now(),
    },
  };
}

function syncQaidUI() {
  const session = gameState?.qaid_session;
  $('#game-board')?.classList.toggle('qaid-active', !!session);

  if (!session) {
    if (qaidModalOpen) closeQaidModal(true);
    return;
  }

  const localReason = qaidData.reason;
  const localStep = qaidData.step;
  const objector = isQaidObjector();
  qaidData.reason = session.reason || (objector ? localReason : null);
  if (session.cards?.length) {
    qaidData.cards = session.cards.map((c) => ({ ...c }));
  } else if (!objector) {
    qaidData.cards = [];
  }
  qaidData.step = inferQaidStepFromSession(session, objector);
  if (objector && !session.reason) qaidData.step = localStep;
  buildQaidWizard();
}

function setQaidStep(step) {
  qaidData.step = step;
  buildQaidWizard();
}

function getQaidReasonsList() {
  const sawaActive = !!gameState.sawa_declaration;
  const canObjectSawa = sawaActive
    && gameState.sawa_declaration.team !== getMyTeam()
    && gameState.sawa_declaration.phase === 'objection';
  let reasons = [...(gameState.qaid_reasons || [])];
  if (canObjectSawa) {
    reasons = ['سوا غلط', ...reasons.filter((r) => r !== 'سوا غلط' && r !== 'سوا خاطئ')];
  } else {
    reasons = reasons.filter((r) => r !== 'سوا غلط' && r !== 'سوا خاطئ');
  }
  return reasons;
}

function updateQaidWizardHeader() {
  const titles = {
    1: ['اختر سبب الاعتراض', 'اختر السبب الأقرب لما حدث.'],
    2: ['اختر اللعب المخالف', 'راجع اللّعبات المكتملة واختر الورقة المخالفة.'],
    3: ['جاهز للإرسال', 'اضغط مرة أخرى لتعديل اختياراتك.'],
  };
  const [title, sub] = titles[qaidData.step] || titles[1];
  const titleEl = $('#qaid-wizard-title');
  const subEl = $('#qaid-wizard-subtitle');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;

  $$('.qaid-step-num').forEach((dot) => {
    const n = Number(dot.dataset.stepDot);
    dot.classList.toggle('active', n === qaidData.step);
  });
}

function buildQaidWizard() {
  const modal = $('#modal-qaid');
  const wizard = modal?.querySelector('.qaid-wizard');
  const spectatorEl = $('#qaid-spectator-label');
  const objector = isQaidObjector();
  const session = gameState.qaid_session;
  const objectorName = gameState.seats?.[session.seat]?.name || `مقعد ${session.seat}`;

  qaidModalOpen = true;
  modal.classList.remove('hidden');
  wizard?.classList.toggle('spectator', !objector);

  if (spectatorEl) {
    if (objector) {
      spectatorEl.classList.add('hidden');
    } else {
      spectatorEl.textContent = `${objectorName} يقيد الآن — شاهد الاختيارات`;
      spectatorEl.classList.remove('hidden');
    }
  }

  updateQaidWizardHeader();

  $('#qaid-step-1')?.classList.toggle('hidden', qaidData.step !== 1);
  $('#qaid-step-2')?.classList.toggle('hidden', qaidData.step !== 2);
  $('#qaid-step-3')?.classList.toggle('hidden', qaidData.step !== 3);

  renderQaidReasonsStep();
  if (qaidData.step >= 2) renderQaidProofStep();
  if (qaidData.step === 3) renderQaidConfirmStep();
  updateQaidStepButtons();

  const timerEl = $('.qaid-timer');
  if (timerEl) timerEl.textContent = 'متوقف';
}

function renderQaidReasonsStep() {
  const reasonsEl = $('#qaid-reasons');
  if (!reasonsEl) return;
  reasonsEl.innerHTML = '';
  getQaidReasonsList().forEach((r) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qaid-reason-btn';
    btn.textContent = r;
    if (qaidData.reason === r) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      if (!isQaidObjector()) return;
      qaidData.reason = r;
      qaidData.cards = [];
      emitGameAction('qaid_update', { reason: r, cards: [] });
      updateQaidStepButtons();
      reasonsEl.querySelectorAll('.qaid-reason-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    reasonsEl.appendChild(btn);
  });
}

function createQaidCardEl(card, { playerSeat = null, onClick = true, inHand = false, allowAny = false } = {}) {
  const div = document.createElement('div');
  div.className = 'qaid-card-opt';
  div.style.backgroundImage = `url(${cardImageUrl(card)})`;
  if (qaidData.cards.some((c) => cardEquals(c, card))) div.classList.add('selected');
  const canSelect = onClick && isQaidObjector()
    && (allowAny || playerSeat === null || !isQaidAllySeat(playerSeat));
  if (canSelect) {
    div.addEventListener('click', () => toggleQaidCard(card));
  }
  return div;
}

function renderQaidTrickRow(trick, container) {
  const leadSuit = trick[0]?.card?.suit || trick[0]?.[1]?.suit;
  const block = document.createElement('div');
  block.className = 'qaid-trick-block';
  if (leadSuit) {
    const suitEl = document.createElement('span');
    suitEl.className = 'qaid-trick-suit';
    suitEl.textContent = SUIT_SYMBOL[leadSuit] || '';
    suitEl.style.color = ['HEARTS', 'DIAMONDS'].includes(leadSuit) ? '#f87171' : '#e2e8f0';
    block.appendChild(suitEl);
  }
  const row = document.createElement('div');
  row.className = 'qaid-trick-row';
  row.setAttribute('dir', 'rtl');
  trick.forEach((item, idx) => {
    const card = item.card || item[1];
    const wrap = document.createElement('div');
    wrap.className = 'qaid-trick-card';
    wrap.style.zIndex = String(trick.length - idx);
    wrap.appendChild(createQaidCardEl(card, { allowAny: true }));
    row.appendChild(wrap);
  });
  block.appendChild(row);
  container.appendChild(block);
}

function renderQaidProofStep() {
  const tricksEl = $('#qaid-tricks');
  const handsWrap = $('#qaid-proof-hands');
  const handsEl = $('#qaid-hands');
  const counter = $('#qaid-proof-counter');
  if (!tricksEl) return;

  tricksEl.innerHTML = '';
  const history = gameState.trick_history || [];
  const current = gameState.current_trick?.length ? [gameState.current_trick] : [];
  const allTricks = [...history, ...current];

  if (!allTricks.length) {
    tricksEl.innerHTML = '<p class="qaid-empty">لا توجد أكلات بعد</p>';
  } else {
    allTricks.forEach((trick) => renderQaidTrickRow(trick, tricksEl));
  }

  if (handsEl && handsWrap) {
    handsEl.innerHTML = '';
    const objector = getQaidObjectorSeat();
    const hands = (gameState.all_hands || [])
      .filter((entry) => (entry.cards || []).length > 0)
      .sort((a, b) => {
        const order = (seat) => {
          if (objector === null) return seat;
          const diff = (seat - objector + 4) % 4;
          if (diff === 0) return 99;
          return diff;
        };
        return order(a.seat) - order(b.seat);
      });

    hands.forEach((entry) => {
      const section = document.createElement('div');
      section.className = 'qaid-player-hand';

      const head = document.createElement('div');
      head.className = 'qaid-player-hand-head';

      const nameEl = document.createElement('strong');
      nameEl.className = 'qaid-player-hand-name';
      nameEl.textContent = getQaidPlayerName(entry.seat);

      const posEl = document.createElement('span');
      posEl.className = 'qaid-player-hand-pos';
      posEl.textContent = getQaidSeatPositionLabel(entry.seat);

      head.append(nameEl, posEl);
      section.appendChild(head);

      const cardsRow = document.createElement('div');
      cardsRow.className = 'qaid-player-hand-cards';
      (entry.cards || []).forEach((card) => {
        cardsRow.appendChild(createQaidCardEl(card, { playerSeat: entry.seat, inHand: true }));
      });
      section.appendChild(cardsRow);
      handsEl.appendChild(section);
    });

    handsWrap.classList.toggle('hidden', !hands.length);
  }

  if (counter) counter.textContent = `${qaidData.cards.length} / 2 كروت`;
}

function renderQaidConfirmStep() {
  const preview = $('#qaid-confirm-preview');
  const reasonEl = $('#qaid-confirm-reason');
  const cardsRow = $('#qaid-confirm-cards-row');
  const cardsEl = $('#qaid-confirm-cards');
  if (reasonEl) reasonEl.textContent = qaidData.reason || '—';

  if (preview) {
    preview.innerHTML = '';
    if (qaidReasonNeedsProof(qaidData.reason) && qaidData.cards.length) {
      const block = document.createElement('div');
      block.className = 'qaid-trick-block';
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '10px';
      row.style.justifyContent = 'center';
      row.style.padding = '12px';
      qaidData.cards.forEach((card) => {
        row.appendChild(createQaidCardEl(card, { onClick: false }));
      });
      block.appendChild(row);
      preview.appendChild(block);
    }
  }

  const needsProof = qaidReasonNeedsProof(qaidData.reason);
  cardsRow?.classList.toggle('hidden', !needsProof);
  if (cardsEl && needsProof) {
    cardsEl.innerHTML = '';
    qaidData.cards.forEach((card) => {
      cardsEl.appendChild(createQaidCardEl(card, { onClick: false }));
    });
  }
}

function toggleQaidCard(card) {
  if (!isQaidObjector() || qaidData.step !== 2) return;
  const idx = qaidData.cards.findIndex((c) => cardEquals(c, card));
  if (idx >= 0) {
    qaidData.cards.splice(idx, 1);
  } else if (qaidData.cards.length < 2) {
    qaidData.cards.push({ ...card });
  }
  emitGameAction('qaid_update', { reason: qaidData.reason, cards: qaidData.cards });
  renderQaidProofStep();
  updateQaidStepButtons();
}

function updateQaidStepButtons() {
  const next1 = $('#btn-qaid-next-1');
  const next2 = $('#btn-qaid-next-2');
  const send = $('#btn-submit-qaid');
  if (next1) next1.disabled = !qaidData.reason;
  if (next2) next2.disabled = qaidData.cards.length < 2;
  if (send) send.disabled = !qaidData.reason;
}

function submitQaid() {
  if (!isQaidObjector()) return;
  if (!qaidData.reason) {
    alert('اختر سبب القيد');
    return;
  }
  if (qaidReasonNeedsProof(qaidData.reason) && qaidData.cards.length < 2) {
    alert('اختر كرتين إثبات');
    return;
  }
  emitGameAction('qaid_submit', {
    reason: qaidData.reason,
    cards: qaidReasonNeedsProof(qaidData.reason) ? qaidData.cards : [],
  }, (res) => {
    if (res?.error) alert(res.error);
    else closeQaidModal(true);
  });
}

$('#btn-qaid-next-1')?.addEventListener('click', () => {
  if (!qaidData.reason) return;
  if (qaidReasonNeedsProof(qaidData.reason)) setQaidStep(2);
  else setQaidStep(3);
});

$('#btn-qaid-next-2')?.addEventListener('click', () => {
  if (qaidData.cards.length < 2) return;
  setQaidStep(3);
});

$('#btn-qaid-back-2')?.addEventListener('click', () => setQaidStep(1));
$('#btn-qaid-back-3')?.addEventListener('click', () => {
  if (qaidReasonNeedsProof(qaidData.reason)) setQaidStep(2);
  else setQaidStep(1);
});

$('#btn-submit-qaid')?.addEventListener('click', () => submitQaid());

document.querySelector('#modal-qaid .qaid-close')?.addEventListener('click', () => closeQaidModal());
document.querySelector('#modal-qaid .btn-close-modal')?.addEventListener('click', () => closeQaidModal());

function closeQaidModal(fromServer = false) {
  qaidModalOpen = false;
  $('#modal-qaid')?.classList.add('hidden');
  $('#game-board')?.classList.remove('qaid-active');
  if (qaidTimerInterval) {
    clearInterval(qaidTimerInterval);
    qaidTimerInterval = null;
  }
  resetQaidWizard();
  if (!fromServer && isQaidObjector() && gameState?.qaid_session) {
    emitGameAction('qaid_cancel', {});
  }
}

function startQaidTimer() {
  if (qaidTimerInterval) return;
  let sec = 59;
  const el = $('.qaid-timer');
  if (el) el.textContent = `00:${sec}`;
  qaidTimerInterval = setInterval(() => {
    sec--;
    if (el) el.textContent = `00:${String(sec).padStart(2, '0')}`;
    if (sec <= 0) closeQaidModal();
  }, 1000);
}

// ---- Summary ----
function renderSummary() {
  const modal = $('#modal-summary');
  const summaryCard = $('#summary-card');
  if (gameState.phase !== 'SCORE_SUMMARY' || !gameState.summary_data) {
    modal?.classList.add('hidden');
    return;
  }

  modal?.classList.remove('hidden');
  const s = gameState.summary_data;
  const us = getMyTeam();
  const them = us === 1 ? 2 : 1;

  const gainedUs = s.final?.[us] || 0;
  const gainedThem = s.final?.[them] || 0;
  const roundWon = gainedUs > gainedThem;
  const roundLost = gainedThem > gainedUs;

  summaryCard?.classList.remove('summary-win', 'summary-lose');
  if (roundWon) summaryCard?.classList.add('summary-win');
  else if (roundLost) summaryCard?.classList.add('summary-lose');

  const bidEl = $('#summary-bid-info');
  if (bidEl) {
    const bid = formatBidLabel(s);
    const floor = formatFloorCard(s.floor_card);
    bidEl.textContent = [bid, floor ? `كرت الأرض: ${floor}` : ''].filter(Boolean).join(' · ');
  }

  const buyerEl = $('#summary-buyer');
  if (buyerEl) {
    const buyerTeam = s.buyer;
    const isOurBuyer = buyerTeam === us;
    const buyerName = s.buyer_name || (s.buyer_seat != null ? `مقعد ${s.buyer_seat + 1}` : '—');
    const teamLabel = isOurBuyer ? 'لنا' : 'لهم';
    const buyerRole = buyerTeam === us ? '(مشتري)' : '(مشتري)';
    buyerEl.textContent = `المشتري: ${buyerName} — فريق ${teamLabel} ${buyerRole}`;
  }

  const table = $('#summary-table');
  if (table) {
    const cell = (team, val) => `<td class="col-${team === us ? 'us' : 'them'}">${val ?? 0}</td>`;
    table.innerHTML = `
      <thead>
        <tr>
          <th></th>
          <th class="col-us">لنا</th>
          <th class="col-them">لهم</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>الأكلات</td>${cell(us, s.raw_tricks?.[us])}${cell(them, s.raw_tricks?.[them])}</tr>
        <tr><td>الأرض</td>${cell(us, s.ground?.[us])}${cell(them, s.ground?.[them])}</tr>
        <tr><td>المشاريع</td>${cell(us, s.projects?.[us])}${cell(them, s.projects?.[them])}</tr>
        <tr><td>الأبناط</td>${cell(us, s.abnat?.[us])}${cell(them, s.abnat?.[them])}</tr>
        <tr><td>على الورقة</td>${cell(us, s.base_final?.[us])}${cell(them, s.base_final?.[them])}</tr>
        <tr class="row-total"><td>نقاط الجولة</td>${cell(us, gainedUs)}${cell(them, gainedThem)}</tr>
      </tbody>
    `;
  }

  const scoresEl = $('#summary-scores');
  if (scoresEl) {
    scoresEl.innerHTML =
      `<span class="score-us">لنا ${gainedUs}</span>`
      + `<span class="score-sep">—</span>`
      + `<span class="score-them">لهم ${gainedThem}</span>`;
  }

  const totalsEl = $('#summary-totals');
  if (totalsEl) {
    const totalUs = s.total_scores?.[us] ?? gameState.total_scores?.[us] ?? 0;
    const totalThem = s.total_scores?.[them] ?? gameState.total_scores?.[them] ?? 0;
    totalsEl.textContent = `مجموع المباراة: لنا ${totalUs} — لهم ${totalThem}`;
  }

  const noteEl = $('#summary-note');
  let note = '';
  if (s.is_qahwa) note = 'قهوة';
  else if (s.is_sawa) note = 'سوا';
  else if (s.is_qaid) note = s.is_qaid_normal ? 'قيد' : 'قيد كبوت';
  else if (s.is_kaput) note = 'كبوت';
  else if (s.is_fall) note = 'سقوط المشتري';
  else if (s.is_doubled && s.multiplier) {
    note = s.multiplier < 5 ? `تدبيل ×${s.multiplier}` : 'قهوة';
  }
  if (noteEl) {
    if (note) {
      noteEl.textContent = note;
      noteEl.classList.remove('hidden');
    } else {
      noteEl.textContent = '';
      noteEl.classList.add('hidden');
    }
  }

  const resultEl = $('#summary-result');
  if (!resultEl) return;
  if (s.match_winner) {
    const won = s.match_winner === us;
    resultEl.textContent = won
      ? `🏆 فزتم بالمباراة! (${s.total_scores?.[us] ?? 0} نقطة)`
      : `خسرتم المباراة — ${s.total_scores?.[them] ?? 0} للخصم`;
    resultEl.className = won ? 'summary-result win' : 'summary-result lose';
  } else if (roundWon) {
    resultEl.textContent = 'فزتم الجولة';
    resultEl.className = 'summary-result win';
  } else if (roundLost) {
    resultEl.textContent = 'خسرتم الجولة';
    resultEl.className = 'summary-result lose';
  } else {
    resultEl.textContent = 'تعادل';
    resultEl.className = 'summary-result tie';
  }
}

// ---- Chat bubbles ----
function showChatBubble(globalSeat, text) {
  const visualPos = getVisualPos(globalSeat, mySeat);
  const bubble = seatVisualNodes(visualPos).chatBubble;
  if (!bubble) return;
  bubble.textContent = text;
  bubble.classList.remove('hidden');
  setTimeout(() => bubble.classList.add('hidden'), 2500);
}

// Focus name input on load
$('#player-name').focus();
