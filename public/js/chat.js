/** الشات العام والخاص */

let chatSocketReady = false;
let chatReplyTo = null;
let chatDmUserId = null;
let chatPendingImage = null;
let chatProfileUserId = null;
let chatGiftOptions = null;

function formatChatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return d.toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

function ensureChatSocket() {
  return new Promise((resolve, reject) => {
    const token = getAuthToken();
    if (!token) return reject(new Error('يجب تسجيل الدخول'));

    const doAuth = () => {
      const timeout = setTimeout(() => reject(new Error('انتهت مهلة الاتصال بالشات — حدّث الصفحة')), 8000);
      socket.emit('chat:auth', { token }, (res) => {
        clearTimeout(timeout);
        if (res?.error) return reject(new Error(res.error));
        chatSocketReady = true;
        if (typeof wireGiftSocket === 'function') wireGiftSocket(socket);
        if (res?.pending_gifts?.length && typeof enqueueGift === 'function') {
          res.pending_gifts.forEach((g) => enqueueGift(g));
        }
        if (typeof loadPendingGifts === 'function') loadPendingGifts();
        resolve(res);
      });
    };

    if (socket.connected) doAuth();
    else socket.once('connect', doAuth);
  });
}

function renderChatAvatar(el, sender) {
  el.textContent = '';
  el.className = 'chat-msg-avatar';
  if (sender.avatar_url) {
    const img = document.createElement('img');
    img.src = sender.avatar_url;
    img.alt = '';
    img.className = 'chat-msg-avatar-img';
    el.appendChild(img);
  } else {
    el.textContent = sender.avatar_initial || '؟';
  }
}

function renderMessageBubble(msg, { mine = false } = {}) {
  const s = msg.sender || {};
  const el = document.createElement('div');
  el.className = 'chat-msg' + (mine ? ' mine' : '');
  el.dataset.msgId = msg.id;

  const av = document.createElement('button');
  av.type = 'button';
  renderChatAvatar(av, s);
  av.title = s.name || '';
  av.addEventListener('click', () => openChatProfile(s.user_id));

  const body = document.createElement('div');
  body.className = 'chat-msg-body';

  const head = document.createElement('div');
  head.className = 'chat-msg-head';
  const nameBtn = document.createElement('button');
  nameBtn.type = 'button';
  nameBtn.className = 'chat-msg-name';
  nameBtn.textContent = s.name || 'لاعب';
  nameBtn.addEventListener('click', () => openChatProfile(s.user_id));
  const rank = document.createElement('span');
  rank.className = 'chat-msg-rank';
  rank.textContent = s.rankLabel || '';
  head.append(nameBtn, rank);
  const statusBadge = resolveStatusBadge(s);
  if (statusBadge) {
    head.appendChild(createStatusBadgeButton(statusBadge, { size: 'sm', extraClass: 'chat-status-badge' }));
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble';
  if (msg.reply_to) {
    const rq = document.createElement('div');
    rq.className = 'chat-msg-reply';
    rq.textContent = `↩ ${msg.reply_to.body?.slice(0, 80) || '...'}`;
    bubble.appendChild(rq);
  }
  if (msg.body) {
    const t = document.createElement('div');
    t.textContent = msg.body;
    bubble.appendChild(t);
  }
  if (msg.image_url) {
    const img = document.createElement('img');
    img.className = 'chat-msg-img';
    img.src = msg.image_url;
    img.alt = 'صورة';
    img.addEventListener('click', () => window.open(msg.image_url, '_blank'));
    bubble.appendChild(img);
  }

  const time = document.createElement('div');
  time.className = 'chat-msg-time';
  time.textContent = formatChatTime(msg.created_at);

  const actions = document.createElement('div');
  actions.className = 'chat-msg-actions';
  const btnReply = document.createElement('button');
  btnReply.textContent = 'رد';
  btnReply.addEventListener('click', () => setChatReply(msg));
  actions.appendChild(btnReply);
  if (!mine) {
    const btnReport = document.createElement('button');
    btnReport.textContent = 'تبليغ';
    btnReport.addEventListener('click', () => reportChatMessage(msg));
    actions.appendChild(btnReport);
  }

  body.append(head, bubble, time, actions);
  el.append(av, body);
  return el;
}

function appendChatMessage(container, msg, viewerId) {
  if (!container) return;
  const mine = msg.sender?.user_id === viewerId;
  container.appendChild(renderMessageBubble(msg, { mine }));
  container.scrollTop = container.scrollHeight;
}

function setChatReply(msg) {
  chatReplyTo = msg;
  const bar = $('#chat-reply-bar');
  const text = $('#chat-reply-text');
  if (bar) bar.classList.remove('hidden');
  if (text) text.textContent = `رد على ${msg.sender?.name || 'لاعب'}: ${msg.body?.slice(0, 60) || 'صورة'}`;
}

function clearChatReply() {
  chatReplyTo = null;
  $('#chat-reply-bar')?.classList.add('hidden');
}

async function loadPublicChat() {
  const res = await apiFetch('/api/chat/public');
  const data = await res.json();
  const box = $('#chat-public-messages');
  if (!box) return;
  box.innerHTML = '';
  const me = getCachedUser()?.id;
  for (const m of data.messages || []) appendChatMessage(box, m, me);
}

async function loadDmList() {
  const res = await apiFetch('/api/chat/dm');
  const data = await res.json();
  const list = $('#chat-dm-list');
  if (!list) return;
  list.innerHTML = '';
  for (const conv of data.conversations || []) {
    const u = conv.user;
    const item = document.createElement('div');
    item.className = 'dm-item' + (chatDmUserId === u.user_id ? ' active' : '');
    const av = document.createElement('div');
    renderChatAvatar(av, u);
    const prev = document.createElement('div');
    prev.className = 'dm-item-preview';
    prev.innerHTML = `<strong>${u.name}</strong><span>${conv.last_message?.from_me ? 'أنت: ' : ''}${conv.last_message?.body || '—'}</span>`;
    item.append(av, prev);
    item.addEventListener('click', () => openDmThread(u.user_id, u.name));
    list.appendChild(item);
  }
}

async function openDmThread(userId, name) {
  chatDmUserId = userId;
  $('#chat-dm-empty')?.classList.add('hidden');
  $('#chat-dm-thread')?.classList.remove('hidden');
  const title = $('#chat-dm-title');
  if (title) title.textContent = name || 'محادثة';
  const res = await apiFetch(`/api/chat/dm/${userId}`);
  const data = await res.json();
  if (data.error) {
    showHomeToast(data.error);
    return;
  }
  const box = $('#chat-dm-messages');
  box.innerHTML = '';
  const me = getCachedUser()?.id;
  for (const m of data.messages || []) appendChatMessage(box, m, me);
  await loadDmList();
}

async function sendChatMessage(channel) {
  const input = channel === 'dm' ? $('#chat-dm-input') : $('#chat-input');
  const body = input?.value?.trim() || '';
  const imageUrl = channel === 'dm' ? chatPendingImage : null;
  if (!body && !imageUrl) return;

  if (channel === 'dm' && !chatDmUserId) {
    showHomeToast('اختر محادثة أولاً');
    return;
  }

  try {
    const payload = {
      body: body || undefined,
      image_url: imageUrl || undefined,
      reply_to_id: chatReplyTo?.id || undefined,
    };
    const url = channel === 'public'
      ? '/api/chat/public'
      : `/api/chat/dm/${chatDmUserId}`;
    const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();

    if (!res.ok) {
      showHomeToast(data.error || 'فشل إرسال الرسالة');
      if (data.profanityStrike?.banned) {
        await logoutUser();
        showScreen('login');
      }
      return;
    }

    if (input) input.value = '';
    chatPendingImage = null;
    clearChatReply();
    if (channel === 'dm') loadDmList();

    // عرض فوري مع منع التكرار عند وصول Socket
    if (data.message) {
      const boxId = channel === 'dm' ? 'chat-dm-messages' : 'chat-public-messages';
      if (!document.querySelector(`#${boxId} [data-msg-id="${data.message.id}"]`)) {
        appendChatMessage($(`#${boxId}`), data.message, getCachedUser()?.id);
      }
    }
  } catch (e) {
    showHomeToast(e.message || 'فشل إرسال الرسالة');
  }
}

async function uploadChatImage(file, channel = 'dm') {
  if (channel !== 'dm') return;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await apiFetch('/api/chat/upload', {
        method: 'POST',
        body: JSON.stringify({ data: reader.result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      chatPendingImage = data.url;
      showHomeToast('تم إرفاق الصورة — اضغط إرسال');
    } catch (e) {
      showHomeToast(e.message || 'فشل رفع الصورة');
    }
  };
  reader.readAsDataURL(file);
}

async function openChatProfile(userId) {
  if (!userId) return;
  try {
    const res = await apiFetch(`/api/chat/users/${userId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    chatProfileUserId = userId;
    chatGiftOptions = data.gift_options || null;
    renderChatProfileModal(data.user);
    $('#chat-profile-modal')?.classList.remove('hidden');
  } catch (e) {
    showHomeToast(e.message);
  }
}

function renderChatProfileModal(user) {
  const modal = $('#chat-profile-modal');
  if (!modal) return;
  applyRankTheme(modal.querySelector('.chat-modal-box'), user.rankTheme || 'wood');
  $('#chat-profile-name').textContent = user.name;
  const codeLine = $('#chat-profile-code');
  if (codeLine) {
    const code = user.player_code || '';
    codeLine.textContent = code ? formatPlayerCode(code) : '';
    codeLine.style.display = code ? '' : 'none';
  }
  $('#chat-profile-rank').textContent = user.rankLabel || '';
  const avEl = $('#chat-profile-avatar');
  if (avEl) {
    avEl.innerHTML = '';
    if (user.avatar_url) {
      const img = document.createElement('img');
      img.src = user.avatar_url;
      img.alt = '';
      img.className = 'chat-profile-avatar-img';
      avEl.appendChild(img);
    } else {
      avEl.textContent = user.avatar_initial || '؟';
    }
  }
  $('#chat-profile-wins').textContent = user.wins ?? 0;
  $('#chat-profile-losses').textContent = user.losses ?? 0;
  drawRadarChart($('#chat-profile-radar'), user.radarStats || {});

  const actions = $('#chat-profile-actions');
  if (!actions) return;
  actions.innerHTML = '';
  const me = getCachedUser()?.id;
  if (user.user_id === me) return;

  const addBtn = (label, cls, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', fn);
    actions.appendChild(b);
  };

  switch (user.friendship) {
    case 'none':
      addBtn('إرسال طلب صداقة', 'primary', () => chatFriendAction('request', user.user_id));
      break;
    case 'pending_sent':
      addBtn('طلب مرسل — في الانتظار', '', () => {});
      break;
    case 'pending_received':
      addBtn('قبول طلب الصداقة', 'primary', () => chatFriendAction('accept', user.user_id));
      break;
    case 'friends':
      addBtn('حذف صديق', 'danger', () => chatFriendAction('remove', user.user_id));
      break;
    default:
      break;
  }

  if (user.friendship === 'blocked_by_me') {
    addBtn('إلغاء الحظر', '', () => chatFriendAction('unblock', user.user_id));
  } else if (user.friendship !== 'self') {
    addBtn('🎁 إهداء', 'gift-profile-btn', () => {
      if (typeof openGiftSendModal === 'function') {
        openGiftSendModal(user, chatGiftOptions || {});
      }
    });
    addBtn('حظر', 'danger', () => chatFriendAction('block', user.user_id));
    addBtn('تبليغ على الحساب', 'danger', () => reportChatAccount(user.user_id));
  }

  if (user.friendship === 'friends' || user.friendship === 'none') {
    addBtn('مراسلة خاصة', 'primary', () => {
      closeChatProfile();
      switchChatTab('dm');
      openDmThread(user.user_id, user.name);
    });
  }
}

function closeChatProfile() {
  $('#chat-profile-modal')?.classList.add('hidden');
  chatProfileUserId = null;
}

async function chatFriendAction(action, userId) {
  try {
    let res;
    if (action === 'request') res = await apiFetch(`/api/chat/friends/${userId}/request`, { method: 'POST' });
    else if (action === 'accept') res = await apiFetch(`/api/chat/friends/${userId}/accept`, { method: 'POST' });
    else if (action === 'remove') res = await apiFetch(`/api/chat/friends/${userId}`, { method: 'DELETE' });
    else if (action === 'block') res = await apiFetch(`/api/chat/block/${userId}`, { method: 'POST' });
    else if (action === 'unblock') res = await apiFetch(`/api/chat/block/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showHomeToast('تم');
    openChatProfile(userId);
  } catch (e) {
    showHomeToast(e.message);
  }
}

async function reportChatMessage(msg) {
  const details = prompt('سبب التبليغ (اختياري):', '');
  if (details === null) return;
  try {
    const res = await apiFetch('/api/chat/report', {
      method: 'POST',
      body: JSON.stringify({
        reported_user_id: msg.sender?.user_id,
        message_id: msg.id,
        report_type: msg.image_url ? 'image' : 'message',
        details,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showHomeToast('تم إرسال التبليغ — سيراجعه الأدمن');
  } catch (e) {
    showHomeToast(e.message);
  }
}

async function reportChatAccount(userId) {
  const details = prompt('سبب التبليغ على الحساب:', '');
  if (details === null) return;
  try {
    const res = await apiFetch('/api/chat/report', {
      method: 'POST',
      body: JSON.stringify({ reported_user_id: userId, report_type: 'account', details }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showHomeToast('تم إرسال التبليغ');
    closeChatProfile();
  } catch (e) {
    showHomeToast(e.message);
  }
}

function switchChatTab(tab) {
  $$('.chat-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('#chat-panel-public')?.classList.toggle('hidden', tab !== 'public');
  $('#chat-panel-dm')?.classList.toggle('hidden', tab !== 'dm');
  if (tab === 'dm') loadDmList();
}

function onChatSocketMessage(data) {
  const me = getCachedUser()?.id;
  const msg = data.message;
  if (!msg) return;

  const boxId = data.channel === 'dm' ? '#chat-dm-messages' : '#chat-public-messages';
  if (document.querySelector(`${boxId} [data-msg-id="${msg.id}"]`)) return;

  if (data.channel === 'public') {
    const box = $('#chat-public-messages');
    if ($('#screen-chat')?.classList.contains('active') && !$('#chat-panel-public')?.classList.contains('hidden')) {
      appendChatMessage(box, msg, me);
    }
    return;
  }

  if (data.channel === 'dm') {
    const other = msg.sender?.user_id === me ? msg.recipient_id : msg.sender?.user_id;
    if (chatDmUserId === other) {
      appendChatMessage($('#chat-dm-messages'), msg, me);
    }
    if ($('#screen-chat')?.classList.contains('active')) loadDmList();
  }
}

async function initChatPage() {
  const ok = await ensureAuth();
  if (!ok) return;
  chatSocketReady = false;
  chatReplyTo = null;
  chatPendingImage = null;
  clearChatReply();

  try {
    const me = await fetchMe();
    if (me.ban?.banned) {
      showHomeToast(me.ban.reason);
      return;
    }
    const tab = $('#chat-panel-dm')?.classList.contains('hidden') ? 'public' : 'dm';
    const mute = tab === 'dm' ? me.chat_mute?.dm : me.chat_mute?.public;
    if (mute?.muted) showHomeToast(mute.reason);

    await ensureChatSocket();
    await loadPublicChat();
    await loadDmList();
  } catch (e) {
    showHomeToast(e.message);
  }

  if (!window._chatSocketWired) {
    window._chatSocketWired = true;
    socket.on('chat:message', onChatSocketMessage);
    socket.on('disconnect', () => { chatSocketReady = false; });
  }
}

function wireChatPage() {
  $('#btn-chat-back')?.addEventListener('click', () => initHome());

  $$('.chat-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchChatTab(tab.dataset.tab));
  });

  $('#btn-chat-reply-cancel')?.addEventListener('click', clearChatReply);
  $('#btn-chat-send')?.addEventListener('click', () => sendChatMessage('public'));
  $('#btn-chat-dm-send')?.addEventListener('click', () => sendChatMessage('dm'));

  $('#chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChatMessage('public'); }
  });
  $('#chat-dm-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChatMessage('dm'); }
  });

  $('#btn-chat-dm-image')?.addEventListener('click', () => $('#chat-dm-image-input')?.click());
  $('#chat-dm-image-input')?.addEventListener('change', (e) => {
    uploadChatImage(e.target.files?.[0], 'dm');
    e.target.value = '';
  });

  $('#btn-chat-profile-close')?.addEventListener('click', closeChatProfile);
  $('#chat-profile-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'chat-profile-modal') closeChatProfile();
  });
}

document.addEventListener('DOMContentLoaded', wireChatPage);
