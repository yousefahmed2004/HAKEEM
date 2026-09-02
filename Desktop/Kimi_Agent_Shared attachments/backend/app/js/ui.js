/* ============================================================
   ui.js — مكونات الواجهة: أيقونات SVG، تنبيهات، مودالات، تنسيقات
   ============================================================ */
window.App = window.App || {};

(function () {
  /* ---------- مكتبة الأيقونات (Lucide-style SVG) ---------- */
  const PATHS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 13l3-3 4 4 5-6"/>',
    pill: '<path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 1 1 7-7l7 7a4.95 4.95 0 1 1-7 7Z"/><path d="m8.5 8.5 7 7"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    note: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    trendingUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73Z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="m16 3-2 18"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    split: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="m21 3-7.12 7.12a2 2 0 0 1-.58 1.42L8 17"/><path d="m3 3 7.12 7.12"/><path d="M3 21h5v-5"/><path d="m8 16-3.59 3.59"/><path d="M16 21h5v-5"/><path d="m16 16 3.59 3.59"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.28 1.28L3 12l5.82 1.92a2 2 0 0 1 1.28 1.28L12 21l1.9-5.8a2 2 0 0 1 1.28-1.28L21 12l-5.82-1.92a2 2 0 0 1-1.28-1.28L12 3Z"/>',
  };

  function icon(name, size = 20, sw = 2) {
    const p = PATHS[name] || PATHS.info;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }

  /* ---------- تنسيقات ---------- */
  const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  function fmtDateTime(iso) {
    const d = new Date(iso);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "م" : "ص";
    h = h % 12 || 12;
    return `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()} — ${h}:${m} ${ampm}`;
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "منذ يوم";
    if (days === 2) return "منذ يومين";
    if (days < 30) return `منذ ${days} يوم`;
    return fmtDateTime(iso).split("—")[0].trim();
  }

  const fmtMoney = (n) => `${Number(n || 0).toLocaleString("en-US")} جنيه`;
  const fmtNum = (n) => Number(n || 0).toLocaleString("en-US");

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- حالات الطلب ---------- */
  const STATUS = {
    pending: { label: "قيد الانتظار", badge: "badge-pending", color: "#f59e0b", icon: "clock" },
    accepted: { label: "مقبول", badge: "badge-accepted", color: "#10b981", icon: "checkCircle" },
    partial: { label: "تنفيذ جزئي", badge: "badge-partial", color: "#0ea5e9", icon: "split" },
    rejected: { label: "مرفوض", badge: "badge-rejected", color: "#ef4444", icon: "xCircle" },
    /* "closed" امتداد طبيعي لـ "accepted" — الباك إند بيحوّل الطلب لها أوتوماتيك
       لحظة "خرج للتوصيل"، فلازم تتعامل معاها كحالة منفصلة هنا وإلا هتقع في
       الـ fallback (STATUS.pending) وتظهر "قيد الانتظار" غلط لطلب فعليًا اتقبل
       وبيتنفذ/بيتشحن. */
    closed: { label: "تم التوصيل", badge: "badge-accepted", color: "#10b981", icon: "checkCircle" },
  };

  function statusBadge(status) {
    const s = STATUS[status] || STATUS.pending;
    return `<span class="badge ${s.badge}"><span class="dot"></span>${s.label}</span>`;
  }

  function avatar(name, color, cls = "") {
    const initial = esc((name || "؟").trim().charAt(0));
    return `<div class="avatar ${cls}" style="background:linear-gradient(135deg, ${color}, ${color}cc)">${initial}</div>`;
  }

  /* ---------- التنبيهات (Toasts) ---------- */
  const TOAST_TYPES = {
    success: { color: "#10b981", bg: "#d1fae5", icon: "checkCircle" },
    info: { color: "#0ea5e9", bg: "#e0f2fe", icon: "info" },
    warning: { color: "#f59e0b", bg: "#fef3c7", icon: "alert" },
    error: { color: "#ef4444", bg: "#fee2e2", icon: "xCircle" },
    order: { color: "#8b5cf6", bg: "#ede9fe", icon: "inbox" },
  };

  function toast(title, msg = "", type = "info", duration = 4200) {
    const t = TOAST_TYPES[type] || TOAST_TYPES.info;
    const el = document.createElement("div");
    el.className = "toast";
    el.style.setProperty("--tc", t.color);
    el.style.setProperty("--tcb", t.bg);
    el.innerHTML = `
      <div class="t-ico">${icon(t.icon, 19)}</div>
      <div>
        <div class="t-title">${esc(title)}</div>
        ${msg ? `<div class="t-msg">${esc(msg)}</div>` : ""}
      </div>
      <button class="t-close" aria-label="إغلاق">${icon("x", 16)}</button>`;
    const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
    el.querySelector(".t-close").onclick = close;
    document.getElementById("toasts").appendChild(el);
    setTimeout(close, duration);
  }

  /* ---------- المودالات ---------- */
  function modal({ title, icon: ic = "info", body, footer = "", size = "", onOpen }) {
    const root = document.getElementById("modal-root");
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div class="modal-title">${icon(ic, 21)} ${title}</div>
          <button class="modal-close" aria-label="إغلاق">${icon("x", 18)}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
      </div>`;
    root.appendChild(overlay);
    const close = () => { overlay.style.opacity = "0"; setTimeout(() => overlay.remove(), 180); };
    overlay.querySelector(".modal-close").onclick = close;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    if (onOpen) onOpen(overlay, close);
    return close;
  }

  function confirmModal({ title, message, confirmText = "تأكيد", danger = false, icon: ic = "alert", onConfirm }) {
    modal({
      title, icon: ic,
      body: `<p style="color:var(--ink-2);font-size:14.5px;line-height:1.9">${message}</p>`,
      footer: `
        <button class="btn ${danger ? "btn-primary" : "btn-primary"}" id="cf-ok" style="${danger ? "background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 6px 16px -4px rgba(239,68,68,.4)" : ""}">${confirmText}</button>
        <button class="btn btn-ghost" id="cf-cancel">إلغاء</button>`,
      onOpen(overlay, close) {
        overlay.querySelector("#cf-ok").onclick = () => { close(); onConfirm && onConfirm(); };
        overlay.querySelector("#cf-cancel").onclick = close;
      },
    });
  }

  /* ---------- حالة فارغة ---------- */
  function emptyState(iconName, title, sub) {
    return `
      <div class="empty-state">
        <div class="e-ico">${icon(iconName, 38, 1.6)}</div>
        <h4>${title}</h4>
        <p>${sub || ""}</p>
      </div>`;
  }

  /* ---------- تكبير الصورة (Lightbox) ----------
     🆕 دالة عامة لفتح أي صورة (صورة/شعار الصيدلية، الروشتة، إيصال
     الدفع...) في طبقة فوق الصفحة كلها بخلفية معتّمة + بلور
     (backdrop-filter)، والصورة نفسها بتتحط في المنتصف بأكبر مقاس
     ممكن يفضل واضح على الموبايل والديسكتوب. تتقفل بضغطة في أي حتة
     برة الصورة، بزرار X، أو بزرار Escape من الكيبورد.

     الاستخدام من أي صفحة تانية (زي صفحة الصيادلة):
       <img src="..." onclick="App.ui.imageLightbox('${url}', 'صيدلية النور')" style="cursor:zoom-in" />
  */
  function imageLightbox(src, alt = "") {
    if (!src) return;
    const overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.innerHTML = `
      <button class="lightbox-close" aria-label="إغلاق">${icon("x", 22)}</button>
      <img src="${src}" alt="${esc(alt)}" class="lightbox-img" />`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const close = () => {
      overlay.classList.remove("in");
      document.body.style.overflow = "";
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener("keydown", onKey);
    };
    function onKey(e) { if (e.key === "Escape") close(); }

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector(".lightbox-close").onclick = close;
    document.addEventListener("keydown", onKey);

    // نضيف كلاس "in" في الفريم اللي بعد كده عشان الترانزيشن (fade + scale) في CSS يشتغل
    requestAnimationFrame(() => overlay.classList.add("in"));
  }

  /* ---------- تكبير محتوى HTML عام داخل نفس طبقة الـ Lightbox ----------
     نفس شكل imageLightbox (بلور + تعتيم + إغلاق بالـ Escape أو الضغط
     برة أو زرار X) بس بتقبل أي HTML بدل ما تكون مربوطة بـ <img> بس.
     مفيدة لعرض "بطاقة" مكبّرة (زي أفاتار الصيدلية + بياناتها) لحد ما
     يتضاف رفع صورة حقيقية، وبعدين imageLightbox هي اللي هتتستخدم. */
  function lightboxHTML(bodyHtml) {
    const overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.innerHTML = `
      <button class="lightbox-close" aria-label="إغلاق">${icon("x", 22)}</button>
      <div class="lightbox-card">${bodyHtml}</div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const close = () => {
      overlay.classList.remove("in");
      document.body.style.overflow = "";
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener("keydown", onKey);
    };
    function onKey(e) { if (e.key === "Escape") close(); }

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector(".lightbox-close").onclick = close;
    document.addEventListener("keydown", onKey);

    requestAnimationFrame(() => overlay.classList.add("in"));
    return close;
  }

  /* ---------- تكبير أفاتار الصيدلية (دائرة الاسم الملوّنة) ----------
     🆕 بتفتح لوحة مكبّرة بخلفية مبلورة فيها الأفاتار بحجم كبير + اسم
     الصيدلية + اسم المسؤول (اختياري) + التليفون + العنوان. دي بديل
     مؤقت لحد ما يتضاف رفع صورة/شعار حقيقي للصيدلية في قاعدة البيانات
     (عمود زي "logoImage" في جدول users) — لو اتضاف بعدين، تستبدل
     النداء ده بـ App.ui.imageLightbox(logoUrl, pharmacyName) مباشرة. */
  function avatarLightbox({ name, color, phone, address, subtitle }) {
    const initial = esc((name || "؟").trim().charAt(0));
    lightboxHTML(`
      <div class="lightbox-avatar-big" style="background:linear-gradient(135deg, ${color || "#0ea5e9"}, ${color || "#0ea5e9"}cc)">${initial}</div>
      <div class="lightbox-avatar-name">${esc(name || "")}</div>
      ${subtitle ? `<div class="lightbox-avatar-sub">${esc(subtitle)}</div>` : ""}
      ${phone ? `<div class="lightbox-avatar-row">${icon("phone", 16)} ${esc(phone)}</div>` : ""}
      ${address ? `<div class="lightbox-avatar-row">${icon("pin", 16)} ${esc(address)}</div>` : ""}
    `);
  }

  /* ---------- صوت تنبيه (Web Audio) ----------
     ⚠️ إصلاح مشكلة "الصوت مش بيوصل": المتصفحات (Chrome خصوصًا) بتخلي أي
     AudioContext جديد يبدأ في حالة "suspended" لحد ما يحصل تفاعل مباشر
     من المستخدم (click/tap/keydown) معاه. زرار "محاكاة طلب" كان شغال لأنه
     نفسه حدث كليك، لكن الطلبات الحقيقية بتوصل من setInterval في الخلفية
     من غير أي تفاعل، فالـ Context بيفضل معلّق والصوت ما بيتشغلش — وكان
     بيتبلع بصمت هنا (catch فاضي) فمكناش شايفين المشكلة حتى في الكونسول.

     الحل:
     1) Context واحد ثابت (مش واحد جديد كل نداء beep).
     2) بيتفك (resume) أول ما يحصل أي تفاعل من المستخدم في أي حتة بالصفحة.
     3) نتأكد نعمل resume() قبل كل صوت لو لسه معلّق.
     4) بنطبع تحذير حقيقي في الكونسول بدل ما نبلع الخطأ بصمت — لو شفت
        رسالة "[Audio] المتصفح مانع تشغيل الصوت تلقائيًا" في الكونسول،
        يبقى المطلوب إنك تعمل أي كليك واحد في الصفحة (زي فتح أي قايمة أو
        الضغط في أي مكان فاضي) وبعدها الصوت هيشتغل عادي لباقي الجلسة.

     🆕 (تعديل) شكل الصوت اتغيّر من نغمتين هادئتين لـ 3 نغمات "تين تين تين"
     متطابقة وأعلى صوتًا بكتير (gain من 0.12 لـ 0.4) عشان يبقى واضح ومسموع
     حتى لو الصفحة مش في الفوكس. */
  let sharedAudioCtx = null;

  function getAudioCtx() {
    if (!sharedAudioCtx) {
      try {
        sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn("[Audio] تعذر إنشاء AudioContext:", e);
        return null;
      }
    }
    return sharedAudioCtx;
  }

  function unlockAudioCtx() {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => { /* هيتحاول تاني عند أول beep() */ });
    }
  }
  /* أول تفاعل حقيقي من المستخدم (كليك/تاتش/زرار كيبورد) في أي مكان
     بالصفحة بيفك قفل الصوت خلاص لباقي عمر الصفحة */
  ["click", "touchstart", "keydown"].forEach((evt) => {
    document.addEventListener(evt, unlockAudioCtx, { once: true, passive: true });
  });

  function playBeepTone(ctx) {
    try {
      /* 🆕 نغمة "فخمة" وهادية على الودان — إحساس جرس دافئ بطبقات هارمونية
         خفيفة (زي أصوات إشعارات iOS/التطبيقات الاحترافية) بدل النغمة
         الجرسية المباشرة. المفاتيح هنا:
         - بداية ناعمة جدًا (attack بطيء نسبيًا) بدل ما يبدأ الصوت فجأة
         - خفوت طويل وتدريجي (decay ناعم) بدل قطع مفاجئ
         - علو منخفض (0.1 بدل 0.22/0.4) عشان يبقى مريح مش لافت بعنف
         - هارمونيك خفيف فوق النغمة الأساسية (مش نغمة تانية منفصلة) عشان
           يدي إحساس "غنى" في الصوت بدل نغمة sine خام مسطحة */
      function playChime(startAt, freq, volume = 0.1) {
        // النغمة الأساسية — دافئة وممتدة
        const fundamental = ctx.createOscillator();
        const fundamentalGain = ctx.createGain();
        fundamental.connect(fundamentalGain);
        fundamentalGain.connect(ctx.destination);
        fundamental.type = "sine";
        fundamental.frequency.value = freq;
        fundamentalGain.gain.setValueAtTime(0.0001, startAt);
        fundamentalGain.gain.linearRampToValueAtTime(volume, startAt + 0.09);
        fundamentalGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.1);
        fundamental.start(startAt);
        fundamental.stop(startAt + 1.15);

        // هارمونيك خفيف جدًا فوقها (أوكتاف + خمسة) عشان يدي عمق للصوت
        // من غير ما يبان كنغمة منفصلة — علوه أقل بكتير من الأساسية
        const overtone = ctx.createOscillator();
        const overtoneGain = ctx.createGain();
        overtone.connect(overtoneGain);
        overtoneGain.connect(ctx.destination);
        overtone.type = "sine";
        overtone.frequency.value = freq * 1.5; // خمسة موسيقية فوق الأساسية
        overtoneGain.gain.setValueAtTime(0.0001, startAt);
        overtoneGain.gain.linearRampToValueAtTime(volume * 0.25, startAt + 0.09);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.8);
        overtone.start(startAt);
        overtone.stop(startAt + 0.85);
      }

      const noteLow = 659.25;  // E5 — نغمة دافئة مش حادة
      const noteHigh = 987.77; // B5 — خمسة موسيقية فوقها (إحساس "رقي" بدل أوكتاف كامل)
      const chimeGap = 0.22;   // فاصل هادي بين النغمتين

      playChime(ctx.currentTime, noteLow, 0.11);
      playChime(ctx.currentTime + chimeGap, noteHigh, 0.11);
    } catch (e) {
      console.warn("[Audio] تعذر تشغيل نغمة التنبيه:", e);
    }
  }

  function beep() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume()
        .then(() => playBeepTone(ctx))
        .catch((e) => console.warn("[Audio] المتصفح مانع تشغيل الصوت تلقائيًا (لازم كليك واحد في الصفحة أولًا):", e));
    } else {
      playBeepTone(ctx);
    }
  }

  App.ui = {
    icon, toast, modal, confirmModal, emptyState, beep, imageLightbox, lightboxHTML, avatarLightbox,
    fmtDateTime, timeAgo, fmtMoney, fmtNum, esc,
    statusBadge, avatar, STATUS,
  };
})();
