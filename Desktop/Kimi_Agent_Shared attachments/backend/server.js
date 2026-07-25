/* ============================================================
   server.js — الخادم الرئيسي
   ============================================================ */
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const { initializeDatabase } = require("./db/database");
const authRoutes = require("./routes/auth");
const ordersRoutes = require("./routes/orders");

const app = express();
const PORT = process.env.PORT || 5000;
const path = require("path");

/* ============================================================
   Middleware
   ============================================================ */
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

/* ============================================================
   خدمة الملفات الثابتة (Frontend)
   ============================================================ */
app.use(express.static(path.join(__dirname, "..", "app")));

/* ============================================================
   تهيئة قاعدة البيانات
   ============================================================ */
(async () => {
    try {
        await initializeDatabase();
    } catch (err) {
        console.error("❌ خطأ في تهيئة قاعدة البيانات:", err.message);
    }
})();

/* ============================================================
   المسارات
   ============================================================ */
app.use("/api/auth", authRoutes);
app.use("/api", ordersRoutes);

/* ============================================================
   مسار الاختبار
   ============================================================ */
app.get("/", (req, res) => {
    res.json({
        message: "مرحبًا بك في HAKEEM Backend 🏥",
        version: "1.0.0",
        endpoints: {
            auth: "/api/auth",
            orders: "/api/orders",
            pharmacists: "/api/pharmacists",
        },
    });
});

/* ============================================================
   معالجة الأخطاء
   ============================================================ */
app.use((err, req, res, next) => {
    console.error("❌ خطأ غير متوقع:", err.message);
    res.status(500).json({ ok: false, error: "خطأ في الخادم" });
});

/* ============================================================
   تشغيل الخادم
   ============================================================ */
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ HAKEEM Backend يعمل على: http://localhost:${PORT}`);
    console.log(`${'='.repeat(60)}\n`);
    console.log("📊 قاعدة البيانات: PostgreSQL");
    console.log("🗄️ الاتصال: backend/db/database.js\n");
});
