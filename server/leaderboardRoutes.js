const express = require('express');
const { authMiddleware } = require('./apiRoutes');
const { getLeaderboard, getAllLeaderboards } = require('./leaderboards');

function createLeaderboardsRouter() {
  const router = express.Router();
  router.use(authMiddleware);

  router.get('/', (req, res) => {
    res.json(getAllLeaderboards(req.user.id));
  });

  router.get('/:type', (req, res) => {
    const data = getLeaderboard(req.params.type, req.user.id);
    if (!data) return res.status(400).json({ error: 'قسم غير معروف' });
    res.json(data);
  });

  return router;
}

module.exports = { createLeaderboardsRouter };
