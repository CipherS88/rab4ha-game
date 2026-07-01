/** شريط التنقل السفلي */

const NAV_SCREENS = new Set(['home', 'store', 'friends', 'bag', 'chat']);

function updateBottomNav(screenName) {
  const visible = NAV_SCREENS.has(screenName);
  document.body.classList.toggle('app-nav-visible', visible);

  document.querySelectorAll('.bottom-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.screen === screenName);
  });
}

function wireBottomNav() {
  $('#nav-home')?.addEventListener('click', () => initHome());

  $('#nav-store')?.addEventListener('click', () => {
    showScreen('store');
    initStorePage?.();
  });

  $('#nav-friends')?.addEventListener('click', () => {
    showScreen('friends');
    initFriendsPage?.();
  });

  $('#nav-bag')?.addEventListener('click', () => {
    showScreen('bag');
    initBagPage?.();
  });

  $('#nav-chat')?.addEventListener('click', () => {
    showScreen('chat');
    initChatPage?.();
  });
}

document.addEventListener('DOMContentLoaded', wireBottomNav);
