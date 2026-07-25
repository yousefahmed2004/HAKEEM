/* ============================================================
   database.js — PostgreSQL connection and query helpers
   Uses DATABASE_URL seamlessly with fallback to individual params
   ============================================================ */
const { Pool } = require("pg");

let pool = null;

function toDbDateTime(date = new Date()) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

// Smart helper to convert comma-separated strings or arrays to valid JSON
function safeJson(value) {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'string' && value.includes(',')) {
        return JSON.stringify(value.split(',').map(item => item.trim()));
    }
    if (typeof value === 'string') return JSON.stringify([value]);
    return value;
}

async function getPool() {
    if (pool) return pool;

    if (process.env.DATABASE_URL) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
        });
    } else {
        pool = new Pool({
            host: process.env.DB_HOST || "localhost",
            port: Number(process.env.DB_PORT || 5432),
            user: process.env.DB_USER || "postgres",
            password: process.env.DB_PASSWORD || "",
            database: process.env.DB_NAME || "pharmacy_bot",
            ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
        });
    }

    return pool;
}

async function testConnection() {
    const conn = await getPool();
    const result = await conn.query("SELECT 1 AS result");
    console.log("✅ تم الاتصال بقاعدة البيانات PostgreSQL");
    return result.rows[0];
}

const run = async (sql, params = []) => {
    const conn = await getPool();

    // Auto-convert arrays to JSON strings for JSONB columns
    const processedParams = params.map((p) => {
        if (Array.isArray(p)) {
            return JSON.stringify(p);
        }
        return p;
    });

    const result = await conn.query(sql, processedParams);
    return { id: result.rows[0]?.id || null, changes: result.rowCount };
};

const get = async (sql, params = []) => {
    const conn = await getPool();
    const result = await conn.query(sql, params);
    return result.rows[0] || null;
};

const all = async (sql, params = []) => {
    const conn = await getPool();
    const result = await conn.query(sql, params);
    return result.rows || [];
};

/* ============================================================
   Create tables (PostgreSQL syntax)
   ============================================================ */
const initializeDatabase = async () => {
    try {
        await testConnection();

        // --- users table (existing schema) ---
        await run(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(100) PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                title VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(50) DEFAULT NULL,
                "pharmacyName" VARCHAR(255) DEFAULT NULL,
                status VARCHAR(50) DEFAULT 'active',
                color VARCHAR(50) DEFAULT NULL,
                "createdAt" TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL
            )
        `);

        // --- orders table (existing schema) ---
        await run(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(100) PRIMARY KEY,
                "customerName" VARCHAR(255) NOT NULL,
                phone VARCHAR(50) DEFAULT NULL,
                address VARCHAR(500) DEFAULT NULL,
                items JSONB DEFAULT NULL,
                "prescriptionImage" TEXT DEFAULT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                "pharmacyId" VARCHAR(100) DEFAULT NULL,
                "pharmacyName" VARCHAR(255) DEFAULT NULL,
                price INT DEFAULT NULL,
                "availableItems" JSONB DEFAULT NULL,
                "unavailableItems" JSONB DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                "rejectedBy" JSONB DEFAULT NULL,
                "workflowStatus" VARCHAR(100) DEFAULT NULL,
                "executionPending" SMALLINT DEFAULT 0,
                "executionDeadline" VARCHAR(100) DEFAULT NULL,
                "executionCompleted" SMALLINT DEFAULT 0,
                "executionFailed" SMALLINT DEFAULT 0,
                "executedAt" VARCHAR(100) DEFAULT NULL,
                "deliveredAt" VARCHAR(100) DEFAULT NULL,
                "createdAt" TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL,
                CONSTRAINT fk_orders_pharmacy FOREIGN KEY ("pharmacyId") REFERENCES users(id)
            )
        `);

        // --- order_timeline table (existing schema) ---
        await run(`
            CREATE TABLE IF NOT EXISTS order_timeline (
                id SERIAL PRIMARY KEY,
                "orderId" VARCHAR(100) NOT NULL,
                at TIMESTAMP NOT NULL,
                text TEXT NOT NULL,
                color VARCHAR(50) DEFAULT NULL,
                CONSTRAINT fk_timeline_order FOREIGN KEY ("orderId") REFERENCES orders(id)
            )
        `);

        // --- settings table (existing schema) ---
        await run(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                "webhookUrl" VARCHAR(500) DEFAULT NULL,
                "apiKey" VARCHAR(255) DEFAULT NULL,
                "notifySound" SMALLINT DEFAULT 1,
                "notifyBrowser" SMALLINT DEFAULT 0,
                simulate SMALLINT DEFAULT 1,
                "pharmacyName" VARCHAR(255) DEFAULT NULL,
                "createdAt" TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL
            )
        `);

        // --- customers table (new schema from server) ---
        await run(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(50),
                name VARCHAR(150),
                address TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                session_status VARCHAR(50),
                custom_phone TEXT,
                remote_jid TEXT
            )
        `);

        // --- n8n_chat_histories table (new schema from server) ---
        await run(`
            CREATE TABLE IF NOT EXISTS n8n_chat_histories (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255),
                message JSONB
            )
        `);

        // --- pharmacies table (new schema from server) ---
        await run(`
            CREATE TABLE IF NOT EXISTS pharmacies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150),
                location TEXT,
                phone VARCHAR(50),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log("✅ تم إنشاء/التحقق من جميع الجداول بنجاح");
        await seedDatabase();
    } catch (err) {
        console.error("❌ خطأ في إنشاء الجداول:", err.message);
    }
};

const seedDatabase = async () => {
    try {
        const existingUsers = await all("SELECT COUNT(*)::int as count FROM users");
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
                `INSERT INTO users (id, username, password, role, name, title, phone, "pharmacyName", status, color, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (id) DO NOTHING`,
                [user.id, user.username, user.password, user.role, user.name, user.title || null, user.phone, user.pharmacyName || null, user.status, user.color, toDbDateTime(), toDbDateTime()]
            );
        }

        await run(
            `INSERT INTO settings (id, "webhookUrl", "apiKey", "notifySound", "notifyBrowser", simulate, "pharmacyName", "createdAt", "updatedAt")
             VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
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
