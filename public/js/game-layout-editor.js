/**
 * محرّر تخطيط طاولة اللعب — للأدمن (وضع sandbox)
 * سحب · تكبير · دوران
 */
(function () {
  const LAYOUT_IDS = [
    'score_bar', 'table_center', 'floor_card',
    'btn_sawa', 'btn_qaid', 'side_utils', 'back_btn',
    'seat_top_avatar', 'seat_top_cards', 'seat_top_gifts', 'seat_top_name',
    'seat_left_avatar', 'seat_left_cards', 'seat_left_gifts', 'seat_left_name',
    'seat_right_avatar', 'seat_right_cards', 'seat_right_gifts', 'seat_right_name',
    'seat_bottom_avatar', 'seat_bottom_gifts', 'seat_bottom_name',
    'my_hand', 'bid_buttons', 'project_bar',
  ];

  let editMode = false;
  let currentLayout = null;
  let draftLayout = null;
  let dragState = null;

  function canvasEl() {
    return document.getElementById('game-board');
  }

  function authHeaders() {
    const token = typeof getAuthToken === 'function'
      ? getAuthToken()
      : (typeof getToken === 'function' ? getToken() : localStorage.getItem('baloot_auth_token'));
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  const HAND_VARIANT_KEYS = ['5', '6', '7', '8'];

  function variantKeyForCount(count) {
    if (count <= 5) return '5';
    if (count >= 8) return '8';
    return String(count);
  }

  function resolveLayoutForCards(layout, cardCount) {
    if (!layout) return layout;
    const key = variantKeyForCount(cardCount);
    const v = layout.variants?.[key] || {};
    const elements = { ...(layout.elements || {}) };
    const vElems = v.elements || {};
    for (const id of ['my_hand', 'bid_buttons', 'project_bar']) {
      if (vElems[id]) elements[id] = vElems[id];
      else if (v[id]) elements[id] = v[id];
    }
    return {
      ...layout,
      elements,
      tuning: {
        ...(layout.tuning || {}),
        hand_card_gap: v.hand_card_gap ?? layout.tuning?.hand_card_gap ?? 1,
        hand_card_scale: v.hand_card_scale ?? layout.tuning?.hand_card_scale ?? 1,
      },
    };
  }

  function buildSavePayload() {
    const key = variantKeyForCount(sandboxPreviewCards);
    const base = draftLayout || currentLayout || { version: 3, elements: {}, tuning: {}, variants: {} };
    const elements = { ...(base.elements || {}) };
    const handIds = ['my_hand', 'bid_buttons', 'project_bar'];
    const variantElements = {};
    for (const id of handIds) {
      if (elements[id]) {
        variantElements[id] = elements[id];
        delete elements[id];
      }
    }
    const variants = { ...(base.variants || {}) };
    variants[key] = {
      ...(variants[key] || {}),
      elements: { ...(variants[key]?.elements || {}), ...variantElements },
      hand_card_gap: base.tuning?.hand_card_gap ?? variants[key]?.hand_card_gap ?? 1,
      hand_card_scale: base.tuning?.hand_card_scale ?? variants[key]?.hand_card_scale ?? 1,
    };
    const tuning = { ...(base.tuning || {}) };
    delete tuning.hand_card_gap;
    delete tuning.hand_card_scale;
    return { version: 3, elements, tuning, variants };
  }

  async function fetchGameLayout() {
    try {
      const res = await fetch('/api/game-layout');
      if (!res.ok) return null;
      const data = await res.json();
      return data.layout || null;
    } catch {
      return null;
    }
  }

  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }

  function applyBoxStyles(el, box) {
    el.style.left = `${box.x * 100}%`;
    el.style.top = `${box.y * 100}%`;
    el.style.width = `${box.w * 100}%`;
    el.style.height = `${box.h * 100}%`;
    const r = Number(box.r) || 0;
    el.style.transform = r ? `rotate(${r}deg)` : '';
    el.style.transformOrigin = 'center center';
  }

  function applyTuning(canvas, layout) {
    const t = layout?.tuning || {};
    canvas.style.setProperty('--layout-floor-card-scale', t.floor_card_scale ?? 1);
    canvas.style.setProperty('--layout-opponent-card-scale', t.opponent_card_scale ?? 1);
    canvas.style.setProperty('--layout-opponent-card-overlap', t.opponent_card_overlap ?? 1);
    const floor = canvas.querySelector('#floor-card');
    if (floor) {
      const s = t.floor_card_scale ?? 1;
      floor.style.transform = s !== 1 ? `scale(${s})` : '';
      floor.style.transformOrigin = 'center center';
    }
  }

  function currentHandCount() {
    if (typeof sandboxMode !== 'undefined' && sandboxMode) return sandboxPreviewCards;
    const hand = typeof gameState !== 'undefined' && gameState?.my_hand;
    if (Array.isArray(hand) && hand.length > 0) return hand.length;
    const cnt = typeof gameState !== 'undefined' && gameState?.my_hand_count;
    if (typeof cnt === 'number' && cnt > 0) return cnt;
    return sandboxPreviewCards;
  }

  function applyLayout(layout, { editing = false } = {}) {
    const canvas = canvasEl();
    if (!canvas || !layout?.elements) return;

    currentLayout = layout;
    canvas.classList.add('game-custom-layout');
    canvas.classList.toggle('game-edit-mode', editing);
    applyTuning(canvas, layout);

    for (const id of LAYOUT_IDS) {
      let el = canvas.querySelector(`[data-game-layout-id="${id}"]`);
      const box = layout.elements[id];
      if (!el || !box) continue;

      if (el.parentElement !== canvas) {
        canvas.appendChild(el);
      }

      applyBoxStyles(el, box);

      let resizeHandle = el.querySelector('.game-layout-resize-handle');
      let rotateHandle = el.querySelector('.game-layout-rotate-handle');
      if (editing) {
        if (!resizeHandle) {
          resizeHandle = document.createElement('span');
          resizeHandle.className = 'game-layout-resize-handle';
          resizeHandle.setAttribute('aria-hidden', 'true');
          el.appendChild(resizeHandle);
        }
        if (!rotateHandle) {
          rotateHandle = document.createElement('span');
          rotateHandle.className = 'game-layout-rotate-handle';
          rotateHandle.setAttribute('aria-hidden', 'true');
          rotateHandle.title = 'دوران';
          el.appendChild(rotateHandle);
        }
      } else {
        resizeHandle?.remove();
        rotateHandle?.remove();
      }
    }

    if (editing) attachEditHandlers(canvas);
    else detachEditHandlers(canvas);
  }

  function captureLayoutFromDom() {
    const canvas = canvasEl();
    if (!canvas) return { version: 1, elements: {} };
    const cRect = canvas.getBoundingClientRect();
    const cw = cRect.width || 1;
    const ch = cRect.height || 1;
    const elements = {};
    for (const id of LAYOUT_IDS) {
      const el = canvas.querySelector(`[data-game-layout-id="${id}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const prev = draftLayout?.elements?.[id] || currentLayout?.elements?.[id] || {};
      elements[id] = {
        x: clamp01((r.left - cRect.left) / cw),
        y: clamp01((r.top - cRect.top) / ch),
        w: clamp01(r.width / cw),
        h: clamp01(r.height / ch),
        r: Number(prev.r) || 0,
      };
    }
    return { version: 1, elements };
  }

  function updateDraft(id, patch) {
    if (!draftLayout?.elements?.[id]) return;
    Object.assign(draftLayout.elements[id], patch);
    applyLayout(draftLayout, { editing: true });
  }

  function onPointerMove(e) {
    if (!dragState || !draftLayout) return;
    const canvas = canvasEl();
    const cRect = canvas.getBoundingClientRect();
    const cw = cRect.width || 1;
    const ch = cRect.height || 1;
    const el = draftLayout.elements[dragState.id];
    if (!el) return;

    if (dragState.mode === 'move') {
      const dx = (e.clientX - dragState.startX) / cw;
      const dy = (e.clientY - dragState.startY) / ch;
      updateDraft(dragState.id, {
        x: clamp01(dragState.orig.x + dx),
        y: clamp01(dragState.orig.y + dy),
      });
    } else if (dragState.mode === 'resize') {
      const dx = (e.clientX - dragState.startX) / cw;
      const dy = (e.clientY - dragState.startY) / ch;
      updateDraft(dragState.id, {
        w: clamp01(Math.max(0.04, dragState.orig.w + dx)),
        h: clamp01(Math.max(0.04, dragState.orig.h + dy)),
      });
    } else if (dragState.mode === 'rotate') {
      const rect = dragState.el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
      updateDraft(dragState.id, { r: Math.round(angle) });
    }
  }

  function onPointerUp() {
    if (dragState?.el) dragState.el.classList.remove('layout-dragging');
    dragState = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  function attachEditHandlers(canvas) {
    if (canvas.dataset.gameLayoutHandlers === '1') return;
    canvas.dataset.gameLayoutHandlers = '1';

    canvas.addEventListener('pointerdown', (e) => {
      if (!editMode || !draftLayout) return;
      const target = e.target.closest('[data-game-layout-id]');
      if (!target || !canvas.contains(target)) return;

      const isResize = e.target.classList.contains('game-layout-resize-handle');
      const isRotate = e.target.classList.contains('game-layout-rotate-handle');
      if (isResize || isRotate) e.stopPropagation();

      const id = target.dataset.gameLayoutId;
      const box = draftLayout.elements[id];
      if (!box) return;

      let mode = 'move';
      if (isResize) mode = 'resize';
      if (isRotate) mode = 'rotate';

      dragState = {
        id,
        el: target,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        orig: { ...box },
      };
      target.classList.add('layout-dragging');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
    });
  }

  function detachEditHandlers(canvas) {
    if (!canvas) return;
    delete canvas.dataset.gameLayoutHandlers;
  }

  async function enterEditMode() {
    let layout = await fetchGameLayout();
    draftLayout = JSON.parse(JSON.stringify(layout || { version: 1, elements: {} }));

    if (!draftLayout.elements || Object.keys(draftLayout.elements).length < 4) {
      applyLayout(layout || draftLayout, { editing: false });
      await new Promise((r) => requestAnimationFrame(r));
      draftLayout = captureLayoutFromDom();
    }

    editMode = true;
    applyLayout(draftLayout, { editing: true });

    document.getElementById('game-layout-editor-bar')?.classList.remove('hidden');
    document.getElementById('game-layout-edit-hint')?.classList.remove('hidden');
    document.getElementById('btn-game-layout-edit')?.classList.add('hidden');
    const toggleOn = document.getElementById('btn-sandbox-toggle-edit');
    if (toggleOn) toggleOn.textContent = '✓ إيقاف الأدوات';
  }

  function exitEditMode() {
    editMode = false;
    draftLayout = null;
    dragState = null;
    document.getElementById('game-layout-editor-bar')?.classList.add('hidden');
    document.getElementById('game-layout-edit-hint')?.classList.add('hidden');
    document.getElementById('btn-game-layout-edit')?.classList.remove('hidden');
    const toggle = document.getElementById('btn-sandbox-toggle-edit');
    if (toggle) toggle.textContent = '📐 تفعيل الأدوات';
  }

  async function saveLayout() {
    if (!draftLayout && !currentLayout) return;
    try {
      const payload = buildSavePayload();
      const res = await fetch('/api/admin/game-layout', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ layout: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
      exitEditMode();
      applyLayout(data.layout, { editing: false });
      if (typeof showLobbyToast === 'function') showLobbyToast('تم حفظ تخطيط الطاولة');
    } catch (err) {
      alert(err.message);
    }
  }

  async function cancelEdit() {
    exitEditMode();
    const layout = await fetchGameLayout();
    if (layout) applyLayout(layout, { editing: false });
  }

  async function resetLayout() {
    if (!confirm('إعادة ضبط تخطيط الطاولة للافتراضي؟')) return;
    try {
      const res = await fetch('/api/admin/game-layout', {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      draftLayout = JSON.parse(JSON.stringify(data.layout));
      applyLayout(draftLayout, { editing: true });
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadAndApplyGameLayout(cardCount) {
    const layout = await fetchGameLayout();
    if (layout?.elements) {
      currentLayout = layout;
      const count = cardCount ?? currentHandCount();
      requestAnimationFrame(() => applyLayout(resolveLayoutForCards(layout, count), { editing: false }));
    }
  }

  function reapplyGameLayoutForHandCount() {
    if (!currentLayout?.elements) return;
    const count = currentHandCount();
    requestAnimationFrame(() => applyLayout(resolveLayoutForCards(currentLayout, count), { editing: editMode }));
  }

  function updateGameLayoutAdminButton({ sandboxMode = false, isAdmin = false } = {}) {
    const btn = document.getElementById('btn-game-layout-edit');
    if (btn) btn.classList.toggle('hidden', !(isAdmin && sandboxMode && !editMode));
    document.getElementById('game-sandbox-toolbar')?.classList.toggle('hidden', !(isAdmin && sandboxMode));
  }

  let sandboxPreviewCards = 8;
  let sandboxShowProjects = true;
  let sandboxShowBids = true;

  function applySandboxPreviewUI() {
    if (typeof sandboxMode === 'undefined' || !sandboxMode) return;
    const hand = document.getElementById('my-hand');
    if (hand && typeof renderSandboxMockHand === 'function') {
      renderSandboxMockHand(sandboxPreviewCards);
    }
    const projectBar = document.getElementById('project-bar');
    if (projectBar) {
      projectBar.classList.toggle('hidden', !sandboxShowProjects);
      if (sandboxShowProjects && !projectBar.children.length) {
        projectBar.innerHTML = ['سرا', 'خمسين', 'مية', 'أربعمية'].map((p) =>
          `<button type="button" class="project-btn" disabled>${p} (0)</button>`).join('');
        projectBar.classList.remove('hidden');
      }
    }
    const bidBtns = document.getElementById('bid-buttons');
    if (bidBtns) {
      bidBtns.classList.toggle('hidden', !sandboxShowBids);
      if (sandboxShowBids && !bidBtns.children.length) {
        bidBtns.innerHTML = ['صن', 'حكم', 'بس', 'أشكل'].map((l) =>
          `<button type="button" class="bid-btn" disabled>${l}</button>`).join('');
      }
    }
    document.getElementById('btn-sawa')?.classList.remove('hidden');
    document.getElementById('btn-qaid')?.classList.remove('hidden');
  }

  function setSandboxCardPreview(count) {
    sandboxPreviewCards = count;
    for (const n of HAND_VARIANT_KEYS) {
      document.getElementById(`btn-sandbox-cards-${n}`)?.classList.toggle('active', n === String(count));
    }
    if (currentLayout) applyLayout(resolveLayoutForCards(currentLayout, count), { editing: editMode });
    applySandboxPreviewUI();
  }

  function initSandboxToolbar() {
    document.getElementById('btn-sandbox-save')?.addEventListener('click', () => saveLayout());
    document.getElementById('btn-sandbox-toggle-edit')?.addEventListener('click', () => {
      if (editMode) exitEditMode();
      else enterEditMode();
      const btn = document.getElementById('btn-sandbox-toggle-edit');
      if (btn) btn.textContent = editMode ? '✓ إيقاف الأدوات' : '📐 تفعيل الأدوات';
    });
    for (const n of HAND_VARIANT_KEYS) {
      document.getElementById(`btn-sandbox-cards-${n}`)?.addEventListener('click', () => setSandboxCardPreview(Number(n)));
    }
    document.getElementById('btn-sandbox-show-projects')?.addEventListener('click', () => {
      sandboxShowProjects = !sandboxShowProjects;
      document.getElementById('btn-sandbox-show-projects')?.classList.toggle('active', sandboxShowProjects);
      applySandboxPreviewUI();
    });
    document.getElementById('btn-sandbox-show-bids')?.addEventListener('click', () => {
      sandboxShowBids = !sandboxShowBids;
      document.getElementById('btn-sandbox-show-bids')?.classList.toggle('active', sandboxShowBids);
      applySandboxPreviewUI();
    });
  }

  function initGameLayoutEditor() {
    document.getElementById('btn-game-layout-edit')?.addEventListener('click', () => enterEditMode());
    document.getElementById('btn-game-layout-save')?.addEventListener('click', () => saveLayout());
    document.getElementById('btn-game-layout-cancel')?.addEventListener('click', () => cancelEdit());
    document.getElementById('btn-game-layout-reset')?.addEventListener('click', () => resetLayout());
    initSandboxToolbar();
  }

  window.initGameLayoutEditor = initGameLayoutEditor;
  window.loadAndApplyGameLayout = loadAndApplyGameLayout;
  window.reapplyGameLayoutForHandCount = reapplyGameLayoutForHandCount;
  window.updateGameLayoutAdminButton = updateGameLayoutAdminButton;
  window.applySandboxPreviewUI = applySandboxPreviewUI;
  window.resolveLayoutForCards = resolveLayoutForCards;
  window.isGameLayoutEditMode = () => editMode;
})();
