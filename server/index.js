const express = require('express');
const fs = require('fs');
const { isAllowedQuickChat } = require('./quickChat');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { GameManager } = require('./gameManager');
const { createProfileRouter } = require('./profileApi');
const { createAuthRouter, createSessionsRouter, createTournamentsRouter } = require('./apiRoutes');
const { createAdminRouter, createStoreRouter } = require('./adminRoutes');
const { initAuthSchema, handleRankedForfeit } = require('./auth');
const { initStoreSchema, migrateTournamentColumns, migrateStoreGlobals, syncManualStoreProducts } = require('./store');
const { migrateInventoryColumns, migrateBagColumns } = require('./bag');
const { initProfileLimitsSchema } = require('./profileLimits');
const { initChatSchema, purgeExpiredDm } = require('./chat');
const { createChatRouter } = require('./chatRoutes');
const { createGiftsRouter } = require('./giftRoutes');
const { initGiftsSchema } = require('./gifts');
const { initTournamentEngineSchema, syncAllTournaments, setTournamentGameManager } = require('./tournamentEngine');
const { initLeaderboardsSchema, processWeekRollover } = require('./leaderboards');
const { initPlayRadarSchema } = require('./playRadar');
const { createLeaderboardsRouter } = require('./leaderboardRoutes');
const { wireChatSocket } = require('./chatSocket');
const { ensureUploadDirs } = require('./uploads');
const { ensureAssetDirs } = require('./assetFolders');
const { DB_PATH } = require('./db');
const { getHomeLayout } = require('./homeLayout');
const { getGameLayout } = require('./gameLayout');

initAuthSchema();
initStoreSchema();
migrateTournamentColumns();
migrateInventoryColumns();
migrateBagColumns();
migrateStoreGlobals();
syncManualStoreProducts();
initProfileLimitsSchema();
ensureUploadDirs();
ensureAssetDirs();
initChatSchema();
initGiftsSchema();
initTournamentEngineSchema();
initLeaderboardsSchema();
initPlayRadarSchema();
purgeExpiredDm();
setInterval(purgeExpiredDm, 60 * 60 * 1000);
setInterval(syncAllTournaments, 5000);
setInterval(processWeekRollover, 60 * 60 * 1000);
processWeekRollover();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// CORS — مطلوب لـ Flutter Web (منفذ dev أو /app/)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '75mb' }));

const CARDS_PATH = path.join(__dirname, '..', 'الملفات', 'cards');
const BG_PATH = path.join(__dirname, '..', 'الملفات', 'roomsbackground');
const PUBLIC_PATH = path.join(__dirname, '..', 'public');
const FLUTTER_WEB_PATH = path.join(__dirname, '..', 'rab4ha_flutter', 'build', 'web');

const gameManager = new GameManager();
// اربط مدير اللعبة بمحرك البطولات لإنشاء غرف المباريات الحقيقية عند بدء البطولة.
setTournamentGameManager(gameManager);

app.use('/api/admin', createAdminRouter(gameManager));
app.use('/api/auth', createAuthRouter());
app.use('/api/sessions', createSessionsRouter());
app.use('/api/tournaments', createTournamentsRouter());
app.use('/api/store', createStoreRouter());
app.use('/api/chat', createChatRouter());
app.use('/api/gifts', createGiftsRouter());
app.use('/api/leaderboards', createLeaderboardsRouter());
app.get('/api/home-layout', (_req, res) => {
  res.json({ layout: getHomeLayout() });
});
app.get('/api/game-layout', (_req, res) => {
  res.json({ layout: getGameLayout() });
});
app.use('/api', createProfileRouter());
app.get('/x-rb4ha-panel', (_req, res) => {
  res.sendFile(path.join(PUBLIC_PATH, 'admin.html'));
});
app.use(express.static(PUBLIC_PATH));
app.use('/cards', express.static(CARDS_PATH));
app.use('/backgrounds', express.static(BG_PATH));

// Flutter client — http://localhost:3000/app/
if (fs.existsSync(FLUTTER_WEB_PATH)) {
  app.use('/app', express.static(FLUTTER_WEB_PATH));
  app.get('/app/*', (_req, res) => {
    res.sendFile(path.join(FLUTTER_WEB_PATH, 'index.html'));
  });
  console.log(`   Flutter app: http://localhost:${process.env.PORT || 3000}/app/`);
}

gameManager.setIO(io);
gameManager.setRankedForfeitHandler((result) => {
  handleRankedForfeit({
    leaverUserId: result.leaverUserId,
    winnerUserIds: result.winnerUserIds,
  });
});
wireChatSocket(io, app);

io.on('connection', (socket) => {
  socket.on('join', (data, cb) => {
    const result = gameManager.joinRoom(socket, data);
    if (typeof cb === 'function') cb(result);
  });

  socket.on('bid', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    const result = room.handleBid(seat, data.action, data.suit, data.locked);
    cb?.(result);
  });

  socket.on('play_card', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    const result = room.handlePlayCard(
      seat,
      data.cardIndex,
      data.projects,
      data.playMs,
      data.is_ekkah_declared,
    );
    cb?.(result);
  });

  socket.on('declare_project', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    const result = room.handleDeclareProject(seat, data.name);
    cb?.(result);
  });

  socket.on('qaid_start', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data?.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    cb?.(room.handleQaidStart(seat));
  });

  socket.on('qaid_update', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data?.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    cb?.(room.handleQaidUpdate(seat, { reason: data.reason, cards: data.cards }));
  });

  socket.on('qaid_submit', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data?.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    cb?.(room.handleQaidSubmit(seat, data.reason, data.cards));
  });

  socket.on('qaid_cancel', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data?.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    cb?.(room.handleQaidCancel(seat));
  });

  socket.on('qaid', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    const result = room.handleQaid(seat, data.reason, data.cards);
    cb?.(result);
  });

  socket.on('sawa', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = gameManager.resolveSeat(socket, data?.actAs);
    if (seat < 0) return cb?.({ error: 'مقعد غير صالح' });
    const result = room.handleSawa(seat);
    cb?.(result);
  });

  socket.on('fill_bots', (data, cb) => {
    const ack = typeof cb === 'function' ? cb : (typeof data === 'function' ? data : null);
    const room = gameManager.getRoom(socket);
    if (!room) return ack?.({ error: 'غير متصل' });
    const result = room.fillBots();
    ack?.(result?.error ? result : { ok: true });
  });

  socket.on('table_gift', (data, cb) => {
    const room = gameManager.getRoom(socket);
    if (!room) return cb?.({ error: 'غير متصل' });
    const seat = room.findSeatBySocket(socket.id);
    if (seat < 0) {
      // مشاهد يرسل هدية للاعبين على الطاولة
      if (room.isSpectator(socket.id)) {
        return cb?.(room.handleSpectatorGift(socket.id, data));
      }
      return cb?.({ error: 'مقعد غير صالح' });
    }
    const result = room.handleTableGift(seat, data);
    cb?.(result);
  });

  socket.on('chat', (data) => {
    const room = gameManager.getRoom(socket);
    if (!room) return;
    const seat = room.findSeatBySocket(socket.id);
    if (seat < 0) return;
    const text = String(data?.text || '').trim();
    if (!isAllowedQuickChat(text)) return;
    room.addChat(seat, text);
  });

  socket.on('leave_game', (_data, cb) => {
    const result = gameManager.leaveRoom(socket, { intentional: true });
    cb?.({ ok: true, result });
  });

  socket.on('disconnect', () => {
    gameManager.leaveRoom(socket, { intentional: false });
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`\n🃏 Baloot Server running at http://localhost:${PORT}`);
  console.log(`   Network: http://<your-ip>:${PORT}`);
  console.log(`   Cards: ${CARDS_PATH}`);
  console.log(`   Database: ${DB_PATH}\n`);
});
