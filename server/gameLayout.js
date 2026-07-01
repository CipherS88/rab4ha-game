const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LAYOUT_PATH = path.join(__dirname, '..', 'data', 'game-layout.json');

const HAND_ELEMENT_IDS = ['my_hand', 'bid_buttons', 'project_bar'];
const HAND_VARIANT_KEYS = ['5', '6', '7', '8'];

function variantKeyForCount(handCount) {
  if (handCount <= 5) return '5';
  if (handCount >= 8) return '8';
  return String(handCount);
}

function lerpNum(a, b, t) {
  return a + (b - a) * t;
}

function lerpBox(a, b, t) {
  return {
    x: lerpNum(a.x, b.x, t),
    y: lerpNum(a.y, b.y, t),
    w: lerpNum(a.w, b.w, t),
    h: lerpNum(a.h, b.h, t),
    r: 0,
  };
}

function lerpVariant(va, vb, t) {
  const elements = {};
  for (const id of HAND_ELEMENT_IDS) {
    elements[id] = lerpBox(va.elements[id], vb.elements[id], t);
  }
  return {
    elements,
    hand_card_gap: lerpNum(va.hand_card_gap, vb.hand_card_gap, t),
    hand_card_scale: lerpNum(va.hand_card_scale, vb.hand_card_scale, t),
  };
}

const VARIANT_5 = {
  elements: {
    my_hand: { x: 0.0102, y: 0.817, w: 1, h: 0.1908, r: 0 },
    bid_buttons: { x: 0.2121, y: 0.6501, w: 0.5911, h: 0.0454, r: 0 },
    project_bar: { x: 0, y: 0.5374, w: 0.9974, h: 0.0691, r: 0 },
  },
  hand_card_gap: 0.6,
  hand_card_scale: 1.48,
};

const VARIANT_8 = {
  elements: {
    my_hand: { x: 0.0128, y: 0.8156, w: 1, h: 0.1908, r: 0 },
    bid_buttons: { x: 0.1687, y: 0.6416, w: 0.6116, h: 0.0478, r: 0 },
    project_bar: { x: 0.0051, y: 0.6436, w: 0.974, h: 0.04, r: 0 },
  },
  hand_card_gap: 0.68,
  hand_card_scale: 1.32,
};

function defaultVariant(key) {
  if (key === '5') return VARIANT_5;
  if (key === '8') return VARIANT_8;
  if (key === '6') return lerpVariant(VARIANT_5, VARIANT_8, 1 / 3);
  if (key === '7') return lerpVariant(VARIANT_5, VARIANT_8, 2 / 3);
  return VARIANT_8;
}

const DEFAULT_VARIANTS = Object.fromEntries(
  HAND_VARIANT_KEYS.map((k) => [k, defaultVariant(k)]),
);

const DEFAULT_TUNING = {
  floor_card_scale: 1.48,
  opponent_card_scale: 1.4,
  opponent_card_overlap: 2.52,
};

const DEFAULT_LAYOUT = {
  version: 3,
  tuning: DEFAULT_TUNING,
  elements: {
    score_bar: { x: 0.202, y: 0, w: 0.6214, h: 0.0603, r: 0 },
    table_center: { x: 0.294, y: 0.3078, w: 0.4095, h: 0.2308, r: 0 },
    floor_card: { x: 0.321, y: 0.3171, w: 0.3595, h: 0.2139, r: 0 },
    btn_sawa: { x: 0.8692, y: 0.5841, w: 0.1391, h: 0.056, r: 0 },
    btn_qaid: { x: 0, y: 0.5871, w: 0.1394, h: 0.056, r: 0 },
    side_utils: { x: 0.8782, y: 0, w: 0.1306, h: 0.1137, r: 0 },
    back_btn: { x: 0, y: 0, w: 0.175, h: 0.0629, r: 0 },
    seat_top_avatar: { x: 0.405, y: 0.0554, w: 0.2, h: 0.1, r: 0 },
    seat_top_cards: { x: 0.2192, y: 0.0102, w: 0.5613, h: 0.115, r: 0 },
    seat_top_gifts: { x: 0.3767, y: 0.1772, w: 0.28, h: 0.04, r: 0 },
    seat_top_name: { x: 0.4002, y: 0.1274, w: 0.2149, h: 0.0577, r: 0 },
    seat_left_avatar: { x: 0.0252, y: 0.3571, w: 0.16, h: 0.1, r: 0 },
    seat_left_cards: { x: 0, y: 0.2838, w: 0.2076, h: 0.147, r: 0 },
    seat_left_gifts: { x: 0.0225, y: 0.4396, w: 0.16, h: 0.04, r: 0 },
    seat_left_name: { x: 0, y: 0.4727, w: 0.1976, h: 0.0553, r: 0 },
    seat_right_avatar: { x: 0.8025, y: 0.338, w: 0.18, h: 0.1127, r: 0 },
    seat_right_cards: { x: 0.7783, y: 0.2798, w: 0.2256, h: 0.1493, r: 0 },
    seat_right_gifts: { x: 0.8125, y: 0.4442, w: 0.16, h: 0.04, r: 0 },
    seat_right_name: { x: 0.795, y: 0.4808, w: 0.1999, h: 0.0541, r: 0 },
    seat_bottom_avatar: { x: 0.4168, y: 0.7086, w: 0.1833, h: 0.0747, r: 0 },
    seat_bottom_gifts: { x: 0.2378, y: 0.7248, w: 0.1825, h: 0.04, r: 0 },
    seat_bottom_name: { x: 0.6024, y: 0.714, w: 0.2004, h: 0.0478, r: 0 },
  },
  variants: DEFAULT_VARIANTS,
};

const ELEMENT_IDS = [
  ...Object.keys(DEFAULT_LAYOUT.elements),
  ...HAND_ELEMENT_IDS,
];

function mergeTuning(tuning) {
  return { ...DEFAULT_TUNING, ...(tuning || {}) };
}

function mergeVariant(raw, key) {
  const base = defaultVariant(key);
  const v = raw?.[key] || {};
  const elements = { ...base.elements };
  for (const id of HAND_ELEMENT_IDS) {
    if (v.elements?.[id]) elements[id] = { ...base.elements[id], ...v.elements[id], r: v.elements[id].r ?? 0 };
    else if (v[id]) elements[id] = { ...base.elements[id], ...v[id], r: v[id].r ?? 0 };
  }
  return {
    elements,
    hand_card_gap: Number(v.hand_card_gap ?? base.hand_card_gap),
    hand_card_scale: Number(v.hand_card_scale ?? base.hand_card_scale),
  };
}

function migrateLegacyLayout(parsed) {
  if (parsed.variants && Object.keys(parsed.variants).length > 0) return parsed;
  const variants = { '5': defaultVariant('5'), '8': defaultVariant('8') };
  for (const key of HAND_VARIANT_KEYS) {
    const legacy = {};
    for (const id of HAND_ELEMENT_IDS) {
      if (parsed.elements?.[id]) legacy[id] = { ...parsed.elements[id] };
    }
    if (Object.keys(legacy).length) {
      variants[key].elements = { ...variants[key].elements, ...legacy };
    }
    const t = parsed.tuning || {};
    if (t.hand_card_gap != null) variants[key].hand_card_gap = t.hand_card_gap;
    if (t.hand_card_scale != null) variants[key].hand_card_scale = t.hand_card_scale;
  }
  const elements = { ...(parsed.elements || {}) };
  for (const id of HAND_ELEMENT_IDS) delete elements[id];
  const tuning = { ...DEFAULT_TUNING, ...(parsed.tuning || {}) };
  delete tuning.hand_card_gap;
  delete tuning.hand_card_scale;
  return { ...parsed, version: 3, elements, tuning, variants };
}

function mergeLayoutDefaults(layout) {
  const migrated = migrateLegacyLayout(layout || {});
  const base = { ...(migrated.elements || {}) };
  for (const [id, box] of Object.entries(DEFAULT_LAYOUT.elements)) {
    if (!base[id]) base[id] = { ...box };
    else {
      base[id] = {
        x: base[id].x ?? box.x,
        y: base[id].y ?? box.y,
        w: base[id].w ?? box.w,
        h: base[id].h ?? box.h,
        r: base[id].r ?? box.r ?? 0,
      };
    }
  }
  const variants = Object.fromEntries(
    HAND_VARIANT_KEYS.map((key) => [key, mergeVariant(migrated.variants, key)]),
  );
  return {
    version: 3,
    tuning: mergeTuning(migrated.tuning),
    elements: base,
    variants,
  };
}

function resolveForHandCount(layout, handCount) {
  const merged = mergeLayoutDefaults(layout);
  const key = variantKeyForCount(handCount);
  const v = merged.variants[key];
  const elements = { ...merged.elements, ...v.elements };
  return {
    ...merged,
    elements,
    hand_card_gap: v.hand_card_gap,
    hand_card_scale: v.hand_card_scale,
  };
}

function readLayoutFile() {
  try {
    if (!fs.existsSync(LAYOUT_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function getGameLayout() {
  const saved = readLayoutFile();
  if (saved?.elements && Object.keys(saved.elements).length > 0) {
    return mergeLayoutDefaults(saved);
  }
  return DEFAULT_LAYOUT;
}

function saveGameLayout(layout) {
  if (!layout || typeof layout !== 'object') {
    return { error: 'تخطيط غير صالح' };
  }
  const merged = mergeLayoutDefaults(layout);
  const elements = { ...merged.elements };
  for (const key of Object.keys(elements)) {
    const el = elements[key];
    if (!el || typeof el !== 'object') continue;
    for (const k of ['x', 'y', 'w', 'h']) {
      const n = Number(el[k]);
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        return { error: `قيمة غير صالحة للعنصر ${key}` };
      }
    }
    const r = Number(el.r ?? 0);
    if (!Number.isFinite(r) || r < -360 || r > 360) {
      return { error: `زاوية غير صالحة للعنصر ${key}` };
    }
    elements[key] = { ...el, r };
  }
  fs.mkdirSync(path.dirname(LAYOUT_PATH), { recursive: true });
  const payload = {
    version: 3,
    updated_at: new Date().toISOString(),
    tuning: merged.tuning,
    elements,
    variants: merged.variants,
  };
  fs.writeFileSync(LAYOUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  bakeLayoutDefaultsToSource();
  return { ok: true, layout: payload };
}

function bakeLayoutDefaultsToSource() {
  try {
    const script = path.join(__dirname, '..', 'scripts', 'bake-game-layout-defaults.js');
    if (!fs.existsSync(script)) return;
    execFileSync(process.execPath, [script], {
      cwd: path.join(__dirname, '..'),
      stdio: 'ignore',
    });
  } catch (_) {}
}

function resetGameLayout() {
  if (fs.existsSync(LAYOUT_PATH)) fs.unlinkSync(LAYOUT_PATH);
  return { ok: true, layout: DEFAULT_LAYOUT };
}

module.exports = {
  DEFAULT_LAYOUT,
  ELEMENT_IDS,
  HAND_ELEMENT_IDS,
  getGameLayout,
  saveGameLayout,
  resetGameLayout,
  resolveForHandCount,
  variantKeyForCount,
  HAND_VARIANT_KEYS,
};
