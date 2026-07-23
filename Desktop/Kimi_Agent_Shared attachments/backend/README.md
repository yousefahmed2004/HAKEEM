# 🏥 Pharmacy Bot Backend

## التثبيت والتشغيل

### المتطلبات
- Node.js v14+
- npm أو yarn

### خطوات التثبيت

```bash
# 1. انتقل إلى مجلد backend
cd backend

# 2. ثبّت الحزم
npm install

# 3. شغّل الخادم
npm start

# أو للتطوير مع nodemon (يعيد تشغيل تلقائي)
npm run dev
```

الخادم سيبدأ على: **http://localhost:5000**

---

## 📊 قاعدة البيانات

- **النوع**: SQLite
- **المسار**: `backend/db/pharmacy_bot.db`
- **التهيئة**: تلقائية عند بدء التشغيل الأول

### الجداول:
- `users` — المستخدمون والصيادلة
- `orders` — الطلبات
- `order_timeline` — السجل الزمني للطلبات
- `settings` — الإعدادات

---

## 🔌 نقاط نهاية API

### المصادقة والمستخدمون

#### POST `/api/auth/login`
تسجيل دخول

```json
{
  "username": "admin",
  "password": "123456"
}
```

**الاستجابة:**
```json
{
  "ok": true,
  "user": {
    "id": "u-admin",
    "username": "admin",
    "role": "admin",
    "name": "أحمد سامي"
  }
}
```

#### GET `/api/auth/user/:userId`
الحصول على بيانات المستخدم

#### PUT `/api/auth/user/:userId`
تحديث الملف الشخصي

#### GET `/api/auth/pharmacists`
الحصول على قائمة الصيادلة (Admin فقط)

#### POST `/api/auth/pharmacist`
إضافة صيدلي جديد (Admin فقط)

#### PATCH `/api/auth/user/:userId/status`
تحديث حالة المستخدم (Admin فقط)

---

### الطلبات

#### GET `/api/orders`
الحصول على جميع الطلبات

**المعاملات:**
- `status` — حالة الطلب (pending, accepted, partial, rejected)
- `pharmacyId` — معرّف الصيدلية

#### GET `/api/orders/:orderId`
الحصول على طلب واحد مع السجل الزمني

#### POST `/api/orders`
إنشاء طلب جديد

```json
{
  "customerName": "أحمد",
  "phone": "01000000000",
  "address": "القاهرة",
  "items": ["Panadol", "Augmentin"],
  "prescriptionImage": "base64-image-data"
}
```

#### PUT `/api/orders/:orderId`
تحديث الطلب (القبول/الرفض/التنفيذ الجزئي)

```json
{
  "status": "accepted",
  "pharmacyId": "u-ph1",
  "pharmacyName": "صيدلية النور",
  "availableItems": ["Panadol", "Augmentin"],
  "price": 150,
  "notes": "متوفر الآن"
}
```

#### PATCH `/api/orders/:orderId/reject/:pharmacyId`
إضافة صيدلي إلى قائمة المرفوضين

#### GET `/api/orders-stats`
الحصول على إحصائيات الطلبات

---

## 👥 حسابات تجريبية

| اسم المستخدم | كلمة المرور | الدور |
|---|---|---|
| admin | 123456 | مدير النظام |
| noor | 123456 | صيدلي |
| shefaa | 123456 | صيدلي |
| seif | 123456 | صيدلي |
| elzohry | 123456 | صيدلي |

---

## 🔗 ربط Frontend

في ملف `app/js/api.js`، قم بتحديث رابط API:

```javascript
const API_BASE = "http://localhost:5000/api";
```

---

## 📝 الملاحظات

- البيانات تُخزّن محليًا في SQLite
- كل طلب يحتفظ بسجل زمني كامل
- الصور يمكن تخزينها كـ base64 مؤقتًا
- يتم إضافة `updatedAt` تلقائيًا لكل تحديث

---

## 🚀 الخطوات التالية

1. ربط Frontend عبر API
2. إضافة المصادقة بـ JWT
3. إضافة الإشعارات عبر WebSocket
4. ربط n8n Webhook للطلبات الحقيقية

---

## 📧 الدعم

للمساعدة أو الإبلاغ عن أخطاء، يرجى التواصل مع فريق التطوير.
