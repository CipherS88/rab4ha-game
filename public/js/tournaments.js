/** صفحة البطولات — تسجيل، لوبي، فرق، شجرة */

let tournamentsTab = 'casual';
let tournamentsMeta = null;
let activeTournamentId = null;
let tournamentPollTimer = null;

const SUIT_ICONS = ['♠', '♥', '♦', '♣'];
const SUIT_CLASSES = ['suit-spade', 'suit-heart', 'suit-diamond', 'suit-club'];

function formatCountdown(seconds) {
  const s = Math.max(0, seconds | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function avatarHtml(player, cls = '') {
  if (player?.avatar_url) {
    return `<img src="${player.avatar_url}" alt="" class="${cls}" />`;
  }
  const initial = player?.avatar_initial || player?.name?.[0] || '?';
  return `<span class="${cls || 'chip-initial'}">${initial}</span>`;
}

async function loadTournaments() {
  const list = $('#tournaments-list');
  if (!list) return;
  list.innerHTML = '<p class="lobby-loading">جاري التحميل...</p>';
  try {
    const res = await apiFetch(`/api/tournaments?type=${tournamentsTab}`);
    const data = await res.json();
    tournamentsMeta = data;
    renderTournamentsList(data.tournaments || []);
    updateTournamentCreateUI(data);
  } catch (e) {
    list.innerHTML = `<p class="lobby-error">${e.message}</p>`;
  }
}

function updateTournamentCreateUI(meta) {
  const form = $('#tournament-create-panel');
  const quotaEl = $('#tournament-quota');
  if (tournamentsTab === 'pro') {
    form?.classList.add('hidden');
    if (quotaEl) quotaEl.textContent = '';
    return;
  }
  form?.classList.remove('hidden');
  const q = meta?.quota;
  if (quotaEl && q) {
    quotaEl.textContent = `بطولات ترفيهية هذا الشهر: ${q.used} / ${q.limit}`;
  }
}

function statusLabel(t) {
  if (t.phase_label) return t.phase_label;
  if (t.status === 'registration') return 'تسجيل مفتوح';
  if (t.status === 'lobby') return 'دقيقة الدخول';
  if (t.status === 'active') return 'جارية';
  if (t.status === 'cancelled') return 'ملغاة';
  if (t.status === 'closed') return 'مغلقة';
  return t.status;
}

function formatShortLabel(formatLabel) {
  if (!formatLabel) return 'خروج المغلوب';
  if (formatLabel.includes('خروج المغلوب')) return 'خروج المغلوب';
  return formatLabel;
}

function buildTournamentHeroVisual(creator) {
  const p = creator || {};
  const visual = document.createElement('div');
  visual.className = 'tournament-hero-visual';

  if (p.deck_glow_color) {
    const glowEl = document.createElement('span');
    glowEl.className = 'tourn-deck-glow';
    glowEl.setAttribute('aria-hidden', 'true');
    glowEl.style.setProperty('--deck-glow', p.deck_glow_color);
    visual.appendChild(glowEl);
  }

  if (p.avatar_url) {
    const img = document.createElement('img');
    img.src = p.avatar_url;
    img.alt = '';
    img.className = 'tournament-hero-avatar';
    img.loading = 'lazy';
    visual.appendChild(img);
  } else {
    const initial = document.createElement('span');
    initial.className = 'tournament-hero-avatar initial';
    initial.textContent = p.avatar_initial || p.name?.[0] || '?';
    visual.appendChild(initial);
  }

  visual.appendChild(buildTournamentDeckStack(p.deck_back_url));
  return visual;
}

function buildTournamentHeroHtml(t, { detail = false } = {}) {
  const creator = t.creator || { name: t.creator_name, rankLabel: '' };
  const rank = creator.rankLabel || creator.rank_label || '';
  const showTimer = (t.status === 'registration' || t.status === 'lobby') && t.seconds_left != null;
  const canJoin = !!t.can_join;
  const isRegistered = !!t.is_registered;
  const canEnter = !!t.can_enter;

  let reserveLabel = 'حجز مقعد';
  let reserveDisabled = !canJoin;
  if (isRegistered) {
    reserveLabel = 'مسجّل ✓';
    reserveDisabled = true;
  } else if (!canJoin && t.status === 'registration') {
    reserveLabel = 'ممتلئة';
    reserveDisabled = true;
  }

  const watchLabel = canEnter ? 'ادخل الآن!' : 'مشاهدة';
  const watchClass = canEnter ? 'primary' : 'outline';

  const visualEl = buildTournamentHeroVisual(creator);
  const card = document.createElement('article');
  card.className = `tournament-hero-card${detail ? ' detail' : ''}`;
  card.dataset.tournamentId = String(t.id);

  card.innerHTML = `
    <div class="tournament-hero-profile"></div>
    <p class="tournament-hero-creator-name">${creator.name || t.creator_name || 'منظم'}</p>
    ${rank ? `<p class="tournament-hero-creator-rank">${rank}</p>` : ''}
    <h2 class="tournament-hero-title">${t.title || 'بطولة'}</h2>
    ${showTimer ? `<p class="tournament-hero-timer">⏱ ${formatCountdown(t.seconds_left)} · ${statusLabel(t)}</p>` : ''}
    <dl class="tournament-hero-details">
      <div><dt>رتبة المشاركة:</dt><dd>${t.participation_rank_label || 'مفتوحة للجميع'}</dd></div>
      <div><dt>الجائزة:</dt><dd>${t.prize_label || 'مجتمعية'}</dd></div>
      <div><dt>النوع:</dt><dd>${t.type_label || 'ترفيهية'}</dd></div>
      <div><dt>نظام البطولة:</dt><dd>${formatShortLabel(t.format_label)}</dd></div>
      <div><dt>المقاعد:</dt><dd>${t.entry_count ?? 0} / ${t.size ?? 0}</dd></div>
    </dl>
    <div class="tournament-hero-actions">
      <button type="button" class="tournament-hero-btn reserve" ${reserveDisabled ? 'disabled' : ''}>${reserveLabel}</button>
      <button type="button" class="tournament-hero-btn watch ${watchClass}">${watchLabel}</button>
    </div>
  `;

  card.querySelector('.tournament-hero-profile')?.appendChild(visualEl);

  card.querySelector('.tournament-hero-btn.reserve')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!reserveDisabled) joinTournament(t.id, detail);
  });
  card.querySelector('.tournament-hero-btn.watch')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (canEnter) enterTournament(t.id);
    else if (!detail) openTournamentDetail(t.id);
  });

  if (typeof applyRankTheme === 'function' && creator.rankTheme) {
    applyRankTheme(card.querySelector('.tournament-hero-visual'), creator.rankTheme);
  }

  return card;
}

function renderTournamentsList(items) {
  const list = $('#tournaments-list');
  if (!items.length) {
    list.innerHTML = '<p class="lobby-empty">لا توجد بطولات حالياً</p>';
    return;
  }
  list.innerHTML = '';
  items.forEach((t) => {
    const card = buildTournamentHeroHtml(t);
    card.addEventListener('click', () => openTournamentDetail(t.id));
    list.appendChild(card);
  });
}

function stopTournamentPoll() {
  if (tournamentPollTimer) {
    clearInterval(tournamentPollTimer);
    tournamentPollTimer = null;
  }
}

function startTournamentPoll(id) {
  stopTournamentPoll();
  tournamentPollTimer = setInterval(() => {
    if (activeTournamentId === id) loadTournamentDetail(id, true);
  }, 2000);
}

async function openTournamentDetail(id) {
  activeTournamentId = id;
  showScreen('tournamentDetail');
  startTournamentPoll(id);
  await loadTournamentDetail(id);
}

async function loadTournamentDetail(id, silent = false) {
  const root = $('#tournament-detail-root');
  if (!root) return;
  if (!silent) root.innerHTML = '<p class="lobby-loading">جاري التحميل...</p>';
  try {
    const res = await apiFetch(`/api/tournaments/${id}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderTournamentDetail(data);
  } catch (e) {
    if (!silent) root.innerHTML = `<p class="lobby-error">${e.message}</p>`;
  }
}

function renderTeamAvatars(members) {
  if (!members?.length) return '<span class="bracket-team-name">—</span>';
  const avatars = members.map((m) => avatarHtml(m, 'bt-initial')).join('');
  const names = members.map((m) => m.name).join(' & ');
  return `
    <div class="bracket-team-info">
      <div class="bracket-team-avatars">${avatars}</div>
      <span class="bracket-team-name">${names}</span>
    </div>
  `;
}

function renderBracketTeamRow(team, score, winnerId, suitIdx) {
  if (!team) {
    return `<div class="bracket-team"><span class="bracket-team-name">بانتظار المتأهل</span><span class="score">-</span></div>`;
  }
  const isWinner = winnerId && team.id === winnerId;
  const isLoser = winnerId && team.id !== winnerId;
  const cls = isWinner ? 'winner' : isLoser ? 'loser' : '';
  const sc = score != null ? score : '-';
  return `
    <div class="bracket-team ${cls}">
      ${renderTeamAvatars(team.members)}
      <span class="score">${sc}</span>
    </div>
  `;
}

function renderBracket(bracket, teams) {
  if (!bracket?.rounds?.length) return '';
  const teamMap = Object.fromEntries((teams || []).map((t) => [t.id, t]));
  const champTeam = bracket.champion_team_id ? teamMap[bracket.champion_team_id] : null;
  const roundCount = bracket.rounds.length;

  let html = `
    <div class="tournament-bracket-title"><h2>شجرة البطولة</h2></div>
    <p class="bracket-mobile-hint">↔ اسحب للتنقل في الشجرة</p>
    <div class="bracket-wrapper"><div class="bracket">
  `;

  bracket.rounds.forEach((round, ri) => {
    const roundClass = `round round-${ri + 1}`;
    const isFinal = ri === roundCount - 1;
    html += `<div class="${roundClass}"><div class="round-title">${round.label}</div><div class="matches-container">`;
    round.matches.forEach((m, mi) => {
      const hasPrev = ri > 0;
      const hasNext = !isFinal;
      const extra = [
        hasPrev ? 'has-prev' : '',
        hasNext ? 'has-next' : '',
        isFinal ? 'final-card' : '',
      ].filter(Boolean).join(' ');
      const fork = hasPrev && round.matches.length > 1 ? '<div class="fork"></div>' : hasPrev ? '<div class="fork"></div>' : '';
      html += `<div class="match-card ${extra}">${fork}`;
      html += renderBracketTeamRow(m.team1, m.score1, m.winner_team_id, mi * 2);
      html += renderBracketTeamRow(m.team2, m.score2, m.winner_team_id, mi * 2 + 1);
      html += '</div>';
    });
    html += '</div></div>';
  });

  const champRoundClass = `round round-${roundCount + 1}`;
  html += `<div class="${champRoundClass}"><div class="round-title">البطل</div><div class="matches-container">`;
  html += `<div class="match-card has-prev champion-card">`;
  if (champTeam) {
    html += `<span class="crown">👑</span><span class="champion-name">${champTeam.name}</span>`;
    html += `<div class="champion-avatars">${champTeam.members.map((m) => avatarHtml(m, 'bt-initial')).join('')}</div>`;
  } else {
    html += `<span class="crown">👑</span><span class="champion-name">بطل ربعها</span>`;
  }
  html += '</div></div></div>';

  html += '</div></div>';
  return html;
}

function renderTeamsGrid(teams, myTeamId) {
  if (!teams?.length) return '<p class="lobby-empty">لم تُشكَّل الفرق بعد</p>';
  return `<div class="teams-grid">${teams.map((team) => {
    const mine = team.id === myTeamId;
    const allIn = team.all_checked_in;
    return `
      <div class="team-cube${mine ? ' mine' : ''}${allIn ? ' all-in' : ''}">
        <div class="team-cube-name">${team.name}</div>
        <div class="team-cube-members tournament-players-grid team-members-grid">
          ${(team.members || []).map((m) => {
            const el = buildTournamentPlayerCardElement(m);
            return el.outerHTML;
          }).join('')}
          ${team.members?.length === 1 ? `
            <div class="tourn-player-card empty">
              <div class="tourn-player-visual"><span class="tourn-player-avatar initial">؟</span></div>
              <div class="tourn-player-meta"><span class="tourn-player-name muted">شريك</span></div>
            </div>
          ` : ''}
        </div>
        <div class="team-cube-status">${allIn ? 'الفريق جاهز ✓' : 'بانتظار دخول الفريق'}</div>
      </div>
    `;
  }).join('')}</div>`;
}

function buildTournamentDeckStack(backUrl) {
  const stack = document.createElement('div');
  stack.className = 'home-deck-stack tourn-player-deck';
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

function buildTournamentPlayerCardElement(player) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tourn-player-card';
  btn.dataset.userId = String(player.user_id);
  btn.title = 'اضغط لعرض الملف وإضافة صديق';

  const visual = document.createElement('div');
  visual.className = 'tourn-player-visual';

  if (player.deck_glow_color) {
    const glowEl = document.createElement('span');
    glowEl.className = 'tourn-deck-glow';
    glowEl.setAttribute('aria-hidden', 'true');
    glowEl.style.setProperty('--deck-glow', player.deck_glow_color);
    visual.appendChild(glowEl);
  }

  if (player.avatar_url) {
    const img = document.createElement('img');
    img.src = player.avatar_url;
    img.alt = '';
    img.className = 'tourn-player-avatar';
    img.loading = 'lazy';
    visual.appendChild(img);
  } else {
    const initial = document.createElement('span');
    initial.className = 'tourn-player-avatar initial';
    initial.textContent = player.avatar_initial || '?';
    visual.appendChild(initial);
  }

  visual.appendChild(buildTournamentDeckStack(player.deck_back_url));

  btn.appendChild(visual);

  const meta = document.createElement('div');
  meta.className = 'tourn-player-meta';
  meta.appendChild(buildPlayerNameWithStar(player, { nameClass: 'tourn-player-name' }));
  const rankEl = document.createElement('span');
  rankEl.className = 'tourn-player-rank';
  rankEl.textContent = player.rankLabel || 'مبتدئ ♣️';
  meta.appendChild(rankEl);
  btn.appendChild(meta);

  if (typeof applyRankTheme === 'function') {
    applyRankTheme(btn, player.rankTheme || 'wood');
  }

  return btn;
}

function renderRegisteredPlayers(players, size = 8) {
  const list = players || [];
  const grid = document.createElement('div');
  grid.className = 'tournament-players-grid';
  list.forEach((p) => grid.appendChild(buildTournamentPlayerCardElement(p)));
  const emptyCount = Math.max(0, (size || list.length) - list.length);
  for (let i = 0; i < emptyCount; i++) {
    const empty = document.createElement('div');
    empty.className = 'tourn-player-card empty';
    empty.setAttribute('aria-hidden', 'true');
    empty.innerHTML = `
      <div class="tourn-player-visual">
        <span class="tourn-player-avatar initial">؟</span>
      </div>
      <div class="tourn-player-meta">
        <span class="tourn-player-name muted">بانتظار لاعب</span>
      </div>`;
    grid.appendChild(empty);
  }
  return grid.outerHTML;
}

function renderTournamentDetail(data) {
  const t = data.tournament;
  const root = $('#tournament-detail-root');
  const titleEl = $('#tournament-detail-title');
  if (titleEl) titleEl.textContent = t.title;
  if (!root) return;

  const showTimer = (t.status === 'registration' || t.status === 'lobby') && t.seconds_left != null;
  const urgent = t.status === 'lobby' && t.seconds_left <= 15;

  let body = '';
  if (t.status === 'registration') {
    body += `<h3 class="tournament-section-title">المسجلون (${t.entry_count}/${t.size})</h3>`;
    body += `<p class="tournament-players-hint">اضغط على أي لاعب لعرض ملفه ورادار اللعب أو إضافته كصديق</p>`;
    body += renderRegisteredPlayers(data.registered_players, t.size);
  }
  if (data.teams?.length && (t.status === 'lobby' || t.status === 'active')) {
    body += `<h3 class="tournament-section-title">فرق البطولة — كل اثنين معاً</h3>`;
    body += `<p class="tournament-players-hint">اضغط على أي لاعب لعرض ملفه ورادار اللعب</p>`;
    body += renderTeamsGrid(data.teams, t.my_team_id);
  }
  if (t.status === 'active' || t.status === 'completed') {
    body += renderBracket(data.bracket, data.teams);
  }
  if (t.status === 'cancelled') {
    body = '<p class="lobby-error">تم إلغاء البطولة — لم يكتمل العدد أو لم يدخل الجميع في الوقت المحدد</p>';
  }

  root.innerHTML = '';
  const hero = buildTournamentHeroHtml(t, { detail: true });
  root.appendChild(hero);

  let extra = document.createElement('div');
  extra.className = 'tournament-detail-extra';

  let extraHtml = '';
  if (showTimer) {
    extraHtml += `
      <div class="tournament-phase-banner${t.status === 'lobby' ? ' lobby' : ''}">
        <div class="tournament-phase-label">${t.phase_label || statusLabel(t)}</div>
        <div class="tournament-countdown${urgent ? ' urgent' : ''}" data-seconds="${t.seconds_left}">${formatCountdown(t.seconds_left)}</div>
        ${t.status === 'registration' ? '<p class="tournament-phase-hint">5 دقائق للتسجيل ثم دقيقة للدخول</p>' : ''}
        ${t.status === 'lobby' ? '<p class="tournament-phase-hint lobby">يجب على الجميع الضغط على «ادخل الآن!» خلال دقيقة!</p>' : ''}
      </div>
    `;
  }
  if (t.is_registered && t.status === 'registration') {
    extraHtml += `<p class="tournament-status-note">أنت مسجّل — انتظر انتهاء التسجيل (5 دقائق)</p>`;
  }
  if (t.is_checked_in && t.status === 'lobby') {
    extraHtml += `<p class="tournament-status-note ok">أنت داخل البطولة ✓</p>`;
  }
  extraHtml += body;
  extra.innerHTML = extraHtml;
  root.appendChild(extra);

  const cdEl = root.querySelector('.tournament-countdown');
  if (cdEl) {
    let sec = parseInt(cdEl.dataset.seconds, 10) || 0;
    const tick = setInterval(() => {
      if (activeTournamentId !== t.id) {
        clearInterval(tick);
        return;
      }
      sec -= 1;
      if (sec < 0) sec = 0;
      cdEl.textContent = formatCountdown(sec);
      cdEl.classList.toggle('urgent', t.status === 'lobby' && sec <= 15);
      if (sec <= 0) clearInterval(tick);
    }, 1000);
  }
}

async function joinTournament(id, stayOnDetail = false) {
  try {
    const res = await apiFetch(`/api/tournaments/${id}/join`, { method: 'POST' });
    const data = await res.json();
    if (data.error) alert(data.error);
    else {
      showLobbyToast('تم التسجيل في البطولة');
      if (stayOnDetail) loadTournamentDetail(id);
      else loadTournaments();
    }
  } catch (e) {
    alert(e.message);
  }
}

async function enterTournament(id) {
  try {
    const res = await apiFetch(`/api/tournaments/${id}/enter`, { method: 'POST' });
    const data = await res.json();
    if (data.error) alert(data.error);
    else {
      showLobbyToast('تم تأكيد دخولك للبطولة');
      if (data.detail) renderTournamentDetail(data.detail);
      else loadTournamentDetail(id);
    }
  } catch (e) {
    alert(e.message);
  }
}

async function createTournament() {
  const title = $('#tournament-title')?.value?.trim() || 'بطولة بلوت';
  const size = parseInt($('#tournament-size')?.value || '8', 10);
  const match_format = $('#tournament-format')?.value || 'bo1';
  try {
    const res = await apiFetch('/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({ type: tournamentsTab, title, size, match_format }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showLobbyToast('تم إنشاء البطولة — 5 دقائق للتسجيل');
    $('#tournament-title').value = '';
    loadTournaments();
    if (data.tournament?.id) openTournamentDetail(data.tournament.id);
  } catch (e) {
    alert(e.message);
  }
}

function updateTournamentTabs() {
  $$('.tournaments-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tournamentsTab);
  });
  const hint = $('#tournament-type-hint');
  if (hint) {
    hint.textContent = tournamentsTab === 'pro'
      ? 'بطولات احترافية رسمية — سجّل للمشاركة'
      : 'بطولة ترفيهية — 5 دقائق تسجيل ثم دقيقة دخول — كل اثنين فريق';
  }
}

function closeTournamentDetail() {
  stopTournamentPoll();
  activeTournamentId = null;
  showScreen('tournaments');
  loadTournaments();
}

function initTournamentsPage() {
  updateTournamentTabs();
  loadTournaments();
}

function wireTournamentsPage() {
  $$('.tournaments-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      tournamentsTab = btn.dataset.tab;
      updateTournamentTabs();
      loadTournaments();
    });
  });
  $('#btn-create-tournament')?.addEventListener('click', createTournament);
  $('#btn-tournaments-back')?.addEventListener('click', () => initHome());
  $('#btn-tournament-detail-back')?.addEventListener('click', closeTournamentDetail);

  $('#tournament-detail-root')?.addEventListener('click', (e) => {
    if (e.target.closest('.tourn-status-badge')) {
      e.stopPropagation();
      return;
    }
    const card = e.target.closest('.tourn-player-card[data-user-id]');
    if (!card) return;
    const uid = parseInt(card.dataset.userId, 10);
    if (!uid) return;
    if (typeof openChatProfile === 'function') openChatProfile(uid);
    else if (typeof showLobbyToast === 'function') showLobbyToast('سجّل الدخول لعرض الملف');
  });
}

document.addEventListener('DOMContentLoaded', wireTournamentsPage);
