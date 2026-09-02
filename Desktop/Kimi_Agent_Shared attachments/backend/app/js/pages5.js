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

   🆕 تعديلات سابقة:
   1) صورة الإيصال بتتفتح في lightbox (بلور + X للإغلاق) بدل
      window.open — عن طريق App.ui.imageLightbox، مع event
      delegation على document زي نفس أسلوب pages4.js.
   2) سيرش بار في صفحة "طلبات الدفع" للبحث باسم الصيدلية/المسؤول/
      الهاتف/العنوان، وبيفلتر الليستات بشكل حي.
   3) كل صيدلية بتعرض اسم المسؤول والهاتف والعنوان تحت اسمها.

   🆕🆕 تعديل جديد (تابات بدل الليستات التلاتة تحت بعض):
   4) صفحة "طلبات الدفع" بقت عمود واحد بس فوقه هيدر تابات (قيد
      المراجعة / لم يدفعوا / دفعوا / كل الصيدليات)، وتدوس على أي
      تاب يقلبلك المحتوى تحته في نفس المكان بدل الليستات التلاتة
      اللي كانت تحت بعض. البيانات بتتجاب مرة واحدة في refresh()
      وبتتخزن، وتبديل التاب بيعيد رسم القايمة بس من غير ما يعمل
      fetch تاني (لحد ما يحصل refresh فعلي بعد إجراء زي قبول/رفض/بند).
   ============================================================ */
window.App = window.App || {};
window.App.pages = window.App.pages || {};

(function () {
    const { icon, esc, toast, timeAgo } = App.ui;

    // نص البحث الحالي في صفحة "طلبات الدفع" — بيفضل محفوظ لو
    // الصفحة اتعادت رسمها (refresh) في نفس الزيارة
    let paymentRequestsSearchQuery = "";

    // 🆕 التاب الحالي (تاب واحد بس، عمود واحد) — بيفضل محفوظ برضه
    // في نفس الزيارة حتى لو الصفحة اتعادت رسمها
    let activePaymentsTab = "pending";

    const PANEL_TABS = [
        { key: "pending", label: "قيد المراجعة" },
        { key: "unpaid", label: "لم يدفعوا" },
        { key: "paid", label: "دفعوا" },
        { key: "all", label: "كل الصيدليات" },
    ];

    /* ============================================================
       event delegation عام على document لفتح صورة أي إيصال دفع
       في lightbox بدل ما تفتح في تاب جديد.
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

    // دالة مساعدة لبناء نص قابل للبحث لصف صيدلية معين (اسم
    // الصيدلية + اسم المسؤول + الهاتف + العنوان)
    function buildPharmacySearchBlob(p) {
        return [p.pharmacyName, p.responsibleName, p.phone, p.address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
    }

    // سطر بيانات الصيدلية (المسؤول + الهاتف + العنوان) بيتكرر في
    // أكتر من مكان، فبنينا دالة واحدة بتطلعه
    function pharmacyMetaLines(p) {
        return `
            ${p.responsibleName ? `<div class="small muted">${esc(p.responsibleName)}</div>` : ""}
            ${p.phone ? `<div class="small muted" style="display:flex;align-items:center;gap:4px;margin-top:2px">${icon("phone", 12)} ${esc(p.phone)}</div>` : ""}
            ${p.address ? `<div class="small muted" style="display:flex;align-items:center;gap:4px">${icon("pin", 12)} ${esc(p.address)}</div>` : ""}
        `;
    }

    /* ============================================================
       🆕 دوال بناء عناصر كل تاب (list items) — كل واحدة بترجع HTML
       فقط، بدون منطق ربط أحداث (dataset.search بيتحط عليها عشان
       السيرش الحي يقدر يفلتر أي عمود موجودة فيه)
       ============================================================ */

    function pendingItemsHTML(receipts, infoMap) {
        if (!receipts.length) {
            return `<div class="small muted">لا توجد إيصالات في انتظار المراجعة 🎉</div>`;
        }
        return receipts.map((r) => {
            const info = infoMap[r.pharmacyId] || {};
            return `
            <div class="card" style="padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start"
                 data-search="${esc(buildPharmacySearchBlob({ pharmacyName: r.pharmacyName, ...info }))}">
                <img src="${r.image}"
                     style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:zoom-in;flex-shrink:0"
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
        }).join("");
    }

    function unpaidItemsHTML(list) {
        if (!list.length) {
            return `<div class="small muted">كل الصيدليات دفعت أو قيد المراجعة 🎉</div>`;
        }
        return list.map((p) => `
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
            </div>`).join("");
    }

    function paidItemsHTML(list) {
        if (!list.length) {
            return `<div class="small muted">لا توجد صيدليات دفعت في هذه الفترة بعد</div>`;
        }
        return list.map((p) => `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);gap:10px;flex-wrap:wrap"
                 data-search="${esc(buildPharmacySearchBlob(p))}">
                <div style="min-width:0">
                    <div class="bold small">${esc(p.pharmacyName)}</div>
                    ${pharmacyMetaLines(p)}
                    ${p.lastSubmittedAt ? `<div class="small muted" style="margin-top:2px">آخر إيصال ${timeAgo(p.lastSubmittedAt)}</div>` : ""}
                </div>
                ${badge("تم القبول", "#10b981")}
            </div>`).join("");
    }

    function allItemsHTML(list) {
        if (!list.length) {
            return `<div class="small muted">لا توجد بيانات</div>`;
        }
        return list.map((p) => {
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
        }).join("");
    }

    /* ============================================================
       صفحة "المدفوعات" — الصيدلي (بدون تغيير)
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
       🆕 الشاشة بقت مقسومة لعمودين، كل عمود ليه تابات مستقلة
       ============================================================ */
    App.pages.paymentRequests = {
        title: "طلبات الدفع",
        crumb: "مراجعة إيصالات الاشتراك وحالة الصيدليات",
        roles: ["admin"],
        render() {
            return `
                <div style="display:grid;gap:18px">
                    <!-- سيرش بار للبحث عن الصيدليات (بالاسم / المسؤول / الهاتف / العنوان) -->
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

                    <!-- 🆕 عمود واحد: هيدر تابات فوق، والمحتوى بيتبدل تحته -->
                    <div class="card" style="padding:18px">
                        <div id="pay-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px"></div>
                        <div id="pay-list">جاري التحميل...</div>
                        <div class="small muted" id="pay-list-empty-search" style="display:none;padding:10px 0">لا توجد نتائج مطابقة لبحثك في هذه القائمة</div>
                    </div>
                </div>`;
        },
        async mount(user) {
            const summaryEl = document.getElementById("pay-summary");
            const searchInput = document.getElementById("pay-search-input");

            // 🆕 آخر بيانات جاية من السيرفر، متخزنة عشان تبديل التابات
            // ما يحتاجش يعمل fetch جديد كل مرة
            let latestData = { pharmacies: [], pendingReceipts: [], pharmacyInfoMap: {} };

            function summaryCard(label, value, color) {
                return `<div class="card" style="padding:14px;text-align:center">
                    <div style="font-size:22px;font-weight:800;color:${color}">${value}</div>
                    <div class="small muted">${label}</div>
                </div>`;
            }

            // فلترة حيّة للصفوف اللي عليها data-search جوه القايمة الحالية،
            // على نص البحث الحالي
            function applySearchFilter() {
                const q = paymentRequestsSearchQuery.trim().toLowerCase();
                const listEl = document.getElementById("pay-list");
                const emptyEl = document.getElementById("pay-list-empty-search");
                if (!listEl) return;
                const rows = Array.from(listEl.querySelectorAll("[data-search]"));
                let visibleCount = 0;
                rows.forEach((row) => {
                    const hay = row.dataset.search || "";
                    const isMatch = q === "" || hay.includes(q);
                    row.style.display = isMatch ? "" : "none";
                    if (isMatch) visibleCount++;
                });
                if (emptyEl) {
                    emptyEl.style.display = (q !== "" && rows.length > 0 && visibleCount === 0) ? "" : "none";
                }
            }

            if (searchInput) {
                searchInput.value = paymentRequestsSearchQuery;
                searchInput.addEventListener("input", (e) => {
                    paymentRequestsSearchQuery = e.target.value;
                    applySearchFilter();
                });
            }

            // بيرجع HTML القايمة المناسبة للتاب المطلوب من البيانات المخزنة
            function getListHTML(tab) {
                switch (tab) {
                    case "pending":
                        return pendingItemsHTML(latestData.pendingReceipts, latestData.pharmacyInfoMap);
                    case "unpaid":
                        return unpaidItemsHTML(latestData.pharmacies.filter(
                            (p) => p.paymentStatus === "not_submitted" || p.paymentStatus === "rejected"
                        ));
                    case "paid":
                        return paidItemsHTML(latestData.pharmacies.filter((p) => p.paymentStatus === "accepted"));
                    case "all":
                        return allItemsHTML(latestData.pharmacies);
                    default:
                        return "";
                }
            }

            // بتربط أزرار قبول/رفض (لو تاب "pending") أو بند/إعادة تفعيل
            // (لو تاب "unpaid") بعد ما يتحط الـ HTML في العمود
            function attachHandlersForTab(listEl, tab) {
                if (tab === "pending") {
                    listEl.querySelectorAll("[data-accept]").forEach((btn) => {
                        btn.onclick = async () => {
                            btn.disabled = true;
                            const res = await App.api.payments.acceptReceipt(btn.dataset.accept, user.id);
                            if (res.ok) { toast("تم", "تم قبول الإيصال", "success"); refresh(); }
                            else { toast("خطأ", res.error || "فشل القبول", "warning"); btn.disabled = false; }
                        };
                    });
                    listEl.querySelectorAll("[data-reject]").forEach((btn) => {
                        btn.onclick = async () => {
                            const id = btn.dataset.reject;
                            const banCheck = listEl.querySelector(`[data-ban-check="${id}"]`);
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
                } else if (tab === "unpaid") {
                    listEl.querySelectorAll("[data-ban]").forEach((btn) => {
                        btn.onclick = async () => {
                            if (!confirm("تأكيد بند هذه الصيدلية مؤقتًا لحد ما تدفع؟")) return;
                            await App.api.updateUserStatus(btn.dataset.ban, "suspended");
                            toast("تم", "تم بند الصيدلية مؤقتًا", "info");
                            refresh();
                        };
                    });
                    listEl.querySelectorAll("[data-unban]").forEach((btn) => {
                        btn.onclick = async () => {
                            await App.api.updateUserStatus(btn.dataset.unban, "active");
                            toast("تم", "تم إعادة تفعيل الصيدلية", "success");
                            refresh();
                        };
                    });
                }
            }

            // بترسم التابات + القايمة تحتها في نفس العمود، وبتربط
            // الأحداث المناسبة. مبتعملش fetch — بتستخدم latestData
            function renderTabsAndList() {
                const tabsEl = document.getElementById("pay-tabs");
                const listEl = document.getElementById("pay-list");
                if (!tabsEl || !listEl) return;

                tabsEl.innerHTML = PANEL_TABS.map((t) => {
                    const isActive = t.key === activePaymentsTab;
                    return `<button type="button" class="btn btn-sm ${isActive ? "" : "btn-soft"}"
                                data-tab="${t.key}"
                                style="${isActive ? "background:var(--brand,#2563eb);color:#fff;border:none" : ""}">${t.label}</button>`;
                }).join("");

                tabsEl.querySelectorAll("button[data-tab]").forEach((btn) => {
                    btn.onclick = () => {
                        activePaymentsTab = btn.dataset.tab;
                        renderTabsAndList();
                        applySearchFilter();
                    };
                });

                listEl.innerHTML = getListHTML(activePaymentsTab);
                attachHandlersForTab(listEl, activePaymentsTab);
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

                const pharmacies = statusRes.pharmacies || [];
                const pharmacyInfoMap = {};
                pharmacies.forEach((p) => { pharmacyInfoMap[p.pharmacyId] = p; });

                latestData = {
                    pharmacies,
                    pendingReceipts: pendingRes.receipts || [],
                    pharmacyInfoMap,
                };

                renderTabsAndList();
                applySearchFilter();
            }

            refresh();
        },
    };
})();
