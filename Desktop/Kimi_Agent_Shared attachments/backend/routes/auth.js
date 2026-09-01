/* ============================================================
   auth.js — المسارات الخاصة بالمصادقة والمستخدمين (PostgreSQL)
   ============================================================ */
const express = require("express");
const router = express.Router();
const { run, get, all, toDbDateTime, withTransaction } = require("../db/database");

/* ============================================================
   تسجيل الدخول
   ============================================================ */
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ ok: false, error: "اسم المستخدم وكلمة المرور مطلوبان" });
        }

        const user = await get("SELECT * FROM users WHERE LOWER(username) = LOWER($1)", [username.trim()]);

        if (!user || user.password !== password) {
            return res.status(401).json({ ok: false, error: "بيانات الدخول غير صحيحة" });
        }

        if (user.status === "suspended") {
            return res.status(403).json({ ok: false, error: "🚫 تم إيقاف حسابك مؤقتًا عن العمل مع مجموعة حكيم — برجاء التواصل مع الإدارة لمزيد من التفاصيل", suspended: true });
        }

        delete user.password;
        res.json({ ok: true, user });
    } catch (err) {
        console.error("❌ خطأ في تسجيل الدخول:", err.message);
        res.status(500).json({ ok: false, error: "خطأ في الخادم" });
    }
});

/* ============================================================
   دالة موحدة لتسجيل مستخدم جديد (تغطي كافة المسارات المحتملة)
   ============================================================ */
async function handleUserRegistration(req, res) {
    try {
        const { username, password, name, pharmacyName, phone, address, role, maxActiveOrders } = req.body;

        if (!username || !password) {
            return res.status(400).json({ ok: false, error: "اسم المستخدم وكلمة المرور مطلوبان" });
        }

        const existingUser = await get("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]);
        if (existingUser) {
            return res.status(409).json({ ok: false, error: "اسم المستخدم موجود بالفعل" });
        }

        const userRole = role || "pharmacist";
        const id = `u-${userRole === "admin" ? "admin" : "ph"}-${Date.now()}`;
        const colors = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4"];
        const color = colors[Math.floor(Math.random() * colors.length)];

        await run(
            `INSERT INTO users (id, username, password, role, name, "pharmacyName", phone, address, status, color, "maxActiveOrders", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [id, username, password, userRole, name || null, pharmacyName || null, phone || null, address || null, "active", color, Number(maxActiveOrders) || 3, toDbDateTime(), toDbDateTime()]
        );

        const newUser = await get("SELECT * FROM users WHERE id = $1", [id]);
        delete newUser.password;

        res.status(201).json({ ok: true, user: newUser });
    } catch (err) {
        console.error("❌ خطأ في التسجيل:", err.message);
        res.status(500).json({ ok: false, error: "خطأ في الخادم" });
    }
}

// تغطية كل مسارات التسجيل المحتملة من الـ Frontend
router.post("/register", handleUserRegistration);
router.post("/signup", handleUserRegistration);
router.post("/pharmacist", handleUserRegistration);

/* ============================================================
   🆕 جلب كل الصيادلة (Admin)
   ------------------------------------------------------------
   كان هذا المسار ناقصًا بالكامل، رغم أن الفرونت إند (api.js →
   App.api.getPharmacists) بينادي GET /api/auth/pharmacists عند فتح
   صفحات "الصيادلة"/"الصيدليات"/لوحة التحكم (hydratePharmacistsFromServer
   في store.js). غيابه كان بيسبب رجوع صفحة 404 (HTML) بدل JSON، وده
   سبب خطأ "Unexpected token '<'" في الكونسول.

   ⚠️ ملحوظة ترتيب: لازم يتحط هذا المسار (ثابت النص "/pharmacists")
   قبل أو بعد "/user/:userId" مفيش فرق هنا لأن الاسمين مختلفين تمامًا
   ومفيش تعارض بينهم في Express — لكن للسلامة تم وضعه في مكان منطقي
   قبل مسارات "/user/:userId" المعتمدة على باراميتر ديناميكي.
   ============================================================ */
router.get("/pharmacists", async (req, res) => {
    try {
        const pharmacists = await all(
            `SELECT * FROM users WHERE role = 'pharmacist' ORDER BY "createdAt" DESC`
        );
        pharmacists.forEach((p) => delete p.password);
        res.json({ ok: true, pharmacists });
    } catch (err) {
        console.error("❌ خطأ في جلب الصيادلة:", err.message);
        res.status(500).json({ ok: false, error: "خطأ في الخادم" });
    }
});

/* ============================================================
   الحصول على بيانات المستخدم الحالي
   ============================================================ */
router.get("/user/:userId", async (req, res) => {
    try {
        const user = await get("SELECT * FROM users WHERE id = $1", [req.params.userId]);

        if (!user) {
            return res.status(404).json({ ok: false, error: "المستخدم غير موجود" });
        }

        delete user.password;
        res.json({ ok: true, user });
    } catch (err) {
        console.error("❌ خطأ في جلب بيانات المستخدم:", err.message);
        res.status(500).json({ ok: false, error: "خطأ في الخادم" });
    }
});

/* ============================================================
   تحديث الملف الشخصي
   ============================================================ */
router.put("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        delete updates.id;
        delete updates.role;

        const keys = Object.keys(updates);
        if (keys.length === 0) {
            return res.status(400).json({ ok: false, error: "لا توجد بيانات للتحديث" });
        }

        const setClause = keys
            .map((key, i) => `"${key}" = $${i + 1}`)
            .join(", ");

        const values = Object.values(updates);
        values.push(toDbDateTime());
        values.push(userId);

        await run(`UPDATE users SET ${setClause}, "updatedAt" = $${keys.length + 1} WHERE id = $${keys.length + 2}`, values);

        const updatedUser = await get("SELECT * FROM users WHERE id = $1", [userId]);
        delete updatedUser.password;

        res.json({ ok: true, user: updatedUser });
    } catch (err) {
        console.error("❌ خطأ في تحديث الملف الشخصي:", err.message);
        res.status(500).json({ ok: false, error: "خطأ في الخادم" });
    }
});

/* ============================================================
   🆕 تفعيل/إيقاف حساب مستخدم (Admin)
   ------------------------------------------------------------
   كان هذا المسار ناقصًا بالكامل، رغم أن الفرونت إند (api.js →
   App.api.updateUserStatus) بينادي PATCH /api/auth/user/:userId/status
   عند الضغط على زر "إيقاف/إعادة تفعيل" في صفحة الصيادلة (pages2.js).
   غيابه كان بيسبب نفس مشكلة الـ 404/HTML بدل JSON.
   ============================================================ */
router.patch("/user/:userId/status", async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        if (!["active", "suspended"].includes(status)) {
            return res.status(400).json({ ok: false, error: "قيمة الحالة غير صحيحة" });
        }

        const user = await get("SELECT id FROM users WHERE id = $1", [userId]);
        if (!user) {
            return res.status(404).json({ ok: false, error: "المستخدم غير موجود" });
        }

        await run(
            `UPDATE users SET status = $1, "updatedAt" = $2 WHERE id = $3`,
            [status, toDbDateTime(), userId]
        );

        const updatedUser = await get("SELECT * FROM users WHERE id = $1", [userId]);
        delete updatedUser.password;

        res.json({ ok: true, user: updatedUser });
    } catch (err) {
        console.error("❌ خطأ في تحديث حالة المستخدم:", err.message);
        res.status(500).json({ ok: false, error: "خطأ في الخادم" });
    }
});

/* ============================================================
   🆕 حذف مستخدم نهائيًا (Admin فقط) — كانت الميزة دي ناقصة بالكامل
   ------------------------------------------------------------
   المشكلة القديمة: مكانش فيه أي route هنا لحذف مستخدم، فزر "حذف"
   في الواجهة (pages2.js) كان بينادي App.store.deletePharmacist()
   اللي بتمسح الصيدلي من localStorage بس، من غير ما تكلم السيرفر
   خالص. النتيجة: الصيدلي فضل موجود في قاعدة البيانات، وأول ما
   تعمل logout/login (أو حتى refresh)، hydratePharmacistsFromServer()
   في store.js كانت بتجيبه تاني من السيرفر وكأنه ما اتمسحش.

   الحل: أضفنا الـ route ده اللي فعليًا بيحذف الصف من جدول users.

   ⚠️ ملحوظة مهمة: عمود orders."pharmacyId" مربوط بـ Foreign Key على
   users(id) من غير ON DELETE، فلو الصيدلي ده سبق ونفّذ أي طلبات،
   حذفه مباشرة كان هيفشل بخطأ قيد مرجعي (foreign key violation).
   عشان كده قبل الحذف بنعمل UPDATE على الطلبات القديمة بتاعته ونصفّر
   "pharmacyId" بس (مع الإبقاء على "pharmacyName" اللي مخزّن في الطلب
   نفسه كنص مستقل) — كده الطلبات القديمة بتفضل في السجلات بالظبط زي
   ما كانت الرسالة الأصلية في الواجهة بتوعد المستخدم، وفي نفس الوقت
   الحذف بينجح من غير ما يكسر قيد الـ FK. الخطوتين بيحصلوا جوه
   transaction واحدة (withTransaction) عشان لو أي واحدة فشلت، التانية
   ترجع زي ما كانت (rollback) بدل ما يحصل تحديث جزئي.
   ============================================================ */
router.delete("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await get("SELECT id, role FROM users WHERE id = $1", [userId]);
        if (!user) {
            return res.status(404).json({ ok: false, error: "المستخدم غير موجود" });
        }

        await withTransaction(async (tx) => {
            // فصل الطلبات القديمة عن الصيدلي (تفضل في السجلات باسم الصيدلية المخزّن في pharmacyName)
            await tx.run(`UPDATE orders SET "pharmacyId" = NULL WHERE "pharmacyId" = $1`, [userId]);
            await tx.run(`DELETE FROM users WHERE id = $1`, [userId]);
        });

        res.json({ ok: true, id: userId });
    } catch (err) {
        console.error("❌ خطأ في حذف المستخدم:", err.message);
        res.status(500).json({ ok: false, error: "تعذر حذف المستخدم من الخادم" });
    }
});

module.exports = router;
