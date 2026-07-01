/** صفحة الجلسات — مقاعد 2 ضد 2 وعد تنازلي */

const SESSION_TABS = ['open', 'mine', 'full'];
let sessionsTab = 'open';
let activeSessionId = null;
let sessionLobbyPoll = null;

function rankOptionsHtml(selectedRank = 0, selectedSub = 0) {
  let html = '';
  for (let r = 0; r < RANKS.length; r++) {
    for (let s = 0; s < SUB_SUIT_LABELS.length; s++) {
      const label = `${RANKS[r].name} ${SUB_SUIT_LABELS[s]}`;
      const sel = r === selectedRank && s === selectedSub ? 'selected' : '';
      html += `<option value="${r}-${s}" ${sel}>${label}</option>`;
    }
  }
  return html;
}

function buildSessionDeckStack(backUrl) {
  const stack = document.createElement('div');
  stack.className = 'home-deck-stack session-seat-deck';
  stack.setAttribute('aria-hidden', 'true');
  const back = backUrl || '/cards/back_dark.png';
  for (const withOffset of [false, true]) {
    const card = document.createElement('span');
    card.className = `home-deck-card${withOffset ? ' offset' : ''}`;
    card.style.backgroundImage = `url("${back}")`;
    stack.appendChild(card);
  }
  return stack;
}

function buildSessionSeatElement(player, sessionId, seatIndex, options = {}) {
  const { inLobby = false, canJoin = true, session = null } = options;
  const slot = document.createElement('div');
  slot.className = 'session-seat' + (player ? ' occupied' : ' empty');
  slot.dataset.seat = String(seatIndex);

  if (player) {
    const visual = document.createElement('div');
    visual.className = 'session-seat-visual';

    if (player.avatar_url) {
      const img = document.createElement('img');
      img.src = player.avatar_url;
      img.alt = '';
      img.className = 'session-seat-avatar';
      img.loading = 'lazy';
      visual.appendChild(img);
    } else {
      const initial = document.createElement('span');
      initial.className = 'session-seat-avatar initial';
      initial.textContent = player.avatar_initial || '?';
      visual.appendChild(initial);
    }

    visual.appendChild(buildSessionDeckStack(player.deck_back_url));

    slot.appendChild(visual);

    slot.appendChild(buildPlayerNameWithStar(player, { nameClass: 'session-seat-name' }));

    if (player.is_host) {
      const hostEl = document.createElement('span');
      hostEl.className = 'session-seat-host';
      hostEl.textContent = 'مضيف';
      slot.appendChild(hostEl);
    }
    return slot;
  }

  if (inLobby && !canJoin) {
    const emptyLabel = document.createElement('span');
    emptyLabel.className = 'session-seat-name';
    emptyLabel.style.color = '#64748b';
    emptyLabel.textContent = 'فارغ';
    slot.appendChild(emptyLabel);
    return slot;
  }

  const joinBtn = document.createElement('button');
  joinBtn.type = 'button';
  joinBtn.className = 'session-seat-join';
  joinBtn.title = 'انضم لهذا المقعد';
  const blocked = session && (!session.is_open || session.status === 'playing' || session.is_full);
  joinBtn.disabled = !canJoin || blocked;
  joinBtn.innerHTML = '<span class="session-seat-plus" aria-hidden="true">+</span><span>انضم</span>';
  joinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    joinSessionToSeat(sessionId, seatIndex);
  });
  slot.appendChild(joinBtn);
  return slot;
}

function buildSessionTeamsBoard(session, options = {}) {
  const seats = session.seats || [null, null, null, null];
  const board = document.createElement('div');
  board.className = 'session-teams-board';

  const teamA = document.createElement('div');
  teamA.className = 'session-team-col';
  teamA.appendChild(buildSessionSeatElement(seats[0], session.id, 0, { ...options, session }));
  teamA.appendChild(buildSessionSeatElement(seats[1], session.id, 1, { ...options, session }));

  const vs = document.createElement('div');
  vs.className = 'session-vs-pill';
  vs.textContent = 'ضد';

  const teamB = document.createElement('div');
  teamB.className = 'session-team-col';
  teamB.appendChild(buildSessionSeatElement(seats[2], session.id, 2, { ...options, session }));
  teamB.appendChild(buildSessionSeatElement(seats[3], session.id, 3, { ...options, session }));

  board.append(teamA, vs, teamB);
  return board;
}

function buildSessionCard(session) {
  const myId = typeof getCachedUser === 'function' ? getCachedUser()?.id : null;
  const isMember = session.is_member || session.host_user_id === myId;
  const card = document.createElement('article');
  card.className = 'session-vip-card' + (session.in_countdown ? ' countdown' : '');

  const lockLabel = session.is_open ? 'مفتوحة' : 'مقفلة';
  const badgeClass = session.in_countdown ? 'countdown' : (session.is_open ? 'open' : 'closed');
  const badgeText = session.in_countdown ? 'بدء قريب' : lockLabel;
  const stakeLine = session.stake ? `<span>القيم: ${session.stake}</span>` : '';

  const head = document.createElement('div');
  head.className = 'session-vip-head';
  head.innerHTML = `
    <div>
      <h3 class="session-vip-title">${session.title}</h3>
      <div class="session-vip-meta">
        <span>المضيف: ${session.host_name}</span>
        <span>${session.player_count}/${session.max_players}</span>
        <span>أقل تصنيف: ${session.min_rank_label}</span>
        ${stakeLine}
      </div>
    </div>
    <span class="session-vip-badge ${badgeClass}">${badgeText}</span>
  `;
  card.appendChild(head);
  card.appendChild(buildSessionTeamsBoard(session, { canJoin: !isMember }));

  const actions = document.createElement('div');
  actions.className = 'session-vip-actions';
  if (isMember || sessionsTab === 'mine') {
    const enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'lobby-btn-sm';
    enter.textContent = 'الردهة';
    enter.addEventListener('click', () => openSessionLobby(session.id));
    actions.appendChild(enter);
  }
  if (actions.children.length) card.appendChild(actions);
  return card;
}

async function loadSessionBagOptions() {
  const deckSel = $('#session-deck');
  const bgSel = $('#session-bg');
  if (!deckSel || !bgSel) return;
  try {
    const res = await apiFetch('/api/sessions/bag-options');
    const data = await res.json();
    deckSel.innerHTML = '<option value="">افتراضي</option>';
    (data.decks || []).forEach((d) => {
      deckSel.innerHTML += `<option value="${d.asset_key}">${d.name}</option>`;
    });
    bgSel.innerHTML = '<option value="">افتراضي</option>';
    (data.backgrounds || []).forEach((b) => {
      bgSel.innerHTML += `<option value="${b.asset_key}">${b.name}</option>`;
    });
  } catch (_) {}
}

async function loadSessions() {
  const list = $('#sessions-list');
  if (!list) return;
  list.innerHTML = '<p class="lobby-loading">جاري التحميل...</p>';
  try {
    const res = await apiFetch(`/api/sessions?filter=${sessionsTab}`);
    const data = await res.json();
    renderSessionsList(data.sessions || []);
  } catch (e) {
    list.innerHTML = `<p class="lobby-error">${e.message}</p>`;
  }
}

function renderSessionsList(sessions) {
  const list = $('#sessions-list');
  if (!list) return;
  list.className = 'sessions-list';
  if (!sessions.length) {
    list.innerHTML = '<p class="lobby-empty">لا توجد جلسات</p>';
    return;
  }
  list.innerHTML = '';
  sessions.forEach((s) => list.appendChild(buildSessionCard(s)));
}

async function joinSessionToSeat(id, seat) {
  try {
    const res = await apiFetch(`/api/sessions/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ seat }),
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else {
      showLobbyToast('تم الانضمام للمقعد');
      if (data.started && data.roomId) {
        stopSessionLobbyPoll();
        window.startSessionMatch?.(data.session, data.roomId);
        return;
      }
      openSessionLobby(id);
    }
  } catch (e) {
    alert(e.message);
  }
}

async function createSession() {
  const title = $('#session-title')?.value?.trim() || 'جلسة بلوت';
  const isOpen = $('#session-open')?.value === '1';
  const rankVal = ($('#session-min-rank')?.value || '0-0').split('-');
  const min_rank = parseInt(rankVal[0], 10);
  const min_sub_rank = parseInt(rankVal[1], 10);
  const stake = parseInt($('#session-stake')?.value || '0', 10) || 0;
  const deck_asset_key = $('#session-deck')?.value || '';
  const bg_asset_key = $('#session-bg')?.value || '';
  try {
    const res = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title, is_open: isOpen, min_rank, min_sub_rank, stake,
        deck_asset_key: deck_asset_key || undefined,
        bg_asset_key: bg_asset_key || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showLobbyToast('تم إنشاء الجلسة');
    $('#session-title').value = '';
    sessionsTab = 'mine';
    updateSessionTabs();
    openSessionLobby(data.session.id);
  } catch (e) {
    alert(e.message);
  }
}

function stopSessionLobbyPoll() {
  if (sessionLobbyPoll) {
    clearInterval(sessionLobbyPoll);
    sessionLobbyPoll = null;
  }
}

async function fetchSessionLobby() {
  if (!activeSessionId) return null;
  const res = await apiFetch(`/api/sessions/${activeSessionId}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function renderSessionLobby(detail) {
  const session = detail.session;
  if (!session) return;

  $('#session-lobby-title').textContent = session.title;
  const stakeEl = $('#session-lobby-stake');
  if (stakeEl) stakeEl.textContent = session.stake ? `القيم: ${session.stake}` : '';

  const statusEl = $('#session-lobby-status');
  const countdownEl = $('#session-lobby-countdown');
  const countdownNum = $('#session-countdown-num');

  if (statusEl) {
    if (session.status === 'playing') statusEl.textContent = 'بدأت اللعبة...';
    else if (session.in_countdown) statusEl.textContent = 'اكتملت الجلسة — بدء المباراة قريباً';
    else statusEl.textContent = `بانتظار اللاعبين (${session.player_count}/${session.max_players})`;
  }

  if (countdownEl && countdownNum) {
    const show = session.in_countdown && session.countdown_seconds > 0;
    countdownEl.classList.toggle('hidden', !show);
    if (show) countdownNum.textContent = String(session.countdown_seconds);
  }

  const board = $('#session-lobby-board');
  if (board) {
    board.innerHTML = '';
    board.appendChild(buildSessionTeamsBoard(session, {
      inLobby: true,
      canJoin: !session.is_member,
      session,
    }));
  }

  const startBtn = $('#btn-session-start');
  if (startBtn) {
    const showStart = session.can_force_start;
    startBtn.classList.toggle('hidden', !showStart);
    startBtn.disabled = false;
  }
}

function handleLobbyDetail(detail) {
  if (!detail?.session) return;
  renderSessionLobby(detail);
  if (detail.started || detail.session.status === 'playing') {
    stopSessionLobbyPoll();
    window.startSessionMatch?.(detail.session, detail.roomId);
  }
}

async function openSessionLobby(id) {
  activeSessionId = id;
  stopSessionLobbyPoll();
  if (typeof saveActiveGame === 'function') {
    saveActiveGame({
      mode: 'session',
      sessionId: id,
      inGame: false,
      userId: typeof getCachedUser === 'function' ? getCachedUser()?.id : null,
    });
  }
  try {
    const detail = await fetchSessionLobby();
    handleLobbyDetail(detail);
    if (typeof showScreen === 'function') showScreen('sessionLobby');
    if (detail.started) return;

    const poll = async () => {
      try {
        const d = await fetchSessionLobby();
        handleLobbyDetail(d);
      } catch (e) {
        if (e.message.includes('404') || e.message.includes('غير موجودة')) {
          stopSessionLobbyPoll();
          alert('الجلسة أُغلقت');
          initSessionsPage();
        }
      }
    };

    sessionLobbyPoll = setInterval(poll, 1000);
  } catch (e) {
    alert(e.message);
  }
}

async function forceStartSession() {
  if (!activeSessionId) return;
  const btn = $('#btn-session-start');
  if (btn) btn.disabled = true;
  try {
    const res = await apiFetch(`/api/sessions/${activeSessionId}/start`, { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      if (btn) btn.disabled = false;
      return;
    }
    handleLobbyDetail(data);
  } catch (e) {
    alert(e.message);
    if (btn) btn.disabled = false;
  }
}

async function leaveSessionLobby() {
  if (!activeSessionId) return;
  try {
    const res = await apiFetch(`/api/sessions/${activeSessionId}/leave`, { method: 'POST' });
    const data = await res.json();
    if (data.error) return alert(data.error);
    stopSessionLobbyPoll();
    activeSessionId = null;
    if (typeof clearActiveGame === 'function') clearActiveGame();
    if (data.deleted) showLobbyToast('أُغلقت الجلسة');
    else showLobbyToast('غادرت الجلسة');
    initSessionsPage();
  } catch (e) {
    alert(e.message);
  }
}

function updateSessionTabs() {
  $$('.sessions-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === sessionsTab);
  });
}

function initSessionsPage() {
  stopSessionLobbyPoll();
  activeSessionId = null;
  const minRank = $('#session-min-rank');
  if (minRank && !minRank.options.length) {
    minRank.innerHTML = rankOptionsHtml();
  }
  loadSessionBagOptions();
  updateSessionTabs();
  loadSessions();
  if (typeof showScreen === 'function') showScreen('sessions');
}

function wireSessionsPage() {
  $$('.sessions-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      sessionsTab = btn.dataset.tab;
      updateSessionTabs();
      loadSessions();
    });
  });
  $('#btn-create-session')?.addEventListener('click', createSession);
  $('#btn-sessions-back')?.addEventListener('click', () => initHome());
  $('#btn-session-start')?.addEventListener('click', forceStartSession);
  $('#btn-session-leave')?.addEventListener('click', leaveSessionLobby);
  $('#btn-session-lobby-back')?.addEventListener('click', () => {
    stopSessionLobbyPoll();
    initSessionsPage();
  });
}

function showLobbyToast(msg) {
  const el = $('#lobby-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

document.addEventListener('DOMContentLoaded', wireSessionsPage);
window.openSessionLobby = openSessionLobby;
