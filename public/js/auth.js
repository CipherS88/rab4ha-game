/** تسجيل الدخول والجلسة */

const AUTH_TOKEN_KEY = 'baloot_auth_token';
const AUTH_USER_KEY = 'baloot_user';

let cachedUser = null;

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthSession(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  cachedUser = user;
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  cachedUser = null;
}

function getCachedUser() {
  if (cachedUser) return cachedUser;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (raw) cachedUser = JSON.parse(raw);
  } catch (_) {}
  return cachedUser;
}

function isLoggedIn() {
  return !!getAuthToken();
}

function isAdmin() {
  return getCachedUser()?.role === 'admin' || getCachedUser()?.is_admin;
}

function formatPlayerCode(code) {
  const c = String(code || '').trim().toUpperCase();
  return c ? `#${c}` : '';
}

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearAuthSession();
    showScreen('login');
    throw new Error('انتهت الجلسة — سجّل دخولك مجدداً');
  }
  return res;
}

async function parseAuthResponse(res, fallbackError) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    if (res.status === 404) {
      throw new Error('السيرفر قديم — أعد تشغيله ثم حدّث الصفحة');
    }
    throw new Error('استجابة غير متوقعة من السيرفر — تأكد أنك تفتح اللعبة من localhost وليس ملف HTML مباشرة');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || fallbackError);
  return data;
}

async function loginUser(loginId, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: loginId, password }),
  });
  const data = await parseAuthResponse(res, 'فشل تسجيل الدخول');
  setAuthSession(data.token, data.user);
  if (data.profile) cachedProfile = data.profile;
  return data;
}

async function registerUser({ display_name, password, password_confirm }) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name, password, password_confirm }),
  });
  const data = await parseAuthResponse(res, 'فشل إنشاء الحساب');
  setAuthSession(data.token, data.user);
  if (data.profile) cachedProfile = data.profile;
  return data;
}

async function logoutUser() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
  clearAuthSession();
  cachedProfile = null;
}

async function fetchMe() {
  const res = await apiFetch('/api/auth/me');
  if (!res.ok) throw new Error('فشل تحميل الحساب');
  const data = await res.json();
  setAuthSession(getAuthToken(), data.user);
  cachedProfile = data.profile;
  return data;
}

function switchAuthTab(tab) {
  $$('.auth-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.authTab === tab));
  $$('.auth-panel').forEach((panel) => {
    const isActive = panel.dataset.authPanel === tab;
    panel.classList.toggle('hidden', !isActive);
    panel.classList.toggle('active', isActive);
  });
  $('#login-error').textContent = '';
  $('#register-error').textContent = '';
  const regOk = $('#register-success');
  if (regOk) {
    regOk.textContent = '';
    regOk.classList.add('hidden');
  }
}

function wireLoginForm() {
  $$('.auth-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
  });

  const form = $('#login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginId = $('#login-id')?.value?.trim();
      const password = $('#login-password')?.value || '';
      const errEl = $('#login-error');
      const btn = $('#btn-login');
      if (errEl) errEl.textContent = '';
      btn.disabled = true;
      try {
        await loginUser(loginId, password);
        await initHome();
      } catch (err) {
        if (errEl) errEl.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
  }

  const regForm = $('#register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = $('#register-error');
      const okEl = $('#register-success');
      const btn = $('#btn-register');
      if (errEl) errEl.textContent = '';
      if (okEl) {
        okEl.textContent = '';
        okEl.classList.add('hidden');
      }
      btn.disabled = true;
      try {
        const data = await registerUser({
          display_name: $('#register-display-name')?.value?.trim(),
          password: $('#register-password')?.value || '',
          password_confirm: $('#register-password-confirm')?.value || '',
        });
        const code = formatPlayerCode(data.user?.player_code);
        if (typeof showHomeToast === 'function') {
          showHomeToast(`تم إنشاء حسابك — معرّفك ${code}`);
        }
        await initHome();
      } catch (err) {
        if (errEl) errEl.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
  }

  $$('.quick-login').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchAuthTab('login');
      $('#login-id').value = btn.dataset.user;
      $('#login-password').value = btn.dataset.pass;
      form?.requestSubmit();
    });
  });
}

async function ensureAuth() {
  if (!isLoggedIn()) {
    showScreen('login');
    return false;
  }
  try {
    const data = await fetchMe();
    if (data.ban?.banned) {
      alert(data.ban.reason || 'حسابك محظور');
      await logoutUser();
      showScreen('login');
      return false;
    }
    return true;
  } catch (_) {
    clearAuthSession();
    showScreen('login');
    return false;
  }
}

document.addEventListener('DOMContentLoaded', wireLoginForm);
