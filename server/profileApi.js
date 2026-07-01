const express = require('express');
const {
  getOrCreatePlayer,
  savePlayer,
  logMatch,
  updatePlayerName,
} = require('./db');
const {
  applyMatchResult,
  getRankInfo,
  POINTS_WIN,
  POINTS_LOSS,
  REDUCED_WIN_POINTS,
} = require('./ranks');
const { recordWeeklyRankPoints, userIdFromDeviceId } = require('./leaderboards');

function createProfileRouter() {
  const router = express.Router();
  router.use(express.json());

  router.get('/profile/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    if (!deviceId || deviceId.length < 8) {
      return res.status(400).json({ error: 'معرّف جهاز غير صالح' });
    }
    const profile = getOrCreatePlayer(deviceId);
    res.json({ profile });
  });

  router.patch('/profile/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const { name } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'معرّف غير صالح' });
    const profile = updatePlayerName(deviceId, name);
    res.json({ profile });
  });

  router.post('/profile/:deviceId/match-result', (req, res) => {
    const { deviceId } = req.params;
    const { won, mode = 'ranked', coinsDelta = 0 } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'معرّف غير صالح' });
    if (typeof won !== 'boolean') return res.status(400).json({ error: 'نتيجة غير صالحة' });

    if (mode !== 'ranked') {
      const profile = getOrCreatePlayer(deviceId);
      return res.json({
        profile,
        pointsDelta: 0,
        rankedUp: false,
      });
    }

    const current = getOrCreatePlayer(deviceId);
    const before = getRankInfo(current.rank, current.sub_rank).fullLabel;
    const pointsDelta = won
      ? (current.reduced_next_win ? REDUCED_WIN_POINTS : POINTS_WIN)
      : -POINTS_LOSS;

    let updated = applyMatchResult({ ...current }, won);
    if (coinsDelta) updated.coins = Math.max(0, updated.coins + coinsDelta);
    else updated.coins += won ? 50 : -20;

    if (mode === 'ranked' && won) {
      /* نقاط البطولات تُمنح عند الفوز ببطولة — ليس عشوائياً */
    }

    savePlayer(updated);
    const after = getRankInfo(updated.rank, updated.sub_rank).fullLabel;
    logMatch(deviceId, mode, won, pointsDelta, before, after);

    const userId = userIdFromDeviceId(deviceId);
    if (userId) recordWeeklyRankPoints(userId, pointsDelta, won);

    const profile = getOrCreatePlayer(deviceId);
    res.json({
      profile,
      pointsDelta,
      rankedUp: before !== after,
    });
  });

  return router;
}

module.exports = { createProfileRouter };
