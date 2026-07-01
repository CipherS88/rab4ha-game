/** رسائل سريعة — طاولة اللعب */

const QUICK_CHAT_MESSAGES = [
  'السلام عليكم',
  'وعليكم السلام',
  'فنااان',
  'كفو خوي!',
  'كفوك الطيب',
  'كبوت!',
  'فدا',
  'طرا',
  'تسلم ليا',
  'هههههه',
  'بسرعة!!',
  'حرام عليك',
  'صحصح خوي',
  'سموحة',
  'ابشر بالعوض',
  'بطل!',
  'طيار!!',
  'ارحب',
  'ما قصرت',
  'يا ساتر',
];

function openQuickChatMenu() {
  const overlay = $('#quick-chat-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeQuickChatMenu() {
  const overlay = $('#quick-chat-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function sendQuickChatMessage(text) {
  if (!text) return;
  if (typeof socket !== 'undefined' && socket?.connected) {
    socket.emit('chat', { text });
  }
  closeQuickChatMenu();
}

function buildQuickChatGrid() {
  const grid = $('#quick-chat-grid');
  if (!grid) return;
  grid.innerHTML = '';
  QUICK_CHAT_MESSAGES.forEach((msg) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-chat-msg';
    btn.textContent = msg;
    btn.addEventListener('click', () => sendQuickChatMessage(msg));
    grid.appendChild(btn);
  });
}

function wireQuickChat() {
  buildQuickChatGrid();
  $('#btn-quick-chat')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openQuickChatMenu();
  });
  $('#btn-quick-chat-close')?.addEventListener('click', closeQuickChatMenu);
  $('#quick-chat-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'quick-chat-overlay') closeQuickChatMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQuickChatMenu();
  });
}

document.addEventListener('DOMContentLoaded', wireQuickChat);
