/* ============================================================
   auth.js — المسارات الخاصة بالمصادقة والمستخدمين (PostgreSQL)
   ============================================================ */
const express = require("express");
const router = express.Router();
const { run, get, all, toDbDateTime } = require("../db/database");

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
            return res.status(403).json({ ok: false, error: "هذا الحساب موقوف" });
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
        const { username, password, name, pharmacyName, phone, role } = req.body;

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
            `INSERT INTO users (id, username, password, role, name, "pharmacyName", phone, status, color, "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [id, username, password, userRole, name || null, pharmacyName || null, phone || null, "active", color, toDbDateTime(), toDbDateTime()]
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
   الحصول على قائمة الصيادلة (Admin فقط)
   ============================================================ */
router.get("/pharmacists", async (req, res) => {
    try {
        const pharmacists = await all("SELECT * FROM users WHERE role = 'pharmacist'");

        pharmacists.forEach((p) => delete p.password);

        res.json({ ok: true, pharmacists });
    } catch (err) {
        console.error("❌ خطأ في جلب قائمة الصيادلة:", err.message);
        res.status(500).json({ ok: false, error: "خطأ في الخادم" });
    }
});

/* ============================================================
   تحديث حالة المستخدم (Admin فقط)
   ============================================================ */
router.patch("/user/:userId/status", async (req, res) => {
    try {
        const { status } = req.body;

        if (!["active", "suspended"].includes(status)) {
            return res.status(400).json({ ok: false, error: "حالة غير صحيحة" });
        }

        await run("UPDATE users SET status = $1, \"updatedAt\" = $2 WHERE id = $3", [
            status,
            toDbDateTime(),
            req.params.userId,
        ]);

        const user = await get("SELECT * FROM users WHERE id = $1", [req.params.userId]);
        delete user.password;

        res.json({ ok: true, user });
    } catch (err) {
        console.error("❌ خطأ في تحديث الحالة:", err.message);
        res.status(500).json({ ok: false, error: "خطأ في الخادم" });
    }
});

module.exports = router;
