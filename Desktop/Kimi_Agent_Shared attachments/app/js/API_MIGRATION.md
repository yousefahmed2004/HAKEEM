# 🔄 ملاحظات الترقية إلى API Backend

## التغييرات الرئيسية

### ✅ ملف جديد: `api.js`
- طبقة تجريدية للتعامل مع الـ Backend
- تحتوي على دوال لجميع عمليات API
- معالجة الأخطاء بشكل موحّد

### 📝 تعديلات مقترحة على `store.js`

استبدل جميع عمليات `localStorage` بـ استدعاءات API:

```javascript
// قديم (localStorage)
const db = localStorage.getItem("pharmacy_bot_db_v1");

// جديد (API)
const response = await App.api.getOrders();
```

### 📝 تعديلات مقترحة على `app.js`

```javascript
// تسجيل الدخول
router.post("/login", async (username, password) => {
  const result = await App.api.login(username, password);
  if (result.ok) {
    sessionStorage.setItem("current_user_id", result.user.id);
    // جلب البيانات الأخرى من API
  }
});
```

---

## 🚀 خطوات التشغيل

### 1️⃣ شغّل الخادم Backend
```bash
cd backend
npm install
npm start
```

### 2️⃣ تأكد من رابط API
في `app/js/api.js`:
```javascript
const API_BASE = "http://localhost:5000/api";
```

### 3️⃣ افتح التطبيق
```bash
cd app
# افتح index.html في المتصفح
```

---

## 📊 دوال API المتاحة

### المصادقة
- `App.api.login(username, password)` ✅
- `App.api.getUser(userId)` ✅
- `App.api.updateProfile(userId, updates)` ✅
- `App.api.getPharmacists()` ✅
- `App.api.addPharmacist(data)` ✅
- `App.api.updateUserStatus(userId, status)` ✅

### الطلبات
- `App.api.getOrders(filters)` ✅
- `App.api.getOrder(orderId)` ✅
- `App.api.createOrder(orderData)` ✅
- `App.api.updateOrder(orderId, updates)` ✅
- `App.api.rejectOrder(orderId, pharmacyId)` ✅
- `App.api.getOrdersStats()` ✅

---

## 🔗 مثال الاستخدام

```javascript
// تسجيل الدخول
const loginResult = await App.api.login("admin", "123456");
if (loginResult.ok) {
  console.log("✅ تم تسجيل الدخول:", loginResult.user);
  sessionStorage.setItem("current_user_id", loginResult.user.id);
}

// جلب جميع الطلبات
const ordersResult = await App.api.getOrders();
console.log("📦 الطلبات:", ordersResult.orders);

// جلب إحصائيات
const statsResult = await App.api.getOrdersStats();
console.log("📊 الإحصائيات:", statsResult.stats);

// قبول طلب
const acceptResult = await App.api.updateOrder("10001", {
  status: "accepted",
  pharmacyId: "u-ph1",
  pharmacyName: "صيدلية النور",
  availableItems: ["Panadol", "Augmentin"],
  price: 150
});
```

---

## ⚠️ متطلبات التخزين المؤقت

للحفاظ على التوافقية مع الكود الحالي:
- استخدم `sessionStorage` لمعرّف المستخدم الحالي فقط
- استدعِ API لجميع البيانات الأخرى

---

## 🛠️ استكشاف الأخطاء

### الخطأ: "فشل الاتصال بالخادم"
- تأكد من تشغيل Backend على `localhost:5000`
- افتح DevTools (F12) وتحقق من Network tab

### الخطأ: CORS
- تأكد من تضمين `cors` في Backend
- رابط API يجب أن يكون `http://localhost:5000/api`

---

## 📱 اختبار سريع

في DevTools Console:
```javascript
App.api.login("admin", "123456").then(r => console.log(r));
```

إذا رأيت:
```
{ok: true, user: {...}}
```
✅ الاتصال يعمل بنجاح!

---

## 🎯 الخطوات التالية

1. ✅ Backend جاهز
2. ⏳ تحديث `store.js` للاستخدام API
3. ⏳ تحديث معالجات الأحداث في `app.js`
4. ⏳ اختبار كل صفحة (Dashboard, Orders, Pharmacists, etc.)
5. ⏳ إضافة مصادقة JWT (اختياري)
