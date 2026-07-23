# 🏥 Pharmacy Bot — نظام إدارة طلبات الصيدلية

## 📋 ملخص المشروع

نظام ويب متكامل لإدارة طلبات الصيدليات من الشات بوت:
- **Frontend**: تطبيق ويب بـ Vanilla JavaScript
- **Backend**: خادم Node.js/Express
- **Database**: SQLite (مؤقتًا)
- **التكامل**: جاهز للربط مع n8n Webhook

---

## 📁 بنية المشروع

```
Kimi_Agent_Shared attachments/
├── app/                          # الواجهة الأمامية (Frontend)
│   ├── index.html               # الصفحة الرئيسية
│   ├── js/
│   │   ├── api.js              # ✨ جديد: طبقة API
│   │   ├── app.js              # الموجّه والهيكل الرئيسي
│   │   ├── store.js            # إدارة البيانات (سيتم تحديثه)
│   │   ├── ui.js               # عناصر الواجهة
│   │   ├── charts.js           # الرسوم البيانية
│   │   ├── pages1.js           # صفحات المحتوى
│   │   ├── pages2.js           # صفحات المحتوى
│   │   ├── pages3.js           # صفحات المحتوى
│   │   ├── webhook.js          # التكامل مع n8n
│   │   └── API_MIGRATION.md    # تعليمات الترقية
│   ├── css/
│   │   └── style.css           # الأنماط
│   └── assets/                 # الصور والأيقونات
│
├── backend/                      # الخادم (Backend) — ✨ جديد!
│   ├── package.json            # الحزم والمتطلبات
│   ├── server.js               # الخادم الرئيسي
│   ├── .env                    # متغيرات البيئة
│   ├── README.md               # توثيق Backend
│   ├── db/
│   │   ├── database.js         # قاعدة البيانات SQLite
│   │   └── pharmacy_bot.db     # ملف قاعدة البيانات (ينشأ تلقائيًا)
│   └── routes/
│       ├── auth.js             # مسارات المصادقة
│       └── orders.js           # مسارات الطلبات
│
└── SETUP.md                     # هذا الملف
```

---

## 🚀 البدء السريع

### الخطوة 1: تثبيت Backend

```bash
# انتقل إلى مجلد Backend
cd backend

# ثبّت الحزم
npm install

# شغّل الخادم
npm start
```

✅ سترى:
```
============================================================
✅ Pharmacy Bot Backend يعمل على: http://localhost:5000
============================================================
```

### الخطوة 2: افتح التطبيق الأمامي

```bash
# افتح المتصفح
cd app
# ثم افتح index.html (أو استخدم Live Server)
```

### الخطوة 3: تسجيل الدخول

استخدم أحد الحسابات التجريبية:

| المستخدم | كلمة المرور | الدور | الصيدلية |
|---|---|---|---|
| **admin** | 123456 | مدير النظام | — |
| **noor** | 123456 | صيدلي | صيدلية النور |
| **shefaa** | 123456 | صيدلي | صيدلية الشفاء |
| **seif** | 123456 | صيدلي | صيدلية سيف |
| **elzohry** | 123456 | صيدلي | صيدلية الزهري |

---

## 📊 الميزات الرئيسية

### للمدير (Admin)
- 📋 عرض جميع الطلبات
- 👥 إدارة الصيادلة (إضافة/تعليق)
- 📈 الإحصائيات والتقارير
- 🔧 الإعدادات
- 👤 الملف الشخصي

### للصيدلي (Pharmacist)
- 📦 عرض الطلبات المعلقة
- ✅ قبول أو رفض الطلبات
- 📝 تحديد الأدوية المتوفرة/غير المتوفرة
- 💰 تحديد السعر
- 👤 الملف الشخصي

---

## 🔌 نقاط نهاية API

### المصادقة والمستخدمون

```
POST   /api/auth/login                    تسجيل دخول
GET    /api/auth/user/:userId            جلب بيانات المستخدم
PUT    /api/auth/user/:userId            تحديث الملف الشخصي
GET    /api/auth/pharmacists             قائمة الصيادلة (Admin)
POST   /api/auth/pharmacist              إضافة صيدلي جديد (Admin)
PATCH  /api/auth/user/:userId/status     تحديث الحالة (Admin)
```

### الطلبات

```
GET    /api/orders                       جميع الطلبات
GET    /api/orders/:orderId              طلب واحد
POST   /api/orders                       إنشاء طلب جديد
PUT    /api/orders/:orderId              تحديث الطلب
PATCH  /api/orders/:orderId/reject/:id   رفض الطلب
GET    /api/orders-stats                 إحصائيات
```

---

## 💾 قاعدة البيانات

### الجداول:

#### `users` — المستخدمون
```sql
id, username, password, role, name, phone, pharmacyName, 
status, color, createdAt, updatedAt
```

#### `orders` — الطلبات
```sql
id, customerName, phone, address, items, prescriptionImage,
status, pharmacyId, pharmacyName, price, 
availableItems, unavailableItems, notes, rejectedBy,
createdAt, updatedAt
```

#### `order_timeline` — السجل الزمني
```sql
id, orderId, at, text, color
```

#### `settings` — الإعدادات
```sql
id, webhookUrl, apiKey, notifySound, notifyBrowser, 
simulate, pharmacyName, createdAt, updatedAt
```

---

## 🔗 التكامل مع n8n

عند الربط مع n8n:

### استقبال طلب من الشات بوت:
```javascript
// في n8n Webhook
const result = await App.api.createOrder({
  customerName: payload.customerName,
  phone: payload.phone,
  address: payload.address,
  items: payload.items,
  prescriptionImage: payload.prescriptionImage
});
```

### إرسال تحديث للعميل:
```javascript
// عند تحديث الطلب
await App.api.updateOrder(orderId, {
  status: "accepted",
  pharmacyId: pharmacyId,
  availableItems: items,
  price: price
});
```

---

## 🧪 الاختبار

### في DevTools Console:

```javascript
// تسجيل الدخول
const login = await App.api.login("admin", "123456");
console.log(login);

// جلب الطلبات
const orders = await App.api.getOrders();
console.log(orders.orders);

// الإحصائيات
const stats = await App.api.getOrdersStats();
console.log(stats.stats);
```

---

## ⚙️ المتطلبات

- **Node.js** v14 أو أعلى
- **npm** أو yarn
- **متصفح حديث** (Chrome, Firefox, Safari, Edge)
- **SQLite3** (يتم تثبيته مع npm)

---

## 🐛 استكشاف الأخطاء

### مشكلة: "فشل الاتصال بالخادم"
**الحل:**
- تأكد من تشغيل Backend (`npm start`)
- افتح `http://localhost:5000` في المتصفح
- اطّلع على رسائل الخطأ في Terminal

### مشكلة: CORS Error
**الحل:**
- تأكد من استخدام رابط API الصحيح: `http://localhost:5000/api`
- Backend مفعّل بـ CORS

### مشكلة: قاعدة البيانات فارغة
**الحل:**
- احذف `backend/db/pharmacy_bot.db`
- أعد تشغيل Backend
- سيتم إنشاء قاعدة بيانات جديدة بالبيانات الابتدائية

---

## 📝 الملاحظات المهمة

1. **التخزين المؤقت**: البيانات تُخزّن في SQLite محليًا
2. **المصادقة**: كلمات المرور مخزنة بشكل عادي (استخدم bcrypt في الإنتاج)
3. **الصور**: تُخزّن كـ base64 مؤقتًا
4. **الإشعارات**: يمكن إضافة WebSocket لاحقًا
5. **JWT**: يمكن إضافة المصادقة بـ JWT للأمان

---

## 🚀 الخطوات التالية

- [ ] ✅ Backend يعمل
- [ ] تحديث `store.js` ليستخدم API
- [ ] اختبار جميع الصفحات
- [ ] إضافة مصادقة JWT
- [ ] تفعيل الإشعارات WebSocket
- [ ] ربط n8n Webhook الحقيقي
- [ ] نشر على خادم إنتاجي

---

## 📞 الدعم

للمساعدة أو الإبلاغ عن مشاكل، يرجى التواصل مع فريق التطوير.

---

## 📄 الملفات الإضافية

- [Backend README](backend/README.md) — توثيق مفصلة للـ Backend
- [API Migration Guide](app/js/API_MIGRATION.md) — تعليمات ترقية الكود
- [Frontend Store](app/js/store.js) — إدارة البيانات (سيتم تحديثها)

---

**إصدار**: 1.0.0  
**التاريخ**: يوليو 2026  
**الحالة**: ✅ جاهز للاستخدام (مع البيانات التجريبية)
