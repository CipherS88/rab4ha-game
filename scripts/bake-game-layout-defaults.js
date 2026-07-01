/**
 * يدمج data/game-layout.json في القيم الافتراضية المضمّنة (سيرفر + Flutter).
 * شغّله بعد حفظ تخطيط جديد من الـ sandbox ليعتمد المشروع عليه.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LAYOUT_PATH = path.join(ROOT, 'data', 'game-layout.json');
const SERVER_PATH = path.join(ROOT, 'server', 'gameLayout.js');
const FLUTTER_PATH = path.join(ROOT, 'rab4ha_flutter', 'lib', 'features', 'game', 'game_layout.dart');
const HAND_VARIANT_KEYS = ['5', '6', '7', '8'];

function round(n) {
  return Math.round(n * 10000) / 10000;
}

function boxJs(b) {
  return `{ x: ${round(b.x)}, y: ${round(b.y)}, w: ${round(b.w)}, h: ${round(b.h)}, r: ${round(b.r || 0)} }`;
}

function boxDart(b) {
  return `GameLayoutBox(x: ${round(b.x)}, y: ${round(b.y)}, w: ${round(b.w)}, h: ${round(b.h)}${b.r ? `, r: ${round(b.r)}` : ''})`;
}

function variantJs(v) {
  const elems = v.elements || {};
  const lines = Object.entries(elems)
    .map(([id, b]) => `    ${id}: ${boxJs(b)},`)
    .join('\n');
  return `{
  elements: {
${lines}
  },
  hand_card_gap: ${round(v.hand_card_gap ?? 1)},
  hand_card_scale: ${round(v.hand_card_scale ?? 1)},
}`;
}

function variantDart(v) {
  const elems = v.elements || {};
  const lines = Object.entries(elems)
    .map(([id, b]) => `        '${id}': ${boxDart(b)},`)
    .join('\n');
  return `HandVariant(
      elements: {
${lines}
      },
      handCardGap: ${round(v.hand_card_gap ?? 1)},
      handCardScale: ${round(v.hand_card_scale ?? 1)},
    )`;
}

function main() {
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('Missing', LAYOUT_PATH);
    process.exit(1);
  }
  const L = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf8'));
  const tuning = L.tuning || {};
  const elements = L.elements || {};
  const variants = L.variants || {};
  const v5 = variants['5'] || {};
  const v8 = variants['8'] || {};

  // --- server/gameLayout.js ---
  let server = fs.readFileSync(SERVER_PATH, 'utf8');

  const defaultTuning = `const DEFAULT_TUNING = {
  floor_card_scale: ${round(tuning.floor_card_scale ?? 1)},
  opponent_card_scale: ${round(tuning.opponent_card_scale ?? 1)},
  opponent_card_overlap: ${round(tuning.opponent_card_overlap ?? 1)},
};`;

  server = server.replace(
    /const DEFAULT_TUNING = \{[\s\S]*?\};/,
    defaultTuning,
  );

  server = server.replace(
    /const VARIANT_5 = \{[\s\S]*?\};/,
    `const VARIANT_5 = ${variantJs(v5)};`,
  );

  server = server.replace(
    /const VARIANT_8 = \{[\s\S]*?\};/,
    `const VARIANT_8 = ${variantJs(v8)};`,
  );

  const elemLines = Object.entries(elements)
    .map(([id, b]) => `    ${id}: ${boxJs(b)},`)
    .join('\n');

  server = server.replace(
    /const DEFAULT_LAYOUT = \{[\s\S]*?variants: DEFAULT_VARIANTS,\r?\n\};/,
    `const DEFAULT_LAYOUT = {
  version: 3,
  tuning: DEFAULT_TUNING,
  elements: {
${elemLines}
  },
  variants: DEFAULT_VARIANTS,
};`,
  );

  fs.writeFileSync(SERVER_PATH, server, 'utf8');
  console.log('Updated', SERVER_PATH);

  // --- Flutter game_layout.dart ---
  let dart = fs.readFileSync(FLUTTER_PATH, 'utf8');

  dart = dart.replace(
    /static HandVariant _defaults5\(\) \{[\s\S]*?\n  \}/,
    `static HandVariant _defaults5() {
    return ${variantDart(v5)};
  }`,
  );

  dart = dart.replace(
    /static HandVariant _defaults8\(\) \{[\s\S]*?\n  \}/,
    `static HandVariant _defaults8() {
    return ${variantDart(v8)};
  }`,
  );

  const dartElemLines = Object.entries(elements)
    .map(([id, b]) => `      '${id}': ${boxDart(b)},`)
    .join('\n');

  dart = dart.replace(
    /static final defaults = GameLayoutConfig\([\s\S]*?variants: defaultVariants\(\),\r?\n  \);/,
    `static final defaults = GameLayoutConfig(
    tuning: GameLayoutTuning(
      floorCardScale: ${round(tuning.floor_card_scale ?? 1)},
      opponentCardScale: ${round(tuning.opponent_card_scale ?? 1)},
      opponentCardOverlap: ${round(tuning.opponent_card_overlap ?? 1)},
    ),
    elements: {
${dartElemLines}
    },
    variants: defaultVariants(),
  );`,
  );

  fs.writeFileSync(FLUTTER_PATH, dart, 'utf8');
  console.log('Updated', FLUTTER_PATH);
  console.log('Done — baked layout from', LAYOUT_PATH);
  console.log('Variant keys:', HAND_VARIANT_KEYS.join(', '));
}

main();
