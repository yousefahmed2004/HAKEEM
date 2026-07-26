/* ============================================================
   orders.js — مسارات الطلبات (PostgreSQL)
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
                COALESCE(
                    (SELECT string_agg(DISTINCT oi.medicine_name, ',') FROM order_items oi WHERE oi.order_id = o.id),
                    ''
                ) as items,
                COALESCE(
                    (SELECT string_agg(DISTINCT oi.status, ',') FROM order_items oi WHERE oi.order_id = o.id),
                    ''
                ) as item_statuses
            FROM orders o
        `;

        if (status) {
            query += ` WHERE o.status = $1`;
        }

        query += ` GROUP BY o.id ORDER BY o."createdAt" DESC`;

        const rows = status ? await db.all(query, [status]) : await db.all(query);

        // تحويل البيانات إلى الشكل المطلوب
        const formattedOrders = rows.map((order) => ({
            id: String(order.id),
            customerName: order.customerName || order.customer_name,
            phone: order.phone || "",
            address: order.address || "",
            items: order.items ? order.items.split(",") : [],
            prescriptionImage: order.prescriptionImage || order.prescription_image || "",
            status: order.status || "pending",
            createdAt: order.createdAt || order.created_at ? new Date(order.createdAt || order.created_at).toISOString() : new Date().toISOString(),
            pharmacyId: order.pharmacyId || order.pharmacy_id || null,
            pharmacyName: order.pharmacyName || order.pharmacy_name || null,
            price: order.price || null,
            availableItems: order.availableItems ? (typeof order.availableItems === 'string' ? JSON.parse(order.availableItems || "[]") : order.availableItems) : [],
            unavailableItems: order.unavailableItems ? (typeof order.unavailableItems === 'string' ? JSON.parse(order.unavailableItems || "[]") : order.unavailableItems) : [],
            notes: order.notes || "",
            rejectedBy: order.rejectedBy ? (typeof order.rejectedBy === 'string' ? JSON.parse(order.rejectedBy || "[]") : order.rejectedBy) : [],
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
                COALESCE(
                    (SELECT string_agg(DISTINCT oi.medicine_name, ',' ORDER BY oi.id) FROM order_items oi WHERE oi.order_id = o.id),
                    ''
                ) as items,
                COALESCE(
                    (SELECT string_agg(DISTINCT oi.status, ',' ORDER BY oi.id) FROM order_items oi WHERE oi.order_id = o.id),
                    ''
                ) as item_statuses
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = $1
            GROUP BY o.id
        `;
        const order = await db.get(query, [id]);

        if (!order) {
            return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
        }

        const timelineRows = await db.all(
            `SELECT at, text, color FROM order_timeline WHERE "orderId" = $1 ORDER BY at ASC`,
            [id]
        );

        const formattedOrder = {
            id: String(order.id),
            customerName: order.customerName || order.customer_name,
            phone: order.phone || "",
            address: order.address || "",
            items: order.items ? order.items.split(",") : [],
            prescriptionImage: order.prescriptionImage || order.prescription_image || "",
            status: order.status || "pending",
            createdAt: order.createdAt || order.created_at ? new Date(order.createdAt || order.created_at).toISOString() : new Date().toISOString(),
            pharmacyId: order.pharmacyId || order.pharmacy_id || null,
            pharmacyName: order.pharmacyName || order.pharmacy_name || null,
            price: order.price || null,
            availableItems: order.availableItems ? (typeof order.availableItems === 'string' ? JSON.parse(order.availableItems || "[]") : order.availableItems) : [],
            unavailableItems: order.unavailableItems ? (typeof order.unavailableItems === 'string' ? JSON.parse(order.unavailableItems || "[]") : order.unavailableItems) : [],
            notes: order.notes || "",
            rejectedBy: order.rejectedBy ? (typeof order.rejectedBy === 'string' ? JSON.parse(order.rejectedBy || "[]") : order.rejectedBy) : [],
            timeline: timelineRows.length ? timelineRows.map((t) => ({
                at: new Date(t.at).toISOString(),
                text: t.text,
                color: t.color,
            })) : [
                { at: order.createdAt || order.created_at || new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }
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

        const result = await db.run(
            `INSERT INTO orders ("customerName", phone, address, "prescriptionImage", status, "createdAt")
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING id`,
            [
                customerName,
                phone,
                address,
                prescriptionImage || "",
                status || "pending",
            ]
        );

        const orderId = result.id;

        // إضافة الأدوية
        if (items && Array.isArray(items)) {
            for (const item of items) {
                await db.run(
                    `INSERT INTO order_items (order_id, medicine_name, status) VALUES ($1, $2, 'pending')`,
                    [orderId, item]
                );
            }
        }

        // أول سجل في الـ Timeline
        await db.run(
            `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
            [orderId, "تم استلام الطلب من الشات بوت", "#0ea5e9"]
        );

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
        const {
            status, pharmacyId, pharmacyName, availableItems, unavailableItems,
            price, notes, workflowStatus,
            executionPending, executionDeadline, executionCompleted, executionFailed,
            executedAt, deliveredAt, rejectedBy,
            timelineText, timelineColor,
        } = req.body;

        await db.run(
            `UPDATE orders 
             SET status = $1, "pharmacyId" = $2, "pharmacyName" = $3, 
                 "availableItems" = $4, "unavailableItems" = $5, 
                 price = $6, notes = $7, "workflowStatus" = $8,
                 "executionPending" = $9, "executionDeadline" = $10,
                 "executionCompleted" = $11, "executionFailed" = $12,
                 "executedAt" = $13, "deliveredAt" = $14,
                 "rejectedBy" = $15, "updatedAt" = NOW()
             WHERE id = $16`,
            [
                status || null,
                pharmacyId || null,
                pharmacyName || null,
                availableItems ? JSON.stringify(availableItems) : null,
                unavailableItems ? JSON.stringify(unavailableItems) : null,
                price || null,
                notes || null,
                workflowStatus || null,
                executionPending ? 1 : 0,
                executionDeadline || null,
                executionCompleted ? 1 : 0,
                executionFailed ? 1 : 0,
                executedAt || null,
                deliveredAt || null,
                rejectedBy ? JSON.stringify(rejectedBy) : null,
                id,
            ]
        );

        // إضافة سجل جديد في الـ Timeline لو الفرونت إند بعت نص لـ timeline
        if (timelineText) {
            await db.run(
                `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                [id, timelineText, timelineColor || "#0ea5e9"]
            );
        }

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
        const order = await db.get("SELECT * FROM orders WHERE id = $1", [id]);
        if (!order) {
            return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
        }

        let rejectedBy = order.rejectedBy ? (typeof order.rejectedBy === 'string' ? JSON.parse(order.rejectedBy) : order.rejectedBy) : [];

        if (!rejectedBy.includes(pharmacyId)) {
            rejectedBy.push(pharmacyId);
        }

        // التحقق مما إذا كان جميع الصيادلة النشطين قد رفضوا
        const activePharmacists = await db.all(
            "SELECT id FROM users WHERE role = 'pharmacist' AND status = 'active'"
        );
        const activeIds = activePharmacists.map((p) => p.id);
        const allRejected = activeIds.every((pid) => rejectedBy.includes(pid));

        const newStatus = allRejected ? "rejected" : order.status;

        await db.run(
            "UPDATE orders SET \"rejectedBy\" = $1::jsonb, status = $2 WHERE id = $3",
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
        const stats = await db.get(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
                COUNT(*) FILTER (WHERE status = 'accepted')::int as accepted,
                COUNT(*) FILTER (WHERE status = 'partial')::int as partial,
                COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected
            FROM orders
        `);

        const result = stats || { total: 0, pending: 0, accepted: 0, partial: 0, rejected: 0 };
        res.json({ ok: true, stats: result });
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
