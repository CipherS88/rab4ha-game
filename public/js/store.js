/** متجر اللاعب */

let storeTab = 'cards';
let storeProducts = [];
let previewProduct = null;

async function loadStore() {
  const list = $('#store-list');
  if (!list) return;
  list.innerHTML = '<p class="lobby-loading">جاري التحميل...</p>';
  try {
    const res = await apiFetch(`/api/store/products?category=${storeTab}`);
    const data = await res.json();
    storeProducts = data.products || [];
    renderStoreProducts(storeProducts);
  } catch (e) {
    list.innerHTML = `<p class="lobby-error">${e.message}</p>`;
  }
}

function renderStoreProducts(items) {
  const list = $('#store-list');
  if (!items.length) {
    list.innerHTML = '<p class="lobby-empty">لا توجد منتجات في هذا القسم</p>';
    return;
  }
  list.innerHTML = '';
  items.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'store-product-card';
    const priceLabel = p.is_free ? 'مجاني' : `${p.price} 🪙`;
    const ownLabel = p.ownership_type === 'rental' ? `إيجار ${p.rental_days} يوم` : 'شراء دائم';
    const stockHint = p.stock_limit != null
      ? `<span class="store-stock">متبقي: ${p.stock_limit - p.sold_count}</span>`
      : '';
    const img = p.image_url
      ? `<img class="store-product-img" src="${p.image_url}" alt="" />`
      : '<div class="store-product-img placeholder">🛍️</div>';
    card.innerHTML = `
      ${img}
      <div class="store-product-info">
        <strong>${p.name}</strong>
        <p class="store-product-desc">${p.description || ''}</p>
        <div class="store-product-meta">
          <span class="store-price">${priceLabel}</span>
          <span>${ownLabel}</span>
          ${stockHint}
          ${p.owned ? '<span class="store-owned">مملوك</span>' : ''}
        </div>
      </div>
    `;
    const actions = document.createElement('div');
    actions.className = 'store-card-actions';
    const preview = document.createElement('button');
    preview.className = 'lobby-btn-sm store-preview-btn';
    preview.textContent = 'معاينة';
    preview.addEventListener('click', () => openStorePreview(p));
    actions.appendChild(preview);
    if (!p.owned) {
      const buy = document.createElement('button');
      buy.className = 'lobby-btn-sm store-buy-btn';
      buy.textContent = p.is_free ? 'احصل عليه' : 'شراء';
      buy.addEventListener('click', () => purchaseStoreItem(p.id));
      actions.appendChild(buy);
    }
    card.appendChild(actions);
    list.appendChild(card);
  });
}

function openStorePreview(product, viewOnly = false) {
  previewProduct = product;
  const modal = $('#store-preview-modal');
  const wrap = $('#store-preview-image-wrap');
  const buyBtn = $('#store-preview-buy');
  if (!modal) return;

  $('#store-preview-title').textContent = product.name;
  $('#store-preview-desc').textContent = product.description || '';
  const priceLabel = product.is_free ? 'مجاني' : `${product.price} 🪙`;
  const ownLabel = product.ownership_type === 'rental'
    ? `إيجار ${product.rental_days} يوم`
    : 'شراء دائم';
  $('#store-preview-meta').innerHTML = `
    <span class="store-price">${priceLabel}</span>
    <span>${ownLabel}</span>
    <span>${product.category_label || (product.category === 'session_bg' ? 'خلفيات الجلسات' : 'أوراق اللعب') || (storeTab === 'cards' ? 'أوراق اللعب' : 'خلفيات الجلسات')}</span>
  `;

  if (product.image_url) {
    const isBg = product.category === 'session_bg';
    wrap.className = isBg ? 'store-preview-image-wrap session-bg-wrap' : 'store-preview-image-wrap';
    const cls = isBg ? 'store-preview-img session-bg-preview' : 'store-preview-img';
    wrap.innerHTML = `<img src="${product.image_url}" alt="" class="${cls}" />`;
  } else {
    wrap.className = 'store-preview-image-wrap';
    wrap.innerHTML = '<div class="store-preview-img placeholder">🛍️</div>';
  }

  if (viewOnly || product.owned) {
    buyBtn.classList.add('hidden');
  } else {
    buyBtn.classList.remove('hidden');
    buyBtn.textContent = product.is_free ? 'احصل عليه' : `شراء — ${product.price} 🪙`;
  }

  modal.classList.remove('hidden');
}

function closeStorePreview() {
  $('#store-preview-modal')?.classList.add('hidden');
  previewProduct = null;
}

async function purchaseStoreItem(id) {
  try {
    const res = await apiFetch(`/api/store/purchase/${id}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.profile) {
      cachedProfile = data.profile;
      renderHomeProfile(data.profile);
    } else if (data.coins != null) {
      const coinsEl = $('#home-coins');
      if (coinsEl) coinsEl.textContent = formatCoins(data.coins);
      if (cachedProfile) cachedProfile.coins = data.coins;
    }
    showLobbyToast(`تم الشراء — ${data.purchase?.name || 'المنتج'} أُضيف للحقيبة`);
    closeStorePreview();
    loadStore();
  } catch (e) {
    alert(e.message);
  }
}

function updateStoreTabs() {
  $$('.store-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === storeTab);
  });
  const hint = $('#store-type-hint');
  if (hint) {
    hint.textContent = storeTab === 'cards'
      ? 'أوراق اللعب — شراء دائم للأبد'
      : 'خلفيات الجلسات — زيّن طاولة لعبك';
  }
}

function initStorePage() {
  updateStoreTabs();
  loadStore();
}

function wireStorePage() {
  $$('.store-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      storeTab = btn.dataset.tab;
      updateStoreTabs();
      loadStore();
    });
  });
  $('#btn-store-back')?.addEventListener('click', () => initHome());
  $('#store-preview-close')?.addEventListener('click', closeStorePreview);
  $('#store-preview-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'store-preview-modal') closeStorePreview();
  });
  $('#store-preview-buy')?.addEventListener('click', () => {
    if (previewProduct?.id) purchaseStoreItem(previewProduct.id);
  });
}

document.addEventListener('DOMContentLoaded', wireStorePage);
