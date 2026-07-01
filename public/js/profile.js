/** ملف اللاعب + API محلي */



function getDeviceId() {

  const user = typeof getCachedUser === 'function' ? getCachedUser() : null;

  if (user?.id) return `user_${user.id}`;

  const KEY = 'baloot_device_id';

  let id = localStorage.getItem(KEY);

  if (!id) {

    id = 'dev_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);

    localStorage.setItem(KEY, id);

  }

  return id;

}



let cachedProfile = null;



async function fetchProfile() {

  if (isLoggedIn?.()) {

    const data = await fetchMe();

    cachedProfile = typeof normalizeProfileRanks === 'function'

      ? normalizeProfileRanks(data.profile)

      : data.profile;

    if (data.profile_limits) cachedProfile.profile_limits = data.profile_limits;

    return cachedProfile;

  }

  const deviceId = getDeviceId();

  const res = await fetch(`/api/profile/${deviceId}`);

  if (!res.ok) throw new Error('فشل تحميل الملف');

  const data = await res.json();

  cachedProfile = data.profile;

  return cachedProfile;

}



async function updateProfileName(name) {

  if (isLoggedIn?.()) {

    const res = await apiFetch('/api/auth/profile', {

      method: 'PATCH',

      body: JSON.stringify({ display_name: name }),

    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'فشل تحديث الاسم');

    cachedProfile = typeof normalizeProfileRanks === 'function'

      ? normalizeProfileRanks(data.profile)

      : data.profile;

    const user = getCachedUser();

    if (user && data.user) {

      setAuthSession(getAuthToken(), { ...user, display_name: data.user.display_name });

    }

    return cachedProfile;

  }

  const deviceId = getDeviceId();

  const res = await fetch(`/api/profile/${deviceId}`, {

    method: 'PATCH',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({ name }),

  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'فشل تحديث الاسم');

  cachedProfile = data.profile;

  return cachedProfile;

}



async function updateProfileAvatar(dataUrl) {

  const res = await apiFetch('/api/auth/profile/avatar', {

    method: 'POST',

    body: JSON.stringify({ image: dataUrl }),

  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'فشل رفع الصورة');

  cachedProfile = typeof normalizeProfileRanks === 'function'

    ? normalizeProfileRanks(data.profile)

    : data.profile;

  const user = getCachedUser();

  if (user && data.user) {

    setAuthSession(getAuthToken(), { ...user, display_name: data.user.display_name });

  }

  return data;

}



async function reportMatchResult(won, mode = 'ranked') {

  const deviceId = getDeviceId();

  const res = await fetch(`/api/profile/${deviceId}/match-result`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({ won, mode }),

  });

  if (!res.ok) return null;

  const data = await res.json();

  cachedProfile = data.profile;

  return data;

}



function getCachedProfile() {

  return cachedProfile;

}



function getPlayerName() {

  return cachedProfile?.name || localStorage.getItem('baloot_player_name') || 'لاعب';

}



function setPlayerNameLocal(name) {

  localStorage.setItem('baloot_player_name', name);

}

