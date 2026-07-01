const TOKEN_KEY = 'baloot_admin_token';
const USER_KEY = 'baloot_admin_user';

let token = localStorage.getItem(TOKEN_KEY);
let storeCatFilter = 'all';
let tournamentTypeFilter = 'all';
let editingTournamentId = null;
let editingProductId = null;
let giftProductsCache = [];

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return [...document.querySelectorAll(sel)]; }

function toast(msg) {
  const el = $('#admin-toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { error: res.status === 413 ? 'حجم الصورة كبير جداً — الحد الأقصى 50 ميجا' : `خطأ ${res.status}` };
  }
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error(data.error || 'غير مصرح');
  }
  if (!res.ok) throw new Error(data.error || `فشل الطلب (${res.status})`);
  return data;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

async function uploadFileIfSelected(fileInputId, folder) {
  const input = $(fileInputId);
  if (!input?.files?.[0]) return null;
  const file = input.files[0];
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('حجم الصورة أكبر من 50 ميجا — صغّرها أو استخدم JPG مضغوط');
  }
  const data = await readFileAsDataUrl(file);
  const res = await api('/api/admin/upload', {
    method: 'POST',
    body: JSON.stringify({ data, folder }),
  });
  return res.url;
}

function showApp() {
  $('#admin-login').classList.remove('active');
  $('#admin-app').classList.add('active');
  const user = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  $('#admin-user-label').textContent = user.display_name || user.username || '';
  loadTournaments();
}

function logout() {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  $('#admin-app').classList.remove('active');
  $('#admin-login').classList.add('active');
}

$('#admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = $('#admin-login-error');
  errEl.textContent = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login_id: $('#admin-user').value.trim(),
        password: $('#admin-pass').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.user.role !== 'admin' && !data.user.is_admin) {
      throw new Error('هذا الحساب ليس أدمن — استخدم npm run admin:promote');
    }
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

$('#admin-logout').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
  logout();
});

$$('.admin-nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.admin-nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.admin-section').forEach((s) => s.classList.remove('active'));
    $(`#section-${btn.dataset.section}`).classList.add('active');
    if (btn.dataset.section === 'store') loadProducts();
    if (btn.dataset.section === 'tournaments') loadTournaments();
    if (btn.dataset.section === 'sessions') loadSessions();
    if (btn.dataset.section === 'users') loadUsersAdmin();
    if (btn.dataset.section === 'online') loadOnlinePlayers();
    if (btn.dataset.section === 'chat') loadChatReports();
    if (btn.dataset.section === 'banned') loadBannedUsers();
  });
});

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setImagePreview(previewId, hiddenId, fileInputId, url) {
  const preview = $(previewId);
  const hidden = $(hiddenId);
  const fileInput = $(fileInputId);
  if (hidden) hidden.value = url || '';
  if (fileInput) fileInput.value = '';
  if (url && preview) {
    preview.src = url;
    preview.classList.remove('hidden');
  } else if (preview) {
    preview.classList.add('hidden');
    preview.removeAttribute('src');
  }
}

// ---- Tournaments ----
const TOURNAMENT_STATUS_LABELS = {
  registration: 'تسجيل مفتوح',
  active: 'جارية',
  finished: 'منتهية',
  closed: 'مغلقة',
};

const SESSION_STATUS_LABELS = {
  waiting: 'بانتظار لاعبين',
  full: 'ممتلئة',
  closed: 'مغلقة',
};

$$('.tournament-filter-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.tournament-filter-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    tournamentTypeFilter = btn.dataset.type;
    loadTournaments();
  });
});

async function loadTournaments() {
  const list = $('#tournaments-admin-list');
  list.innerHTML = '<p>جاري التحميل...</p>';
  try {
    const q = tournamentTypeFilter === 'all' ? '' : `?type=${tournamentTypeFilter}`;
    const data = await api(`/api/admin/tournaments${q}`);
    renderTournaments(data.tournaments || []);
  } catch (e) {
    list.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

function renderTournaments(items) {
  const list = $('#tournaments-admin-list');
  if (!items.length) {
    list.innerHTML = '<p style="color:#94a3b8">لا توجد بطولات</p>';
    return;
  }
  list.innerHTML = '';
  items.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'admin-card';
    const thumb = t.image_url
      ? `<img class="admin-card-thumb" src="${esc(t.image_url)}" alt="" />`
      : '<div class="admin-card-thumb"></div>';
    const sponsor = t.sponsor_name
      ? (t.sponsor_url
        ? `<a href="${esc(t.sponsor_url)}" target="_blank" rel="noopener">${esc(t.sponsor_name)}</a>`
        : esc(t.sponsor_name))
      : '—';
    const statusLabel = TOURNAMENT_STATUS_LABELS[t.status] || t.status;
    const canClose = t.status === 'registration' || t.status === 'active';
    card.innerHTML = `
      ${thumb}
      <div class="admin-card-body">
        <h3>${esc(t.title)} <span class="badge ${t.type === 'pro' ? 'active' : ''}">${esc(t.type_label || t.type)}</span></h3>
        <div class="admin-card-meta">
          <span>#${t.id}</span>
          <span>${t.entry_count}/${t.size} لاعب</span>
          <span>${esc(t.format_label)}</span>
          <span>الحالة: ${esc(statusLabel)}</span>
          <span>المنشئ: ${esc(t.creator_name || '—')}</span>
          ${t.type === 'pro' ? `<span>راعي: ${sponsor}</span>` : ''}
        </div>
        <div class="admin-card-actions">
          ${t.type === 'pro' ? '<button class="btn-edit">تعديل</button>' : ''}
          ${canClose ? '<button class="btn-warn btn-close">إغلاق</button>' : ''}
          <button class="btn-delete">حذف</button>
        </div>
      </div>
    `;
    card.querySelector('.btn-edit')?.addEventListener('click', () => openTournamentForm(t));
    card.querySelector('.btn-close')?.addEventListener('click', () => closeTournament(t.id));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteTournament(t.id));
    list.appendChild(card);
  });
}

async function closeTournament(id) {
  if (!confirm('إغلاق هذه البطولة؟')) return;
  try {
    await api(`/api/admin/tournaments/${id}/close`, { method: 'POST' });
    toast('تم إغلاق البطولة');
    loadTournaments();
  } catch (e) {
    toast(e.message);
  }
}

function openTournamentForm(t = null) {
  editingTournamentId = t?.id || null;
  $('#tournament-form-title').textContent = t ? 'تعديل بطولة' : 'بطولة احترافية جديدة';
  $('#ta-title').value = t?.title || '';
  $('#ta-status').value = t?.status || 'registration';
  $('#ta-size').value = String(t?.size || 8);
  $('#ta-format').value = t?.match_format || 'bo1';
  setImagePreview('#ta-image-preview', '#ta-image', '#ta-image-file', t?.image_url || '');
  setImagePreview('#ta-banner-preview', '#ta-banner', '#ta-banner-file', t?.banner_url || '');
  $('#ta-sponsor').value = t?.sponsor_name || '';
  $('#ta-sponsor-url').value = t?.sponsor_url || '';
  $('#tournament-form-modal').classList.remove('hidden');
}

$('#btn-new-tournament').addEventListener('click', () => openTournamentForm());
$('#btn-close-all-tournaments')?.addEventListener('click', async () => {
  if (!confirm('إغلاق التسجيل في كل البطولات المفتوحة (ترفيهية + احترافية)؟')) return;
  try {
    const data = await api('/api/admin/tournaments/close-all', { method: 'POST' });
    toast(`تم إغلاق ${data.closed} بطولة`);
    loadTournaments();
  } catch (e) {
    toast(e.message);
  }
});
$('#btn-cancel-tournament').addEventListener('click', () => {
  $('#tournament-form-modal').classList.add('hidden');
});

$('#tournament-admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    let imageUrl = $('#ta-image').value.trim();
    let bannerUrl = $('#ta-banner').value.trim();
    const newImage = await uploadFileIfSelected('#ta-image-file', 'tournaments');
    const newBanner = await uploadFileIfSelected('#ta-banner-file', 'tournaments');
    if (newImage) imageUrl = newImage;
    if (newBanner) bannerUrl = newBanner;

    const body = {
      title: $('#ta-title').value.trim(),
      status: $('#ta-status').value,
      size: parseInt($('#ta-size').value, 10),
      match_format: $('#ta-format').value,
      image_url: imageUrl,
      banner_url: bannerUrl,
      sponsor_name: $('#ta-sponsor').value.trim(),
      sponsor_url: $('#ta-sponsor-url').value.trim(),
    };
    if (editingTournamentId) {
      await api(`/api/admin/tournaments/${editingTournamentId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('تم تحديث البطولة');
    } else {
      await api('/api/admin/tournaments', { method: 'POST', body: JSON.stringify(body) });
      toast('تم إنشاء البطولة');
    }
    $('#tournament-form-modal').classList.add('hidden');
    loadTournaments();
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

async function deleteTournament(id) {
  if (!confirm('حذف هذه البطولة نهائياً؟')) return;
  try {
    await api(`/api/admin/tournaments/${id}`, { method: 'DELETE' });
    toast('تم الحذف');
    loadTournaments();
  } catch (e) {
    toast(e.message);
  }
}

// ---- Sessions ----
async function loadSessions() {
  const list = $('#sessions-admin-list');
  if (!list) return;
  list.innerHTML = '<p>جاري التحميل...</p>';
  try {
    const data = await api('/api/admin/sessions');
    renderSessions(data.sessions || []);
  } catch (e) {
    list.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

function renderSessions(items) {
  const list = $('#sessions-admin-list');
  if (!items.length) {
    list.innerHTML = '<p style="color:#94a3b8">لا توجد جلسات</p>';
    return;
  }
  list.innerHTML = '';
  items.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'admin-card';
    const statusLabel = SESSION_STATUS_LABELS[s.status] || s.status;
    const openLabel = s.is_open ? 'مفتوحة' : 'مقفلة';
    const canClose = s.is_open && s.status !== 'closed';
    card.innerHTML = `
      <div class="admin-card-body">
        <h3>${esc(s.title)}</h3>
        <div class="admin-card-meta">
          <span>#${s.id}</span>
          <span>${s.player_count}/${s.max_players} لاعب</span>
          <span>الحالة: ${esc(statusLabel)}</span>
          <span>${openLabel}</span>
          <span>الحد الأدنى: ${esc(s.min_rank_label)}</span>
          <span>المضيف: ${esc(s.host_name || '—')}</span>
        </div>
        <div class="admin-card-actions">
          ${canClose ? '<button class="btn-warn btn-close">إغلاق</button>' : ''}
          <button class="btn-delete">حذف</button>
        </div>
      </div>
    `;
    card.querySelector('.btn-close')?.addEventListener('click', () => closeSession(s.id));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteSession(s.id));
    list.appendChild(card);
  });
}

async function closeSession(id) {
  if (!confirm('إغلاق هذه الجلسة؟')) return;
  try {
    await api(`/api/admin/sessions/${id}/close`, { method: 'POST' });
    toast('تم إغلاق الجلسة');
    loadSessions();
  } catch (e) {
    toast(e.message);
  }
}

async function deleteSession(id) {
  if (!confirm('حذف هذه الجلسة نهائياً؟')) return;
  try {
    await api(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    toast('تم الحذف');
    loadSessions();
  } catch (e) {
    toast(e.message);
  }
}

$('#btn-close-all-sessions')?.addEventListener('click', async () => {
  if (!confirm('إغلاق كل الجلسات المفتوحة؟')) return;
  try {
    const data = await api('/api/admin/sessions/close-all', { method: 'POST' });
    toast(`تم إغلاق ${data.closed} جلسة`);
    loadSessions();
  } catch (e) {
    toast(e.message);
  }
});

function sanitizeAssetKeyFromFilename(filename) {
  return (filename || 'asset')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^back_/i, '')
    .slice(0, 48) || `item_${Date.now()}`;
}

async function loadAssetGallery() {
  const gallery = $('#sp-asset-gallery');
  if (!gallery) return;
  const category = $('#sp-category')?.value || 'cards';
  gallery.innerHTML = '<p class="sub">جاري تحميل الصور...</p>';
  try {
    const data = await api(`/api/admin/store/assets?category=${category}`);
    const files = data.files || [];
    gallery.innerHTML = '';
    gallery.classList.toggle('empty', files.length === 0);
    if (!files.length) return;
    const selectedUrl = $('#sp-image')?.value || '';
    for (const f of files) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'asset-gallery-item' + (selectedUrl === f.url ? ' selected' : '');
      item.title = f.filename;
      item.innerHTML = `<img src="${esc(f.url)}" alt="" loading="lazy" /><span>${esc(f.filename)}</span>`;
      item.addEventListener('click', () => {
        $$('.asset-gallery-item').forEach((el) => el.classList.remove('selected'));
        item.classList.add('selected');
        const assetKey = sanitizeAssetKeyFromFilename(f.filename);
        $('#sp-image').value = f.url;
        $('#sp-asset').value = assetKey;
        updateProductImagePreview(f.url);
        if (!$('#sp-name').value.trim()) {
          $('#sp-name').value = f.filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
        }
        toast('تم اختيار الصورة من المجلد');
      });
      gallery.appendChild(item);
    }
  } catch (e) {
    gallery.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

function setupProductDropZone() {
  const zone = $('#sp-drop-zone');
  const input = $('#sp-image-file');
  if (!zone || !input) return;
  zone.addEventListener('click', (e) => {
    if (e.target === input) return;
    input.click();
  });
  ['dragenter', 'dragover'].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
    });
  });
  zone.addEventListener('drop', async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return toast('الملف يجب أن يكون صورة');
    try {
      await uploadProductAsset(file);
      loadAssetGallery();
    } catch (err) {
      toast(err.message);
    }
  });
}

setupProductDropZone();
$('#btn-refresh-assets')?.addEventListener('click', loadAssetGallery);
$$('.store-cat-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.store-cat-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    storeCatFilter = btn.dataset.cat;
    loadProducts();
  });
});

$('#sp-ownership').addEventListener('change', () => {
  $('#sp-rental-wrap').style.display = $('#sp-ownership').value === 'rental' ? '' : 'none';
});

$('#sp-free').addEventListener('change', () => {
  $('#sp-price').disabled = $('#sp-free').checked;
});
$('#sp-global-default').addEventListener('change', () => {
  if ($('#sp-global-default').checked) {
    $('#sp-free').checked = true;
    $('#sp-price').disabled = true;
    $('#sp-ownership').value = 'permanent';
    $('#sp-rental-wrap').style.display = 'none';
  }
});

async function loadProducts() {
  const list = $('#products-admin-list');
  list.innerHTML = '<p>جاري التحميل...</p>';
  try {
    const q = storeCatFilter === 'all' ? '' : `?category=${storeCatFilter}`;
    const data = await api(`/api/admin/store/products${q}`);
    renderProducts(data.products || []);
  } catch (e) {
    list.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

function renderProducts(items) {
  const list = $('#products-admin-list');
  if (!items.length) {
    list.innerHTML = '<p style="color:#94a3b8">لا توجد منتجات</p>';
    return;
  }
  list.innerHTML = '';
  items.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'admin-card';
    const thumb = p.image_url
      ? `<img class="admin-card-thumb" src="${esc(p.image_url)}" alt="" />`
      : '<div class="admin-card-thumb"></div>';
    const priceLabel = p.is_free ? 'مجاني' : `${p.price} 🪙`;
    const ownLabel = p.ownership_type === 'rental' ? `إيجار ${p.rental_days} يوم` : 'دائم';
    const stockLabel = p.stock_limit != null ? `${p.sold_count}/${p.stock_limit}` : 'غير محدود';
    card.innerHTML = `
      ${thumb}
      <div class="admin-card-body">
        <h3>${esc(p.name)} <span class="badge ${p.is_active ? 'active' : 'inactive'}">${p.is_active ? 'نشط' : 'مخفي'}</span></h3>
        <div class="admin-card-meta">
          <span>${esc(p.category_label)}</span>
          <span>${priceLabel}</span>
          <span>${ownLabel}</span>
          ${p.is_global_default ? '<span class="badge active">افتراضي للجميع</span>' : ''}
          <span>المبيعات: ${stockLabel}</span>
          ${p.available_until ? `<span>ينتهي: ${p.available_until}</span>` : ''}
        </div>
        <div class="admin-card-actions">
          <button class="btn-edit" data-id="${p.id}">تعديل</button>
          <button class="btn-delete" data-id="${p.id}">حذف</button>
        </div>
      </div>
    `;
    card.querySelector('.btn-edit').addEventListener('click', () => openProductForm(p));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteProduct(p.id));
    list.appendChild(card);
  });
}

function updateProductImagePreview(url) {
  const preview = $('#sp-image-preview');
  const hidden = $('#sp-image');
  if (hidden) hidden.value = url || '';
  if (url && preview) {
    preview.src = url;
    preview.classList.remove('hidden');
  } else if (preview) {
    preview.classList.add('hidden');
    preview.removeAttribute('src');
  }
}

function updateProductFolderHint(category) {
  const hint = $('#sp-image-folder-hint');
  if (!hint) return;
  hint.textContent = category === 'session_bg'
    ? 'ارفع الصورة (حتى 50 ميجا) — تُنسخ إلى الملفات/roomsbackground'
    : 'ارفع الصورة (حتى 50 ميجا) — تُنسخ إلى الملفات/cards';
}

function resetProductImageFields() {
  const fileInput = $('#sp-image-file');
  if (fileInput) fileInput.value = '';
  $('#sp-image').value = '';
  $('#sp-asset').value = '';
  updateProductImagePreview('');
}

async function uploadProductAsset(file) {
  if (!file) return null;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('حجم الصورة أكبر من 50 ميجا — صغّرها أو استخدم JPG مضغوط');
  }
  const category = $('#sp-category').value;
  const q = new URLSearchParams({
    category,
    name: file.name,
  });
  const headers = { Authorization: `Bearer ${token}` };
  if (file.type) headers['Content-Type'] = file.type;
  const res = await fetch(`/api/admin/store/upload-asset-file?${q}`, {
    method: 'POST',
    headers,
    body: file,
  });
  let data = {};
  try { data = await res.json(); } catch {
    data = { error: res.status === 413 ? 'حجم الصورة كبير جداً — الحد الأقصى 50 ميجا' : `خطأ ${res.status}` };
  }
  if (!res.ok) throw new Error(data.error || `فشل الرفع (${res.status})`);
  $('#sp-image').value = data.url;
  $('#sp-asset').value = data.asset_key;
  updateProductImagePreview(data.url);
  toast(`تم حفظ الملف في ${data.folder}`);
  return data;
}

function openProductForm(p = null) {
  editingProductId = p?.id || null;
  $('#product-form-title').textContent = p ? 'تعديل منتج' : 'منتج جديد';
  const category = p?.category || 'cards';
  $('#sp-category').value = category;
  $('#sp-name').value = p?.name || '';
  $('#sp-desc').value = p?.description || '';
  $('#sp-asset').value = p?.asset_key || '';
  $('#sp-image').value = p?.image_url || '';
  $('#sp-price').value = p?.price ?? 0;
  $('#sp-free').checked = !!p?.is_free;
  $('#sp-price').disabled = $('#sp-free').checked;
  $('#sp-global-default').checked = !!p?.is_global_default;
  $('#sp-ownership').value = p?.ownership_type || 'permanent';
  $('#sp-rental-days').value = String(p?.rental_days || 7);
  $('#sp-rental-wrap').style.display = $('#sp-ownership').value === 'rental' ? '' : 'none';
  $('#sp-stock').value = p?.stock_limit ?? '';
  $('#sp-until').value = p?.available_until ? p.available_until.slice(0, 16) : '';
  $('#sp-active').checked = p ? !!p.is_active : true;
  const fileInput = $('#sp-image-file');
  if (fileInput) fileInput.value = '';
  updateProductFolderHint(category);
  updateProductImagePreview(p?.image_url || '');
  $('#product-form-modal').classList.remove('hidden');
  loadAssetGallery();
}

$('#sp-category')?.addEventListener('change', () => {
  updateProductFolderHint($('#sp-category').value);
  if (!editingProductId) resetProductImageFields();
  loadAssetGallery();
});

$('#sp-image-file')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await uploadProductAsset(file);
    await loadAssetGallery();
  } catch (err) {
    toast(err.message);
    e.target.value = '';
  }
});

$('#btn-new-product').addEventListener('click', () => openProductForm());
$('#btn-cancel-product').addEventListener('click', () => {
  $('#product-form-modal').classList.add('hidden');
});

$('#product-admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    const pendingFile = $('#sp-image-file')?.files?.[0];
    if (pendingFile) await uploadProductAsset(pendingFile);

    const imageUrl = ($('#sp-image')?.value || '').trim();
    const assetKey = ($('#sp-asset')?.value || '').trim();
    if (!imageUrl || !assetKey) throw new Error('ارفع صورة المنتج أولاً');

    const body = {
      category: $('#sp-category').value,
      name: $('#sp-name').value.trim(),
      description: $('#sp-desc').value.trim(),
      asset_key: assetKey,
      image_url: imageUrl,
      price: parseInt($('#sp-price').value, 10) || 0,
      is_free: $('#sp-free').checked,
      ownership_type: $('#sp-ownership').value,
      rental_days: parseInt($('#sp-rental-days').value, 10),
      stock_limit: $('#sp-stock').value ? parseInt($('#sp-stock').value, 10) : null,
      available_until: $('#sp-until').value ? new Date($('#sp-until').value).toISOString() : null,
      is_active: $('#sp-active').checked,
      is_global_default: $('#sp-global-default').checked,
    };
    if (editingProductId) {
      await api(`/api/admin/store/products/${editingProductId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('تم تحديث المنتج');
    } else {
      await api('/api/admin/store/products', { method: 'POST', body: JSON.stringify(body) });
      toast('تم إضافة المنتج');
    }
    $('#product-form-modal').classList.add('hidden');
    loadProducts();
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

async function deleteProduct(id) {
  if (!confirm('حذف هذا المنتج؟')) return;
  try {
    await api(`/api/admin/store/products/${id}`, { method: 'DELETE' });
    toast('تم الحذف');
    loadProducts();
  } catch (e) {
    toast(e.message);
  }
}

const REPORT_ACTIONS = [
  { id: 'dismiss', label: 'رفض التبليغ' },
  { id: 'delete_message', label: 'حذف الرسالة' },
  { id: 'remove_avatar', label: 'حذف الأفاتار' },
  { id: 'mute_public', label: 'كتم عام' },
  { id: 'mute_dm', label: 'كتم خاص' },
  { id: 'mute_both', label: 'كتم عام + خاص' },
  { id: 'ban', label: 'حظر نهائي' },
];

async function loadChatReports() {
  const list = $('#chat-reports-list');
  if (!list) return;
  list.innerHTML = '<p class="sub">جاري التحميل...</p>';
  try {
    const data = await api('/api/admin/chat/reports?status=pending');
    if (!data.reports?.length) {
      list.innerHTML = '<p class="sub">لا توجد تبليغات معلّقة</p>';
      return;
    }
    list.innerHTML = '';
    for (const r of data.reports) {
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `
        <div class="admin-card-head">
          <strong>#${r.id} — ${r.report_type}</strong>
          <span>${r.created_at}</span>
        </div>
        <p>المُبلّغ: ${r.reporter_name} → المُبلَّغ عنه: <strong>${r.reported_name}</strong></p>
        ${r.message_body ? `<p class="report-msg">"${r.message_body}"</p>` : ''}
        ${r.message_image ? `<p><a href="${r.message_image}" target="_blank">عرض الصورة</a></p>` : ''}
        ${r.details ? `<p class="sub">${r.details}</p>` : ''}
        <label>ملاحظات<input type="text" class="report-notes" data-id="${r.id}" placeholder="سبب العقوبة..." /></label>
        <label>أيام الكتم (إن وُجد)<input type="number" class="report-days" data-id="${r.id}" min="0" max="365" value="3" /></label>
        <div class="report-actions"></div>
      `;
      const actions = card.querySelector('.report-actions');
      for (const act of REPORT_ACTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = act.id === 'ban' ? 'btn-warn' : 'btn-secondary';
        btn.textContent = act.label;
        btn.addEventListener('click', () => resolveReport(r.id, act.id, card));
        actions.appendChild(btn);
      }
      list.appendChild(card);
    }
  } catch (e) {
    list.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

async function resolveReport(id, action, card) {
  const notes = card.querySelector('.report-notes')?.value || '';
  const muteDays = parseInt(card.querySelector('.report-days')?.value, 10) || 0;
  if (action === 'ban' && !confirm('حظر نهائي لهذا الحساب؟')) return;
  try {
    await api(`/api/admin/chat/reports/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, muteDays, notes }),
    });
    toast('تم تنفيذ الإجراء');
    loadChatReports();
  } catch (e) {
    toast(e.message);
  }
}

$('#btn-refresh-reports')?.addEventListener('click', loadChatReports);

async function loadBannedUsers() {
  const list = $('#banned-users-list');
  if (!list) return;
  list.innerHTML = '<p class="sub">جاري التحميل...</p>';
  try {
    const data = await api('/api/admin/chat/banned');
    if (!data.users?.length) {
      list.innerHTML = '<p class="sub">لا يوجد لاعبون محظورون حالياً</p>';
      return;
    }
    list.innerHTML = '';
    for (const u of data.users) {
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `
        <div class="admin-card-body">
          <h3>${esc(u.display_name)} <span class="sub">@${esc(u.username)}</span></h3>
          <p class="admin-card-meta">
            <span>ID: ${u.id}</span>
            <span>مخالفات: ${u.profanity_strikes ?? 0}</span>
          </p>
          <p class="report-msg">${esc(u.ban_reason || 'حظر — بدون سبب مسجّل')}</p>
        </div>
        <div class="admin-card-actions">
          <button type="button" class="btn-primary btn-unban" data-id="${u.id}">رفع الحظر</button>
        </div>
      `;
      card.querySelector('.btn-unban')?.addEventListener('click', async () => {
        if (!confirm(`رفع الحظر عن ${u.display_name}؟`)) return;
        try {
          await api(`/api/admin/chat/banned/${u.id}/unban`, { method: 'POST' });
          toast('تم رفع الحظر');
          loadBannedUsers();
        } catch (e) {
          toast(e.message);
        }
      });
      list.appendChild(card);
    }
  } catch (e) {
    list.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

$('#btn-refresh-banned')?.addEventListener('click', loadBannedUsers);

async function loadGiftProducts() {
  if (giftProductsCache.length) return giftProductsCache;
  const data = await api('/api/admin/store/products');
  giftProductsCache = data.products || [];
  return giftProductsCache;
}

async function loadUsersAdmin() {
  const list = $('#users-admin-list');
  if (!list) return;
  list.innerHTML = '<p class="sub">جاري التحميل...</p>';
  try {
    const data = await api('/api/admin/users');
    if (!data.users?.length) {
      list.innerHTML = '<p class="sub">لا يوجد مستخدمون</p>';
      return;
    }
    list.innerHTML = '';
    for (const u of data.users) {
      const card = document.createElement('div');
      card.className = 'admin-card';
      const roleAdmin = u.role === 'admin';
      card.innerHTML = `
        <div class="admin-card-body">
          <h3>${esc(u.display_name || u.username)} <span class="sub">@${esc(u.username)}</span></h3>
          <p class="admin-card-meta">
            <span>ID: ${u.id}</span>
            ${u.player_code ? `<span class="player-code-badge">#${esc(u.player_code)}</span>` : ''}
            ${roleAdmin ? '<span class="flag-star star-admin">★ أدمن</span>' : ''}
            ${u.is_vip ? '<span class="flag-star star-vip">★ VIP</span>' : ''}
            ${u.is_famous ? '<span class="flag-star star-famous">★ مشهور</span>' : ''}
          </p>
        </div>
        <div class="admin-card-actions user-flags">
          <button type="button" class="btn-primary btn-user-gift">إرسال هدية</button>
          <label class="flag-toggle"><input type="checkbox" data-flag="is_vip" ${u.is_vip ? 'checked' : ''} /> VIP</label>
          <label class="flag-toggle"><input type="checkbox" data-flag="is_famous" ${u.is_famous ? 'checked' : ''} /> مشهور</label>
          <label class="flag-toggle"><input type="checkbox" data-flag="is_admin" ${roleAdmin ? 'checked' : ''} /> أدمن</label>
        </div>
      `;
      card.querySelector('.btn-user-gift')?.addEventListener('click', () => {
        showGiftPanel({ user_id: u.id, display_name: u.display_name || u.username });
        $$('.admin-nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.section === 'online'));
        $$('.admin-section').forEach((s) => s.classList.remove('active'));
        $('#section-online')?.classList.add('active');
        $('#section-online')?.scrollIntoView({ behavior: 'smooth' });
      });
      card.querySelectorAll('.flag-toggle input').forEach((input) => {
        input.addEventListener('change', async () => {
          const willBeAdmin = card.querySelector('[data-flag="is_admin"]').checked;
          if (!willBeAdmin && u.role === 'admin') {
            const admins = (await api('/api/admin/users')).users?.filter((x) => x.role === 'admin') || [];
            if (admins.length <= 1) {
              toast('لا يمكن إزالة آخر أدمن — استخدم npm run admin:promote');
              input.checked = true;
              return;
            }
          }
          const body = {
            is_vip: card.querySelector('[data-flag="is_vip"]').checked,
            is_famous: card.querySelector('[data-flag="is_famous"]').checked,
            role: willBeAdmin ? 'admin' : 'player',
          };
          try {
            await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify(body) });
            toast('تم التحديث');
            loadUsersAdmin();
          } catch (e) {
            toast(e.message);
            input.checked = !input.checked;
          }
        });
      });
      list.appendChild(card);
    }
  } catch (e) {
    list.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

$('#btn-refresh-users')?.addEventListener('click', loadUsersAdmin);

function showGiftPanel(player) {
  const panel = $('#gift-form-panel');
  if (!panel) return;
  $('#gift-user-id').value = player.user_id || '';
  $('#gift-target-name').textContent = player.display_name || player.name || `#${player.user_id}`;
  $('#gift-coins').value = '0';
  $('#gift-gems').value = '0';
  $('#gift-rental-days').value = '7';
  $('#gift-vip-days').value = '0';
  const msgEl = $('#gift-message');
  if (msgEl) msgEl.value = '';
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideGiftPanel() {
  $('#gift-form-panel')?.classList.add('hidden');
}

async function loadOnlinePlayers() {
  const list = $('#online-admin-list');
  if (!list) return;
  list.innerHTML = '<p class="sub">جاري التحميل...</p>';
  hideGiftPanel();
  try {
    const [onlineData, products] = await Promise.all([
      api('/api/admin/online'),
      loadGiftProducts(),
    ]);
    const sel = $('#gift-product');
    if (sel) {
      sel.innerHTML = '<option value="">— بدون منتج —</option>';
      for (const p of products) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.category === 'cards' ? 'أوراق' : 'خلفية'})`;
        sel.appendChild(opt);
      }
    }
    const players = onlineData.players || [];
    if (!players.length) {
      list.innerHTML = '<p class="sub">لا يوجد لاعبون متصلون حالياً</p>';
      return;
    }
    list.innerHTML = '';
    for (const p of players) {
      const card = document.createElement('div');
      card.className = 'admin-card';
      const badges = [
        p.is_admin ? '<span class="flag-star star-admin">★</span>' : '',
        p.is_famous ? '<span class="flag-star star-famous">★</span>' : '',
        p.is_vip ? '<span class="flag-star star-vip">★</span>' : '',
      ].filter(Boolean).join(' ');
      card.innerHTML = `
        <div class="admin-card-body">
          <h3>${esc(p.display_name || p.name)} ${badges}</h3>
          <p class="admin-card-meta">
            <span>ID: ${p.user_id || '—'}</span>
            <span>الغرفة: ${esc(p.room_id || '—')}</span>
            <span>الوضع: ${esc(p.game_mode || '—')}</span>
            ${p.coins != null ? `<span>🪙 ${p.coins}</span>` : ''}
            ${p.gems != null ? `<span>💎 ${p.gems}</span>` : ''}
          </p>
        </div>
        <div class="admin-card-actions">
          <button type="button" class="btn-primary btn-gift" ${p.user_id ? '' : 'disabled'}>إرسال هدية</button>
        </div>
      `;
      card.querySelector('.btn-gift')?.addEventListener('click', () => showGiftPanel(p));
      list.appendChild(card);
    }
  } catch (e) {
    list.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

$('#btn-refresh-online')?.addEventListener('click', loadOnlinePlayers);
$('#btn-cancel-gift')?.addEventListener('click', hideGiftPanel);

$('#admin-gift-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user_id = parseInt($('#gift-user-id').value, 10);
  const coins = parseInt($('#gift-coins').value, 10) || 0;
  const gems = parseInt($('#gift-gems').value, 10) || 0;
  const product_id = parseInt($('#gift-product').value, 10) || null;
  const rental_days = parseInt($('#gift-rental-days').value, 10) || 0;
  const vip_days = parseInt($('#gift-vip-days').value, 10) || 0;
  const message = ($('#gift-message')?.value || '').trim();
  if (!user_id) return toast('معرّف اللاعب غير صالح');
  if (!coins && !gems && !vip_days && !(product_id && rental_days)) {
    return toast('أدخل عملات أو جواهر أو VIP أو اشتراك منتج');
  }
  try {
    await api('/api/admin/gifts', {
      method: 'POST',
      body: JSON.stringify({ user_id, coins, gems, product_id, rental_days, vip_days, message }),
    });
    toast('تم إرسال الهدية');
    hideGiftPanel();
    loadOnlinePlayers();
  } catch (err) {
    toast(err.message);
  }
});

if (token) {
  api('/api/auth/me')
    .then((data) => {
      if (data.user?.role !== 'admin' && !data.user?.is_admin) {
        logout();
        toast('انتهت جلسة الأدمن');
        return;
      }
      showApp();
    })
    .catch(logout);
}

$$('.admin-modal').forEach((modal) => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});
