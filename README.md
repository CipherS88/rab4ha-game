<div align="center">

# 🃏 بلوت · Baloot Web

### *لعبة البلوت على جوالك، والسيرفر على جهازك — offline and local*

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-3fb950?style=for-the-badge)

> *نسخة ويب كاملة من البلوت، تعمل محليًا بدون أي خدمة سحابية — الغرفة والسيرفر على جهازك.*

</div>

---

## ✨ عن المشروع

لعبة بلوت ويب للجوال تعمل على جهازك كسيرفر: تفتح المتصفح، تدخل الغرفة، وتلعب مع البوتات أو مع أربعة لاعبين حقيقيين على نفس الشبكة. المنطق كامل على الخادم، والواجهة تستقبل الحالة لحظيًا عبر WebSocket.

المشروع يحتوي أيضًا على نسخة Flutter تحت `rab4ha_flutter` تُبنى إلى الويب بأمر واحد.

---

## 🚀 التشغيل

```bash
npm install          # مرة واحدة
npm start            # تشغيل السيرفر
npm run stop         # إيقاف السيرفر
npm run restart      # إيقاف ثم تشغيل من جديد
```

ثم افتح المتصفح على: **http://localhost:3000**

للعب من جوال على نفس الشبكة: **http://[IP-جهازك]:3000**

### نسخة Flutter

```bash
npm run flutter:build
```

---

## 🎮 أوضاع اللعب

### ضد البوتات (اختبار فردي)

1. أدخل اسمك واضغط **ابدأ اللعب**
2. انتظر 8 ثوانٍ أو اضغط **ابدأ مع البوتات الآن**

### أربعة متصفحات (4 لاعبين)

افتح 4 نوافذ بروابط مختلفة:

| الرابط | المقعد |
| :--- | :--- |
| `http://localhost:3000?seat=0` | يمين |
| `http://localhost:3000?seat=1` | فوق |
| `http://localhost:3000?seat=2` | يسار |
| `http://localhost:3000?seat=3` | أنت (أسفل) |

---

## ✨ الميزات

- توزيع متحرك: 5 كروت وجهًا لأسفل، ثم كشف بعد الشراء
- مرحلة شراء (لفة 1 و 2) مع «أشكل» في اللفة الأولى فقط
- نافذة اختيار لون الحكم في اللفة الثانية
- تحديد مسبق للكرت
- قاعدة الإكة (اللعب الحر عند إكة الشريك)
- نظام القيد
- حركة رمي الكروت للوسط

---

## 📂 البنية

```text
server/engine.js         منطق اللعبة
server/gameManager.js    الغرف والبوتات
server/index.js          Express + Socket.io
scripts/                 stop / restart / promote-admin
public/                  الواجهة
rab4ha_flutter/          نسخة Flutter
الملفات/cards/           صور الكروت
```

---

## 🧠 ملاحظات

- كل الحالة على الخادم: إغلاق المتصفح لا يُسقط الدور، ويُستأنف من نفس الجلسة.
- الصور تُحمّل من `الملفات/cards/` — إذا نقلتها، عدّل المسار في الواجهة.
- لا يوجد أي اتصال خارجي؛ اللعبة محلية بالكامل.

---

<div align="center">

<sub>Built by <b>Abdullah Aljuaid</b> · <a href="https://github.com/CipherS88">@CipherS88</a></sub>

</div>
