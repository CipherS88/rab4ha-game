const express = require('express');
const { authMiddleware } = require('./apiRoutes');
const {
  sendPlayerGift,
  listPendingGifts,
  markGiftSeen,
  getGiftOptions,
} = require('./gifts');

function createGiftsRouter() {
  const router = express.Router();
  router.use(express.json());
  router.use(authMiddleware);

  router.get('/options', (req, res) => {
    res.json({ options: getGiftOptions(req.user.id) });
  });

  router.get('/pending', (req, res) => {
    res.json({ gifts: listPendingGifts(req.user.id) });
  });

  router.post('/:giftId/seen', (req, res) => {
    const giftId = parseInt(req.params.giftId, 10);
    if (!giftId) return res.status(400).json({ error: 'معرّف غير صالح' });
    const seen = markGiftSeen(giftId, req.user.id);
    res.json({ ok: true, seen });
  });

  router.post('/', (req, res) => {
    const { to_user_id, type, amount, message } = req.body || {};
    const toUserId = parseInt(to_user_id, 10);
    if (!toUserId) return res.status(400).json({ error: 'المستلم مطلوب' });
    const result = sendPlayerGift(req.user.id, toUserId, { type, amount, message });
    if (result.error) return res.status(400).json({ error: result.error });
    if (req.app.locals.broadcastGift) {
      req.app.locals.broadcastGift(toUserId, result.gift);
    }
    res.json(result);
  });

  return router;
}

module.exports = { createGiftsRouter };
