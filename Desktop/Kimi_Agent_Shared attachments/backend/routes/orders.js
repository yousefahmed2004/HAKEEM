/* ============================================================
   orders.js — مسارات الطلبات
   ============================================================ */
const express = require("express");
const router = express.Router();
const db = require("../db/database");
const https = require("https");
require("dotenv").config();

/* ============================================================
   جلب جميع الطلبات
   ============================================================ */
router.get("/orders", async (req, res) => {
    try {
        const { status } = req.query;
        let query = `
            SELECT 
                o.*,
                GROUP_CONCAT(DISTINCT oi.medicine_name) as items,
                GROUP_CONCAT(DISTINCT oi.status) as item_statuses
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
        `;

        if (status) {
            query += ` WHERE o.status = '${status}'`;
        }

        query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

        const [orders] = await db.execute(query);

        // تحويل البيانات إلى الشكل المطلوب
        const formattedOrders = orders.map((order) => ({
            id: String(order.id),
            customerName: order.customer_name,
            phone: order.phone || "",
            address: order.address || "",
            items: order.items ? order.items.split(",") : [],
            prescriptionImage: order.prescription_image || "",
            status: order.status || "pending",
            createdAt: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString(),
            pharmacyId: order.pharmacy_id || null,
            pharmacyName: order.pharmacy_name || null,
            price: order.price || null,
            availableItems: order.available_items ? JSON.parse(order.available_items || "[]") : [],
            unavailableItems: order.unavailable_items ? JSON.parse(order.unavailable_items || "[]") : [],
            notes: order.notes || "",
            rejectedBy: order.rejected_by ? JSON.parse(order.rejected_by || "[]") : [],
        }));

        res.json({ ok: true, orders: formattedOrders });
    } catch (err) {
        console.error("❌ خطأ في جلب الطلبات:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب الطلبات" });
    }
});

/* ============================================================
   جلب طلب واحد
   ============================================================ */
router.get("/orders/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                o.*,
                GROUP_CONCAT(DISTINCT oi.medicine_name ORDER BY oi.id) as items,
                GROUP_CONCAT(DISTINCT oi.status ORDER BY oi.id) as item_statuses
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = ?
            GROUP BY o.id
        `;
        const [orders] = await db.execute(query, [id]);

        if (orders.length === 0) {
            return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
        }

        const order = orders[0];
        const formattedOrder = {
            id: String(order.id),
            customerName: order.customer_name,
            phone: order.phone || "",
            address: order.address || "",
            items: order.items ? order.items.split(",") : [],
            prescriptionImage: order.prescription_image || "",
            status: order.status || "pending",
            createdAt: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString(),
            pharmacyId: order.pharmacy_id || null,
            pharmacyName: order.pharmacy_name || null,
            price: order.price || null,
            availableItems: order.available_items ? JSON.parse(order.available_items || "[]") : [],
            unavailableItems: order.unavailable_items ? JSON.parse(order.unavailable_items || "[]") : [],
            notes: order.notes || "",
            rejectedBy: order.rejected_by ? JSON.parse(order.rejected_by || "[]") : [],
            timeline: order.timeline ? JSON.parse(order.timeline || "[]") : [
                { at: order.created_at || new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }
            ],
        };

        res.json({ ok: true, order: formattedOrder });
    } catch (err) {
        console.error("❌ خطأ في جلب الطلب:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب الطلب" });
    }
});

/* ============================================================
   إنشاء طلب جديد
   ============================================================ */
router.post("/orders", async (req, res) => {
    try {
        const { customerName, phone, address, items, prescriptionImage, status } = req.body;

        const query = `
            INSERT INTO orders (customer_name, phone, address, prescription_image, status, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await db.execute(query, [
            customerName,
            phone,
            address,
            prescriptionImage || "",
            status || "pending",
        ]);

        const orderId = result.insertId;

        // إضافة الأدوية
        if (items && Array.isArray(items)) {
            const itemQuery = `INSERT INTO order_items (order_id, medicine_name, status) VALUES (?, ?, 'pending')`;
            for (const item of items) {
                await db.execute(itemQuery, [orderId, item]);
            }
        }

        res.json({ ok: true, order: { id: String(orderId), ...req.body } });
    } catch (err) {
        console.error("❌ خطأ في إنشاء الطلب:", err.message);
        res.status(500).json({ ok: false, error: "فشل في إنشاء الطلب" });
    }
});

/* ============================================================
   تحديث الطلب
   ============================================================ */
router.put("/orders/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, pharmacyId, pharmacyName, availableItems, unavailableItems, price, notes, workflowStatus } = req.body;

        const query = `
            UPDATE orders 
            SET status = ?, pharmacy_id = ?, pharmacy_name = ?, 
                available_items = ?, unavailable_items = ?, 
                price = ?, notes = ?, workflow_status = ?
            WHERE id = ?
        `;
        await db.execute(query, [
            status || null,
            pharmacyId || null,
            pharmacyName || null,
            availableItems ? JSON.stringify(availableItems) : null,
            unavailableItems ? JSON.stringify(unavailableItems) : null,
            price || null,
            notes || null,
            workflowStatus || null,
            id,
        ]);

        res.json({ ok: true, message: "تم تحديث الطلب بنجاح" });
    } catch (err) {
        console.error("❌ خطأ في تحديث الطلب:", err.message);
        res.status(500).json({ ok: false, error: "فشل في تحديث الطلب" });
    }
});

/* ============================================================
   رفض الطلب (صيدلي)
   ============================================================ */
router.patch("/orders/:id/reject/:pharmacyId", async (req, res) => {
    try {
        const { id, pharmacyId } = req.params;

        // جلب الطلب الحالي
        const [orders] = await db.execute("SELECT * FROM orders WHERE id = ?", [id]);
        if (orders.length === 0) {
            return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
        }

        const order = orders[0];
        let rejectedBy = order.rejected_by ? JSON.parse(order.rejected_by) : [];

        if (!rejectedBy.includes(pharmacyId)) {
            rejectedBy.push(pharmacyId);
        }

        // التحقق مما إذا كان جميع الصيادلة النشطين قد رفضوا
        const [activePharmacists] = await db.execute(
            "SELECT id FROM users WHERE role = 'pharmacist' AND status = 'active'"
        );
        const activeIds = activePharmacists.map((p) => p.id);
        const allRejected = activeIds.every((pid) => rejectedBy.includes(pid));

        const newStatus = allRejected ? "rejected" : order.status;

        await db.execute(
            "UPDATE orders SET rejected_by = ?, status = ? WHERE id = ?",
            [JSON.stringify(rejectedBy), newStatus, id]
        );

        res.json({
            ok: true,
            rejectedCount: rejectedBy.length,
            allRejected,
            newStatus,
        });
    } catch (err) {
        console.error("❌ خطأ في رفض الطلب:", err.message);
        res.status(500).json({ ok: false, error: "فشل في رفض الطلب" });
    }
});

/* ============================================================
   إحصائيات الطلبات
   ============================================================ */
router.get("/orders-stats", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
                SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM orders
        `);

        const stats = rows[0] || { total: 0, pending: 0, accepted: 0, partial: 0, rejected: 0 };
        res.json({ ok: true, stats });
    } catch (err) {
        console.error("❌ خطأ في جلب الإحصائيات:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب الإحصائيات" });
    }
});

/* ============================================================
   🔁 بروكسي: إرسال تحديث الشحن إلى n8n Webhook
   يستخدمه الفرونت إند لتجنب مشكلة CORS
   ============================================================ */
router.post("/webhook/shipping", async (req, res) => {
    const { order_id } = req.body;

    if (!order_id) {
        return res.status(400).json({ ok: false, error: "order_id مطلوب" });
    }

    const n8nUrl = process.env.N8N_WEBHOOK_URL || "https://hakeem-26-n8n.vflqgt.easypanel.host/webhook/01d35dba-d35a-4e2f-99c0-134558257e79";

    console.log(`[Proxy] إرسال تحديث الشحن للطلب #${order_id} إلى n8n...`);

    try {
        const parsedUrl = new URL(n8nUrl);
        const postData = JSON.stringify({ order_id });

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
            },
        };

        const result = await new Promise((resolve, reject) => {
            const reqHttps = https.request(options, (response) => {
                let data = "";
                response.on("data", (chunk) => { data += chunk; });
                response.on("end", () => {
                    resolve({ status: response.statusCode, body: data });
                });
            });

            reqHttps.on("error", (err) => {
                reject(err);
            });

            reqHttps.write(postData);
            reqHttps.end();
        });

        if (result.status >= 200 && result.status < 300) {
            console.log(`[Proxy ✓] تم إرسال التحديث بنجاح للطلب #${order_id}`);
            res.json({ ok: true, message: "تم إرسال التحديث إلى n8n" });
        } else {
            console.error(`[Proxy ✗] n8n رد بـ HTTP ${result.status}: ${result.body}`);
            res.status(result.status).json({ ok: false, error: `n8n رد بـ HTTP ${result.status}` });
        }
    } catch (err) {
        console.error("[Proxy ✗] خطأ في الاتصال بـ n8n:", err.message);
        res.status(500).json({ ok: false, error: `خطأ في الاتصال بـ n8n: ${err.message}` });
    }
});

module.exports = router;