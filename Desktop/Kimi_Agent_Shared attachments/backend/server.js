/* ============================================================
   server.js — الخادم الرئيسي
   ============================================================ */

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

const { initializeDatabase } = require("./db/database");
const authRoutes = require("./routes/auth");
const ordersRoutes = require("./routes/orders");

const app = express();
const PORT = process.env.PORT || 5000;

/* ============================================================
   Middleware
   ============================================================ */

app.use(cors());

app.use(bodyParser.json({
    limit: "10mb"
}));

app.use(bodyParser.urlencoded({
    extended: true,
    limit: "10mb"
}));

/* ============================================================
   الملفات الثابتة (Frontend)
   ============================================================ */

app.use(express.static(path.join(__dirname, "..", "app")));

/* ============================================================
   تهيئة قاعدة البيانات
   ============================================================ */

(async () => {
    try {
        await initializeDatabase();
    } catch (err) {
        console.error("❌ خطأ في تهيئة قاعدة البيانات:", err);
    }
})();

/* ============================================================
   Health Check
   ============================================================ */

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "HAKEEM Backend",
        uptime: process.uptime()
    });
});

/* ============================================================
   Routes
   ============================================================ */

app.use("/api/auth", authRoutes);
app.use("/api", ordersRoutes);

/* ============================================================
   الصفحة الرئيسية (عرض الواجهة الأمامية)
   ============================================================ */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "app", "index.html"));
});

/* ============================================================
   مسار معلومات الـ API
   ============================================================ */

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "مرحبًا بك في HAKEEM Backend 🏥",
        version: "1.0.0",
        endpoints: {
            health: "/health",
            auth: "/api/auth",
            orders: "/api/orders",
            pharmacists: "/api/pharmacists"
        }
    });
});

/* ============================================================
   Error Handler
   ============================================================ */

app.use((err, req, res, next) => {
    console.error("❌ خطأ غير متوقع:", err);
    res.status(500).json({
        success: false,
        error: "حدث خطأ في الخادم"
    });
});

/* ============================================================
   تشغيل الخادم
   ============================================================ */

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("\n============================================================");
    console.log(`✅ HAKEEM Backend يعمل على: http://0.0.0.0:${PORT}`);
    console.log("============================================================\n");
    console.log("📊 قاعدة البيانات: PostgreSQL");
    console.log("🗄️ الاتصال: backend/db/database.js");
});

/* ============================================================
   Graceful Shutdown
   ============================================================ */

process.on("SIGTERM", () => {
    console.log("📴 Received SIGTERM. Closing server...");
    server.close(() => {
        console.log("✅ Server stopped successfully.");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    console.log("📴 Received SIGINT. Closing server...");
    server.close(() => {
        console.log("✅ Server stopped successfully.");
        process.exit(0);
    });
});
