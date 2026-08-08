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
   🆕 withTransaction — بتشغّل مجموعة كويريز مرتبطة ببعض داخل
   BEGIN/COMMIT/ROLLBACK واحدة على نفس الاتصال (client)، عشان لو
   أي خطوة فشلت في النص، كل التعديلات السابقة ترجع زي ما كانت
   (rollback) بدل ما تفضل عالقة بشكل جزئي.
   ============================================================ */
async function withTransaction(work) {
    const conn = await getPool();
    const client = await conn.connect();
    try {
        await client.query("BEGIN");

        const tx = {
            run: async (sql, params = []) => {
                const processedParams = (params || []).map((p) => (Array.isArray(p) ? JSON.stringify(p) : p));
                const result = await client.query(sql, processedParams);
                return { id: result.rows[0]?.id || null, changes: result.rowCount };
            },
            get: async (sql, params = []) => {
                const result = await client.query(sql, params);
                return result.rows[0] || null;
            },
            all: async (sql, params = []) => {
                const result = await client.query(sql, params);
                return result.rows || [];
            },
        };

        const result = await work(tx);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackErr) {
            console.error("❌ فشل الـ ROLLBACK:", rollbackErr.message);
        }
        throw err;
    } finally {
        client.release();
    }
}

/* ============================================================
   🆕 fixActiveOrderPhoneIndex — إصلاح تلقائي لأي unique index/
   constraint اسمه "one_active_order_per_phone" لو موجود على
   عمود orders.phone من غير ما يستثني الطلبات "الأبناء" الناتجة
   عن التنفيذ الجزئي (الطلبات اللي ليها parentOrderId).
   ============================================================ */
async function fixActiveOrderPhoneIndex() {
    try {
        const constraintRow = await get(
            `SELECT pg_get_constraintdef(oid) AS def
             FROM pg_constraint
             WHERE conname = 'one_active_order_per_phone'`
        );

        const indexRow = await get(
            `SELECT indexdef FROM pg_indexes WHERE indexname = 'one_active_order_per_phone'`
        );

        if (!constraintRow && !indexRow) {
            return;
        }

        const currentDef = (constraintRow?.def || indexRow?.indexdef || "");
        const alreadyExcludesChildren = currentDef.includes('"parentOrderId"');

        if (alreadyExcludesChildren) {
            return;
        }

        console.log('🔧 إصلاح "one_active_order_per_phone" ليستثني الطلبات المتفرعة من التنفيذ الجزئي...');

        if (constraintRow) {
            await run(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS one_active_order_per_phone`);
        }
        await run(`DROP INDEX IF EXISTS one_active_order_per_phone`);

        await run(`
            CREATE UNIQUE INDEX one_active_order_per_phone
            ON orders (phone)
            WHERE status NOT IN ('delivered', 'closed', 'rejected')
              AND "parentOrderId" IS NULL
        `);

        console.log('✅ تم إصلاح "one_active_order_per_phone" بنجاح');
    } catch (err) {
        console.error('❌ خطأ في إصلاح "one_active_order_per_phone":', err.message);
    }
}

/* ============================================================
   Create tables (PostgreSQL syntax) - Ordered correctly
   ============================================================ */
const initializeDatabase = async () => {
    try {
        await testConnection();

        // 1. --- users table (Must be created first for Foreign Keys) ---
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
                address VARCHAR(500) DEFAULT NULL,
                status VARCHAR(50) DEFAULT 'active',
                color VARCHAR(50) DEFAULT NULL,
                "maxActiveOrders" INT DEFAULT 3,
                "createdAt" TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL
            )
        `);

        await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "maxActiveOrders" INT DEFAULT 3`);
        await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500) DEFAULT NULL`);

        // 2. --- orders table ---
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

        // 2.5. --- order_items table ---
        await run(`
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(100) NOT NULL,
                medicine_name VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
            )
        `);

        await run(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT NULL`);

        await run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS "rootOrderId" VARCHAR(100) DEFAULT NULL`);
        await run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS "parentOrderId" VARCHAR(100) DEFAULT NULL`);

        // 2.8. --- جدول تسجيل اعتذار كل صيدلية عن كل صنف ناقص ---
        await run(`
            CREATE TABLE IF NOT EXISTS medicine_shortage_reports (
                id SERIAL PRIMARY KEY,
                "rootOrderId" VARCHAR(100) NOT NULL,
                medicine_name VARCHAR(255) NOT NULL,
                "pharmacyId" VARCHAR(100) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_shortage_report UNIQUE ("rootOrderId", medicine_name, "pharmacyId")
            )
        `);

        // 2.9. --- جدول تسجيل إرسال تنبيه "نفاد من السوق" للعميل ---
        await run(`
            CREATE TABLE IF NOT EXISTS medicine_shortage_alerts (
                id SERIAL PRIMARY KEY,
                "rootOrderId" VARCHAR(100) NOT NULL,
                medicine_name VARCHAR(255) NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_shortage_alert UNIQUE ("rootOrderId", medicine_name)
            )
        `);

        /* ============================================================
           🆕 2.10 — جدول shipping_notifications
           ------------------------------------------------------------
           بيضمن إن "رسالة الشحن الموحّدة" (اللي بتجمع كل الصيدليات
           المشتركة في نفس سلسلة الطلب rootOrderId) تتبعت *مرة واحدة
           بس* لشركة الشحن، حتى لو صيدليتين ضغطوا "خرج للتوصيل" في
           نفس اللحظة بالضبط (race condition). الـ UNIQUE constraint
           على "rootOrderId" هو اللي بيضمن كده على مستوى قاعدة
           البيانات نفسها — أول INSERT ينجح، والتاني (لو حصل بالتوازي)
           بيترفض تلقائيًا بـ ON CONFLICT DO NOTHING.
           ============================================================ */
        await run(`
            CREATE TABLE IF NOT EXISTS shipping_notifications (
                id SERIAL PRIMARY KEY,
                "rootOrderId" VARCHAR(100) UNIQUE NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        // 8. --- إصلاح تلقائي لـ unique index "one_active_order_per_phone" ---
        await fixActiveOrderPhoneIndex();

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
                `INSERT INTO users (id, username, password, role, name, title, phone, "pharmacyName", address, status, color, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (id) DO NOTHING`,
                [user.id, user.username, user.password, user.role, user.name, user.title || null, user.phone, user.pharmacyName || null, user.address || null, user.status, user.color, toDbDateTime(), toDbDateTime()]
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
    withTransaction,
    initializeDatabase,
    testConnection,
    toDbDateTime,
    safeJson
};
