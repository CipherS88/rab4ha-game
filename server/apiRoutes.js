const express = require('express');
const {
  login,
  register,
  getUserFromToken,
  revokeToken,
  getProfileForUser,
  listGameSessions,
  createGameSession,
  joinGameSession,
  getGameSessionDetail,
  getSessionBagOptions,
  setSessionReady,
  forceStartGameSession,
  leaveGameSession,
  listTournaments,
  createTournament,
  joinTournament,
  getCasualQuota,
  getCasualLimit,
  getInventory,
  updateUserSettings,
  VALID_SIZES,
  VALID_FORMATS,
} = require('./auth');
const {
  getProfileChangeLimits,
  updateDisplayName,
  updateAvatarImage,
  publicAvatarForUser,
  isAvatarRemoved,
} = require('./profileLimits');
const { RANKS } = require('./ranks');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
    || req.headers['x-auth-token'];
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  req.user = user;
  req.token = token;
  next();
}

function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'صلاحية أدمن مطلوبة' });
  next();
}

function createAuthRouter() {
  const router = express.Router();
  router.use(express.json());

  router.post('/login', (req, res) => {
    const { username, login_id, password } = req.body || {};
    const loginId = login_id || username;
    if (!loginId || !password) return res.status(400).json({ error: 'أدخل المعرّف وكلمة المرور' });
    const result = login(String(loginId).trim(), String(password));
    if (result.error) return res.status(401).json({ error: result.error });
    res.json(result);
  });

  router.post('/register', (req, res) => {
    const { display_name, password, password_confirm } = req.body || {};
    if (!display_name || !password) {
      return res.status(400).json({ error: 'أدخل اسم العرض وكلمة المرور' });
    }
    const result = register({ display_name, password, password_confirm });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'];
    if (token) revokeToken(token);
    res.json({ ok: true });
  });

  router.get('/me', authMiddleware, (req, res) => {
    const { getBanInfoForUser, isMuted } = require('./chat');
    const profile = getProfileForUser(req.user);
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        player_code: req.user.player_code || '',
        role: req.user.role,
        is_vip: !!req.user.is_vip,
        display_name: req.user.display_name,
        avatar_url: publicAvatarForUser(req.user),
        avatar_removed: isAvatarRemoved(req.user),
        is_admin: req.user.role === 'admin',
        email: req.user.email || '',
        phone_sa: req.user.phone_sa || '',
      },
      profile,
      profile_limits: getProfileChangeLimits(req.user.id, { isAdmin: req.user.role === 'admin' }),
      ban: getBanInfoForUser(req.user.id),
      chat_mute: {
        public: isMuted(req.user.id, 'public'),
        dm: isMuted(req.user.id, 'dm'),
      },
      casual_quota: { used: getCasualQuota(req.user.id), limit: getCasualLimit(req.user) },
      inventory: getInventory(req.user.id),
    });
  });

  router.patch('/settings', authMiddleware, (req, res) => {
    const { email, phone_sa } = req.body || {};
    const result = updateUserSettings(req.user.id, { email, phone_sa });
    if (result.error) return res.status(400).json({ error: result.error });
    const profile = getProfileForUser(result.user);
    res.json({
      user: {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
        is_vip: !!result.user.is_vip,
        display_name: result.user.display_name,
        avatar_url: publicAvatarForUser(result.user),
        is_admin: result.user.role === 'admin',
        email: result.user.email || '',
        phone_sa: result.user.phone_sa || '',
      },
      profile,
    });
  });

  router.patch('/profile', authMiddleware, (req, res) => {
    const { display_name } = req.body || {};
    const result = updateDisplayName(req.user, display_name);
    if (result.error) return res.status(400).json({ error: result.error });
    const profile = getProfileForUser(result.user);
    res.json({
      user: {
        id: result.user.id,
        username: result.user.username,
        display_name: result.user.display_name,
        avatar_url: publicAvatarForUser(result.user),
      },
      profile,
      profile_limits: profile.profile_limits,
    });
  });

  router.post('/profile/avatar', authMiddleware, (req, res) => {
    const { image } = req.body || {};
    const result = updateAvatarImage(req.user, image);
    if (result.error) return res.status(400).json({ error: result.error });
    const profile = getProfileForUser(result.user);
    res.json({
      user: {
        id: result.user.id,
        display_name: result.user.display_name,
        avatar_url: publicAvatarForUser(result.user),
      },
      profile,
      profile_limits: profile.profile_limits,
    });
  });

  return router;
}

function createSessionsRouter() {
  const router = express.Router();
  router.use(express.json());
  router.use(authMiddleware);

  router.get('/', (req, res) => {
    const filter = req.query.filter || 'open';
    const sessions = listGameSessions(filter, req.user.id);
    res.json({ sessions });
  });

  router.get('/bag-options', (req, res) => {
    res.json(getSessionBagOptions(req.user));
  });

  router.get('/:id', (req, res) => {
    const result = getGameSessionDetail(parseInt(req.params.id, 10), req.user.id);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
  });

  router.post('/', (req, res) => {
    const {
      title, is_open = true, min_rank = 0, min_sub_rank = 0,
      stake = 0, deck_asset_key, bg_asset_key,
    } = req.body || {};
    const session = createGameSession(req.user, {
      title, is_open: !!is_open, min_rank, min_sub_rank, stake, deck_asset_key, bg_asset_key,
    });
    if (session.error) return res.status(400).json({ error: session.error });
    res.json({ session });
  });

  router.post('/:id/join', (req, res) => {
    const seatRaw = req.body?.seat;
    const seat = seatRaw !== undefined && seatRaw !== null ? parseInt(seatRaw, 10) : null;
    const result = joinGameSession(req.user, parseInt(req.params.id, 10), Number.isNaN(seat) ? null : seat);
    if (result.error) return res.status(400).json({ error: result.error });
    const detail = getGameSessionDetail(parseInt(req.params.id, 10), req.user.id);
    res.json(detail);
  });

  router.post('/:id/start', (req, res) => {
    const result = forceStartGameSession(req.user, parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/:id/ready', (req, res) => {
    const ready = req.body?.ready !== false;
    const result = setSessionReady(req.user, parseInt(req.params.id, 10), ready);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/:id/leave', (req, res) => {
    const result = leaveGameSession(req.user, parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.get('/meta/ranks', (_req, res) => {
    res.json({ ranks: RANKS.map((r, i) => ({ index: i, name: r.name })) });
  });

  return router;
}

function createTournamentsRouter() {
  const router = express.Router();
  router.use(express.json());
  router.use(authMiddleware);

  const {
    enterTournamentLobby,
    getTournamentDetail,
  } = require('./tournamentEngine');

  router.get('/', (req, res) => {
    const type = req.query.type || null;
    const tournaments = listTournaments(type, req.user.id);
    const quota = { used: getCasualQuota(req.user.id), limit: getCasualLimit(req.user) };
    res.json({ tournaments, quota, sizes: VALID_SIZES, formats: VALID_FORMATS });
  });

  router.get('/:id', (req, res) => {
    const detail = getTournamentDetail(parseInt(req.params.id, 10), req.user.id);
    if (!detail) return res.status(404).json({ error: 'البطولة غير موجودة' });
    res.json(detail);
  });

  router.post('/:id/enter', (req, res) => {
    const result = enterTournamentLobby(req.user, parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/', (req, res) => {
    const { type, title, size, match_format } = req.body || {};
    const result = createTournament(req.user, { type, title, size: parseInt(size, 10), match_format });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  router.post('/:id/join', (req, res) => {
    const result = joinTournament(req.user, parseInt(req.params.id, 10));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  });

  return router;
}

module.exports = {
  createAuthRouter,
  createSessionsRouter,
  createTournamentsRouter,
  authMiddleware,
  adminMiddleware,
};
