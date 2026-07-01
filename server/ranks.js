/** نظام التصنيف — 6 رانكات × 4 sub-ranks = 24 مستوى */

const RANKS = [
  { id: 'beginner', name: 'مبتدئ', theme: 'wood' },
  { id: 'intermediate', name: 'متوسط', theme: 'silver' },
  { id: 'advanced', name: 'متقدم', theme: 'gold' },
  { id: 'pro', name: 'محترف', theme: 'green' },
  { id: 'expert', name: 'خبير', theme: 'ruby' },
  { id: 'genius', name: 'نابغ', theme: 'genius' },
];

const SUB_SUIT_LABELS = ['♣️', '♣️♦️', '♣️♦️♠️', '♣️♦️♠️♥️'];
const POINTS_WIN = 20;
const POINTS_LOSS = 30;
const FORFEIT_PENALTY = 100;
const FORFEIT_WIN_POINTS = 10;
const REDUCED_WIN_POINTS = 10;
const POINTS_PER_TIER = 100;
const MAX_RANK = RANKS.length - 1;
const MAX_SUB = SUB_SUIT_LABELS.length - 1;

function clampTier(rank, subRank, points) {
  let r = Math.max(0, Math.min(MAX_RANK, rank));
  let s = Math.max(0, Math.min(MAX_SUB, subRank));
  let p = Math.max(0, Math.min(POINTS_PER_TIER - 1, points));
  if (r === MAX_RANK && s === MAX_SUB) p = Math.min(p, POINTS_PER_TIER - 1);
  return { rank: r, sub_rank: s, rank_points: p };
}

function getRankInfo(rank, subRank) {
  const r = RANKS[Math.max(0, Math.min(MAX_RANK, rank))] || RANKS[0];
  const s = Math.max(0, Math.min(MAX_SUB, subRank));
  return {
    ...r,
    rankIndex: Math.max(0, Math.min(MAX_RANK, rank)),
    subRank: s,
    subLabel: SUB_SUIT_LABELS[s],
    fullLabel: `${r.name} ${SUB_SUIT_LABELS[s]}`,
  };
}

function stepDownTier(rank, sub_rank, rank_points) {
  if (rank_points > 0) return { rank, sub_rank, rank_points: 0 };
  if (sub_rank > 0) return { rank, sub_rank: sub_rank - 1, rank_points: POINTS_PER_TIER - 1 };
  if (rank > 0) return { rank: rank - 1, sub_rank: MAX_SUB, rank_points: POINTS_PER_TIER - 1 };
  return { rank: 0, sub_rank: 0, rank_points: 0 };
}

function applyRankDelta(profile, delta) {
  let { rank, sub_rank, rank_points } = profile;
  if (delta >= 0) {
    rank_points += delta;
    while (rank_points >= POINTS_PER_TIER) {
      rank_points -= POINTS_PER_TIER;
      sub_rank += 1;
      if (sub_rank > MAX_SUB) {
        sub_rank = 0;
        rank += 1;
        if (rank > MAX_RANK) {
          rank = MAX_RANK;
          sub_rank = MAX_SUB;
          rank_points = POINTS_PER_TIER - 1;
          break;
        }
      }
    }
  } else {
    let debt = -delta;
    while (debt > 0) {
      if (rank_points >= debt) {
        rank_points -= debt;
        debt = 0;
      } else {
        debt -= rank_points;
        const stepped = stepDownTier(rank, sub_rank, rank_points);
        rank = stepped.rank;
        sub_rank = stepped.sub_rank;
        rank_points = stepped.rank_points;
        if (rank === 0 && sub_rank === 0 && rank_points === 0) debt = 0;
      }
    }
  }
  const clamped = clampTier(rank, sub_rank, rank_points);
  return {
    ...profile,
    rank: clamped.rank,
    sub_rank: clamped.sub_rank,
    rank_points: clamped.rank_points,
    rankInfo: getRankInfo(clamped.rank, clamped.sub_rank),
  };
}

function applyMatchResult(profile, won) {
  let { rank, sub_rank, rank_points, wins, losses, reduced_next_win } = profile;
  if (won) wins += 1;
  else losses += 1;

  let winPoints = POINTS_WIN;
  let clearedReduced = reduced_next_win;
  if (won && reduced_next_win) {
    winPoints = REDUCED_WIN_POINTS;
    clearedReduced = 0;
  }

  rank_points += won ? winPoints : -POINTS_LOSS;
  if (rank_points < 0) rank_points = 0;

  while (rank_points >= POINTS_PER_TIER) {
    rank_points -= POINTS_PER_TIER;
    sub_rank += 1;
    if (sub_rank > MAX_SUB) {
      sub_rank = 0;
      rank += 1;
      if (rank > MAX_RANK) {
        rank = MAX_RANK;
        sub_rank = MAX_SUB;
        rank_points = POINTS_PER_TIER - 1;
        break;
      }
    }
  }

  const clamped = clampTier(rank, sub_rank, rank_points);
  return {
    ...profile,
    rank: clamped.rank,
    sub_rank: clamped.sub_rank,
    rank_points: clamped.rank_points,
    wins,
    losses,
    reduced_next_win: clearedReduced,
    rankInfo: getRankInfo(clamped.rank, clamped.sub_rank),
  };
}

function applyForfeitWin(profile) {
  let updated = applyRankDelta({ ...profile }, FORFEIT_WIN_POINTS);
  updated.wins = (updated.wins || 0) + 1;
  return updated;
}

function toDisplayStat(raw) {
  const n = Number(raw) || 0;
  return Math.max(0, Math.min(100, Math.round(n * 10)));
}

function enrichProfile(row) {
  const info = getRankInfo(row.rank, row.sub_rank);
  let nextRank = null;
  if (row.rank < MAX_RANK || row.sub_rank < MAX_SUB) {
    if (row.sub_rank < MAX_SUB) nextRank = getRankInfo(row.rank, row.sub_rank + 1);
    else nextRank = getRankInfo(row.rank + 1, 0);
  }
  return {
    ...row,
    rankInfo: info,
    rankLabel: info.fullLabel,
    rankTheme: info.theme,
    progressPercent: Math.round((row.rank_points / POINTS_PER_TIER) * 100),
    pointsToNext: POINTS_PER_TIER - row.rank_points,
    nextRankLabel: nextRank?.fullLabel || null,
    radarStats: {
      fair: toDisplayStat(row.stat_fair ?? 0),
      buy: toDisplayStat(row.stat_buy ?? 0),
      qaid: toDisplayStat(row.stat_qaid ?? 0),
      kaboot: toDisplayStat(row.stat_kaboot ?? 0),
      speed: toDisplayStat(row.stat_speed ?? 0),
      projects: toDisplayStat(row.stat_projects ?? 0),
    },
  };
}

module.exports = {
  RANKS,
  SUB_SUIT_LABELS,
  POINTS_WIN,
  POINTS_LOSS,
  FORFEIT_PENALTY,
  FORFEIT_WIN_POINTS,
  REDUCED_WIN_POINTS,
  POINTS_PER_TIER,
  getRankInfo,
  applyRankDelta,
  applyMatchResult,
  applyForfeitWin,
  enrichProfile,
};
