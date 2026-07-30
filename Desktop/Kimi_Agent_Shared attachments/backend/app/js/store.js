/* ============================================================
   store.js — طبقة البيانات (Data Layer)
   قاعدة بيانات محلية (localStorage) تحاكي الـ Backend
   ============================================================ */
window.App = window.App || {};

(function () {
  const DB_KEY = "pharmacy_bot_db_v1";
  const SESSION_KEY = "pharmacy_bot_session";

  /* ---------- مولد أرقام عشوائية ثابت ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MEDICINES = [
    ["Panadol", 30], ["Augmentin", 24], ["Cataflam", 21], ["Brufen", 19],
    ["Amoxicillin", 15], ["Zithromax", 14], ["Voltaren", 13], ["Nexium", 12],
    ["Controloc", 11], ["Ventolin", 10], ["Glucophage", 10], ["Concor", 9],
    ["Zyrtec", 9], ["Buscopan", 8], ["Flagyl", 8], ["Ciprocin", 7],
    ["Curam", 7], ["Otrivin", 6], ["Fucidin", 6], ["Betadine", 5],
    ["Aspirin Protect", 5], ["Plavix", 5], ["Lipitor", 5], ["Insulin Mixtard", 4],
    ["Imodium", 4], ["Spasfon", 4], ["Ketoprof", 3], ["Dexamethasone", 3],
    ["Cetal", 3], ["Antinal", 3], ["Strepsils", 2], ["Zantac", 2],
  ];

  const FIRST_NAMES = ["أحمد", "محمد", "محمود", "خالد", "عمر", "كريم", "مصطفى", "طارق", "هشام", "عمرو", "سارة", "فاطمة", "منى", "هبة", "ياسمين", "نورهان", "رانيا", "دينا", "إيمان", "أسماء", "بسمة", "مريم", "حسن", "إبراهيم", "سيد", "شريف", "وليد", "نادية", "هالة", "سامح"];
  const LAST_NAMES = ["محمد", "علي", "حسن", "إبراهيم", "سيد", "فاروق", "مصطفى", "كامل", "عادل", "سامي", "عبدالله", "طارق", "عصام", "الشاذلي", "رضا", "نور", "جلال", "وحيد", "حمزة", "عزت", "فؤاد", "سليم", "بدر", "السيد"];
  const AREAS = ["مدينة نصر، القاهرة", "المعادي، القاهرة", "الزمالك، القاهرة", "مصر الجديدة، القاهرة", "الدقي، الجيزة", "المهندسين، الجيزة", "فيصل، الجيزة", "الهرم، الجيزة", "شبرا، القاهرة", "عين شمس، القاهرة", "التجمع الخامس، القاهرة", "6 أكتوبر، الجيزة", "الشيخ زايد، الجيزة", "حلوان، القاهرة", "المنيل، القاهرة", "وسط البلد، القاهرة", "إمبابة، الجيزة", "المطرية، القاهرة"];

  const RX_IMAGES = ["assets/rx1.jpg", "assets/rx2.jpg"];
  const AVATAR_COLORS = ["#0ea5e9", "#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

  function seed() {
    const rnd = mulberry32(20260717);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const rndInt = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;

    const users = [
      { id: "u-admin", username: "admin", password: "123456", role: "admin", name: "أحمد سامي", title: "مالك المشروع", phone: "01012345678", status: "active", color: "#2563eb", createdAt: daysAgoISO(90, rnd), executionPoints: 100, executionStats: { accepted: 0, executed: 0, failed: 0 } },
      { id: "u-ph1", username: "noor", password: "123456", role: "pharmacist", name: "د. محمد النور", pharmacyName: "صيدلية النور", phone: "01055512301", status: "active", color: "#0ea5e9", createdAt: daysAgoISO(80, rnd), executionPoints: 100, executionStats: { accepted: 0, executed: 0, failed: 0 }, maxActiveOrders: 3 },
      { id: "u-ph2", username: "shefaa", password: "123456", role: "pharmacist", name: "د. سارة الشافعي", pharmacyName: "صيدلية الشفاء", phone: "01155512302", status: "active", color: "#10b981", createdAt: daysAgoISO(74, rnd), executionPoints: 100, executionStats: { accepted: 0, executed: 0, failed: 0 }, maxActiveOrders: 3 },
      { id: "u-ph3", username: "seif", password: "123456", role: "pharmacist", name: "د. خالد سيف", pharmacyName: "صيدلية سيف", phone: "01255512303", status: "active", color: "#8b5cf6", createdAt: daysAgoISO(60, rnd), executionPoints: 100, executionStats: { accepted: 0, executed: 0, failed: 0 }, maxActiveOrders: 3 },
      { id: "u-ph4", username: "elzohry", password: "123456", role: "pharmacist", name: "د. منى الزهري", pharmacyName: "صيدلية الزهري", phone: "01555512304", status: "active", color: "#f59e0b", createdAt: daysAgoISO(45, rnd), executionPoints: 100, executionStats: { accepted: 0, executed: 0, failed: 0 }, maxActiveOrders: 3 },
      { id: "u-ph5", username: "roshdy", password: "123456", role: "pharmacist", name: "د. عمر رشدي", pharmacyName: "صيدلية رشدي", phone: "01055512305", status: "suspended", color: "#ef4444", createdAt: daysAgoISO(30, rnd), executionPoints: 100, executionStats: { accepted: 0, executed: 0, failed: 0 }, maxActiveOrders: 3 },
      { id: "u-ph6", username: "aman", password: "123456", role: "pharmacist", name: "د. هبة الأمان", pharmacyName: "صيدلية الأمان", phone: "01155512306", status: "active", color: "#06b6d4", createdAt: daysAgoISO(20, rnd), executionPoints: 100, executionStats: { accepted: 0, executed: 0, failed: 0 }, maxActiveOrders: 3 },
    ];

    const pharmacists = users.filter((u) => u.role === "pharmacist");

    function pickMeds() {
      const bag = [];
      MEDICINES.forEach(([name, w]) => { for (let i = 0; i < w; i++) bag.push(name); });
      const count = rndInt(1, 4);
      const set = new Set();
      let guard = 0;
      while (set.size < count && guard++ < 40) set.add(pick(bag));
      return [...set];
    }

    function phoneNum() {
      const prefix = pick(["010", "011", "012", "015"]);
      let rest = "";
      for (let i = 0; i < 8; i++) rest += rndInt(0, 9);
      return prefix + rest;
    }

    const orders = [];
    let nextId = 10001;

    for (let d = 29; d >= 0; d--) {
      let count;
      if (d === 0) count = rndInt(6, 8);
      else if (d <= 2) count = rndInt(3, 5);
      else count = rndInt(1, 4);

      for (let i = 0; i < count; i++) {
        const created = daysAgoISO(d, rnd);
        const items = pickMeds();
        const hasRx = rnd() < 0.28;
        const order = {
          id: String(nextId++),
          customerName: pick(FIRST_NAMES) + " " + pick(LAST_NAMES),
          phone: phoneNum(),
          address: pick(AREAS),
          items,
          prescriptionImage: hasRx ? pick(RX_IMAGES) : "",
          status: "pending",
          createdAt: created,
          pharmacyId: null,
          pharmacyName: null,
          price: null,
          availableItems: [],
          unavailableItems: [],
          notes: "",
          rejectedBy: [],
          timeline: [{ at: created, text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }],
          workflowStatus: null,
          executionPending: false,
          executionDeadline: null,
          executionCompleted: false,
          executionFailed: false,
          executedAt: null,
        };

        if (d > 0) {
          const roll = rnd();
          const actedAt = laterISO(created, rndInt(5, 180), rnd);
          if (roll < 0.5) {
            const ph = pick(pharmacists.filter((p) => p.status === "active"));
            order.status = "accepted";
            order.pharmacyId = ph.id; order.pharmacyName = ph.pharmacyName;
            order.availableItems = [...items];
            order.price = rndInt(8, 90) * 10;
            order.timeline.push({ at: actedAt, text: `قبل الطلب — ${ph.pharmacyName}`, color: "#10b981" });
          } else if (roll < 0.74 && items.length > 1) {
            const ph = pick(pharmacists.filter((p) => p.status === "active"));
            order.status = "partial";
            order.pharmacyId = ph.id; order.pharmacyName = ph.pharmacyName;
            const availCount = rndInt(1, items.length - 1);
            const shuffled = [...items].sort(() => rnd() - 0.5);
            order.availableItems = shuffled.slice(0, availCount);
            order.unavailableItems = shuffled.slice(availCount);
            order.price = rndInt(5, 60) * 10;
            order.timeline.push({ at: actedAt, text: `تنفيذ جزئي — ${ph.pharmacyName}`, color: "#0ea5e9" });
          } else if (roll < 0.84) {
            order.status = "rejected";
            order.rejectedBy = pharmacists.filter((p) => p.status === "active").map((p) => p.id);
            order.timeline.push({ at: actedAt, text: "لم يتمكن أي صيدلي من التنفيذ", color: "#ef4444" });
          } else {
            const someRejected = pharmacists.filter((p) => p.status === "active" && rnd() < 0.35);
            order.rejectedBy = someRejected.map((p) => p.id);
          }
        }
        orders.push(order);
      }
    }

    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      users,
      orders,
      nextOrderId: nextId,
      settings: {
        webhookUrl: "https://YOUR-N8N-WEBHOOK",
        apiKey: "",
        notifySound: true,
        notifyBrowser: false,
        simulate: true,
        pharmacyName: "Pharmacy Bot",
      },
      seededAt: new Date().toISOString(),
    };
  }

  function daysAgoISO(d, rnd) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    dt.setHours(9 + Math.floor((rnd ? rnd() : Math.random()) * 14), Math.floor((rnd ? rnd() : Math.random()) * 60), 0, 0);
    return dt.toISOString();
  }
  function laterISO(iso, minutes, rnd) {
    const dt = new Date(iso);
    dt.setMinutes(dt.getMinutes() + minutes);
    return dt.toISOString();
  }

  let db = null;
  const listeners = { change: [] };
  let lastOrdersJson = "";

  async function syncOrders() {
    try {
      const res = await App.api.getOrders();
      if (res && res.ok && Array.isArray(res.orders)) {
        res.orders.forEach((o) => {
          if (!o.timeline) {
            o.timeline = [{ at: o.createdAt || new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }];
          }
          if (!o.rejectedBy) o.rejectedBy = [];
          if (!o.availableItems) o.availableItems = [];
          if (!o.unavailableItems) o.unavailableItems = [];
        });
        const currentJson = JSON.stringify(res.orders);
        if (currentJson !== lastOrdersJson) {
          db.orders = res.orders;
          lastOrdersJson = currentJson;
          save();
          emit();

          const busy = document.querySelector(".modal-overlay") || ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
          if (!busy && window.location.hash) {
            const hash = window.location.hash;
            if (hash === "#/" || hash.startsWith("#/orders") || hash === "#/my-orders") {
              App.router && App.router.refresh && App.router.refresh();
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to sync orders:", e);
    }
  }

  async function saveOrderBackend(o, timelineText, timelineColor) {
    try {
      await App.api.updateOrder(o.id, {
        status: o.status,
        pharmacyId: o.pharmacyId,
        pharmacyName: o.pharmacyName,
        availableItems: o.availableItems,
        unavailableItems: o.unavailableItems,
        price: o.price,
        notes: o.notes,
        workflowStatus: o.workflowStatus,
        executionPending: o.executionPending,
        executionDeadline: o.executionDeadline,
        executionCompleted: o.executionCompleted,
        executionFailed: o.executionFailed,
        executedAt: o.executedAt,
        deliveredAt: o.deliveredAt,
        rejectedBy: o.rejectedBy,
        timelineText: timelineText,
        timelineColor: timelineColor
      });
      syncOrders();
    } catch (e) {
      console.error("Failed to update order in backend:", e);
    }
  }

  function ensureExecutionProfile(user) {
    if (!user) return null;
    if (typeof user.executionPoints !== "number") user.executionPoints = 100;
    if (!user.executionStats) user.executionStats = { accepted: 0, executed: 0, failed: 0 };
    return user;
  }

  function getDefaultMaxActiveOrders(user) {
    if (!user) return 3;
    const direct = Number(user.maxActiveOrders);
    if (Number.isFinite(direct) && direct > 0) return direct;
    return 3;
  }

  function getActiveOrderCountForPharmacist(pharmacistId) {
    return db.orders.filter((o) => o.pharmacyId === pharmacistId && o.status === "accepted"
      && !["delivered", "cancelled"].includes(o.workflowStatus || "")).length;
  }

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) { db = JSON.parse(raw); }
    } catch (e) {}
    if (!db) {
      db = seed();
      save();
    }
  }
  function save() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function emit() { listeners.change.forEach((f) => f()); }

  App.store = {
    onChange(f) { listeners.change.push(f); },

    login(username, password) {
      const u = db.users.find((x) => x.username.toLowerCase() === String(username).trim().toLowerCase());
      if (!u || u.password !== password) return { ok: false, error: "بيانات الدخول غير صحيحة، حاول مرة أخرى" };
      if (u.status === "suspended") return { ok: false, error: "هذا الحساب موقوف، برجاء التواصل مع الإدارة" };
      sessionStorage.setItem(SESSION_KEY, u.id);
      return { ok: true, user: u };
    },
    logout() { sessionStorage.removeItem(SESSION_KEY); },
    currentUser() {
      const id = sessionStorage.getItem(SESSION_KEY);
      return id ? db.users.find((u) => u.id === id) || null : null;
    },

    getPharmacists() { return db.users.filter((u) => u.role === "pharmacist"); },
    getOrders() { return [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); },
    getOrder(id) {
      const o = db.orders.find((o) => o.id === id);
      if (o) {
        if (!o.timeline) o.timeline = [{ at: o.createdAt || new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }];
        if (!o.rejectedBy) o.rejectedBy = [];
        if (!o.availableItems) o.availableItems = [];
        if (!o.unavailableItems) o.unavailableItems = [];
      }
      return o || null;
    },

    acceptOrder(id, user) {
      const o = this.getOrder(id);
      if (!o || o.status !== "pending" || (o.rejectedBy && o.rejectedBy.includes(user.id))) return null;
      const pharmacist = db.users.find((u) => u.id === user.id) || user;
      if (!pharmacist || getActiveOrderCountForPharmacist(user.id) >= getDefaultMaxActiveOrders(pharmacist)) return null;
      ensureExecutionProfile(pharmacist);
      pharmacist.executionStats.accepted += 1;
      
      o.status = "accepted";
      o.pharmacyId = user.id; o.pharmacyName = user.pharmacyName;
      o.availableItems = [...o.items]; o.unavailableItems = [];
      o.workflowStatus = "awaiting_receipt";
      o.executionPending = true;
      o.executionDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      o.executionCompleted = false;
      o.executionFailed = false;
      o.executedAt = null;
      
      const timelineText = `قبل الطلب — ${user.pharmacyName}`;
      const timelineColor = "#10b981";
      o.timeline.push({ at: new Date().toISOString(), text: timelineText, color: timelineColor });
      save(); emit();
      saveOrderBackend(o, timelineText, timelineColor);
      return o;
    },

    confirmReceiptOrder(id, user) {
      const o = this.getOrder(id);
      const pharmacist = db.users.find((u) => u.id === user.id) || user;
      if (!o || o.status !== "accepted" || o.pharmacyId !== user.id) return null;
      ensureExecutionProfile(pharmacist);
      pharmacist.executionPoints = Math.min(100, pharmacist.executionPoints + 10);
      pharmacist.executionStats.executed += 1;
      
      o.workflowStatus = "received";
      o.executionPending = false;
      o.executionCompleted = false;
      o.executionFailed = false;
      o.executionDeadline = null;
      o.executedAt = null;
      
      const timelineText = `تم استلام الطلب — ${user.pharmacyName}`;
      const timelineColor = "#10b981";
      o.timeline.push({ at: new Date().toISOString(), text: timelineText, color: timelineColor });
      save(); emit();
      saveOrderBackend(o, timelineText, timelineColor);
      return o;
    },

    /* ============================================================
       تعديل حالة سير العمل (Workflow) مع تحديث الـ status عند التسليم
       ============================================================ */
    updateOrderWorkflowStatus(id, user, workflowStatus, price) {
      const o = this.getOrder(id);
      if (!o || o.status !== "accepted" || o.pharmacyId !== user.id) return null;
      
      const workflowLabels = {
        received: "تم استلام الطلب",
        preparing: "جاري التجهيز",
        ready: "جاهز للتوصيل",
        out_for_delivery: "خرج للتوصيل",
        delivered: "تم التسليم",
        cancelled: "إلغاء الطلب",
      };
      if (!workflowLabels[workflowStatus]) return null;

      if (price != null && Number.isFinite(Number(price))) {
        o.price = Number(price);
      }

      o.executionPending = false;
      o.executionDeadline = null;

      o.workflowStatus = workflowStatus;
      
      // التعديل الجوهري: تحويل الـ status الأساسية إلى delivered أو completed عند انتهاء الطلب
      if (workflowStatus === "delivered") {
        o.deliveredAt = new Date().toISOString();
        o.status = "delivered"; // <--- يمنع البوت من اعتباره pending ويسمح بأوردر جديد
      } else if (workflowStatus === "cancelled") {
        o.status = "cancelled";
      }

      const timelineText = workflowLabels[workflowStatus];
      const timelineColor = workflowStatus === "cancelled" ? "#ef4444" : "#0ea5e9";
      o.timeline.push({ at: new Date().toISOString(), text: timelineText, color: timelineColor });
      
      save(); emit();
      saveOrderBackend(o, timelineText, timelineColor);

      if (workflowStatus === "out_for_delivery" || workflowStatus === "delivered") {
        App.webhook.sendStatusUpdate(o).then((ok) => {
          if (!ok) {
            App.ui.toast("تعذر إبلاغ نظام الشحن (n8n)", "تم تحديث الحالة محليًا فقط", "warning");
          }
        });
      }

      return o;
    }
  };

  load();
  setInterval(syncOrders, 10000);
})();
