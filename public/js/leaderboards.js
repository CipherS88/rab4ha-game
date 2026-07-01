/** المتصدرين — 3 قوائم مباشرة */

let leaderboardsTab = 'rank_kings';
let leaderboardsPoll = null;

const LB_HINTS = {
  rank_kings: 'أفضل 100 لاعب في نقاط الأسبوع للعب المصنّف — أوائل 10 يحصلون على ميدالية الأبطال',
  tournament_stars: 'ترتيب نجوم الفوز في البطولات الترفيهية ⭐',
  charisma: 'الكاريزما من إهداء الذهب وVIP — كلما أهديت أكثر ارتفع ترتيبك',
};

function lbPosLabel(pos) {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return String(pos);
}

function renderLbAvatar(entry) {
  if (entry.avatar_url) {
    return `<img src="${entry.avatar_url}" alt="" />`;
  }
  return entry.avatar_initial || '?';
}

function renderLbRow(entry, isMe = false) {
  const topClass = entry.position <= 3 ? ` top-${entry.position}` : '';
  const meClass = isMe ? ' is-me' : '';
  const medal = entry.has_champion_medal || (entry.champion_medals > 0)
    ? '<span class="lb-medal" title="ميدالية الأبطال">🏅</span>'
    : '';
  const weeklyTop = entry.is_weekly_top10 ? '<span class="lb-medal" title="ضمن أوائل 10 هذا الأسبوع">⭐</span>' : '';

  return `
    <div class="lb-row${topClass}${meClass}" data-user-id="${entry.user_id}">
      <div class="lb-pos">${lbPosLabel(entry.position)}</div>
      <div class="lb-avatar">${renderLbAvatar(entry)}</div>
      <div class="lb-info">
        <div class="lb-name">${entry.name}${isMe ? ' (أنت)' : ''}</div>
        <div class="lb-meta">
          <span>${entry.rank_label || ''}</span>
          ${medal}${weeklyTop}
        </div>
      </div>
      <div class="lb-score">${entry.score_label || entry.score}</div>
    </div>
  `;
}

function renderMyRankCard(myEntry) {
  const el = $('#leaderboards-my-rank');
  if (!el || !myEntry) {
    el?.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  const posText = myEntry.position
    ? `ترتيبك: #${myEntry.position}`
    : 'لم تدخل القائمة بعد';
  el.innerHTML = `
    <div class="my-rank-label">${posText}</div>
    ${renderLbRow({ ...myEntry, position: myEntry.position || '—' }, true)}
  `;
}

function renderLeaderboardsList(data) {
  const list = $('#leaderboards-list');
  const hint = $('#leaderboards-hint');
  if (!list) return;

  if (hint) {
    let text = data.subtitle || LB_HINTS[leaderboardsTab] || '';
    if (data.week_key && leaderboardsTab === 'rank_kings') {
      text += ` — الأسبوع ${data.week_key}`;
    }
    hint.textContent = text;
  }

  const meId = getCachedUser()?.id;
  renderMyRankCard(data.my_entry);

  const entries = data.entries || [];
  if (!entries.length) {
    list.innerHTML = '<p class="leaderboards-empty">لا يوجد متصدرون بعد — كن الأول!</p>';
    return;
  }

  list.innerHTML = entries.map((e) => renderLbRow(e, e.user_id === meId)).join('');
}

async function loadLeaderboards(silent = false) {
  const list = $('#leaderboards-list');
  if (!silent && list) list.innerHTML = '<p class="lobby-loading">جاري التحميل...</p>';
  try {
    const res = await apiFetch(`/api/leaderboards/${leaderboardsTab}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    renderLeaderboardsList(data);
  } catch (e) {
    if (!silent && list) list.innerHTML = `<p class="lobby-error">${e.message}</p>`;
  }
}

function stopLeaderboardsPoll() {
  if (leaderboardsPoll) {
    clearInterval(leaderboardsPoll);
    leaderboardsPoll = null;
  }
}

function startLeaderboardsPoll() {
  stopLeaderboardsPoll();
  leaderboardsPoll = setInterval(() => loadLeaderboards(true), 4000);
}

function updateLeaderboardTabs() {
  $$('.leaderboards-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === leaderboardsTab);
  });
}

function initLeaderboardsPage() {
  updateLeaderboardTabs();
  loadLeaderboards();
  startLeaderboardsPoll();
}

function closeLeaderboardsPage() {
  stopLeaderboardsPoll();
  initHome();
}

function wireLeaderboardsPage() {
  $$('.leaderboards-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      leaderboardsTab = btn.dataset.tab || 'rank_kings';
      updateLeaderboardTabs();
      loadLeaderboards();
    });
  });
  $('#btn-leaderboards-back')?.addEventListener('click', closeLeaderboardsPage);
}

document.addEventListener('DOMContentLoaded', wireLeaderboardsPage);
