const express = require('express');
const {
  listTournaments,
  VALID_SIZES,
  VALID_FORMATS,
} = require('./auth');
const {
  listProTournamentsAdmin,
  listAllTournamentsAdmin,
  createProTournamentAdmin,
  updateProTournamentAdmin,
  deleteProTournamentAdmin,
  deleteTournamentAdmin,
  closeTournamentAdmin,
  closeAllOpenTournamentsAdmin,
} = require('./adminTournaments');
const {
  listAllSessionsAdmin,
  closeSessionAdmin,
  deleteSessionAdmin,
  closeAllOpenSessionsAdmin,
} = require('./adminSessions');
const {
  STORE_CATEGORIES,
  listStoreProducts,
  getStoreProduct,
  createStoreProduct,
  updateStoreProduct,
  deleteStoreProduct,
} = require('./store');
const { getBag, purchaseWithCoins, markProductsOwned, getPlayerShowcase } = require('./bag');
const { listUsersAdmin, updateUserFlags } = require('./playerMeta');
const { adminGrantGift } = require('./adminUsers');
const { authMiddleware, adminMiddleware } = require('./apiRoutes');
const { listReports, resolveReport, listBannedUsers, unbanUser } = require('./chat');
const { saveUploadedImage } = require('./uploads');
const { listCategoryAssets, saveStoreAssetImage, saveStoreAssetBuffer } = require('./assetFolders');
const { getHomeLayout, saveHomeLayout, resetHomeLayout } = require('./homeLayout');
const { getGameLayout, saveGameLayout, resetGameLayout } = require('./gameLayout');

function createAdminRouter(gameManager) {
  const router = express.Router();
  router.use(authMiddleware);
  router.use(adminMiddleware);

  router.post(
    '/store/upload-asset-file',
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream'], limit: '55mb' }),
    (req, res) => {
      const category = req.query.category || req.headers['x-asset-category'];
      const originalName = req.query.name || req.headers['x-asset-name'] || 'asset';
      if (!category) return res.status(400).json({ error: 'القسم مطلوب' });
      const result = saveStoreAssetBuffer(req.body, req.headers['content-type'], category, originalName);
      if (result.error) return res.status(400).json({ error: result.error });
      res.json(result);
    },
  );

  router.use(express.json({ limit: '75mb' }));

  router.post('/upload', (req, res) => {
    const { data, folder } = req.body || {};
    const result = saveUploadedImage(data, folder || 'products');
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.get('/home-layout', (_req, res) => {
    res.json({ layout: getHomeLayout() });
  });

  router.put('/home-layout', (req, res) => {
    const result = saveHomeLayout(req.body?.layout || req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.delete('/home-layout', (_req, res) => {
    res.json(resetHomeLayout());
  });

  router.get('/game-layout', (_req, res) => {
    res.json({ layout: getGameLayout() });
  });

  router.put('/game-layout', (req, res) => {
    const result = saveGameLayout(req.body?.layout || req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.delete('/game-layout', (_req, res) => {
    res.json(resetGameLayout());
  });

  router.post('/sandbox/start', (req, res) => {
    if (!gameManager) return res.status(500).json({ error: 'الخادم غير جاهز' });
    const roomId = gameManager.resetSandboxRoom(req.user.id);
    res.json({ roomId, sandboxMode: true });
  });

  router.get('/tournaments', (req, res) => {
    const type = req.query.type || null;
    res.json({
      tournaments: listAllTournamentsAdmin({ type }),
      sizes: VALID_SIZES,
      formats: VALID_FORMATS,
    });
  });

  router.post('/tournaments', (req, res) => {
    const result = createProTournamentAdmin(req.user, req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.put('/tournaments/:id', (req, res) => {
    const result = updateProTournamentAdmin(parseInt(req.params.id, 10), req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.delete('/tournaments/:id', (req, res) => {
    const result = deleteTournamentAdmin(parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/tournaments/:id/close', (req, res) => {
    const result = closeTournamentAdmin(parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/tournaments/close-all', (_req, res) => {
    const result = closeAllOpenTournamentsAdmin();
    res.json(result);
  });

  router.get('/sessions', (_req, res) => {
    res.json({ sessions: listAllSessionsAdmin() });
  });

  router.post('/sessions/:id/close', (req, res) => {
    const result = closeSessionAdmin(parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.delete('/sessions/:id', (req, res) => {
    const result = deleteSessionAdmin(parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/sessions/close-all', (_req, res) => {
    const result = closeAllOpenSessionsAdmin();
    res.json(result);
  });

  router.get('/store/categories', (_req, res) => {
    res.json({ categories: Object.values(STORE_CATEGORIES) });
  });

  router.get('/store/assets', (req, res) => {
    const category = req.query.category || 'cards';
    const result = listCategoryAssets(category, { storePicker: true });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/store/upload-asset', (req, res) => {
    const { data, category, original_name } = req.body || {};
    if (!category) return res.status(400).json({ error: 'القسم مطلوب' });
    const result = saveStoreAssetImage(data, category, original_name || '');
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.get('/store/products', (req, res) => {
    const category = req.query.category || null;
    res.json({ products: listStoreProducts({ category, admin: true }) });
  });

  router.post('/store/products', (req, res) => {
    const result = createStoreProduct(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.put('/store/products/:id', (req, res) => {
    const result = updateStoreProduct(parseInt(req.params.id, 10), req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.delete('/store/products/:id', (req, res) => {
    const result = deleteStoreProduct(parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.get('/chat/reports', (req, res) => {
    const status = req.query.status || 'pending';
    res.json({ reports: listReports(status) });
  });

  router.post('/chat/reports/:id/resolve', (req, res) => {
    const result = resolveReport(req.user.id, parseInt(req.params.id, 10), req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.get('/chat/banned', (_req, res) => {
    res.json({ users: listBannedUsers() });
  });

  router.post('/chat/banned/:userId/unban', (req, res) => {
    const result = unbanUser(parseInt(req.params.userId, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.get('/users', (_req, res) => {
    res.json({ users: listUsersAdmin() });
  });

  router.patch('/users/:id', (req, res) => {
    const result = updateUserFlags(parseInt(req.params.id, 10), req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.get('/online', (_req, res) => {
    const players = gameManager ? gameManager.listOnlinePlayers() : [];
    res.json({ players });
  });

  router.post('/gifts', (req, res) => {
    const { user_id, coins, gems, product_id, rental_days, vip_days, message } = req.body || {};
    const targetId = parseInt(user_id, 10);
    if (!targetId) return res.status(400).json({ error: 'معرّف اللاعب مطلوب' });
    const result = adminGrantGift(targetId, {
      coins, gems, product_id, rental_days, vip_days, message,
    }, req.user);
    if (result.error) return res.status(400).json({ error: result.error });
    if (result.gift && req.app.locals.broadcastGift) {
      req.app.locals.broadcastGift(targetId, result.gift);
    }
    res.json(result);
  });

  return router;
}

function createStoreRouter() {
  const router = express.Router();
  router.use(express.json());

  router.get('/categories', (_req, res) => {
    res.json({ categories: Object.values(STORE_CATEGORIES) });
  });

  router.get('/products', authMiddleware, (req, res) => {
    const category = req.query.category || null;
    const products = markProductsOwned(req.user.id, listStoreProducts({ category, admin: false }));
    res.json({ products });
  });

  router.get('/products/:id', (req, res) => {
    const p = getStoreProduct(parseInt(req.params.id, 10));
    if (!p) return res.status(404).json({ error: 'غير موجود' });
    res.json({ product: p });
  });

  router.post('/purchase/:id', authMiddleware, (req, res) => {
    const result = purchaseWithCoins(req.user, parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.get('/showcase', authMiddleware, (req, res) => {
    res.json(getPlayerShowcase(req.user.id));
  });

  router.get('/bag', authMiddleware, (req, res) => {
    res.json(getBag(req.user.id));
  });

  router.post('/equip', authMiddleware, (req, res) => {
    const { category, asset_key } = req.body || {};
    const { equipItem } = require('./bag');
    const result = equipItem(req.user, category, asset_key);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  return router;
}

module.exports = { createAdminRouter, createStoreRouter };
