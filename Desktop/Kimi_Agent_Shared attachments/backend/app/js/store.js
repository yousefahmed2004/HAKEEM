/* ============================================================
   store.js — طبقة البيانات (Data Layer)
   قاعدة بيانات محلية (localStorage) تحاكي الـ Backend
   جاهزة للاستبدال لاحقًا ببيانات n8n Webhook
   ============================================================ */
window.App = window.App || {};

(function () {
  const DB_KEY = "pharmacy_bot_db_v1";
  const SESSION_KEY = "pharmacy_bot_session";

  /* ---------- مولد أرقام عشوائية ثابت (لبيانات تجريبية متسقة) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- مستودع الأدوية الشائعة (مع أوزان التكرار) ---------- */
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

  /* صور روشتات تجريبية (تُخفى تلقائيًا إن لم توجد الملفات) */
  const RX_IMAGES = ["assets/rx1.jpg", "assets/rx2.jpg"];

  const AVATAR_COLORS = ["#0ea5e9", "#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

  /* ---------- البذر الأولي ---------- */
  function seed() {
    const rnd = mulberry32(20260717);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const rndInt = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;

    /* المستخدمون */
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

    /* اختيار أدوية مرجحة */
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

    /* توليد الطلبات عبر آخر 30 يوم */
    const orders = [];
    let nextId = 10001;

    for (let d = 29; d >= 0; d--) {
      let count;
      if (d === 0) count = rndInt(6, 8);          // اليوم: طلبات كثيرة معلقة للتجربة
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
            /* مقبول */
            const ph = pick(pharmacists.filter((p) => p.status === "active"));
            order.status = "accepted";
            order.pharmacyId = ph.id; order.pharmacyName = ph.pharmacyName;
            order.availableItems = [...items];
            order.price = rndInt(8, 90) * 10;
            order.timeline.push({ at: actedAt, text: `قبل الطلب — ${ph.pharmacyName}`, color: "#10b981" });
          } else if (roll < 0.74 && items.length > 1) {
            /* جزئي */
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
            /* مرفوض من الجميع */
            order.status = "rejected";
            order.rejectedBy = pharmacists.filter((p) => p.status === "active").map((p) => p.id);
            order.timeline.push({ at: actedAt, text: "لم يتمكن أي صيدلي من التنفيذ", color: "#ef4444" });
          } else {
            /* ما زال معلقًا — ربما رفضه البعض */
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

  /* ---------- التحميل والحفظ ---------- */
  let db = null;
  const listeners = { change: [] };
  let lastOrdersJson = "";

  /* 🔔 تتبّع IDs الطلبات المعروفة عشان نكتشف أي طلب "جديد فعليًا" وصل من
     الباك إند (سواء من n8n مباشرة أو من أي مصدر) ونشغّل له نفس صوت/تنبيه
     المحاكاة. null = لسه معملناش أول تحميل، عشان محدش يتنبّه لكل الطلبات
     الموجودة بالفعل لحظة فتح الصفحة. */
  let knownOrderIds = null;

  /* ملاحظة هامة:
     مهلة التنفيذ (5 دقايق) بتتحسم نهائيًا في السيرفر (orders.js -> expireOverdueOrders)
     مش في المتصفح، عشان لو فاتح أكتر من تاب (أدمن / صيدلي تاني) محدش يرجّع
     الطلب pending بشكل مستقل عن الباقي. كمان أي خطوة توركفلو (تجهيز/جاهز/خرج
     للتوصيل...) بتصفّر executionPending/executionDeadline فورًا عشان المهلة
     متفضلش شغالة في الخلفية وترجّع الطلب pending حتى لو اتنفذ فعليًا.

     ملاحظة إضافية: عند "خرج للتوصيل" (تم الشحن)، الباك إند بيقفل الطلب
     مباشرة (status = "closed") وكمان بيقفل الـ WhatsApp session بتاعة
     العميل — كل ده من غير أي وسيط خارجي (n8n). الفرونت إند هنا لازم
     يتعامل مع "closed" كامتداد طبيعي لـ "accepted" في كل الأماكن اللي
     كانت بتشيك على "accepted" بس، عشان الطلب يفضل ظاهر للصيدلي وضمن
     الإحصائيات لحد ما يتسلّم فعليًا. */

  async function syncOrders() {
    try {
      const res = await App.api.getOrders();
      if (res && res.ok && Array.isArray(res.orders)) {
        // التأكد من وجود timeline لكل طلب (API لا يعيدها في قائمة الطلبات)
        res.orders.forEach((o) => {
          if (!o.timeline) {
            o.timeline = [{ at: o.createdAt || new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }];
          }
          if (!o.rejectedBy) o.rejectedBy = [];
          if (!o.availableItems) o.availableItems = [];
          if (!o.unavailableItems) o.unavailableItems = [];
        });

        /* ============================================================
           🔔 اكتشاف الطلبات الجديدة اللي وصلت فعليًا (من n8n/الشات بوت)
           ------------------------------------------------------------
           قبل كده كانت الدالة دي بتستبدل db.orders بصمت من غير ما تنبّه
           حد إن فيه طلب جديد وصل على أرض الواقع؛ الصوت والتنبيه كانا
           بيشتغلوا بس مع "محاكاة الطلبات" اليدوية (App.simulation.fireOnce)
           لأنها هي الوحيدة اللي كانت بتنادي notifyNewOrder مباشرة.
           هنا بنقارن IDs الطلبات الجديدة بالمعروفة، ولو لقينا IDs جديدة
           (بعد أول تحميل للصفحة) بننادي App.notifications.orderArrived
           لكل واحد منها عشان يشغّل نفس صوت/تنبيه المحاكاة بالظبط. */
        const incomingIds = new Set(res.orders.map((o) => o.id));
        if (knownOrderIds !== null) {
          const newlyArrived = res.orders.filter((o) => !knownOrderIds.has(o.id));
          newlyArrived.forEach((o) => {
            if (App.notifications && typeof App.notifications.orderArrived === "function") {
              App.notifications.orderArrived(o);
            }
          });
        }
        knownOrderIds = incomingIds;

        const currentJson = JSON.stringify(res.orders);
        if (currentJson !== lastOrdersJson) {
          db.orders = res.orders;
          lastOrdersJson = currentJson;
          save();
          emit();

          // تحديث الصفحة الحالية تلقائيًا إذا لم يكن هناك مودال مفتوح أو إدخال نشط
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

  function getExecutionBadge(rate) {
    if (rate > 50) return { label: "أخضر", color: "#10b981", bg: "#d1fae5" };
    if (rate === 50) return { label: "أصفر", color: "#d97706", bg: "#fef3c7" };
    return { label: "أحمر", color: "#dc2626", bg: "#fee2e2" };
  }

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) { db = JSON.parse(raw); }
    } catch (e) { /* تجاهل وأعد البذر */ }
    if (!db) {
      db = seed();
      save();
    }
  }
  function save() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function emit() { listeners.change.forEach((f) => f()); }

  async function hydratePharmacistsFromServer() {
    try {
      const res = await App.api.getPharmacists();
      if (!res?.ok || !Array.isArray(res.pharmacists)) return;

      const admin = db.users.find((u) => u.role === "admin");
      const others = db.users.filter((u) => u.role !== "pharmacist");
      const remotePharmacists = res.pharmacists.map((p) => ({ ...p, password: p.password || "123456" }));

      db.users = admin ? [admin, ...remotePharmacists, ...others.filter((u) => u.role !== "admin")] : [...remotePharmacists, ...others];
      save();
      emit();
    } catch (e) {
      /* تجاهل وابقَ على البيانات المحلية */
    }
  }

  /* ---------- الأدوات المساعدة ---------- */
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

  function randomOrder() {
    const rnd = Math.random;
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const bag = [];
    MEDICINES.forEach(([name, w]) => { for (let i = 0; i < w; i++) bag.push(name); });
    const count = 1 + Math.floor(rnd() * 3);
    const set = new Set();
    let guard = 0;
    while (set.size < count && guard++ < 30) set.add(pick(bag));
    const prefix = pick(["010", "011", "012", "015"]);
    let rest = "";
    for (let i = 0; i < 8; i++) rest += Math.floor(rnd() * 10);
    return {
      id: String(db.nextOrderId++),
      customerName: pick(FIRST_NAMES) + " " + pick(LAST_NAMES),
      phone: prefix + rest,
      address: pick(AREAS),
      items: [...set],
      prescriptionImage: rnd() < 0.25 ? pick(RX_IMAGES) : "",
      status: "pending",
      createdAt: new Date().toISOString(),
      pharmacyId: null, pharmacyName: null, price: null,
      availableItems: [], unavailableItems: [], notes: "", rejectedBy: [],
      timeline: [{ at: new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }],
      workflowStatus: null,
      executionPending: false,
      executionDeadline: null,
      executionCompleted: false,
      executionFailed: false,
      executedAt: null,
    };
  }

  /* ---------- الواجهة العامة ---------- */
  App.store = {
    onChange(f) { listeners.change.push(f); },

    /* الجلسة والدخول */
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
    updateProfile(userId, patch) {
      const u = db.users.find((x) => x.id === userId);
      if (!u) return;
      Object.assign(u, patch);
      save(); emit();
    },

    /* إدارة الصيادلة (Admin) */
    getPharmacists() { return db.users.filter((u) => u.role === "pharmacist"); },
    usernameExists(username, exceptId) {
      return db.users.some((u) => u.username.toLowerCase() === String(username).trim().toLowerCase() && u.id !== exceptId);
    },
    async addPharmacist(data) {
      const payload = {
        username: data.username.trim(),
        password: data.password,
        name: data.name.trim(),
        pharmacyName: data.pharmacyName.trim(),
        phone: data.phone || "",
        maxActiveOrders: Number(data.maxActiveOrders || 2),
      };

      try {
        const result = await App.api.addPharmacist(payload);
        if (result?.ok && result.user) {
          const existingIndex = db.users.findIndex((u) => u.id === result.user.id);
          const userToStore = { ...result.user, password: result.user.password || payload.password };
          if (existingIndex >= 0) db.users[existingIndex] = userToStore;
          else db.users.push(userToStore);
          save(); emit();
          return userToStore;
        }
      } catch (e) {
        /* تجاهل ثم استخدم البيانات المحلية */
      }

      const u = {
        id: "u-ph" + Date.now().toString(36),
        username: payload.username, password: payload.password,
        role: "pharmacist", name: payload.name,
        pharmacyName: payload.pharmacyName, phone: payload.phone,
        status: "active", color: AVATAR_COLORS[db.users.length % AVATAR_COLORS.length],
        createdAt: new Date().toISOString(), maxActiveOrders: payload.maxActiveOrders || 2,
      };
      db.users.push(u); save(); emit();
      return u;
    },
    async updatePharmacist(id, patch) {
      const u = db.users.find((x) => x.id === id);
      if (!u) return;

      try {
        const result = await App.api.updateProfile(id, patch);
        if (result?.ok && result.user) {
          Object.assign(u, result.user);
          save(); emit();
          return u;
        }
      } catch (e) {
        /* تجاهل ثم استخدم التحديث المحلي */
      }

      Object.assign(u, patch);
      save(); emit();
      return u;
    },
    deletePharmacist(id) {
      db.users = db.users.filter((x) => x.id !== id);
      save(); emit();
    },
    async togglePharmacistStatus(id) {
      const u = db.users.find((x) => x.id === id);
      if (!u) return;

      const nextStatus = u.status === "active" ? "suspended" : "active";
      try {
        const result = await App.api.updateUserStatus(id, nextStatus);
        if (result?.ok && result.user) {
          Object.assign(u, result.user);
          save(); emit();
          return u.status;
        }
      } catch (e) {
        /* تجاهل ثم استخدم التحديث المحلي */
      }

      u.status = nextStatus;
      save(); emit();
      return u.status;
    },

    /* الطلبات */
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
    pendingCount() { return db.orders.filter((o) => o.status === "pending").length; },
    getPharmacyCapacity(user) { return getDefaultMaxActiveOrders(user); },
    getActiveOrderCountForPharmacist(pharmacistId) { return getActiveOrderCountForPharmacist(pharmacistId); },
    canAcceptOrder(user) { return getActiveOrderCountForPharmacist(user.id) < getDefaultMaxActiveOrders(user); },

    /* الطلبات المرئية لصيدلي معين */
    poolFor(pharmacistId) {
      return this.getOrders().filter((o) => o.status === "pending" && o.rejectedBy && !o.rejectedBy.includes(pharmacistId));
    },
    mineFor(pharmacistId) {
      return this.getOrders().filter((o) => o.pharmacyId === pharmacistId && (o.status === "accepted" || o.status === "partial" || o.status === "closed"));
    },
    myOrdersCurrent(pharmacistId) {
      return this.getOrders().filter((o) => o.pharmacyId === pharmacistId && (o.status === "accepted" || o.status === "partial" || o.status === "closed") && !["delivered", "cancelled"].includes(o.workflowStatus || ""));
    },
    myOrdersCompletedToday(pharmacistId) {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      return this.getOrders().filter((o) => o.pharmacyId === pharmacistId && (o.status === "accepted" || o.status === "partial" || o.status === "closed") && (o.deliveredAt || o.executedAt) && new Date(o.deliveredAt || o.executedAt) >= new Date(startOfDay));
    },
    myOrdersHistory(pharmacistId, filter = "all") {
      const all = this.getOrders().filter((o) => o.pharmacyId === pharmacistId);
      if (filter === "all") return all;
      return all.filter((o) => {
        if (filter === "accepted") return o.status === "accepted" || o.status === "closed";
        if (filter === "partial") return o.status === "partial";
        if (filter === "rejected") return o.rejectedBy && o.rejectedBy.includes(pharmacistId);
        return true;
      });
    },

    acceptOrder(id, user) {
      const o = this.getOrder(id);
      if (!o || o.status !== "pending" || (o.rejectedBy && o.rejectedBy.includes(user.id))) return null;
      const pharmacist = db.users.find((u) => u.id === user.id) || user;
      if (!pharmacist || getActiveOrderCountForPharmacist(user.id) >= getDefaultMaxActiveOrders(pharmacist)) return null;
      ensureExecutionProfile(pharmacist);
      if (pharmacist) {
        pharmacist.executionStats.accepted += 1;
      }
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
      /* مهلة الـ 5 دقايق دي بتتراقب سيرفريًا (expireOverdueOrders في orders.js).
         أي خطوة تالية (تأكيد استلام أو أي إجراء توركفلو) هتصفّرها فورًا —
         شوف confirmReceiptOrder و updateOrderWorkflowStatus تحت. */
      saveOrderBackend(o, timelineText, timelineColor);
      return o;
    },

    partialOrder(id, user, available, price, notes) {
      const o = this.getOrder(id);
      if (!o || o.status !== "pending" || (o.rejectedBy && o.rejectedBy.includes(user.id))) return null;
      o.status = "partial";
      o.pharmacyId = user.id; o.pharmacyName = user.pharmacyName;
      o.availableItems = available;
      o.unavailableItems = o.items.filter((m) => !available.includes(m));
      o.price = price; o.notes = notes || "";
      o.workflowStatus = "received";
      o.executionPending = false;
      o.executionDeadline = null;
      o.executionCompleted = true;
      o.executionFailed = false;
      o.executedAt = new Date().toISOString();
      const timelineText = `تنفيذ جزئي (${available.length} من ${o.items.length} أدوية) — ${user.pharmacyName}`;
      const timelineColor = "#0ea5e9";
      o.timeline.push({ at: new Date().toISOString(), text: timelineText, color: timelineColor });
      save(); emit();
      saveOrderBackend(o, timelineText, timelineColor);
      return o;
    },

    rejectOrder(id, user) {
      const o = this.getOrder(id);
      if (!o || o.status !== "pending") return null;
      if (!o.rejectedBy) o.rejectedBy = [];
      if (!o.rejectedBy.includes(user.id)) o.rejectedBy.push(user.id);
      const timelineText1 = `اعتذر عن التنفيذ — ${user.pharmacyName}`;
      const timelineColor1 = "#ef4444";
      o.timeline.push({ at: new Date().toISOString(), text: timelineText1, color: timelineColor1 });
      const activePh = db.users.filter((u) => u.role === "pharmacist" && u.status === "active");
      let timelineText2 = null;
      let timelineColor2 = null;
      if (activePh.length > 0 && activePh.every((p) => o.rejectedBy.includes(p.id))) {
        o.status = "rejected";
        timelineText2 = "لم يتمكن أي صيدلي من التنفيذ";
        timelineColor2 = "#ef4444";
        o.timeline.push({ at: new Date().toISOString(), text: timelineText2, color: timelineColor2 });
      }
      save(); emit();
      saveOrderBackend(o, timelineText2 || timelineText1, timelineColor2 || timelineColor1);
      return o;
    },

    confirmReceiptOrder(id, user) {
      const o = this.getOrder(id);
      const pharmacist = db.users.find((u) => u.id === user.id) || user;
      if (!o || !(o.status === "accepted" || o.status === "closed") || o.pharmacyId !== user.id) return null;
       if (["delivered", "cancelled"].includes(o.workflowStatus)) return null; // الخطوة خلصت خلاص، مينفعش نرجع نغيرها
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
       تحديث حالة سير عمل الطلب (استلام / تجهيز / جاهز / خرج للتوصيل / تسليم / إلغاء)
       — يستقبل price اختياريًا (بيوصل من نافذة تأكيد الشحن) ويحفظه على الطلب
       — ⚠️ أهم نقطة: بيصفّر executionPending/executionDeadline فورًا مع أي
         خطوة توركفلو، عشان مهلة الـ 5 دقايق (المحسوبة من وقت "قبول الطلب")
         متفضلش شغالة في الخلفية وترجّع الطلب pending حتى لو الصيدلي كان
         فعليًا بيتحرك بين الخطوات (تجهيز → جاهز → خرج للتوصيل...)
       — عند "خرج للتوصيل": الباك إند (routes/orders.js) هو اللي بيقفل
         الطلب فعليًا (status = "closed") وبيقفل الـ WhatsApp session
         بتاعة العميل مباشرة — مفيش أي اعتماد على n8n في القفل ده،
         الفرونت إند هنا بس بيبعت workflowStatus ويستنى رد الباك إند
         (updateOrderWorkflowStatus / saveOrderBackend) اللي هيرجّع
         الحالة النهائية "closed" في المزامنة التالية (syncOrders).
       — ⚠️ (إصلاح) بعد "خرج للتوصيل" الطلب بيبقى status = "closed" محليًا،
         فلازم الشرط هنا يقبل "accepted" و"closed" مع بعض بالظبط زي
         confirmReceiptOrder فوق، وإلا أي خطوة تالية (زي "تم التسليم")
         هترفض بمجرد ما الطلب يتقفل عند "خرج للتوصيل".
       — عند "خرج للتوصيل" يتم أيضًا إرسال إشعار الشحن إلى n8n عبر البروكسي
         (ده لسه محتاجينه بس عشان يوصل السعر والعنوان لشركة الشحن، مش
         عشان يقفل السيشن — القفل بقى مسؤولية الباك إند وحده)
       ============================================================ */
    updateOrderWorkflowStatus(id, user, workflowStatus, price) {
      const o = this.getOrder(id);
      if (!o || !(o.status === "accepted" || o.status === "closed") || o.pharmacyId !== user.id) return null;
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

      /* إلغاء مهلة التنفيذ فور اتخاذ أي إجراء توركفلو — انظر الشرح أعلى الدالة */
      o.executionPending = false;
      o.executionDeadline = null;

      o.workflowStatus = workflowStatus;
      /* الحالة النهائية (closed) هتتحدد في الباك إند نفسه لما يوصله
         workflowStatus = "out_for_delivery" — هنا بنعكسها محليًا فورًا
         كمان عشان الواجهة تتحدث فورًا من غير ما تستنى المزامنة */
      if (workflowStatus === "out_for_delivery") {
        o.status = "closed";
      }
      if (workflowStatus === "delivered") {
        o.deliveredAt = new Date().toISOString();
      }
      const timelineText = workflowLabels[workflowStatus];
      const timelineColor = workflowStatus === "cancelled" ? "#ef4444" : "#0ea5e9";
      o.timeline.push({ at: new Date().toISOString(), text: timelineText, color: timelineColor });
      save(); emit();
      saveOrderBackend(o, timelineText, timelineColor);

      /* إرسال إشعار الشحن إلى n8n عند خروج الطلب للتوصيل فعليًا
         (بس لتوصيل بيانات الشحن لشركة التوصيل — مش لقفل أي session) */
      if (workflowStatus === "out_for_delivery") {
        App.webhook.sendStatusUpdate(o).then((ok) => {
          if (!ok) {
            App.ui.toast("تعذر إبلاغ نظام الشحن (n8n)", "تم تحديث الحالة محليًا فقط، تحقق من الاتصال", "warning");
          }
        });
      }

      return o;
    },

    executeOrder(id, user) {
      return this.confirmReceiptOrder(id, user);
    },

    /* استقبال طلب جديد (يُستدعى من Webhook أو المحاكاة) */
    addOrder(order) {
      db.orders.push(order);
      /* نسجّل الـ ID فورًا في الطلبات المعروفة عشان أول Sync بعد كده
         متعتبروش "طلب جديد وصل" وتنبّه عليه مرة تانية زيادة عن اللازم
         (هو أصلاً اتنبّه عليه محليًا لحظة إضافته من app.js) */
      if (knownOrderIds) knownOrderIds.add(order.id);
      else knownOrderIds = new Set([order.id]);
      save(); emit();
      App.api.createOrder(order).then(() => {
        syncOrders();
      }).catch((e) => {
        console.error("Failed to create order on backend:", e);
      });
      return order;
    },
    buildRandomOrder: randomOrder,

    /* الإحصائيات */
    stats() {
      const now = new Date();
      const s = { today: 0, month: 0, total: db.orders.length, accepted: 0, rejected: 0, partial: 0, pending: 0, revenue: 0 };
      db.orders.forEach((o) => {
        const d = new Date(o.createdAt);
        if (sameDay(d, now)) s.today++;
        if (sameMonth(d, now)) s.month++;
        if (o.status === "accepted" || o.status === "closed") { s.accepted++; s.revenue += o.price || 0; }
        else if (o.status === "partial") { s.partial++; s.revenue += o.price || 0; }
        else if (o.status === "rejected") s.rejected++;
        else s.pending++;
      });
      return s;
    },

    pharmacyStats() {
      return this.getPharmacists().map((p) => {
        const accepted = db.orders.filter((o) => o.pharmacyId === p.id && (o.status === "accepted" || o.status === "closed"));
        const partial = db.orders.filter((o) => o.pharmacyId === p.id && o.status === "partial");
        const rejected = db.orders.filter((o) => o.rejectedBy && o.rejectedBy.includes(p.id));
        const perf = this.pharmacyPerformance(p);
        return {
          id: p.id, name: p.pharmacyName, pharmacist: p.name, status: p.status,
          accepted: accepted.length, partial: partial.length, rejected: rejected.length,
          total: accepted.length + partial.length + rejected.length,
          revenue: [...accepted, ...partial].reduce((sum, o) => sum + (o.price || 0), 0),
          executionPoints: perf.points,
          executionRate: perf.rate,
          executionBadge: perf.badge,
        };
      }).sort((a, b) => b.total - a.total);
    },

    pharmacyPerformance(pharmacist) {
      const user = db.users.find((u) => u.id === pharmacist.id || u.id === pharmacist);
      ensureExecutionProfile(user || pharmacist);
      const profile = user || pharmacist;
      const total = profile.executionStats?.accepted || 0;
      const executed = profile.executionStats?.executed || 0;
      const rate = total ? Math.round((executed / total) * 100) : 100;
      const badge = getExecutionBadge(rate);
      return { points: profile.executionPoints || 100, rate, badge };
    },

    medicineStats() {
      const counts = {};
      db.orders.forEach((o) => o.items.forEach((m) => { counts[m] = (counts[m] || 0) + 1; }));
      return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    },

    dailySeries(days) {
      const out = [];
      for (let d = days - 1; d >= 0; d--) {
        const dt = new Date(); dt.setDate(dt.getDate() - d);
        const count = db.orders.filter((o) => sameDay(new Date(o.createdAt), dt)).length;
        out.push({ label: `${dt.getDate()}/${dt.getMonth() + 1}`, value: count });
      }
      return out;
    },

    /* الإعدادات */
    getSettings() { return { ...db.settings }; },
    updateSettings(patch) { Object.assign(db.settings, patch); save(); emit(); },

    /* إعادة تعيين البيانات التجريبية */
    resetDemo() {
      db = seed();
      save(); emit();
    },
  };

  load();
  hydratePharmacistsFromServer();
  syncOrders();                     // اجلب الطلبات الحقيقية من الداتابيز فور فتح الموقع
  setInterval(syncOrders, 6000);    // ثم اعمل مزامنة دورية كل 6 ثواني عشان تلقط أي طلب جديد جاي من n8n مباشرة
})();
