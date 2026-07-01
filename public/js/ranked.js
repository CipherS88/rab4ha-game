/** شاشة اللعب المصنّف — رادار + ترقية */

async function initRankedLobby() {
  const screen = $('#screen-ranked');
  applyRankTheme(screen, 'wood');

  let profile = getCachedProfile();
  if (!profile) {
    try { profile = await fetchProfile(); } catch (e) { console.error(e); }
  }
  if (!profile) {
    showHomeToast?.('تعذّر تحميل بيانات التصنيف');
    return;
  }

  profile = normalizeProfileRanks(profile);
  cachedProfile = profile;

  applyRankTheme(screen, profile.rankTheme || 'wood');

  $('#ranked-current-rank').textContent = profile.rankLabel || 'مبتدئ ♣️';
  $('#ranked-next-rank').textContent = profile.nextRankLabel || 'مبتدئ ♣️♦️';

  const pct = profile.progressPercent ?? 0;
  const fill = $('#ranked-progress-fill');
  if (fill) fill.style.width = `${pct}%`;

  const pts = profile.rank_points ?? 0;
  const toNext = profile.pointsToNext ?? (100 - pts);
  $('#ranked-progress-text').textContent = `${pts} / 100 — باقي ${toNext} نقطة للترقية`;

  if (typeof drawRadarChart === 'function') {
    drawRadarChart($('#ranked-radar'), profile.radarStats || {});
  }
}

function wireRankedLobby() {
  $('#btn-ranked-back')?.addEventListener('click', () => initHome());

  $('#btn-ranked-play')?.addEventListener('click', async () => {
    const name = getPlayerName();
    $('#player-name').value = name;
    try { await updateProfileName(name); } catch (_) {}
    startRankedMatchmaking();
  });
}

function startRankedMatchmaking() {
  if (typeof startMatchmaking === 'function') {
    startMatchmaking(false, 'ranked');
  }
}

document.addEventListener('DOMContentLoaded', wireRankedLobby);
