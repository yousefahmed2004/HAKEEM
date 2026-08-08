/* ============================================================
    orders.js — مسارات الطلبات (PostgreSQL)
    ============================================================ */
const express = require("express");
const router = express.Router();
const db = require("../db/database");
const https = require("https");
require("dotenv").config();

/* دالة مساعدة: توحيد قيمة status لحروف صغيرة دايمًا
    عشان القيم القادمة من n8n (Pending / PENDING / pending)
    متتطابقش مع الفرونت إند اللي بيقارن بـ "pending" حصريًا */
function normalizeStatus(status) {
    if (!status) return "pending";
    const s = String(status).trim().toLowerCase();
    const allowed = ["pending", "accepted", "partial", "rejected", "closed"];
    return allowed.includes(s) ? s : "pending";
}

/* ============================================================
    🆕 فصل اسم الدواء عن نوع العبوة (علبة / شريط / أمبولة ... إلخ)
    ------------------------------------------------------------
    كان بيوصل من الشات بوت سترينج واحد ملزّق زي "Fucidin - علبة"،
    فكان بيتخزن كده في medicine_name وبالتالي التوب سيرش وإحصائيات
    الأدوية كانت بتعتبر "Fucidin - علبة" و"Fucidin - شريط" صنفين
    مختلفين تمامًا بدل ما تتجمع تحت اسم "Fucidin" الحقيقي.
    الدالة دي بتفصل الاسم عن العبوة وقت الإدخال، فيتخزنوا في عمودين
    منفصلين (medicine_name / unit) من الأول.
    ============================================================ */
const UNIT_KEYWORDS = [
    "علبة", "علب", "شريط", "شرائط", "أمبولة", "أمبولات", "فيال", "فيالات",
    "زجاجة", "زجاجات", "أنبوبة", "أنبوبات", "كيس", "أكياس", "قرص", "أقراص",
    "كبسولة", "كبسولات", "بخاخ", "قطارة", "sachet", "strip", "box", "vial", "bottle", "tube",
];

function splitMedicineItem(raw) {
    // Object صريح فيه name/unit أو drug_name جاهزين
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const rawName = String(raw.name || raw.drug_name || raw.text || "").trim();
        let unit = String(raw.unit || raw.package || raw.form || "").trim();
        if (unit) return { name: rawName, unit };

        const parts = rawName.split(/\s*-\s*/);
        if (parts.length > 1 && UNIT_KEYWORDS.some((k) => parts[parts.length - 1].toLowerCase().includes(k.toLowerCase()))) {
            unit = parts.pop().trim();
            return { name: parts.join(" - ").trim(), unit };
        }
        return { name: rawName, unit: "" };
    }

    // سترينج زي "Fucidin - علبة"
    const str = String(raw || "").trim();
    if (!str) return { name: "", unit: "" };
    const parts = str.split(/\s*-\s*/);
    if (parts.length > 1 && UNIT_KEYWORDS.some((k) => parts[parts.length - 1].toLowerCase().includes(k.toLowerCase()))) {
        const unit = parts.pop().trim();
        return { name: parts.join(" - ").trim(), unit };
    }
    return { name: str, unit: "" };
}

/* دالة مساعدة: استخراج قائمة الأدوية أو تفاصيل الروشتة من JSON
    ترجّع دايمًا array من { name, unit } */
function resolveItems(order) {
    // 1) نتيجة json_agg من order_items — الشكل الجديد [{name, unit}]
    if (order.items) {
        let parsedItems = order.items;
        if (typeof parsedItems === "string") {
            try { parsedItems = JSON.parse(parsedItems); } catch (e) { parsedItems = null; }
        }
        if (Array.isArray(parsedItems) && parsedItems.length) {
            return parsedItems
                .map((it) => (it && typeof it === "object" ? { name: it.name || "", unit: it.unit || "" } : splitMedicineItem(it)))
                .filter((it) => it.name);
        }
    }

    // 2/3/4) fallback: عمود orders.items الخام (JSONB) — للطلبات القديمة قبل التعديل
    const raw = order.rawItems;
    if (!raw) return [];

    let parsed;
    try {
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
        return typeof raw === "string" && raw.trim() ? [splitMedicineItem(raw.trim())] : [];
    }

    // شكل array حقيقي: زي اللي بيبعت الروشتة [{"drug_name": "روشتة مصورة", "image_url": "..."}]
    if (Array.isArray(parsed)) {
        return parsed.map((item) => splitMedicineItem(item)).filter((it) => it.name);
    }

    // شكل object فيه "items" array
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        return parsed.items.map((s) => splitMedicineItem(s)).filter((it) => it.name);
    }

    // شكل object فيه "text"
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
        return parsed.text
            .split(/[,،\n]+/)
            .map((s) => splitMedicineItem(s))
            .filter((it) => it.name);
    }

    if (typeof parsed === "string" && parsed.trim()) return [splitMedicineItem(parsed.trim())];

    return [];
}

/* دالة مساعدة ذكية لاستخراج الصورة بجميع الطرق المحتملة */
function extractPrescriptionImage(order) {
    let extractedImage = "";

    // 1. البحث في الأعمدة المباشرة المحتملة
    const possibleDirect = [
        order.prescriptionImage,
        order.prescription_image,
        order.prescription,
        order.image
    ];

    for (const val of possibleDirect) {
        if (val && typeof val === "string" && val.trim() !== "") {
            extractedImage = val.trim();
            break;
        }
    }

    // 2. لو مش موجودة مباشرة، نحاول ندور عليها جوا الحقول الخام (rawItems / items)
    if (!extractedImage) {
        try {
            const raw = order.rawItems || order.items;
            if (raw) {
                const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        if (item && typeof item === "object") {
                            const found = item.image_url || item.prescriptionImage || item.image || item.url;
                            if (found) {
                                extractedImage = found;
                                break;
                            }
                        }
                    }
                } else if (parsed && typeof parsed === "object") {
                    extractedImage = parsed.image_url || parsed.prescriptionImage || parsed.image || parsed.url || "";
                }
            }
        } catch (e) {
            // لو الـ rawItems عبارة عن نص Base64 مباشر أو رابط مباشر مش JSON
            const rawStr = String(order.rawItems || order.items || "");
            if (rawStr.startsWith("data:image/") || rawStr.startsWith("http")) {
                extractedImage = rawStr;
            }
        }
    }

    return extractedImage;
}

/* ============================================================
    ⏱️ تنظيف الطلبات اللي انتهت مهلة تنفيذها (Server-side Execution Timeout)
    ------------------------------------------------------------
    بتترجع أي طلب "executionPending = 1" وتخطى "executionDeadline"
    إلى حالة "pending" تاني في قاعدة البيانات مباشرة، عشان القرار
    يبقى مركزي في السيرفر مش في المتصفح (كان بيسبب رجوع الطلب
    لقائمة الانتظار بشكل عشوائي بسبب تابات تانية مفتوحة عند
    مستخدمين آخرين كانت بتشغّل التايمر بتاعها هي بمفردها).
    ============================================================ */
async function expireOverdueOrders() {
    try {
        const expired = await db.all(`
            UPDATE orders
            SET status = 'pending',
                "pharmacyId" = NULL,
                "pharmacyName" = NULL,
                "availableItems" = NULL,
                "unavailableItems" = NULL,
                price = NULL,
                notes = NULL,
                "workflowStatus" = NULL,
                "executionPending" = 0,
                "executionCompleted" = 0,
                "executionFailed" = 1,
                "executionDeadline" = NULL,
                "updatedAt" = NOW()
            WHERE "executionPending" = 1
              AND "executionDeadline" IS NOT NULL
              AND "executionDeadline"::timestamptz < NOW()
            RETURNING id, "pharmacyName" AS "oldPharmacyName"
        `);

        for (const row of expired) {
            const text = row.oldPharmacyName
                ? `انتهى وقت تنفيذ الطلب — عادت الطلبات إلى قائمة الانتظار (${row.oldPharmacyName})`
                : "انتهى وقت تنفيذ الطلب — عادت الطلبات إلى قائمة الانتظار";
            await db.run(
                `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                [row.id, text, "#f59e0b"]
            );
        }

        if (expired.length) {
            console.log(`⏱️ انتهت مهلة تنفيذ ${expired.length} طلب/طلبات — رجعوا لقائمة الانتظار`);
        }
    } catch (err) {
        console.error("❌ خطأ في تنظيف الطلبات المنتهية:", err.message);
    }
}

/* ============================================================
    ⏱️ (جديد) تنظيف الطلبات اللي فضلت "pending" فترة طويلة من غير
    ما أي صيدلي ياخد فيها قرار (قبول/رفض/تنفيذ جزئي).
    ------------------------------------------------------------
    ⚠️ ده الإصلاح الأساسي لمشكلة "عندك أوردر سابق" اللي بتظهر
    للعميل حتى بعد ما يقفل آخر أوردر بنجاح (delivered/closed).
    السبب: استعلام "هل عندك أوردر نشط؟" في n8n (check Customer11)
    بيعمل:
        WHERE phone = ... AND status NOT IN ('delivered','closed')
        ORDER BY id DESC LIMIT 1
    وده بيرجّع أقدم/أي أوردر "pending" لسه عالق من غير قرار — حتى
    لو فيه أوردر أحدث منه اتقفل فعلاً — لأنه بيرتب DESC على مجموعة
    الأوردرات الغير مقفولة بس، مش على كل الأوردرات.
    فلازم أي أوردر "pending" يفضل عالق أكتر من مدة محددة (30 دقيقة
    افتراضيًا) يترفض تلقائيًا عشان محدش يفضل يقفل رقم العميل للأبد.
    ============================================================ */
const STALE_PENDING_MINUTES = Number(process.env.STALE_PENDING_MINUTES || 30);

async function expireStalePendingOrders() {
    try {
        const expired = await db.all(`
            UPDATE orders
            SET status = 'rejected',
                "updatedAt" = NOW()
            WHERE status = 'pending'
              AND "createdAt" < NOW() - INTERVAL '${STALE_PENDING_MINUTES} minutes'
            RETURNING id
        `);

        for (const row of expired) {
            await db.run(
                `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                [row.id, `انتهت صلاحية الطلب تلقائيًا بعد ${STALE_PENDING_MINUTES} دقيقة بدون رد من أي صيدلية`, "#ef4444"]
            );
        }

        if (expired.length) {
            console.log(`⏱️ تم رفض ${expired.length} طلب/طلبات "pending" عالقة تلقائيًا (بدون رد صيدلية)`);
        }
    } catch (err) {
        console.error("❌ خطأ في تنظيف الطلبات المعلقة العالقة:", err.message);
    }
}

/* ============================================================
    جلب جميع الطلبات
    ============================================================ */
router.get("/orders", async (req, res) => {
    try {
        await expireOverdueOrders();
        await expireStalePendingOrders();

        const { status } = req.query;
        let query = `
            SELECT 
                o.*,
                o.items as "rawItems",
                COALESCE(
                    (SELECT json_agg(json_build_object('name', oi.medicine_name, 'unit', oi.unit) ORDER BY oi.id)
                     FROM order_items oi WHERE oi.order_id = o.id),
                    '[]'
                ) as items,
                COALESCE(
                    (SELECT string_agg(DISTINCT oi.status, ',') FROM order_items oi WHERE oi.order_id = o.id),
                    ''
                ) as item_statuses
            FROM orders o
        `;

        if (status) {
            query += ` WHERE LOWER(o.status) = LOWER($1)`;
        }

        query += ` GROUP BY o.id ORDER BY o."createdAt" DESC`;

        const rows = status ? await db.all(query, [status]) : await db.all(query);

        // تحويل البيانات إلى الشكل المطلوب مع استخدام دالة استخراج الصورة الذكية
        const formattedOrders = rows.map((order) => {
            const extractedImage = extractPrescriptionImage(order);

            return {
                id: String(order.id),
                customerName: order.customerName || order.customer_name,
                phone: order.phone || "",
                address: order.address || "",
                items: resolveItems(order),
                prescriptionImage: extractedImage,
                status: normalizeStatus(order.status),
                createdAt: order.createdAt || order.created_at ? new Date(order.createdAt || order.created_at).toISOString() : new Date().toISOString(),
                pharmacyId: order.pharmacyId || order.pharmacy_id || null,
                pharmacyName: order.pharmacyName || order.pharmacy_name || null,
                price: order.price || null,
                availableItems: order.availableItems ? (typeof order.availableItems === 'string' ? JSON.parse(order.availableItems || "[]") : order.availableItems) : [],
                unavailableItems: order.unavailableItems ? (typeof order.unavailableItems === 'string' ? JSON.parse(order.unavailableItems || "[]") : order.unavailableItems) : [],
                notes: order.notes || "",
                rejectedBy: order.rejectedBy ? (typeof order.rejectedBy === 'string' ? JSON.parse(order.rejectedBy || "[]") : order.rejectedBy) : [],
                workflowStatus: order.workflowStatus || null,
                executionPending: !!order.executionPending,
                executionDeadline: order.executionDeadline || null,
                executionCompleted: !!order.executionCompleted,
                executionFailed: !!order.executionFailed,
                executedAt: order.executedAt || null,
                deliveredAt: order.deliveredAt || null,
            };
        });

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
        await expireOverdueOrders();
        await expireStalePendingOrders();

        const { id } = req.params;
        const query = `
            SELECT 
                o.*,
                o.items as "rawItems",
                COALESCE(
                    (SELECT json_agg(json_build_object('name', oi.medicine_name, 'unit', oi.unit) ORDER BY oi.id)
                     FROM order_items oi WHERE oi.order_id = o.id),
                    '[]'
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

        const extractedImage = extractPrescriptionImage(order);

        const formattedOrder = {
            id: String(order.id),
            customerName: order.customerName || order.customer_name,
            phone: order.phone || "",
            address: order.address || "",
            items: resolveItems(order),
            prescriptionImage: extractedImage,
            status: normalizeStatus(order.status),
            createdAt: order.createdAt || order.created_at ? new Date(order.createdAt || order.created_at).toISOString() : new Date().toISOString(),
            pharmacyId: order.pharmacyId || order.pharmacy_id || null,
            pharmacyName: order.pharmacyName || order.pharmacy_name || null,
            price: order.price || null,
            availableItems: order.availableItems ? (typeof order.availableItems === 'string' ? JSON.parse(order.availableItems || "[]") : order.availableItems) : [],
            unavailableItems: order.unavailableItems ? (typeof order.unavailableItems === 'string' ? JSON.parse(order.unavailableItems || "[]") : order.unavailableItems) : [],
            notes: order.notes || "",
            rejectedBy: order.rejectedBy ? (typeof order.rejectedBy === 'string' ? JSON.parse(order.rejectedBy || "[]") : order.rejectedBy) : [],
            workflowStatus: order.workflowStatus || null,
            executionPending: !!order.executionPending,
            executionDeadline: order.executionDeadline || null,
            executionCompleted: !!order.executionCompleted,
            executionFailed: !!order.executionFailed,
            executedAt: order.executedAt || null,
            deliveredAt: order.deliveredAt || null,
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
    ------------------------------------------------------------
    🆕 كل صنف بيتقسم لاسم الدواء + نوع العبوة (splitMedicineItem)
    قبل ما يتخزن في order_items، عشان التوب سيرش وإحصائيات الأدوية
    تجمع الأصناف تحت اسم الدواء الحقيقي بس.
    ============================================================ */
router.post("/orders", async (req, res) => {
    try {
        const { customerName, phone, address, items, status } = req.body;
        const prescriptionImage = req.body.prescriptionImage || req.body.prescription_image || req.body.image || req.body.prescription || "";

        const result = await db.run(
            `INSERT INTO orders ("customerName", phone, address, items, "prescriptionImage", status, "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING id`,
            [
                customerName,
                phone,
                address,
                items && Array.isArray(items) ? JSON.stringify(items) : null,
                prescriptionImage,
                normalizeStatus(status),
            ]
        );

        const orderId = result.id;

        if (items && Array.isArray(items)) {
            for (const item of items) {
                const { name, unit } = splitMedicineItem(item);
                await db.run(
                    `INSERT INTO order_items (order_id, medicine_name, unit, status) VALUES ($1, $2, $3, 'pending')`,
                    [orderId, name || JSON.stringify(item), unit || null]
                );
            }
        }

        await db.run(
            `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
            [orderId, "تم استلام الطلب من الشات بوت", "#0ea5e9"]
        );

        res.json({ ok: true, order: { id: String(orderId), ...req.body, prescriptionImage, status: normalizeStatus(status) } });
    } catch (err) {
        console.error("❌ خطأ في إنشاء الطلب:", err.message);
        res.status(500).json({ ok: false, error: "فشل في إنشاء الطلب" });
    }
});

/* ============================================================
    تحديث الطلب
    ------------------------------------------------------------
    ⚠️ إغلاق تلقائي عند الشحن:
    بمجرد ما workflowStatus بيوصل "out_for_delivery" (زر "خرج
    للتوصيل" / تم الشحن)، الطلب بيتقفل مباشرة (status = 'closed')
    من هنا في الباك إند نفسه — من غير ما نستنى أي خطوة خارجية
    (زي n8n) تعمل ده. ده كمان بيقفل الـ WhatsApp session بتاعة
    العميل في جدول customers في نفس اللحظة، عشان لو بعت رسالة
    تانية بعدها الشات بوت يبدأ معاه طلب جديد مباشرة.

    ⚠️ كمان بيصفّر ذاكرة الشات بتاعة الـ AI Agent (n8n_chat_histories)
    الخاصة بجلسة العميل ده، عشان محادثة الأوردر القديم متأثرش على
    أي أوردر جديد هيبدأه بعد كده (نفس فكرة نود "close session" اللي
    كانت في n8n، بس هنا بقى مركزي في الباك إند + بيمسح الميموري كمان).
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

        /* أي طلب يوصل لخطوة "خرج للتوصيل" يتقفل أوتوماتيك بغض النظر
           عن الـ status اللي جاي من الفرونت إند */
        const finalStatus = workflowStatus === "out_for_delivery"
            ? "closed"
            : (status ? normalizeStatus(status) : null);

        const updated = await db.get(
            `UPDATE orders 
             SET status = $1, "pharmacyId" = $2, "pharmacyName" = $3, 
                 "availableItems" = $4, "unavailableItems" = $5, 
                 "price" = $6, notes = $7, "workflowStatus" = $8,
                 "executionPending" = $9, "executionDeadline" = $10,
                 "executionCompleted" = $11, "executionFailed" = $12,
                 "executedAt" = $13, "deliveredAt" = $14,
                 "rejectedBy" = $15, "updatedAt" = NOW()
             WHERE id = $16
             RETURNING phone`,
            [
                finalStatus,
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

        /* إغلاق session الشات بوت الخاصة بالعميل فور خروج الطلب للتوصيل،
           بديل نود "close session" اللي كانت في n8n */
        if (workflowStatus === "out_for_delivery" && updated && updated.phone) {
            try {
                await db.run(
                    `UPDATE customers SET session_status = 'CLOSED' WHERE phone_number = $1`,
                    [updated.phone]
                );

                // 🧠 تصفير ذاكرة الشات بتاعة الـ AI عشان محادثة الأوردر القديم متأثرش على الجديد
                const digitsOnly = updated.phone.replace(/\D/g, "");
                const remoteJidNumber = "20" + digitsOnly.slice(1); // بيرجع الرقم لصيغة الواتساب (201055512301)
                await db.run(
                    `DELETE FROM n8n_chat_histories WHERE session_id LIKE $1`,
                    [`%${remoteJidNumber}%`]
                );
            } catch (sessErr) {
                console.error("❌ خطأ في إغلاق جلسة العميل / تصفير الذاكرة:", sessErr.message);
            }
        }

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
    رفض الطلب (صيدلي) — لسه موجودة لأي تكامل خارجي (زي n8n)
    محتاج يرفض طلب مباشرة من غير المرور بالـ Checklist
    ============================================================ */
router.patch("/orders/:id/reject/:pharmacyId", async (req, res) => {
    try {
        const { id, pharmacyId } = req.params;

        const order = await db.get("SELECT * FROM orders WHERE id = $1", [id]);
        if (!order) {
            return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
        }

        let rejectedBy = order.rejectedBy ? (typeof order.rejectedBy === 'string' ? JSON.parse(order.rejectedBy) : order.rejectedBy) : [];

        if (!rejectedBy.includes(pharmacyId)) {
            rejectedBy.push(pharmacyId);
        }

        const activePharmacists = await db.all(
            "SELECT id FROM users WHERE role = 'pharmacist' AND status = 'active'"
        );
        const activeIds = activePharmacists.map((p) => p.id);
        const allRejected = activeIds.every((pid) => rejectedBy.includes(pid));

        const newStatus = allRejected ? "rejected" : normalizeStatus(order.status);

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
    🆕 Checklist — الفعل الوحيد على الطلب المعلّق
    ------------------------------------------------------------
    الصيدلي بيعلّم كل صنف "متوفر" أو "غير متوفر" ويبعت القرار
    مرة واحدة. حسب النتيجة:
      - كله غير متوفر  → اعتذار كامل (زي الرفض القديم بالظبط)
      - كله متوفر      → قبول كامل عادي (status = accepted)
      - جزء متوفر      → status = partial على الطلب الأصلي
                          بالأصناف المتوفرة فقط + إنشاء طلب pending
                          جديد تلقائيًا بالأصناف الغير متوفرة، بنفس
                          بيانات العميل، يظهر فورًا لباقي الصيادلة
    ============================================================ */
router.post("/orders/:id/checklist", async (req, res) => {
    try {
        const { id } = req.params;
        const { pharmacyId, pharmacyName, availableItems, unavailableItems, price, notes } = req.body;

        if (!pharmacyId || !pharmacyName) {
            return res.status(400).json({ ok: false, error: "بيانات الصيدلية ناقصة" });
        }

        const order = await db.get(`SELECT * FROM orders WHERE id = $1`, [id]);
        if (!order) return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
        if (normalizeStatus(order.status) !== "pending") {
            return res.status(409).json({ ok: false, error: "تم التعامل مع هذا الطلب بالفعل" });
        }

        const available = Array.isArray(availableItems) ? availableItems : [];
        const unavailable = Array.isArray(unavailableItems) ? unavailableItems : [];

        /* ============================================================
           الحالة 1: كل الأصناف اتعلمت "غير متوفر" — اعتذار كامل
           ============================================================ */
        if (available.length === 0) {
            let rejectedBy = order.rejectedBy ? (typeof order.rejectedBy === "string" ? JSON.parse(order.rejectedBy) : order.rejectedBy) : [];
            if (!rejectedBy.includes(pharmacyId)) rejectedBy.push(pharmacyId);

            const activePharmacists = await db.all(`SELECT id FROM users WHERE role = 'pharmacist' AND status = 'active'`);
            const activeIds = activePharmacists.map((p) => p.id);
            const allRejected = activeIds.length > 0 && activeIds.every((pid) => rejectedBy.includes(pid));
            const newStatus = allRejected ? "rejected" : "pending";

            await db.run(
                `UPDATE orders SET "rejectedBy" = $1::jsonb, status = $2, "updatedAt" = NOW() WHERE id = $3`,
                [JSON.stringify(rejectedBy), newStatus, id]
            );

            await db.run(
                `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                [id, `اعتذر عن التنفيذ — ${pharmacyName}`, "#ef4444"]
            );
            if (allRejected) {
                await db.run(
                    `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                    [id, "لم يتمكن أي صيدلي من التنفيذ", "#ef4444"]
                );
            }

            return res.json({ ok: true, mode: "rejected", newStatus });
        }

        /* ============================================================
           الحالة 2/3: فيه أصناف متوفرة — قبول كامل أو جزئي
           ============================================================ */
        const isFull = unavailable.length === 0;
        const finalStatus = isFull ? "accepted" : "partial";
        const workflowStatus = isFull ? "awaiting_receipt" : "received";
        const executionPending = isFull ? 1 : 0;
        const executionDeadline = isFull ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
        const executionCompleted = isFull ? 0 : 1;

        await db.run(
            `UPDATE orders
             SET status = $1, "pharmacyId" = $2, "pharmacyName" = $3,
                 "availableItems" = $4::jsonb, "unavailableItems" = $5::jsonb,
                 price = $6, notes = $7, "workflowStatus" = $8,
                 "executionPending" = $9, "executionDeadline" = $10,
                 "executionCompleted" = $11, "executionFailed" = 0,
                 "executedAt" = $12, "updatedAt" = NOW()
             WHERE id = $13`,
            [
                finalStatus, pharmacyId, pharmacyName,
                JSON.stringify(available), JSON.stringify(unavailable),
                price || null, notes || null, workflowStatus,
                executionPending, executionDeadline, executionCompleted,
                isFull ? null : new Date().toISOString(),
                id,
            ]
        );

        const timelineText = isFull
            ? `قبل الطلب — ${pharmacyName}`
            : `تنفيذ جزئي (${available.length} من ${available.length + unavailable.length} أدوية) — ${pharmacyName}`;
        await db.run(
            `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
            [id, timelineText, isFull ? "#10b981" : "#0ea5e9"]
        );

        /* لو فيه أصناف غير متوفرة، تتحول لطلب جديد مستقل يظهر لباقي الصيادلة */
        let newOrderId = null;
        if (unavailable.length) {
            newOrderId = "sp" + Date.now();
            await db.run(
                `INSERT INTO orders (id, "customerName", phone, address, "prescriptionImage", status, notes, "createdAt")
                 VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())`,
                [newOrderId, order.customerName, order.phone, order.address, order.prescriptionImage || null, `أدوية لم تتوفر في الطلب #${id}`]
            );
            for (const item of unavailable) {
                const name = (item && typeof item === "object") ? (item.name || "") : String(item || "");
                const unit = (item && typeof item === "object") ? (item.unit || "") : "";
                if (!name) continue;
                await db.run(
                    `INSERT INTO order_items (order_id, medicine_name, unit, status) VALUES ($1, $2, $3, 'pending')`,
                    [newOrderId, name, unit || null]
                );
            }
            await db.run(
                `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                [newOrderId, `طلب جديد — أدوية لم تتوفر في الطلب الأصلي #${id} (${pharmacyName})`, "#f59e0b"]
            );
        }

        res.json({ ok: true, mode: isFull ? "accepted" : "partial", newOrderId });
    } catch (err) {
        console.error("❌ خطأ في تنفيذ Checklist الطلب:", err.message);
        res.status(500).json({ ok: false, error: "فشل في تنفيذ العملية" });
    }
});

/* ============================================================
    إحصائيات الطلبات
    ============================================================ */
router.get("/orders-stats", async (req, res) => {
    try {
        await expireOverdueOrders();
        await expireStalePendingOrders();

        const stats = await db.get(`
            SELECT 
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE LOWER(status) = 'pending')::int as pending,
                COUNT(*) FILTER (WHERE LOWER(status) IN ('accepted', 'closed'))::int as accepted,
                COUNT(*) FILTER (WHERE LOWER(status) = 'partial')::int as partial,
                COUNT(*) FILTER (WHERE LOWER(status) = 'rejected')::int as rejected
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
    🆕 الأدوية الأكثر طلبًا — Top medicines (اسم الدواء منفصل عن العبوة)
    ------------------------------------------------------------
    مجمّعة من order_items.medicine_name مباشرة في الداتابيز، عشان
    الحساب يبقى دقيق ومركزي بدل ما يتحسب في الفرونت إند من بيانات
    قديمة فيها الاسم والعبوة ملزّقين.
    ============================================================ */
router.get("/medicines-stats", async (req, res) => {
    try {
        const rows = await db.all(`
            SELECT oi.medicine_name as name, COUNT(*)::int as count
            FROM order_items oi
            GROUP BY oi.medicine_name
            ORDER BY count DESC
        `);
        res.json({ ok: true, medicines: rows });
    } catch (err) {
        console.error("❌ خطأ في جلب إحصائيات الأدوية:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب إحصائيات الأدوية" });
    }
});

/* ============================================================
    🔁 بروكسي: إرسال تحديث الشحن إلى n8n Webhook
    يستقبل order_id (إجباري) و price (اختياري — السعر الإجمالي
    الذي يدخله الصيدلي عند تنفيذ الطلب) ويمرّرهما معًا إلى n8n
    ============================================================ */
router.post("/webhook/shipping", async (req, res) => {
    const { order_id, price } = req.body;

    if (!order_id) {
        return res.status(400).json({ ok: false, error: "order_id مطلوب" });
    }

    const n8nUrl = process.env.N8N_WEBHOOK_URL || "https://hakeem-n8n.62wz9l.easypanel.host/webhook/SHIBBING";

    const normalizedPrice = price !== undefined && price !== null && Number.isFinite(Number(price)) ? Number(price) : null;

    console.log(`[Proxy] إرسال تحديث الشحن للطلب #${order_id} (السعر: ${normalizedPrice ?? "غير محدد"}) إلى n8n...`);

    try {
        const parsedUrl = new URL(n8nUrl);
        const postData = JSON.stringify({ order_id, price: normalizedPrice });

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
