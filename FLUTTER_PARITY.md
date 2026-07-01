# Flutter Parity Checklist — Vanilla (HTML/CSS/JS) ↔ Flutter

> **آخر تحديث:** 2026-06-26  
> **المرجع:** `public/` (vanilla) vs `rab4ha_flutter/lib/`  
> **الحالة:** ⏳ = pending · 🔧 = in progress · ✅ = done · 🚫 = web-only (لا يُنقل)

---

## كيف نستخدم هذه القائمة

1. نبدأ من **P01** بالترتيب (أو حسب الأولوية في [الجدول السريع](#الأولوية)).
2. كل بند: تنفيذ → `flutter test` → تسجيل ✅ في عمود **Flutter**.
3. Admin (P66) **مستثنى** — web-only.

---

## Auth & Onboarding

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P01 | تسجيل الدخول | `auth.js`, `index.html` L48–90 | `login_screen.dart` | — | ✅ |
| P02 | إنشاء حساب + عرض المعرّف | `auth.js` | `login_screen.dart` | dialog + toast | ✅ |
| P03 | شاشة التحميل | `loading.js` | `loading_screen.dart` | — | ✅ |
| P04 | شاشة الاسم الاحتياطية | `index.html` L590 | `name_screen.dart` | زر solo + تلميحات dev | ✅ |
| P05 | استعادة الجلسة | `app.js` activeGame | `game_controller.dart` | — | ✅ |
| P06 | حظر الحساب | `auth.js` | `ban_screen.dart` | شاشة/رسالة ban مع السبب | ✅ |

## Home & Profile

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P07 | البانر الرئيسي | `home.js` | `home_screen.dart` | — | ✅ |
| P08 | رفع صورة العرض | `home.js`, `profile.js` | `home_screen.dart` | — | ✅ |
| P09 | تعديل الاسم | `home.js` | `auth_provider.dart` | — | ✅ |
| P10 | كرتان فوق الأفاتار | `home.css`, `home.js` | `deck_stack.dart` | — | ✅ |
| P11 | إطار سدو VIP | `home.js` | `sadu_frame.dart` | — | ✅ |
| P12 | نجمة الحالة | `statusBadge.js` | `player_avatar.dart` | — | ✅ |
| P13 | ثيم التصنيف للشاشة كاملة | `home.js` applyRankTheme | `home_screen.dart` | gradient خلفية Scaffold | ✅ |
| P14 | Toast عام | `home.js` | `buttons.dart` | — | ✅ |
| P15 | شريط تنقل سفلي | `nav-bar.js` | `app_shell.dart` | — | ✅ |

## Settings & Ranked

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P16 | الإعدادات | `settings.js` | `settings_screen.dart` | تلميح Barq للجوال السعودي | ✅ |
| P17 | لوبي المصنّف | `ranked.js` | `ranked_screen.dart` | شريط ترقية + «باقي X نقطة» | ✅ |
| P18 | معاينة المقاعد (matchmaking) | `app.js` seats-preview | `matchmaking_screen.dart` | شبكة 4 مقاعد | ✅ |
| P19 | إلغاء الانتظار | `app.js` | `matchmaking_screen.dart` | — | ✅ |
| P20 | ملء بالبوتات | `app.js` | `matchmaking_screen.dart` | — | ✅ |

## Game Table

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P21 | مقاعد الطاولة (بصرية) | `game.css`, `app.js` | `game_seat_widget.dart` | avatars + glow + fan | ✅ |
| P22 | خلفية الجلسة | `app.js` | `game_screen.dart` | — | ✅ |
| P23 | ظهر الأوراق في اللعب | `cards.js` | `game_screen.dart` | `card_back_url` في trick/floor | ✅ |
| P24 | الشراء والتدبيل | `app.js` | `game_screen.dart` | — | ✅ |
| P25 | كرت الأرض + dealing | `app.js` | `game_overlays.dart` | overlay توزيع | ✅ |
| P26 | أنيميشن اللعبة | `app.js` | `game_controller.dart` | throw + collect | ✅ |
| P27 | اختيار مسبق للورقة | `app.js` | `game_controller.dart` | — | ✅ |
| P28 | شريط المشاريع | `app.js` | `game_screen.dart` | — | ✅ |
| P29 | عرض المشاريع المكشوفة | `app.js` project-spreads | `game_overlays.dart` | overlay من `project_details` | ✅ |
| P30 | سوا (عرض كامل) | `app.js` sawa-spreads | `game_overlays.dart` | fans + banner اعتراض | ✅ |
| P31 | قيد 3 خطوات | `index.html` modal-qaid | `qaid_wizard.dart` | stack + fog + dealer arrows | ✅ |
| P32 | النشرة | `app.js` renderSummary | `game_screen.dart` | modal عند SCORE_SUMMARY | ✅ |
| P33 | نهاية المباراة | `app.js` match-end | `game_screen.dart` | rank delta + «قهوة جديدة» | ✅ |
| P34 | نتيجة مصنّف API | `profile.js` | `game_controller.dart` | POST match-result | ✅ |
| P35 | العب مرة أخرى | `app.js` playAgain | `game_screen.dart` | زر rematch | ✅ |
| P36 | مؤقت الدور | `game.css` timer-ring | `turn_timer_ring.dart` | countdown دائري | ✅ |
| P37 | رسائل سريعة | `quickChat.js` | `game_screen.dart` | — | ✅ |
| P38 | هدايا الطاولة (اختيار لاعب) | `tableGifts.js` | `game_seat_widget.dart` | recipient picker + balance | ✅ |
| P39 | فتحات الهدايا على المقاعد | `tableGifts.js` | `game_seat_widget.dart` | 3 slots emoji/مقعد | ✅ |
| P40 | أنيميشن هدية الطاولة | `tableGifts.js` | `game_overlays.dart` | fly + toast | ✅ |
| P41 | مغادرة مصنّف | `app.js` | `game_screen.dart` | — | ✅ |
| P42 | إعادة انضمام (prompt) | `app.js` | `rejoin_prompt.dart` | dialog «عودة للمباراة» | ✅ |
| P68 | يد الخصم (card backs) | `cards.js` | `game_screen.dart` | fan-hand للخصوم | ✅ |

## Chat & Friends

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P43 | الشات العام | `chat.js` | `chat_screen.dart` | — | ✅ |
| P44 | الشات الخاص | `chat.js` | `chat_screen.dart` | banner حذف 48h | ✅ |
| P45 | صور في الخاص | `chat.js` | `chat_screen.dart` | upload + عرض | ✅ |
| P46 | الرد على رسالة | `chat.js` | `chat_screen.dart` | reply bar + reply_to_id | ✅ |
| P47 | تبليغ رسالة | `chat.js` | `chat_profile_sheet.dart` | زر report | ✅ |
| P48 | ملف اللاعب في الشات | `chat.js` modal | `chat_profile_sheet.dart` | bottom sheet + radar | ✅ |
| P49 | صداقة من الشات | `chat.js` | `chat_profile_sheet.dart` | request/accept/block | ✅ |
| P50 | حظر المستخدم | `chat.js` | `chat_profile_sheet.dart` | block/unblock | ✅ |
| P51 | الأصدقاء → DM مباشر | `friends.js` | `friends_screen.dart` | `/chat?dm=` | ✅ |
| P52 | طلبات صداقة | `friends.js` | `friends_screen.dart` | — | ✅ |

## Store & Bag

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P53 | معاينة قبل الشراء | `store.js` | `store_screen.dart` | preview modal | ✅ |
| P54 | الحقيبة + تجهيز | `bag.js` | `bag_screen.dart` | — | ✅ |

## Sessions VIP

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P55 | قائمة الجلسات | `sessions.js` | `sessions_screen.dart` | tabs + حقول إنشاء كاملة | ✅ |
| P56 | لوبي الجلسة | `sessions.js` | `session_lobby_screen.dart` | 2v2 board + avatars | ✅ |
| P57 | عد تنازلي للبدء | `sessions.js` | `session_lobby_screen.dart` | countdown 5s | ✅ |
| P58 | مغادرة الجلسة | `sessions.js` | `session_lobby_screen.dart` | زر leave | ✅ |

## Tournaments

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P59 | قائمة البطولات | `tournaments.js` | `tournaments_screen.dart` | home → `/tournaments` | ✅ |
| P60 | إنشاء بطولة | `tournaments.js` | `tournaments_screen.dart` | form create | ✅ |
| P61 | تفاصيل + bracket | `tournaments.js` | `tournament_detail_screen.dart` | شجرة bracket | ✅ |

## Leaderboards

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P62 | لوحة الشرف | `leaderboards.js` | `leaderboards_screen.dart` | — | ✅ |

## Player Gifts

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P63 | استلام هدية popup | `gifts.js` | `gift_controller.dart` | overlay + queue | ✅ |
| P64 | إرسال هدية | `gifts.js` | `gift_send_modal.dart` | modal coins/VIP | ✅ |
| P65 | هدايا معلّقة | `chat.js` | `gift_controller.dart` | handle pending_gifts | ✅ |

## Admin (Web-only)

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P66 | لوحة الإدارة | `admin.html` | — | — | 🚫 |

## UI Polish

| ID | الميزة | Vanilla | Flutter | الحل | الحالة |
|----|--------|---------|---------|------|--------|
| P67 | أنيميشن إلقاء/جمع | `app.js`, `game.css` | `game_overlays.dart` | tweens على socket | ✅ |
| P69 | Lobby toast | `sessions.js` | `session_lobby_screen.dart` | toast مشترك | ✅ |
| P70 | ثيم شاشة المصنّف | `ranked.js` | `ranked_screen.dart` | full-screen theme | ✅ |

---

## الأولوية (ترتيب التنفيذ)

| # | IDs | السبب |
|---|-----|--------|
| 1 | P59, P51, P02, P16, P17, P18 | سريعة — UX واضح |
| 2 | P42, P34, P32, P33, P35 | تدفق المباراة |
| 3 | P68, P21, P23, P29, P30, P31 | طاولة اللعب |
| 4 | P48–P50, P45–P47, P63–P65 | شات + هدايا |
| 5 | P55–P58, P60–P61 | جلسات + بطولات |
| 6 | P26, P36, P38–P40, P67 | polish |

---

## سجل التقدم

| تاريخ | ID | ملاحظة |
|-------|-----|--------|
| 2026-06-26 | P01,P03,P05,P07–P12,P14,P15,P19,P20,P22,P24,P27,P28,P37,P41,P43,P52,P54,P62 | موجود مسبقاً |
| 2026-06-26 | P02,P16,P17,P18,P32–P35,P51,P59,P68 | دفعة 1 — UX + نشرة + مصنّف + fans |
| 2026-06-26 | P10 | كرتان فوق الأفاتار |
| 2026-06-26 | P31,P42,P44,P47–P50,P55–P58,P60–P61,P63–P65 | دفعة 2 — قيد + rejoin + شات + هدايا + جلسات + بطولات |
| 2026-06-26 | P04,P06,P13,P21,P23–P26,P29,P30,P36,P38–P40,P45,P46,P53,P67,P69,P70 | دفعة 3 — طاولة + polish + شات + متجر |
| | | *(يُحدَّث مع كل دفعة)* |

---

*المجموع: ~70 بند · ✅ ~69 · ⏳ 0 · 🚫 1*
