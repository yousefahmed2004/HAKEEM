/* ============================================================
   database.js — قاعدة بيانات MySQL مُعدلة (مع معالجة JSON)
   ============================================================ */
const mysql = require("mysql2/promise");

let pool = null;

function toDbDateTime(date = new Date()) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

// دالة ذكية لتحويل النصوص المفصولة بفواصل أو المصفوفات إلى JSON سليم
function safeJson(value) {
    if (value === null || value === undefined) return null;
    // إذا كانت مصفوفة، حولها مباشرة
    if (Array.isArray(value)) return JSON.stringify(value);
    // إذا كانت نصاً يحتوي على فواصل، حوله لمصفوفة ثم JSON
    if (typeof value === 'string' && value.includes(',')) {
        return JSON.stringify(value.split(',').map(item => item.trim()));
    }
    // في حالة النصوص العادية (مثل اسم دواء واحد)، نجعله داخل مصفوفة
    if (typeof value === 'string') return JSON.stringify([value]);
    
    return value;
}

async function getPool() {
    if (pool) return pool;

    pool = mysql.createPool({
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "pharmacy_bot",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    });

    return pool;
}

async function testConnection() {
    const conn = await getPool();
    const [rows] = await conn.query("SELECT 1 + 1 AS result");
    console.log("✅ تم الاتصال بقاعدة البيانات MySQL");
    return rows[0];
}

const run = async (sql, params = []) => {
    const conn = await getPool();
    
    // الأعمده التي تتطلب معالجة JSON
    const jsonFields = ['items', 'availableItems', 'unavailableItems', 'rejectedBy'];
    
    // معالجة البارامترات تلقائياً: المصفوفات فقط تحتاج تحويل لـ JSON
    // (النصوص التي هي أصلاً JSON سليم تمر كما هي)
    const processedParams = params.map((p, index) => {
        // فقط المصفوفات الحقيقية تحتاج تحويل لـ JSON
        if (Array.isArray(p)) {
            return JSON.stringify(p);
        }
        return p;
    });

    const [result] = await conn.execute(sql, processedParams);
    return { id: result.insertId, changes: result.affectedRows };
};

const get = async (sql, params = []) => {
    const conn = await getPool();
    const [rows] = await conn.execute(sql, params);
    return rows[0] || null;
};

const all = async (sql, params = []) => {
    const conn = await getPool();
    const [rows] = await conn.execute(sql, params);
    return rows || [];
};

/* ============================================================
   إنشاء الجداول
   ============================================================ */
const initializeDatabase = async () => {
    try {
        await testConnection();

        await run(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(100) PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                title VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(50) DEFAULT NULL,
                pharmacyName VARCHAR(255) DEFAULT NULL,
                status VARCHAR(50) DEFAULT 'active',
                color VARCHAR(50) DEFAULT NULL,
                createdAt DATETIME NOT NULL,
                updatedAt DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(100) PRIMARY KEY,
                customerName VARCHAR(255) NOT NULL,
                phone VARCHAR(50) DEFAULT NULL,
                address VARCHAR(500) DEFAULT NULL,
                items JSON DEFAULT NULL,
                prescriptionImage TEXT DEFAULT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                pharmacyId VARCHAR(100) DEFAULT NULL,
                pharmacyName VARCHAR(255) DEFAULT NULL,
                price INT DEFAULT NULL,
                availableItems JSON DEFAULT NULL,
                unavailableItems JSON DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                rejectedBy JSON DEFAULT NULL,
                workflowStatus VARCHAR(100) DEFAULT NULL,
                executionPending TINYINT DEFAULT 0,
                executionDeadline VARCHAR(100) DEFAULT NULL,
                executionCompleted TINYINT DEFAULT 0,
                executionFailed TINYINT DEFAULT 0,
                executedAt VARCHAR(100) DEFAULT NULL,
                deliveredAt VARCHAR(100) DEFAULT NULL,
                createdAt DATETIME NOT NULL,
                updatedAt DATETIME NOT NULL,
                CONSTRAINT fk_orders_pharmacy FOREIGN KEY (pharmacyId) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS order_timeline (
                id INT AUTO_INCREMENT PRIMARY KEY,
                orderId VARCHAR(100) NOT NULL,
                at DATETIME NOT NULL,
                text TEXT NOT NULL,
                color VARCHAR(50) DEFAULT NULL,
                CONSTRAINT fk_timeline_order FOREIGN KEY (orderId) REFERENCES orders(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await run(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                webhookUrl VARCHAR(500) DEFAULT NULL,
                apiKey VARCHAR(255) DEFAULT NULL,
                notifySound TINYINT DEFAULT 1,
                notifyBrowser TINYINT DEFAULT 0,
                simulate TINYINT DEFAULT 1,
                pharmacyName VARCHAR(255) DEFAULT NULL,
                createdAt DATETIME NOT NULL,
                updatedAt DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        console.log("✅ تم إنشاء/التحقق من جميع الجداول بنجاح");
        await seedDatabase();
    } catch (err) {
        console.error("❌ خطأ في إنشاء الجداول:", err.message);
    }
};

const seedDatabase = async () => {
    try {
        const existingUsers = await all("SELECT COUNT(*) as count FROM users");
        if (existingUsers[0].count > 0) {
            console.log("📊 قاعدة البيانات تحتوي بالفعل على بيانات");
            return;
        }

        console.log("🌱 جاري إضافة البيانات الابتدائية...");

        const users = [
            { id: "u-admin", username: "admin", password: "123456", role: "admin", name: "أحمد سامي", title: "مالك المشروع", phone: "01012345678", status: "active", color: "#2563eb" },
            { id: "u-ph1", username: "noor", password: "123456", role: "pharmacist", name: "د. محمد النور", pharmacyName: "صيدلية النور", phone: "01055512301", status: "active", color: "#0ea5e9" },
            { id: "u-ph2", username: "shefaa", password: "123456", role: "pharmacist", name: "د. سارة الشافعي", pharmacyName: "صيدلية الشفاء", phone: "01155512302", status: "active", color: "#10b981" },
            { id: "u-ph3", username: "seif", password: "123456", role: "pharmacist", name: "د. خالد سيف", pharmacyName: "صيدلية سيف", phone: "01255512303", status: "active", color: "#8b5cf6" },
            { id: "u-ph4", username: "elzohry", password: "123456", role: "pharmacist", name: "د. منى الزهري", pharmacyName: "صيدلية الزهري", phone: "01555512304", status: "active", color: "#f59e0b" },
        ];

        for (const user of users) {
            await run(
                `INSERT IGNORE INTO users (id, username, password, role, name, title, phone, pharmacyName, status, color, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [user.id, user.username, user.password, user.role, user.name, user.title || null, user.phone, user.pharmacyName || null, user.status, user.color, toDbDateTime(), toDbDateTime()]
            );
        }

        await run(
            `INSERT IGNORE INTO settings (id, webhookUrl, apiKey, notifySound, notifyBrowser, simulate, pharmacyName, createdAt, updatedAt)
             VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ["https://YOUR-N8N-WEBHOOK", "", 1, 0, 1, "Pharmacy Bot", toDbDateTime(), toDbDateTime()]
        );

        console.log("✅ تم إضافة البيانات الابتدائية بنجاح");
    } catch (err) {
        console.error("❌ خطأ في البذر:", err.message);
    }
};

module.exports = {
    pool: getPool,
    run,
    get,
    all,
    initializeDatabase,
    testConnection,
    toDbDateTime,
    safeJson
};