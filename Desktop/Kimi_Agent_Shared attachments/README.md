# 🏥 Pharmacy Bot — نظام إدارة طلبات الصيدلية

> نظام ويب متكامل لإدارة طلبات الصيدليات من الشات بوت - مع Backend SQLite وـ Express.js

## 🚀 البدء السريع

### المتطلبات
- Node.js v14+
- npm أو yarn
- متصفح حديث

### التثبيت والتشغيل

```bash
# 1. ثبّت حزم Backend
cd backend
npm install

# 2. شغّل الخادم
npm start

# ستشاهد:
# ✅ Pharmacy Bot Backend يعمل على: http://localhost:5000
```

### افتح التطبيق

```bash
# في نافذة جديدة
cd app
# افتح index.html في المتصفح (أو استخدم Live Server)
```

### تسجيل الدخول

استخدم أحد الحسابات التجريبية:

| المستخدم | كلمة المرور | الدور |
|---|---|---|
| admin | 123456 | مدير النظام |
| noor | 123456 | صيدلي |
| shefaa | 123456 | صيدلي |
| seif | 123456 | صيدلي |
| elzohry | 123456 | صيدلي |

---

## 📋 الميزات الرئيسية

### 🎯 للمدير (Admin)
- 📊 لوحة تحكم شاملة
- 👥 إدارة الصيادلة (إضافة، تعليق، تفعيل)
- 📈 الإحصائيات والتقارير
- 📋 عرض جميع الطلبات
- ⚙️ الإعدادات

### 👨‍⚕️ للصيدلي (Pharmacist)
- 📦 عرض الطلبات المعلقة
- ✅ قبول الطلبات
- ⚠️ رفض الطلبات
- 🏷️ تحديد الأدوية المتوفرة/غير المتوفرة
- 💰 تحديد السعر
- 📝 إضافة ملاحظات

---

## 🏗️ البنية المعمارية

### Frontend
- **النوع**: تطبيق ويب بـ Vanilla JavaScript
- **الملفات الرئيسية**:
  - `app.js` — الموجّه والهيكل الرئيسي
  - `store.js` — إدارة البيانات (سيتم تحديثه للاستخدام API)
  - `api.js` — ✨ جديد: طبقة التكامل مع Backend
  - `ui.js` — عناصر الواجهة
  - `charts.js` — الرسوم البيانية
  - `pages*.js` — صفحات المحتوى

### Backend
- **النوع**: خادم Express.js
- **قاعدة البيانات**: SQLite
- **المسارات الرئيسية**:
  - `routes/auth.js` — المصادقة والمستخدمين
  - `routes/orders.js` — الطلبات

### قاعدة البيانات
- **النوع**: SQLite
- **الجداول**:
  - `users` — المستخدمون (5 سجلات)
  - `orders` — الطلبات
  - `order_timeline` — السجل الزمني
  - `settings` — الإعدادات

---

## 🔌 نقاط نهاية API

### المصادقة

```
POST   /api/auth/login                   تسجيل دخول
GET    /api/auth/user/:userId           جلب بيانات المستخدم
PUT    /api/auth/user/:userId           تحديث الملف الشخصي
GET    /api/auth/pharmacists            قائمة الصيادلة (Admin)
POST   /api/auth/pharmacist             إضافة صيدلي جديد (Admin)
PATCH  /api/auth/user/:userId/status    تحديث الحالة (Admin)
```

### الطلبات

```
GET    /api/orders                      جميع الطلبات
GET    /api/orders/:orderId             طلب واحد
POST   /api/orders                      إنشاء طلب جديد
PUT    /api/orders/:orderId             تحديث الطلب
PATCH  /api/orders/:orderId/reject/:id  رفض الطلب
GET    /api/orders-stats                إحصائيات الطلبات
```

---

## 🧪 الاختبار

### من DevTools Console

```javascript
// اختبر صحة الخادم
await test_server_health()

// اختبر تسجيل الدخول
await test_login()

// اختبر جلب الطلبات
await test_get_orders()

// اختبار شامل كامل
await test_full_flow()
```

---

## 📚 الملفات التوثيقية

| الملف | الغرض |
|---|---|
| [backend/README.md](backend/README.md) | توثيق Backend الكاملة |
| [app/js/API_MIGRATION.md](app/js/API_MIGRATION.md) | دليل ترقية الكود |
| [SETUP.md](SETUP.md) | دليل البدء السريع |
| [UPGRADE_SUMMARY.md](UPGRADE_SUMMARY.md) | ملخص التحويلات |
| [QUICK_START.js](QUICK_START.js) | دليل سريع (شغّلها بـ node) |

---

## 🛠️ استكشاف الأخطاء

### ❌ "فشل الاتصال بالخادم"
1. تأكد من تشغيل Backend: `npm start`
2. افتح `http://localhost:5000` في المتصفح
3. تحقق من رسائل الخطأ في Terminal

### ❌ CORS Error
1. تأكد من استخدام رابط API الصحيح: `http://localhost:5000/api`
2. Backend مفعّل بـ CORS (تحقق من `server.js`)

### ❌ قاعدة البيانات فارغة
1. احذف: `backend/db/pharmacy_bot.db`
2. أعد تشغيل Backend
3. سيتم إنشاء قاعدة جديدة بالبيانات الابتدائية

---

## 🔗 التكامل مع n8n

النظام جاهز للربط مع n8n Webhook:

### استقبال طلب من الشات بوت
```javascript
const result = await App.api.createOrder({
  customerName: payload.customerName,
  phone: payload.phone,
  address: payload.address,
  items: payload.items,
  prescriptionImage: payload.prescriptionImage
});
```

### إرسال تحديث للعميل
```javascript
await App.api.updateOrder(orderId, {
  status: "accepted",
  pharmacyId: pharmacyId,
  availableItems: items,
  price: price
});
```

---

## 🚀 الخطوات التالية

- [ ] ✅ Backend يعمل
- [ ] تحديث `store.js` للاستخدام API الكامل
- [ ] اختبار جميع الصفحات
- [ ] إضافة مصادقة JWT (اختياري)
- [ ] إضافة WebSocket للإشعارات الحية (اختياري)
- [ ] ربط n8n Webhook الحقيقي
- [ ] نشر على خادم إنتاجي

---

## 📊 إحصائيات المشروع

| العنصر | العدد |
|---|---|
| ملفات Backend | 5 |
| ملفات Frontend جديدة | 3 |
| ملفات توثيق | 5 |
| نقاط نهاية API | 15+ |
| جداول البيانات | 4 |
| مستخدمون تجريبيون | 5 |
| أسطر كود Backend | 500+ |

---

## 📝 الملاحظات المهمة

1. **التخزين المؤقت**: البيانات تُخزّن في SQLite محليًا
2. **المصادقة**: كلمات المرور مخزنة بشكل عادي (استخدم bcrypt في الإنتاج)
3. **الصور**: تُخزّن كـ base64 مؤقتًا
4. **JWT**: يمكن إضافة المصادقة بـ JWT للأمان
5. **WebSocket**: يمكن إضافة إشعارات حية لاحقًا

---

## 📞 الدعم

للمساعدة أو الإبلاغ عن مشاكل، يرجى التواصل مع فريق التطوير.

---

## 📄 الترخيص

جميع الحقوق محفوظة © 2026

---

## 👨‍💻 المطورون

- **Backend**: Node.js + Express.js
- **Frontend**: Vanilla JavaScript
- **Database**: SQLite
- **Framework**: بدون أي فريمورك سنقيل

---

**🎉 شكرًا لاستخدام Pharmacy Bot!**

```
تم إنشاؤه بـ ❤️ لإدارة طلبات الصيدليات بكفاءة
Pharmacy Bot v1.0.0 — يوليو 2026
```
