/** نظام التصنيف — نسخة العميل */

const RANKS = [
  { id: 'beginner', name: 'مبتدئ', theme: 'wood' },
  { id: 'intermediate', name: 'متوسط', theme: 'silver' },
  { id: 'advanced', name: 'متقدم', theme: 'gold' },
  { id: 'pro', name: 'محترف', theme: 'green' },
  { id: 'expert', name: 'خبير', theme: 'ruby' },
  { id: 'genius', name: 'نابغ', theme: 'genius' },
];

const SUB_SUIT_LABELS = ['♣️', '♣️♦️', '♣️♦️♠️', '♣️♦️♠️♥️'];

const RANK_THEMES = {
  wood: {
    '--rank-primary': '#8B5A2B',
    '--rank-secondary': '#D4A574',
    '--rank-glow': 'rgba(139, 90, 43, 0.45)',
    '--rank-text': '#FEF3C7',
    '--rank-btn-bg': 'linear-gradient(145deg, #A0522D 0%, #6B3A1F 100%)',
    '--rank-banner': 'linear-gradient(135deg, #5D3A1A 0%, #8B5A2B 50%, #C49A6C 100%)',
  },
  silver: {
    '--rank-primary': '#94A3B8',
    '--rank-secondary': '#E2E8F0',
    '--rank-glow': 'rgba(148, 163, 184, 0.5)',
    '--rank-text': '#F8FAFC',
    '--rank-btn-bg': 'linear-gradient(145deg, #CBD5E1 0%, #64748B 100%)',
    '--rank-banner': 'linear-gradient(135deg, #475569 0%, #94A3B8 50%, #E2E8F0 100%)',
  },
  gold: {
    '--rank-primary': '#EAB308',
    '--rank-secondary': '#FDE047',
    '--rank-glow': 'rgba(234, 179, 8, 0.5)',
    '--rank-text': '#1E293B',
    '--rank-btn-bg': 'linear-gradient(145deg, #FDE047 0%, #CA8A04 100%)',
    '--rank-banner': 'linear-gradient(135deg, #854D0E 0%, #EAB308 50%, #FEF08A 100%)',
  },
  green: {
    '--rank-primary': '#22C55E',
    '--rank-secondary': '#86EFAC',
    '--rank-glow': 'rgba(34, 197, 94, 0.45)',
    '--rank-text': '#F0FDF4',
    '--rank-btn-bg': 'linear-gradient(145deg, #4ADE80 0%, #15803D 100%)',
    '--rank-banner': 'linear-gradient(135deg, #14532D 0%, #22C55E 50%, #86EFAC 100%)',
  },
  ruby: {
    '--rank-primary': '#E11D48',
    '--rank-secondary': '#FB7185',
    '--rank-glow': 'rgba(225, 29, 72, 0.5)',
    '--rank-text': '#FFF1F2',
    '--rank-btn-bg': 'linear-gradient(145deg, #FB7185 0%, #9F1239 100%)',
    '--rank-banner': 'linear-gradient(135deg, #881337 0%, #E11D48 50%, #FDA4AF 100%)',
  },
  genius: {
    '--rank-primary': '#FFD700',
    '--rank-secondary': '#1A1A1A',
    '--rank-glow': 'rgba(255, 215, 0, 0.55)',
    '--rank-text': '#FFD700',
    '--rank-btn-bg': 'linear-gradient(145deg, #FFD700 0%, #1A1A1A 55%, #FFD700 100%)',
    '--rank-banner': 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 40%, #B8860B 70%, #FFD700 100%)',
  },
};

function applyRankTheme(el, theme) {
  const vars = RANK_THEMES[theme] || RANK_THEMES.wood;
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
}

function formatCoins(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function getRankInfoClient(rank, subRank) {
  const r = RANKS[Math.max(0, Math.min(RANKS.length - 1, rank ?? 0))] || RANKS[0];
  const s = Math.max(0, Math.min(SUB_SUIT_LABELS.length - 1, subRank ?? 0));
  return {
    ...r,
    subLabel: SUB_SUIT_LABELS[s],
    fullLabel: `${r.name} ${SUB_SUIT_LABELS[s]}`,
  };
}

function getNextRankClient(rank, subRank) {
  const r = rank ?? 0;
  const s = subRank ?? 0;
  const maxR = RANKS.length - 1;
  const maxS = SUB_SUIT_LABELS.length - 1;
  if (r >= maxR && s >= maxS) return null;
  if (s < maxS) return getRankInfoClient(r, s + 1);
  return getRankInfoClient(r + 1, 0);
}

/** يكمّل حقول التصنيف إذا ناقصة من السيرفر */
function normalizeProfileRanks(profile) {
  if (!profile) return null;
  const info = profile.rankInfo || getRankInfoClient(profile.rank, profile.sub_rank);
  const points = profile.rank_points ?? 0;
  const next = getNextRankClient(profile.rank ?? 0, profile.sub_rank ?? 0);
  return {
    ...profile,
    rankInfo: info,
    rankLabel: profile.rankLabel || info.fullLabel,
    rankTheme: profile.rankTheme || info.theme,
    nextRankLabel: profile.nextRankLabel || next?.fullLabel || 'أعلى تصنيف',
    progressPercent: profile.progressPercent ?? Math.round((points / 100) * 100),
    pointsToNext: profile.pointsToNext ?? (100 - points),
    radarStats: profile.radarStats || {
      fair: 55, buy: 55, qaid: 50, kaboot: 50, speed: 55, projects: 50,
    },
  };
}

function renderStars(container, count, max = 5) {
  container.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const s = document.createElement('span');
    s.className = 'champ-star' + (i < count ? ' filled' : '');
    s.textContent = '★';
    container.appendChild(s);
  }
}
