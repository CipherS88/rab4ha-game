const { db } = require('./db');
const { playerRowToCard } = require('./chat');
const { getEquippedCardDeck } = require('./bag');
const { getSeatMeta } = require('./playerMeta');
const { distributeRecreationalTournamentPoints } = require('./tournamentRewards');

const REGISTRATION_MS = 5 * 60 * 1000;
const LOBBY_MS = 60 * 1000;
const MIN_PLAYERS = 8;

// مرجع لمدير اللعبة — يُسجّل من index.js لإنشاء غرف مباريات البطولة (بدون المساس بالمحرك).
let _gameManager = null;
function setTournamentGameManager(gm) {
  _gameManager = gm;
}

const PHASE_LABELS = {
  registration: 'تسجيل مفتوح',
  lobby: 'دقيقة الدخول — ادخل الآن!',
  active: 'جارية',
  completed: 'انتهت',
  cancelled: 'ملغاة',
};

const FORMAT_LABELS = {
  bo1: 'خروج المغلوب — مباراة واحدة',
  bo3: 'أفضل من 3 (فوزين)',
  elim_bo3_final: 'خروج المغلوب — النهائي أفضل من 3',
};

function tournamentPublicLabels(row) {
  return {
    type_label: row.type === 'pro' ? 'احترافية' : 'ترفيهية',
    format_label: FORMAT_LABELS[row.match_format] || row.match_format,
  };
}

function tournamentSummaryFields(row) {
  return {
    prize_label: row.sponsor_name
      ? row.sponsor_name
      : (row.type === 'pro' ? 'بطولة برعاية رسمية' : 'مجتمعية'),
    participation_rank_label: row.type === 'pro' ? 'تصنيف احترافي' : 'مفتوحة للجميع',
  };
}

function getTournamentCreatorCard(creatorId, viewerId) {
  const card = playerRowToCard(creatorId, viewerId);
  if (!card) {
    return {
      user_id: creatorId,
      name: 'منظم',
      rankLabel: '',
      deck_back_url: '/cards/back_dark.png',
    };
  }
  const deck = getEquippedCardDeck(creatorId);
  const meta = getSeatMeta(creatorId);
  return {
    ...card,
    deck_back_url: deck.back_url || card.deck_back_url || '/cards/back_dark.png',
    deck_glow_color: deck.glow_color || card.deck_glow_color || null,
    deck_asset_key: deck.asset_key || card.deck_asset_key || null,
    star: meta?.star || card.star || null,
    is_admin: meta?.is_admin ?? card.is_admin,
    is_famous: meta?.is_famous ?? card.is_famous,
    is_vip: meta?.is_vip ?? card.is_vip,
  };
}

function initTournamentEngineSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tournament_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      slot_index INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    );

    CREATE TABLE IF NOT EXISTS tournament_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      round_index INTEGER NOT NULL,
      match_index INTEGER NOT NULL,
      team1_id INTEGER,
      team2_id INTEGER,
      winner_team_id INTEGER,
      score1 INTEGER,
      score2 INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    );
  `);

  const cols = [
    'registration_ends_at TEXT',
    'lobby_ends_at TEXT',
    'started_at TEXT',
    'completed_at TEXT',
  ];
  for (const col of cols) {
    try { db.exec(`ALTER TABLE tournaments ADD COLUMN ${col}`); } catch (_) {}
  }
  try { db.exec('ALTER TABLE tournament_entries ADD COLUMN team_id INTEGER'); } catch (_) {}
  try { db.exec('ALTER TABLE tournament_entries ADD COLUMN checked_in INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE tournament_entries ADD COLUMN checked_in_at TEXT'); } catch (_) {}
  // ربط كل مباراة بغرفة لعب حقيقية + وقت البدء.
  try { db.exec('ALTER TABLE tournament_matches ADD COLUMN room_id TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE tournament_matches ADD COLUMN started_at TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE tournaments ADD COLUMN custom_deck_key TEXT DEFAULT \'\''); } catch (_) {}
  try { db.exec('ALTER TABLE tournaments ADD COLUMN custom_bg_key TEXT DEFAULT \'\''); } catch (_) {}
}

/** أكبر قوة للعدد 2 لا تتجاوز n (لبناء شجرة متوازنة 2/4/8/16/32). */
function nearestPow2Floor(n) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

/** أعضاء فريق (معرّفات اللاعبين) بترتيب الانضمام. */
function teamUserIds(teamId) {
  if (!teamId) return [];
  return db.prepare(`
    SELECT user_id FROM tournament_entries WHERE team_id = ? ORDER BY joined_at ASC
  `).all(teamId).map((r) => r.user_id);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isoAfter(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function getEntries(tournamentId) {
  return db.prepare(`
    SELECT e.*, u.display_name, u.avatar_url, u.avatar_removed_until, u.player_code
    FROM tournament_entries e
    JOIN users u ON u.id = e.user_id
    WHERE e.tournament_id = ?
    ORDER BY e.joined_at ASC
  `).all(tournamentId);
}

function entryToPlayer(e, viewerId) {
  const card = playerRowToCard(e.user_id, viewerId);
  if (!card) return null;
  const deck = getEquippedCardDeck(e.user_id);
  const meta = getSeatMeta(e.user_id);
  return {
    ...card,
    deck_back_url: deck.back_url || card.deck_back_url || '/cards/back_dark.png',
    deck_glow_color: deck.glow_color || card.deck_glow_color || null,
    deck_asset_key: deck.asset_key || card.deck_asset_key || null,
    star: meta?.star || card.star || null,
    is_admin: meta?.is_admin ?? card.is_admin,
    is_famous: meta?.is_famous ?? card.is_famous,
    is_vip: meta?.is_vip ?? card.is_vip,
    checked_in: !!e.checked_in,
  };
}

function getTeams(tournamentId, viewerId) {
  const teams = db.prepare(`
    SELECT * FROM tournament_teams WHERE tournament_id = ? ORDER BY slot_index ASC
  `).all(tournamentId);

  return teams.map((t) => {
    const members = db.prepare(`
      SELECT e.*, u.display_name, u.avatar_url, u.avatar_removed_until, u.player_code
      FROM tournament_entries e
      JOIN users u ON u.id = e.user_id
      WHERE e.tournament_id = ? AND e.team_id = ?
      ORDER BY e.joined_at ASC
    `).all(tournamentId, t.id).map((e) => entryToPlayer(e, viewerId));

    const allIn = members.length >= 2 && members.every((m) => m.checked_in);
    return {
      id: t.id,
      slot_index: t.slot_index,
      name: t.name,
      members,
      all_checked_in: allIn,
    };
  });
}

function roundLabels(teamCount) {
  const rounds = Math.log2(teamCount);
  const labels = [];
  if (rounds >= 3) labels.push('ربع النهائي');
  if (rounds >= 2) labels.push('نصف النهائي');
  labels.push('النهائي');
  labels.push('البطل');
  return labels;
}

function isFinalMatch(tournamentId, match) {
  const parent = db.prepare(`
    SELECT id FROM tournament_matches
    WHERE tournament_id = ? AND round_index = ? AND match_index = ?
  `).get(tournamentId, match.round_index + 1, Math.floor(match.match_index / 2));
  return !parent;
}

function getTournamentMatchRoomOptions(tournamentId, match) {
  const t = db.prepare('SELECT size, type, custom_deck_key, custom_bg_key FROM tournaments WHERE id = ?')
    .get(tournamentId);
  const opts = {};
  if (t?.type === 'casual' && (t.size === 32 || t.size === 64) && !isFinalMatch(tournamentId, match)) {
    opts.initialScores = { 1: 52, 2: 52 };
  }
  const { resolveTournamentCosmetics } = require('./bag');
  const cos = resolveTournamentCosmetics(t.custom_deck_key || '', t.custom_bg_key || '');
  if (cos.cardBackUrl) opts.cardBackUrl = cos.cardBackUrl;
  if (cos.sessionBgUrl) opts.sessionBgUrl = cos.sessionBgUrl;
  return opts;
}

function buildBracketMatches(tournamentId, teamIds) {
  db.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?').run(tournamentId);
  const n = teamIds.length;
  if (n < 2 || (n & (n - 1)) !== 0) return;

  let roundTeams = [...teamIds];
  let roundIndex = 0;
  while (roundTeams.length > 1) {
    const nextRound = [];
    for (let i = 0; i < roundTeams.length; i += 2) {
      const t1 = roundTeams[i];
      const t2 = roundTeams[i + 1] || null;
      const matchIndex = i / 2;
      db.prepare(`
        INSERT INTO tournament_matches (tournament_id, round_index, match_index, team1_id, team2_id, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(tournamentId, roundIndex, matchIndex, t1, t2);
      nextRound.push(null);
    }
    roundTeams = nextRound;
    roundIndex++;
  }
}

function getBracket(tournamentId, viewerId) {
  const teams = getTeams(tournamentId, viewerId);
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const matches = db.prepare(`
    SELECT * FROM tournament_matches WHERE tournament_id = ?
    ORDER BY round_index ASC, match_index ASC
  `).all(tournamentId);

  const byRound = {};
  for (const m of matches) {
    if (!byRound[m.round_index]) byRound[m.round_index] = [];
    byRound[m.round_index].push({
      id: m.id,
      match_index: m.match_index,
      team1: teamMap[m.team1_id] || null,
      team2: teamMap[m.team2_id] || null,
      winner_team_id: m.winner_team_id,
      score1: m.score1,
      score2: m.score2,
      status: m.status,
    });
  }

  const teamCount = teams.length;
  return {
    round_labels: roundLabels(teamCount),
    rounds: Object.keys(byRound).sort((a, b) => a - b).map((ri) => ({
      round_index: parseInt(ri, 10),
      label: roundLabels(teamCount)[parseInt(ri, 10)] || `دور ${parseInt(ri, 10) + 1}`,
      matches: byRound[ri],
    })),
    champion_team_id: db.prepare(`
      SELECT winner_team_id FROM tournament_matches
      WHERE tournament_id = ? AND winner_team_id IS NOT NULL
      ORDER BY round_index DESC, match_index ASC LIMIT 1
    `).get(tournamentId)?.winner_team_id || null,
  };
}

function formTeams(tournamentId) {
  const entries = shuffle(getEntries(tournamentId));
  db.prepare('DELETE FROM tournament_teams WHERE tournament_id = ?').run(tournamentId);
  db.prepare('UPDATE tournament_entries SET team_id = NULL, checked_in = 0, checked_in_at = NULL WHERE tournament_id = ?')
    .run(tournamentId);

  // تكوين ذكي: عدد الفرق يجب أن يكون قوة للعدد 2 (2/4/8/16/32) لتُبنى شجرة خروج المغلوب
  // بشكل متوازن مع 8/16/32/64 لاعباً. أي فائض من اللاعبين يبقى مسجّلاً كاحتياط دون فريق.
  const teamCount = nearestPow2Floor(Math.floor(entries.length / 2));
  const teamIds = [];
  for (let i = 0; i < teamCount; i++) {
    const name = `فريق ${i + 1}`;
    const r = db.prepare('INSERT INTO tournament_teams (tournament_id, slot_index, name) VALUES (?, ?, ?)')
      .run(tournamentId, i, name);
    const teamId = r.lastInsertRowid;
    teamIds.push(teamId);
    const p1 = entries[i * 2];
    const p2 = entries[i * 2 + 1];
    if (p1) db.prepare('UPDATE tournament_entries SET team_id = ? WHERE tournament_id = ? AND user_id = ?')
      .run(teamId, tournamentId, p1.user_id);
    if (p2) db.prepare('UPDATE tournament_entries SET team_id = ? WHERE tournament_id = ? AND user_id = ?')
      .run(teamId, tournamentId, p2.user_id);
  }
  return teamIds;
}

/** تسجيل دخول تلقائي لحسابات البوت (لا تضغط "ادخل الآن"). */
function autoCheckInBots(tournamentId) {
  db.prepare(`
    UPDATE tournament_entries
    SET checked_in = 1, checked_in_at = COALESCE(checked_in_at, datetime('now'))
    WHERE tournament_id = ? AND checked_in = 0 AND user_id IN (
      SELECT id FROM users WHERE role = 'bot'
    )
  `).run(tournamentId);
}

function startLobbyPhase(tournamentId) {
  db.prepare(`
    UPDATE tournaments SET status = 'lobby', lobby_ends_at = ? WHERE id = ?
  `).run(isoAfter(LOBBY_MS), tournamentId);
  formTeams(tournamentId);
  autoCheckInBots(tournamentId);
}

function startActivePhase(tournamentId) {
  const teams = db.prepare('SELECT id FROM tournament_teams WHERE tournament_id = ? ORDER BY slot_index').all(tournamentId);
  const teamIds = teams.map((t) => t.id);
  buildBracketMatches(tournamentId, teamIds);
  db.prepare(`
    UPDATE tournaments SET status = 'active', started_at = datetime('now'), lobby_ends_at = NULL WHERE id = ?
  `).run(tournamentId);
  // ابدأ غرف الجولة الأولى فعلياً على طاولات اللعب.
  createRoundRooms(tournamentId, 0);
}

/** إنشاء غرف اللعب الحقيقية لكل مباراة جاهزة في جولة معيّنة. */
function createRoundRooms(tournamentId, roundIndex) {
  const matches = db.prepare(`
    SELECT * FROM tournament_matches
    WHERE tournament_id = ? AND round_index = ? AND winner_team_id IS NULL
  `).all(tournamentId, roundIndex);

  for (const m of matches) {
    // مقعد فارغ (bye): الفريق الوحيد يتأهل تلقائياً.
    if (m.team1_id && !m.team2_id) {
      reportMatchResult(tournamentId, m.id, m.team1_id, { bye: true });
      continue;
    }
    if (!m.team1_id || !m.team2_id) continue; // لم تكتمل بعد
    if (m.room_id) continue; // الغرفة موجودة

    const roomId = `tourney_${tournamentId}_${m.id}`;
    db.prepare(`
      UPDATE tournament_matches SET room_id = ?, status = 'active', started_at = datetime('now') WHERE id = ?
    `).run(roomId, m.id);

    if (_gameManager && typeof _gameManager.createTournamentMatchRoom === 'function') {
      try {
        const roomOpts = getTournamentMatchRoomOptions(tournamentId, m);
        _gameManager.createTournamentMatchRoom(roomId, {
          tournamentId,
          matchId: m.id,
          team1: teamUserIds(m.team1_id),
          team2: teamUserIds(m.team2_id),
          ...roomOpts,
        });
      } catch (e) {
        // في حال فشل إنشاء الغرفة لا نكسر التزامن — تبقى المباراة قابلة لإعادة المحاولة.
        db.prepare('UPDATE tournament_matches SET room_id = NULL, status = ? WHERE id = ?')
          .run('pending', m.id);
      }
    }
  }
}

/**
 * استلام نتيجة مباراة من محرك اللعب (فريق engine 1 = مقاعد 0,2 / فريق 2 = مقاعد 1,3).
 * يُستدعى من gameManager عند انتهاء المباراة (match_over).
 */
function onTournamentMatchOver(tournamentId, matchId, engineWinnerTeam, scores = {}) {
  const m = db.prepare('SELECT * FROM tournament_matches WHERE id = ? AND tournament_id = ?')
    .get(matchId, tournamentId);
  if (!m || m.winner_team_id) return;
  const winnerTeamId = engineWinnerTeam === 2 ? m.team2_id : m.team1_id;
  reportMatchResult(tournamentId, matchId, winnerTeamId, {
    score1: scores?.[1] ?? null,
    score2: scores?.[2] ?? null,
  });
}

/** تسجيل الفائز وترقيته للدور التالي، وإنشاء غرفة الدور التالي عند اكتمالها. */
function reportMatchResult(tournamentId, matchId, winnerTeamId, opts = {}) {
  const m = db.prepare('SELECT * FROM tournament_matches WHERE id = ? AND tournament_id = ?')
    .get(matchId, tournamentId);
  if (!m || m.winner_team_id || !winnerTeamId) return;

  db.prepare(`
    UPDATE tournament_matches
    SET winner_team_id = ?, status = 'completed', score1 = ?, score2 = ?
    WHERE id = ?
  `).run(winnerTeamId, opts.score1 ?? null, opts.score2 ?? null, matchId);

  const parentRound = m.round_index + 1;
  const parentIndex = Math.floor(m.match_index / 2);
  const parent = db.prepare(`
    SELECT * FROM tournament_matches
    WHERE tournament_id = ? AND round_index = ? AND match_index = ?
  `).get(tournamentId, parentRound, parentIndex);

  if (!parent) {
    // كانت المباراة النهائية → الفائز هو البطل.
    completeTournament(tournamentId, winnerTeamId);
    return;
  }

  const slotCol = m.match_index % 2 === 0 ? 'team1_id' : 'team2_id';
  db.prepare(`UPDATE tournament_matches SET ${slotCol} = ? WHERE id = ?`).run(winnerTeamId, parent.id);

  const updated = db.prepare('SELECT * FROM tournament_matches WHERE id = ?').get(parent.id);
  if (updated.team1_id && updated.team2_id) {
    createRoundRooms(tournamentId, parentRound);
  }
}

/** إنهاء البطولة ومنح الفائزين ITEM في الحقيبة + مكافأة عملات. */
function completeTournament(tournamentId, championTeamId) {
  db.prepare(`
    UPDATE tournaments SET status = 'completed', completed_at = datetime('now') WHERE id = ?
  `).run(tournamentId);

  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  const members = teamUserIds(championTeamId);

  if (t?.type === 'casual') {
    try {
      distributeRecreationalTournamentPoints(tournamentId, championTeamId);
    } catch (_) { /* لا نكسر إنهاء البطولة */ }
  }

  const itemKey = `tourney_champion_${tournamentId}`;
  const label = `🏆 بطل ${t?.title || 'البطولة'}`;
  const imageUrl = '/cards/kingofd.jpg';
  const coinsReward = t?.type === 'pro' ? 5000 : 1500;

  for (const uid of members) {
    try {
      const { grantAchievement } = require('./bag');
      grantAchievement(uid, itemKey, label, imageUrl);
    } catch (_) { /* لا نكسر إنهاء البطولة */ }
    try {
      const { getOrCreatePlayer, savePlayer } = require('./db');
      const p = getOrCreatePlayer(`user_${uid}`, '');
      if (p) {
        p.coins = (p.coins || 0) + coinsReward;
        savePlayer(p);
      }
    } catch (_) { /* المكافأة اختيارية */ }
  }

  // إشعار البطل عبر السوكت إن أمكن.
  if (_gameManager && typeof _gameManager.notifyTournamentChampion === 'function') {
    try {
      _gameManager.notifyTournamentChampion(members, { tournamentId, title: t?.title, itemLabel: label, coins: coinsReward });
    } catch (_) {}
  }
}

/** المباراة الحالية للاعب (غرفة جاهزة للدخول). */
function getUserActiveMatch(tournamentId, userId) {
  if (!userId) return null;
  const row = db.prepare(`
    SELECT tm.* FROM tournament_matches tm
    JOIN tournament_entries e
      ON (e.team_id = tm.team1_id OR e.team_id = tm.team2_id)
    WHERE tm.tournament_id = ? AND e.user_id = ?
      AND tm.status = 'active' AND tm.room_id IS NOT NULL AND tm.winner_team_id IS NULL
    ORDER BY tm.round_index DESC LIMIT 1
  `).get(tournamentId, userId);
  if (!row) return null;
  return { room_id: row.room_id, match_id: row.id, round_index: row.round_index };
}

/** مباراة حية قابلة للمشاهدة (للزر "مشاهدة"). */
function getWatchableMatch(tournamentId) {
  const row = db.prepare(`
    SELECT * FROM tournament_matches
    WHERE tournament_id = ? AND status = 'active' AND room_id IS NOT NULL AND winner_team_id IS NULL
    ORDER BY round_index DESC, match_index ASC LIMIT 1
  `).get(tournamentId);
  if (!row) return null;
  return { room_id: row.room_id, match_id: row.id, round_index: row.round_index };
}

function cancelTournament(tournamentId, reason) {
  db.prepare(`
    UPDATE tournaments SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?
  `).run(tournamentId);
  return reason;
}

/** حذف البطولات المنتهية/الملغاة من القاعدة حتى لا تظهر في القائمة. */
function purgeEndedTournaments() {
  const ids = db.prepare(`
    SELECT id FROM tournaments WHERE status IN ('cancelled', 'completed', 'closed')
  `).all().map((r) => r.id);
  for (const id of ids) {
    db.prepare('DELETE FROM tournament_matches WHERE tournament_id = ?').run(id);
    db.prepare('DELETE FROM tournament_teams WHERE tournament_id = ?').run(id);
    db.prepare('DELETE FROM tournament_entries WHERE tournament_id = ?').run(id);
    db.prepare('DELETE FROM tournaments WHERE id = ?').run(id);
  }
  return ids.length;
}

function finishRegistrationOnTimeout(tournamentId) {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!t || t.status !== 'registration') return t;

  const count = db.prepare('SELECT COUNT(*) AS c FROM tournament_entries WHERE tournament_id = ?')
    .get(tournamentId).c;

  if (count >= t.size) {
    startTournament(tournamentId);
    return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  }

  if (count <= 1) {
    cancelTournament(tournamentId, 'انتهى وقت التسجيل — لم ينضم أحد');
  } else if (count < MIN_PLAYERS) {
    cancelTournament(tournamentId, 'لاعبون غير كافيين');
  } else {
    cancelTournament(tournamentId, 'لم يكتمل العدد قبل انتهاء التسجيل');
  }
  return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
}

function startTournament(tournamentId) {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!t || t.status !== 'registration') return t;

  const count = db.prepare('SELECT COUNT(*) AS c FROM tournament_entries WHERE tournament_id = ?')
    .get(tournamentId).c;
  if (count < t.size) return t;

  if (count < MIN_PLAYERS || count < 4) {
    cancelTournament(tournamentId, 'لاعبون غير كافيين');
  } else if (count % 2 !== 0) {
    const last = db.prepare(`
      SELECT user_id FROM tournament_entries WHERE tournament_id = ?
      ORDER BY joined_at DESC LIMIT 1
    `).get(tournamentId);
    if (last) {
      db.prepare('DELETE FROM tournament_entries WHERE tournament_id = ? AND user_id = ?')
        .run(tournamentId, last.user_id);
    }
    startLobbyPhase(tournamentId);
  } else {
    startLobbyPhase(tournamentId);
  }
  return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
}

function syncTournamentPhase(tournamentId) {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!t || t.status === 'cancelled' || t.status === 'completed' || t.status === 'active') return t;

  const now = Date.now();

  if (t.status === 'registration') {
    const ends = t.registration_ends_at ? new Date(t.registration_ends_at).getTime() : 0;
    const count = db.prepare('SELECT COUNT(*) AS c FROM tournament_entries WHERE tournament_id = ?').get(tournamentId).c;
    const full = count >= t.size;
    const timeUp = ends && now >= ends;
    if (full) {
      startTournament(tournamentId);
    } else if (timeUp) {
      finishRegistrationOnTimeout(tournamentId);
    }
  } else if (t.status === 'lobby') {
    autoCheckInBots(tournamentId); // البوتات تُعتبر داخلة دائماً
    const ends = t.lobby_ends_at ? new Date(t.lobby_ends_at).getTime() : 0;
    if (ends && now >= ends) {
      const entries = getEntries(tournamentId);
      const allIn = entries.length > 0 && entries.every((e) => e.checked_in);
      if (!allIn) {
        entries.filter((e) => !e.checked_in).forEach((e) => {
          db.prepare('DELETE FROM tournament_entries WHERE tournament_id = ? AND user_id = ?')
            .run(tournamentId, e.user_id);
        });
        formTeams(tournamentId);
        autoCheckInBots(tournamentId);
        const remaining = getEntries(tournamentId);
        if (remaining.length < MIN_PLAYERS || remaining.length < 4) {
          cancelTournament(tournamentId, 'لم يدخل الجميع في الوقت المحدد');
        } else {
          startActivePhase(tournamentId);
        }
      } else {
        startActivePhase(tournamentId);
      }
    }
  }

  return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
}

function syncAllTournaments() {
  const rows = db.prepare(`SELECT id FROM tournaments WHERE status IN ('registration', 'lobby')`).all();
  for (const r of rows) syncTournamentPhase(r.id);
  purgeEndedTournaments();
}

function enrichTournamentRow(row, viewerId) {
  if (!row) return null;
  syncTournamentPhase(row.id);
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(row.id);
  const count = db.prepare('SELECT COUNT(*) AS c FROM tournament_entries WHERE tournament_id = ?').get(t.id).c;
  const myEntry = viewerId
    ? db.prepare('SELECT * FROM tournament_entries WHERE tournament_id = ? AND user_id = ?').get(t.id, viewerId)
    : null;

  const now = Date.now();
  let phase_ends_at = null;
  let seconds_left = 0;
  if (t.status === 'registration' && t.registration_ends_at) {
    phase_ends_at = t.registration_ends_at;
    seconds_left = Math.max(0, Math.ceil((new Date(t.registration_ends_at).getTime() - now) / 1000));
  } else if (t.status === 'lobby' && t.lobby_ends_at) {
    phase_ends_at = t.lobby_ends_at;
    seconds_left = Math.max(0, Math.ceil((new Date(t.lobby_ends_at).getTime() - now) / 1000));
  }

  return {
    ...row,
    status: t.status,
    phase_label: PHASE_LABELS[t.status] || t.status,
    entry_count: count,
    registration_ends_at: t.registration_ends_at,
    lobby_ends_at: t.lobby_ends_at,
    phase_ends_at,
    seconds_left,
    is_registered: !!myEntry,
    is_checked_in: !!myEntry?.checked_in,
    my_team_id: myEntry?.team_id || null,
    can_join: t.status === 'registration' && count < t.size && !myEntry,
    can_enter: t.status === 'lobby' && myEntry && !myEntry.checked_in,
    in_lobby: t.status === 'lobby' || t.status === 'active',
  };
}

function onTournamentCreated(tournamentId) {
  db.prepare(`
    UPDATE tournaments SET registration_ends_at = ?, status = 'registration' WHERE id = ?
  `).run(isoAfter(REGISTRATION_MS), tournamentId);
}

function enterTournamentLobby(user, tournamentId) {
  syncTournamentPhase(tournamentId);
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!t) return { error: 'البطولة غير موجودة' };
  if (t.status !== 'lobby') return { error: 'ليست مرحلة الدخول الآن' };

  const entry = db.prepare('SELECT * FROM tournament_entries WHERE tournament_id = ? AND user_id = ?')
    .get(tournamentId, user.id);
  if (!entry) return { error: 'يجب التسجيل في البطولة أولاً' };
  if (entry.checked_in) return { ok: true, already: true };

  db.prepare(`
    UPDATE tournament_entries SET checked_in = 1, checked_in_at = datetime('now')
    WHERE tournament_id = ? AND user_id = ?
  `).run(tournamentId, user.id);

  return { ok: true, detail: getTournamentDetail(tournamentId, user.id) };
}

function getTournamentDetail(tournamentId, viewerId) {
  syncTournamentPhase(tournamentId);
  const row = db.prepare(`
    SELECT t.*, u.display_name AS creator_name,
      (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id) AS entry_count
    FROM tournaments t
    JOIN users u ON u.id = t.creator_id
    WHERE t.id = ?
  `).get(tournamentId);
  if (!row) return null;

  const myMatch = viewerId ? getUserActiveMatch(tournamentId, viewerId) : null;
  const watchMatch = getWatchableMatch(tournamentId);
  const base = {
    ...row,
    ...tournamentPublicLabels(row),
    ...tournamentSummaryFields(row),
    ...enrichTournamentRow(row, viewerId),
    title: row.title,
    creator_name: row.creator_name,
    creator: getTournamentCreatorCard(row.creator_id, viewerId),
    my_match: myMatch,
    watch_match: watchMatch,
    can_watch: !!watchMatch,
  };
  const teams = getTeams(tournamentId, viewerId);
  const bracket = base.status === 'active' || base.status === 'completed'
    ? getBracket(tournamentId, viewerId)
    : null;

  return {
    tournament: base,
    teams,
    bracket,
    registered_players: getEntries(tournamentId)
      .map((e) => entryToPlayer(e, viewerId))
      .filter(Boolean),
  };
}

module.exports = {
  initTournamentEngineSchema,
  REGISTRATION_MS,
  LOBBY_MS,
  onTournamentCreated,
  syncTournamentPhase,
  syncAllTournaments,
  enrichTournamentRow,
  enterTournamentLobby,
  getTournamentDetail,
  getTournamentCreatorCard,
  tournamentSummaryFields,
  getTeams,
  setTournamentGameManager,
  onTournamentMatchOver,
  reportMatchResult,
  startTournament,
  createRoundRooms,
  getUserActiveMatch,
  getWatchableMatch,
};
