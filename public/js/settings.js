/** الإعدادات */

async function initSettingsPage() {
  try {
    const data = await fetchMe();
    $('#settings-email').value = data.user?.email || '';
    $('#settings-phone').value = data.user?.phone_sa || '';
  } catch (e) {
    showHomeToast?.('تعذّر تحميل الإعدادات') || alert(e.message);
  }
}

function wireSettingsPage() {
  $('#btn-settings')?.addEventListener('click', () => {
    showScreen('settings');
    initSettingsPage();
  });

  $('#btn-settings-back')?.addEventListener('click', () => initHome());

  $('#settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/auth/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          email: $('#settings-email').value.trim(),
          phone_sa: $('#settings-phone').value.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAuthSession(getAuthToken(), data.user);
      showHomeToast('تم حفظ الإعدادات');
    } catch (err) {
      alert(err.message);
    }
  });

  $('#btn-settings-logout')?.addEventListener('click', async () => {
    await logoutUser();
    showScreen('login');
  });
}

document.addEventListener('DOMContentLoaded', wireSettingsPage);
