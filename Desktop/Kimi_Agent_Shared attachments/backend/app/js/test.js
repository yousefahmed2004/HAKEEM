/* ============================================================
   test.js — اختبار سريع للـ Backend والـ API
   الاستخدام:
   1. افتح DevTools (F12)
   2. Copy & Paste كل test() واحد واحد في Console
   ============================================================ */

// ============================================================
// اختبار الاتصال بالخادم
// ============================================================

async function test_server_health() {
    console.log("🧪 اختبار: صحة الخادم...");
    try {
        const response = await fetch("http://localhost:5000");
        const data = await response.json();
        console.log("✅ الخادم يستجيب:", data);
        return true;
    } catch (err) {
        console.error("❌ الخادم لا يستجيب:", err.message);
        return false;
    }
}

// ============================================================
// اختبار تسجيل الدخول
// ============================================================

async function test_login() {
    console.log("🧪 اختبار: تسجيل الدخول...");
    try {
        const result = await App.api.login("admin", "123456");
        if (result.ok) {
            console.log("✅ تسجيل دخول بنجاح!");
            console.log("👤 المستخدم:", result.user.name);
            console.log("🎯 الدور:", result.user.role);
            sessionStorage.setItem("test_user_id", result.user.id);
            return result.user.id;
        } else {
            console.error("❌ فشل تسجيل الدخول:", result.error);
            return null;
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
        return null;
    }
}

async function test_login_pharmacist() {
    console.log("🧪 اختبار: تسجيل دخول صيدلي...");
    try {
        const result = await App.api.login("noor", "123456");
        if (result.ok) {
            console.log("✅ تسجيل دخول الصيدلي بنجاح!");
            console.log("🏪 الصيدلية:", result.user.pharmacyName);
            sessionStorage.setItem("test_pharmacist_id", result.user.id);
            return result.user.id;
        } else {
            console.error("❌ فشل تسجيل الدخول:", result.error);
            return null;
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
        return null;
    }
}

// ============================================================
// اختبار جلب بيانات المستخدم
// ============================================================

async function test_get_user() {
    console.log("🧪 اختبار: جلب بيانات المستخدم...");
    const userId = sessionStorage.getItem("test_user_id");
    if (!userId) {
        console.warn("⚠️ سجّل دخولك أولاً باستخدام test_login()");
        return;
    }
    try {
        const result = await App.api.getUser(userId);
        if (result.ok) {
            console.log("✅ تم جلب البيانات:");
            console.log(result.user);
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

// ============================================================
// اختبار جلب الطلبات
// ============================================================

async function test_get_orders() {
    console.log("🧪 اختبار: جلب جميع الطلبات...");
    try {
        const result = await App.api.getOrders();
        if (result.ok) {
            console.log(`✅ تم جلب ${result.orders.length} طلب`);
            console.log("أول 3 طلبات:");
            result.orders.slice(0, 3).forEach((order, i) => {
                console.log(`  ${i + 1}. [${order.id}] ${order.customerName} — ${order.status}`);
            });
            return result.orders;
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

async function test_get_order_by_id() {
    console.log("🧪 اختبار: جلب طلب واحد...");
    try {
        // استخدم أول طلب موجود (عادة ما يكون 10001)
        const result = await App.api.getOrder("10001");
        if (result.ok) {
            console.log("✅ تم جلب الطلب:");
            console.log("🔢 رقم الطلب:", result.order.id);
            console.log("👤 العميل:", result.order.customerName);
            console.log("📍 العنوان:", result.order.address);
            console.log("💊 الأدوية:", result.order.items);
            console.log("📅 السجل الزمني:", result.order.timeline.length, "إدخالات");
            console.log(result.order);
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

// ============================================================
// اختبار جلب الإحصائيات
// ============================================================

async function test_stats() {
    console.log("🧪 اختبار: جلب الإحصائيات...");
    try {
        const result = await App.api.getOrdersStats();
        if (result.ok) {
            console.log("✅ إحصائيات الطلبات:");
            console.log(`  📊 الإجمالي: ${result.stats.total}`);
            console.log(`  ⏳ قيد الانتظار: ${result.stats.pending}`);
            console.log(`  ✅ مقبول: ${result.stats.accepted}`);
            console.log(`  ⚡ جزئي: ${result.stats.partial}`);
            console.log(`  ❌ مرفوض: ${result.stats.rejected}`);
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

// ============================================================
// اختبار جلب الصيادلة
// ============================================================

async function test_get_pharmacists() {
    console.log("🧪 اختبار: جلب قائمة الصيادلة...");
    try {
        const result = await App.api.getPharmacists();
        if (result.ok) {
            console.log(`✅ تم جلب ${result.pharmacists.length} صيدلي`);
            result.pharmacists.forEach((ph) => {
                console.log(`  🏪 ${ph.pharmacyName} — ${ph.status}`);
            });
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

// ============================================================
// اختبار إنشاء طلب جديد
// ============================================================

async function test_create_order() {
    console.log("🧪 اختبار: إنشاء طلب جديد...");
    try {
        const orderData = {
            customerName: "أحمد محمد",
            phone: "01000000000",
            address: "القاهرة - مدينة نصر",
            items: ["Panadol", "Augmentin", "Cataflam"],
            prescriptionImage: "", // يمكن إضافة base64 لاحقًا
        };

        const result = await App.api.createOrder(orderData);
        if (result.ok) {
            console.log("✅ تم إنشاء الطلب بنجاح!");
            console.log("🔢 رقم الطلب:", result.order.id);
            console.log("👤 العميل:", result.order.customerName);
            sessionStorage.setItem("test_new_order_id", result.order.id);
            return result.order.id;
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

// ============================================================
// اختبار تحديث الطلب (قبول)
// ============================================================

async function test_accept_order() {
    console.log("🧪 اختبار: قبول طلب...");
    const orderId = sessionStorage.getItem("test_new_order_id") || "10001";
    try {
        const result = await App.api.updateOrder(orderId, {
            status: "accepted",
            pharmacyId: "u-ph1",
            pharmacyName: "صيدلية النور",
            availableItems: ["Panadol", "Augmentin", "Cataflam"],
            price: 150,
            notes: "متوفر الآن",
        });
        if (result.ok) {
            console.log("✅ تم قبول الطلب!");
            console.log("📊 الحالة:", result.order.status);
            console.log("💰 السعر:", result.order.price);
            console.log("🏪 الصيدلية:", result.order.pharmacyName);
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

// ============================================================
// اختبار تحديث الطلب (تنفيذ جزئي)
// ============================================================

async function test_partial_order() {
    console.log("🧪 اختبار: تنفيذ جزئي للطلب...");
    const orderId = sessionStorage.getItem("test_new_order_id") || "10001";
    try {
        const result = await App.api.updateOrder(orderId, {
            status: "partial",
            pharmacyId: "u-ph2",
            pharmacyName: "صيدلية الشفاء",
            availableItems: ["Panadol", "Augmentin"],
            unavailableItems: ["Cataflam"],
            price: 100,
            notes: "غير متوفر Cataflam",
        });
        if (result.ok) {
            console.log("✅ تم تحديث الطلب بـ تنفيذ جزئي!");
            console.log("📦 المتوفر:", result.order.availableItems);
            console.log("🚫 غير متوفر:", result.order.unavailableItems);
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

// ============================================================
// اختبار رفض الطلب
// ============================================================

async function test_reject_order() {
    console.log("🧪 اختبار: رفض الطلب...");
    const orderId = sessionStorage.getItem("test_new_order_id") || "10001";
    try {
        const result = await App.api.rejectOrder(orderId, "u-ph1");
        if (result.ok) {
            console.log("✅ تم رفض الطلب!");
            console.log("🔢 عدد المرفوضين:", result.rejectedCount);
        } else {
            console.error("❌ خطأ:", result.error);
        }
    } catch (err) {
        console.error("❌ خطأ:", err.message);
    }
}

// ============================================================
// اختبار شامل كامل
// ============================================================

async function test_full_flow() {
    console.log("🧪🧪🧪 اختبار شامل كامل 🧪🧪🧪\n");

    // 1. اختبر صحة الخادم
    const isHealthy = await test_server_health();
    if (!isHealthy) {
        console.error("❌ الخادم غير متاح. تأكد من تشغيل: npm start");
        return;
    }

    console.log("\n---\n");

    // 2. اختبر تسجيل الدخول
    const userId = await test_login();
    if (!userId) return;

    console.log("\n---\n");

    // 3. اختبر جلب بيانات المستخدم
    await test_get_user();

    console.log("\n---\n");

    // 4. اختبر جلب الطلبات
    const orders = await test_get_orders();

    console.log("\n---\n");

    // 5. اختبر جلب طلب واحد
    await test_get_order_by_id();

    console.log("\n---\n");

    // 6. اختبر الإحصائيات
    await test_stats();

    console.log("\n---\n");

    // 7. اختبر قائمة الصيادلة
    await test_get_pharmacists();

    console.log("\n---\n");

    // 8. اختبر إنشاء طلب جديد
    const newOrderId = await test_create_order();

    console.log("\n---\n");

    // 9. اختبر قبول الطلب
    await test_accept_order();

    console.log("\n✅✅✅ اختبار شامل اكتمل بنجاح! ✅✅✅");
}

// ============================================================
// دليل الاستخدام
// ============================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         🧪 دليل الاختبار السريع للـ Backend API              ║
╚═══════════════════════════════════════════════════════════════╝

📋 الاختبارات المتاحة:

1️⃣  test_server_health()      → اختبر الاتصال بالخادم
2️⃣  test_login()              → اختبر تسجيل دخول Admin
3️⃣  test_login_pharmacist()   → اختبر تسجيل دخول صيدلي
4️⃣  test_get_user()           → اختبر جلب بيانات المستخدم
5️⃣  test_get_orders()         → اختبر جلب جميع الطلبات
6️⃣  test_get_order_by_id()    → اختبر جلب طلب واحد
7️⃣  test_stats()              → اختبر جلب الإحصائيات
8️⃣  test_get_pharmacists()    → اختبر جلب الصيادلة
9️⃣  test_create_order()       → اختبر إنشاء طلب جديد
🔟 test_accept_order()        → اختبر قبول الطلب
1️⃣1️⃣ test_partial_order()    → اختبر تنفيذ جزئي
1️⃣2️⃣ test_reject_order()     → اختبر رفض الطلب

🚀 اختبار شامل كامل:
   test_full_flow()           → شغّل جميع الاختبارات

📌 الاستخدام:
   انسخ أي اختبار وألصقه في DevTools Console
   أو استخدم test_full_flow() لاختبار شامل
`);
