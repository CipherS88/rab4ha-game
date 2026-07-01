const { db } = require('./db');
const { getRankInfo } = require('./ranks');

function sessionToAdmin(row) {
  const minInfo = getRankInfo(row.min_rank, row.min_sub_rank);
  return {
    id: row.id,
    title: row.title,
    is_open: !!row.is_open,
    min_rank: row.min_rank,
    min_sub_rank: row.min_sub_rank,
    min_rank_label: minInfo.fullLabel,
    max_players: row.max_players,
    player_count: row.player_count,
    status: row.status,
    host_user_id: row.host_user_id,
    host_name: row.host_name,
    is_full: row.player_count >= row.max_players,
    created_at: row.created_at,
  };
}

function listAllSessionsAdmin() {
  const rows = db.prepare(`
    SELECT s.*, u.display_name AS host_name
    FROM game_sessions s
    JOIN users u ON u.id = s.host_user_id
    ORDER BY s.created_at DESC
  `).all();
  return rows.map(sessionToAdmin);
}

function closeSessionAdmin(id) {
  const existing = db.prepare('SELECT id FROM game_sessions WHERE id = ?').get(id);
  if (!existing) return { error: 'الجلسة غير موجودة' };
  db.prepare(`UPDATE game_sessions SET is_open = 0, status = 'closed' WHERE id = ?`).run(id);
  return { ok: true };
}

function deleteSessionAdmin(id) {
  const existing = db.prepare('SELECT id FROM game_sessions WHERE id = ?').get(id);
  if (!existing) return { error: 'الجلسة غير موجودة' };
  db.prepare('DELETE FROM game_session_members WHERE session_id = ?').run(id);
  db.prepare('DELETE FROM game_sessions WHERE id = ?').run(id);
  return { ok: true };
}

function closeAllOpenSessionsAdmin() {
  const r = db.prepare(`
    UPDATE game_sessions SET is_open = 0, status = 'closed'
    WHERE status IN ('waiting', 'full') AND is_open = 1
  `).run();
  return { closed: r.changes };
}

module.exports = {
  listAllSessionsAdmin,
  closeSessionAdmin,
  deleteSessionAdmin,
  closeAllOpenSessionsAdmin,
  sessionToAdmin,
};
