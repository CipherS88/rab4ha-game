/** نظام الإهداء بين اللاعبين */

let giftQueue = [];
let currentGift = null;
let giftSendTarget = null;
let giftSendType = 'coins';
let giftSendOptions = {};
const seenGiftIds = new Set();
let giftPollTimer = null;

function giftIconForType(giftType, amount) {
  if (giftType === 'vip_7d' || (giftType === 'admin_bundle' && amount === 7)) return '👑';
  if (giftType === 'gems') return '💎';
  if (giftType === 'admin_bundle') return '🎁';
  return '🪙';
}

function defaultSender(gift) {
  return {
    user_id: null,
    name: gift?.is_admin ? 'الإدارة' : 'لاعب',
    avatar_url: '',
    avatar_initial: gift?.is_admin ? '★' : '?',
    rankLabel: '',
    rankTheme: gift?.is_admin ? 'gold' : 'wood',
    deck_back_url: '/cards/back_dark.png',
    star: gift?.is_admin ? 'admin' : null,
    is_vip: false,
    is_admin: !!gift?.is_admin,
  };
}

async function refreshProfileAfterGift() {
  if (typeof fetchProfile !== 'function') return;
  try {
    const profile = await fetchProfile();
    if (typeof renderHomeProfile === 'function' && $('#screen-home')?.classList.contains('active')) {
      renderHomeProfile(profile);
    }
  } catch (_) {}
}

function getGiftCost() {
  if (giftSendType === 'vip_7d') {
    return giftSendOptions.vip_7d_cost ?? 2500;
  }
  return parseInt($('#gift-send-amount')?.value, 10) || 0;
}

function canAffordGift() {
  const balance = giftSendOptions.my_coins ?? 0;
  const cost = getGiftCost();
  if (giftSendType === 'coins') {
    const min = giftSendOptions.min_coins ?? 50;
    if (cost < min) return { ok: false, reason: `الحد الأدنى للإهداء ${min} ذهب` };
  }
  if (balance < cost) {
    const need = (cost - balance).toLocaleString('ar-SA');
    return {
      ok: false,
      reason: `رصيدك غير كافٍ — ينقصك ${need} 🪙`,
    };
  }
  return { ok: true, cost };
}

function updateGiftAffordability() {
  const check = canAffordGift();
  const warn = $('#gift-send-insufficient');
  const warnText = $('#gift-send-insufficient-text');
  const balanceEl = $('#gift-send-balance');
  const confirmBtn = $('#gift-send-confirm');

  if (check.ok) {
    warn?.classList.add('hidden');
    balanceEl?.classList.remove('insufficient');
    if (confirmBtn) confirmBtn.disabled = false;
  } else {
    warn?.classList.remove('hidden');
    if (warnText) warnText.textContent = check.reason;
    balanceEl?.classList.add('insufficient');
    if (confirmBtn) confirmBtn.disabled = true;
  }
}

function renderGiftDeckCards(container, backUrl) {
  if (!container) return;
  container.innerHTML = '';
  const layout = [
    { left: 8, rotate: -12, z: 1 },
    { left: 32, rotate: 12, z: 2 },
  ];
  for (const item of layout) {
    const c = document.createElement('span');
    c.className = 'gift-card-back';
    c.style.backgroundImage = `url('${backUrl || '/cards/back_dark.png'}')`;
    c.style.left = `${item.left}px`;
    c.style.transform = `rotate(${item.rotate}deg)`;
    c.style.zIndex = String(item.z);
    container.appendChild(c);
  }
}

function showGiftReceivePopup(gift) {
  if (!gift?.id) return;
  const overlay = $('#gift-receive-overlay');
  if (!overlay) return;

  currentGift = gift;
  const s = gift.sender || defaultSender(gift);
  const backUrl = s.deck_back_url || '/cards/back_dark.png';

  renderGiftDeckCards($('#gift-cards-fan'), backUrl);

  const av = $('#gift-avatar');
  if (av) {
    av.innerHTML = '';
    if (s.avatar_url) {
      const img = document.createElement('img');
      img.src = s.avatar_url;
      img.alt = '';
      av.appendChild(img);
    } else {
      av.textContent = s.avatar_initial || '؟';
    }
  }

  const starWrap = $('#gift-star-badge');
  if (starWrap) {
    starWrap.innerHTML = '';
    const badge = typeof resolveStatusBadge === 'function' ? resolveStatusBadge(s) : null;
    if (badge && typeof createStatusBadgeButton === 'function') {
      starWrap.appendChild(createStatusBadgeButton(badge, { size: 'sm' }));
    }
  }

  const nameWrap = document.querySelector('.gift-sender-name');
  if (nameWrap) {
    nameWrap.innerHTML = '';
    if (s.is_vip || gift.is_admin) {
      const crown = document.createElement('span');
      crown.className = 'gift-crown';
      crown.textContent = '👑';
      nameWrap.appendChild(crown);
    }
    if (typeof buildPlayerNameWithStar === 'function') {
      nameWrap.appendChild(buildPlayerNameWithStar(s, { emptyLabel: 'لاعب' }));
    } else {
      const span = document.createElement('span');
      span.id = 'gift-sender-name';
      span.textContent = s.name || 'لاعب';
      nameWrap.appendChild(span);
    }
  }

  const icon = $('#gift-reward-icon');
  if (icon) icon.textContent = giftIconForType(gift.gift_type, gift.amount);

  const msg = $('#gift-message');
  if (msg) msg.textContent = gift.message || 'أهداك هدية';

  overlay.classList.remove('hidden');
  overlay.dataset.giftId = String(gift.id);
  seenGiftIds.add(gift.id);
  refreshProfileAfterGift();
}

function closeGiftReceivePopup(markSeen = true) {
  const overlay = $('#gift-receive-overlay');
  if (!overlay) return;
  const giftId = parseInt(overlay.dataset.giftId, 10);
  overlay.classList.add('hidden');
  overlay.dataset.giftId = '';
  currentGift = null;

  if (markSeen && giftId) {
    apiFetch(`/api/gifts/${giftId}/seen`, { method: 'POST' })
      .then(() => refreshProfileAfterGift())
      .catch(() => {});
  }

  if (giftQueue.length) {
    const next = giftQueue.shift();
    setTimeout(() => showGiftReceivePopup(next), 300);
  }
}

function enqueueGift(gift) {
  if (!gift?.id) return;
  if (seenGiftIds.has(gift.id)) return;

  const overlay = $('#gift-receive-overlay');
  if (!overlay || overlay.classList.contains('hidden')) {
    showGiftReceivePopup(gift);
  } else {
    if (!giftQueue.some((g) => g.id === gift.id)) {
      giftQueue.push(gift);
    }
  }
}

function showGiftSentSuccess(targetName, giftType, amount) {
  const overlay = $('#gift-sent-overlay');
  if (!overlay) return;

  let detail = '';
  if (giftType === 'vip_7d') {
    detail = 'أهديت اشتراك VIP لمدة 7 أيام';
  } else if (giftType === 'gems') {
    detail = `أهديت ${(amount || 0).toLocaleString('ar-SA')} جواهر`;
  } else if (giftType === 'admin_bundle') {
    detail = 'أرسلت هدية من الإدارة';
  } else {
    detail = `أهديت ${(amount || 0).toLocaleString('ar-SA')} ذهب`;
  }

  const msgEl = $('#gift-sent-message');
  if (msgEl) {
    msgEl.textContent = `${detail} — وصلت بأمان إلى اللاعب`;
  }

  const targetEl = $('#gift-sent-target');
  if (targetEl) {
    targetEl.textContent = targetName ? `إلى: ${targetName}` : '';
  }

  overlay.classList.remove('hidden');
}

function closeGiftSentSuccess() {
  $('#gift-sent-overlay')?.classList.add('hidden');
}

function openGiftSendModal(user, options = {}) {
  giftSendTarget = user;
  giftSendType = 'coins';
  giftSendOptions = { ...options };
  const overlay = $('#gift-send-overlay');
  if (!overlay) return;

  $('#gift-send-target-name').textContent = user.name || 'لاعب';
  const amountInput = $('#gift-send-amount');
  if (amountInput) {
    amountInput.value = String(options.min_coins || 100);
    amountInput.min = String(options.min_coins || 50);
    amountInput.max = String(options.max_coins || 100000);
  }
  $('#gift-send-balance').textContent = `رصيدك: ${(options.my_coins ?? 0).toLocaleString('ar-SA')} 🪙`;
  $('#gift-send-vip-cost').textContent = `التكلفة: ${(options.vip_7d_cost ?? 2500).toLocaleString('ar-SA')} 🪙`;

  $$('.gift-type-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === giftSendType);
  });
  $('#gift-send-coins-field')?.classList.remove('hidden');
  $('#gift-send-vip-hint')?.classList.add('hidden');

  const msgEl = $('#gift-send-message');
  if (msgEl) {
    msgEl.value = '';
    updateGiftMessageLen();
  }

  updateGiftAffordability();
  overlay.classList.remove('hidden');
}

function updateGiftMessageLen() {
  const msgEl = $('#gift-send-message');
  const lenEl = $('#gift-send-message-len');
  if (lenEl && msgEl) lenEl.textContent = String(msgEl.value.length);
}

function closeGiftSendModal() {
  $('#gift-send-overlay')?.classList.add('hidden');
  giftSendTarget = null;
  giftSendOptions = {};
}

async function submitGiftSend() {
  if (!giftSendTarget?.user_id) return;

  const afford = canAffordGift();
  if (!afford.ok) {
    updateGiftAffordability();
    return;
  }

  const body = {
    to_user_id: giftSendTarget.user_id,
    type: giftSendType,
  };
  if (giftSendType === 'coins') {
    body.amount = parseInt($('#gift-send-amount')?.value, 10) || 0;
  }
  const customMessage = ($('#gift-send-message')?.value || '').trim();
  if (customMessage) body.message = customMessage;

  const targetName = giftSendTarget.name || 'اللاعب';
  const sentType = giftSendType;
  const sentAmount = body.amount;

  try {
    const res = await apiFetch('/api/gifts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.sender_coins != null) {
      giftSendOptions.my_coins = data.sender_coins;
    }

    closeGiftSendModal();
    closeChatProfile();
    showGiftSentSuccess(targetName, sentType, sentAmount);
    refreshProfileAfterGift();
  } catch (e) {
    const msg = e.message || 'فشل الإرسال';
    if (/رصيد|كافٍ|كافي/i.test(msg)) {
      const warn = $('#gift-send-insufficient');
      const warnText = $('#gift-send-insufficient-text');
      warn?.classList.remove('hidden');
      if (warnText) warnText.textContent = msg;
      $('#gift-send-balance')?.classList.add('insufficient');
      $('#gift-send-confirm').disabled = true;
    } else {
      showHomeToast(msg);
    }
  }
}

async function loadPendingGifts() {
  if (!isLoggedIn?.()) return;
  try {
    const res = await apiFetch('/api/gifts/pending');
    const data = await res.json();
    if (!res.ok) return;
    (data.gifts || []).forEach((g) => enqueueGift(g));
  } catch (_) {}
}

function onGiftSocketReceived(data) {
  if (data?.gift) enqueueGift(data.gift);
}

function startGiftPolling() {
  stopGiftPolling();
  giftPollTimer = setInterval(loadPendingGifts, 15000);
}

function stopGiftPolling() {
  if (giftPollTimer) {
    clearInterval(giftPollTimer);
    giftPollTimer = null;
  }
}

function initGiftDelivery() {
  const sock = typeof socket !== 'undefined' ? socket : null;
  wireGiftSocket(sock);
  loadPendingGifts();
  startGiftPolling();
}

function wireGiftUi() {
  $('#gift-back-btn')?.addEventListener('click', () => closeGiftReceivePopup(true));

  $('#gift-btn-friend')?.addEventListener('click', async () => {
    const uid = currentGift?.sender?.user_id;
    if (!uid) return;
    closeGiftReceivePopup(true);
    if (typeof chatFriendAction === 'function') {
      await chatFriendAction('request', uid);
    } else if (typeof openChatProfile === 'function') {
      openChatProfile(uid);
    }
  });

  $('#gift-btn-like')?.addEventListener('click', () => {
    showHomeToast('شكراً لك!');
  });

  $('#gift-btn-send-back')?.addEventListener('click', () => {
    const uid = currentGift?.sender?.user_id;
    closeGiftReceivePopup(true);
    if (uid && typeof openChatProfile === 'function') {
      openChatProfile(uid);
    }
  });

  $('#gift-send-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'gift-send-overlay') closeGiftSendModal();
  });
  $('#gift-sent-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'gift-sent-overlay') closeGiftSentSuccess();
  });
  $('#gift-send-cancel')?.addEventListener('click', closeGiftSendModal);
  $('#gift-send-confirm')?.addEventListener('click', submitGiftSend);
  $('#gift-sent-close')?.addEventListener('click', closeGiftSentSuccess);
  $('#gift-send-message')?.addEventListener('input', updateGiftMessageLen);
  $('#gift-send-amount')?.addEventListener('input', updateGiftAffordability);

  $$('.gift-type-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      giftSendType = btn.dataset.type || 'coins';
      $$('.gift-type-opt').forEach((b) => b.classList.toggle('active', b === btn));
      const isVip = giftSendType === 'vip_7d';
      $('#gift-send-coins-field')?.classList.toggle('hidden', isVip);
      $('#gift-send-vip-hint')?.classList.toggle('hidden', !isVip);
      updateGiftAffordability();
    });
  });
}

function wireGiftSocket(sock) {
  if (!sock) return;
  if (sock._giftListenerWired) return;
  sock._giftListenerWired = true;
  sock.on('gift:received', onGiftSocketReceived);
}

document.addEventListener('DOMContentLoaded', wireGiftUi);
