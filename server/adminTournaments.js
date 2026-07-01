const { db } = require('./db');
const { VALID_SIZES, VALID_FORMATS } = require('./auth');

const FORMAT_LABELS = {
  bo1: 'خروج المغلوب — مباراة واحدة',
  bo3: 'أفضل من 3 (فوزين)',
  elim_bo3_final: 'خروج المغلوب — النهائي أفضل من 3',
};

function tournamentToAdmin(row) {
  return {
    id: row.id,
    type: row.type,
    type_label: row.type === 'pro' ? 'احترافية' : 'ترفيهية',
    title: row.title,
    size: row.size,
    match_format: row.match_format,
    format_label: FORMAT_LABELS[row.match_format] || row.match_format,
    status: row.status,
    creator_id: row.creator_id,
    creator_name: row.creator_name,
    entry_count: row.entry_count ?? 0,
    image_url: row.image_url || '',
    banner_url: row.banner_url || '',
    sponsor_name: row.sponsor_name || '',
    sponsor_url: row.sponsor_url || '',
    created_at: row.created_at,
  };
}

function listProTournamentsAdmin() {
  return listAllTournamentsAdmin({ type: 'pro' });
}

function listAllTournamentsAdmin({ type = null } = {}) {
  let sql = `
    SELECT t.*, u.display_name AS creator_name,
      (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id) AS entry_count
    FROM tournaments t
    JOIN users u ON u.id = t.creator_id
  `;
  const rows = type
    ? db.prepare(`${sql} WHERE t.type = ? ORDER BY t.created_at DESC`).all(type)
    : db.prepare(`${sql} ORDER BY t.created_at DESC`).all();
  return rows.map(tournamentToAdmin);
}

function closeTournamentAdmin(id) {
  const existing = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(id);
  if (!existing) return { error: 'البطولة غير موجودة' };
  db.prepare(`UPDATE tournaments SET status = 'closed' WHERE id = ?`).run(id);
  return { ok: true };
}

function deleteTournamentAdmin(id) {
  const existing = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(id);
  if (!existing) return { error: 'البطولة غير موجودة' };
  db.prepare('DELETE FROM tournament_entries WHERE tournament_id = ?').run(id);
  db.prepare('DELETE FROM tournaments WHERE id = ?').run(id);
  return { ok: true };
}

function createProTournamentAdmin(user, data) {
  const {
    title, size, match_format,
    image_url, banner_url, sponsor_name, sponsor_url, status,
  } = data;
  const sz = parseInt(size, 10);
  if (!VALID_SIZES.includes(sz)) return { error: 'حجم البطولة غير صالح' };
  if (!VALID_FORMATS.includes(match_format)) return { error: 'نظام المباريات غير صالح' };

  const info = db.prepare(`
    INSERT INTO tournaments (
      type, title, creator_id, size, match_format, status,
      image_url, banner_url, sponsor_name, sponsor_url
    ) VALUES ('pro', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    (title || 'بطولة احترافية').slice(0, 80),
    user.id,
    sz,
    match_format,
    status || 'registration',
    (image_url || '').slice(0, 500),
    (banner_url || '').slice(0, 500),
    (sponsor_name || '').slice(0, 80),
    (sponsor_url || '').slice(0, 500),
  );

  db.prepare('INSERT INTO tournament_entries (tournament_id, user_id) VALUES (?, ?)').run(info.lastInsertRowid, user.id);

  const { onTournamentCreated } = require('./tournamentEngine');
  onTournamentCreated(info.lastInsertRowid);

  const row = db.prepare(`
    SELECT t.*, u.display_name AS creator_name, 1 AS entry_count
    FROM tournaments t JOIN users u ON u.id = t.creator_id WHERE t.id = ?
  `).get(info.lastInsertRowid);
  return { tournament: tournamentToAdmin(row) };
}

function updateProTournamentAdmin(id, data) {
  const existing = db.prepare('SELECT * FROM tournaments WHERE id = ? AND type = ?').get(id, 'pro');
  if (!existing) return { error: 'البطولة غير موجودة' };

  const sz = data.size != null ? parseInt(data.size, 10) : existing.size;
  const fmt = data.match_format || existing.match_format;
  if (!VALID_SIZES.includes(sz)) return { error: 'حجم البطولة غير صالح' };
  if (!VALID_FORMATS.includes(fmt)) return { error: 'نظام المباريات غير صالح' };

  db.prepare(`
    UPDATE tournaments SET
      title = ?, size = ?, match_format = ?, status = ?,
      image_url = ?, banner_url = ?, sponsor_name = ?, sponsor_url = ?
    WHERE id = ?
  `).run(
    (data.title ?? existing.title).slice(0, 80),
    sz,
    fmt,
    data.status ?? existing.status,
    (data.image_url ?? existing.image_url ?? '').slice(0, 500),
    (data.banner_url ?? existing.banner_url ?? '').slice(0, 500),
    (data.sponsor_name ?? existing.sponsor_name ?? '').slice(0, 80),
    (data.sponsor_url ?? existing.sponsor_url ?? '').slice(0, 500),
    id,
  );

  const row = db.prepare(`
    SELECT t.*, u.display_name AS creator_name,
      (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id) AS entry_count
    FROM tournaments t JOIN users u ON u.id = t.creator_id WHERE t.id = ?
  `).get(id);
  return { tournament: tournamentToAdmin(row) };
}

function deleteProTournamentAdmin(id) {
  return deleteTournamentAdmin(id);
}

function closeAllOpenTournamentsAdmin() {
  const { closeAllOpenTournaments } = require('./auth');
  return closeAllOpenTournaments();
}

module.exports = {
  listProTournamentsAdmin,
  listAllTournamentsAdmin,
  createProTournamentAdmin,
  updateProTournamentAdmin,
  deleteProTournamentAdmin,
  deleteTournamentAdmin,
  closeTournamentAdmin,
  closeAllOpenTournamentsAdmin,
  tournamentToAdmin,
};
