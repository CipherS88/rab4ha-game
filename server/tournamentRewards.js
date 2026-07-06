const { db } = require('./db');
const { deviceIdForUser } = require('./auth');
const { getOrCreatePlayer, savePlayer } = require('./db');
const { grantBadge, grantOrUpdateTournamentPointsPouch } = require('./bag');
const { REC_TOURNEY_POINTS } = require('./tournamentConstants');

function teamMemberUserIds(teamId) {
  if (!teamId) return [];
  return db.prepare(`
    SELECT user_id FROM tournament_entries WHERE team_id = ? ORDER BY joined_at ASC
  `).all(teamId).map((r) => r.user_id);
}

function addRecTournamentPoints(userId, delta, reasonLabel) {
  if (!userId || !delta) return;
  const deviceId = deviceIdForUser(userId);
  const p = getOrCreatePlayer(deviceId, '');
  p.recreational_tournament_points = (p.recreational_tournament_points || 0) + delta;
  savePlayer(p);
  grantOrUpdateTournamentPointsPouch(userId, p.recreational_tournament_points, reasonLabel);
}

/** توزيع نقاط البطولة الترفيهية حسب المراكز. */
function distributeRecreationalTournamentPoints(tournamentId, championTeamId) {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!t || t.type !== 'casual') return;

  const teamCount = db.prepare(
    'SELECT COUNT(*) AS c FROM tournament_teams WHERE tournament_id = ?',
  ).get(tournamentId).c;
  if (teamCount < 2) return;

  const totalRounds = Math.log2(teamCount);
  const qfRoundIndex = totalRounds >= 3 ? totalRounds - 3 : -1;

  const matches = db.prepare(`
    SELECT * FROM tournament_matches WHERE tournament_id = ? ORDER BY round_index ASC, match_index ASC
  `).all(tournamentId);

  const finalMatch = matches.find((m) => {
    const parent = db.prepare(`
      SELECT id FROM tournament_matches
      WHERE tournament_id = ? AND round_index = ? AND match_index = ?
    `).get(tournamentId, m.round_index + 1, Math.floor(m.match_index / 2));
    return !parent;
  });

  let runnerUpTeamId = null;
  if (finalMatch?.winner_team_id) {
    runnerUpTeamId = finalMatch.winner_team_id === finalMatch.team1_id
      ? finalMatch.team2_id
      : finalMatch.team1_id;
  }

  const teams = db.prepare('SELECT id FROM tournament_teams WHERE tournament_id = ?').all(tournamentId);

  for (const { id: teamId } of teams) {
    const members = teamMemberUserIds(teamId);
    if (!members.length) continue;

    let points = REC_TOURNEY_POINTS.EARLY;
    let label = 'مشاركة';

    if (teamId === championTeamId) {
      points = REC_TOURNEY_POINTS.CHAMPION;
      label = 'بطل البطولة';
      for (const uid of members) {
        grantBadge(
          uid,
          `rec_tourney_winner_${tournamentId}`,
          `🏆 بطل ${t.title || 'البطولة'}`,
          '/cards/kingofd.jpg',
        );
      }
    } else if (teamId === runnerUpTeamId) {
      points = REC_TOURNEY_POINTS.RUNNER_UP;
      label = 'الوصيف';
    } else {
      const lastWin = db.prepare(`
        SELECT MAX(round_index) AS ri FROM tournament_matches
        WHERE tournament_id = ? AND winner_team_id = ? AND status = 'completed'
      `).get(tournamentId, teamId)?.ri;
      const lastLoss = db.prepare(`
        SELECT round_index AS ri FROM tournament_matches
        WHERE tournament_id = ? AND status = 'completed'
          AND ((team1_id = ? AND winner_team_id = team2_id) OR (team2_id = ? AND winner_team_id = team1_id))
        ORDER BY round_index DESC LIMIT 1
      `).get(tournamentId, teamId, teamId)?.ri;

      const reachedRound = lastWin != null ? lastWin + 1 : 0;
      if (qfRoundIndex >= 0 && reachedRound >= qfRoundIndex) {
        points = REC_TOURNEY_POINTS.QUARTERFINAL;
        label = 'ربع النهائي';
      } else if (lastLoss != null && qfRoundIndex >= 0 && lastLoss >= qfRoundIndex) {
        points = REC_TOURNEY_POINTS.QUARTERFINAL;
        label = 'ربع النهائي';
      }
    }

    for (const uid of members) {
      addRecTournamentPoints(uid, points, label);
    }
  }
}

module.exports = { distributeRecreationalTournamentPoints, addRecTournamentPoints };
