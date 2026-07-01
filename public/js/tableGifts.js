/** هدايا تفاعلية داخل طاولة اللعب */

const TABLE_GIFT_COST = 5;

const TABLE_GIFT_ITEMS = [
  { id: 'wolf', emoji: '🐺' },
  { id: 'coffee', emoji: '☕' },
  { id: 'tea', emoji: '🍵' },
  { id: 'plane', emoji: '✈️' },
  { id: 'cigarette', emoji: '🚬' },
  { id: 'rose', emoji: '🌹' },
  { id: 'heart', emoji: '❤️' },
];

let pendingTableGift = null;
let tableGiftPickMode = false;
let tableGiftSocketWired = false;

function getMyGameSeat() {
  return typeof window.getGameMySeat === 'function' ? window.getGameMySeat() : null;
}

function getGameStateRef() {
  return typeof window.getGameStateRef === 'function' ? window.getGameStateRef() : null;
}

function globalSeatToVisual(globalSeat) {
  const local = getMyGameSeat();
  if (local === null || local === undefined) return 'bottom';
  const diff = (globalSeat - local + 4) % 4;
  const visualByDiff = ['bottom', 'right', 'top', 'left'];
  return visualByDiff[diff];
}

function getSeatElement(visualPos) {
  return document.querySelector(`#game-board [data-game-layout-id="seat_${visualPos}_gifts"]`)
    || document.querySelector(`#game-board [data-game-layout-id="seat_${visualPos}_avatar"]`);
}

function getAvatarWrapForVisual(visualPos) {
  return document.querySelector(`#game-board [data-game-layout-id="seat_${visualPos}_avatar"] .avatar-wrap`);
}

function getAvatarCenter(visualPos) {
  const wrap = getAvatarWrapForVisual(visualPos);
  if (!wrap) return null;
  const r = wrap.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function showTableGiftToast(msg) {
  const el = $('#table-gift-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showTableGiftToast._t);
  showTableGiftToast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

async function fetchMyCoins() {
  if (typeof fetchProfile === 'function') {
    try {
      const p = await fetchProfile();
      return p?.coins ?? 0;
    } catch (_) {}
  }
  return 0;
}

function updateTableGiftBalance(coins) {
  const el = $('#table-gift-balance');
  if (el) el.textContent = `رصيدك: ${(coins ?? 0).toLocaleString('ar-SA')} 🪙`;
}

function openTableGiftMenu() {
  const overlay = $('#table-gift-menu-overlay');
  if (!overlay) return;
  pendingTableGift = null;
  exitGiftPickMode();
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  fetchMyCoins().then(updateTableGiftBalance);
}

function closeTableGiftMenu() {
  $('#table-gift-menu-overlay')?.classList.add('hidden');
  $('#table-gift-recipient-overlay')?.classList.add('hidden');
  pendingTableGift = null;
  exitGiftPickMode();
}

function openRecipientPicker(gift) {
  pendingTableGift = gift;
  $('#table-gift-menu-overlay')?.classList.add('hidden');

  const overlay = $('#table-gift-recipient-overlay');
  const list = $('#table-gift-recipient-list');
  const title = $('#table-gift-recipient-title');
  if (!overlay || !list) return;

  if (title) title.textContent = `إرسال ${gift.emoji} إلى`;
  list.innerHTML = '';

  const mySeat = getMyGameSeat();
  const state = getGameStateRef();
  const seats = state?.seats || [];
  let otherCount = 0;

  seats.forEach((s, idx) => {
    if (!s?.name || idx === mySeat) return;
    otherCount++;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'table-gift-recipient-btn';
    btn.innerHTML = `<span>${s.name}</span><span class="table-gift-recipient-cost">${TABLE_GIFT_COST} 🪙</span>`;
    btn.addEventListener('click', () => sendTableGift(gift.id, idx));
    list.appendChild(btn);
  });

  if (otherCount > 1) {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'table-gift-recipient-btn all';
    const total = otherCount * TABLE_GIFT_COST;
    allBtn.innerHTML = `<span>الجميع</span><span class="table-gift-recipient-cost">${total} 🪙</span>`;
    allBtn.addEventListener('click', () => sendTableGift(gift.id, 'all'));
    list.appendChild(allBtn);
  }

  const pickBtn = document.createElement('button');
  pickBtn.type = 'button';
  pickBtn.className = 'table-gift-recipient-btn';
  pickBtn.textContent = 'اختر من الطاولة (اضغط على الأفاتار)';
  pickBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    enterGiftPickMode(gift);
  });
  list.appendChild(pickBtn);

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function enterGiftPickMode(gift) {
  pendingTableGift = gift;
  tableGiftPickMode = true;
  $('#game-board')?.classList.add('gift-pick-mode');
  showTableGiftToast('اضغط على أفاتار اللاعب المستلم');
}

function exitGiftPickMode() {
  tableGiftPickMode = false;
  $('#game-board')?.classList.remove('gift-pick-mode');
}

function renderTableGiftSlotsForSeat(globalSeat, slots) {
  const visual = globalSeatToVisual(globalSeat);
  const seatEl = getSeatElement(visual);
  const container = seatEl?.querySelector('.table-gift-slots');
  if (!container) return;

  const slotEls = container.querySelectorAll('.table-gift-slot');
  const row = slots || [];
  slotEls.forEach((el, i) => {
    const item = row[i];
    if (item?.emoji) {
      el.textContent = item.emoji;
      el.classList.remove('empty');
    } else {
      el.textContent = '';
      el.classList.add('empty');
    }
  });
}

function syncAllTableGiftSlots(tableGiftSlots) {
  if (!Array.isArray(tableGiftSlots)) return;
  tableGiftSlots.forEach((row, idx) => renderTableGiftSlotsForSeat(idx, row));
}

function animateTableGiftFly(fromSeat, toSeat, emoji, onDone) {
  const fromVisual = globalSeatToVisual(fromSeat);
  const toVisual = globalSeatToVisual(toSeat);
  const start = getAvatarCenter(fromVisual);
  const end = getAvatarCenter(toVisual);
  if (!start || !end) {
    onDone?.();
    return;
  }

  const fly = document.createElement('div');
  fly.className = 'table-gift-fly';
  fly.textContent = emoji;
  fly.style.left = `${start.x}px`;
  fly.style.top = `${start.y}px`;
  fly.style.transform = 'translate(-50%, -50%) scale(1)';
  document.body.appendChild(fly);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fly.style.left = `${end.x}px`;
      fly.style.top = `${end.y}px`;
      fly.style.transform = 'translate(-50%, -50%) scale(1.15)';
    });
  });

  setTimeout(() => {
    fly.style.opacity = '0';
    setTimeout(() => fly.remove(), 200);
    onDone?.();
  }, 680);
}

function onTableGiftReceived(payload) {
  if (!payload?.emoji) return;
  const deliveries = payload.deliveries || [];
  let i = 0;
  const runNext = () => {
    if (i >= deliveries.length) {
      if (payload.table_gift_slots) syncAllTableGiftSlots(payload.table_gift_slots);
      return;
    }
    const d = deliveries[i++];
    animateTableGiftFly(payload.fromSeat, d.toSeat, payload.emoji, runNext);
  };
  runNext();

  if (payload.senderCoins != null && $('#table-gift-menu-overlay') && !$('#table-gift-menu-overlay').classList.contains('hidden')) {
    updateTableGiftBalance(payload.senderCoins);
  }
}

function sendTableGift(giftId, target) {
  if (!giftId) return;
  exitGiftPickMode();
  closeTableGiftMenu();

  socket.emit('table_gift', { giftId, target }, (res) => {
    if (res?.error) {
      showTableGiftToast(res.error);
      return;
    }
    if (res?.senderCoins != null) updateTableGiftBalance(res.senderCoins);
    if (typeof refreshProfileAfterGift === 'function') refreshProfileAfterGift();
    else if (typeof fetchProfile === 'function') fetchProfile().catch(() => {});
  });
}

function onAvatarPickForGift(e) {
  if (!tableGiftPickMode || !pendingTableGift) return;
  const wrap = e.target.closest('.avatar-wrap');
  if (!wrap) return;
  const part = wrap.closest('[data-game-layout-id]');
  const id = part?.dataset?.gameLayoutId || '';
  const m = id.match(/^seat_(top|left|right|bottom)_avatar$/);
  if (!m) return;
  const visualPos = m[1];
  if (visualPos === 'bottom') return;
  const mySeat = getMyGameSeat();
  if (mySeat === null) return;

  const diffMap = { top: 2, right: 1, left: 3, bottom: 0 };
  const diff = diffMap[visualPos];
  if (diff === undefined) return;
  const globalSeat = (mySeat + diff) % 4;
  if (globalSeat === mySeat) return;

  sendTableGift(pendingTableGift.id, globalSeat);
}

function buildTableGiftMenu() {
  const grid = $('#table-gift-grid');
  if (!grid) return;
  grid.innerHTML = '';
  TABLE_GIFT_ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'table-gift-opt';
    btn.innerHTML = `
      <span class="table-gift-opt-emoji">${item.emoji}</span>
      <span class="table-gift-opt-cost">${TABLE_GIFT_COST} 🪙</span>
    `;
    btn.addEventListener('click', () => openRecipientPicker(item));
    grid.appendChild(btn);
  });
}

function wireTableGiftsUi() {
  buildTableGiftMenu();
  $('#btn-table-gifts')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openTableGiftMenu();
  });
  $('#btn-table-gift-close')?.addEventListener('click', closeTableGiftMenu);
  $('#btn-table-gift-recipient-close')?.addEventListener('click', closeTableGiftMenu);
  $('#table-gift-menu-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'table-gift-menu-overlay') closeTableGiftMenu();
  });
  $('#table-gift-recipient-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'table-gift-recipient-overlay') closeTableGiftMenu();
  });
  $('#game-board')?.addEventListener('click', onAvatarPickForGift);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTableGiftMenu();
  });
}

function wireTableGiftSocket(sock = socket) {
  if (!sock || tableGiftSocketWired) return;
  tableGiftSocketWired = true;
  sock.on('table_gift', onTableGiftReceived);
  sock.on('game_public', (state) => {
    if (state?.table_gift_slots) syncAllTableGiftSlots(state.table_gift_slots);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireTableGiftsUi();
  wireTableGiftSocket();
});

window.wireTableGiftSocket = wireTableGiftSocket;
