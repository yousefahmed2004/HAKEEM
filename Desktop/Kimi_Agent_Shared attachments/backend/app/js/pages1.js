/* ============================================================
   pages1.js — لوحة التحكم + الطلبات + تفاصيل الطلب + طلباتي
   ============================================================ */
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  const { icon, esc, statusBadge, avatar, fmtDateTime, timeAgo, fmtMoney, fmtNum, emptyState, toast, modal, confirmModal, STATUS } = App.ui;
  const S = () => App.store;

  /* ============================================================
     🆕 medLabel() — عرض اسم الدواء منفصل عن نوع العبوة (شارة صغيرة)
     ------------------------------------------------------------
     items ممكن توصل بشكلين: سترينج قديم "Panadol" أو object جديد
     { name: "Fucidin", unit: "علبة" } (من الباك إند بعد الفصل).
     الدالة دي بتوحّد العرض في كل مكان: اسم الدواء بالخط العادي +
     شارة صغيرة للعبوة لو موجودة، بدل ما يكونوا ملزّقين في سطر واحد.
     ============================================================ */
  function medLabel(m) {
    if (m && typeof m === "object") {
      const name = esc(m.name || "");
      const unit = m.unit
        ? ` <b class="unit-tag" style="font-weight:700;font-size:11px;color:var(--sky-700,#0284c7);background:var(--sky-50,#e0f2fe);border-radius:6px;padding:1px 6px;margin-inline-start:4px">${esc(m.unit)}</b>`
        : "";
      return `${name}${unit}`;
    }
    return esc(m);
  }

  /* ============================================================
     🆕 عدّاد تنازلي عام (Global Countdown Ticker)
     ------------------------------------------------------------
     أي عنصر في أي صفحة عليه data-countdown-deadline="<ISO date>"
     بيتحدّث تلقائيًا كل ثانية بمهلة hh:mm:ss متبقية. مصمم عشان
     يشتغل مع كذا عنصر في نفس الوقت (كروت في ليست، صفوف في جدول،
     أو كارت مفصّل في صفحة التفاصيل) من غير ما نحتاج نعمل setInterval
     منفصل لكل صفحة. بيتشغّل مرة واحدة بس طول عمر التطبيق (idempotent)
     وبيفضل شغّال طول ما فيه أي عنصر بهذا الـ attribute في الـ DOM —
     لو مفيش، مبيعملش حاجة (querySelectorAll بترجع فاضية بسرعة).
     ============================================================ */
  let _globalCountdownStarted = false;

  function formatCountdown(ms) {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function tickAllCountdowns() {
    document.querySelectorAll("[data-countdown-deadline]").forEach((el) => {
      const deadline = new Date(el.dataset.countdownDeadline).getTime();
      if (!deadline || Number.isNaN(deadline)) return;
      const remaining = deadline - Date.now();
      el.textContent = formatCountdown(remaining);
      if (remaining <= 0) el.style.color = "#dc2626";
      else if (remaining < 60000) el.style.color = "#dc2626";
      else if (remaining < 3 * 60000) el.style.color = "#d97706";
    });
  }

  function ensureGlobalCountdownTicker() {
    if (_globalCountdownStarted) return;
    _globalCountdownStarted = true;
    tickAllCountdowns();
    setInterval(tickAllCountdowns, 1000);
  }

  /* ============================================================
     مكونات مشتركة
     ============================================================ */
  function orderCard(o, { showPharmacy = true, showPhone = false } = {}) {
    const st = STATUS[o.status] || STATUS.pending;
    const meds = o.items.slice(0, 4).map((m) => `<span class="med-chip">${icon("pill", 12)} ${medLabel(m)}</span>`).join("");
    const more = o.items.length > 4 ? `<span class="med-chip more">+${o.items.length - 4}</span>` : "";
    const phoneRow = showPhone && o.status === "accepted"
      ? `<div>${icon("phone", 14)} <span class="mono" dir="ltr">${esc(o.phone)}</span></div>`
      : "";
    /* 🆕 لو الطلب ده ناتج عن تقسيم طلب أقدم (تنفيذ جزئي) نعرض إشارة صغيرة
       بتربطه بالطلب الأصلي، عشان الصيدلي يفهم إنه "بقية" طلب سابق */
    const splitBadge = o.parentOrderId
      ? `<span class="badge badge-info" style="margin-inline-start:6px;font-size:11px" title="أصناف ناقصة من طلب سابق">${icon("split", 11)} مكمل #${esc(o.parentOrderId)}</span>`
      : "";
    /* 🆕 عدّاد تنازلي مصغّر داخل الكارت — بيبان لكل الصيادلة اللي بتشوف
       الطلب "الابن" (الفرعي) في الليست/الـ pool وهو لسه معلّق (pending)،
       عشان أي صيدلي يقدر يشوف مهلة الإغلاق التلقائي من غير ما يفتح
       تفاصيل الطلب أصلاً */
    const childCountdownBadge = (o.parentOrderId && o.status === "pending" && o.childDeadline)
      ? `<span class="badge" style="margin-inline-start:6px;font-size:11px;background:#fef3c7;color:#92400e;font-weight:800" title="مهلة قبل الإغلاق التلقائي كنفاد من السوق">${icon("timer", 11)} <span data-countdown-deadline="${esc(o.childDeadline)}">--:--</span></span>`
      : "";
    /* 🆕 عدّاد تنازلي للطلب "الأب" (اللي اتعمله تنفيذ جزئي) — بيبان
       عند الصيدلية اللي عملت التنفيذ الجزئي في الأول أصلاً، عشان
       تتابع مهلة الطلب المكمل (الابن) من غير ما تدخل تفتحه بنفسها */
    const pendingChildBadge = o.pendingChildDeadline
      ? `<span class="badge" style="margin-inline-start:6px;font-size:11px;background:#e0f2fe;color:#0369a1;font-weight:800" title="مهلة الطلب المكمل #${esc(o.pendingChildOrderId)} قبل إغلاقه تلقائيًا">${icon("timer", 11)} مكمل #${esc(o.pendingChildOrderId)}: <span data-countdown-deadline="${esc(o.pendingChildDeadline)}">--:--</span></span>`
      : "";
    return `
      <div class="order-card" style="--oc:${st.color}" data-order="${o.id}">
        <div class="oc-head">
          <span class="oc-id">#${esc(o.id)}${splitBadge}${childCountdownBadge}${pendingChildBadge}</span>
          ${statusBadge(o.status)}
        </div>
        <div class="oc-customer">
          ${avatar(o.customerName, "#0ea5e9", "avatar-sm")}
          <div>
            <div class="oc-name">${esc(o.customerName)}</div>
            <div class="small muted">${timeAgo(o.createdAt)}</div>
          </div>
        </div>
        <div class="oc-meta">
          ${phoneRow}
          <div>${icon("pin", 14)} ${esc(o.address)}</div>
          ${showPharmacy && o.pharmacyName ? `<div>${icon("store", 14)} ${esc(o.pharmacyName)}</div>` : ""}
          ${o.price != null ? `<div>${icon("coins", 14)} <b style="color:var(--sky-700)">${fmtMoney(o.price)}</b></div>` : ""}
        </div>
        <div class="med-chips">${meds}${more}</div>
      </div>`;
  }

  function ordersTable(orders, { showPharmacy = true, showPrice = true, showPhone = false } = {}) {
    if (!orders.length) return emptyState("inbox", "لا توجد طلبات", "لم يتم العثور على طلبات مطابقة");
    return `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>رقم الطلب</th><th>العميل</th><th>الهاتف</th><th>الأدوية</th>
              ${showPharmacy ? "<th>الصيدلية</th>" : ""}
              <th>الحالة</th>${showPrice ? "<th>السعر</th>" : ""}<th>الوقت</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((o) => `
              <tr class="row-link" data-order="${o.id}">
                <td class="td-id cell-main" data-label="رقم الطلب" style="color:var(--sky-700)">
                  #${esc(o.id)}
                  ${o.parentOrderId ? `<div class="small muted" style="font-weight:600">${icon("split", 11)} مكمل #${esc(o.parentOrderId)}</div>` : ""}
                  ${(o.parentOrderId && o.status === "pending" && o.childDeadline) ? `<div class="small" style="font-weight:800;color:#d97706">${icon("timer", 11)} <span data-countdown-deadline="${esc(o.childDeadline)}">--:--</span></div>` : ""}
                  ${o.pendingChildDeadline ? `<div class="small" style="font-weight:800;color:#0369a1">${icon("timer", 11)} مكمل #${esc(o.pendingChildOrderId)}: <span data-countdown-deadline="${esc(o.pendingChildDeadline)}">--:--</span></div>` : ""}
                </td>
                <td class="td-customer" data-label="العميل">
                  <div class="cell-main">${esc(o.customerName)}</div>
                  <div class="cell-sub">${esc(o.address)}</div>
                </td>
                <td class="td-phone mono" data-label="الهاتف" dir="ltr" style="text-align:right">${showPhone || o.status === "accepted" ? esc(o.phone) : '<span class="muted small">—</span>'}</td>
                <td class="td-meds" data-label="الأدوية"><div class="med-chips">${o.items.slice(0, 2).map((m) => `<span class="med-chip">${medLabel(m)}</span>`).join("")}${o.items.length > 2 ? `<span class="med-chip more">+${o.items.length - 2}</span>` : ""}</div></td>
                ${showPharmacy ? `<td class="td-pharmacy" data-label="الصيدلية">${o.pharmacyName ? esc(o.pharmacyName) : '<span class="muted small">—</span>'}</td>` : ""}
                <td class="td-status" data-label="الحالة">${statusBadge(o.status)}</td>
                ${showPrice ? `<td class="td-price bold" data-label="السعر" style="color:var(--sky-700)">${o.price != null ? fmtMoney(o.price) : '<span class="muted small">—</span>'}</td>` : ""}
                <td class="td-time cell-sub" data-label="الوقت" style="white-space:nowrap">${timeAgo(o.createdAt)}</td>
                <td class="td-action" data-label=""><button class="icon-btn btn-view" data-order="${o.id}" title="عرض التفاصيل" style="width:34px;height:34px">${icon("eye", 16)}</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  App.shared = { orderCard, ordersTable, medLabel, formatCountdown, ensureGlobalCountdownTicker };

  /* ============================================================
     لوحة التحكم الرئيسية
     ============================================================ */
  function statCard({ label, value, icon: ic, bg, color, trend }) {
    return `
      <div class="stat-card" style="--sc-bg:${bg};--sc-color:${color};--sc-tint:${bg}">
        <div class="stat-icon">${icon(ic, 25)}</div>
        <div class="stat-info">
          <div class="stat-value">${value}</div>
          <div class="stat-label">${label}</div>
          ${trend ? `<div class="stat-trend ${trend.dir}">${icon(trend.dir === "up" ? "trendingUp" : "activity", 13)} ${trend.text}</div>` : ""}
        </div>
      </div>`;
  }

  function adminDashboard(user) {
    const st = S().stats();
    const recent = S().getOrders().slice(0, 6);

    return `
      <div class="page-anim">
        <div class="grid grid-6" style="margin-bottom:20px">
          ${statCard({ label: "طلبات اليوم", value: fmtNum(st.today), icon: "zap", bg: "#e0f2fe", color: "#0284c7" })}
          ${statCard({ label: "طلبات هذا الشهر", value: fmtNum(st.month), icon: "calendar", bg: "#dbeafe", color: "#2563eb" })}
          ${statCard({ label: "إجمالي الطلبات", value: fmtNum(st.total), icon: "package", bg: "#ede9fe", color: "#8b5cf6" })}
          ${statCard({ label: "الطلبات المقبولة", value: fmtNum(st.accepted), icon: "checkCircle", bg: "#d1fae5", color: "#059669" })}
          ${statCard({ label: "الطلبات المرفوضة", value: fmtNum(st.rejected), icon: "xCircle", bg: "#fee2e2", color: "#dc2626" })}
          ${statCard({ label: "الطلبات الجزئية", value: fmtNum(st.partial), icon: "split", bg: "#fef3c7", color: "#d97706" })}
        </div>

        <div class="grid split-19-1" style="margin-bottom:20px" id="dash-mid">
          <div class="card">
            <div class="card-head">
              <div class="card-title">${icon("chart", 20)} حركة الطلبات — آخر 14 يوم</div>
              <span class="badge badge-info">${fmtNum(st.month)} طلب هذا الشهر</span>
            </div>
            <div class="chart-box" id="ch-area"></div>
          </div>
          <div class="card">
            <div class="card-head"><div class="card-title">${icon("activity", 20)} توزيع الحالات</div></div>
            <div id="ch-donut"></div>
          </div>
        </div>

        <div class="grid split-19-1" id="dash-bottom">
          <div class="card">
            <div class="card-head">
              <div class="card-title">${icon("clock", 20)} أحدث الطلبات</div>
              <a href="#/orders" class="btn btn-soft btn-sm">عرض الكل ${icon("arrowLeft", 15)}</a>
            </div>
            ${ordersTable(recent, { showPrice: false })}
          </div>
        </div>
      </div>`;
  }

  function mountAdminDashboard() {
    App.charts.areaChart(document.getElementById("ch-area"), S().dailySeries(14));
    const st = S().stats();
    App.charts.donut(document.getElementById("ch-donut"), [
      { label: "مقبول", value: st.accepted, color: "#10b981" },
      { label: "قيد الانتظار", value: st.pending, color: "#f59e0b" },
      { label: "جزئي", value: st.partial, color: "#0ea5e9" },
      { label: "مرفوض", value: st.rejected, color: "#ef4444" },
    ], { size: 180, thickness: 24 });
  }

  function pharmacistDashboard(user) {
    const pool = S().poolFor(user.id);
    const current = S().myOrdersCurrent(user.id);
    const doneToday = S().myOrdersCompletedToday(user.id);
    const revenue = doneToday.reduce((s, o) => s + (o.price || 0), 0);

    return `
      <div class="page-anim">
        <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg,#0284c7,#2563eb);color:#fff;border:none;position:relative;overflow:hidden">
          <div style="position:absolute;left:-30px;top:-30px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.1)"></div>
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;position:relative">
            ${avatar(user.pharmacyName || user.name, "rgba(255,255,255,.28)", "avatar-lg")}
            <div style="flex:1;min-width:200px">
              <div style="font-size:20px;font-weight:900">أهلًا بك، ${esc(user.name)} 👋</div>
              <div style="opacity:.9;font-size:13.5px;margin-top:3px">${esc(user.pharmacyName)} — لديك <b>${pool.length}</b> طلب جديد بانتظار المراجعة</div>
            </div>
            <a href="#/orders" class="btn" style="background:#fff;color:var(--sky-700)">${icon("inbox", 17)} استعراض الطلبات الجديدة</a>
          </div>
        </div>

        <div class="grid grid-4" style="margin-bottom:20px">
          ${statCard({ label: "طلبات جديدة متاحة", value: fmtNum(pool.length), icon: "inbox", bg: "#fef3c7", color: "#d97706" })}
          ${statCard({ label: "قيد التنفيذ حاليًا", value: fmtNum(current.length), icon: "clipboard", bg: "#e0f2fe", color: "#0284c7" })}
          ${statCard({ label: "منفذة اليوم", value: fmtNum(doneToday.length), icon: "checkCircle", bg: "#d1fae5", color: "#059669" })}
          ${statCard({ label: "مبيعات اليوم", value: fmtMoney(revenue), icon: "coins", bg: "#ede9fe", color: "#8b5cf6" })}
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon("zap", 20)} أحدث الطلبات الواردة</div>
            <a href="#/orders" class="btn btn-soft btn-sm">كل الطلبات ${icon("arrowLeft", 15)}</a>
          </div>
          ${pool.length ? `<div class="grid grid-3">${pool.slice(0, 6).map((o) => orderCard(o, { showPharmacy: false })).join("")}</div>`
        : emptyState("inbox", "لا توجد طلبات جديدة حاليًا", "ستظهر هنا الطلبات فور وصولها من الشات بوت")}
        </div>

        <div class="card" style="margin-top:20px">
          <div class="card-head">
            <div class="card-title">${icon("package", 20)} طلباتي قيد التنفيذ</div>
            <a href="#/my-orders" class="btn btn-soft btn-sm">فتح صفحة طلباتي ${icon("arrowLeft", 15)}</a>
          </div>
          ${current.length ? ordersTable(current, { showPharmacy: false, showPhone: true })
        : emptyState("clipboard", "لا توجد طلبات قيد التنفيذ حاليًا", "الطلبات اللي هتقبلها هتفضل ظاهرة هنا لحد ما تخلّصها")}
        </div>
      </div>`;
  }

App.pages.dashboard = {
  title: "لوحة التحكم",
  crumb: "نظرة عامة على النشاط",
 render(user) { return user.role === "admin" ? adminDashboard(user) : pharmacistDashboard(user); },
  mount(user) { if (user.role === "admin") mountAdminDashboard(); bindOrderCards(); },
};

  /* ============================================================
     صفحة الطلبات
     ============================================================ */
  let ordersFilter = { tab: "all", q: "" };

  function adminOrders() {
    return `
      <div class="page-anim">
        <div class="card">
          <div class="card-head">
            <div class="tabs" id="orders-tabs">
              ${[["all", "الكل"], ["pending", "المعلقة"], ["accepted", "المقبولة"], ["partial", "الجزئية"], ["rejected", "المرفوضة"]]
        .map(([k, l]) => `<button class="tab ${ordersFilter.tab === k ? "active" : ""}" data-tab="${k}">${l} <span class="t-count" data-count="${k}"></span></button>`).join("")}
            </div>
            <div class="input-wrap" style="width:270px;max-width:100%">
              ${icon("search", 17)}
              <input class="input" id="orders-search" placeholder="بحث برقم الطلب، الاسم، الهاتف..." value="${esc(ordersFilter.q)}" />
            </div>
          </div>
          <div id="orders-list"></div>
        </div>
      </div>`;
  }

  function renderAdminOrdersList() {
    const all = S().getOrders();
    const counts = { all: all.length, pending: 0, accepted: 0, partial: 0, rejected: 0 };
    all.forEach((o) => {
      const key = o.status === "closed" ? "accepted" : o.status;
      if (counts[key] !== undefined) counts[key]++;
    });
    document.querySelectorAll("[data-count]").forEach((el) => { el.textContent = fmtNum(counts[el.dataset.count]); });

    let list = ordersFilter.tab === "all"
      ? all
      : ordersFilter.tab === "accepted"
        ? all.filter((o) => o.status === "accepted" || o.status === "closed")
        : all.filter((o) => o.status === ordersFilter.tab);
    const q = ordersFilter.q.trim().toLowerCase();
    if (q) list = list.filter((o) =>
      o.id.includes(q) || o.customerName.toLowerCase().includes(q) ||
      o.phone.includes(q) || o.items.some((m) => (typeof m === "string" ? m : (m.name || "")).toLowerCase().includes(q)) ||
      (o.pharmacyName || "").includes(q));

    document.getElementById("orders-list").innerHTML = ordersTable(list, { showPhone: true });
    bindOrderCards();
  }

  function pharmacistOrders(user) {
    const pool = S().poolFor(user.id);
    return `
      <div class="page-anim">
        <div class="card">
          <div class="card-head">
            <div class="card-title">${icon("inbox", 20)} الطلبات الجديدة
              <span class="badge badge-pending"><span class="dot"></span>${pool.length} بانتظار القبول</span>
            </div>
            <span class="small muted">أول صيدلي يقبل الطلب يصبح مسؤولًا عنه ويختفي من باقي الصيادلة</span>
          </div>
          ${pool.length
        ? `<div class="grid grid-3">${pool.map((o) => orderCard(o, { showPharmacy: false })).join("")}</div>`
        : emptyState("inbox", "لا توجد طلبات جديدة", "جميع الطلبات تم التعامل معها — ستظهر الطلبات الجديدة هنا فور وصولها")}
        </div>

        <div class="card" style="margin-top:20px">
          <div class="card-head">
            <div class="card-title">${icon("info", 18)} تدور على طلب قبلته قبل كده؟</div>
          </div>
          <p class="small muted" style="margin:0">كل الطلبات اللي تقبلها بتتحفظ في صفحة
            <a href="#/my-orders" class="bold" style="color:var(--sky-700)">طلباتي</a> —
            هتلاقيها هناك سواء لسه شغّالة أو خلصتها.</p>
        </div>
      </div>`;
  }

  App.pages.orders = {
    title: "الطلبات",
    crumb: "إدارة ومتابعة جميع الطلبات",
    render(user) { return user.role === "admin" ? adminOrders() : pharmacistOrders(user); },
    mount(user) {
      if (user.role === "admin") {
        renderAdminOrdersList();
        document.getElementById("orders-tabs").addEventListener("click", (e) => {
          const tab = e.target.closest("[data-tab]");
          if (!tab) return;
          ordersFilter.tab = tab.dataset.tab;
          document.querySelectorAll("#orders-tabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
          renderAdminOrdersList();
        });
        document.getElementById("orders-search").addEventListener("input", (e) => {
          ordersFilter.q = e.target.value;
          renderAdminOrdersList();
          const inp = document.getElementById("orders-search");
          inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
        });
      } else {
        bindOrderCards();
      }
    },
  };

  /* ============================================================
     صفحة "طلباتي"
     ============================================================ */
  let myOrdersTab = "current";
  let myOrdersHistoryFilter = "all";

  function myOrdersHTML(user) {
    const current = S().myOrdersCurrent(user.id);
    const doneToday = S().myOrdersCompletedToday(user.id);
    const tabs = [
      ["current", "قيد التنفيذ", current.length],
      ["today", "منفذة اليوم", doneToday.length],
      ["history", "السجل الكامل", null],
    ];
    return `
      <div class="page-anim">
        <div class="card">
          <div class="card-head">
            <div class="tabs" id="my-orders-tabs">
              ${tabs.map(([k, l, count]) => `
                <button class="tab ${myOrdersTab === k ? "active" : ""}" data-tab="${k}">
                  ${l} ${count != null ? `<span class="t-count">${fmtNum(count)}</span>` : ""}
                </button>`).join("")}
            </div>
            ${myOrdersTab === "history" ? `
              <div class="input-wrap" style="width:220px;max-width:100%">
                <select class="input" id="my-orders-history-filter" style="border:none;background:transparent">
                  <option value="all" ${myOrdersHistoryFilter === "all" ? "selected" : ""}>كل الحالات</option>
                  <option value="accepted" ${myOrdersHistoryFilter === "accepted" ? "selected" : ""}>مقبولة</option>
                  <option value="partial" ${myOrdersHistoryFilter === "partial" ? "selected" : ""}>جزئية</option>
                  <option value="rejected" ${myOrdersHistoryFilter === "rejected" ? "selected" : ""}>اعتذرت عنها</option>
                </select>
              </div>` : ""}
          </div>
          <div id="my-orders-list"></div>
        </div>
      </div>`;
  }

  function renderMyOrdersList(user) {
    const target = document.getElementById("my-orders-list");
    if (!target) return;
    let list;
    if (myOrdersTab === "current") {
      list = S().myOrdersCurrent(user.id);
      target.innerHTML = list.length ? ordersTable(list, { showPharmacy: false, showPhone: true })
        : emptyState("clipboard", "لا توجد طلبات قيد التنفيذ", "الطلبات
