/* ============================================================
   pages5.js — صفحات الدفع
   ------------------------------------------------------------
   - App.pages.payments        → صفحة "المدفوعات" (صيدلي): رفع
     إيصال دفع ومتابعة حالته.
   - App.pages.paymentRequests → صفحة "طلبات الدفع" (أدمين): مراجعة
     الإيصالات (قبول/رفض + بند اختياري) وعرض مين دفع ومين لسه.
   ------------------------------------------------------------
   ⚠️ ملحوظة: الصفحة دي بتنادي App.api مباشرة (مش store.js) عشان
   ماكانش عندي محتوى store.js/ui.js وقت الكتابة. الكلاسات زي
   .card/.btn/.small/.muted/.bold مأخوذة من نفس الأنماط المستخدمة
   في app.js — راجعها بسرعة بعد التركيب وعدّل أي كلاس مايتماشاش مع
   style.css عندك.

   🆕 تعديلات:
   1) صورة الإيصال بقت بتتفتح في lightbox (بلور + X للإغلاق) بدل
      ما تفتح تاب جديد بـ window.open — عن طريق App.ui.imageLightbox
      الموجودة في ui.js، مع event delegation على document زي نفس
      أسلوب pages4.js.
   2) سيرش بار في صفحة "طلبات الدفع" (الأدمين) للبحث باسم الصيدلية/
      المسؤول/الهاتف/العنوان، وبيفلتر الليستات التلاتة (قيد المراجعة
      / لم تدفع بعد / كل الصيدليات) بشكل حي.
   3) كل صيدلية في صفحة "طلبات الدفع" بقت بتعرض اسم المسؤول والهاتف
      والعنوان تحت اسم الصيدلية مباشرة، مش اسم الصيدلية لوحده بس.
   ============================================================ */
window.App = window.App || {};
window.App.pages = window.App.pages || {};

(function () {
    const { icon, esc, toast, timeAgo } = App.ui;

    // 🆕 نص البحث الحالي في صفحة "طلبات الدفع" — بيفضل محفوظ لو
    // الصفحة اتعادت رسمها (refresh) في نفس الزيارة
    let paymentRequestsSearchQuery = "";

    /* ============================================================
       🆕 event delegation عام على document لفتح صورة أي إيصال دفع
       في lightbox (بلور للخلفية + زرار X للإغلاق) بدل ما تفتح في
       تاب جديد. بتشتغل مع أي عنصر عليه data-receipt-zoom مهما كانت
       الصفحة اتعادت رسمها، وبتتسجل مرة واحدة بس عند تحميل السكريبت.
       ============================================================ */
    document.addEventListener("click", (e) => {
        const zoomEl = e.target.closest("[data-receipt-zoom]");
        if (zoomEl) {
            e.preventDefault();
            e.stopPropagation();
            App.ui.imageLightbox(zoomEl.dataset.image, zoomEl.dataset.name || "");
        }
    });

    function badge(text, color) {
        return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;color:#fff;background:${color};white-space:nowrap">${text}</span>`;
    }

    const STATUS_META = {
        accepted: { text: "تم القبول", color: "#10b981" },
        pending: { text: "قيد المراجعة", color: "#f59e0b" },
        rejected: { text: "مرفوض", color: "#ef4444" },
        not_submitted: { text: "لم يُرسل بعد", color: "#94a3b8" },
    };

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 🆕 دالة مساعدة لبناء نص قابل للبحث لصف صيدلية معين (اسم
    // الصيدلية + اسم المسؤول + الهاتف + العنوان)
    function buildPharmacySearchBlob(p) {
        return [p.pharmacyName, p.responsibleName, p.phone, p.address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
    }

    // 🆕 سطر بيانات الصيدلية (المسؤول + الهاتف + العنوان) بيتكرر في
    // أكتر من مكان في صفحة "طلبات الدفع"، فبنينا دالة واحدة بتطلعه
    function pharmacyMetaLines(p) {
        return `
            ${p.responsibleName ? `<div class="small muted">${esc(p.responsibleName)}</div>` : ""}
            ${p.phone ? `<div class="small muted" style="display:flex;align-items:center;gap:4px;margin-top:2px">${icon("phone", 12)} ${esc(p.phone)}</div>` : ""}
            ${p.address ? `<div class="small muted" style="display:flex;align-items:center;gap:4px">${icon("pin", 12)} ${esc(p.address)}</div>` : ""}
        `;
    }

    /* ============================================================
       صفحة "المدفوعات" — الصيدلي
       ============================================================ */
    App.pages.payments = {
        title: "المدفوعات",
        crumb: "رفع إيصال الاشتراك ومتابعة حالته",
        roles: ["pharmacist"],
        render() {
            return `
                <div style="display:grid;gap:18px;max-width:640px">
                    <div class="card" style="padding:18px">
                        <div class="bold" style="font-size:16px;margin-bottom:10px">رفع إيصال دفع جديد</div>
                        <div id="pay-current-status" class="small muted" style="margin-bottom:14px">جاري التحميل...</div>
                        <form id="pay-form">
                            <label class="small bold" style="display:block;margin-bottom:6px">صورة الإيصال</label>
                            <input type="file" id="pay-image" accept="image/*" required style="margin-bottom:12px;display:block" />
                            <div id="pay-preview" style="margin-bottom:12px"></div>
                            <label class="small bold" style="display:block;margin-bottom:6px">المبلغ (اختياري)</label>
                            <input type="number" id="pay-amount" style="margin-bottom:12px;width:100%;padding:9px;border-radius:8px;border:1px solid var(--line)" placeholder="مثال: 500" />
                            <label class="small bold" style="display:block;margin-bottom:6px">ملاحظات (اختياري)</label>
                            <textarea id="pay-notes" style="margin-bottom:14px;width:100%;min-height:70px;padding:9px;border-radius:8px;border:1px solid var(--line)"></textarea>
                            <button type="submit" class="btn btn-soft btn-block" id="pay-submit-btn">إرسال الإيصال</button>
                        </form>
                    </div>
                    <div class="card" style="padding:18px">
                        <div class="bold" style="font-size:16px;margin-bottom:10px">سجل إيصالاتي</div>
                        <div id="pay-history">جاري التحميل...</div>
                    </div>
                </div>`;
        },
        async mount(user) {
            const historyEl = document.getElementById("pay-history");
            const statusEl = document.getElementById("pay-current-status");

            async function refresh() {
                const res = await App.api.payments.myReceipts(user.id);
                const receipts = res.receipts || [];

                const latest = receipts[0];
                if (latest) {
                    const st = STATUS_META[latest.status] || STATUS_META.pending;
                    statusEl.innerHTML = `آخر إيصال بتاريخ ${timeAgo(latest.createdAt)} — ${badge(st.text, st.color)}`;
                } else {
                    statusEl.textContent = "لم يتم إرسال أي إيصال بعد لهذه الفترة.";
                }

                historyEl.innerHTML = receipts.length
                    ? receipts.map((r) => {
                        const st = STATUS_META[r.status] || STATUS_META.pending;
                        return `
                            <div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
                                <img src="${r.image}"
                                     style="width:52px;height:52px;object-fit:cover;border-radius:8px;cursor:zoom-in"
                                     data-receipt-zoom
                                     data-image="${r.image}"
                                     data-name="${esc(r.period)}" />
                                <div style="flex:1;min-width:0">
                                    <div class="small bold">${esc(r.period)}${r.amount ? " — " + r.amount + " جنيه" : ""}</div>
                                    <div class="small muted">${timeAgo(r.createdAt)}${r.reviewNotes ? " — " + esc(r.reviewNotes) : ""}</div>
                                </div>
                                ${badge(st.text, st.color)}
                            </div>`;
                    }).join("")
                    : `<div class="small muted">لا يوجد سجل بعد</div>`;
            }

            document.getElementById("pay-image").addEventListener("change", async (e) => {
                const file = e.target.files[0];
                const preview = document.getElementById("pay-preview");
                if (!file) { preview.innerHTML = ""; return; }
                const base64 = await fileToBase64(file);
                preview.innerHTML = `<img src="${base64}" style="max-width:180px;border-radius:8px" />`;
            });

            document.getElementById("pay-form").addEventListener("submit", async (e) => {
                e.preventDefault();
                const fileInput = document.getElementById("pay-image");
                const file = fileInput.files[0];
                if (!file) { toast("خطأ", "من فضلك ارفع صورة الإيصال", "warning"); return; }

                const btn = document.getElementById("pay-submit-btn");
                btn.disabled = true;
                btn.textContent = "جارٍ الإرسال...";

                try {
                    const base64 = await fileToBase64(file);
                    const amount = document.getElementById("pay-amount").value;
                    const notes = document.getElementById("pay-notes").value;

                    const res = await App.api.payments.submitReceipt({
                        pharmacyId: user.id,
                        pharmacyName: user.pharmacyName || user.name,
                        image: base64,
                        amount: amount ? Number(amount) : null,
                        notes,
                    });

                    if (res.ok) {
                        toast("تم الإرسال", "سيتم مراجعة الإيصال من الإدارة قريبًا", "success");
                        e.target.reset();
                        document.getElementById("pay-preview").innerHTML = "";
                        refresh();
                    } else {
                        toast("خطأ", res.error || "فشل إرسال الإيصال", "warning");
                    }
                } catch (err) {
                    toast("خطأ", "فشل إرسال الإيصال", "warning");
                } finally {
                    btn.disabled = false;
                    btn.textContent = "إرسال الإيصال";
                }
            });

            refresh();
        },
    };

    /* ============================================================
       صفحة "طلبات الدفع" — الأدمين
       ============================================================ */
    App.pages.paymentRequests = {
        title: "طلبات الدفع",
        crumb: "مراجعة إيصالات الاشتراك وحالة الصيدليات",
        roles: ["admin"],
        render() {
            return `
                <div style="display:grid;gap:18px">
                    <!-- 🆕 سيرش بار للبحث عن الصيدليات (بالاسم / المسؤول / الهاتف / العنوان) -->
                    <div class="pay-search-bar" style="position:relative;max-width:420px">
                        <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;display:flex">${icon("search", 16)}</span>
                        <input
                            type="text"
                            id="pay-search-input"
                            class="input"
                            style="padding-right:38px"
                            placeholder="ابحث باسم الصيدلية أو المسؤول أو الهاتف أو العنوان..."
                            autocomplete="off"
                        />
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px" id="pay-summary"></div>

                    <div class="card" style="padding:18px">
                        <div class="bold" style="font-size:16px;margin-bottom:10px">إيصالات قيد المراجعة</div>
                        <div id="pay-pending-list">جاري التحميل...</div>
                        <div class="small muted" id="pay-pending-empty-search" style="display:none;padding:10px 0">لا توجد نتائج مطابقة لبحثك في هذه القائمة</div>
                    </div>

                    <div class="card" style="padding:18px">
                        <div class="bold" style="font-size:16px;margin-bottom:10px">الصيدليات التي لم تدفع بعد</div>
                        <div id="pay-unpaid-list">جاري التحميل...</div>
                        <div class="small muted" id="pay-unpaid-empty-search" style="display:none;padding:10px 0">لا توجد نتائج مطابقة لبحثك في هذه القائمة</div>
                    </div>

                    <div class="card" style="padding:18px">
                        <div class="bold" style="font-size:16px;margin-bottom:10px">كل الصيدليات — حالة الفترة الحالية</div>
                        <div id="pay-all-list">جاري التحميل...</div>
                        <div class="small muted" id="pay-all-empty-search" style="display:none;padding:10px 0">لا توجد نتائج مطابقة لبحثك في هذه القائمة</div>
                    </div>
                </div>`;
        },
        async mount(user) {
            const summaryEl = document.getElementById("pay-summary");
            const pendingEl = document.getElementById("pay-pending-list");
            const unpaidEl = document.getElementById("pay-unpaid-list");
            const allEl = document.getElementById("pay-all-list");
            const searchInput = document.getElementById("pay-search-input");

            function summaryCard(label, value, color) {
                return `<div class="card" style="padding:14px;text-align:center">
                    <div style="font-size:22px;font-weight:800;color:${color}">${value}</div>
                    <div class="small muted">${label}</div>
                </div>`;
            }

            /* 🆕 فلترة حيّة للصفوف اللي عليها data-search جوه الحاويات
               التلاتة، على نص البحث الحالي. بتتنادى بعد كل refresh()
               وكمان لايف مع الكتابة في حقل البحث. */
            function applySearchFilter() {
                const q = paymentRequestsSearchQuery.trim().toLowerCase();

                [
                    { container: pendingEl, emptyId: "pay-pending-empty-search" },
                    { container: unpaidEl, emptyId: "pay-unpaid-empty-search" },
                    { container: allEl, emptyId: "pay-all-empty-search" },
                ].forEach(({ container, emptyId }) => {
                    const rows = Array.from(container.querySelectorAll("[data-search]"));
                    let visibleCount = 0;
                    rows.forEach((row) => {
                        const hay = row.dataset.search || "";
                        const isMatch = q === "" || hay.includes(q);
                        row.style.display = isMatch ? "" : "none";
                        if (isMatch) visibleCount++;
                    });
                    const emptyEl = document.getElementById(emptyId);
                    if (emptyEl) {
                        emptyEl.style.display = (q !== "" && rows.length > 0 && visibleCount === 0) ? "" : "none";
                    }
                });
            }

            if (searchInput) {
                searchInput.value = paymentRequestsSearchQuery;
                searchInput.addEventListener("input", (e) => {
                    paymentRequestsSearchQuery = e.target.value;
                    applySearchFilter();
                });
            }

            async function refresh() {
                const [statusRes, pendingRes] = await Promise.all([
                    App.api.payments.getStatus(),
                    App.api.payments.getReceipts({ status: "pending" }),
                ]);

                const summary = statusRes.summary || {};
                summaryEl.innerHTML =
                    summaryCard("إجمالي الصيدليات", summary.total || 0, "#2563eb") +
                    summaryCard("دفعوا", summary.paid || 0, "#10b981") +
                    summaryCard("قيد المراجعة", summary.pending || 0, "#f59e0b") +
                    summaryCard("لم يدفعوا", summary.notSubmitted || 0, "#ef4444");

                /* 🆕 خريطة بيانات الصيدليات (مسؤول/هاتف/عنوان) عشان
                   نقدر نعرضها جنب أي إيصال بمجرد معرفة pharmacyId،
                   من غير ما نحتاج نعدّل جدول payment_receipts */
                const pharmacies = statusRes.pharmacies || [];
                const pharmacyInfoMap = {};
                pharmacies.forEach((p) => { pharmacyInfoMap[p.pharmacyId] = p; });

                /* إيصالات قيد المراجعة */
                const pendingReceipts = pendingRes.receipts || [];
                pendingEl.innerHTML = pendingReceipts.length
                    ? pendingReceipts.map((r) => {
                        const info = pharmacyInfoMap[r.pharmacyId] || {};
                        return `
                        <div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start"
                             data-search="${esc(buildPharmacySearchBlob({ pharmacyName: r.pharmacyName, ...info }))}">
                            <img src="${r.image}"
                                 style="width:90px;height:90px;object-fit:cover;border-radius:8px;cursor:zoom-in"
                                 data-receipt-zoom
                                 data-image="${r.image}"
                                 data-name="${esc(r.pharmacyName)}" />
                            <div style="flex:1;min-width:0">
                                <div class="bold">${esc(r.pharmacyName)}</div>
                                ${pharmacyMetaLines(info)}
                                <div class="small muted" style="margin-top:4px">${r.amount ? r.amount + " جنيه — " : ""}${timeAgo(r.createdAt)}</div>
                                ${r.notes ? `<div class="small">${esc(r.notes)}</div>` : ""}
                                <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
                                    <button class="btn btn-sm" style="background:#10b981;color:#fff;border:none" data-accept="${r.id}">قبول الإيصال</button>
                                    <button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none" data-reject="${r.id}">رفض</button>
                                    <label class="small" style="display:flex;align-items:center;gap:4px;cursor:pointer">
                                        <input type="checkbox" data-ban-check="${r.id}" /> بند الصيدلية عند الرفض
                                    </label>
                                </div>
                            </div>
                        </div>`;
                    }).join("")
                    : `<div class="small muted">لا توجد إيصالات في انتظار المراجعة 🎉</div>`;

                pendingEl.querySelectorAll("[data-accept]").forEach((btn) => {
                    btn.onclick = async () => {
                        btn.disabled = true;
                        const res = await App.api.payments.acceptReceipt(btn.dataset.accept, user.id);
                        if (res.ok) { toast("تم", "تم قبول الإيصال", "success"); refresh(); }
                        else { toast("خطأ", res.error || "فشل القبول", "warning"); btn.disabled = false; }
                    };
                });
                pendingEl.querySelectorAll("[data-reject]").forEach((btn) => {
                    btn.onclick = async () => {
                        const id = btn.dataset.reject;
                        const banCheck = pendingEl.querySelector(`[data-ban-check="${id}"]`);
                        const shouldBan = banCheck ? banCheck.checked : false;
                        if (!confirm(shouldBan ? "تأكيد رفض الإيصال وبند الصيدلية؟" : "تأكيد رفض الإيصال؟")) return;
                        btn.disabled = true;
                        const res = await App.api.payments.rejectReceipt(id, {
                            reviewedBy: user.id,
                            banPharmacy: shouldBan,
                        });
                        if (res.ok) {
                            toast("تم", shouldBan ? "تم رفض الإيصال وبند الصيدلية" : "تم رفض الإيصال", "info");
                            refresh();
                        } else { toast("خطأ", res.error || "فشل الرفض", "warning"); btn.disabled = false; }
                    };
                });

                /* الصيدليات اللي لسه ما دفعتش (أو اتُرفض إيصالها) */
                const unpaid = pharmacies.filter((p) => p.paymentStatus === "not_submitted" || p.paymentStatus === "rejected");
                unpaidEl.innerHTML = unpaid.length
                    ? unpaid.map((p) => `
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);gap:10px;flex-wrap:wrap"
                             data-search="${esc(buildPharmacySearchBlob(p))}">
                            <div style="min-width:0">
                                <div class="bold small">${esc(p.pharmacyName)}</div>
                                ${pharmacyMetaLines(p)}
                                <div class="small muted" style="margin-top:2px">${p.paymentStatus === "rejected" ? "تم رفض آخر إيصال" : "لم يُرسل إيصال"}</div>
                            </div>
                            <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
                                ${badge(p.accountStatus === "suspended" ? "مبندة" : "نشطة", p.accountStatus === "suspended" ? "#ef4444" : "#10b981")}
                                ${p.accountStatus !== "suspended"
                                    ? `<button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none" data-ban="${p.pharmacyId}">بند مؤقتًا</button>`
                                    : `<button class="btn btn-sm btn-soft" data-unban="${p.pharmacyId}">إعادة تفعيل</button>`}
                            </div>
                        </div>`).join("")
                    : `<div class="small muted">كل الصيدليات دفعت أو قيد المراجعة 🎉</div>`;

                unpaidEl.querySelectorAll("[data-ban]").forEach((btn) => {
                    btn.onclick = async () => {
                        if (!confirm("تأكيد بند هذه الصيدلية مؤقتًا لحد ما تدفع؟")) return;
                        await App.api.updateUserStatus(btn.dataset.ban, "suspended");
                        toast("تم", "تم بند الصيدلية مؤقتًا", "info");
                        refresh();
                    };
                });
                unpaidEl.querySelectorAll("[data-unban]").forEach((btn) => {
                    btn.onclick = async () => {
                        await App.api.updateUserStatus(btn.dataset.unban, "active");
                        toast("تم", "تم إعادة تفعيل الصيدلية", "success");
                        refresh();
                    };
                });

                /* كل الصيدليات — نظرة عامة، دلوقتي مع بيانات كاملة */
                allEl.innerHTML = pharmacies.length
                    ? pharmacies.map((p) => {
                        const st = STATUS_META[p.paymentStatus] || STATUS_META.not_submitted;
                        return `
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);gap:10px;flex-wrap:wrap"
                                 data-search="${esc(buildPharmacySearchBlob(p))}">
                                <div style="min-width:0">
                                    <div class="small bold">${esc(p.pharmacyName)}</div>
                                    ${pharmacyMetaLines(p)}
                                </div>
                                <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
                                    ${badge(st.text, st.color)}
                                    ${badge(p.accountStatus === "suspended" ? "مبندة" : "نشطة", p.accountStatus === "suspended" ? "#ef4444" : "#10b981")}
                                </div>
                            </div>`;
                    }).join("")
                    : `<div class="small muted">لا توجد بيانات</div>`;

                // 🆕 نطبّق نص البحث المحفوظ (لو موجود) على الليستات المتجددة
                applySearchFilter();
            }

            refresh();
        },
    };
})();
