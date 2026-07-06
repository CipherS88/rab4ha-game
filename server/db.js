const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { enrichProfile } = require('./ranks');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'baloot.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    device_id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'لاعب',
    avatar TEXT DEFAULT 'default',
    coins INTEGER NOT NULL DEFAULT 1000,
    rank INTEGER NOT NULL DEFAULT 0,
    sub_rank INTEGER NOT NULL DEFAULT 0,
    rank_points INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    championship_stars INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'ranked',
    won INTEGER NOT NULL,
    points_delta INTEGER NOT NULL,
    rank_before TEXT,
    rank_after TEXT,
    played_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES players(device_id)
  );
`);

try { db.exec(`ALTER TABLE players ADD COLUMN reduced_next_win INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE players ADD COLUMN gems INTEGER NOT NULL DEFAULT 1000`); } catch (_) {}
try { db.exec(`ALTER TABLE players ADD COLUMN recreational_tournament_points INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
try { db.exec(`UPDATE players SET gems = 1000 WHERE gems IS NULL`); } catch (_) {}

const getPlayerStmt = db.prepare('SELECT * FROM players WHERE device_id = ?');
const insertPlayerStmt = db.prepare(`
  INSERT INTO players (device_id, name) VALUES (@device_id, @name)
`);
const updatePlayerStmt = db.prepare(`
  UPDATE players SET
    name = @name,
    avatar = @avatar,
    coins = @coins,
    rank = @rank,
    sub_rank = @sub_rank,
    rank_points = @rank_points,
    wins = @wins,
    losses = @losses,
    championship_stars = @championship_stars,
    recreational_tournament_points = @recreational_tournament_points,
    reduced_next_win = @reduced_next_win,
    gems = @gems,
    updated_at = datetime('now')
  WHERE device_id = @device_id
`);
const insertMatchStmt = db.prepare(`
  INSERT INTO match_history (device_id, mode, won, points_delta, rank_before, rank_after)
  VALUES (@device_id, @mode, @won, @points_delta, @rank_before, @rank_after)
`);

function rowToProfile(row) {
  if (!row) return null;
  return enrichProfile({
    device_id: row.device_id,
    name: row.name,
    avatar: row.avatar,
    coins: row.coins,
    rank: row.rank,
    sub_rank: row.sub_rank,
    rank_points: row.rank_points,
    wins: row.wins,
    losses: row.losses,
    championship_stars: row.championship_stars,
    recreational_tournament_points: row.recreational_tournament_points ?? 0,
    reduced_next_win: row.reduced_next_win || 0,
    stat_fair: row.stat_fair ?? 0,
    stat_buy: row.stat_buy ?? 0,
    stat_qaid: row.stat_qaid ?? 0,
    stat_kaboot: row.stat_kaboot ?? 0,
    stat_speed: row.stat_speed ?? 0,
    stat_projects: row.stat_projects ?? 0,
    radar_ranked_matches: row.radar_ranked_matches ?? 0,
    gems: row.gems ?? 1000,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function getOrCreatePlayer(deviceId, name = 'لاعب') {
  let row = getPlayerStmt.get(deviceId);
  if (!row) {
    insertPlayerStmt.run({ device_id: deviceId, name: name.slice(0, 20) || 'لاعب' });
    row = getPlayerStmt.get(deviceId);
  }
  return rowToProfile(row);
}

function savePlayer(profile) {
  updatePlayerStmt.run({
    device_id: profile.device_id,
    name: profile.name,
    avatar: profile.avatar || 'default',
    coins: profile.coins ?? 1000,
    rank: profile.rank,
    sub_rank: profile.sub_rank,
    rank_points: profile.rank_points,
    wins: profile.wins,
    losses: profile.losses,
    championship_stars: profile.championship_stars ?? 0,
    recreational_tournament_points: profile.recreational_tournament_points ?? 0,
    reduced_next_win: profile.reduced_next_win ? 1 : 0,
    gems: profile.gems ?? 1000,
  });
  return getOrCreatePlayer(profile.device_id);
}

function logMatch(deviceId, mode, won, pointsDelta, rankBefore, rankAfter) {
  insertMatchStmt.run({
    device_id: deviceId,
    mode,
    won: won ? 1 : 0,
    points_delta: pointsDelta,
    rank_before: rankBefore,
    rank_after: rankAfter,
  });
}

function updatePlayerName(deviceId, name) {
  const p = getOrCreatePlayer(deviceId);
  p.name = (name || 'لاعب').slice(0, 20);
  return savePlayer(p);
}

module.exports = {
  db,
  DB_PATH,
  getOrCreatePlayer,
  savePlayer,
  logMatch,
  updatePlayerName,
};
