const express = require('express');
const { authMiddleware } = require('./apiRoutes');
const { saveUploadedImage } = require('./uploads');
const {
  getPublicHistory,
  getDmThread,
  listDmConversations,
  sendMessage,
  playerRowToCard,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  listFriends,
  blockUser,
  unblockUser,
  createReport,
  DM_TTL_HOURS,
} = require('./chat');
const { getGiftOptions } = require('./gifts');

function createChatRouter() {
  const router = express.Router();
  router.use(express.json());
  router.use(authMiddleware);

  router.get('/meta', (_req, res) => {
    res.json({ dm_ttl_hours: DM_TTL_HOURS });
  });

  router.get('/public', (req, res) => {
    res.json({ messages: getPublicHistory(req.user.id) });
  });

  router.post('/public', (req, res) => {
    const { body, reply_to_id, image_url } = req.body || {};
    const result = sendMessage(req.user.id, {
      channel: 'public',
      body,
      imageUrl: image_url,
      replyToId: reply_to_id,
    });
    if (result.error) {
      const code = result.profanityStrike?.banned ? 403 : 400;
      return res.status(code).json(result);
    }
    res.json(result);
    if (req.app.locals.broadcastChat) {
      req.app.locals.broadcastChat('public', result.message, req.user.id);
    }
  });

  router.get('/dm', (req, res) => {
    res.json({ conversations: listDmConversations(req.user.id) });
  });

  router.get('/dm/:userId', (req, res) => {
    const otherId = parseInt(req.params.userId, 10);
    const result = getDmThread(req.user.id, otherId);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/dm/:userId', (req, res) => {
    const otherId = parseInt(req.params.userId, 10);
    const { body, reply_to_id, image_url } = req.body || {};
    const result = sendMessage(req.user.id, {
      channel: 'dm',
      recipientId: otherId,
      body,
      imageUrl: image_url,
      replyToId: reply_to_id,
    });
    if (result.error) {
      const code = result.profanityStrike?.banned ? 403 : 400;
      return res.status(code).json(result);
    }
    res.json(result);
    if (req.app.locals.broadcastChat) {
      req.app.locals.broadcastChat('dm', result.message, req.user.id, otherId);
    }
  });

  router.get('/users/:userId', (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const card = playerRowToCard(userId, req.user.id);
    if (!card) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ user: card, gift_options: getGiftOptions(req.user.id) });
  });

  router.get('/friends', (req, res) => {
    res.json(listFriends(req.user.id));
  });

  router.post('/friends/:userId/request', (req, res) => {
    const result = sendFriendRequest(req.user.id, parseInt(req.params.userId, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/friends/:userId/accept', (req, res) => {
    const result = acceptFriendRequest(req.user.id, parseInt(req.params.userId, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.delete('/friends/:userId', (req, res) => {
    res.json(removeFriend(req.user.id, parseInt(req.params.userId, 10)));
  });

  router.post('/block/:userId', (req, res) => {
    const result = blockUser(req.user.id, parseInt(req.params.userId, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.delete('/block/:userId', (req, res) => {
    res.json(unblockUser(req.user.id, parseInt(req.params.userId, 10)));
  });

  router.post('/report', (req, res) => {
    const { reported_user_id, message_id, report_type, details } = req.body || {};
    const result = createReport(req.user.id, {
      reportedUserId: reported_user_id,
      messageId: message_id,
      reportType: report_type,
      details,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/upload', (req, res) => {
    const { data } = req.body || {};
    const result = saveUploadedImage(data, 'chat');
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  return router;
}

module.exports = { createChatRouter };
