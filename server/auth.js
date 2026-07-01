const crypto = require('crypto');
const { db, getOrCreatePlayer, savePlayer } = require('./db');
const { getRankInfo } = require('./ranks');

const SALT = 'baloot_local_v1';
const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PLAYER_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const PLAYER_CODE_LEN = 5;
const MIN_PASSWORD_LEN = 6;

function hashPassword(password) {
  return crypto.createHash('sha256').update(`${SALT}:${password}`).digest('hex');
}

function deviceIdForUser(userId) {
  return `user_${userId}`;
}

function initAuthSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      is_vip INTEGER NOT NULL DEFAULT 0,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_user_id INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT 'جلسة بلوت',
      is_open INTEGER NOT NULL DEFAULT 1,
      min_rank INTEGER NOT NULL DEFAULT 0,
      min_sub_rank INTEGER NOT NULL DEFAULT 0,
      max_players INTEGER NOT NULL DEFAULT 4,
      player_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (host_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS game_session_members (
      session_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (session_id, user_id),
      FOREIGN KEY (session_id) REFERENCES game_sessions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      creator_id INTEGER NOT NULL,
      size INTEGER NOT NULL,
      match_format TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'registration',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tournament_entries (
      tournament_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (tournament_id, user_id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tournament_monthly_quota (
      user_id INTEGER NOT NULL,
      month_key TEXT NOT NULL,
      casual_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, month_key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      label TEXT NOT NULL,
      earned_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  try {
    db.exec(`ALTER TABLE players ADD COLUMN user_id INTEGER`);
  } catch (_) { /* exists */ }

  const playerStatCols = [
    'stat_fair INTEGER NOT NULL DEFAULT 0',
    'stat_buy INTEGER NOT NULL DEFAULT 0',
    'stat_qaid INTEGER NOT NULL DEFAULT 0',
    'stat_kaboot INTEGER NOT NULL DEFAULT 0',
    'stat_speed INTEGER NOT NULL DEFAULT 0',
    'stat_projects INTEGER NOT NULL DEFAULT 0',
  ];
  for (const col of playerStatCols) {
    try { db.exec(`ALTER TABLE players ADD COLUMN ${col}`); } catch (_) {}
  }

  try { db.exec(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN phone_sa TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN player_code TEXT`); } catch (_) {}
  try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_player_code ON users(player_code)`); } catch (_) {}

  const sessionCols = [
    'stake INTEGER NOT NULL DEFAULT 0',
    'deck_asset_key TEXT DEFAULT ""',
    'deck_back_url TEXT DEFAULT ""',
    'bg_asset_key TEXT DEFAULT ""',
    'bg_image_url TEXT DEFAULT ""',
  ];
  for (const col of sessionCols) {
    try { db.exec(`ALTER TABLE game_sessions ADD COLUMN ${col}`); } catch (_) {}
  }
  try { db.exec(`ALTER TABLE game_session_members ADD COLUMN is_ready INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
  try { db.exec(`ALTER TABLE game_session_members ADD COLUMN seat_index INTEGER`); } catch (_) {}
  try { db.exec(`ALTER TABLE game_sessions ADD COLUMN countdown_ends_at TEXT`); } catch (_) {}
  migrateSessionSeats();

  seedDefaultUsers();
  migrateExistingPlayerCodes();
}

function randomPlayerCode() {
  let out = '';
  for (let i = 0; i < PLAYER_CODE_LEN; i++) {
    const idx = crypto.randomInt(0, PLAYER_CODE_ALPHABET.length);
    out += PLAYER_CODE_ALPHABET[idx];
  }
  return out;
}

function generateUniquePlayerCode() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const code = randomPlayerCode();
    const exists = db.prepare('SELECT 1 FROM users WHERE player_code = ?').get(code);
    if (!exists) return code;
  }
  throw new Error('تعذر توليد معرّف لاعب فريد');
}

function migrateExistingPlayerCodes() {
  const rows = db.prepare(`
    SELECT id FROM users WHERE player_code IS NULL OR TRIM(player_code) = ''
  `).all();
  for (const row of rows) {
    const code = generateUniquePlayerCode();
    db.prepare('UPDATE users SET player_code = ? WHERE id = ?').run(code, row.id);
  }
}

function findUserByLoginId(loginId) {
  const raw = String(loginId || '').trim();
  if (!raw) return null;
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length === PLAYER_CODE_LEN) {
    const byCode = db.prepare('SELECT * FROM users WHERE player_code = ?').get(compact);
    if (byCode) return byCode;
  }
  return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(raw);
}

function validateRegisterInput({ display_name, password, password_confirm }) {
  const name = String(display_name || '').trim();
  const pass = String(password || '');
  const confirm = String(password_confirm ?? password ?? '');

  if (!name || name.length < 2) return { error: 'اسم العرض قصير جداً (حرفان على الأقل)' };
  if (name.length > 20) return { error: 'اسم العرض طويل جداً (20 حرف كحد أقصى)' };

  const { scanProfanity } = require('./profanityFilter');
  const scan = scanProfanity(name);
  if (scan.blocked) return { error: 'اسم العرض يحتوي ألفاظاً غير مسموحة' };

  if (pass.length < MIN_PASSWORD_LEN) {
    return { error: `كلمة المرور ${MIN_PASSWORD_LEN} أحرف على الأقل` };
  }
  if (pass !== confirm) return { error: 'تأكيد كلمة المرور غير متطابق' };

  return { name, pass };
}

function finishAuthSession(user) {
  const deviceId = deviceIdForUser(user.id);
  const profile = getOrCreatePlayer(deviceId, user.display_name);
  db.prepare('UPDATE players SET user_id = ?, championship_stars = COALESCE(championship_stars, 0) WHERE device_id = ?')
    .run(user.id, deviceId);
  profile.name = user.display_name;
  savePlayer(profile);
  const token = createToken(user.id);
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      player_code: user.player_code || '',
      role: user.role,
      is_vip: !!user.is_vip,
      display_name: user.display_name,
      is_admin: user.role === 'admin',
      email: user.email || '',
      phone_sa: user.phone_sa || '',
    },
    profile: { ...profile, user_id: user.id, player_code: user.player_code || '' },
  };
}

function register({ display_name, password, password_confirm }) {
  const v = validateRegisterInput({ display_name, password, password_confirm });
  if (v.error) return { error: v.error };

  const player_code = generateUniquePlayerCode();
  const username = player_code.toLowerCase();

  try {
    const r = db.prepare(`
      INSERT INTO users (username, password_hash, role, is_vip, display_name, player_code)
      VALUES (?, ?, 'player', 0, ?, ?)
    `).run(username, hashPassword(v.pass), v.name, player_code);
    const user = getUserById(r.lastInsertRowid);
    if (!user) return { error: 'تعذر إنشاء الحساب' };
    return finishAuthSession(user);
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) {
      return { error: 'تعذر إنشاء الحساب — حاول مجدداً' };
    }
    throw e;
  }
}

const SEED_USERS = [
  { username: 'asd', password: 'asd', role: 'admin', display_name: 'أدمن', is_vip: 1 },
  { username: '1', password: '1', role: 'player', display_name: 'لاعب 1', is_vip: 0 },
  { username: '2', password: '2', role: 'player', display_name: 'لاعب 2', is_vip: 0 },
  { username: '3', password: '3', role: 'player', display_name: 'لاعب 3', is_vip: 0 },
];

function seedDefaultUsers() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO users (username, password_hash, role, is_vip, display_name)
    VALUES (@username, @password_hash, @role, @is_vip, @display_name)
  `);
  for (const u of SEED_USERS) {
    insert.run({
      username: u.username,
      password_hash: hashPassword(u.password),
      role: u.role,
      is_vip: u.is_vip ? 1 : 0,
      display_name: u.display_name,
    });
  }
  const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
  if (adminCount === 0) {
    db.prepare("UPDATE users SET role = 'admin' WHERE username = 'asd'").run();
  }
}

function getUserById(id) {
  return db.prepare(`
    SELECT id, username, role, is_vip, is_famous, display_name, email, phone_sa,
           avatar_url, avatar_removed_until, equipped_deck_key, equipped_bg_key,
           vip_expires_at, player_code
    FROM users WHERE id = ?
  `).get(id);
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function createToken(userId) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  db.prepare('INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

function getUserFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, u.role, u.is_vip, u.is_famous, u.display_name, u.email, u.phone_sa,
           u.avatar_url, u.avatar_removed_until, u.vip_expires_at, u.player_code
    FROM auth_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token = ? AND datetime(t.expires_at) > datetime('now')
  `).get(token);
  return row || null;
}

function revokeToken(token) {
  db.prepare('DELETE FROM auth_tokens WHERE token = ?').run(token);
}

function login(loginId, password) {
  const user = findUserByLoginId(loginId);
  if (!user || user.password_hash !== hashPassword(password)) {
    return { error: 'المعرّف أو كلمة المرور غير صحيحة' };
  }
  const { getBanInfoForUser } = require('./chat');
  const ban = getBanInfoForUser(user.id);
  if (ban) return { error: ban.reason };
  return finishAuthSession(user);
}

function getProfileForUser(user) {
  const { publicAvatarForUser, isAvatarRemoved, getProfileChangeLimits } = require('./profileLimits');
  const { getSeatMeta } = require('./playerMeta');
  const full = getUserById(user.id) || user;
  const deviceId = deviceIdForUser(user.id);
  const profile = getOrCreatePlayer(deviceId, full.display_name);
  profile.name = full.display_name;
  const meta = getSeatMeta(user.id);
  return {
    ...profile,
    user_id: user.id,
    player_code: full.player_code || '',
    avatar_url: publicAvatarForUser(full),
    avatar_removed: isAvatarRemoved(full),
    profile_limits: getProfileChangeLimits(user.id, { isAdmin: user.role === 'admin' }),
    deck_back_url: meta?.deck_back_url || '/cards/back_dark.png',
    deck_glow_color: meta?.deck_glow_color || null,
    star: meta?.star || null,
    is_vip: (() => { const { userHasVip } = require('./playerMeta'); return userHasVip(user); })(),
    is_famous: !!user.is_famous,
    is_admin: user.role === 'admin',
  };
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCasualQuota(userId) {
  const mk = monthKey();
  let row = db.prepare('SELECT casual_count FROM tournament_monthly_quota WHERE user_id = ? AND month_key = ?').get(userId, mk);
  if (!row) {
    db.prepare('INSERT INTO tournament_monthly_quota (user_id, month_key, casual_count) VALUES (?, ?, 0)').run(userId, mk);
    row = { casual_count: 0 };
  }
  return row.casual_count;
}

function getCasualLimit(user) {
  if (user.role === 'admin') return 999;
  const { userHasVip } = require('./playerMeta');
  if (userHasVip(user)) return 10;
  return 1;
}

function migrateSessionSeats() {
  const sessions = db.prepare('SELECT id FROM game_sessions').all();
  for (const { id } of sessions) {
    const members = db.prepare(`
      SELECT user_id, seat_index FROM game_session_members
      WHERE session_id = ? ORDER BY joined_at ASC
    `).all(id);
    let nextSeat = 0;
    for (const m of members) {
      if (m.seat_index != null && m.seat_index >= 0 && m.seat_index <= 3) continue;
      while (nextSeat <= 3) {
        const taken = db.prepare(
          'SELECT 1 FROM game_session_members WHERE session_id = ? AND seat_index = ?',
        ).get(id, nextSeat);
        if (!taken) break;
        nextSeat++;
      }
      if (nextSeat <= 3) {
        db.prepare(
          'UPDATE game_session_members SET seat_index = ? WHERE session_id = ? AND user_id = ?',
        ).run(nextSeat, id, m.user_id);
        nextSeat++;
      }
    }
    const c = db.prepare('SELECT COUNT(*) AS c FROM game_session_members WHERE session_id = ?').get(id).c;
    db.prepare('UPDATE game_sessions SET player_count = ? WHERE id = ?').run(c, id);
  }
}

function sessionMemberCard(userId, viewerId, hostUserId, seatIndex) {
  const { playerRowToCard } = require('./chat');
  const card = playerRowToCard(userId, viewerId);
  if (!card) return null;
  return {
    user_id: userId,
    seat_index: seatIndex,
    name: card.name,
    avatar_url: card.avatar_url,
    avatar_initial: card.avatar_initial,
    rankLabel: card.rankLabel,
    rankTheme: card.rankTheme,
    deck_back_url: card.deck_back_url,
    deck_glow_color: card.deck_glow_color,
    star: card.star,
    is_admin: card.is_admin,
    is_famous: card.is_famous,
    is_vip: card.is_vip,
    is_host: userId === hostUserId,
  };
}

function buildSessionSeats(sessionId, hostUserId, viewerId) {
  const rows = db.prepare(`
    SELECT user_id, seat_index FROM game_session_members
    WHERE session_id = ? AND seat_index IS NOT NULL
    ORDER BY seat_index ASC
  `).all(sessionId);
  const seats = [null, null, null, null];
  for (const row of rows) {
    const idx = row.seat_index;
    if (idx < 0 || idx > 3) continue;
    seats[idx] = sessionMemberCard(row.user_id, viewerId, hostUserId, idx);
  }
  return seats;
}

function refreshSessionPlayerCount(sessionId) {
  const c = db.prepare('SELECT COUNT(*) AS c FROM game_session_members WHERE session_id = ?').get(sessionId).c;
  db.prepare('UPDATE game_sessions SET player_count = ? WHERE id = ?').run(c, sessionId);
  return c;
}

function syncSessionCountdown(sessionId) {
  let session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
  if (!session || session.status === 'playing' || session.status === 'closed') return session;

  const seats = buildSessionSeats(sessionId, session.host_user_id, null);
  const filled = seats.filter(Boolean).length;

  if (filled < session.max_players) {
    if (session.status === 'countdown') {
      db.prepare(`UPDATE game_sessions SET status = 'waiting', countdown_ends_at = NULL WHERE id = ?`).run(sessionId);
    }
    return db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
  }

  const now = Date.now();
  if (session.status === 'countdown' && session.countdown_ends_at) {
    const ends = new Date(session.countdown_ends_at).getTime();
    if (now >= ends) {
      db.prepare(`UPDATE game_sessions SET status = 'playing', countdown_ends_at = NULL WHERE id = ?`).run(sessionId);
      return db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
    }
    return session;
  }

  if (filled >= session.max_players && session.status !== 'countdown') {
    const endsAt = new Date(now + 5000).toISOString();
    db.prepare(`UPDATE game_sessions SET status = 'countdown', countdown_ends_at = ? WHERE id = ?`).run(endsAt, sessionId);
  }
  return db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
}

function sessionCountdownSeconds(session) {
  if (!session?.countdown_ends_at || session.status !== 'countdown') return 0;
  return Math.max(0, Math.ceil((new Date(session.countdown_ends_at).getTime() - Date.now()) / 1000));
}

function enrichSessionDetail(row, hostName, viewerId) {
  const synced = syncSessionCountdown(row.id);
  const seats = buildSessionSeats(synced.id, synced.host_user_id, viewerId);
  const filled = seats.filter(Boolean).length;
  const members = seats.filter(Boolean);
  const pub = sessionToPublic(synced, hostName);
  const isHost = viewerId === synced.host_user_id;
  const countdownSeconds = sessionCountdownSeconds(synced);
  const seatOrder = seats.map((s) => s?.user_id ?? null);

  return {
    session: {
      ...pub,
      seats,
      seat_order: seatOrder,
      members,
      player_count: filled,
      is_full: filled >= synced.max_players,
      is_host: isHost,
      is_member: viewerId ? members.some((m) => m.user_id === viewerId) : false,
      countdown_seconds: countdownSeconds,
      in_countdown: synced.status === 'countdown',
      can_force_start: isHost && filled >= synced.max_players && synced.status === 'countdown',
      all_ready: filled >= synced.max_players,
    },
    started: synced.status === 'playing',
    roomId: synced.status === 'playing' ? `session_${synced.id}` : null,
  };
}

function rankMeetsMin(playerRank, playerSub, minRank, minSub) {
  if (playerRank > minRank) return true;
  if (playerRank < minRank) return false;
  return playerSub >= minSub;
}

function sessionToPublic(row, hostName) {
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
    host_name: hostName,
    is_full: row.player_count >= row.max_players,
    stake: row.stake || 0,
    deck_asset_key: row.deck_asset_key || '',
    deck_back_url: row.deck_back_url || '',
    bg_asset_key: row.bg_asset_key || '',
    bg_image_url: row.bg_image_url || '',
    created_at: row.created_at,
  };
}

function listGameSessions(filter = 'open', userId = null) {
  let rows;
  if (filter === 'mine' && userId) {
    rows = db.prepare(`
      SELECT s.*, u.display_name AS host_name FROM game_sessions s
      JOIN users u ON u.id = s.host_user_id
      WHERE s.host_user_id = ? OR s.id IN (SELECT session_id FROM game_session_members WHERE user_id = ?)
      ORDER BY s.created_at DESC
    `).all(userId, userId);
  } else if (filter === 'full') {
    rows = db.prepare(`
      SELECT s.*, u.display_name AS host_name FROM game_sessions s
      JOIN users u ON u.id = s.host_user_id
      WHERE s.player_count >= s.max_players OR s.status IN ('countdown', 'full')
      ORDER BY s.created_at DESC
    `).all();
  } else if (filter === 'open') {
    rows = db.prepare(`
      SELECT s.*, u.display_name AS host_name FROM game_sessions s
      JOIN users u ON u.id = s.host_user_id
      WHERE s.is_open = 1
        AND s.status NOT IN ('playing', 'closed')
        AND s.player_count < s.max_players
      ORDER BY s.created_at DESC LIMIT 50
    `).all();
  } else {
    rows = db.prepare(`
      SELECT s.*, u.display_name AS host_name FROM game_sessions s
      JOIN users u ON u.id = s.host_user_id
      ORDER BY s.created_at DESC LIMIT 50
    `).all();
  }
  return rows.map((r) => {
    syncSessionCountdown(r.id);
    const updated = db.prepare(`
      SELECT s.*, u.display_name AS host_name FROM game_sessions s
      JOIN users u ON u.id = s.host_user_id WHERE s.id = ?
    `).get(r.id);
    const seats = buildSessionSeats(updated.id, updated.host_user_id, userId);
    const filled = seats.filter(Boolean).length;
    return {
      ...sessionToPublic(updated, updated.host_name),
      seats,
      player_count: filled,
      is_full: filled >= updated.max_players,
      is_member: userId ? seats.some((s) => s?.user_id === userId) : false,
      in_countdown: updated.status === 'countdown',
      countdown_seconds: sessionCountdownSeconds(updated),
    };
  });
}

function createGameSession(user, {
  title, is_open, min_rank, min_sub_rank, stake = 0, deck_asset_key, bg_asset_key,
}) {
  const { getBagStoreItems } = require('./bag');
  const items = getBagStoreItems(user.id);
  const cardItems = items.filter((i) => i.category === 'cards');
  const bgItems = items.filter((i) => i.category === 'session_bg');
  const deckItem = deck_asset_key
    ? cardItems.find((i) => i.asset_key === deck_asset_key)
    : cardItems[0];
  const bgItem = bg_asset_key
    ? bgItems.find((i) => i.asset_key === bg_asset_key)
    : bgItems[0];
  if (deck_asset_key && !deckItem) return { error: 'نوع الأوراق غير متوفر في شنطتك' };
  if (bg_asset_key && !bgItem) return { error: 'الخلفية غير متوفرة في شنطتك' };
  const profile = getProfileForUser(user);
  const mr = Math.max(0, Math.min(5, min_rank ?? 0));
  const ms = Math.max(0, Math.min(3, min_sub_rank ?? 0));
  const stakeVal = Math.max(0, Math.min(99999, parseInt(stake, 10) || 0));
  const info = db.prepare(`
    INSERT INTO game_sessions (
      host_user_id, title, is_open, min_rank, min_sub_rank,
      stake, deck_asset_key, deck_back_url, bg_asset_key, bg_image_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    (title || 'جلسة بلوت').slice(0, 40),
    is_open ? 1 : 0,
    mr,
    ms,
    stakeVal,
    deckItem?.asset_key || '',
    deckItem?.image_url || '',
    bgItem?.asset_key || '',
    bgItem?.image_url || '',
  );
  const sessionId = info.lastInsertRowid;
  db.prepare(
    'INSERT INTO game_session_members (session_id, user_id, is_ready, seat_index) VALUES (?, ?, 0, 0)',
  ).run(sessionId, user.id);
  db.prepare('UPDATE game_sessions SET player_count = 1 WHERE id = ?').run(sessionId);
  const row = db.prepare('SELECT s.*, u.display_name AS host_name FROM game_sessions s JOIN users u ON u.id = s.host_user_id WHERE s.id = ?').get(sessionId);
  return sessionToPublic(row, row.host_name);
}

function joinGameSession(user, sessionId, seatIndex = null) {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
  if (!session) return { error: 'الجلسة غير موجودة' };
  if (session.status === 'playing') return { error: 'الجلسة بدأت بالفعل' };
  if (!session.is_open) return { error: 'الجلسة مقفلة' };
  const profile = getProfileForUser(user);
  if (!rankMeetsMin(profile.rank, profile.sub_rank, session.min_rank, session.min_sub_rank)) {
    return { error: `الحد الأدنى للدخول: ${getRankInfo(session.min_rank, session.min_sub_rank).fullLabel}` };
  }

  const seats = buildSessionSeats(sessionId, session.host_user_id, null);
  const filled = seats.filter(Boolean).length;
  const exists = db.prepare('SELECT * FROM game_session_members WHERE session_id = ? AND user_id = ?').get(sessionId, user.id);

  if (seatIndex === null || seatIndex === undefined) {
    seatIndex = seats.findIndex((s) => !s);
    if (seatIndex < 0) return { error: 'الجلسة ممتلئة' };
  }
  if (seatIndex < 0 || seatIndex > 3) return { error: 'مقعد غير صالح' };

  const taken = db.prepare(
    'SELECT user_id FROM game_session_members WHERE session_id = ? AND seat_index = ?',
  ).get(sessionId, seatIndex);
  if (taken && taken.user_id !== user.id) return { error: 'المقعد مشغول' };

  if (exists) {
    if (exists.seat_index === seatIndex) return { ok: true };
    db.prepare(
      'UPDATE game_session_members SET seat_index = ?, is_ready = 0 WHERE session_id = ? AND user_id = ?',
    ).run(seatIndex, sessionId, user.id);
    syncSessionCountdown(sessionId);
    return { ok: true };
  }

  if (filled >= session.max_players) return { error: 'الجلسة ممتلئة' };

  db.prepare(
    'INSERT INTO game_session_members (session_id, user_id, seat_index, is_ready) VALUES (?, ?, ?, 0)',
  ).run(sessionId, user.id, seatIndex);
  refreshSessionPlayerCount(sessionId);
  syncSessionCountdown(sessionId);
  return { ok: true };
}

function getSessionMembers(sessionId) {
  return db.prepare(`
    SELECT m.user_id, m.is_ready, m.joined_at, u.display_name
    FROM game_session_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.session_id = ?
    ORDER BY m.joined_at
  `).all(sessionId);
}

function getGameSessionDetail(sessionId, userId = null) {
  const row = db.prepare(`
    SELECT s.*, u.display_name AS host_name FROM game_sessions s
    JOIN users u ON u.id = s.host_user_id
    WHERE s.id = ?
  `).get(sessionId);
  if (!row) return { error: 'الجلسة غير موجودة' };
  return enrichSessionDetail(row, row.host_name, userId);
}

function getSessionBagOptions(user) {
  const { getBagStoreItems } = require('./bag');
  const items = getBagStoreItems(user.id);
  return {
    decks: items.filter((i) => i.category === 'cards').map((i) => ({
      asset_key: i.asset_key,
      name: i.name,
      image_url: i.image_url,
    })),
    backgrounds: items.filter((i) => i.category === 'session_bg').map((i) => ({
      asset_key: i.asset_key,
      name: i.name,
      image_url: i.image_url,
    })),
  };
}

function setSessionReady(user, sessionId, ready) {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
  if (!session) return { error: 'الجلسة غير موجودة' };
  if (session.status === 'playing') return { error: 'الجلسة بدأت بالفعل' };
  const member = db.prepare('SELECT 1 FROM game_session_members WHERE session_id = ? AND user_id = ?').get(sessionId, user.id);
  if (!member) return { error: 'لست عضواً في هذه الجلسة' };
  db.prepare('UPDATE game_session_members SET is_ready = ? WHERE session_id = ? AND user_id = ?').run(ready ? 1 : 0, sessionId, user.id);
  return getGameSessionDetail(sessionId, user.id);
}

function forceStartGameSession(user, sessionId) {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
  if (!session) return { error: 'الجلسة غير موجودة' };
  if (session.host_user_id !== user.id) return { error: 'فقط المضيف يمكنه بدء المباراة' };
  if (session.status === 'playing') return { error: 'الجلسة بدأت بالفعل' };
  syncSessionCountdown(sessionId);
  const updated = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
  const seats = buildSessionSeats(sessionId, updated.host_user_id, user.id);
  if (seats.filter(Boolean).length < updated.max_players) {
    return { error: 'الجلسة غير مكتملة — ينقص لاعبون' };
  }
  db.prepare(`UPDATE game_sessions SET status = 'playing', countdown_ends_at = NULL WHERE id = ?`).run(sessionId);
  const row = db.prepare(`
    SELECT s.*, u.display_name AS host_name FROM game_sessions s
    JOIN users u ON u.id = s.host_user_id WHERE s.id = ?
  `).get(sessionId);
  return enrichSessionDetail(row, row.host_name, user.id);
}

function leaveGameSession(user, sessionId) {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
  if (!session) return { error: 'الجلسة غير موجودة' };
  if (session.host_user_id === user.id) {
    db.prepare('DELETE FROM game_session_members WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM game_sessions WHERE id = ?').run(sessionId);
    return { deleted: true, was_host: true };
  }
  const exists = db.prepare('SELECT 1 FROM game_session_members WHERE session_id = ? AND user_id = ?').get(sessionId, user.id);
  if (!exists) return { ok: true };
  db.prepare('DELETE FROM game_session_members WHERE session_id = ? AND user_id = ?').run(sessionId, user.id);
  refreshSessionPlayerCount(sessionId);
  syncSessionCountdown(sessionId);
  db.prepare('UPDATE game_session_members SET is_ready = 0 WHERE session_id = ?').run(sessionId);
  return { ok: true, was_host: false };
}

function handleRankedForfeit({ leaverUserId, winnerUserIds = [] }) {
  const { applyRankDelta, applyForfeitWin, FORFEIT_PENALTY, FORFEIT_WIN_POINTS } = require('./ranks');
  const { logMatch } = require('./db');
  const { recordWeeklyRankPoints } = require('./leaderboards');
  const results = { leaver: null, winners: [] };

  if (leaverUserId) {
    const deviceId = deviceIdForUser(leaverUserId);
    const profile = getOrCreatePlayer(deviceId);
    const before = getRankInfo(profile.rank, profile.sub_rank).fullLabel;
    let updated = applyRankDelta({ ...profile }, -FORFEIT_PENALTY);
    updated.losses = (updated.losses || 0) + 1;
    updated.reduced_next_win = 1;
    savePlayer(updated);
    const after = getRankInfo(updated.rank, updated.sub_rank).fullLabel;
    logMatch(deviceId, 'ranked_forfeit', false, -FORFEIT_PENALTY, before, after);
    recordWeeklyRankPoints(leaverUserId, -FORFEIT_PENALTY, false);
    results.leaver = { pointsDelta: -FORFEIT_PENALTY, reducedNextWin: true };
  }

  const seen = new Set();
  for (const uid of winnerUserIds) {
    if (!uid || uid === leaverUserId || seen.has(uid)) continue;
    seen.add(uid);
    const deviceId = deviceIdForUser(uid);
    const profile = getOrCreatePlayer(deviceId);
    const before = getRankInfo(profile.rank, profile.sub_rank).fullLabel;
    const updated = applyForfeitWin({ ...profile });
    savePlayer(updated);
    const after = getRankInfo(updated.rank, updated.sub_rank).fullLabel;
    logMatch(deviceId, 'ranked_forfeit_win', true, FORFEIT_WIN_POINTS, before, after);
    recordWeeklyRankPoints(uid, FORFEIT_WIN_POINTS, true);
    results.winners.push({ userId: uid, pointsDelta: FORFEIT_WIN_POINTS });
  }
  return results;
}

const VALID_SIZES = [8, 16, 32, 64];
const VALID_FORMATS = ['bo1', 'bo3', 'elim_bo3_final'];

function tournamentToPublic(row, creatorName) {
  const formatLabels = {
    bo1: 'خروج المغلوب — مباراة واحدة',
    bo3: 'أفضل من 3 (فوزين)',
    elim_bo3_final: 'خروج المغلوب — النهائي أفضل من 3',
  };
  return {
    id: row.id,
    type: row.type,
    type_label: row.type === 'pro' ? 'احترافية' : 'ترفيهية',
    title: row.title,
    size: row.size,
    match_format: row.match_format,
    format_label: formatLabels[row.match_format] || row.match_format,
    status: row.status,
    creator_id: row.creator_id,
    creator_name: creatorName,
    entry_count: row.entry_count ?? 0,
    image_url: row.image_url || '',
    banner_url: row.banner_url || '',
    sponsor_name: row.sponsor_name || '',
    sponsor_url: row.sponsor_url || '',
    created_at: row.created_at,
  };
}

function listTournaments(type = null, viewerId = null) {
  const { syncAllTournaments, enrichTournamentRow, getTournamentCreatorCard, tournamentSummaryFields } = require('./tournamentEngine');
  syncAllTournaments();
  let sql = `
    SELECT t.*, u.display_name AS creator_name,
      (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id) AS entry_count
    FROM tournaments t
    JOIN users u ON u.id = t.creator_id
  `;
  const mapRow = (r) => {
    const base = tournamentToPublic(r, r.creator_name);
    if (!viewerId) return { ...base, ...tournamentSummaryFields(r) };
    const extra = enrichTournamentRow(r, viewerId);
    return {
      ...base,
      ...extra,
      ...tournamentSummaryFields(r),
      entry_count: extra.entry_count ?? base.entry_count,
      creator: getTournamentCreatorCard(r.creator_id, viewerId),
    };
  };
  if (type) {
    sql += ` WHERE t.type = ? ORDER BY t.created_at DESC`;
    return db.prepare(sql).all(type).map(mapRow);
  }
  sql += ` ORDER BY t.created_at DESC LIMIT 40`;
  return db.prepare(sql).all().map(mapRow);
}

function createTournament(user, data) {
  const { type, title, size, match_format } = data;
  if (!VALID_SIZES.includes(size)) return { error: 'حجم البطولة غير صالح' };
  if (!VALID_FORMATS.includes(match_format)) return { error: 'نظام المباريات غير صالح' };

  if (type === 'pro') {
    return { error: 'البطولات الاحترافية تُدار من لوحة الأدمن' };
  } else if (type === 'casual') {
    const used = getCasualQuota(user.id);
    const limit = getCasualLimit(user);
    if (used >= limit) {
      return { error: user.is_vip ? 'استنفدت حصة البطولات الترفيهية هذا الشهر' : 'بطولة ترفيهية واحدة بالشهر — الحصة انتهت' };
    }
    const mk = monthKey();
    db.prepare(`
      INSERT INTO tournament_monthly_quota (user_id, month_key, casual_count) VALUES (?, ?, 1)
      ON CONFLICT(user_id, month_key) DO UPDATE SET casual_count = casual_count + 1
    `).run(user.id, mk);
  } else {
    return { error: 'نوع بطولة غير صالح' };
  }

  const info = db.prepare(`
    INSERT INTO tournaments (type, title, creator_id, size, match_format)
    VALUES (?, ?, ?, ?, ?)
  `).run(type, (title || 'بطولة بلوت').slice(0, 50), user.id, size, match_format);

  db.prepare('INSERT INTO tournament_entries (tournament_id, user_id) VALUES (?, ?)').run(info.lastInsertRowid, user.id);

  const { onTournamentCreated, enrichTournamentRow, getTournamentCreatorCard, tournamentSummaryFields } = require('./tournamentEngine');
  onTournamentCreated(info.lastInsertRowid);

  const row = db.prepare(`
    SELECT t.*, u.display_name AS creator_name, 1 AS entry_count
    FROM tournaments t JOIN users u ON u.id = t.creator_id WHERE t.id = ?
  `).get(info.lastInsertRowid);
  const base = tournamentToPublic(row, row.creator_name);
  return {
    tournament: {
      ...base,
      ...enrichTournamentRow(row, user.id),
      ...tournamentSummaryFields(row),
      creator: getTournamentCreatorCard(row.creator_id, user.id),
    },
  };
}

function joinTournament(user, tournamentId) {
  const { syncTournamentPhase } = require('./tournamentEngine');
  syncTournamentPhase(tournamentId);
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!t) return { error: 'البطولة غير موجودة' };
  if (t.status !== 'registration') return { error: 'التسجيل مغلق لهذه البطولة' };
  const count = db.prepare('SELECT COUNT(*) AS c FROM tournament_entries WHERE tournament_id = ?').get(tournamentId).c;
  if (count >= t.size) return { error: 'البطولة ممتلئة' };
  try {
    db.prepare('INSERT INTO tournament_entries (tournament_id, user_id) VALUES (?, ?)').run(tournamentId, user.id);
  } catch {
    return { ok: true };
  }
  return { ok: true };
}

function getInventory(userId) {
  return db.prepare('SELECT * FROM inventory WHERE user_id = ? ORDER BY earned_at DESC').all(userId);
}

function normalizeSaudiPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (/^5\d{8}$/.test(digits)) return `0${digits}`;
  if (/^9665\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^05\d{8}$/.test(digits)) return digits;
  return null;
}

function updateUserSettings(userId, { email, phone_sa }) {
  const emailVal = (email || '').trim().slice(0, 120);
  if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    return { error: 'البريد الإلكتروني غير صالح' };
  }
  let phoneVal = '';
  if (phone_sa != null && String(phone_sa).trim()) {
    const normalized = normalizeSaudiPhone(phone_sa);
    if (!normalized) return { error: 'رقم سعودي غير صالح — مثال: 05xxxxxxxx' };
    phoneVal = normalized;
  }
  db.prepare('UPDATE users SET email = ?, phone_sa = ? WHERE id = ?').run(emailVal, phoneVal, userId);
  return { user: getUserById(userId) };
}

function closeAllOpenTournaments() {
  const r = db.prepare(`UPDATE tournaments SET status = 'closed' WHERE status = 'registration'`).run();
  return { closed: r.changes };
}

module.exports = {
  initAuthSchema,
  hashPassword,
  login,
  register,
  findUserByLoginId,
  generateUniquePlayerCode,
  getUserFromToken,
  getUserById,
  revokeToken,
  getProfileForUser,
  deviceIdForUser,
  listGameSessions,
  createGameSession,
  joinGameSession,
  getGameSessionDetail,
  getSessionBagOptions,
  setSessionReady,
  forceStartGameSession,
  leaveGameSession,
  handleRankedForfeit,
  listTournaments,
  createTournament,
  joinTournament,
  closeAllOpenTournaments,
  getCasualQuota,
  getCasualLimit,
  getInventory,
  updateUserSettings,
  normalizeSaudiPhone,
  VALID_SIZES,
  VALID_FORMATS,
  getRankInfo,
};
