/** شارات الحالة — أدمن / مشهور / VIP (الأقوى فقط) */

const STATUS_BADGE_META = {
  admin: {
    img: '/uploads/logos/admin.png',
    title: 'أدمن',
    message: 'هذا اللاعب من فريق إدارة اللعبة',
  },
  famous: {
    img: '/uploads/logos/famous.png',
    title: 'مشهور',
    message: 'لاعب مشهور في مجتمع ربعها',
  },
  vip: {
    img: '/uploads/logos/vip.png',
    title: 'VIP',
    message: 'مشترك VIP — يتمتع بمزايا خاصة في اللعبة',
  },
};

function resolveStatusBadge(user) {
  if (!user) return null;
  let type = user.star || null;
  if (!type) {
    if (user.is_admin || user.role === 'admin') type = 'admin';
    else if (user.is_famous) type = 'famous';
    else if (user.is_vip) type = 'vip';
  }
  const meta = STATUS_BADGE_META[type];
  if (!meta) return null;
  return { type, ...meta };
}

function showStatusBadgeToast(badge) {
  if (!badge) return;
  const msg = badge.message || badge.title;
  if (typeof showHomeToast === 'function') showHomeToast(msg);
  else alert(msg);
}

function createStatusBadgeButton(badge, { size = 'md', extraClass = '' } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `status-badge-btn status-badge-${size}${extraClass ? ` ${extraClass}` : ''}`;
  btn.title = badge.title;
  btn.setAttribute('aria-label', badge.title);
  const img = document.createElement('img');
  img.src = badge.img;
  img.alt = '';
  img.draggable = false;
  btn.appendChild(img);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showStatusBadgeToast(badge);
  });
  return btn;
}

function renderHomeStatusBadge(profile) {
  const wrap = document.querySelector('.home-avatar-wrap');
  if (!wrap) return;
  wrap.querySelector('.home-status-badge')?.remove();
  const badge = resolveStatusBadge(profile);
  if (!badge) return;
  const btn = createStatusBadgeButton(badge, { size: 'lg', extraClass: 'home-status-badge' });
  wrap.appendChild(btn);
}

/** اسم اللاعب مع نجمة الحالة في نهاية الاسم (يمين النص) */
function buildPlayerNameWithStar(player, { nameClass = 'player-name-with-star__name', emptyLabel = 'لاعب' } = {}) {
  const wrap = document.createElement('span');
  wrap.className = 'player-name-with-star';

  const nameEl = document.createElement('span');
  nameEl.className = nameClass;
  nameEl.textContent = player?.name || emptyLabel;
  wrap.appendChild(nameEl);

  const badge = resolveStatusBadge(player);
  if (badge) {
    const star = document.createElement('span');
    star.className = `status-star star-${badge.type}`;
    star.setAttribute('aria-label', badge.title);
    star.title = badge.title;
    star.textContent = '★';
    wrap.appendChild(star);
  }
  return wrap;
}
