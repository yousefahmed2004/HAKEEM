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
    return `
      <div class="order-card" style="--oc:${st.color}" data-order="${o.id}">
        <div class="oc-head">
          <span class="oc-id">#${esc(o.id)}${splitBadge}</span>
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

  App.shared = { orderCard, ordersTable, medLabel };

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

  function adminDashboard() {
    const st = S().stats();
    const recent = S().getOrders().slice(0, 6);
    const topMeds = S().medicineStats().slice(0, 6);
    const maxMed = Math.max(...topMeds.map((m) => m.count), 1);

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
          <div class="card">
            <div class="card-head">
              <div class="card-title">${icon("pill", 20)} الأكثر طلبًا</div>
              <a href="#/medicines" class="btn btn-soft btn-sm">Top 20</a>
            </div>
            ${topMeds.map((m, i) => `
              <div class="hbar-row ${i < 3 ? "top" : ""}">
                <div class="hb-rank">${i + 1}</div>
                <div class="hb-name">${esc(m.name)}</div>
                <div class="hb-track"><div class="hb-fill" style="width:${(m.count / maxMed) * 100}%"></div></div>
                <div class="hb-val">${m.count}</div>
              </div>`).join("")}
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
    render(user) { return user.role === "admin" ? adminDashboard() : pharmacistDashboard(user); },
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
        : emptyState("clipboard", "لا توجد طلبات قيد التنفيذ", "الطلبات اللي تقبلها هتظهر هنا لحد ما تخلّصها");
    } else if (myOrdersTab === "today") {
      list = S().myOrdersCompletedToday(user.id);
      target.innerHTML = list.length ? ordersTable(list, { showPharmacy: false })
        : emptyState("checkCircle", "لسه معملتش تنفيذ اليوم", "الطلبات اللي تخلّصها (تسليم/إلغاء/تنفيذ جزئي) هتظهر هنا في نفس يوم تنفيذها");
    } else {
      list = S().myOrdersHistory(user.id, myOrdersHistoryFilter);
      target.innerHTML = list.length ? ordersTable(list, { showPharmacy: false })
        : emptyState("hash", "لا يوجد سجل بعد", "كل الطلبات اللي مرت عليك (قبول/جزئي/اعتذار) هتتجمع هنا");
    }
    bindOrderCards();
  }

  App.pages.myOrders = {
    title: "طلباتي",
    crumb: "الطلبات اللي قبلتها ونفّذتها",
    roles: ["pharmacist"],
    render: myOrdersHTML,
    mount(user) {
      renderMyOrdersList(user);
      document.getElementById("my-orders-tabs").addEventListener("click", (e) => {
        const tab = e.target.closest("[data-tab]");
        if (!tab) return;
        myOrdersTab = tab.dataset.tab;
        App.router.refresh();
      });
      const historySelect = document.getElementById("my-orders-history-filter");
      if (historySelect) historySelect.addEventListener("change", (e) => {
        myOrdersHistoryFilter = e.target.value;
        renderMyOrdersList(user);
      });
    },
  };

  function bindOrderCards() {
    document.querySelectorAll("[data-order]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        location.hash = "#/orders/" + el.dataset.order;
      });
    });
  }
  App.bindOrderCards = bindOrderCards;
})();

/* ============================================================
   pages1.js (تابع) — تفاصيل الطلب + إجراءات الصيدلي والصورة
   ============================================================ */
(function () {
  const { icon, esc, statusBadge, fmtDateTime, timeAgo, fmtMoney, emptyState, toast, modal, confirmModal, STATUS } = App.ui;
  const S = () => App.store;
  const medLabel = (m) => App.shared.medLabel(m);

  /* ============================================================
     أزرار "Active Orders" — ترتيب إجباري: خطوة واحدة تالية متاحة فقط،
     والخطوات المنجزة تظهر معطّلة بعلامة صح، وباقي الخطوات معطّلة كذلك
     ============================================================ */
  const WORKFLOW_STEPS = [
    { key: "received", label: "تم استلام الطلب" },
    { key: "preparing", label: "جاري التجهيز" },
    { key: "ready", label: "جاهز للتوصيل" },
    { key: "out_for_delivery", label: "خرج للتوصيل" },
    { key: "delivered", label: "تم التسليم" },
  ];

  /* ============================================================
     🆕 chainBlockMessage(chainStatus) — رسالة واضحة للصيدلي تشرح
     ليه زرار "خرج للتوصيل" متعطّل دلوقتي بسبب سلسلة تنفيذ جزئي.
     ------------------------------------------------------------
     reason === "pending"  → لسه فيه صنف/طلب فرعي في السلسلة معلّق
                              (مفيش صيدلية اتعينت له لسه).
     reason === "other"    → صيدلية تانية عندها جزء من نفس الطلب
                              ولسه ما وصلتش لخطوة "خرج للتوصيل".
     ============================================================ */
  function chainBlockMessage(chainStatus) {
    if (!chainStatus || !chainStatus.blocked) return "";
    if (chainStatus.reason === "pending") {
      return "لسه في أصناف ناقصة من نفس الطلب مستنية تتعين لصيدلية تانية — استنى لحد ما تتحسم (تتقبل أو يتأكد إنها مش متوفرة في السوق) قبل ما تقدر تبعت الطلب لشركة الشحن.";
    }
    return `الطلب ده جزء من تنفيذ جزئي — لازم ${esc(chainStatus.pharmacyName || "الصيدلية التانية")} تخلّص باقي أصناف الطلب الأول (لحد ما توصل هي كمان لـ"خرج للتوصيل")، وبعدين تقدر تبعت طلبك لشركة الشحن.`;
  }

  function renderWorkflowButtons(o) {
    const seq = WORKFLOW_STEPS.map((s) => s.key);
    const currentIdx = seq.indexOf(o.workflowStatus);
    const isTerminal = o.workflowStatus === "delivered" || o.workflowStatus === "cancelled";
    const nextIdx = currentIdx + 1;
    /* 🆕 حالة السلسلة (تنفيذ جزئي) — بتتحسب من الكاش المحلي، وبتتفحص
       بس لما "خرج للتوصيل" هي الخطوة التالية، عشان نعطّل الزرار ده
       تحديدًا (مش أي خطوة تانية) ونوضح السبب بدل ما يفضل شغال بالغلط */
    const chainStatus = (nextIdx === seq.indexOf("out_for_delivery") && !isTerminal)
      ? S().chainShippingStatus(o)
      : { blocked: false };

    const stepButtons = WORKFLOW_STEPS.map((item, idx) => {
      const isDone = idx <= currentIdx;
      const isNext = idx === nextIdx && !isTerminal;
      const isChainBlocked = item.key === "out_for_delivery" && isNext && chainStatus.blocked;
      const disabled = !isNext || isChainBlocked;
      const titleAttr = isChainBlocked ? ` title="${esc(chainBlockMessage(chainStatus))}"` : "";
      return `<button class="btn btn-soft btn-sm" data-workflow="${item.key}" ${disabled ? "disabled" : ""}${titleAttr} style="${isDone ? "opacity:.55" : ""}${isChainBlocked ? "opacity:.55;cursor:not-allowed" : ""}">${isDone ? icon("check", 13) + " " : ""}${isChainBlocked ? icon("clock", 13) + " " : ""}${item.label}</button>`;
    }).join("");

    const cancelDisabled = isTerminal;
    const cancelButton = `<button class="btn btn-danger-soft btn-sm" data-workflow="cancelled" ${cancelDisabled ? "disabled" : ""}>${icon("xCircle", 13)} إلغاء الطلب</button>`;

    return { html: stepButtons + cancelButton, chainStatus };
  }

  function detailsHTML(o, user) {
    if (!o.timeline) o.timeline = [{ at: o.createdAt || new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }];
    if (!o.rejectedBy) o.rejectedBy = [];
    if (!o.availableItems) o.availableItems = [];
    if (!o.unavailableItems) o.unavailableItems = [];
    const st = STATUS[o.status] || STATUS.pending;
    const canAct = user.role === "pharmacist" && o.status === "pending" && !o.rejectedBy.includes(user.id);
    /* 🆕 بوتن "غير متوفر في السوق" — بيظهر بس على الطلبات "الفرعية" الناتجة
       عن تنفيذ جزئي سابق (parentOrderId موجود)، مش على أي طلب أصلي كامل.
       الفكرة: الطلب الفرعي ده أصنافه أصلاً كانت "غير متوفرة" عند صيدلية
       سابقة، فلو 5 صيدليات مختلفة ضغطوا عليه هنا (بدل ما يفتحوا Checklist
       التنفيذ الجزئي من جديد) يتبعت تلقائيًا تنبيه نفاد للعميل — نفس آلية
       الـ 5 صيدليات المستخدمة في التنفيذ الجزئي بالظبط (شوف orders.js) */
    const canReportUnavailable = canAct && !!o.parentOrderId;
    const canConfirmReceipt = user.role === "pharmacist" && o.status === "accepted" && o.executionPending && o.pharmacyId === user.id;
    /* بعد التعديل: "closed" هي امتداد طبيعي لـ "accepted" (الطلب خرج للتوصيل واتقفل)
       فلازم الصيدلي المسؤول عنه يفضل يقدر يشوف تفاصيله ويكمل خطوة "تم التسليم" لو لسه ماوصلتش.
       🆕 (تعديل): "partial" (تنفيذ جزئي) ما بقاش بيدخل هنا أصلاً — صيدلية التنفيذ الجزئي
       معندهاش تحكم في الـ workflow، الطلب هيتشحن مع باقي السلسلة أوتوماتيك لما الصيدلية
       اللي كملت الباقي (accepted كامل) توصل لـ"خرج للتوصيل" — شوف الشرح تحت partialInfoBannerHTML */
    const canManageWorkflow = user.role === "pharmacist" && (o.status === "accepted" || o.status === "closed") && o.pharmacyId === user.id;
    const canShowPhone = user.role === "admin" || ((o.status === "accepted" || o.status === "partial" || o.status === "closed") && o.pharmacyId === user.id);
    const capacityReached = user.role === "pharmacist" && o.status === "pending" && !S().canAcceptOrder(user);
    const workflowStateMap = { awaiting_receipt: "في انتظار تأكيد الاستلام", received: "تم استلام الطلب", preparing: "جاري التجهيز", ready: "جاهز للتوصيل", out_for_delivery: "خرج للتوصيل", delivered: "تم التسليم", cancelled: "إلغاء الطلب" };
    const executionHint = o.executionPending && o.executionDeadline
      ? `متبقي ${Math.max(0, Math.ceil((new Date(o.executionDeadline).getTime() - Date.now()) / 60000))} دقيقة لتنفيذ الطلب`
      : o.executionCompleted
        ? "تم تنفيذ الطلب بنجاح"
        : o.executionFailed
          ? "انتهت مهلة التنفيذ — عاد الطلب إلى قائمة الانتظار"
          : "";

    const medsSection = o.status === "partial" || o.status === "accepted" || o.status === "closed"
      ? `
        <div style="margin-top:6px">
          <div class="bold" style="margin-bottom:9px;color:#047857">${icon("checkCircle", 15)} الأدوية المتوفرة (${o.availableItems.length})</div>
          <div class="med-chips" style="margin-bottom:14px">${o.availableItems.map((m) => `<span class="med-chip ok">${icon("check", 13)} ${medLabel(m)}</span>`).join("") || '<span class="muted small">—</span>'}</div>
          ${o.unavailableItems.length ? `
            <div class="bold" style="margin-bottom:9px;color:#b91c1c">${icon("xCircle", 15)} الأدوية غير المتوفرة (${o.unavailableItems.length})</div>
            <div class="med-chips">${o.unavailableItems.map((m) => `<span class="med-chip no">${icon("x", 13)} ${medLabel(m)}</span>`).join("")}</div>` : ""}
        </div>`
      : `<div class="med-chips">${o.items.map((m) => `<span class="med-chip">${icon("pill", 13)} ${medLabel(m)}</span>`).join("")}</div>`;

    // التحقق الآمن والسليم لعرض صورة الروشتة أو رسالة بديلة في حال عدم توفر رابط صحيح
    const rxImg = o.prescriptionImage;
    const hasValidImage = rxImg && typeof rxImg === "string" && rxImg.trim() !== "" && rxImg !== "undefined" && (rxImg.startsWith("http") || rxImg.startsWith("data:image") || rxImg.startsWith("/"));

    const rxImageHTML = hasValidImage
      ? `<div class="rx-image" id="rx-view"><img src="${esc(rxImg)}" alt="روشتة العميل" /></div>
         <div class="small muted" style="margin-top:9px;text-align:center">اضغط على الصورة للتكبير</div>`
      : `<div class="rx-empty">${icon("image", 30, 1.5)} لم يتم إرفاق صورة روشتة صحيحة<span class="small">الطلب تم كتابة أصنافه نصياً فقط</span></div>`;

    /* 🆕 لو الطلب ده "ابن" ناتج عن تقسيم طلب أقدم أثناء تنفيذ جزئي،
       نعرض رابط واضح للطلب الأصلي فوق تفاصيل الطلب */
    const parentLinkHTML = o.parentOrderId
      ? `<div class="small muted" style="margin-top:4px">${icon("split", 13)} أصناف ناقصة أُعيد طرحها من الطلب <a href="#/orders/${esc(o.parentOrderId)}" style="color:var(--sky-700);font-weight:700">#${esc(o.parentOrderId)}</a></div>`
      : "";

    /* 🆕 بيانات زرار الـ workflow + حالة السلسلة (لعرض بانر تحذيري لو
       "خرج للتوصيل" هي الخطوة الجاية ومحجوبة بسبب صيدلية تانية) */
    const workflowBtns = canManageWorkflow ? renderWorkflowButtons(o) : { html: "", chainStatus: { blocked: false } };
    const chainBannerHTML = canManageWorkflow && workflowBtns.chainStatus.blocked
      ? `<div class="small" style="margin-top:12px;padding:10px 13px;border-radius:var(--r-sm);background:#fef3c7;color:#92400e;display:flex;align-items:flex-start;gap:8px">${icon("alert", 15)} <span>${chainBlockMessage(workflowBtns.chainStatus)}</span></div>`
      : "";

    /* 🆕 بانر توضيحي للصيدلية اللي عملت تنفيذ جزئي — معندهاش تحكم في
       الـ workflow خالص، بس بتفهم إن الطلب هيتشحن أوتوماتيك لما الصيدلية
       اللي هتكمّل باقي الأصناف توصل لـ"خرج للتوصيل" */
    const partialInfoBannerHTML = (user.role === "pharmacist" && o.status === "partial" && o.pharmacyId === user.id)
      ? `
        <div class="card" style="margin-bottom:20px;border:1.5px solid var(--sky-100);background:linear-gradient(135deg,var(--sky-50),#fff)">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="flex-shrink:0;color:var(--sky-700)">${icon("info", 20)}</div>
            <div>
              <div class="bold" style="font-size:14.5px;margin-bottom:3px">تم تسجيل تنفيذك الجزئي بنجاح</div>
              <div class="small muted">الأصناف الناقصة أُعيد طرحها على باقي الصيادلة. بمجرد ما صيدلية تانية تكمّل باقي الطلب وتدوس "خرج للتوصيل"، هيتبعت الطلب بالكامل (نصيبك + نصيبها) لشركة الشحن تلقائيًا — مفيش أي إجراء إضافي مطلوب منك.</div>
            </div>
          </div>
        </div>`
      : "";

    return `
      <div class="page-anim">
        <div style="margin-bottom:18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <a href="#/orders" class="icon-btn" title="رجوع للطلبات">${icon("arrowLeft", 18)}</a>
          <div style="flex:1">
            <div style="font-size:19px;font-weight:900">الطلب <span style="color:var(--sky-700)">#${esc(o.id)}</span></div>
            <div class="small muted">${fmtDateTime(o.createdAt)} (${timeAgo(o.createdAt)})</div>
            ${parentLinkHTML}
          </div>
          ${statusBadge(o.status)}
        </div>

        ${canAct ? `
        <div class="card" style="margin-bottom:20px;border:1.5px solid var(--sky-100);background:linear-gradient(135deg,var(--sky-50),#fff)">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <div style="flex:1;min-width:220px">
              <div class="bold" style="font-size:15.5px">إجراء سريع على الطلب</div>
              <div class="small muted">بمجرد القبول، التنفيذ الجزئي، أو الاعتذار يختفي الطلب من باقي الصيادلة (أو تظهر الأصناف الناقصة فقط في طلب جديد)</div>
            </div>
            <div style="display:flex;gap:9px;flex-wrap:wrap">
              ${canConfirmReceipt ? `<button class="btn btn-success" id="act-receive">${icon("checkCircle", 17)} تأكيد الاستلام</button>` : ""}
              ${canAct ? `<button class="btn btn-success" id="act-accept" ${capacityReached ? "disabled" : ""}>${icon("checkCircle", 17)} قبول الطلب بالكامل</button>` : ""}
              ${canAct ? `<button class="btn btn-soft" id="act-partial" ${capacityReached ? "disabled" : ""}>${icon("split", 17)} تنفيذ جزئي (Checklist)</button>` : ""}
              ${canAct ? `<button class="btn btn-danger-soft" id="act-reject" ${capacityReached ? "disabled" : ""}>${icon("xCircle", 17)} لا أستطيع التنفيذ</button>` : ""}
              ${canReportUnavailable ? `<button class="btn btn-danger-soft" id="act-unavailable">${icon("alert", 17)} غير متوفر في السوق</button>` : ""}
            </div>
          </div>
        </div>` : ""}

        ${partialInfoBannerHTML}

        ${canManageWorkflow ? `
        <div class="card" style="margin-bottom:20px">
          <div class="card-head">
            <div class="card-title">${icon("clipboard", 20)} Active Orders — تغيير الحالة</div>
            <span class="badge badge-info">${esc(workflowStateMap[o.workflowStatus] || workflowStateMap.awaiting_receipt)}</span>
          </div>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            ${workflowBtns.html}
          </div>
          ${chainBannerHTML}
          <p class="small muted" style="margin:12px 0 0">كل خطوة تتطلب تأكيدًا ولا يمكن الرجوع إليها بعد إتمامها — يجب اتباع الترتيب خطوة بخطوة.</p>
        </div>` : ""}

        <div class="detail-grid">
          <div style="display:flex;flex-direction:column;gap:20px">
            <div class="card">
              <div class="card-head"><div class="card-title">${icon("user", 20)} بيانات العميل</div></div>
              <div class="info-list">
                <div class="info-row"><div class="i-ico">${icon("user", 18)}</div><div><div class="i-label">اسم العميل</div><div class="i-value">${esc(o.customerName)}</div></div></div>
                ${canShowPhone ? `<div class="info-row"><div class="i-ico">${icon("phone", 18)}</div><div><div class="i-label">رقم الهاتف</div><div class="i-value mono" dir="ltr">${esc(o.phone)}</div></div></div>` : ""}
                <div class="info-row"><div class="i-ico">${icon("pin", 18)}</div><div><div class="i-label">العنوان</div><div class="i-value">${esc(o.address)}</div></div></div>
                <div class="info-row"><div class="i-ico">${icon("store", 18)}</div><div><div class="i-label">الصيدلية المنفذة</div><div class="i-value">${o.pharmacyName ? esc(o.pharmacyName) : '<span class="muted">لم يُسند بعد</span>'}</div></div></div>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title">${icon("pill", 20)} الأدوية المطلوبة (${o.items.length})</div></div>
              ${medsSection}
              ${o.price != null ? `
                <div class="price-box" style="margin-top:18px">
                  <span class="p-label">${icon("coins", 17)} السعر الإجمالي</span>
                  <span class="p-value">${fmtMoney(o.price)}</span>
                </div>` : ""}
              ${o.notes ? `
                <div style="margin-top:14px;background:var(--bg-soft);border-radius:var(--r-sm);padding:13px 15px">
                  <div class="bold small" style="color:var(--sky-700);margin-bottom:4px">${icon("note", 14)} ملاحظات الصيدلي</div>
                  <div style="font-size:14px">${esc(o.notes)}</div>
                </div>` : ""}
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title">${icon("activity", 20)} سجل الطلب</div></div>
              <div class="timeline">
                ${o.timeline.map((t) => `
                  <div class="tl-item" style="--tlc:${t.color || "#0ea5e9"}">
                    <div class="tl-text">${esc(t.text)}</div>
                    <div class="tl-time">${fmtDateTime(t.at)}</div>
                  </div>`).join("")}
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:20px">
            <div class="card">
              <div class="card-head"><div class="card-title">${icon("image", 20)} صورة الروشتة</div></div>
              ${rxImageHTML}
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title">${icon("hash", 20)} ملخص</div></div>
              <div class="info-list">
                <div class="info-row"><div class="i-ico">${icon("hash", 17)}</div><div><div class="i-label">رقم الطلب</div><div class="i-value">#${esc(o.id)}</div></div></div>
                <div class="info-row"><div class="i-ico">${icon("pill", 17)}</div><div><div class="i-label">عدد الأدوية</div><div class="i-value">${o.items.length} صنف</div></div></div>
                <div class="info-row"><div class="i-ico">${icon("clock", 17)}</div><div><div class="i-label">حالة الطلب</div><div class="i-value">${statusBadge(o.status)}</div></div></div>
                ${executionHint ? `<div class="info-row"><div class="i-ico">${icon("timer", 17)}</div><div><div class="i-label">مهلة التنفيذ</div><div class="i-value">${esc(executionHint)}</div></div></div>` : ""}
                ${o.rejectedBy.length ? `<div class="info-row"><div class="i-ico">${icon("xCircle", 17)}</div><div><div class="i-label">اعتذر عنه</div><div class="i-value">${o.rejectedBy.length} صيدلية</div></div></div>` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ============================================================
     نافذة التنفيذ الجزئي (Checklist) — تحديد الأصناف المتوفرة والسعر
     ------------------------------------------------------------
     🆕 علامة ✓ = الصنف متوفر عند الصيدلية (بيتقبل ويتنفذ بالسعر
     المُدخل). علامة ✗ (Checkbox فاضي) = الصنف مش متوفر، وبيتحول
     تلقائيًا (من الباك إند) لطلب جديد لنفس العميل يظهر لباقي
     الصيادلة، أو يتحول لتنبيه "نفاد من السوق" للعميل لو 5 صيدليات
     مختلفة اعتذرت عن نفس الصنف عبر سلسلة الطلب دي.

     بما إن o.items ممكن يبقوا objects {name, unit} دلوقتي، الـ
     checkbox value بقى index الصنف جوه o.items بدل قيمة نصية مباشرة
     (عشان attribute الـ value لازم يبقى سترينج بسيط)، وبعدين بنرجع
     نجيب العنصر الأصلي بالـ index وقت الحفظ.
     ============================================================ */
  function openPartialModal(o, user) {
    modal({
      title: `تنفيذ جزئي (Checklist) — الطلب #${esc(o.id)}`,
      icon: "split",
      body: `
        <p class="small muted" style="margin-bottom:12px">علّم بـ (✓) على الأدوية المتوفرة لديك من أصل ${o.items.length} صنف — الباقي هيتحول تلقائيًا لطلب جديد لباقي الصيادلة</p>
        <div id="pm-items" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          ${o.items.map((m, i) => `
            <label style="display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid var(--line);border-radius:var(--r-sm);cursor:pointer">
              <input type="checkbox" class="pm-item-check" value="${i}" data-idx="${i}" checked />
              <span>${medLabel(m)}</span>
            </label>`).join("")}
        </div>
        <div class="field" style="margin-bottom:10px"><label>السعر الإجمالي للأصناف المتوفرة (جنيه)</label>
          <input class="input" id="pm-price" type="number" min="0" placeholder="مثال: 150" /></div>
        <div class="field" style="margin:0"><label>ملاحظات (اختياري)</label>
          <input class="input" id="pm-notes" placeholder="أي ملاحظات إضافية..." /></div>
        <div id="pm-error" class="login-error" style="margin-top:12px"></div>`,
      footer: `
        <button class="btn btn-primary" id="pm-save">${icon("check", 16)} تأكيد التنفيذ الجزئي</button>
        <button class="btn btn-ghost" id="pm-cancel">إلغاء</button>`,
      onOpen(overlay, close) {
        overlay.querySelector("#pm-cancel").onclick = close;
        overlay.querySelector("#pm-save").onclick = async () => {
          const err = overlay.querySelector("#pm-error");
          const fail = (m) => { err.textContent = m; err.classList.add("show"); };
          const saveBtn = overlay.querySelector("#pm-save");

          const checkedIdx = [...overlay.querySelectorAll(".pm-item-check:checked")].map((c) => Number(c.value));
          const allIdx = o.items.map((_, i) => i);
          const uncheckedIdx = allIdx.filter((i) => !checkedIdx.includes(i));
          const checked = checkedIdx.map((i) => o.items[i]);
          const unchecked = uncheckedIdx.map((i) => o.items[i]);
          const price = Number(overlay.querySelector("#pm-price").value);
          const notes = overlay.querySelector("#pm-notes").value.trim();

          if (!checked.length) return fail("حدد صنفًا واحدًا على الأقل كمتوفر (✓)");
          if (!unchecked.length) return fail("لو كل الأصناف متوفرة استخدم زر «قبول الطلب بالكامل» بدلاً من التنفيذ الجزئي");
          if (!Number.isFinite(price) || price <= 0) return fail("أدخل سعرًا صحيحًا أكبر من صفر");

          saveBtn.disabled = true;
          const originalLabel = saveBtn.innerHTML;
          saveBtn.innerHTML = `${icon("clock", 16)} جاري التنفيذ...`;

          const result = await S().partialOrder(o.id, user, checked, unchecked, price, notes);

          if (!result) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalLabel;
            return fail("تعذر تنفيذ العملية، حاول مرة أخرى");
          }

          close();
          toast("تم تنفيذ الطلب جزئيًا", `#${o.id}`, "success");
          if (result.childOrderId) {
            toast("أصناف ناقصة أُعيدت لباقي الصيادلة", `طلب جديد #${result.childOrderId}`, "info");
          }
          if (Array.isArray(result.shortageAlerts) && result.shortageAlerts.length) {
            toast("تم إبلاغ العميل بنفاد دواء من السوق", result.shortageAlerts.join("، "), "warning", 7500);
          }
          App.router.refresh();
        };
      },
    });
  }

  /* ============================================================
     نافذة إدخال السعر الإجمالي قبل خطوة "خرج للتوصيل"
     (للطلبات المقبولة بالكامل التي لم يُحدد سعرها بعد — تُرسل مع شركة الشحن)
     ============================================================ */
  function openShippingPriceModal(o, onConfirmed) {
    modal({
      title: `تأكيد الشحن — الطلب #${esc(o.id)}`,
      icon: "coins",
      body: `
        <p class="small muted" style="margin-bottom:12px">أدخل السعر الإجمالي للطلب — سيتم إرساله مع شركة الشحن فور خروج الطلب للتوصيل.</p>
        <div class="field" style="margin:0"><label>السعر الإجمالي (جنيه) <span class="req">*</span></label>
          <input class="input" id="sp-price" type="number" min="0" placeholder="مثال: 150" /></div>
        <div id="sp-error" class="login-error" style="margin-top:12px"></div>`,
      footer: `
        <button class="btn btn-primary" id="sp-save">${icon("check", 16)} تأكيد الشحن</button>
        <button class="btn btn-ghost" id="sp-cancel">إلغاء</button>`,
      onOpen(overlay, close) {
        overlay.querySelector("#sp-cancel").onclick = close;
        overlay.querySelector("#sp-save").onclick = () => {
          const err = overlay.querySelector("#sp-error");
          const fail = (m) => { err.textContent = m; err.classList.add("show"); };
          const price = Number(overlay.querySelector("#sp-price").value);
          if (!Number.isFinite(price) || price <= 0) return fail("أدخل سعرًا صحيحًا أكبر من صفر");
          close();
          onConfirmed(price);
        };
      },
    });
  }

  /* ============================================================
     🆕 نافذة تأكيد الإبلاغ عن عدم توفر طلب "فرعي" في السوق
     ------------------------------------------------------------
     بتفتح لما الصيدلي يدوس على بوتن "غير متوفر في السوق" — ده
     تأكيد بسيط (زي reject) بس بيوضّح إن ده بيسجّل بلاغ نقص لكل
     أصناف الطلب، وممكن يتبعت تنبيه تلقائي للعميل لو وصل العدد لـ 5
     ============================================================ */
  function confirmReportUnavailable(o, user, refresh) {
    confirmModal({
      title: "الإبلاغ عن عدم توفر في السوق",
      icon: "alert",
      danger: true,
      message: `هل أنت متأكد إن أصناف الطلب <b>#${esc(o.id)}</b> دي مش متوفرة عندك أو في السوق حاليًا؟ سيتم تسجيل بلاغ نقص لهذه الأصناف، ولو وصل عدد الصيدليات المبلّغة لـ 5 صيدليات مختلفة سيتم إبلاغ العميل تلقائيًا بنفاد الدواء.`,
      confirmText: "نعم، أبلغ عن عدم التوفر",
      async onConfirm() {
        const result = await S().reportUnavailableInMarket(o.id, user);
        if (result) {
          toast("تم تسجيل البلاغ", `#${o.id}`, "warning");
          if (Array.isArray(result.shortageAlerts) && result.shortageAlerts.length) {
            toast("تم إبلاغ العميل بنفاد دواء من السوق", result.shortageAlerts.join("، "), "warning", 7500);
          }
        } else {
          toast("تعذر تسجيل البلاغ", "قد يكون الطلب تم التعامل معه بالفعل", "error");
        }
        refresh();
      },
    });
  }

  /* ============================================================
     تكبير صورة الروشتة — لايت بوكس بسيط بدون كارت/عنوان/تعتيم خلفية
     (الصورة تظهر في نص الشاشة فقط، والضغط في أي مكان أو Esc يقفلها)
     ============================================================ */
  function openPrescriptionImageModal(imgSrc) {
    const root = document.getElementById("modal-root");
    const overlay = document.createElement("div");
    overlay.className = "rx-lightbox";
    overlay.innerHTML = `
      <button class="rx-lightbox-close" aria-label="إغلاق">${icon("x", 22)}</button>
      <img src="${esc(imgSrc)}" alt="روشتة العميل" />`;
    root.appendChild(overlay);

    const close = () => { overlay.classList.add("out"); setTimeout(() => overlay.remove(), 160); };
    overlay.querySelector(".rx-lightbox-close").onclick = close;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
  }

  App.pages.orderDetails = {
    title: "تفاصيل الطلب",
    crumb: "عرض وإدارة الطلب",
    render(user, param) {
      const order = S().getOrder(param);
      if (!order) return emptyState("search", "الطلب غير موجود", "عذرًا، لم يتم العثور على الطلب المطلوب");
      return detailsHTML(order, user);
    },
    mount(user, param) {
      const o = S().getOrder(param);
      if (!o) return;

      /* ============================================================
         🆕 جلب التايملاين الحقيقي فور فتح صفحة التفاصيل
         ------------------------------------------------------------
         GET /orders (اللي بيملى الكاش المحلي عبر syncOrders) مش بيرجع
         عمود timeline خالص، فالكارت بيظهر بالتايملاين الافتراضي بس
         (سطر واحد "تم استلام الطلب من الشات بوت"). هنا بنستدعي
         GET /orders/:id (اللي فيه التايملاين الكامل) ونحدّث عنصر
         .timeline في الـ DOM لو فيه فرق فعلي — من غير ما نعمل
         App.router.refresh() كامل عشان منقطعش على المستخدم لو كان
         بيعمل حاجة تانية في الصفحة (زي فتح مودال).
         ============================================================ */
      S().fetchOrderTimeline(param).then((changed) => {
        if (!changed) return;
        if (location.hash !== "#/orders/" + param) return; // المستخدم غيّر الصفحة قبل ما الطلب يرجع
        const fresh = S().getOrder(param);
        const timelineEl = document.querySelector(".timeline");
        if (timelineEl && fresh && fresh.timeline) {
          timelineEl.innerHTML = fresh.timeline.map((t) => `
            <div class="tl-item" style="--tlc:${t.color || "#0ea5e9"}">
              <div class="tl-text">${esc(t.text)}</div>
              <div class="tl-time">${fmtDateTime(t.at)}</div>
            </div>`).join("");
        }
      });

      const refresh = () => App.router.refresh();

      /* فتح/تكبير صورة الروشتة عند الضغط عليها */
      const rxView = document.getElementById("rx-view");
      if (rxView) {
        rxView.onclick = () => {
          const img = rxView.querySelector("img");
          if (!img || !img.getAttribute("src")) return;
          openPrescriptionImageModal(img.getAttribute("src"));
        };
      }

      /* قبول الطلب بالكامل — يتطلب تأكيدًا، ولا يمكن التراجع عنه بعد القبول */
      const acceptBtn = document.getElementById("act-accept");
      if (acceptBtn) acceptBtn.onclick = () => {
        confirmModal({
          title: "تأكيد قبول الطلب",
          icon: "checkCircle",
          message: `هل أنت متأكد من قبول الطلب <b>#${esc(o.id)}</b> بالكامل؟ سيصبح هذا الطلب مسؤوليتك ولن يظهر بعدها لباقي الصيادلة.`,
          confirmText: "نعم، قبول الطلب",
          onConfirm() {
            const result = S().acceptOrder(o.id, user);
            if (result) {
              toast("تم قبول الطلب بنجاح", `#${o.id}`, "success");
            } else {
              toast("تعذر قبول الطلب", "ربما وصلت للحد الأقصى من الطلبات النشطة أو تم التعامل معه بالفعل", "error");
            }
            refresh();
          },
        });
      };

      /* الاعتذار عن تنفيذ الطلب — يتطلب تأكيدًا، ولا يمكن التراجع عنه */
      const rejectBtn = document.getElementById("act-reject");
      if (rejectBtn) rejectBtn.onclick = () => {
        confirmModal({
          title: "الاعتذار عن تنفيذ الطلب",
          icon: "xCircle",
          danger: true,
          message: `هل أنت متأكد من الاعتذار عن تنفيذ الطلب <b>#${esc(o.id)}</b>؟ سيظل الطلب ظاهرًا لباقي الصيادلة ولن تتمكن من التراجع عن الاعتذار.`,
          confirmText: "نعم، اعتذار",
          onConfirm() {
            S().rejectOrder(o.id, user);
            toast("تم الاعتذار عن الطلب", `#${o.id}`, "warning");
            refresh();
          },
        });
      };

      /* 🆕 الإبلاغ عن عدم توفر الطلب "الفرعي" في السوق (بوتن رابع) —
         متاح فقط للطلبات الناتجة عن تنفيذ جزئي سابق (parentOrderId) */
      const unavailableBtn = document.getElementById("act-unavailable");
      if (unavailableBtn) unavailableBtn.onclick = () => confirmReportUnavailable(o, user, refresh);

      /* تأكيد استلام الطلب (بعد القبول) — يتطلب تأكيدًا، خطوة تُنفّذ مرة واحدة فقط */
      const receiveBtn = document.getElementById("act-receive");
      if (receiveBtn) receiveBtn.onclick = () => {
        confirmModal({
          title: "تأكيد استلام الطلب",
          icon: "checkCircle",
          message: `هل تؤكد استلام الطلب <b>#${esc(o.id)}</b> فعليًا؟ لا يمكن التراجع عن هذه الخطوة بعد التأكيد.`,
          confirmText: "نعم، تأكيد الاستلام",
          onConfirm() {
            const result = S().confirmReceiptOrder(o.id, user);
            if (result) {
              toast("تم تأكيد استلام الطلب", `#${o.id}`, "success");
            } else {
              toast("تعذر تأكيد الاستلام", "", "error");
            }
            refresh();
          },
        });
      };

      /* 🆕 التنفيذ الجزئي (Checklist) — يفتح نافذة لاختيار الأصناف المتوفرة
         والسعر؛ الباك إند هو اللي بيتولى تقسيم الطلب واحتساب نقص السوق */
      const partialBtn = document.getElementById("act-partial");
      if (partialBtn) partialBtn.onclick = () => openPartialModal(o, user);

      /* أزرار تغيير حالة سير العمل (استلام / تجهيز / جاهز / خرج للتوصيل / تسليم / إلغاء)
         — ترتيب إجباري: خطوة واحدة تالية فقط متاحة، وكل خطوة تتطلب تأكيدًا نهائيًا
         — عند "خرج للتوصيل": لو الطلب مقبول بالكامل بدون سعر، تُفتح نافذة السعر أولًا
         — نفس اللحظة دي الطلب بيتقفل تلقائيًا (status = "closed") من الباك إند
         — 🆕 (تعديل) هذه الأزرار بقت خاصة بالطلبات "accepted/closed" فقط —
           طلبات "partial" ما بقاش ليها أي زرار workflow أصلاً (شوف canManageWorkflow فوق)
         — 🆕🆕 (حجب "خرج للتوصيل" بسبب سلسلة تنفيذ جزئي): قبل أي حاجة، لو الزرار
           اللي اتدوس عليه هو "out_for_delivery"، بنعيد التحقق من chainShippingStatus
           لحظيًا (مش بس وقت الرسم) — لأن حالة السلسلة ممكن تتغير بين لحظة فتح
           الصفحة ولحظة الضغط الفعلي (مزامنة كل 6 ثواني). لو لسه محجوب، بنوقف
           هنا بتوست واضح ومنفتحش أي مودال (سعر/تأكيد) خالص. */
      document.querySelectorAll("[data-workflow]").forEach((btn) => {
        btn.onclick = () => {
          const key = btn.dataset.workflow;
          const labelMap = {
            received: "تم استلام الطلب",
            preparing: "جاري التجهيز",
            ready: "جاهز للتوصيل",
            out_for_delivery: "خرج للتوصيل",
            delivered: "تم التسليم",
            cancelled: "إلغاء الطلب",
          };

          /* 🆕 حاجز أمان أخير قبل فتح أي مودال لخطوة "خرج للتوصيل" */
          if (key === "out_for_delivery") {
            const liveChainStatus = S().chainShippingStatus(o);
            if (liveChainStatus.blocked) {
              toast("لا يمكن الشحن الآن", chainBlockMessage(liveChainStatus), "warning", 7000);
              refresh();
              return;
            }
          }

          const applyStatus = (price) => {
            const result = S().updateOrderWorkflowStatus(o.id, user, key, price);
            /* 🆕 نتيجة "blocked" (سلسلة تنفيذ جزئي لسه معلّقة) لازم تتفرّق
               عن نتيجة النجاح — قبل كده كانت { blocked: true, ... } بتتحسب
               "نجاح" غلط لأنها object صحيح (truthy)، فالتوست كان بيقول
               "تم الشحن" من غير ما تتحدث أي بيانات فعليًا */
            if (result && result.blocked) {
              toast("لا يمكن الشحن الآن", chainBlockMessage(result), "warning", 7000);
            } else if (result) {
              toast("تم تحديث حالة الطلب", labelMap[key], "success");
            } else {
              toast("تعذر تحديث حالة الطلب", "قد تكون هذه الخطوة تمت بالفعل أو غير مسموحة الآن", "error");
            }
            refresh();
          };

          /* خطوة الشحن تتطلب إدخال السعر الإجمالي أولاً إن لم يكن محددًا (طلب كامل غير جزئي) */
          if (key === "out_for_delivery" && o.price == null) {
            openShippingPriceModal(o, (price) => {
              confirmModal({
                title: "تأكيد خروج الطلب للتوصيل",
                icon: "checkCircle",
                message: `هل تؤكد خروج الطلب <b>#${esc(o.id)}</b> للتوصيل بسعر إجمالي <b>${esc(String(price))} جنيه</b>؟ سيتم إبلاغ شركة الشحن فورًا ولا يمكن التراجع عن هذه الخطوة.`,
                confirmText: "نعم، تأكيد الشحن",
                onConfirm() { applyStatus(price); },
              });
            });
            return;
          }

          confirmModal({
            title: `تأكيد: ${labelMap[key]}`,
            icon: key === "cancelled" ? "ban" : "checkCircle",
            danger: key === "cancelled",
            message: `هل أنت متأكد من تحديث حالة الطلب <b>#${esc(o.id)}</b> إلى «${labelMap[key]}»؟ لا يمكن التراجع عن هذه الخطوة بعد التأكيد.`,
            confirmText: "نعم، تأكيد",
            onConfirm() { applyStatus(null); },
          });
        };
      });
    }
  };
})();
