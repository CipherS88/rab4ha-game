/** شاشة الأصدقاء */

async function initFriendsPage() {
  const ok = await ensureAuth();
  if (!ok) return;

  const listEl = $('#friends-list');
  const pendingEl = $('#friends-pending');
  const sentEl = $('#friends-sent');
  if (!listEl) return;

  listEl.innerHTML = '<p class="friends-empty">جاري التحميل...</p>';
  pendingEl.innerHTML = '';
  sentEl.innerHTML = '';

  try {
    const res = await apiFetch('/api/chat/friends');
    const data = await res.json();
    renderFriendsSection(listEl, data.friends || [], 'friend');
    renderFriendsSection(pendingEl, data.pending_received || [], 'pending');
    renderFriendsSection(sentEl, data.pending_sent || [], 'sent');
  } catch (e) {
    listEl.innerHTML = '<p class="friends-empty">تعذّر تحميل قائمة الأصدقاء</p>';
    console.error(e);
  }
}

function renderFriendsSection(container, users, mode) {
  if (!users.length) {
    container.innerHTML = '<p class="friends-empty">لا يوجد</p>';
    return;
  }
  container.innerHTML = '';
  for (const u of users) {
    container.appendChild(buildFriendRow(u, mode));
  }
}

function buildFriendRow(user, mode) {
  const row = document.createElement('div');
  row.className = 'friend-row';

  const av = document.createElement('button');
  av.type = 'button';
  av.className = 'friend-avatar';
  av.textContent = user.avatar_initial || '؟';
  av.addEventListener('click', () => openChatProfile?.(user.user_id));

  const info = document.createElement('div');
  info.className = 'friend-info';
  const nameBtn = document.createElement('button');
  nameBtn.type = 'button';
  nameBtn.className = 'friend-name';
  nameBtn.textContent = user.name || 'لاعب';
  nameBtn.addEventListener('click', () => openChatProfile?.(user.user_id));
  const rank = document.createElement('div');
  rank.className = 'friend-rank';
  rank.textContent = user.rankLabel || '';
  info.append(nameBtn, rank);

  const actions = document.createElement('div');
  actions.className = 'friend-actions';

  if (mode === 'pending') {
    const accept = document.createElement('button');
    accept.className = 'btn-accept';
    accept.textContent = 'قبول';
    accept.addEventListener('click', async () => {
      try {
        const res = await apiFetch(`/api/chat/friends/${user.user_id}/accept`, { method: 'POST', body: '{}' });
        if (!res.ok) throw new Error();
        initFriendsPage();
      } catch {
        showHomeToast?.('تعذّر قبول الطلب');
      }
    });
    actions.appendChild(accept);
  } else if (mode === 'friend') {
    const dm = document.createElement('button');
    dm.className = 'btn-dm';
    dm.textContent = 'رسالة';
    dm.addEventListener('click', () => openFriendDm(user.user_id, user.name));
    const remove = document.createElement('button');
    remove.className = 'btn-remove';
    remove.textContent = 'إزالة';
    remove.addEventListener('click', async () => {
      if (!confirm(`إزالة ${user.name} من الأصدقاء؟`)) return;
      try {
        const res = await apiFetch(`/api/chat/friends/${user.user_id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        initFriendsPage();
      } catch {
        showHomeToast?.('تعذّر الإزالة');
      }
    });
    actions.append(dm, remove);
  }

  row.append(av, info, actions);
  return row;
}

function openFriendDm(userId, name) {
  showScreen('chat');
  document.querySelector('.chat-tab[data-tab="dm"]')?.click();
  if (typeof initChatPage === 'function') {
    initChatPage().then(() => {
      if (typeof openDmThread === 'function') openDmThread(userId, name);
    });
  }
}

function wireFriendsPage() {
  $('#btn-friends-back')?.addEventListener('click', () => initHome());
}

document.addEventListener('DOMContentLoaded', wireFriendsPage);
