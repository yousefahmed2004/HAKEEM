/* ============================================================
    orders.js — مسارات الطلبات (PostgreSQL)
    ============================================================ */
const express = require("express");
const router = express.Router();
const db = require("../db/database");
const https = require("https");
require("dotenv").config();

function normalizeStatus(status) {
    if (!status) return "pending";
    const s = String(status).trim().toLowerCase();
    /* 🆕 "market_unavailable" = حالة نهائية للطلبات "الفرعية" (الناتجة عن
       تنفيذ جزئي) اللي اعتذر عن توفرها عدد كافٍ من الصيدليات (SHORTAGE_THRESHOLD).
       الطلب في الحالة دي بيتقفل نهائيًا ويختفي من كل القوائم (GET /orders
       بيستبعدها افتراضيًا تحت) — شوف /orders/:id/unavailable */
    const allowed = ["pending", "accepted", "partial", "rejected", "closed", "market_unavailable"];
    return allowed.includes(s) ? s : "pending";
}

async function generateUniqueOrderId(queryRunner) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = String(Math.floor(Math.random() * 90000) + 10000);
        const existing = await queryRunner.get(`SELECT id FROM orders WHERE id = $1`, [candidate]);
        if (!existing) return candidate;
    }
    return String(Date.now()).slice(-8);
}

const SHORTAGE_THRESHOLD = Number(process.env.SHORTAGE_THRESHOLD || 5);

const N8N_SHORTAGE_WEBHOOK_URL =
    process.env.N8N_SHORTAGE_WEBHOOK_URL ||
    "https://hakeem-n8n.62wz9l.easypanel.host/webhook/SHORTAGE";

const N8N_SHIPPING_WEBHOOK_URL =
    process.env.N8N_WEBHOOK_URL ||
    "https://hakeem-n8n.62wz9l.easypanel.host/webhook/SHIBBING";

const UNIT_KEYWORDS = [
    "علبة", "علب", "شريط", "شرائط", "أمبولة", "أمبولات", "فيال", "فيالات",
    "زجاجة", "زجاجات", "أنبوبة", "أنبوبات", "كيس", "أكياس", "قرص", "أقراص",
    "كبسولة", "كبسولات", "بخاخ", "قطارة", "sachet", "strip", "box", "vial", "bottle", "tube",
];

function splitMedicineItem(raw) {
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

    const str = String(raw || "").trim();
    if (!str) return { name: "", unit: "" };
    const parts = str.split(/\s*-\s*/);
    if (parts.length > 1 && UNIT_KEYWORDS.some((k) => parts[parts.length - 1].toLowerCase().includes(k.toLowerCase()))) {
        const unit = parts.pop().trim();
        return { name: parts.join(" - ").trim(), unit };
    }
    return { name: str, unit: "" };
}

function resolveItems(order) {
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

    const raw = order.rawItems;
    if (!raw) return [];

    let parsed;
    try {
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
        return typeof raw === "string" && raw.trim() ? [splitMedicineItem(raw.trim())] : [];
    }

    if (Array.isArray(parsed)) {
        return parsed.map((item) => splitMedicineItem(item)).filter((it) => it.name);
    }

    if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        return parsed.items.map((s) => splitMedicineItem(s)).filter((it) => it.name);
    }

    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
        return parsed.text
            .split(/[,،\n]+/)
            .map((s) => splitMedicineItem(s))
            .filter((it) => it.name);
    }

    if (typeof parsed === "string" && parsed.trim()) return [splitMedicineItem(parsed.trim())];

    return [];
}

function extractPrescriptionImage(order) {
    let extractedImage = "";

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
            const rawStr = String(order.rawItems || order.items || "");
            if (rawStr.startsWith("data:image/") || rawStr.startsWith("http")) {
                extractedImage = rawStr;
            }
        }
    }

    return extractedImage;
}

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
    🆕 retryPendingShippingWebhooks — إعادة محاولة تلقائية لأي سلسلة
    شحن "جاهزة" (كل أطرافها وصلت out_for_delivery/delivered) بس
    رسالتها لسه ما وصلتش (فشل الإرسال قبل كده، والحجز القديم اتمسح
    — شوف الإصلاح في trySendCombinedShippingWebhook).
    ------------------------------------------------------------
    من غير الدالة دي، لو فشل الإرسال مرة واحدة ومفيش أي تحديث تاني
    هيحصل على نفس السلسلة (كل الأطراف خلصت شغلها خلاص)، مفيش أي
    Event هيعيد نداء trySendCombinedShippingWebhook تاني، فالطلب
    كان هيفضل من غير رسالة شحن للأبد.
    بتتنادى مع كل GET /orders (يعني كل ~6 ثواني تلقائيًا من الفرونت
    إند بتاع كل مستخدم فاتح الصفحة) — خفيفة لأنها بتشتغل بس على
    السلاسل اللي "جاهزة" فعلاً ومالهاش صف ناجح في shipping_notifications.
    ============================================================ */
async function retryPendingShippingWebhooks() {
    try {
        const candidates = await db.all(`
            SELECT DISTINCT COALESCE("rootOrderId", id) AS root_id
            FROM orders
            WHERE "pharmacyId" IS NOT NULL
              AND "workflowStatus" IN ('out_for_delivery', 'delivered')
        `);
        for (const row of candidates) {
            const rootId = row.root_id;
            const already = await db.get(
                `SELECT id FROM shipping_notifications WHERE "rootOrderId" = $1`,
                [rootId]
            );
            if (already) continue; // اتبعتت قبل كده بنجاح — مفيش داعي نحاول تاني
            await trySendCombinedShippingWebhook(rootId).catch((e) => {
                console.error(`❌ فشل retry إرسال رسالة الشحن للسلسلة #${rootId}:`, e.message);
            });
        }
    } catch (err) {
        console.error("❌ خطأ في retryPendingShippingWebhooks:", err.message);
    }
}

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
        rootOrderId: order.rootOrderId || null,
        parentOrderId: order.parentOrderId || null,
    };
}

/* ============================================================
    🆕 جلب كل "أطراف" سلسلة تنفيذ جزئي معيّنة
    ------------------------------------------------------------
    السلسلة = الطلب الجذر (rootOrderId) + كل الطلبات الأبناء اللي
    rootOrderId بتاعهم بيساوي نفس الجذر. لو الطلب مبقى منقسم
    خالص (صيدلية واحدة نفذته بالكامل)، السلسلة هتحتوي على طلب
    واحد بس وده طبيعي — الرسالة هتتبعت عادي زي ما هي دلوقتي.
    ============================================================ */
async function getChainOrders(rootOrderId) {
    return await db.all(
        `SELECT * FROM orders WHERE id = $1 OR "rootOrderId" = $1`,
        [rootOrderId]
    );
}

/* ============================================================
    🆕🆕 computeChainShippingBlock — هل الصيدلي المسؤول عن order
    ده يقدر يدوس "خرج للتوصيل" دلوقتي ولا لأ؟
    ------------------------------------------------------------
    بتفحص باقي "أطراف" نفس سلسلة التنفيذ الجزئي (باستثناء order
    نفسه) وترجّع:

    - { blocked: false } لو مفيش أطراف تانية أصلاً (مش تنفيذ جزئي)،
      أو مفيش أي طرف من السلسلة لسه "pending" (يعني الأصناف الناقصة
      اتحسمت خلاص — سواء بقبول صيدلية تانية أو بإغلاقها نهائيًا
      market_unavailable).

    - { blocked: true, reason: "pending" } لو لسه فيه طرف من نفس
      السلسلة "pending" (يعني الأصناف الناقصة لسه معلقة، مفيش
      صيدلية قررت بشأنها لسه).

    ⚠️🆕 (إصلاح تعليق متبادل — Deadlock Fix): قبل كده كان فيه شرط
    إضافي هنا بيحجب لو "فيه طرف تاني اتعين له صيدلية (accepted/
    partial/closed) بس لسه ما وصلش لـ(خرج للتوصيل)". الشرط ده كان
    بيعمل تعليق متبادل حقيقي: لو A نفذت جزء وB نفذت الباقي، فـA
    كانت بتتحجب لحد ما B توصل "خرج للتوصيل"، وفي نفس الوقت B (من
    منظورها هي) كانت بتتحجب لحد ما A توصل "خرج للتوصيل" — فكلاهما
    يفضل محجوب للأبد ومحدش يقدر يتحرك أول واحد.

    بمجرد ما كل الأطراف اتعينت (مفيش pending)، كل صيدلية المفروض
    تقدر تدوس "خرج للتوصيل" في وقتها المستقل. رسالة الشحن الموحّدة
    (trySendCombinedShippingWebhook تحت) هي أصلاً المسؤولة عن
    الانتظار الفعلي لحد ما *كل* الأطراف المُعيّنة توصل فعليًا
    لـ"خرج للتوصيل" قبل ما تتبعت لشركة الشحن — فمفيش داعي لتكرار
    نفس الحماية على مستوى الزرار، وده كان سبب القفلة.
    ============================================================ */
async function computeChainShippingBlock(order) {
    const rootOrderId = order.rootOrderId || order.id;
    const chain = await getChainOrders(rootOrderId);
    const others = chain.filter((o) => String(o.id) !== String(order.id));

    if (!others.length) return { blocked: false };

    const stillPending = others.find((o) => normalizeStatus(o.status) === "pending");
    if (stillPending) return { blocked: true, reason: "pending" };

    return { blocked: false };
}

/* ============================================================
    🆕 buildUnavailableMessage — رسالة واحدة جاهزة للعميل بصيغة عادية
    ------------------------------------------------------------
    بتُستخدم في مكانين:
    1) لما صنف واحد يوصل لعتبة النقص (SHORTAGE_THRESHOLD) أثناء
       الـ Checklist بتاع التنفيذ الجزئي (POST /orders/:id/partial).
    2) لما طلب "فرعي" كامل (parentOrderId) يتقفل نهائيًا لأن
       SHORTAGE_THRESHOLD صيدليات مختلفة ضغطوا "غير متوفر في السوق"
       عليه (POST /orders/:id/unavailable).

    الرسالة بتتفحص هل فيه أي طرف تاني من نفس سلسلة الطلب (rootOrderId)
    فعلاً بيتحرك (accepted/partial/closed) — لو أه، تضيف جملة "باقي
    طلبك في الطريق إليك"، ولو لأ (الطلب كله كان بيدور على الصنف ده)
    تكتفي بالاعتذار من غير ما توهم العميل إن فيه حاجة جاية.
    itemLabels = مصفوفة نصوص جاهزة للعرض، زي ["علبة Panadol"].
    ============================================================ */
async function buildUnavailableMessage(rootOrderId, itemLabels) {
    const names = itemLabels.filter(Boolean);
    const itemsText = names.length ? names.join("، ") : "الصنف المطلوب";

    let hasProgress = false;
    try {
        const chain = await getChainOrders(rootOrderId);
        hasProgress = chain.some((o) => ["accepted", "partial", "closed"].includes(normalizeStatus(o.status)));
    } catch (e) {
        hasProgress = false;
    }

    const lines = [`عذرًا 💊 ${itemsText} غير متوفر حاليًا في مجموعة صيدلياتنا ولا بشكل عام في السوق حاليًا.`];
    if (hasProgress) lines.push("باقي طلبك في الطريق إليك 🚚");
    lines.push("شكرًا لتفهمك 💙");
    return lines.join("\n");
}

/* ============================================================
    🆕 trySendCombinedShippingWebhook — رسالة شحن واحدة موحّدة
    ------------------------------------------------------------
    بتُستدعى في كل مرة أي طرف من سلسلة الطلب يوصل لحالة
    "خرج للتوصيل"، وكمان (🆕) لحظة ما آخر طرف "pending" في السلسلة
    يتقفل بحالة "market_unavailable" — عشان لو صيدلية سبق ودوست
    "خرج للتوصيل" واستنت باقي السلسلة، الشحن ينطلق فورًا لحظة
    ما آخر طرف معلّق يتحسم، بدل ما يفضل عالق للأبد.

    الدالة بتتحقق:

    1) هل لسه فيه طرف من السلسلة "pending" (صيدلية تالتة لسه
       ماخدتش قرار، أو الطلب الأصلي لسه معلّق)؟ → لو أه، منستنى
       ومنبعتش حاجة لسه.
       (ملاحظة: "market_unavailable" مش "pending"، فمش بتوقف الشحن)

    2) هل كل الأطراف اللي فعلاً اتنفذت (accepted/partial/closed
       وعندها pharmacyId) وصلت لـ "خرج للتوصيل" (أو بعدها)؟
       → لو أي طرف لسه في "تجهيز/جاهز" ومحصلش يخرج للتوصيل،
       منستنى برضو.

    3) لو الشرطين اتحققوا: نحجز الإرسال عبر INSERT في
       shipping_notifications (محمي بـ UNIQUE على rootOrderId)،
       فلو حد تاني (نفس اللحظة بالضبط من طرف تاني) حاول يبعت في
       نفس الوقت، واحد بس ينجح يحجز ويبعت. وده كمان اللي بيمنع
       تكرار الإرسال لو الدالة اتنادت مرتين (مرة من PUT /orders/:id
       ومرة من إغلاق الطلب الفرعي).

    4) نجمع بيانات كل صيدلية (اسمها/عنوانها/تليفونها/المبلغ
       المطلوب تحصيله منها/الأدوية المتوفرة عندها) ونبعتهم في
       "pickups" جوه رسالة واحدة، والـ order_id فيها بيكون ثابت
       = rootOrderId (نفس رقم الأوردر الأصلي اللي شافه العميل)
       بغض النظر عن عدد الصيدليات.

    بترجع { sent: bool, waiting: bool } للـ logging بس.
    ============================================================ */
async function trySendCombinedShippingWebhook(rootOrderId) {
    const chain = await getChainOrders(rootOrderId);
    if (!chain.length) return { sent: false, waiting: false };

    const rootOrder = chain.find((o) => String(o.id) === String(rootOrderId)) || chain[0];

    // أطراف السلسلة اللي فعلاً اتنفذت عند صيدلية معينة
    const legs = chain.filter(
        (o) => o.pharmacyId && ["accepted", "partial", "closed"].includes(normalizeStatus(o.status))
    );

    // أي طرف لسه معلّق (صيدلية تالتة لسه ماخدتش قرار) — لازم نستنى
    // (طلب market_unavailable مش "pending" فمش بيتحسب هنا، وده مقصود:
    //  بمجرد ما آخر طرف معلّق يتقفل بـ market_unavailable أو rejected،
    //  السلسلة بقت "محسومة" من ناحية الانتظار)
    const unresolved = chain.filter((o) => normalizeStatus(o.status) === "pending");

    if (!legs.length || unresolved.length > 0) {
        return { sent: false, waiting: true };
    }

    // كل الأطراف المنفّذة لازم توصل "خرج للتوصيل" (أو بعدها: تسليم)
    const allLegsReady = legs.every(
        (o) => o.workflowStatus === "out_for_delivery" || o.workflowStatus === "delivered"
    );
    if (!allLegsReady) {
        return { sent: false, waiting: true };
    }

    // حجز الإرسال — race-safe عبر UNIQUE constraint على rootOrderId
    const claim = await db.run(
        `INSERT INTO shipping_notifications ("rootOrderId") VALUES ($1) ON CONFLICT ("rootOrderId") DO NOTHING`,
        [rootOrderId]
    );
    if (claim.changes === 0) {
        // حد تاني بعت الرسالة قبلنا بلحظات (أو الإرسال نجح قبل كده) — منبعتش تاني
        return { sent: false, waiting: false };
    }

    /* ⚠️🆕 (إصلاح Bug — لا يوجد Retry بعد فشل الإرسال):
       قبل كده كان الحجز فوق بيتثبّت نهائيًا حتى لو فشل الإرسال (مشكلة
       شبكة، n8n واقف، رابط غلط...) — فأي محاولة تالية كانت بترجع
       claim.changes === 0 وتتجاهل الإرسال للأبد، والطلب يفضل من غير
       رسالة شحن نهائيًا رغم إن حالته اتقفلت "out_for_delivery".
       الحل: try/catch حوالين الإرسال، ولو فشل نمسح الحجز فورًا عشان
       أي استدعاء تالي لنفس الدالة (تحديث تاني على أي طرف من السلسلة،
       أو محاولة يدوية) يقدر يعيد المحاولة من جديد. */
    // 🆕 لازم تتعرف برّا الـtry عشان تفضل متاحة تحت (تسجيل التايملاين)
    // حتى لو الإرسال فشل قبل ما يوصل لمرحلة بناء الـpayload
    let result;
    let pickups = [];
    let totalPrice = 0;

    try {
        for (const leg of legs) {
            const ph = await db.get(
                `SELECT "pharmacyName", address, phone FROM users WHERE id = $1`,
                [leg.pharmacyId]
            );
            const items = leg.availableItems
                ? (typeof leg.availableItems === "string" ? JSON.parse(leg.availableItems || "[]") : leg.availableItems)
                : resolveItems({ items: leg.items, rawItems: leg.items });

            pickups.push({
                order_id: String(leg.id),
                pharmacy_name: leg.pharmacyName || ph?.pharmacyName || "",
                pharmacy_address: ph?.address || "",
                pharmacy_phone: ph?.phone || "",
                amount_to_collect: leg.price || 0,
                items: Array.isArray(items) ? items.map((it) => (it && it.name ? it.name : it)) : [],
            });
        }

        totalPrice = pickups.reduce((sum, p) => sum + (Number(p.amount_to_collect) || 0), 0);

        const payload = {
            order_id: String(rootOrderId),          // 🔒 ثابت — نفس رقم الأوردر مهما كان عدد الصيدليات
            customer_name: rootOrder.customerName,
            customer_phone: rootOrder.phone,
            customer_address: rootOrder.address,
            pickup_count: pickups.length,           // 1 لو صيدلية واحدة، 2+ لو تنفيذ جزئي بين صيدليات
            pickups,                                // تفاصيل كل صيدلية بمبلغها المطلوب تحصيله
            total_price: totalPrice,                // إجمالي التحصيل من كل الصيدليات مجتمعة
        };

        result = await sendN8nWebhook(N8N_SHIPPING_WEBHOOK_URL, payload);
    } catch (err) {
        result = { ok: false, error: err.message };
    }

    if (!result.ok) {
        // 🆕 فشل الإرسال — نمسح الحجز عشان نسمح بإعادة المحاولة في أي
        // استدعاء تالي لنفس السلسلة، بدل ما تفضل رسالة الشحن دي مش
        // متبعتة للأبد
        await db.run(`DELETE FROM shipping_notifications WHERE "rootOrderId" = $1`, [rootOrderId]).catch(() => {});
    }

    // تسجيل نتيجة الإرسال في تايملاين كل الأطراف عشان يبان في تفاصيل كل طلب
    const noteText = result.ok
        ? `تم إبلاغ شركة الشحن — استلام من ${pickups.length} صيدلية بإجمالي ${totalPrice} جنيه`
        : `تعذر إبلاغ شركة الشحن (${result.error || result.status || "خطأ غير معروف"}) — سيُعاد المحاولة تلقائيًا`;
    const noteColor = result.ok ? "#0ea5e9" : "#dc2626";

    for (const leg of legs) {
        await db.run(
            `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
            [leg.id, noteText, noteColor]
        ).catch(() => {});
    }

    if (!result.ok) {
        console.error(`[Shipping Webhook ✗] فشل إبلاغ شركة الشحن للسلسلة #${rootOrderId} — رابط الإرسال: ${N8N_SHIPPING_WEBHOOK_URL}:`, result.error || result.status || result.body);
    } else {
        console.log(`[Shipping Webhook ✓] رسالة شحن موحّدة للسلسلة #${rootOrderId} — ${pickups.length} صيدلية`);
    }

    return { sent: result.ok, waiting: false };
}

/* ============================================================
    جلب جميع الطلبات
    ------------------------------------------------------------
    🆕 الطلبات اللي وصلت لحالة "market_unavailable" (طلب فرعي اتقفل
    نهائيًا بعد اعتذار SHORTAGE_THRESHOLD صيدليات مختلفة عن توفره)
    بتتستبعد تلقائيًا من القائمة العامة (من غير فلتر status محدد) —
    عشان تختفي فعلاً من كل الداشبورد (أدمن وصيادلة) زي ما هو مطلوب.
    لو حد محتاج يشوفها تحديدًا يقدر يستخدم ?status=market_unavailable
    ============================================================ */
router.get("/orders", async (req, res) => {
    try {
        await expireOverdueOrders();
        await expireStalePendingOrders();
        retryPendingShippingWebhooks().catch(() => {}); // لا ننتظرها — لا يجب أن تؤخر رد القائمة

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
        } else {
            query += ` WHERE o.status != 'market_unavailable'`;
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
    🆕 (تعديل) بعد إغلاق الطلب/الـ session عند "خرج للتوصيل"،
    بننادي trySendCombinedShippingWebhook(rootOrderId) عشان تتحقق
    هل كل الصيدليات المشتركة في نفس سلسلة الطلب وصلت لنفس المرحلة
    ولا لسه — ولو الكل جاهز، تبعت رسالة شحن واحدة موحّدة تجمع كل
    الصيدليات، بدل ما كل صيدلية تبعت رسالتها المستقلة بنفسها.

    🆕🆕 (حماية جديدة) قبل أي حاجة، لو الطلب اللي بيتحدّث بيحاول
    يوصل لـ workflowStatus = "out_for_delivery"، بنتأكد أولًا (عبر
    computeChainShippingBlock) إن مفيش طرف تاني من نفس سلسلة التنفيذ
    الجزئي لسه "pending" (معلّق فعليًا، مفيش صيدلية اتعينت له) —
    لو فيه، بنرفض الطلب بالكامل (409) ومنعملش أي تحديث في قاعدة
    البيانات، عشان الصيدلي منيعش يقفل طلبه أصلاً قبل ما باقي
    السلسلة تتحسم (أو تتقفل نهائيًا بعدم توفر السوق). ده تحصين على
    مستوى السيرفر بالإضافة لتعطيل الزرار في الفرونت إند (pages1.js)
    — حتى لو حصل تأخير مزامنة والزرار ظهر شغال بالغلط، الطلب هيترفض
    هنا برضو.

    ⚠️ الحجب هنا بيقتصر بس على وجود طرف "pending" (شوف
    computeChainShippingBlock فوق للتفاصيل وسبب إزالة شرط "طرف شغال
    لسه ما وصلش خرج للتوصيل" — كان بيعمل تعليق متبادل بين الصيدليات).
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

        if (workflowStatus === "out_for_delivery") {
            const currentOrder = await db.get(`SELECT id, "rootOrderId" FROM orders WHERE id = $1`, [id]);
            if (!currentOrder) {
                return res.status(404).json({ ok: false, error: "الطلب غير موجود" });
            }
            const chainBlock = await computeChainShippingBlock(currentOrder);
            if (chainBlock.blocked) {
                const message = "لسه في أصناف من نفس الطلب مستنية تتعين لصيدلية أخرى — استنى لحد ما تتحسم";
                return res.status(409).json({ ok: false, error: message, blockedByChain: true, reason: chainBlock.reason });
            }
        }

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
             RETURNING id, phone, "customerName", address, "rootOrderId"`,
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

        if (workflowStatus === "out_for_delivery" && updated && updated.phone) {
            try {
                await db.run(
                    `UPDATE customers SET session_status = 'CLOSED' WHERE phone_number = $1`,
                    [updated.phone]
                );

                const digitsOnly = updated.phone.replace(/\D/g, "");
                const remoteJidNumber = "20" + digitsOnly.slice(1);
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

        // 🆕 محاولة إرسال رسالة الشحن الموحّدة (مركزية بالكامل، مرة واحدة لكل سلسلة)
        if (workflowStatus === "out_for_delivery" && updated) {
            const rootOrderId = updated.rootOrderId || updated.id;
            trySendCombinedShippingWebhook(rootOrderId).catch((e) => {
                console.error("❌ خطأ في إرسال رسالة الشحن الموحدة:", e.message);
            });
        }

        res.json({ ok: true, message: "تم تحديث الطلب بنجاح" });
    } catch (err) {
        console.error("❌ خطأ في تحديث الطلب:", err.message);
        res.status(500).json({ ok: false, error: "فشل في تحديث الطلب" });
    }
});

/* ============================================================
    🆕 التنفيذ الجزئي (Partial Fulfillment + Order Splitting)
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

            const rootOrderId = order.rootOrderId || order.id;
            const executedAtValue = new Date().toISOString();

            await tx.run(
                `UPDATE orders
                 SET status = 'partial', "pharmacyId" = $1, "pharmacyName" = $2,
                     "availableItems" = $3, "unavailableItems" = $4, price = $5, notes = $6,
                     "workflowStatus" = 'received', "executionPending" = 0, "executionDeadline" = NULL,
                     "executionCompleted" = 0, "executionFailed" = 0, "executedAt" = $7,
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

            const shortageNow = [];
            const remainingForNewOrder = [];

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
                    // سبق التنبيه — يفضل مستبعد من أي طلب جديد
                } else {
                    remainingForNewOrder.push({ name, unit });
                }
            }

            for (const shortItem of shortageNow) {
                await tx.run(
                    `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                    [id, `تم إبلاغ العميل بنفاد "${shortItem.name}" من السوق (اعتذرت عنه ${SHORTAGE_THRESHOLD} صيدليات مختلفة)`, "#dc2626"]
                );
            }

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
                await tx.run(
                    `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                    [id, `كل الأصناف الناقصة أصبحت مُبلّغ عنها كنفاد من السوق — لا يوجد طلب جديد`, "#dc2626"]
                );
            }

            return { order, rootOrderId, shortageNow, childOrderId };
        });

        /* 🆕 كل رسالة نقص هنا بقت بتحمل حقل "message" جاهز (نفس صيغة رسالة
           إغلاق الطلب الفرعي بالكامل تحت في /unavailable) عشان الـ n8n
           يبقى بس محتاج يبعت body.message لـ body.phone من غير أي تركيب
           نص إضافي من جهته — نفس الـ webhook ونفس شكل النداء للحالتين */
        for (const shortItem of txResult.shortageNow) {
            const label = shortItem.unit ? `${shortItem.unit} ${shortItem.name}` : shortItem.name;
            const message = await buildUnavailableMessage(txResult.rootOrderId, [label]);
            sendN8nWebhook(N8N_SHORTAGE_WEBHOOK_URL, {
                type: "medicine_out_of_stock",
                order_id: id,
                root_order_id: txResult.rootOrderId,
                phone: txResult.order.phone,
                customer_name: txResult.order.customerName,
                medicine_name: shortItem.name,
                message,
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
    🆕 الإبلاغ عن عدم توفر طلب "فرعي" (ناتج عن تنفيذ جزئي سابق) في السوق
    ------------------------------------------------------------
    البوتن الرابع في تفاصيل الطلب — بيظهر بس على الطلبات اللي عندها
    parentOrderId (أصناف ناقصة أُعيد طرحها بعد تنفيذ جزئي سابق).

    الحساب هنا على مستوى "الطلب نفسه" — مش على مستوى كل صنف لوحده
    زي /partial. يعني بمجرد ما SHORTAGE_THRESHOLD (5 افتراضيًا)
    صيدليات مختلفة يضغطوا البوتن ده على نفس الطلب، الطلب ده بيتقفل
    نهائيًا بحالة جديدة "market_unavailable" (بغض النظر عن إجمالي
    عدد الصيادلة النشطين)، ويختفي فورًا من كل القوائم (GET /orders
    بيستبعدها افتراضيًا)، ويتبعت webhook واحد للعميل فيه رسالة
    جاهزة تقول إن الأصناف دي مش متوفرة وباقي الطلب (لو فيه تقدم في
    أي طرف تاني من السلسلة) في الطريق.

    لو عدد الصيادلة النشطين أقل من SHORTAGE_THRESHOLD والكل اعتذر
    قبل ما يوصل العدد للعتبة، الطلب بيتحول لـ "rejected" العادي
    (بيفضل ظاهر في تبويب "المرفوضة") بدل ما يفضل عالق pending للأبد.

    🆕 (إصلاح الشحن المعلّق): لما الطلب الفرعي ده يوصل لـ
    "market_unavailable"، ده معناه إن آخر أصناف ناقصة من السلسلة
    خلاص اتحسمت (مفيش صيدلية هتقدر تنفذها). لو ده كان آخر طرف
    "pending" في السلسلة (مفيش طرف تاني لسه معلّق)، فده يعني إن
    باقي أطراف السلسلة (اللي فعلاً نفّذوا زي الصيدلية الأولانية
    اللي عملت التنفيذ الجزئي) بقوا أحرار يبعتوا الطلب لشركة الشحن
    من غير ما يستنوا حاجة تانية. عشان كده:
    1) بنسجّل سطر تايملاين واضح لكل صيدلية من دول تقولها إنها تقدر
       تبعت الطلب لشركة الشحن دلوقتي.
    2) بننادي trySendCombinedShippingWebhook تاني على نفس السلسلة —
       فلو كانت صيدلية زي دي خلاص دوست "خرج للتوصيل" واستنت، الشحن
       هيتبعت فورًا (والدالة نفسها race-safe وما بتكررش الإرسال).
    ============================================================ */
router.post("/orders/:id/unavailable", async (req, res) => {
    try {
        const { id } = req.params;
        const { pharmacyId, pharmacyName } = req.body;

        if (!pharmacyId || !pharmacyName) {
            return res.status(400).json({ ok: false, error: "بيانات الصيدلية مطلوبة" });
        }

        const txResult = await db.withTransaction(async (tx) => {
            const order = await tx.get(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [id]);
            if (!order) {
                const e = new Error("الطلب غير موجود");
                e.httpStatus = 404;
                throw e;
            }
            if (normalizeStatus(order.status) !== "pending") {
                const e = new Error("لم يعد هذا الطلب متاحًا");
                e.httpStatus = 409;
                throw e;
            }
            if (!order.parentOrderId) {
                const e = new Error("هذا الإجراء متاح فقط للطلبات الناتجة عن تنفيذ جزئي");
                e.httpStatus = 400;
                throw e;
            }

            let rejectedBy = order.rejectedBy
                ? (typeof order.rejectedBy === "string" ? JSON.parse(order.rejectedBy) : order.rejectedBy)
                : [];
            if (rejectedBy.includes(pharmacyId)) {
                const e = new Error("سبق أن أبلغت عن هذا الطلب");
                e.httpStatus = 409;
                throw e;
            }
            rejectedBy.push(pharmacyId);

            const rootOrderId = order.rootOrderId || order.id;
            const items = resolveItems({ items: order.items, rawItems: order.items });

            // نسجّل بلاغ نقص لكل صنف (للإحصائيات في صفحة shortages فقط —
            // القرار النهائي هنا مبني على عدد بلاغات "الطلب" ده مش كل صنف)
            for (const item of items) {
                if (!item.name) continue;
                await tx.run(
                    `INSERT INTO medicine_shortage_reports ("rootOrderId", medicine_name, "pharmacyId")
                     VALUES ($1, $2, $3)
                     ON CONFLICT ("rootOrderId", medicine_name, "pharmacyId") DO NOTHING`,
                    [rootOrderId, item.name, pharmacyId]
                );
            }

            const reachedThreshold = rejectedBy.length >= SHORTAGE_THRESHOLD;

            let newStatus;
            if (reachedThreshold) {
                newStatus = "market_unavailable";
            } else {
                const activePharmacists = await tx.all(
                    `SELECT id FROM users WHERE role = 'pharmacist' AND status = 'active'`
                );
                const allRejected = activePharmacists.every((p) => rejectedBy.includes(p.id));
                newStatus = allRejected ? "rejected" : "pending";
            }

            await tx.run(
                `UPDATE orders SET "rejectedBy" = $1::jsonb, status = $2, "updatedAt" = NOW() WHERE id = $3`,
                [JSON.stringify(rejectedBy), newStatus, id]
            );

            await tx.run(
                `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                [id, `أبلغت ${pharmacyName} عن عدم توفر الطلب في السوق (${rejectedBy.length}/${SHORTAGE_THRESHOLD})`, "#dc2626"]
            );

            // 🆕 أطراف السلسلة اللي هتتفتح لها إمكانية الشحن فورًا (لو ده كان
            // آخر طرف معلّق في السلسلة) — بنحسبها هنا جوه نفس الـ transaction
            // عشان تبقى متسقة مع حالة الطلبات وقت القفل بالظبط
            let unblockedLegIds = [];
            let shouldRetryShipping = false;

            if (reachedThreshold) {
                await tx.run(
                    `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                    [id, `تم إغلاق الطلب نهائيًا — اعتذرت ${SHORTAGE_THRESHOLD} صيدليات مختلفة عن توفره، وتم إبلاغ العميل`, "#dc2626"]
                );

                // هل لسه فيه أي طرف تاني "pending" في نفس السلسلة؟
                const chainAfter = await tx.all(
                    `SELECT * FROM orders WHERE id = $1 OR "rootOrderId" = $1`,
                    [rootOrderId]
                );
                const stillUnresolved = chainAfter.some(
                    (o) => String(o.id) !== String(id) && normalizeStatus(o.status) === "pending"
                );

                if (!stillUnresolved) {
                    shouldRetryShipping = true;
                    // الأطراف اللي فعلاً نفّذت (عندها صيدلية) ولسه ما خرجتش
                    // للتوصيل — دول اللي محتاجين يعرفوا إنهم بقوا أحرار يشحنوا
                    const legsToNotify = chainAfter.filter((o) =>
                        String(o.id) !== String(id) &&
                        o.pharmacyId &&
                        ["accepted", "partial", "closed"].includes(normalizeStatus(o.status)) &&
                        !["out_for_delivery", "delivered", "cancelled"].includes(o.workflowStatus)
                    );
                    for (const leg of legsToNotify) {
                        unblockedLegIds.push(leg.id);
                        await tx.run(
                            `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                            [leg.id, "تعذّر توفير باقي أصناف الطلب من أي صيدلية أخرى في السوق — يمكنك الآن إرسال الطلب لشركة الشحن مباشرة", "#0ea5e9"]
                        );
                    }
                }
            } else if (newStatus === "rejected") {
                await tx.run(
                    `INSERT INTO order_timeline ("orderId", at, text, color) VALUES ($1, NOW(), $2, $3)`,
                    [id, "لم يتمكن أي صيدلي من التنفيذ", "#ef4444"]
                );
            }

            return {
                order, rootOrderId, items, reachedThreshold,
                rejectedCount: rejectedBy.length,
                unblockedLegIds, shouldRetryShipping,
            };
        });

        let itemLabels = [];
        if (txResult.reachedThreshold) {
            itemLabels = txResult.items.map((it) => (it.unit ? `${it.unit} ${it.name}` : it.name)).filter(Boolean);
            const message = await buildUnavailableMessage(txResult.rootOrderId, itemLabels);

            sendN8nWebhook(N8N_SHORTAGE_WEBHOOK_URL, {
                type: "order_market_unavailable",
                order_id: id,
                root_order_id: txResult.rootOrderId,
                phone: txResult.order.phone,
                customer_name: txResult.order.customerName,
                medicines: itemLabels,
                message,
            }).then((r) => {
                if (!r.ok) console.error(`[Shortage Webhook ✗] فشل إبلاغ العميل بإغلاق الطلب #${id}:`, r.error || r.body);
                else console.log(`[Shortage Webhook ✓] تم إبلاغ العميل بإغلاق الطلب #${id} نهائيًا (${itemLabels.join("، ")})`);
            });
        }

        // 🆕 لو ده كان آخر طرف معلّق في السلسلة، نحاول نبعت رسالة الشحن
        // الموحّدة فورًا — لو صيدلية زي الصيدلية الأولانية كانت خلاص
        // دوست "خرج للتوصيل" واستنت باقي السلسلة، الشحن هيتبعت دلوقتي
        // من غير ما تحتاج تعمل أي حاجة تانية (والدالة race-safe فمش
        // هتتكرر لو كانت اتبعتت قبل كده لأي سبب)
        if (txResult.shouldRetryShipping) {
            trySendCombinedShippingWebhook(txResult.rootOrderId).catch((e) => {
                console.error("❌ خطأ في إرسال الشحن بعد إغلاق طلب فرعي (market_unavailable):", e.message);
            });
        }

        res.json({
            ok: true,
            marketUnavailable: txResult.reachedThreshold,
            rejectedCount: txResult.rejectedCount,
            threshold: SHORTAGE_THRESHOLD,
            shortageAlerts: itemLabels,
            unblockedOrders: txResult.unblockedLegIds.map((x) => String(x)),
        });
    } catch (err) {
        const status = err.httpStatus || 500;
        if (status === 500) {
            console.error("❌ خطأ في الإبلاغ عن عدم توفر السوق:", err.message);
            return res.status(500).json({ ok: false, error: "فشل في تنفيذ العملية" });
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
    ------------------------------------------------------------
    🆕 نفس منطق GET /orders — الطلبات "market_unavailable" مستبعدة
    من كل الأعداد (بما فيها total) عشان تختفي تمامًا من أي إحصائية
    ظاهرة في الداشبورد.
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
            WHERE status != 'market_unavailable'
        `);

        const result = stats || { total: 0, pending: 0, accepted: 0, partial: 0, rejected: 0 };
        res.json({ ok: true, stats: result });
    } catch (err) {
        console.error("❌ خطأ في جلب الإحصائيات:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب الإحصائيات" });
    }
});

/* ============================================================
    الأدوية الأكثر طلبًا
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
    الأصناف الناقصة من السوق حسب سلسلة طلب معينة
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
    ------------------------------------------------------------
    🆕 (تعديل مهم) الإرسال الفعلي بقى مركزي بالكامل داخل
    PUT /orders/:id (وكمان POST /orders/:id/unavailable عند إغلاق
    آخر طرف معلّق في السلسلة) عبر trySendCombinedShippingWebhook —
    عشان يجمع كل الصيدليات المشتركة في نفس سلسلة الطلب (تنفيذ جزئي)
    في رسالة واحدة بس لشركة الشحن، بدل ما كل صيدلية تبعت رسالتها
    المستقلة بنفسها لحظة ما تدوس "خرج للتوصيل".

    المسار ده باقي موجود بس للتوافق الرجعي مع نداء الفرونت إند
    القديم (App.webhook.sendStatusUpdate في store.js لسه بينادي
    عليه بعد كل "خرج للتوصيل")، وبيرجع نجاح فورًا من غير أي إرسال
    تاني — عشان الرسالة الموحّدة اللي بعتها PUT /orders/:id
    فعلاً متتكررش أو تتبعت مرتين بمحتوى مختلف.
    ============================================================ */
router.post("/webhook/shipping", async (req, res) => {
    res.json({ ok: true, message: "تم الاستلام — الإرسال الفعلي مركزي داخل السيرفر (رسالة موحّدة لكل الصيدليات)" });
});

module.exports = router;
