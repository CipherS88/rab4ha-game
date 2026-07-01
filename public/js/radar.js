/** رادار المهارات — مشترك بين المصنّف والشات */

const RADAR_AXES = [
  { key: 'fair', label: 'الغش' },
  { key: 'buy', label: 'الشراء' },
  { key: 'qaid', label: 'القيد' },
  { key: 'kaboot', label: 'الكبوت' },
  { key: 'speed', label: 'السرعة' },
  { key: 'projects', label: 'المشاريع' },
];

function drawRadarChart(svg, stats) {
  if (!svg) return;
  const cx = 140;
  const cy = 140;
  const maxR = 88;
  const levels = 4;
  const n = RADAR_AXES.length;
  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2;

  function pointAt(i, radius) {
    const a = startAngle + i * angleStep;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }

  let html = '';
  for (let lv = 1; lv <= levels; lv++) {
    const r = (maxR * lv) / levels;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(pointAt(i, r));
    html += `<polygon class="grid-line" points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" />`;
  }
  for (let i = 0; i < n; i++) {
    const p = pointAt(i, maxR);
    html += `<line class="grid-line" x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" />`;
  }
  const statPts = [];
  for (let i = 0; i < n; i++) {
    const val = Math.max(0, Math.min(100, stats[RADAR_AXES[i].key] ?? 0));
    const p = pointAt(i, (val / 100) * maxR);
    statPts.push(`${p.x},${p.y}`);
  }
  html += `<polygon class="stat-area" points="${statPts.join(' ')}" />`;
  for (let i = 0; i < n; i++) {
    const labelR = maxR + 22;
    const p = pointAt(i, labelR);
    const anchor = p.x < cx - 10 ? 'end' : p.x > cx + 10 ? 'start' : 'middle';
    html += `<text class="axis-label" x="${p.x}" y="${p.y + 4}" text-anchor="${anchor}">${RADAR_AXES[i].label}</text>`;
  }
  svg.innerHTML = html;
}

window.RADAR_AXES = RADAR_AXES;
window.drawRadarChart = drawRadarChart;
