/* ============================================================
   app.js — الموجّه (Router) + الهيكل العام + المحاكاة الحية
   ============================================================ */
window.App = window.App || {};

(function () {
  const { icon, esc, avatar, toast, timeAgo, beep } = App.ui;
  const S = () => App.store;

  /* ============================================================
     عناصر القائمة الجانبية حسب الدور
     ============================================================ */
  function navItems(role) {
    const common = [
      { hash: "#/", icon: "grid", label: "لوحة التحكم", end: true },
      { hash: "#/orders", icon: "clipboard", label: "الطلبات", badge: true },
    ];
    if (role === "admin") {
      return [
        ...common,
        { hash: "#/pharmacists", icon: "users", label: "الصيادلة" },
        { hash: "#/statistics", icon: "chart", label: "الإحصائيات" },
        { hash: "#/medicines", icon: "pill", label: "الأدوية الأكثر طلبًا" },
        { section: "النظام" },
        { hash: "#/settings", icon: "settings", label: "الإعدادات" },
        { hash: "#/profile", icon: "user", label: "الملف الشخصي" },
      ];
    }
    return [
      ...common,
      { hash: "#/my-orders", icon: "clipboard", label: "طلباتي" },
      { section: "الحساب" },
      { hash: "#/profile", icon: "user", label: "الملف الشخصي" },
    ];
  }

  /* ============================================================
     بناء الهيكل العام (Shell)
     ============================================================ */
  function buildShell(user) {
    const items = navItems(user.role);
    document.getElementById("app").innerHTML = `
      <div class="shell">
        <div class="sidebar-overlay" id="sb-overlay"></div>
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-logo">
            <div class="logo-mark">${icon("pill", 24)}</div>
            <div>
              <div class="name">HAKEEM</div>
              <div class="sub">لوحة تحكم الطلبات</div>
            </div>
          </div>
          <nav id="side-nav">
            ${items.map((it) => it.section
      ? `<div class="nav-label">${it.section}</div>`
      : `<a href="${it.hash}" class="nav-link" data-nav="${it.hash}" data-end="${it.end ? 1 : 0}">
                   ${icon(it.icon, 19)} <span>${it.label}</span>
                   ${it.badge ? '<span class="nav-count hidden" id="nav-orders-count"></span>' : ""}
                 </a>`).join("")}
          </nav>
          <div class="sidebar-user">
            ${avatar(user.role === "pharmacist" ? user.pharmacyName : user.name, user.color)}
            <div style="flex:1;min-width:0">
              <div class="u-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(user.role === "pharmacist" ? user.pharmacyName : user.name)}</div>
              <div class="u-role">${user.role === "admin" ? "مدير النظام" : "صيدلي"}</div>
            </div>
            <button class="icon-btn" id="btn-logout" title="تسجيل الخروج" style="width:36px;height:36px;border:none;background:transparent">${icon("logout", 17)}</button>
          </div>
        </aside>

        <div class="main">
          <header class="topbar">
            <button class="icon-btn hamburger" id="btn-menu">${icon("menu", 20)}</button>
            <div style="flex:1;min-width:0">
              <div class="page-title" id="tb-title">لوحة التحكم</div>
              <div class="page-crumb" id="tb-crumb"></div>
            </div>

            <div class="dropdown">
              <button class="icon-btn bell-btn" id="btn-bell">${icon("bell", 19)}<span class="ping hidden" id="bell-ping"></span></button>
              <div class="dropdown-menu notif-menu hidden" id="bell-menu"></div>
            </div>

            <div class="dropdown">
              <button class="icon-btn" id="btn-user" style="width:auto;padding:0;border:none">${avatar(user.role === "pharmacist" ? user.pharmacyName : user.name, user.color, "avatar-sm")}</button>
              <div class="dropdown-menu hidden" id="user-menu" style="min-width:210px">
                <div style="padding:11px 13px 9px">
                  <div class="bold" style="font-size:14px">${esc(user.name)}</div>
                  <div class="small muted">${esc(user.username)}@ — ${user.role === "admin" ? "مدير النظام" : "صيدلي"}</div>
                </div>
                <div class="dd-divider"></div>
                <a class="dd-item" href="#/profile">${icon("user", 17)} الملف الشخصي</a>
                ${user.role === "admin" ? `<a class="dd-item" href="#/settings">${icon("settings", 17)} الإعدادات</a>` : ""}
                <div class="dd-divider"></div>
                <button class="dd-item danger" id="btn-logout-2">${icon("logout", 17)} تسجيل الخروج</button>
              </div>
            </div>
          </header>
          <main class="content" id="view"></main>
        </div>
      </div>`;

    /* أحداث الهيكل */
    document.getElementById("btn-logout").onclick = logout;
    document.getElementById("btn-logout-2").onclick = logout;
    document.getElementById("btn-menu").onclick = () => {
      document.getElementById("sidebar").classList.add("open");
      document.getElementById("sb-overlay").classList.add("show");
    };
    document.getElementById("sb-overlay").onclick = closeSidebar;
    document.getElementById("side-nav").addEventListener("click", closeSidebar);

    setupDropdown("btn-bell", "bell-menu", renderBellMenu);
    setupDropdown("btn-user", "user-menu");
    syncLiveUI();
  }

  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sb-overlay").classList.remove("show");
  }

  function setupDropdown(btnId, menuId, beforeOpen) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = menu.classList.contains("hidden");
      document.querySelectorAll(".dropdown-menu").forEach((m) => m.classList.add("hidden"));
      if (willOpen) {
        if (beforeOpen) beforeOpen();
        menu.classList.remove("hidden");
      }
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) menu.classList.add("hidden");
    });
  }

  function renderBellMenu() {
    const user = S().currentUser();
    const pendings = user.role === "admin"
      ? S().getOrders().filter((o) => o.status === "pending")
      : S().poolFor(user.id);
    const menu = document.getElementById("bell-menu");
    menu.innerHTML = `
      <div class="notif-head">الطلبات المعلقة <span class="badge badge-pending">${pendings.length}</span></div>
      ${pendings.length ? pendings.slice(0, 5).map((o) => `
        <div class="notif-item" data-order="${o.id}">
          <div class="n-ico">${icon("inbox", 17)}</div>
          <div style="flex:1;min-width:0">
            <div class="n-title">طلب #${esc(o.id)} — ${esc(o.customerName)}</div>
            <div class="n-time">${o.items.slice(0, 3).map(esc).join("، ")}${o.items.length > 3 ? "…" : ""} • ${timeAgo(o.createdAt)}</div>
          </div>
        </div>`).join("")
        : `<div style="padding:26px;text-align:center" class="muted small">لا توجد طلبات معلقة حاليًا</div>`}
      <div style="padding:10px;border-top:1px solid var(--line)"><a href="#/orders" class="btn btn-soft btn-sm btn-block">عرض كل الطلبات</a></div>`;
    menu.querySelectorAll(".notif-item").forEach((el) => {
      el.onclick = () => { menu.classList.add("hidden"); location.hash = "#/orders/" + el.dataset.order; };
    });
  }

  function logout() {
    S().logout();
    App.simulation.stop();
    location.hash = "";
    renderLogin();
    toast("تم تسجيل الخروج", "نراك قريبًا", "info");
  }

  /* ============================================================
     الموجّه (Hash Router)
     ============================================================ */
  const routes = [
    { pattern: /^#?\/?$/, page: "dashboard" },
    { pattern: /^#\/orders\/?$/, page: "orders" },
    { pattern: /^#\/orders\/(\d+)\/?$/, page: "orderDetails", param: 1 },
    { pattern: /^#\/pharmacists\/?$/, page: "pharmacists" },
    { pattern: /^#\/statistics\/?$/, page: "statistics" },
    { pattern: /^#\/medicines\/?$/, page: "medicines" },
    { pattern: /^#\/my-orders\/?$/, page: "myOrders" },
    { pattern: /^#\/settings\/?$/, page: "settings" },
    { pattern: /^#\/profile\/?$/, page: "profile" },
  ];

  function currentRoute() {
    const hash = location.hash || "#/";
    for (const r of routes) {
      const m = hash.match(r.pattern);
      if (m) return { page: r.page, param: r.param ? m[r.param] : null };
    }
    return { page: "dashboard", param: null };
  }

  function renderRoute() {
    const user = S().currentUser();
    if (!user) return renderLogin();
    if (!document.getElementById("view")) buildShell(user);

    const { page, param } = currentRoute();
    const def = App.pages[page];
    if (!def) return;

    /* حارس الصلاحيات */
    if (def.roles && !def.roles.includes(user.role)) {
      toast("غير مصرح", "هذه الصفحة متاحة لمدير النظام فقط", "warning");
      location.hash = "#/";
      return;
    }

    document.getElementById("tb-title").textContent = def.title;
    document.getElementById("tb-crumb").textContent = def.crumb || "";
    document.title = `${def.title} — HAKEEM`;

    const view = document.getElementById("view");
    view.innerHTML = def.render(user, param);
    def.mount && def.mount(user, param);

    /* تمييز الرابط النشط مع فحص آمن لخصائص العناصر */
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const h = a.dataset.nav;
      const active = a.dataset.end === "1"
        ? (location.hash === h || location.hash === "" || location.hash === "#")
        : location.hash.startsWith(h);
      a.classList.toggle("active", active);
    });

    updateBadges();
    const viewEl = document.getElementById("view");
    if (viewEl && typeof viewEl.scrollTo === "function") {
      viewEl.scrollTo({ top: 0 });
    } else {
      window.scrollTo({ top: 0 });
    }
  }

  function updateBadges() {
    const user = S().currentUser();
    if (!user || !document.getElementById("nav-orders-count")) return;
    const count = user.role === "admin" ? S().pendingCount() : S().poolFor(user.id).length;
    const nav = document.getElementById("nav-orders-count");
    const ping = document.getElementById("bell-ping");
    if (nav) nav.textContent = count;
    if (ping) ping.textContent = count;
    if (nav) nav.classList.toggle("hidden", count === 0);
    if (ping) ping.classList.toggle("hidden", count === 0);
  }

  App.router = {
    refresh: renderRoute,
    go(hash) { location.hash = hash; },
  };

  /* ============================================================
     المحاكاة الحية — تحاكي وصول طلبات من n8n
     ============================================================ */
  let simTimer = null;

  function notifyNewOrder(o, manual) {
    const st = S().getSettings();
    if (st.notifySound) beep();
    toast("طلب جديد من الشات بوت 🔔", `#${o.id} — ${o.customerName} (${o.items.join("، ")})`, "order", 6500);
    if (st.notifyBrowser && "Notification" in window && Notification.permission === "granted") {
      new Notification("طلب جديد #" + o.id, { body: `${o.customerName} — ${o.items.join("، ")}` });
    }
    /* تحديث فوري إن كان المستخدم على صفحة قائمة ولا يوجد مودال مفتوح */
    const { page } = currentRoute();
    const busy = document.querySelector(".modal-overlay") || ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
    if (!busy && (page === "orders" || page === "dashboard")) renderRoute();
    else updateBadges();
  }

  App.simulation = {
    fireOnce(manual) {
      const o = App.webhook.receiveOrder(App.store.buildRandomOrder());
      notifyNewOrder(o, manual);
      return o;
    },
    sync() {
      this.stop();
      const st = S().getSettings();
      const dot = document.getElementById("live-dot");
      if (st.simulate && S().currentUser()) {
        simTimer = setInterval(() => { if (Math.random() < 0.6) this.fireOnce(false); }, 45000);
        if (dot) dot.classList.remove("off");
      } else if (dot) dot.classList.add("off");
    },
    stop() { if (simTimer) { clearInterval(simTimer); simTimer = null; } },
  };

  function syncLiveUI() { App.simulation.sync(); }

  /* ============================================================
     الإقلاع (Boot)
     ============================================================ */
  function renderLogin() {
    document.title = "تسجيل الدخول — HAKEEM";
    const app = document.getElementById("app");
    app.innerHTML = App.pages.login.render();
    App.pages.login.mount();
  }

  App.enterApp = (navigate = true) => {
    const user = S().currentUser();
    if (!user) return renderLogin();
    buildShell(user);
    if (navigate && (!location.hash || location.hash === "#")) location.hash = "#/";
    renderRoute();
  };

  /* تحديث الشارات عند أي تغيير في البيانات */
  S().onChange(() => {
    if (S().currentUser() && document.getElementById("view")) updateBadges();
  });

  window.addEventListener("hashchange", renderRoute);

  /* البداية */
  if (S().currentUser()) App.enterApp();
  else renderLogin();
})();
