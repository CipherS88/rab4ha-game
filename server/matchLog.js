const { db } = require('./db');

function ensureMatchLogTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS match_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      game_mode TEXT NOT NULL DEFAULT 'friendly',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      winner_team INTEGER,
      final_scores TEXT,
      players_json TEXT,
      rounds_json TEXT NOT NULL DEFAULT '[]'
    );
  `);
}

ensureMatchLogTables();

function snapshotPlayers(seats) {
  return (seats || []).map((s, idx) => {
    if (!s) return { seat: idx, empty: true };
    return {
      seat: idx,
      name: s.name,
      userId: s.userId || null,
      isBot: !!s.isBot,
      team: idx % 2 === 0 ? 1 : 2,
    };
  });
}

function startMatch(room) {
  const players = snapshotPlayers(room.seats);
  const row = db.prepare(`
    INSERT INTO match_logs (room_id, game_mode, players_json, rounds_json)
    VALUES (?, ?, ?, '[]')
  `).run(room.roomId, room.gameMode || 'friendly', JSON.stringify(players));
  return row.lastInsertRowid;
}

function logRound(matchLogId, room, engine) {
  if (!matchLogId || !engine?.summary_data) return;
  const row = db.prepare('SELECT rounds_json FROM match_logs WHERE id = ?').get(matchLogId);
  if (!row) return;
  const rounds = JSON.parse(row.rounds_json || '[]');
  const entry = {
    round: rounds.length + 1,
    at: new Date().toISOString(),
    dealer_idx: engine.dealer_idx,
    bid: engine.bid ? { ...engine.bid } : null,
    trick_history: (engine.trick_history || []).map((trick) =>
      trick.map((t) => ({ player: t.player, card: { ...t.card } }))
    ),
    summary: { ...engine.summary_data },
    seats: snapshotPlayers(room.seats),
  };
  rounds.push(entry);
  db.prepare(`
    UPDATE match_logs SET rounds_json = ? WHERE id = ?
  `).run(JSON.stringify(rounds), matchLogId);
}

function endMatch(matchLogId, winnerTeam, scores) {
  if (!matchLogId) return;
  db.prepare(`
    UPDATE match_logs SET
      ended_at = datetime('now'),
      winner_team = ?,
      final_scores = ?
    WHERE id = ?
  `).run(winnerTeam, JSON.stringify(scores || {}), matchLogId);
}

function getMatchLog(matchLogId) {
  const row = db.prepare('SELECT * FROM match_logs WHERE id = ?').get(matchLogId);
  if (!row) return null;
  return {
    ...row,
    final_scores: row.final_scores ? JSON.parse(row.final_scores) : null,
    players: row.players_json ? JSON.parse(row.players_json) : [],
    rounds: row.rounds_json ? JSON.parse(row.rounds_json) : [],
  };
}

module.exports = {
  ensureMatchLogTables,
  startMatch,
  logRound,
  endMatch,
  getMatchLog,
};
