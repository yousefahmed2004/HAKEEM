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
    🆕 (إصلاح) عمود orders.id هو VARCHAR(100) PRIMARY KEY من غير
    أي DEFAULT — يعني أي INSERT لازم يبعت قيمة id بنفسه، وإلا
    الـ PRIMARY KEY بيرفض NULL بخطأ "null value in column id
    violates not-null constraint".
    بنولّد رقم عشوائي من 5 أرقام (زي بالظبط اللي بيعمله n8n:
    floor(random() * 90000 + 10000)) عشان نفس شكل الـ IDs في
    كل مكان في النظام. في الاحتمال النادر جدًا لتصادم مع id
    موجود فعلاً، بنعيد المحاولة لحد 5 مرات.
    ============================================================ */
async function generateUniqueOrderId(queryRunner) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = String(Math.floor(Math.random() * 90000) + 10000);
        const existing = await queryRunner.get(`SELECT id FROM orders WHERE id = $1`, [candidate]);
        if (!existing) return candidate;
    }
    // fallback نادر جدًا: نضيف timestamp عشان نضمن التفرد
    return String(Date.now()).slice(-8);
}

/* ============================================================
    🆕 (تنفيذ جزئي) عدد الصيدليات المختلفة اللي لو اعتذرت عن نفس
    الصنف ضمن نفس سلسلة الطلب، بيُعتبر الصنف "ناقص السوق" ويترسل
    تنبيه للعميل. قابل للتعديل عبر متغير بيئة SHORTAGE_THRESHOLD.
    ============================================================ */
const SHORTAGE_THRESHOLD = Number(process.env.SHORTAGE_THRESHOLD || 5);

/* رابط Webhook الخاص بـ n8n لإرسال رسالة "الدواء ده ناقص السوق" للعميل
    (Webhook4 → "shortage message to customer" في ملف الـ workflow) */
const N8N_SHORTAGE_WEBHOOK_URL =
    process.env.N8N_SHORTAGE_WEBHOOK_URL ||
    "https://hakeem-n8n.62wz9l.easypanel.host/webhook/SHORTAGE";

/* رابط Webhook الشحن الحالي (بدون تغيير) */
const N8N_SHIPPING_WEBHOOK_URL =
    process.env.N8N_WEBHOOK_URL ||
    "https://hakeem-n8n.62wz9l.easypanel.host/webhook/SHIBBING";

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
    🔁 دالة عامة لإرسال Webhook إلى n8n (تُستخدم لتحديث الشحن
    ولتنبيه نفاد الدواء من السوق) — لا تفشل الطلب الأساسي أبدًا،
    بترجع { ok, status, body } أو { ok:false, error } فقط.
    ============================================================ */
function sendN8nWebhook(url, payload) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(url);
            const postData = JSON.stringify(payload);
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

            const reqHttps = https.request(options, (response) => {
                let data = "";
                response.on("data", (chunk) => { data += chunk; });
                response.on("end", () => {
                    resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, body: data });
                });
            });

            reqHttps.on("error", (err) => {
                resolve({ ok: false, error: err.message });
            });

            reqHttps.write(postData);
            reqHttps.end();
        } catch (err) {
            resolve({ ok: false, error: err.message });
        }
    });
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

/* دالة مساعدة موحّدة لتنسيق صف طلب خام (من الاستعلام) إلى الشكل
    اللي بيستهلكه الفرونت إند — بتتكرر في GET /orders و GET /orders/:id
    فبقت هنا دالة واحدة بدل التكرار */
function formatOrderRow(order) {
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
        /* 🆕 روابط سلسلة التنفيذ الجزئي (order splitting) */
        rootOrderId: order.rootOrderId || null,
        parentOrderId: order.parentOrderId || null,
    };
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

        const formattedOrders = rows.map(formatOrderRow);

        res.json({ ok: true, orders: formattedOrders });
    } catch (err) {
        console.error("❌ خطأ في جلب الطلبات:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب الطلبات" });
    }
});

/* ============================================================
    جلب طلب واحد
    ------------------------------------------------------------
    ⚠️ (إصلاح) PostgreSQL بيرفض استخدام ORDER BY جوه aggregate فيه
    DISTINCT إلا لو التعبير اللي بترتب بيه موجود في نفس الـ argument
    list بتاعة الـ aggregate نفسها. كان هنا:
        string_agg(DISTINCT oi.status, ',' ORDER BY oi.id)
    وده بيرمي: "in an aggregate with DISTINCT, ORDER BY expressions
    must appear in argument list" لأن oi.id مش من ضمن آرجيومنتس
    الـ DISTINCT (اللي هي oi.status بس). الحقل ده (item_statuses)
    أصلاً مش مستخدم في formatOrderRow، فمفيش داعي للترتيب هنا خالص —
    تمت إزالة ORDER BY بالكامل (بالظبط زي GET /orders فوق).
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
                    (SELECT string_agg(DISTINCT oi.status, ',') FROM order_items oi WHERE oi.order_id = o.id),
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
            ...formatOrderRow(order),
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

    ⚠️ (إصلاح) عمود "id" هو PRIMARY KEY من غير DEFAULT، و"updatedAt"
    معرّف NOT NULL — الاتنين دلوقتي بيتبعتوا صراحةً بدل ما يترميوا
    فاضيين ويسببوا "null value violates not-null constraint".
    ============================================================ */
router.post("/orders", async (req, res) => {
    try {
        const { customerName, phone, address, items, status } = req.body;
        const prescriptionImage = req.body.prescriptionImage || req.body.prescription_image || req.body.image || req.body.prescription || "";

        const newId = await generateUniqueOrderId(db);

        const result = await db.run(
            `INSERT INTO orders (id, "customerName", phone, address, items, "prescriptionImage", status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             RETURNING id`,
            [
                newId,
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

    ملحوظة: التنفيذ الجزئي (Partial) بقى ليه مسار مستقل تمامًا:
    POST /orders/:id/partial تحت — عشان يتعامل مع تقسيم الطلب
    (Order Splitting) واحتساب نقص الأدوية بشكل آمن ومركزي.
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
    🆕 التنفيذ الجزئي (Partial Fulfillment + Order Splitting)
    ------------------------------------------------------------
    الصيدلي بيبعت قائمتين: availableItems (متوفرة عنده — بينفذها
    ويقبضها بسعر price)، و unavailableItems (مش متوفرة عنده).

    اللي بيحصل هنا بالترتيب:
    1) الطلب الحالي يتحدث لحالة "partial" بالأصناف المتوفرة بس،
       ويتقفل تنفيذه (نفس منطق قبول عادي لكن جزئي).
    2) لكل صنف مش متوفر: يتسجل في medicine_shortage_reports أنه
       اتعلّم عليه "X" من الصيدلية دي، ثم نحسب عدد الصيدليات
       المختلفة اللي اعتذرت عن نفس الصنف ضمن نفس سلسلة الطلب
       (rootOrderId) من الأول. لو وصل العدد لحد SHORTAGE_THRESHOLD
       (5 افتراضيًا) ولسه ماتبعتش تنبيه قبل كده، نبعت رسالة واتساب
       للعميل تقوله إن الصنف ده ناقص من السوق، ونستبعده من أي
       طلب جديد بعد كده.
    3) الأصناف الباقية (اللي لسه معملهاش تنبيه نفاد) بيتكوّن منها
       طلب جديد "pending" لنفس العميل، مرتبط بالطلب الأصلي عبر
       parentOrderId/rootOrderId، وبيظهر فورًا في لوحة كل الصيادلة
       ما عدا الصيدلية اللي عملت التنفيذ الجزئي.

    ⚠️ (إصلاح جوهري) كل الخطوات دي بقت شغالة داخل transaction واحدة
    (db.withTransaction) بدل ما تكون كويريز منفصلة autocommit. قبل
    كده لو خطوة نصفها نجحت (مثلاً: الطلب الأصلي بقى "partial")
    وبعدها خطوة تانية فشلت (زي إنشاء الطلب الابن)، مفيش rollback،
    فالطلب كان بيفضل عالق partial من غير الطلب الابن، وأي محاولة
    تانية كانت بترجع 409 "الطلب مش متاح" لأنه خلاص مش pending.
    دلوقتي: لو أي خطوة فشلت، كل حاجة ترجع زي الأول (rollback)
    والطلب الأصلي يفضل pending تمامًا، جاهز لإعادة المحاولة.

    ⚠️ (إصلاح) توليد id صريح للطلب الابن بنفس طريقة generateUniqueOrderId
    (كان العمود من غير DEFAULT فبيرمي null value violates not-null).

    ⚠️ (إصلاح 🆕) عمود orders."executedAt" معرّف VARCHAR(100) مش
    TIMESTAMP (شوف database.js). كان بيتبعتله NOW() مباشرة، وده
    بيرمي خطأ نوع بيانات في بوستجريس (varchar لا يقبل timestamp)
    فبتفشل الـ transaction كلها بـ 500 قبل ما توصل حتى لخطوة إنشاء
    الطلب الابن. دلوقتي بنبعت string جاهز (ISO) بدل NOW().

    ⚠️ (ملحوظة مهمة) لو عندك على الداتابيز unique index/constraint
    زي "one_active_order_per_phone" بيمنع أكتر من طلب "نشط" لنفس
    رقم الهاتف، لازم يكون مستثني الطلبات اللي ليها parentOrderId
    (يعني الطلبات "الأبناء" الناتجة من هنا)، وإلا هذا الـ INSERT
    هيفشل بخطأ "duplicate key value violates unique constraint"
    لأن الطلب الأصلي (partial) لسه "نشط" في نفس اللحظة اللي بننشئ
    فيها الطلب الابن بنفس رقم الهاتف. شوف database.js — تم إضافة
    migration بيصلح الـ index ده تلقائيًا عند تشغيل السيرفر.

    الـ webhooks (تنبيه نفاد الدواء) بتتبعت بعد نجاح الـ commit فقط،
    عشان محاولة إرسالها متعملش rollback للعملية الأساسية لو فشلت.
    ============================================================ */
router.post("/orders/:id/partial", async (req, res) => {
    try {
        const { id } = req.params;
        const { pharmacyId, pharmacyName, availableItems, unavailableItems, price, notes } = req.body;

        if (!pharmacyId || !pharmacyName) {
            return res.status(400).json({ ok: false, error: "بيانات الصيدلية مطلوبة" });
        }
        if (!Array.isArray(availableItems) || !Array.isArray(unavailableItems)) {
            return res.status(400).json({ ok: false, error: "قائمة الأصناف غير صحيحة" });
        }
        if (!availableItems.length) {
            return res.status(400).json({ ok: false, error: "حدد صنفًا واحدًا على الأقل كمتوفر" });
        }
        if (!unavailableItems.length) {
            return res.status(400).json({ ok: false, error: "لو كل الأصناف متوفرة استخدم قبول الطلب بالكامل بدلاً من التنفيذ الجزئي" });
        }
        if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
            return res.status(400).json({ ok: false, error: "أدخل سعرًا صحيحًا أكبر من صفر" });
        }

        const txResult = await db.withTransaction(async (tx) => {
            const order = await tx.get(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [id]);
            if (!order) {
                const notFoundErr = new Error("الطلب غير موجود");
                notFoundErr.httpStatus = 404;
                throw notFoundErr;
            }
            if (normalizeStatus(order.status) !== "pending") {
                const conflictErr = new Error("لم يعد هذا الطلب متاحًا للتنفيذ الجزئي");
                conflictErr.httpStatus = 409;
                throw conflictErr;
            }

            const existingRejectedBy = order.rejectedBy
                ? (typeof order.rejectedBy === "string" ? JSON.parse(order.rejectedBy) : order.rejectedBy)
                : [];
            if (existingRejectedBy.includes(pharmacyId)) {
                const conflictErr = new Error("سبق أن اعتذرت عن هذا الطلب");
                conflictErr.httpStatus = 409;
                throw conflictErr;
            }

            // جذر سلسلة الطلب: لو الطلب ده أصلاً طرف في سلسلة (متفرّع من طلب أقدم) بنستخدم نفس
            // rootOrderId بتاعه، وإلا هو نفسه الجذر (أول طلب في السلسلة)
            const rootOrderId = order.rootOrderId || order.id;

            /* ⚠️ (إصلاح) "executedAt" عمود VARCHAR مش TIMESTAMP — لازم نبعتله
               نص جاهز (ISO string) بدل NOW() عشان متطلعش خطأ نوع بيانات
               توقف الـ transaction كلها. */
            const executedAtValue = new Date().toISOString();

            // 1) تحديث الطلب الحالي — تنفيذ جزئي بالأصناف المتوفرة فقط
            await tx.run(
                `UPDATE orders
                 SET status = 'partial', "pharmacyId" = $1, "pharmacyName" = $2,
                     "availableItems" = $3, "unavailableItems" = $4, price = $5, notes = $6,
                     "workflowStatus" = 'received', "executionPending" = 0, "executionDeadline" = NULL,
                     "executionCompleted" = 1, "executionFailed" = 0, "executedAt" = $7,
                     "rootOrderId" = $8, "updatedAt" = NOW()
                 WHERE id = $9`,
                [
                    pharmacyId, pharmacyName,
                    JSON.stringify(availableItems), JSON.stringify(unavailableItems),
                    Number(price), notes || null,
                    executedAtValue,
                    rootOrderId, id,
                ]
            );

            await tx.run(
                `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                [id, `تنفيذ جزئي (${availableItems.length} من ${availableItems.length + unavailableItems.length} أدوية) — ${pharmacyName}`, "#0ea5e9"]
            );

            // 2) تسجيل كل صنف ناقص + احتساب عدد الصيدليات المختلفة اللي اعتذرت عنه في نفس السلسلة
            const shortageNow = [];          // أصناف بلغت حد التنبيه الآن لأول مرة (هيتبعت لهم رسالة بعد الـ commit)
            const remainingForNewOrder = []; // أصناف هتتكرر في الطلب الجديد

            for (const rawItem of unavailableItems) {
                const { name, unit } = splitMedicineItem(rawItem);
                if (!name) continue;

                await tx.run(
                    `INSERT INTO medicine_shortage_reports ("rootOrderId", medicine_name, "pharmacyId")
                     VALUES ($1, $2, $3)
                     ON CONFLICT ("rootOrderId", medicine_name, "pharmacyId") DO NOTHING`,
                    [rootOrderId, name, pharmacyId]
                );

                const countRow = await tx.get(
                    `SELECT COUNT(DISTINCT "pharmacyId")::int as cnt FROM medicine_shortage_reports WHERE "rootOrderId" = $1 AND medicine_name = $2`,
                    [rootOrderId, name]
                );
                const distinctCount = countRow ? countRow.cnt : 0;

                const alreadyAlerted = await tx.get(
                    `SELECT id FROM medicine_shortage_alerts WHERE "rootOrderId" = $1 AND medicine_name = $2`,
                    [rootOrderId, name]
                );

                if (distinctCount >= SHORTAGE_THRESHOLD && !alreadyAlerted) {
                    await tx.run(
                        `INSERT INTO medicine_shortage_alerts ("rootOrderId", medicine_name) VALUES ($1, $2)
                         ON CONFLICT ("rootOrderId", medicine_name) DO NOTHING`,
                        [rootOrderId, name]
                    );
                    shortageNow.push({ name, unit });
                } else if (distinctCount >= SHORTAGE_THRESHOLD && alreadyAlerted) {
                    // سبق التنبيه على الصنف ده قبل كده — يفضل مستبعد من أي طلب جديد
                } else {
                    remainingForNewOrder.push({ name, unit });
                }
            }

            // 3) تسجيل إبلاغ العميل بأي صنف بلغ حد النفاد للتو في التايم لاين
            //    (إرسال الـ webhook الفعلي بيتأجل لحد ما الـ transaction تنجح)
            for (const shortItem of shortageNow) {
                await tx.run(
                    `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                    [id, `تم إبلاغ العميل بنفاد "${shortItem.name}" من السوق (اعتذرت عنه ${SHORTAGE_THRESHOLD} صيدليات مختلفة)`, "#dc2626"]
                );
            }

            // 4) إنشاء طلب جديد بالأصناف الناقصة المتبقية (لو فيه) — يظهر فورًا لكل الصيادلة
            //    ما عدا الصيدلية الحالية (اللي أصلاً قالت إن الأصناف دي مش متوفرة عندها)
            let childOrderId = null;
            if (remainingForNewOrder.length) {
                const newChildId = await generateUniqueOrderId(tx);

                await tx.run(
                    `INSERT INTO orders (id, "customerName", phone, address, items, "prescriptionImage", status, "rootOrderId", "parentOrderId", "rejectedBy", "createdAt", "updatedAt")
                     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9::jsonb, NOW(), NOW())`,
                    [
                        newChildId,
                        order.customerName, order.phone, order.address,
                        JSON.stringify(remainingForNewOrder),
                        order.prescriptionImage || null,
                        rootOrderId, id,
                        JSON.stringify([pharmacyId]),
                    ]
                );
                childOrderId = newChildId;

                for (const item of remainingForNewOrder) {
                    await tx.run(
                        `INSERT INTO order_items (order_id, medicine_name, unit, status) VALUES ($1, $2, $3, 'pending')`,
                        [childOrderId, item.name, item.unit || null]
                    );
                }

                await tx.run(
                    `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                    [childOrderId, `طلب مكمل للطلب #${id} — أصناف ناقصة (${remainingForNewOrder.length}) أُعيد طرحها على باقي الصيادلة`, "#f59e0b"]
                );
            } else if (shortageNow.length || unavailableItems.length) {
                // كل الأصناف الناقصة إما اتبلّغ عنها نفاد من السوق أو خلاص اتبلّغ عنها قبل كده
                await tx.run(
                    `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                    [id, `كل الأصناف الناقصة أصبحت مُبلّغ عنها كنفاد من السوق — لا يوجد طلب جديد`, "#dc2626"]
                );
            }

            return { order, rootOrderId, shortageNow, childOrderId };
        });

        // 5) بعد نجاح الـ commit فقط: إرسال تنبيهات نفاد السوق لـ n8n (لا تؤثر على نجاح الطلب)
        for (const shortItem of txResult.shortageNow) {
            sendN8nWebhook(N8N_SHORTAGE_WEBHOOK_URL, {
                type: "medicine_out_of_stock",
                order_id: id,
                root_order_id: txResult.rootOrderId,
                phone: txResult.order.phone,
                customer_name: txResult.order.customerName,
                medicine_name: shortItem.name,
            }).then((r) => {
                if (!r.ok) console.error(`[Shortage Webhook ✗] فشل إبلاغ العميل بنفاد "${shortItem.name}":`, r.error || r.body);
                else console.log(`[Shortage Webhook ✓] تم إبلاغ العميل بنفاد "${shortItem.name}"`);
            });
        }

        res.json({
            ok: true,
            orderId: String(id),
            childOrderId: txResult.childOrderId ? String(txResult.childOrderId) : null,
            shortageAlerts: txResult.shortageNow.map((s) => s.name),
        });
    } catch (err) {
        const status = err.httpStatus || 500;
        if (status === 500) {
            console.error("❌ خطأ في التنفيذ الجزئي:", err.message);
            return res.status(500).json({ ok: false, error: "فشل في تنفيذ الطلب جزئيًا" });
        }
        res.status(status).json({ ok: false, error: err.message });
    }
});

/* ============================================================
    رفض الطلب (صيدلي)
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
    🆕 الأصناف الناقصة من السوق حسب سلسلة طلب معينة (للتشخيص/العرض)
    ============================================================ */
router.get("/orders/:id/shortages", async (req, res) => {
    try {
        const { id } = req.params;
        const order = await db.get(`SELECT id, "rootOrderId" FROM orders WHERE id = $1`, [id]);
        if (!order) return res.status(404).json({ ok: false, error: "الطلب غير موجود" });

        const rootOrderId = order.rootOrderId || order.id;
        const rows = await db.all(
            `SELECT medicine_name, COUNT(DISTINCT "pharmacyId")::int as pharmacies_count
             FROM medicine_shortage_reports
             WHERE "rootOrderId" = $1
             GROUP BY medicine_name
             ORDER BY pharmacies_count DESC`,
            [rootOrderId]
        );
        const alerts = await db.all(
            `SELECT medicine_name FROM medicine_shortage_alerts WHERE "rootOrderId" = $1`,
            [rootOrderId]
        );
        res.json({ ok: true, rootOrderId, threshold: SHORTAGE_THRESHOLD, reports: rows, notified: alerts.map((a) => a.medicine_name) });
    } catch (err) {
        console.error("❌ خطأ في جلب تقارير النقص:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب تقارير النقص" });
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

    const normalizedPrice = price !== undefined && price !== null && Number.isFinite(Number(price)) ? Number(price) : null;

    console.log(`[Proxy] إرسال تحديث الشحن للطلب #${order_id} (السعر: ${normalizedPrice ?? "غير محدد"}) إلى n8n...`);

    const result = await sendN8nWebhook(N8N_SHIPPING_WEBHOOK_URL, { order_id, price: normalizedPrice });

    if (result.ok) {
        console.log(`[Proxy ✓] تم إرسال التحديث بنجاح للطلب #${order_id}`);
        res.json({ ok: true, message: "تم إرسال التحديث إلى n8n" });
    } else {
        console.error(`[Proxy ✗] فشل إرسال التحديث للطلب #${order_id}:`, result.error || result.body);
        res.status(result.status || 500).json({ ok: false, error: result.error || `n8n رد بـ HTTP ${result.status}` });
    }
});

module.exports = router;
