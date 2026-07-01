/** الحقيبة — متجر + إنجازات */



let bagTab = 'store';



async function loadBag() {

  const list = $('#bag-list');

  if (!list) return;

  list.innerHTML = '<p class="lobby-loading">جاري التحميل...</p>';

  try {

    const res = await apiFetch('/api/store/bag');

    const data = await res.json();

    if (bagTab === 'store') renderBagStore(data.store_items || []);

    else renderBagAchievements(data.achievements || []);

  } catch (e) {

    list.innerHTML = `<p class="lobby-error">${e.message}</p>`;

  }

}



function renderBagStore(items) {

  const list = $('#bag-list');

  if (!items.length) {

    list.innerHTML = '<p class="lobby-empty">لا توجد عناصر — اشترِ من المتجر</p>';

    return;

  }

  list.innerHTML = '';

  items.forEach((item) => {

    const card = document.createElement('div');

    card.className = 'bag-item-card';

    const canEquip = item.category === 'cards' || item.category === 'session_bg';

    const img = item.image_url

      ? `<img class="bag-item-img" src="${item.image_url}" alt="" />`

      : '<div class="bag-item-img placeholder">🎒</div>';

    const tag = item.equipped

      ? '<span class="bag-tag equipped">مفعّل</span>'

      : item.is_global_default

      ? '<span class="bag-tag default">افتراضي للجميع</span>'

      : item.is_default

      ? '<span class="bag-tag default">افتراضي</span>'

      : item.ownership_type === 'rental'

        ? `<span class="bag-tag rental">إيجار${item.expires_at ? ` — حتى ${formatBagDate(item.expires_at)}` : ''}</span>`

        : '<span class="bag-tag owned">مملوك</span>';

    const equipLabel = item.equipped ? 'مفعّل ✓' : 'تفعيل';

    const equipBtn = canEquip

      ? `<button type="button" class="bag-equip-btn${item.equipped ? ' active' : ''}" data-cat="${item.category}" data-key="${item.asset_key || ''}" data-equipped="${item.equipped ? '1' : '0'}" data-default="${item.is_global_default ? '1' : '0'}">${equipLabel}</button>`

      : '';

    card.innerHTML = `

      ${img}

      <div class="bag-item-info">

        <strong>${item.name}</strong>

        <span class="bag-item-cat">${item.category_label}</span>

        ${tag}

        ${item.description ? `<p class="bag-item-desc">${item.description}</p>` : ''}

        ${equipBtn}

      </div>

    `;

    card.querySelector('.bag-equip-btn')?.addEventListener('click', async (e) => {

      e.stopPropagation();

      const btn = e.currentTarget;

      btn.disabled = true;

      try {

        const isEquipped = btn.dataset.equipped === '1';

        const isDefault = btn.dataset.default === '1';

        let assetKey = btn.dataset.key;

        if (isEquipped && !isDefault) {

          assetKey = '';

        } else if (isEquipped && isDefault) {

          if (typeof showHomeToast === 'function') showHomeToast('مفعّل بالفعل');

          return;

        }

        const res = await apiFetch('/api/store/equip', {

          method: 'POST',

          body: JSON.stringify({ category: btn.dataset.cat, asset_key: assetKey }),

        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'فشل التفعيل');

        const msg = assetKey === '' ? 'تم الإرجاع للافتراضي' : 'تم التفعيل';

        if (typeof showHomeToast === 'function') showHomeToast(msg);

        renderBagStore(data.bag?.store_items || []);

      } catch (err) {

        if (typeof showHomeToast === 'function') showHomeToast(err.message);

      } finally {

        btn.disabled = false;

      }

    });

    if (item.image_url) {

      card.style.cursor = 'pointer';

      card.addEventListener('click', (e) => {

        if (e.target.closest('.bag-equip-btn')) return;

        openBagPreview(item);

      });

    }

    list.appendChild(card);

  });

}



function renderBagAchievements(items) {

  const list = $('#bag-list');

  if (!items.length) {

    list.innerHTML = '<p class="lobby-empty">لا إنجازات بعد — فُز بالبطولات لتحصل على ميداليات</p>';

    return;

  }

  list.innerHTML = '';

  items.forEach((a) => {

    const card = document.createElement('div');

    card.className = 'bag-item-card achievement';

    const visual = a.image_url

      ? `<img class="bag-item-img medal" src="${a.image_url}" alt="" />`

      : '<div class="bag-item-img placeholder medal">🏅</div>';

    card.innerHTML = `

      ${visual}

      <div class="bag-item-info">

        <strong>${a.label}</strong>

        <span class="bag-item-cat">ميدالية</span>

        <span class="bag-tag achievement">إنجاز</span>

      </div>

    `;

    list.appendChild(card);

  });

}



function formatBagDate(iso) {

  try {

    return new Date(iso).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });

  } catch {

    return '';

  }

}



function openBagPreview(item) {

  if (typeof openStorePreview === 'function') {

    openStorePreview({

      id: item.id,

      name: item.name,

      description: item.description,

      image_url: item.image_url,

      price: 0,

      is_free: true,

      ownership_type: item.ownership_type,

      rental_days: item.rental_days,

      category: item.category,

      category_label: item.category_label,

      owned: true,

    }, true);

  }

}



function updateBagTabs() {

  $$('.bag-tab').forEach((btn) => {

    btn.classList.toggle('active', btn.dataset.tab === bagTab);

  });

}



function initBagPage() {

  updateBagTabs();

  loadBag();

}



function wireBagPage() {

  $$('.bag-tab').forEach((btn) => {

    btn.addEventListener('click', () => {

      bagTab = btn.dataset.tab;

      updateBagTabs();

      loadBag();

    });

  });

  $('#btn-bag-back')?.addEventListener('click', () => initHome());

}



document.addEventListener('DOMContentLoaded', wireBagPage);


