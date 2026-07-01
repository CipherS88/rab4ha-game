/**
 * رادار اللعب — معدل تراكمي لمحاور المهارة (مباريات التصنيف فقط)
 */

const { db } = require('./db');
const { deviceIdForUser } = require('./auth');

const PROJECT_RAW_PTS = {
  سرا: [20, 20],
  خمسين: [50, 50],
  مية: [100, 100],
  أربعمية: [200, 0],
  بلوت: [0, 20],
};

const RADAR_KEYS = ['fair', 'buy', 'qaid', 'kaboot', 'speed', 'projects'];

function initPlayRadarSchema() {
  try { db.exec('ALTER TABLE players ADD COLUMN radar_ranked_matches INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
}

function seatTeam(seatIdx) {
  return seatIdx % 2 === 0 ? 1 : 2;
}

function userIdForSeat(seats, seatIdx) {
  const s = seats[seatIdx];
  if (!s || s.isBot || !s.userId) return null;
  return parseInt(s.userId, 10);
}

function projectPointsForSeat(engine, seatIdx) {
  const team = seatTeam(seatIdx);
  if (engine.winning_project_team !== team) return 0;
  const names = engine.declared_projects[seatIdx] || [];
  if (!names.length) return 0;
  const isSun = engine.bid?.type === 'SUN';
  const tier = isSun ? 0 : 1;
  let pts = 0;
  for (const name of names) {
    const raw = PROJECT_RAW_PTS[name];
    if (raw) pts += raw[tier] || 0;
  }
  return pts;
}

function speedDeltaFromMs(playMs) {
  if (!playMs || playMs <= 0) return 0;
  const sec = playMs / 1000;
  if (sec >= 1 && sec <= 1.5) return 2;
  if (sec >= 4 && sec <= 5) return -1;
  return 0;
}

function createEmptyPlayerState(seatIdx) {
  return {
    seat: seatIdx,
    team: seatTeam(seatIdx),
    fair: 0,
    qaid: 0,
    projects: 0,
    buy: 0,
    kaboot: 0,
    speedDeltaSum: 0,
    speedPlayCount: 0,
  };
}

class RadarMatchTracker {
  constructor(seats) {
    this.players = {};
    this._syncSeats(seats);
  }

  _syncSeats(seats) {
    for (let i = 0; i < 4; i++) {
      const uid = userIdForSeat(seats, i);
      if (!uid) continue;
      if (!this.players[uid]) {
        this.players[uid] = createEmptyPlayerState(i);
      } else {
        this.players[uid].seat = i;
        this.players[uid].team = seatTeam(i);
      }
    }
  }

  recordPlay(userId, playMs) {
    const p = this.players[userId];
    if (!p) return;
    const delta = speedDeltaFromMs(playMs);
    p.speedDeltaSum += delta;
    p.speedPlayCount += 1;
  }

  recordQaidOutcome(seats, objectorSeat, result) {
    const uid = userIdForSeat(seats, objectorSeat);
    if (!uid || !this.players[uid] || !result) return;
    if (result.valid) {
      this.players[uid].qaid += 1;
    } else {
      this.players[uid].qaid -= 2;
    }
  }

  onRoundEnd(engine, seats) {
    if (!engine?.summary_data) return;
    this._syncSeats(seats);

    const summary = engine.summary_data;
    const wasQaid = !!summary.is_qaid;
    const mistakes = [...(engine.mistakes || [])];

    if (!wasQaid && mistakes.length) {
      for (const mistake of mistakes) {
        const cheaterUid = userIdForSeat(seats, mistake.player);
        if (cheaterUid && this.players[cheaterUid]) {
          this.players[cheaterUid].fair += 1;
        }
        const cheaterTeam = seatTeam(mistake.player);
        for (const [uid, st] of Object.entries(this.players)) {
          if (st.team !== cheaterTeam) {
            st.qaid -= 1;
          }
        }
      }
    }

    for (let seatIdx = 0; seatIdx < 4; seatIdx++) {
      const uid = userIdForSeat(seats, seatIdx);
      if (!uid || !this.players[uid]) continue;
      const pts = projectPointsForSeat(engine, seatIdx);
      if (pts > 0) {
        this.players[uid].projects += pts / 20;
      }
    }

    if (summary.is_kaput && summary.kaput_team != null) {
      const buyerSeat = summary.buyer_seat ?? engine.bid?.bidder;
      const buyerUid = buyerSeat != null ? userIdForSeat(seats, buyerSeat) : null;
      if (buyerUid && this.players[buyerUid] && summary.kaput_team === summary.buyer) {
        this.players[buyerUid].kaboot += 2;
      }
    }
  }

  finalizeMatch(engine, winnerTeam, seats) {
    this._syncSeats(seats);
    const summary = engine?.summary_data || {};
    const buyerSeat = summary.buyer_seat ?? engine?.bid?.bidder;
    const buyerTeam = summary.buyer ?? engine?.buyer_team;

    if (buyerSeat != null && buyerTeam != null) {
      const buyerUid = userIdForSeat(seats, buyerSeat);
      if (buyerUid && this.players[buyerUid]) {
        if (winnerTeam === buyerTeam) {
          this.players[buyerUid].buy += 1;
        } else {
          this.players[buyerUid].buy -= 1;
        }
      }
    }

    const results = {};
    for (const [uid, st] of Object.entries(this.players)) {
      const speed = st.speedPlayCount > 0
        ? st.speedDeltaSum / st.speedPlayCount
        : 0;
      results[uid] = {
        fair: st.fair,
        qaid: st.qaid,
        projects: st.projects,
        buy: st.buy,
        kaboot: st.kaboot,
        speed,
      };
    }
    return results;
  }
}

function toDisplayStat(raw) {
  const n = Number(raw) || 0;
  return Math.max(0, Math.min(100, Math.round(n * 10)));
}

function applyRadarMatchResults(matchResults) {
  if (!matchResults || !Object.keys(matchResults).length) return;

  const updateStmt = db.prepare(`
    UPDATE players SET
      stat_fair = ?,
      stat_buy = ?,
      stat_qaid = ?,
      stat_kaboot = ?,
      stat_speed = ?,
      stat_projects = ?,
      radar_ranked_matches = ?,
      updated_at = datetime('now')
    WHERE device_id = ?
  `);

  for (const [userIdStr, scores] of Object.entries(matchResults)) {
    const userId = parseInt(userIdStr, 10);
    if (!userId || !scores) continue;
    const deviceId = deviceIdForUser(userId);
    const row = db.prepare('SELECT * FROM players WHERE device_id = ?').get(deviceId);
    if (!row) continue;

    const n = row.radar_ranked_matches || 0;
    const newN = n + 1;
    const next = (key) => {
      const old = Number(row[`stat_${key}`]) || 0;
      const delta = Number(scores[key]) || 0;
      return (old * n + delta) / newN;
    };

    updateStmt.run(
      next('fair'),
      next('buy'),
      next('qaid'),
      next('kaboot'),
      next('speed'),
      next('projects'),
      newN,
      deviceId,
    );
  }
}

function readRadarStatsFromRow(row) {
  if (!row) {
    return {
      fair: 0, buy: 0, qaid: 0, kaboot: 0, speed: 0, projects: 0,
      radar_ranked_matches: 0,
    };
  }
  const raw = {
    fair: row.stat_fair ?? 0,
    buy: row.stat_buy ?? 0,
    qaid: row.stat_qaid ?? 0,
    kaboot: row.stat_kaboot ?? 0,
    speed: row.stat_speed ?? 0,
    projects: row.stat_projects ?? 0,
  };
  return {
    ...raw,
    radar_ranked_matches: row.radar_ranked_matches || 0,
    radarStats: {
      fair: toDisplayStat(raw.fair),
      buy: toDisplayStat(raw.buy),
      qaid: toDisplayStat(raw.qaid),
      kaboot: toDisplayStat(raw.kaboot),
      speed: toDisplayStat(raw.speed),
      projects: toDisplayStat(raw.projects),
    },
  };
}

module.exports = {
  initPlayRadarSchema,
  RadarMatchTracker,
  applyRadarMatchResults,
  readRadarStatsFromRow,
  speedDeltaFromMs,
  RADAR_KEYS,
  toDisplayStat,
};
