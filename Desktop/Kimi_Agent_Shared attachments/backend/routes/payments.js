/* ============================================================
   payments.js — مسارات إيصالات الدفع (اشتراك الصيدليات)
   ------------------------------------------------------------
   - الصيدلي: يرفع إيصال دفع (صورة + مبلغ + ملاحظات) لفترة معيّنة
     (شهر تلقائيًا، أو أي "period" تبعته من الفرونت).
   - الأدمين: يشوف كل الإيصالات، يقبل أو يرفض، وفي حالة الرفض
     يقدر "يبند" الصيدلية (status = suspended) في نفس الخطوة.
   - /payments/status: نظرة عامة على كل الصيدليات لفترة معينة —
     مين دفع (accepted) / مين لسه في المراجعة (pending) / مين
     اتُرفض إيصاله (rejected) / مين لسه ما بعتش خالص (not_submitted).
     🆕 دلوقتي بترجع كمان phone و address لكل صيدلية عشان تتعرض
     في صفحة "طلبات الدفع" بالأدمين.
   ============================================================ */
const express = require("express");
const router = express.Router();
const db = require("../db/database");

function currentPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeReceiptStatus(status) {
    const allowed = ["pending", "accepted", "rejected"];
    return allowed.includes(status) ? status : "pending";
}

/* ============================================================
   رفع إيصال دفع جديد (صيدلي)
   body: { pharmacyId, pharmacyName, image (base64), amount?, notes?, period? }
   ============================================================ */
router.post("/payments/receipts", async (req, res) => {
    try {
        const { pharmacyId, pharmacyName, image, amount, notes, period } = req.body;

        if (!pharmacyId || !pharmacyName || !image) {
            return res.status(400).json({ ok: false, error: "بيانات الإيصال غير مكتملة (الصيدلية والصورة مطلوبة)" });
        }

        const usedPeriod = period || currentPeriod();

        const result = await db.get(
            `INSERT INTO payment_receipts
                ("pharmacyId", "pharmacyName", image, amount, notes, period, status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW())
             RETURNING id`,
            [pharmacyId, pharmacyName, image, amount || null, notes || null, usedPeriod]
        );

        res.json({ ok: true, id: result.id, period: usedPeriod });
    } catch (err) {
        console.error("❌ خطأ في رفع إيصال الدفع:", err.message);
        res.status(500).json({ ok: false, error: "فشل في رفع الإيصال" });
    }
});

/* ============================================================
   إيصالات صيدلية معينة (يستخدمها الصيدلي لمتابعة سجله)
   ============================================================ */
router.get("/payments/receipts/mine/:pharmacyId", async (req, res) => {
    try {
        const { pharmacyId } = req.params;
        const rows = await db.all(
            `SELECT * FROM payment_receipts WHERE "pharmacyId" = $1 ORDER BY "createdAt" DESC`,
            [pharmacyId]
        );
        res.json({ ok: true, receipts: rows });
    } catch (err) {
        console.error("❌ خطأ في جلب إيصالات الصيدلية:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب الإيصالات" });
    }
});

/* ============================================================
   كل الإيصالات (أدمين) — فلترة اختيارية بالحالة و/أو الفترة
   GET /payments/receipts?status=pending&period=2026-09
   ============================================================ */
router.get("/payments/receipts", async (req, res) => {
    try {
        const { status, period } = req.query;
        let query = `SELECT * FROM payment_receipts WHERE 1=1`;
        const params = [];

        if (status) {
            params.push(normalizeReceiptStatus(status));
            query += ` AND status = $${params.length}`;
        }
        if (period) {
            params.push(period);
            query += ` AND period = $${params.length}`;
        }
        query += ` ORDER BY "createdAt" DESC`;

        const rows = await db.all(query, params);
        res.json({ ok: true, receipts: rows });
    } catch (err) {
        console.error("❌ خطأ في جلب إيصالات الدفع:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب الإيصالات" });
    }
});

/* ============================================================
   قبول إيصال (أدمين)
   ============================================================ */
router.post("/payments/receipts/:id/accept", async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewedBy } = req.body;

        const receipt = await db.get(`SELECT * FROM payment_receipts WHERE id = $1`, [id]);
        if (!receipt) return res.status(404).json({ ok: false, error: "الإيصال غير موجود" });

        await db.run(
            `UPDATE payment_receipts SET status = 'accepted', "reviewedBy" = $1, "updatedAt" = NOW() WHERE id = $2`,
            [reviewedBy || null, id]
        );

        res.json({ ok: true, id });
    } catch (err) {
        console.error("❌ خطأ في قبول الإيصال:", err.message);
        res.status(500).json({ ok: false, error: "فشل في قبول الإيصال" });
    }
});

/* ============================================================
   رفض إيصال (أدمين) — مع خيار بند الصيدلية في نفس الخطوة
   body: { reviewedBy, reviewNotes?, banPharmacy: boolean }
   ============================================================ */
router.post("/payments/receipts/:id/reject", async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewedBy, reviewNotes, banPharmacy } = req.body;

        const receipt = await db.get(`SELECT * FROM payment_receipts WHERE id = $1`, [id]);
        if (!receipt) return res.status(404).json({ ok: false, error: "الإيصال غير موجود" });

        await db.run(
            `UPDATE payment_receipts SET status = 'rejected', "reviewedBy" = $1, "reviewNotes" = $2, "updatedAt" = NOW() WHERE id = $3`,
            [reviewedBy || null, reviewNotes || null, id]
        );

        if (banPharmacy && receipt.pharmacyId) {
            await db.run(
                `UPDATE users SET status = 'suspended', "updatedAt" = NOW() WHERE id = $1`,
                [receipt.pharmacyId]
            );
        }

        res.json({ ok: true, id, banned: !!banPharmacy });
    } catch (err) {
        console.error("❌ خطأ في رفض الإيصال:", err.message);
        res.status(500).json({ ok: false, error: "فشل في رفض الإيصال" });
    }
});

/* ============================================================
   نظرة عامة على حالة الدفع لكل الصيدليات في فترة معينة (أدمين)
   GET /payments/status?period=2026-09  (افتراضيًا: الشهر الحالي)
   ------------------------------------------------------------
   بترجع كل صيدلي مع حالته: accepted / pending / rejected /
   not_submitted، بالإضافة لملخص أعداد جاهز للعرض في كروت.

   🆕 دلوقتي بترجع كمان: responsibleName (اسم المسؤول)، phone،
   address — عشان صفحة "طلبات الدفع" تقدر تعرض بيانات الصيدلية
   كاملة تحت اسمها، مش الاسم لوحده بس.
   ============================================================ */
router.get("/payments/status", async (req, res) => {
    try {
        const period = req.query.period || currentPeriod();

        const pharmacists = await db.all(
            `SELECT id, "pharmacyName", name, phone, address, status AS "accountStatus"
             FROM users WHERE role = 'pharmacist' ORDER BY "pharmacyName" ASC`
        );

        const receipts = await db.all(
            `SELECT DISTINCT ON ("pharmacyId") *
             FROM payment_receipts
             WHERE period = $1
             ORDER BY "pharmacyId", "createdAt" DESC`,
            [period]
        );
        const receiptMap = {};
        receipts.forEach((r) => { receiptMap[r.pharmacyId] = r; });

        const result = pharmacists.map((p) => {
            const r = receiptMap[p.id];
            return {
                pharmacyId: p.id,
                pharmacyName: p.pharmacyName || p.name,
                responsibleName: p.name || null,
                phone: p.phone || null,
                address: p.address || null,
                accountStatus: p.accountStatus,
                paymentStatus: r ? r.status : "not_submitted",
                receiptId: r ? r.id : null,
                lastSubmittedAt: r ? r.createdAt : null,
            };
        });

        const summary = {
            total: result.length,
            paid: result.filter((r) => r.paymentStatus === "accepted").length,
            pending: result.filter((r) => r.paymentStatus === "pending").length,
            rejected: result.filter((r) => r.paymentStatus === "rejected").length,
            notSubmitted: result.filter((r) => r.paymentStatus === "not_submitted").length,
        };

        res.json({ ok: true, period, summary, pharmacies: result });
    } catch (err) {
        console.error("❌ خطأ في جلب حالة الدفع:", err.message);
        res.status(500).json({ ok: false, error: "فشل في جلب حالة الدفع" });
    }
});

module.exports = router;
