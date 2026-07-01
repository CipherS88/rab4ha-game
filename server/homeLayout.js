const fs = require('fs');
const path = require('path');

const LAYOUT_PATH = path.join(__dirname, '..', 'data', 'home-layout.json');

const DEFAULT_LAYOUT = {
  version: 1,
  elements: {
    settings: { x: 0.02, y: 0.0, w: 0.12, h: 0.055 },
    identity: { x: 0.04, y: 0.2, w: 0.28, h: 0.12 },
    avatar: { x: 0.34, y: 0.22, w: 0.2, h: 0.13 },
    deck: { x: 0.52, y: 0.28, w: 0.12, h: 0.11 },
    stats: { x: 0.68, y: 0.2, w: 0.28, h: 0.12 },
    ranked: { x: 0.04, y: 0.4, w: 0.92, h: 0.105 },
    tournaments: { x: 0.04, y: 0.54, w: 0.211, h: 0.165 },
    leaderboards: { x: 0.276, y: 0.54, w: 0.211, h: 0.165 },
    friendly: { x: 0.512, y: 0.54, w: 0.211, h: 0.165 },
    sessions: { x: 0.748, y: 0.54, w: 0.211, h: 0.165 },
  },
};

function mergeLayoutDefaults(layout) {
  const base = layout?.elements ? { ...layout.elements } : {};
  for (const [id, box] of Object.entries(DEFAULT_LAYOUT.elements)) {
    if (!base[id]) base[id] = { ...box };
  }
  if (layout?.elements?.avatar && !layout.elements.deck) {
    const a = layout.elements.avatar;
    base.avatar = {
      x: a.x + a.w * 0.12,
      y: a.y + a.h * 0.08,
      w: Math.min(a.w * 0.52, 0.22),
      h: Math.min(a.h * 0.72, 0.14),
    };
    base.deck = {
      x: a.x + a.w * 0.58,
      y: a.y + a.h * 0.22,
      w: Math.min(a.w * 0.38, 0.14),
      h: Math.min(a.h * 0.55, 0.11),
    };
  }
  return { version: layout?.version || 1, elements: base };
}

function readLayoutFile() {
  try {
    if (!fs.existsSync(LAYOUT_PATH)) return null;
    const raw = fs.readFileSync(LAYOUT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function getHomeLayout() {
  const saved = readLayoutFile();
  if (saved?.elements && Object.keys(saved.elements).length > 0) {
    return mergeLayoutDefaults(saved);
  }
  return DEFAULT_LAYOUT;
}

function normalizeLayoutElements(elements) {
  const cubeIds = ['tournaments', 'leaderboards', 'friendly', 'sessions'];
  const y = 0.54;
  const w = 0.211;
  const h = 0.165;
  const xs = [0.04, 0.276, 0.512, 0.748];
  const next = { ...elements };
  cubeIds.forEach((id, i) => {
    if (next[id]) next[id] = { x: xs[i], y, w, h };
  });
  if (next.ranked) {
    next.ranked = {
      x: 0.04,
      y: next.ranked.y ?? 0.38,
      w: 0.92,
      h: 0.105,
    };
  }
  return next;
}

function saveHomeLayout(layout) {
  if (!layout || typeof layout !== 'object') {
    return { error: 'تخطيط غير صالح' };
  }
  const elements = normalizeLayoutElements(layout.elements || {});
  for (const key of Object.keys(elements)) {
    const el = elements[key];
    if (!el || typeof el !== 'object') continue;
    for (const k of ['x', 'y', 'w', 'h']) {
      const n = Number(el[k]);
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        return { error: `قيمة غير صالحة للعنصر ${key}` };
      }
    }
  }
  fs.mkdirSync(path.dirname(LAYOUT_PATH), { recursive: true });
  const payload = {
    version: layout.version || 1,
    updated_at: new Date().toISOString(),
    elements,
  };
  fs.writeFileSync(LAYOUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, layout: payload };
}

function resetHomeLayout() {
  if (fs.existsSync(LAYOUT_PATH)) fs.unlinkSync(LAYOUT_PATH);
  return { ok: true, layout: DEFAULT_LAYOUT };
}

module.exports = {
  DEFAULT_LAYOUT,
  getHomeLayout,
  saveHomeLayout,
  resetHomeLayout,
};
