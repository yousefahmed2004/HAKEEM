/* ============================================================
   pages1.js — لوحة التحكم + الطلبات + تفاصيل الطلب + طلباتي
   ============================================================ */
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  const { icon, esc, statusBadge, avatar, fmtDateTime, timeAgo, fmtMoney, fmtNum, emptyState, toast, modal, confirmModal, STATUS } = App.ui;
  const S = () => App.store;

  /* ============================================================
     مكونات مشتركة
     ============================================================ */
  function orderCard(o, { showPharmacy = true, showPhone = false } = {}) {
    const st = STATUS[o.status] || STATUS.pending;
    const meds = o.items.slice(0, 4).map((m) => `<span class="med-chip">${icon("pill", 12)} ${esc(m)}</span>`).join("");
    const more = o.items.length > 4 ? `<span class="med-chip more">+${o.items.length - 4}</span>` : "";
    const phoneRow = showPhone && o.status === "accepted"
      ? `<div>${icon("phone", 14)} <span class="mono" dir="ltr">${esc(o.phone)}</span></div>`
      : "";
    return `
      <div class="order-card" style="--oc:${st.color}" data-order="${o.id}">
        <div class="oc-head">
          <span class="oc-id">#${esc(o.id)}</span>
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
                <td class="td-id cell-main" data-label="رقم الطلب" style="color:var(--sky-700)">#${esc(o.id)}</td>
                <td class="td-customer" data-label="العميل">
                  <div class="cell-main">${esc(o.customerName)}</div>
                  <div class="cell-sub">${esc(o.address)}</div>
                </td>
                <td class="td-phone mono" data-label="الهاتف" dir="ltr" style="text-align:right">${showPhone || o.status === "accepted" ? esc(o.phone) : '<span class="muted small">—</span>'}</td>
                <td class="td-meds" data-label="الأدوية"><div class="med-chips">${o.items.slice(0, 2).map((m) => `<span class="med-chip">${esc(m)}</span>`).join("")}${o.items.length > 2 ? `<span class="med-chip more">+${o.items.length - 2}</span>` : ""}</div></td>
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

  App.shared = { orderCard, ordersTable };

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
    all.forEach((o) => counts[o.status] !== undefined && counts[o.status]++);
    document.querySelectorAll("[data-count]").forEach((el) => { el.textContent = fmtNum(counts[el.dataset.count]); });

    let list = ordersFilter.tab === "all" ? all : all.filter((o) => o.status === ordersFilter.tab);
    const q = ordersFilter.q.trim().toLowerCase();
    if (q) list = list.filter((o) =>
      o.id.includes(q) || o.customerName.toLowerCase().includes(q) ||
      o.phone.includes(q) || o.items.some((m) => m.toLowerCase().includes(q)) ||
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

  function detailsHTML(o, user) {
    if (!o.timeline) o.timeline = [{ at: o.createdAt || new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }];
    if (!o.rejectedBy) o.rejectedBy = [];
    if (!o.availableItems) o.availableItems = [];
    if (!o.unavailableItems) o.unavailableItems = [];
    const st = STATUS[o.status] || STATUS.pending;
    const canAct = user.role === "pharmacist" && o.status === "pending" && !o.rejectedBy.includes(user.id);
    const canConfirmReceipt = user.role === "pharmacist" && o.status === "accepted" && o.executionPending && o.pharmacyId === user.id;
    const canManageWorkflow = user.role === "pharmacist" && o.status === "accepted" && o.pharmacyId === user.id;
    const canShowPhone = user.role === "admin" || (o.status === "accepted" && o.pharmacyId === user.id);
    const capacityReached = user.role === "pharmacist" && o.status === "pending" && !S().canAcceptOrder(user);
    const workflowStateMap = { awaiting_receipt: "في انتظار تأكيد الاستلام", received: "تم استلام الطلب", preparing: "جاري التجهيز", ready: "جاهز للتوصيل", out_for_delivery: "خرج للتوصيل", delivered: "تم التسليم", cancelled: "إلغاء الطلب" };
    const executionHint = o.executionPending && o.executionDeadline
      ? `متبقي ${Math.max(0, Math.ceil((new Date(o.executionDeadline).getTime() - Date.now()) / 60000))} دقيقة لتنفيذ الطلب`
      : o.executionCompleted
        ? "تم تنفيذ الطلب بنجاح"
        : o.executionFailed
          ? "انتهت مهلة التنفيذ — عاد الطلب إلى قائمة الانتظار"
          : "";

    const medsSection = o.status === "partial" || o.status === "accepted"
      ? `
        <div style="margin-top:6px">
          <div class="bold" style="margin-bottom:9px;color:#047857">${icon("checkCircle", 15)} الأدوية المتوفرة (${o.availableItems.length})</div>
          <div class="med-chips" style="margin-bottom:14px">${o.availableItems.map((m) => `<span class="med-chip ok">${icon("check", 13)} ${esc(m)}</span>`).join("") || '<span class="muted small">—</span>'}</div>
          ${o.unavailableItems.length ? `
            <div class="bold" style="margin-bottom:9px;color:#b91c1c">${icon("xCircle", 15)} الأدوية غير المتوفرة (${o.unavailableItems.length})</div>
            <div class="med-chips">${o.unavailableItems.map((m) => `<span class="med-chip no">${icon("x", 13)} ${esc(m)}</span>`).join("")}</div>` : ""}
        </div>`
      : `<div class="med-chips">${o.items.map((m) => `<span class="med-chip">${icon("pill", 13)} ${esc(m)}</span>`).join("")}</div>`;

    // التحقق الآمن لعرض صورة الروشتة لمنع أخطاء 404 أو undefined
    const hasImage = o.prescriptionImage && typeof o.prescriptionImage === "string" && o.prescriptionImage.trim() !== "" && o.prescriptionImage !== "undefined";
    const rxImageHTML = hasImage
      ? `<div class="rx-image" id="rx-view"><img src="${esc(o.prescriptionImage)}" alt="روشتة العميل" /></div>
         <div class="small muted" style="margin-top:9px;text-align:center">اضغط على الصورة للتكبير</div>`
      : `<div class="rx-empty">${icon("image", 30, 1.5)} لم يرفق العميل صورة روشتة<span class="small">تم الطلب بكتابة أسماء الأدوية</span></div>`;

    return `
      <div class="page-anim">
        <div style="margin-bottom:18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <a href="#/orders" class="icon-btn" title="رجوع للطلبات">${icon("arrowLeft", 18)}</a>
          <div style="flex:1">
            <div style="font-size:19px;font-weight:900">الطلب <span style="color:var(--sky-700)">#${esc(o.id)}</span></div>
            <div class="small muted">${fmtDateTime(o.createdAt)} (${timeAgo(o.createdAt)})</div>
          </div>
          ${statusBadge(o.status)}
        </div>

        ${canAct ? `
        <div class="card" style="margin-bottom:20px;border:1.5px solid var(--sky-100);background:linear-gradient(135deg,var(--sky-50),#fff)">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <div style="flex:1;min-width:220px">
              <div class="bold" style="font-size:15.5px">إجراء سريع على الطلب</div>
              <div class="small muted">بمجرد القبول أو التنفيذ الجزئي يختفي الطلب من باقي الصيادلة، ويظهر في صفحة «طلباتي»</div>
            </div>
            <div style="display:flex;gap:9px;flex-wrap:wrap">
              ${canConfirmReceipt ? `<button class="btn btn-success" id="act-receive">${icon("checkCircle", 17)} تأكيد الاستلام</button>` : ""}
              ${canAct ? `<button class="btn btn-success" id="act-accept" ${capacityReached ? "disabled" : ""}>${icon("checkCircle", 17)} قبول الطلب</button>` : ""}
              ${canAct ? `<button class="btn btn-primary" id="act-partial" ${capacityReached ? "disabled" : ""}>${icon("split", 17)} تنفيذ جزئي</button>` : ""}
              ${canAct ? `<button class="btn btn-danger-soft" id="act-reject" ${capacityReached ? "disabled" : ""}>${icon("xCircle", 17)} لا أستطيع التنفيذ</button>` : ""}
            </div>
          </div>
        </div>` : ""}

        ${canManageWorkflow ? `
        <div class="card" style="margin-bottom:20px">
          <div class="card-head">
            <div class="card-title">${icon("clipboard", 20)} Active Orders — تغيير الحالة</div>
            <span class="badge badge-info">${esc(workflowStateMap[o.workflowStatus] || workflowStateMap.awaiting_receipt)}</span>
          </div>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            ${[{ key: "received", label: "تم استلام الطلب" }, { key: "preparing", label: "جاري التجهيز" }, { key: "ready", label: "جاهز للتوصيل" }, { key: "out_for_delivery", label: "خرج للتوصيل" }, { key: "delivered", label: "تم التسليم" }, { key: "cancelled", label: "إلغاء الطلب" }].map((item) => `<button class="btn btn-soft btn-sm" data-workflow="${item.key}" ${o.workflowStatus === item.key ? "disabled" : ""}>${item.label}</button>`).join("")}
          </div>
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
      // ربط الأحداث وإجراءات التفاصيل
    }
  };
})();
