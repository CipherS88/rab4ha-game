/**
 * محرّر تخطيط الشاشة الرئيسية — للأدمن فقط
 */
(function () {
  const LAYOUT_IDS = [
    'settings', 'stats', 'avatar', 'deck', 'identity', 'ranked',
    'friendly', 'tournaments', 'leaderboards', 'sessions',
  ];

  let editMode = false;
  let currentLayout = null;
  let draftLayout = null;
  let dragState = null;

  function canvasEl() {
    return document.getElementById('home-layout-canvas');
  }

  function authHeaders() {
    const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  async function fetchHomeLayout() {
    try {
      const res = await fetch('/api/home-layout');
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

  function applyLayout(layout, { editing = false } = {}) {
    const canvas = canvasEl();
    if (!canvas || !layout?.elements) return;

    currentLayout = layout;
    canvas.classList.add('home-custom-layout');
    if (editing) canvas.classList.add('home-edit-mode');
    else canvas.classList.remove('home-edit-mode');

    for (const id of LAYOUT_IDS) {
      const el = canvas.querySelector(`[data-home-layout-id="${id}"]`);
      const box = layout.elements[id];
      if (!el || !box) continue;

      el.style.left = `${box.x * 100}%`;
      el.style.top = `${box.y * 100}%`;
      el.style.width = `${box.w * 100}%`;
      el.style.height = `${box.h * 100}%`;

      let handle = el.querySelector('.home-layout-resize-handle');
      if (editing) {
        if (!handle) {
          handle = document.createElement('span');
          handle.className = 'home-layout-resize-handle';
          handle.setAttribute('aria-hidden', 'true');
          el.appendChild(handle);
        }
      } else if (handle) {
        handle.remove();
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
      const el = canvas.querySelector(`[data-home-layout-id="${id}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      elements[id] = {
        x: clamp01((r.left - cRect.left) / cw),
        y: clamp01((r.top - cRect.top) / ch),
        w: clamp01(r.width / cw),
        h: clamp01(r.height / ch),
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
    const dx = (e.clientX - dragState.startX) / cw;
    const dy = (e.clientY - dragState.startY) / ch;
    const el = draftLayout.elements[dragState.id];
    if (!el) return;

    if (dragState.mode === 'move') {
      updateDraft(dragState.id, {
        x: clamp01(dragState.orig.x + dx),
        y: clamp01(dragState.orig.y + dy),
      });
    } else {
      updateDraft(dragState.id, {
        w: clamp01(Math.max(0.06, dragState.orig.w + dx)),
        h: clamp01(Math.max(0.05, dragState.orig.h + dy)),
      });
    }
  }

  function onPointerUp() {
    if (dragState?.el) dragState.el.classList.remove('layout-dragging');
    dragState = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  function attachEditHandlers(canvas) {
    if (canvas.dataset.layoutHandlers === '1') return;
    canvas.dataset.layoutHandlers = '1';

    canvas.addEventListener('pointerdown', (e) => {
      if (!editMode || !draftLayout) return;
      const target = e.target.closest('[data-home-layout-id]');
      if (!target || !canvas.contains(target)) return;

      const isResize = e.target.classList.contains('home-layout-resize-handle');
      if (isResize) e.stopPropagation();

      const id = target.dataset.homeLayoutId;
      const el = draftLayout.elements[id];
      if (!el) return;

      dragState = {
        id,
        el: target,
        mode: isResize ? 'resize' : 'move',
        startX: e.clientX,
        startY: e.clientY,
        orig: { ...el },
      };
      target.classList.add('layout-dragging');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      e.preventDefault();
    });
  }

  function detachEditHandlers(canvas) {
    if (!canvas) return;
    delete canvas.dataset.layoutHandlers;
  }

  async function enterEditMode() {
    let layout = await fetchHomeLayout();
    draftLayout = JSON.parse(JSON.stringify(layout || { version: 1, elements: {} }));

    if (!draftLayout.elements || Object.keys(draftLayout.elements).length < LAYOUT_IDS.length) {
      applyLayout(layout || draftLayout, { editing: false });
      await new Promise((r) => requestAnimationFrame(r));
      draftLayout = captureLayoutFromDom();
    }

    editMode = true;
    applyLayout(draftLayout, { editing: true });

    document.getElementById('home-layout-editor-bar')?.classList.remove('hidden');
    document.getElementById('home-layout-edit-hint')?.classList.remove('hidden');
    setHomeAdminBarVisible(false);
  }

  function exitEditMode() {
    editMode = false;
    draftLayout = null;
    dragState = null;
    document.getElementById('home-layout-editor-bar')?.classList.add('hidden');
    document.getElementById('home-layout-edit-hint')?.classList.add('hidden');
    const admin = typeof isAdmin === 'function' ? isAdmin() : false;
    setHomeAdminBarVisible(admin);
  }

  function setHomeAdminBarVisible(visible) {
    document.getElementById('home-admin-bar')?.classList.toggle('hidden', !visible);
  }

  function normalizeLayout(layout) {
    if (!layout?.elements) return layout;
    const cubeIds = ['tournaments', 'leaderboards', 'friendly', 'sessions'];
    const y = 0.54;
    const w = 0.211;
    const h = 0.165;
    const xs = [0.04, 0.276, 0.512, 0.748];
    cubeIds.forEach((id, i) => {
      if (layout.elements[id]) {
        layout.elements[id] = { x: xs[i], y, w, h };
      }
    });
    if (layout.elements.ranked) {
      layout.elements.ranked = {
        x: 0.04,
        y: layout.elements.ranked.y ?? 0.38,
        w: 0.92,
        h: 0.105,
      };
    }
    return layout;
  }

  async function saveLayout() {
    if (!draftLayout) return;
    normalizeLayout(draftLayout);
    try {
      const res = await fetch('/api/admin/home-layout', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ layout: draftLayout }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
      currentLayout = data.layout || draftLayout;
      exitEditMode();
      applyLayout(currentLayout, { editing: false });
      if (typeof showHomeToast === 'function') showHomeToast('تم حفظ التخطيط');
    } catch (err) {
      if (typeof showHomeToast === 'function') showHomeToast(err.message || 'فشل الحفظ');
    }
  }

  function cancelEdit() {
    exitEditMode();
    if (currentLayout) applyLayout(currentLayout, { editing: false });
    else loadAndApplyHomeLayout();
  }

  async function resetLayout() {
    if (!confirm('إعادة التخطيط للوضع الافتراضي؟')) return;
    try {
      const res = await fetch('/api/admin/home-layout', {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل');
      draftLayout = JSON.parse(JSON.stringify(data.layout));
      applyLayout(draftLayout, { editing: true });
      if (typeof showHomeToast === 'function') showHomeToast('تم إعادة الضبط — اضغط حفظ');
    } catch (err) {
      if (typeof showHomeToast === 'function') showHomeToast(err.message || 'فشل');
    }
  }

  async function loadAndApplyHomeLayout() {
    const layout = await fetchHomeLayout();
    if (layout?.elements) {
      requestAnimationFrame(() => applyLayout(layout, { editing: false }));
    }
  }

  function initHomeLayoutEditor() {
    document.getElementById('btn-home-layout-edit')?.addEventListener('click', () => enterEditMode());
    document.getElementById('btn-home-layout-save')?.addEventListener('click', () => saveLayout());
    document.getElementById('btn-home-layout-cancel')?.addEventListener('click', () => cancelEdit());
    document.getElementById('btn-home-layout-reset')?.addEventListener('click', () => resetLayout());
    loadAndApplyHomeLayout();
  }

  function updateHomeLayoutAdminButton(profile) {
    const admin = typeof isAdmin === 'function'
      ? isAdmin()
      : profile?.is_admin || profile?.role === 'admin';
    if (!editMode) setHomeAdminBarVisible(admin);
  }

  window.initHomeLayoutEditor = initHomeLayoutEditor;
  window.loadAndApplyHomeLayout = loadAndApplyHomeLayout;
  window.updateHomeLayoutAdminButton = updateHomeLayoutAdminButton;
})();
