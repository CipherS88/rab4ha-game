/**
 * الشاشة الرئيسية — واجهة اللعبة
 */

function showHomeToast(msg) {
  const el = $('#home-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showHomeToast._t);
  showHomeToast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function renderHomeProfile(profile) {
  if (!profile) return;
  profile = normalizeProfileRanks(profile);
  const home = $('#screen-home');
  applyRankTheme(home, profile.rankTheme || profile.rankInfo?.theme || 'wood');

  $('#home-player-name').textContent = profile.name;
  const codeEl = $('#home-player-code');
  if (codeEl) {
    const code = profile.player_code || getCachedUser()?.player_code || '';
    codeEl.textContent = code ? formatPlayerCode(code) : '';
    codeEl.style.display = code ? '' : 'none';
  }
  $('#home-coins').textContent = formatCoins(profile.coins);
  const gemsEl = $('#home-gems');
  if (gemsEl) gemsEl.textContent = formatCoins(profile.gems ?? 1000);

  const likesEl = $('#home-likes');
  if (likesEl) likesEl.textContent = String(profile.wins ?? 0);

  const champStat = $('#home-championship-stat');
  if (champStat) champStat.textContent = String(profile.championship_stars ?? 0);

  const rankFull = profile.rankLabel || profile.rankInfo?.fullLabel || 'مبتدئ ♣️';
  const rankLabelEl = $('#home-rank-label');
  if (rankLabelEl) rankLabelEl.textContent = rankFull;
  const rankNameEl = $('#home-rank-name');
  if (rankNameEl) rankNameEl.textContent = rankFull;

  const progressEl = $('#home-rank-progress');
  if (progressEl) progressEl.style.width = `${profile.progressPercent ?? 0}%`;
  const pointsEl = $('#home-rank-points');
  if (pointsEl) pointsEl.textContent = `${profile.rank_points ?? 0} / 100`;

  const recordEl = $('#home-record');
  if (recordEl) {
    const w = profile.wins ?? 0;
    const l = profile.losses ?? 0;
    recordEl.textContent = `${w}ف - ${l}خ`;
  }

  renderChampionshipCount(profile.championship_stars ?? 0);

  renderHomeAvatar(profile);
  renderHomeDeckCards(profile);
  renderHomeStatusBadge(profile);

  if (typeof updateHomeLayoutAdminButton === 'function') {
    updateHomeLayoutAdminButton(profile);
  }
  if (typeof loadAndApplyHomeLayout === 'function') {
    requestAnimationFrame(() => loadAndApplyHomeLayout());
  }

  const radar = $('#home-radar');
  if (radar && typeof drawRadarChart === 'function') {
    drawRadarChart(radar, profile.radarStats || {});
  }

  $('#player-name').value = profile.name;
}

function renderHomeDeckCards(profile) {
  const stack = document.querySelector('[data-home-layout-id="deck"]') || document.querySelector('.home-profile-deck');
  if (!stack) return;
  const back = profile?.deck_back_url || '/cards/back_dark.png';
  stack.querySelectorAll('.home-deck-card').forEach((el) => {
    el.style.backgroundImage = `url(${back})`;
  });
}

function renderHomeAvatar(profile) {
  const img = $('#home-avatar-img');
  const initial = $('#home-avatar-initial');
  if (!initial) return;

  if (profile.avatar_removed) {
    if (img) { img.classList.add('hidden'); img.removeAttribute('src'); }
    initial.classList.remove('hidden');
    initial.textContent = '🚫';
    return;
  }

  if (profile.avatar_url && img) {
    img.src = profile.avatar_url;
    img.classList.remove('hidden');
    initial.classList.add('hidden');
  } else {
    if (img) { img.classList.add('hidden'); img.removeAttribute('src'); }
    initial.classList.remove('hidden');
    initial.textContent = profile.name?.charAt(0) || '؟';
  }
}

function renderChampionshipCount(count) {
  const el = $('#home-championship-stat') || $('#home-championship-count');
  if (el) el.textContent = String(count ?? 0);
}

async function initHome() {
  const ok = await ensureAuth();
  if (!ok) return;
  try {
    const profile = await fetchProfile();
    if (profile.name) setPlayerNameLocal(profile.name);
    renderHomeProfile(profile);
    showScreen('home');
    if (typeof initGiftDelivery === 'function') initGiftDelivery();
    if (typeof ensureChatSocket === 'function') {
      ensureChatSocket().then(() => {
        if (typeof loadPendingGifts === 'function') loadPendingGifts();
      }).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    showScreen('login');
  }
}

function wireHomeButtons() {
  $('#btn-admin-game-sandbox')?.addEventListener('click', () => {
    if (typeof startAdminGameSandbox === 'function') startAdminGameSandbox();
  });

  $('#btn-ranked')?.addEventListener('click', async () => {
    const profile = getCachedProfile() || await fetchProfile().catch(() => null);
    if (profile) renderHomeProfile(profile);
    showScreen('ranked');
    await initRankedLobby();
  });

  $('#btn-friendly')?.addEventListener('click', () => {
    const name = getPlayerName();
    $('#player-name').value = name;
    startMatchmaking(false, 'friendly');
  });

  $('#btn-match52')?.addEventListener('click', () => {
    const name = getPlayerName();
    $('#player-name').value = name;
    startMatchmaking(false, 'match52');
  });

  $('#btn-solo-home')?.addEventListener('click', () => {
    const name = getPlayerName();
    $('#player-name').value = name;
    startMatchmaking(true, 'solo');
  });

  $('#btn-sessions')?.addEventListener('click', () => {
    showScreen('sessions');
    initSessionsPage();
  });
  const tournamentsBtn = $('#btn-tournaments');
  tournamentsBtn?.classList.add('locked');
  tournamentsBtn?.setAttribute('aria-disabled', 'true');
  tournamentsBtn?.setAttribute('title', 'قيد التنفيذ');
  tournamentsBtn?.addEventListener('click', () => {
    showHomeToast('البطولات قيد التنفيذ — ستتوفر قريباً');
  });
  $('#btn-leaderboards')?.addEventListener('click', () => {
    showScreen('leaderboards');
    initLeaderboardsPage();
  });

  $('#btn-edit-name')?.addEventListener('click', async () => {
    const limits = getCachedProfile()?.profile_limits;
    const hint = limits && !limits.unlimited
      ? `\n(متبقي ${limits.name_changes_left} تغيير هذا الأسبوع)`
      : '';
    const name = prompt(`اسمك في اللعبة:${hint}`, getPlayerName());
    if (!name?.trim()) return;
    try {
      const p = await updateProfileName(name.trim());
      setPlayerNameLocal(name.trim());
      renderHomeProfile(p);
      showHomeToast('تم تحديث الاسم');
    } catch (e) {
      showHomeToast(e.message || 'تعذّر حفظ الاسم');
    }
  });

  $('#btn-change-avatar')?.addEventListener('click', () => {
    const limits = getCachedProfile()?.profile_limits;
    if (limits && !limits.unlimited && limits.avatar_changes_left <= 0) {
      showHomeToast('استنفدت تغييرات صورة العرض هذا الأسبوع (مرتان كحد أقصى)');
      return;
    }
    $('#home-avatar-input')?.click();
  });

  $('#home-avatar-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showHomeToast('حجم الصورة أكبر من 10 ميجا');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = await updateProfileAvatar(reader.result);
        renderHomeProfile(data.profile);
        const left = data.profile?.profile_limits?.avatar_changes_left;
        showHomeToast(left != null ? `تم التحديث — متبقي ${left} تغيير` : 'تم تحديث صورة العرض');
      } catch (err) {
        showHomeToast(err.message || 'تعذّر رفع الصورة');
      }
    };
    reader.readAsDataURL(file);
  });

  $('#btn-home-back')?.addEventListener('click', () => {
    if (document.getElementById('screen-game')?.classList.contains('active')) return;
    initHome();
  });
}

window.onRankedMatchEnd = async (won) => {
  try {
    const result = await reportMatchResult(won, 'ranked');
    if (result?.rankedUp) {
      setTimeout(() => showHomeToast(`🎉 ترقية! ${result.profile.rankLabel}`), 1200);
    }
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  wireHomeButtons();
  if (typeof initHomeLayoutEditor === 'function') initHomeLayoutEditor();
  if (typeof initGameLayoutEditor === 'function') initGameLayoutEditor();
  const params = new URLSearchParams(window.location.search);
  if (params.get('solo') === '1') return;
  if (params.get('seat') !== null) return;
  if (typeof getActiveGame === 'function' && getActiveGame()?.roomId) return;
  if (isLoggedIn()) initHome();
  else showScreen('login');
});
