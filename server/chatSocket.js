const { getUserFromToken } = require('./auth');
const { isBanned, sendMessage, getPublicHistory } = require('./chat');
const { listPendingGifts } = require('./gifts');

function wireChatSocket(io, app) {
  const userSockets = new Map();

  app.locals.broadcastChat = (channel, message, senderId, recipientId) => {
    if (channel === 'public') {
      io.to('chat:public').emit('chat:message', { channel: 'public', message });
      return;
    }
    if (channel === 'dm' && recipientId) {
      io.to(`chat:user:${senderId}`).emit('chat:message', { channel: 'dm', message });
      io.to(`chat:user:${recipientId}`).emit('chat:message', { channel: 'dm', message });
    }
  };

  app.locals.broadcastGift = (toUserId, gift) => {
    io.to(`chat:user:${toUserId}`).emit('gift:received', { gift });
  };

  io.on('connection', (socket) => {
    socket.on('chat:auth', (data, cb) => {
      const token = data?.token;
      const user = getUserFromToken(token);
      if (!user) return cb?.({ error: 'يجب تسجيل الدخول' });
      if (isBanned(user.id)) {
        return cb?.({ error: 'حسابك محظور — ممنوع الشات واللعب' });
      }
      socket.chatUserId = user.id;
      socket.join('chat:public');
      socket.join(`chat:user:${user.id}`);

      if (!userSockets.has(user.id)) userSockets.set(user.id, new Set());
      userSockets.get(user.id).add(socket.id);

      cb?.({ ok: true, messages: getPublicHistory(user.id, 50), pending_gifts: listPendingGifts(user.id) });
    });

    socket.on('chat:send_public', (data, cb) => {
      if (!socket.chatUserId) return cb?.({ error: 'غير مصرّح' });
      const result = sendMessage(socket.chatUserId, {
        channel: 'public',
        body: data?.body,
        imageUrl: data?.image_url,
        replyToId: data?.reply_to_id,
      });
      if (result.error) {
        const code = result.profanityStrike?.banned ? 'banned' : 'error';
        return cb?.({ error: result.error, code, profanityStrike: result.profanityStrike });
      }
      io.to('chat:public').emit('chat:message', { channel: 'public', message: result.message });
      cb?.({ ok: true, message: result.message });
    });

    socket.on('chat:send_dm', (data, cb) => {
      if (!socket.chatUserId) return cb?.({ error: 'غير مصرّح' });
      const recipientId = parseInt(data?.recipient_id, 10);
      const result = sendMessage(socket.chatUserId, {
        channel: 'dm',
        recipientId,
        body: data?.body,
        imageUrl: data?.image_url,
        replyToId: data?.reply_to_id,
      });
      if (result.error) {
        const code = result.profanityStrike?.banned ? 'banned' : 'error';
        return cb?.({ error: result.error, code, profanityStrike: result.profanityStrike });
      }
      io.to(`chat:user:${socket.chatUserId}`).emit('chat:message', { channel: 'dm', message: result.message });
      io.to(`chat:user:${recipientId}`).emit('chat:message', { channel: 'dm', message: result.message });
      cb?.({ ok: true, message: result.message });
    });

    socket.on('disconnect', () => {
      if (!socket.chatUserId) return;
      const set = userSockets.get(socket.chatUserId);
      if (set) {
        set.delete(socket.id);
        if (!set.size) userSockets.delete(socket.chatUserId);
      }
    });
  });
}

module.exports = { wireChatSocket };
