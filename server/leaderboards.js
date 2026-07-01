const { db, getOrCreatePlayer } = require('./db');
const { deviceIdForUser } = require('./auth');
const { getRankInfo } = require('./ranks');
const { publicAvatarForUser } = require('./profileLimits');
const { getSeatMeta, userHasVip } = require('./playerMeta');

const LEADERBOARD_LIMIT = 100;

function initLeaderboardsSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_rank_scores (
      user_id INTEGER NOT NULL,
      week_key TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      matches INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, week_key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_champion_awards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_key TEXT NOT NULL,
      position INTEGER NOT NULL,
      awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_weekly_rank_week ON weekly_rank_scores(week_key, points DESC);
  `);

  try { db.exec('ALTER TABLE players ADD COLUMN gift_charisma INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE players ADD COLUMN champion_medals INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
}

function currentWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMeta(key) {
  return db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key)?.value || null;
}

function setMeta(key, value) {
  db.prepare(`
    INSERT INTO app_meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

function userIdFromDeviceId(deviceId) {
  if (!deviceId || !String(deviceId).startsWith('user_')) return null;
  const id = parseInt(String(deviceId).slice(5), 10);
  return Number.isFinite(id) ? id : null;
}

function addGiftCharisma(userId, delta) {
  const d = parseInt(delta, 10) || 0;
  if (d <= 0 || !userId) return 0;
  const deviceId = deviceIdForUser(userId);
  const row = db.prepare('SELECT gift_charisma FROM players WHERE device_id = ?').get(deviceId);
  const next = (row?.gift_charisma || 0) + d;
  db.prepare('UPDATE players SET gift_charisma = ?, updated_at = datetime(\'now\') WHERE device_id = ?')
    .run(next, deviceId);
  return d;
}

function recordWeeklyRankPoints(userId, pointsDelta, won = false) {
  if (!userId) return;
  const weekKey = currentWeekKey();
  const delta = parseInt(pointsDelta, 10) || 0;
  db.prepare(`
    INSERT INTO weekly_rank_scores (user_id, week_key, points, wins, matches)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(user_id, week_key) DO UPDATE SET
      points = points + excluded.points,
      wins = wins + excluded.wins,
      matches = matches + 1,
      updated_at = datetime('now')
  `).run(userId, weekKey, delta, won ? 1 : 0);
}

function awardChampionMedalsForWeek(weekKey) {
  const already = db.prepare(
    'SELECT 1 FROM weekly_champion_awards WHERE week_key = ? LIMIT 1',
  ).get(weekKey);
  if (already) return;

  const top = db.prepare(`
    SELECT user_id, points FROM weekly_rank_scores
    WHERE week_key = ?
    ORDER BY points DESC, wins DESC, updated_at ASC
    LIMIT 10
  `).all(weekKey);

  top.forEach((row, i) => {
    const position = i + 1;
    db.prepare(`
      INSERT INTO weekly_champion_awards (user_id, week_key, position) VALUES (?, ?, ?)
    `).run(row.user_id, weekKey, position);

    const deviceId = deviceIdForUser(row.user_id);
    db.prepare(`
      UPDATE players SET champion_medals = COALESCE(champion_medals, 0) + 1, updated_at = datetime('now')
      WHERE device_id = ?
    `).run(deviceId);

    db.prepare(`
      INSERT INTO inventory (user_id, item_key, label, earned_at)
      VALUES (?, 'champion_medal', ?, datetime('now'))
    `).run(row.user_id, `ميدالية الأبطال — أسبوع ${weekKey}`);
  });
}

function processWeekRollover() {
  const current = currentWeekKey();
  const last = getMeta('leaderboard_week');
  if (!last) {
    setMeta('leaderboard_week', current);
    return;
  }
  if (last !== current) {
    awardChampionMedalsForWeek(last);
    setMeta('leaderboard_week', current);
  }
}

function addCasualTournamentStar(userId) {
  if (!userId) return;
  const deviceId = deviceIdForUser(userId);
  db.prepare(`
    UPDATE players SET championship_stars = COALESCE(championship_stars, 0) + 1, updated_at = datetime('now')
    WHERE device_id = ?
  `).run(deviceId);
}

function recordCasualTournamentWin(userIds = []) {
  for (const uid of userIds) addCasualTournamentStar(uid);
}

function playerRowForUser(userId) {
  const deviceId = deviceIdForUser(userId);
  return db.prepare('SELECT * FROM players WHERE device_id = ?').get(deviceId);
}

function buildLeaderboardEntry(user, player, extra = {}) {
  const rankInfo = player
    ? getRankInfo(player.rank ?? 0, player.sub_rank ?? 0)
    : getRankInfo(0, 0);
  const meta = getSeatMeta(user.id);
  const avatarRemoved = user.avatar_removed_until && new Date(user.avatar_removed_until) > new Date();
  return {
    user_id: user.id,
    name: user.display_name || player?.name || 'لاعب',
    player_code: user.player_code || '',
    avatar_url: avatarRemoved ? '' : (publicAvatarForUser(user) || ''),
    avatar_initial: avatarRemoved ? '🚫' : ((user.display_name || '?').charAt(0)),
    rank_label: rankInfo.fullLabel,
    rank_theme: rankInfo.theme,
    is_vip: userHasVip(user),
    is_famous: !!user.is_famous,
    is_admin: user.role === 'admin',
    star: meta?.star || null,
    champion_medals: player?.champion_medals ?? 0,
    ...extra,
  };
}

function listRankKings() {
  processWeekRollover();
  const weekKey = currentWeekKey();
  const rows = db.prepare(`
    SELECT u.id AS user_id, COALESCE(w.points, 0) AS points,
      COALESCE(w.wins, 0) AS wins, COALESCE(w.matches, 0) AS matches,
      u.display_name, u.player_code, u.avatar_url, u.avatar_removed_until,
      u.role, u.is_vip, u.is_famous, u.vip_expires_at,
      p.rank, p.sub_rank, p.rank_points, p.champion_medals
    FROM users u
    LEFT JOIN weekly_rank_scores w ON w.user_id = u.id AND w.week_key = ?
    LEFT JOIN players p ON p.device_id = ('user_' || u.id)
    ORDER BY points DESC, wins DESC, matches ASC, u.display_name ASC
    LIMIT ?
  `).all(weekKey, LEADERBOARD_LIMIT);

  const entries = rows.map((r, i) => buildLeaderboardEntry({ ...r, id: r.user_id }, r, {
    position: i + 1,
    score: r.points,
    score_label: `${r.points} نقطة`,
    weekly_wins: r.wins,
    weekly_matches: r.matches,
    is_weekly_top10: i < 10,
    has_champion_medal: (r.champion_medals ?? 0) > 0,
  }));

  return {
    type: 'rank_kings',
    title: 'ملوك التصنيف',
    subtitle: 'أفضل 100 لاعب في النقاط الأسبوعية للعب المصنّف',
    week_key: weekKey,
    week_ends_hint: 'أوائل 10 يحصلون على ميدالية الأبطال نهاية كل أسبوع',
    total: entries.length,
    entries,
    my_entry: null,
  };
}

function listTournamentLeaders() {
  const rows = db.prepare(`
    SELECT p.championship_stars, p.rank, p.sub_rank, p.champion_medals,
      u.id AS user_id, u.display_name, u.player_code, u.avatar_url, u.avatar_removed_until,
      u.role, u.is_vip, u.is_famous, u.vip_expires_at
    FROM players p
    JOIN users u ON p.device_id = ('user_' || u.id)
    ORDER BY COALESCE(p.championship_stars, 0) DESC, u.display_name ASC
    LIMIT ?
  `).all(LEADERBOARD_LIMIT);

  const allWithZero = db.prepare(`
    SELECT COUNT(*) AS c FROM players p
    JOIN users u ON p.device_id = ('user_' || u.id)
  `).get().c;

  const entries = rows.map((r, i) => buildLeaderboardEntry({ ...r, id: r.user_id }, r, {
    position: i + 1,
    score: r.championship_stars,
    score_label: `${r.championship_stars ?? 0} ⭐`,
  }));

  return {
    type: 'tournament_stars',
    title: 'متصدرين البطولات',
    subtitle: 'النجوم من الفوز في البطولات الترفيهية',
    total: entries.length,
    registered_players: allWithZero,
    entries,
    my_entry: null,
  };
}

function listCharismaLeaders() {
  const rows = db.prepare(`
    SELECT p.gift_charisma, p.rank, p.sub_rank, p.champion_medals,
      u.id AS user_id, u.display_name, u.player_code, u.avatar_url, u.avatar_removed_until,
      u.role, u.is_vip, u.is_famous, u.vip_expires_at
    FROM players p
    JOIN users u ON p.device_id = ('user_' || u.id)
    ORDER BY COALESCE(p.gift_charisma, 0) DESC, u.display_name ASC
    LIMIT ?
  `).all(LEADERBOARD_LIMIT);

  const entries = rows.map((r, i) => buildLeaderboardEntry({ ...r, id: r.user_id }, r, {
    position: i + 1,
    score: r.gift_charisma,
    score_label: `${(r.gift_charisma ?? 0).toLocaleString('ar-SA')} كاريزما`,
  }));

  return {
    type: 'charisma',
    title: 'الكاريزما',
    subtitle: 'تُكتسب من إهداء الذهب وVIP للاعبين الآخرين',
    total: entries.length,
    entries,
    my_entry: null,
  };
}

function attachMyEntry(result, viewerId) {
  if (!viewerId) return result;
  const mine = result.entries.find((e) => e.user_id === viewerId);
  if (mine) {
    result.my_entry = mine;
    return result;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(viewerId);
  const player = playerRowForUser(viewerId);
  if (!user) return result;

  let score = 0;
  let scoreLabel = '0';
  let position = null;

  if (result.type === 'rank_kings') {
    const wk = result.week_key || currentWeekKey();
    const row = db.prepare('SELECT points, wins FROM weekly_rank_scores WHERE user_id = ? AND week_key = ?')
      .get(viewerId, wk);
    score = row?.points ?? 0;
    scoreLabel = `${score} نقطة`;
    if (score > 0) {
      position = db.prepare(`
        SELECT COUNT(*) + 1 AS pos FROM weekly_rank_scores
        WHERE week_key = ? AND (points > ? OR (points = ? AND wins > ?))
      `).get(wk, score, score, row?.wins ?? 0)?.pos ?? null;
    }
  } else if (result.type === 'tournament_stars') {
    score = player?.championship_stars ?? 0;
    scoreLabel = `${score} ⭐`;
    if (score > 0) {
      position = db.prepare(`
        SELECT COUNT(*) + 1 AS pos FROM players
        WHERE COALESCE(championship_stars, 0) > ?
      `).get(score)?.pos ?? null;
    }
  } else if (result.type === 'charisma') {
    score = player?.gift_charisma ?? 0;
    scoreLabel = `${score.toLocaleString('ar-SA')} كاريزما`;
    if (score > 0) {
      position = db.prepare(`
        SELECT COUNT(*) + 1 AS pos FROM players
        WHERE COALESCE(gift_charisma, 0) > ?
      `).get(score)?.pos ?? null;
    }
  }

  result.my_entry = {
    ...buildLeaderboardEntry(user, player, {
      position,
      score,
      score_label: scoreLabel,
      not_in_top: true,
    }),
  };
  return result;
}

function getLeaderboard(type, viewerId = null) {
  let result;
  if (type === 'rank_kings' || type === 'rank') result = listRankKings();
  else if (type === 'tournament_stars' || type === 'tournaments') result = listTournamentLeaders();
  else if (type === 'charisma') result = listCharismaLeaders();
  else return null;
  return attachMyEntry(result, viewerId);
}

function getAllLeaderboards(viewerId = null) {
  processWeekRollover();
  return {
    rank_kings: attachMyEntry(listRankKings(), viewerId),
    tournament_stars: attachMyEntry(listTournamentLeaders(), viewerId),
    charisma: attachMyEntry(listCharismaLeaders(), viewerId),
    week_key: currentWeekKey(),
  };
}

module.exports = {
  initLeaderboardsSchema,
  currentWeekKey,
  addGiftCharisma,
  recordWeeklyRankPoints,
  recordCasualTournamentWin,
  addCasualTournamentStar,
  processWeekRollover,
  getLeaderboard,
  getAllLeaderboards,
  userIdFromDeviceId,
  LEADERBOARD_LIMIT,
};
