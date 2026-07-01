# PROJECT_MAP — ربعها (Rab4ha) Flutter Migration

> **آخر تحديث:** 2026-06-26 (واجهة قيد — كروت مكدّسة + مواقع الموزع)  
> **الحالة:** M0–M6 منفّذة — `rab4ha_flutter/` جاهز للتشغيل  
> **النطاق:** عميل Flutter فقط. الخادم Node.js بدون تغيير.

---

## [TECH_STACK]

| مكدس | إصدار |
|------|--------|
| Flutter SDK (مثبت) | 3.41.9 |
| Dart | 3.11.5 |
| flutter_riverpod | ^3.3.2 |
| go_router | ^17.3.0 |
| dio | ^5.9.2 |
| socket_io_client | ^3.1.6 |
| google_fonts | ^6.2.1 |
| shared_preferences | ^2.5.3 |
| cached_network_image | ^3.4.1 |
| image_picker | ^1.1.2 |

**تشغيل:**
```bash
cd rab4ha_flutter
flutter pub get
flutter run --dart-define=FLAVOR=dev -d chrome
# أو
flutter run --dart-define=FLAVOR=dev   # مع السيرفر على localhost:3000
```

**Flavors:** `dev` | `staging` | `prod` عبر `--dart-define=FLAVOR=...`

---

## [SYSTEM_FLOW]

- **16 route** مطابقة لـ `#screen-*` في `index.html`
- **Socket.io** — كل أحداث `app.js` مربوطة في `game_controller.dart`
- **REST** — `/api/auth`, `/api/store`, `/api/chat`, `/api/sessions`, `/api/tournaments`, `/api/leaderboards`
- **JWT** — مفتاح `baloot_auth_token` (SharedPreferences)
- **صن** — label من السيرفر + `formatBidLabel` → `صن`

---

## [ARCHITECTURE]

```
rab4ha_flutter/lib/
├── main.dart / app shell
├── core/          config, theme, logger, api, socket, router
├── shared/        models, buttons, radar, sadu VIP frame, network assets
└── features/      auth, home, game (+ qaid_ui, trick_table), matchmaking, ranked, sessions,
                   store, bag, friends, chat, settings, leaderboards,
                   tournaments, loading, name
```

---

## Milestones — حالة التحقق

| Milestone | الحالة | معيار النجاح |
|-----------|--------|--------------|
| M0 Bootstrap | ✅ | Theme, Logger, Api, Socket, flavors |
| M1 Auth + Shell | ✅ | Login, JWT, bottom nav 5 tabs |
| M2 Home + Rank | ✅ | Hero, expert/خبير, radar, rank themes |
| M3 Game Loop | ✅ | join, table, hand fan, bid (صن), play |
| M4 Game Features | ✅ | qaid, sawa, quick chat, table gifts, rejoin |
| M5 Social/Meta | ✅ | chat, friends, store, bag, sessions, leaderboards, tournaments |
| M6 Polish | ✅ | Loading anim, Sadu VIP frame, tests (9), web build |

---

## [ORPHANS & PENDING]

| ID | البند | الحالة |
|----|-------|--------|
| O1 | Admin panel | ✅ **مقصي** — web-only |
| O2 | Sadu patterns | ✅ `VipAvatarFrame` + `SaduPatternBorder` |
| O3 | Prototypes HTML | ✅ مدمجة في loading/home/game |
| O4 | device_id legacy | ✅ JWT فقط |
| O5 | Fonts | ✅ google_fonts (Tajawal/Cairo) |
| O6 | Web deploy | ✅ Express يقدّم `build/web` على `/app/` + CORS لـ dev |
| O7 | socket port-0 | ✅ URL صريح `:3000` في dev |
| O8 | Tournament locked UI | ✅ toast في home (مطابق web) |
| O9 | Dev quick logins | ✅ dev flavor فقط |
| O10 | Card back cosmetics | ✅ من profile/bag equip |
| O11 | Audio | ✅ لا action (غير موجود في web) |
| O12 | i18n | ✅ ar RTL فقط |

**النشر (O6):** `npm run flutter:build && npm start` ثم افتح `http://localhost:3000/app/`. للتطوير السريع: `npm run flutter:run` (يتطلب السيرفر على 3000).

---

## قرارات معتمدة

1. Admin → web-only  
2. Sadu → إلزامي VIP frames  
3. المشروع → `rab4ha_flutter/` sibling  
4. URLs → flavors dev/staging/prod  

---

*المنتج جاهز للاختبار المحلي: شغّل `npm start` في الجذر ثم `flutter run`.*
