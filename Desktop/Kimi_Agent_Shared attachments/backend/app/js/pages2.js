/* ============================================================
   pages2.js — إدارة الصيادلة + الإحصائيات + الأدوية الأكثر طلبًا
   ============================================================ */
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  const { icon, esc, avatar, fmtDateTime, fmtMoney, fmtNum, emptyState, toast, modal, confirmModal } = App.ui;
  const S = () => App.store;

  /* ============================================================
     إyدارة الصيادلة (Admin فقط)
     ============================================================ */

  /* 🆕 نص البحث الحالي في صفحة الصيادلة (بيُحفظ بين إعادات الرندر) */
  let phQuery = "";

  function pharmacistRow(p, stats) {
    const st = stats.find((x) => x.id === p.id) || { accepted: 0, partial: 0, rejected: 0, total: 0 };
    const ringValue = Math.max(0, Math.min(100, st.executionRate || 0));
    const ringColor = ringValue > 50 ? "#10b981" : ringValue === 50 ? "#f59e0b" : "#ef4444";
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:11px">
            ${avatar(p.pharmacyName || p.name, p.color, "avatar-sm")}
            <div>
              <div class="cell-main">${esc(p.pharmacyName)}</div>
              <div class="cell-sub">${esc(p.name)}</div>
              ${p.address ? `<div class="small muted" style="margin-top:4px;display:flex;align-items:center;gap:4px">${icon("pin", 12)} ${esc(p.address)}</div>` : ""}
              <div class="small muted" style="margin-top:4px">السعة: ${Number(p.maxActiveOrders || S().getPharmacyCapacity(p))}</div>
            </div>
          </div>
        </td>
        <td><code class="mono" style="background:var(--bg-soft);padding:3px 10px;border-radius:8px;font-size:12.5px">${esc(p.username)}</code></td>
        <td class="mono" dir="ltr" style="text-align:right">${esc(p.phone || "—")}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span class="badge badge-accepted" title="منفذة">${st.accepted}</span>
            <span class="badge badge-partial" title="جزئية">${st.partial}</span>
            <span class="badge badge-rejected" title="مرفوضة">${st.rejected}</span>
          </div>
          <div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div class="execution-ring small" style="--ring-color:${ringColor};--ring-value:${ringValue}">
              <span>${ringValue}%</span>
            </div>
            <div>
              <div class="bold small" style="color:${ringColor}">${st.executionBadge?.label || "أخضر"}</div>
              <div class="small muted">${st.executionPoints || 100} نقطة • ${st.executionRate || 0}% تنفيذ</div>
            </div>
          </div>
        </td>
        <td>${p.status === "active"
        ? '<span class="badge badge-active"><span class="dot"></span>نشط</span>'
        : '<span class="badge badge-suspended"><span class="dot"></span>موقوف</span>'}</td>
        <td class="cell-sub" style="white-space:nowrap">${fmtDateTime(p.createdAt).split("—")[0].trim()}</td>
        <td>
          <div style="display:flex;gap:7px">
            <button class="icon-btn" style="width:34px;height:34px" data-act="edit" data-id="${p.id}" title="تعديل">${icon("edit", 15)}</button>
            <button class="icon-btn" style="width:34px;height:34px" data-act="toggle" data-id="${p.id}" title="${p.status === "active" ? "إيقاف الحساب" : "إعادة التفعيل"}">${icon(p.status === "active" ? "ban" : "refresh", 15)}</button>
            <button class="icon-btn" style="width:34px;height:34px" data-act="delete" data-id="${p.id}" title="حذف">${icon("trash", 15)}</button>
          </div>
        </td>
      </tr>`;
  }

  function pharmacistsHTML() {
    const list = S().getPharmacists();
    const active = list.filter((p) => p.status === "active").length;
    return `
      <div class="page-anim">
        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon("users", 20)} الصيادلة المسجلون
              <span class="badge badge-info">${active} نشط من ${list.length}</span>
            </div>
            <button class="btn btn-primary" id="add-ph">${icon("plus", 17)} إضافة صيدلي</button>
          </div>
          <div class="field" style="margin-bottom:18px">
            <div class="input-wrap">
              ${icon("search", 18)}
              <input class="input" id="ph-search" placeholder="ابحث باسم الصيدلية أو الصيدلي أو اسم المستخدم..." value="${esc(phQuery)}" />
            </div>
          </div>
          <div id="ph-list"></div>
        </div>
      </div>`;
  }

  /* 🆕 تُعيد رسم جدول/قائمة الصيادلة فقط حسب نص البحث الحالي، وتربط
     أزرار الإجراءات (تعديل/إيقاف/حذف) من جديد كل مرة لأن الصفوف بتتغير */
  function renderPharmacistsList() {
    const list = S().getPharmacists();
    const stats = S().pharmacyStats();
    const q = phQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter((p) =>
        (p.pharmacyName || "").toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.username || "").toLowerCase().includes(q)
      )
      : list;

    const target = document.getElementById("ph-list");
    if (!target) return;

    if (!filtered.length) {
      target.innerHTML = q
        ? emptyState("users", "لا توجد نتائج", "جرّب اسمًا آخر أو تحقق من الإملاء")
        : emptyState("users", "لا يوجد صيادلة بعد", "أضف أول صيدلي ليبدأ استقبال الطلبات");
      return;
    }

    target.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>الصيدلية</th><th>اسم المستخدم</th><th>الهاتف</th><th>الطلبات</th><th>الحالة</th><th>تاريخ الانضمام</th><th>إجراءات</th>
          </tr></thead>
          <tbody>${filtered.map((p) => pharmacistRow(p, stats)).join("")}</tbody>
        </table>
      </div>`;

    bindPharmacistRowActions();
  }

  /* 🆕 ربط أحداث أزرار كل صف (تعديل / إيقاف / حذف) — مفصولة في دالة
     مستقلة عشان تتنادى تاني بعد كل إعادة رسم ناتجة عن البحث */
  function bindPharmacistRowActions() {
    document.querySelectorAll("[data-act]").forEach((btn) => {
      btn.onclick = () => {
        const p = S().getPharmacists().find((x) => x.id === btn.dataset.id);
        if (!p) return;
        if (btn.dataset.act === "edit") return openPharmacistModal(p);
        if (btn.dataset.act === "toggle") {
          const willSuspend = p.status === "active";
          return confirmModal({
            title: willSuspend ? "إيقاف حساب الصيدلي" : "إعادة تفعيل الحساب",
            icon: willSuspend ? "ban" : "refresh",
            danger: willSuspend,
            message: willSuspend
              ? `سيتم منع <b>${esc(p.pharmacyName)}</b> من تسجيل الدخول واستقبال الطلبات. يمكنك إعادة تفعيله في أي وقت.`
              : `سيتمكن <b>${esc(p.pharmacyName)}</b> من تسجيل الدخول واستقبال الطلبات مرة أخرى.`,
            confirmText: willSuspend ? "إيقاف الحساب" : "إعادة التفعيل",
            async onConfirm() {
              const newStatus = await S().togglePharmacistStatus(p.id);
              toast(newStatus === "suspended" ? "تم إيقاف الحساب" : "تمت إعادة التفعيل", p.pharmacyName, newStatus === "suspended" ? "warning" : "success");
              App.router.refresh();
            },
          });
        }
        if (btn.dataset.act === "delete") {
          return confirmModal({
            title: "حذف الصيدلي نهائيًا",
            icon: "trash",
            danger: true,
            message: `سيتم حذف حساب <b>${esc(p.pharmacyName)}</b> نهائيًا ولن يتمكن من الدخول. (طلباته السابقة ستبقى في السجلات)`,
            confirmText: "حذف نهائي",
            onConfirm() {
              S().deletePharmacist(p.id);
              toast("تم حذف الصيدلي", p.pharmacyName, "error");
              App.router.refresh();
            },
          });
        }
      };
    });
  }

  function openPharmacistModal(existing) {
    const isEdit = !!existing;
    modal({
      title: isEdit ? `تعديل بيانات — ${esc(existing.pharmacyName)}` : "إضافة صيدلي جديد",
      icon: isEdit ? "edit" : "plus",
      body: `
        <div class="grid grid-2" style="gap:14px">
          <div class="field" style="margin:0"><label>اسم الصيدلي <span class="req">*</span></label>
            <input class="input" id="pf-name" placeholder="د. محمد أحمد" value="${isEdit ? esc(existing.name) : ""}" /></div>
          <div class="field" style="margin:0"><label>اسم الصيدلية <span class="req">*</span></label>
            <input class="input" id="pf-pharmacy" placeholder="صيدلية النور" value="${isEdit ? esc(existing.pharmacyName) : ""}" /></div>
          <div class="field" style="margin:0"><label>اسم المستخدم <span class="req">*</span></label>
            <input class="input mono" id="pf-username" placeholder="noor" dir="ltr" style="text-align:right" value="${isEdit ? esc(existing.username) : ""}" /></div>
          <div class="field" style="margin:0"><label>كلمة المرور ${isEdit ? '<span class="muted small">(اتركها فارغة للإبقاء)</span>' : '<span class="req">*</span>'}</label>
            <input class="input mono" id="pf-password" type="text" placeholder="••••••" dir="ltr" style="text-align:right" /></div>
          <div class="field" style="margin:0"><label>الحد الأقصى للطلبات النشطة</label>
            <input class="input" id="pf-capacity" type="number" min="1" step="1" placeholder="2" value="${isEdit ? esc(String(existing.maxActiveOrders || S().getPharmacyCapacity(existing))) : "2"}" /></div>
          <div class="field" style="margin:0"><label>رقم الهاتف</label>
            <input class="input mono" id="pf-phone" placeholder="01000000000" dir="ltr" style="text-align:right" value="${isEdit ? esc(existing.phone || "") : ""}" /></div>
          <div class="field" style="margin:0;grid-column:span 2"><label>عنوان الصيدلية (نقطة الاستلام لشركة الشحن)</label>
            <input class="input" id="pf-address" placeholder="مثال: شارع الجامعة، بجوار كنتاكي، الدقي" value="${isEdit ? esc(existing.address || "") : ""}" /></div>
        </div>
        <div id="pf-error" class="login-error" style="margin:14px 0 0"></div>`,
      footer: `
        <button class="btn btn-primary" id="pf-save">${icon("check", 16)} ${isEdit ? "حفظ التعديلات" : "إضافة الصيدلي"}</button>
        <button class="btn btn-ghost" id="pf-cancel">إلغاء</button>`,
      onOpen(overlay, close) {
        overlay.querySelector("#pf-cancel").onclick = close;
        overlay.querySelector("#pf-save").onclick = async () => {
          const v = (id) => overlay.querySelector(id).value.trim();
          const err = overlay.querySelector("#pf-error");
          const fail = (m) => { err.textContent = m; err.classList.add("show"); };
          const name = v("#pf-name"), pharmacyName = v("#pf-pharmacy"), username = v("#pf-username"), password = v("#pf-password"), phone = v("#pf-phone"), address = v("#pf-address"), maxActiveOrders = Number(overlay.querySelector("#pf-capacity").value || 2);

          if (!name || !pharmacyName || !username) return fail("املأ جميع الحقول المطلوبة");
          if (!/^[a-zA-Z0-9_.-]{3,}$/.test(username)) return fail("اسم المستخدم: 3 أحرف إنجليزية أو أرقام على الأقل");
          if (S().usernameExists(username, isEdit ? existing.id : null)) return fail("اسم المستخدم مستخدم بالفعل — اختر اسمًا آخر");
          if (!isEdit && password.length < 6) return fail("كلمة المرور: 6 أحرف على الأقل");
          if (!Number.isFinite(maxActiveOrders) || maxActiveOrders < 1) return fail("الحد الأقصى يجب أن يكون رقمًا أكبر من صفر");
          if (phone && !/^01[0-9]{9}$/.test(phone)) return fail("رقم الهاتف غير صحيح (مثال: 01012345678)");

          if (isEdit) {
            const patch = { name, pharmacyName, username, phone, address, maxActiveOrders };
            if (password) {
              if (password.length < 6) return fail("كلمة المرور: 6 أحرف على الأقل");
              patch.password = password;
            }
            await S().updatePharmacist(existing.id, patch);
            toast("تم حفظ التعديلات", pharmacyName, "success");
          } else {
            await S().addPharmacist({ name, pharmacyName, username, password, phone, address, maxActiveOrders });
            toast("تمت إضافة الصيدلي بنجاح", `${pharmacyName} يمكنه الآن تسجيل الدخول`, "success");
          }
          close();
          App.router.refresh();
        };
      },
    });
  }

  App.pages.pharmacists = {
    title: "الصيادلة",
    crumb: "إدارة حسابات الصيادلة وصلاحياتهم",
    roles: ["admin"],
    render: pharmacistsHTML,
    mount() {
      document.getElementById("add-ph").onclick = () => openPharmacistModal(null);

      renderPharmacistsList();

      const searchInput = document.getElementById("ph-search");
      searchInput.addEventListener("input", (e) => {
        phQuery = e.target.value;
        renderPharmacistsList();
      });
    },
  };

  /* ============================================================
     الإحصائيات (Admin فقط)
     ============================================================ */

  /* 🆕 نص البحث الحالي في جدول إحصائيات الصيدليات */
  let statPhQuery = "";

  function statisticsHTML() {
    const st = S().stats();
    return `
      <div class="page-anim">
        <div class="grid grid-6" style="margin-bottom:20px">
          ${["طلبات اليوم|today|zap|#e0f2fe|#0284c7", "هذا الشهر|month|calendar|#dbeafe|#2563eb", "الإجمالي|total|package|#ede9fe|#8b5cf6", "مقبولة|accepted|checkCircle|#d1fae5|#059669", "مرفوضة|rejected|xCircle|#fee2e2|#dc2626", "جزئية|partial|split|#fef3c7|#d97706"]
        .map((s) => {
          const [label, key, ic, bg, color] = s.split("|"); return `
            <div class="stat-card" style="--sc-bg:${bg};--sc-color:${color};--sc-tint:${bg}">
              <div class="stat-icon">${icon(ic, 25)}</div>
              <div class="stat-info"><div class="stat-value">${fmtNum(st[key])}</div><div class="stat-label">${label}</div></div>
            </div>`;
        }).join("")}
        </div>

        <div class="grid" style="grid-template-columns:1.9fr 1fr;margin-bottom:20px" id="stats-charts">
          <div class="card">
            <div class="card-head">
              <div class="card-title">${icon("chart", 20)} حركة الطلبات — آخر 30 يوم</div>
              <span class="badge badge-accepted">${icon("coins", 14)} إيرادات: ${fmtMoney(st.revenue)}</span>
            </div>
            <div class="chart-box" id="st-area"></div>
          </div>
          <div class="card">
            <div class="card-head"><div class="card-title">${icon("activity", 20)} توزيع الحالات</div></div>
            <div id="st-donut"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon("store", 20)} إحصائيات الصيدليات — للمحاسبة الشهرية</div>
            <button class="btn btn-soft btn-sm" id="export-csv">${icon("fileText", 15)} تصدير CSV</button>
          </div>
          <div class="field" style="margin-bottom:18px">
            <div class="input-wrap">
              ${icon("search", 18)}
              <input class="input" id="stat-ph-search" placeholder="ابحث باسم الصيدلية أو الصيدلي..." value="${esc(statPhQuery)}" />
            </div>
          </div>
          <div id="stat-ph-table"></div>
        </div>
      </div>`;
  }

  /* 🆕 تُعيد رسم جدول إحصائيات الصيدليات فقط حسب نص البحث الحالي */
  function renderPharmacyStatsTable() {
    const ph = S().pharmacyStats();
    const q = statPhQuery.trim().toLowerCase();
    const filtered = q
      ? ph.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.pharmacist || "").toLowerCase().includes(q)
      )
      : ph;

    const target = document.getElementById("stat-ph-table");
    if (!target) return;

    if (!filtered.length) {
      target.innerHTML = emptyState("store", "لا توجد نتائج", "جرّب اسمًا آخر أو تحقق من الإملاء");
      return;
    }

    target.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>الصيدلية</th><th>الطلبات المنفذة</th><th>الجزئية</th><th>المرفوضة</th>
            <th>إجمالي الطلبات</th><th>الإيرادات</th><th>نسبة التنفيذ</th>
          </tr></thead>
          <tbody>
            ${filtered.map((p) => {
        const done = p.accepted + p.partial;
        const rate = p.total ? Math.round((done / p.total) * 100) : 0;
        return `
                <tr>
                  <td>
                    <div class="cell-main">${esc(p.name)}</div>
                    <div class="cell-sub">${esc(p.pharmacist)} ${p.status === "suspended" ? "— موقوف" : ""}</div>
                  </td>
                  <td><span class="badge badge-accepted">${fmtNum(p.accepted)}</span></td>
                  <td><span class="badge badge-partial">${fmtNum(p.partial)}</span></td>
                  <td><span class="badge badge-rejected">${fmtNum(p.rejected)}</span></td>
                  <td class="bold">${fmtNum(p.total)}</td>
                  <td class="bold" style="color:var(--sky-700)">${fmtMoney(p.revenue)}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:9px">
                      <div class="hb-track" style="width:90px;height:8px"><div class="hb-fill" style="width:${rate}%"></div></div>
                      <span class="bold small">${rate}%</span>
                    </div>
                  </td>
                </tr>`;
      }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  App.pages.statistics = {
    title: "الإحصائيات",
    crumb: "تحليلات شاملة للطلبات والصيدليات",
    roles: ["admin"],
    render: statisticsHTML,
    mount() {
      const st = S().stats();
      App.charts.areaChart(document.getElementById("st-area"), S().dailySeries(30), { height: 260 });
      App.charts.donut(document.getElementById("st-donut"), [
        { label: "مقبول", value: st.accepted, color: "#10b981" },
        { label: "قيد الانتظار", value: st.pending, color: "#f59e0b" },
        { label: "جزئي", value: st.partial, color: "#0ea5e9" },
        { label: "مرفوض", value: st.rejected, color: "#ef4444" },
      ], { size: 180, thickness: 24 });
      const grid = document.getElementById("stats-charts");
      if (window.innerWidth < 1100 && grid) grid.style.gridTemplateColumns = "1fr";

      renderPharmacyStatsTable();

      const searchInput = document.getElementById("stat-ph-search");
      searchInput.addEventListener("input", (e) => {
        statPhQuery = e.target.value;
        renderPharmacyStatsTable();
      });

      /* تصدير CSV — بيصدّر كل الصيدليات دايمًا (بغض النظر عن نص البحث) عشان يفضل مرجع محاسبي كامل */
      document.getElementById("export-csv").onclick = () => {
        const rows = [["الصيدلية", "الصيدلي", "منفذة", "جزئية", "مرفوضة", "الإجمالي", "الإيرادات"]];
        S().pharmacyStats().forEach((p) => rows.push([p.name, p.pharmacist, p.accepted, p.partial, p.rejected, p.total, p.revenue]));
        const csv = "﻿" + rows.map((r) => r.join(",")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        a.download = "pharmacy-stats.csv";
        a.click();
        toast("تم تصدير الملف", "pharmacy-stats.csv", "success");
      };
    },
  };

  /* ============================================================
     الأدوية الأكثر طلبًا
     ============================================================ */
  let medQuery = "";

  function medicinesHTML() {
    return `
      <div class="page-anim">
        <div class="search-hero">
          <h3>${icon("search", 20)} محرك بحث الأدوية</h3>
          <p>تحليل فوري لجميع الطلبات الواردة من الشات بوت — ابحث باسم أي دواء</p>
          <div class="input-wrap">
            ${icon("search", 18)}
            <input class="input" id="med-search" placeholder="اكتب اسم الدواء... مثال: Panadol" value="${esc(medQuery)}" />
          </div>
        </div>
        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon("pill", 20)} <span id="med-title">Top 20 — الأدوية الأكثر طلبًا</span></div>
            <span class="badge badge-info" id="med-count"></span>
          </div>
          <div id="med-list"></div>
        </div>
      </div>`;
  }

  function renderMedList() {
    const all = S().medicineStats();
    const totalOrders = S().stats().total || 1;
    const q = medQuery.trim().toLowerCase();
    const list = q ? all.filter((m) => m.name.toLowerCase().includes(q)) : all.slice(0, 20);
    document.getElementById("med-title").textContent = q ? `نتائج البحث عن «${medQuery.trim()}»` : "Top 20 — الأدوية الأكثر طلبًا";
    document.getElementById("med-count").textContent = `${list.length} صنف — من ${all.length} إجمالًا`;

    const target = document.getElementById("med-list");
    if (!list.length) {
      target.innerHTML = emptyState("pill", "لا توجد نتائج", "جرّب اسمًا آخر أو تحقق من الإملاء");
      return;
    }
    const max = Math.max(...list.map((m) => m.count), 1);
    target.innerHTML = list.map((m, i) => {
      const pct = Math.round((m.count / totalOrders) * 100);
      return `
        <div class="hbar-row ${!q && i < 3 ? "top" : ""}">
          <div class="hb-rank">${q ? icon("pill", 13) : i + 1}</div>
          <div class="hb-name" title="${esc(m.name)}">${esc(m.name)}</div>
          <div class="hb-track"><div class="hb-fill" data-w="${((m.count / max) * 100).toFixed(1)}"></div></div>
          <div class="hb-val">${m.count} طلب <span class="muted" style="font-weight:600">(${pct}%)</span></div>
        </div>`;
    }).join("");
    requestAnimationFrame(() => setTimeout(() => {
      target.querySelectorAll(".hb-fill").forEach((f) => { f.style.width = f.dataset.w + "%"; });
    }, 60));
  }

  App.pages.medicines = {
    title: "الأدوية الأكثر طلبًا",
    crumb: "Top 20 وتحليل الطلب على الأدوية",
    render: medicinesHTML,
    mount() {
      renderMedList();
      document.getElementById("med-search").addEventListener("input", (e) => {
        medQuery = e.target.value;
        renderMedList();
        const inp = document.getElementById("med-search");
        inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
      });
    },
  };
})();
