/* ============================================================
   pages3.js — تسجيل الدخول + الإعدادات + الملف الشخصي
   ============================================================ */
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  const { icon, esc, avatar, fmtDateTime, toast, confirmModal } = App.ui;
  const S = () => App.store;

  function loginHTML() {
    return `
    <div class="login-page">
      <div class="login-hero">
        <div class="hero-blob" style="--rot:12deg;width:130px;height:130px;top:16%;right:12%"></div>
        <div class="hero-blob" style="--rot:-8deg;width:90px;height:90px;bottom:20%;right:28%;animation-delay:1.2s"></div>
        <div class="hero-blob" style="--rot:6deg;width:64px;height:64px;top:58%;right:8%;animation-delay:.6s"></div>

        <div class="hero-inner">
          <div class="hero-badge">
            ${icon("shield", 15)} HAKEEM | حكيم
          </div>

          <h1>منصة HAKEEM<br>لإدارة طلبات الصيدليات</h1>

          <p>
            نظام احترافي لإدارة طلبات العملاء، متابعة الصيدليات،
            وإدارة العمليات اليومية من خلال لوحة تحكم موحدة وسريعة.
          </p>

          <div class="hero-feats">
            <div class="hero-feat">
              <div class="f-ico">${icon("inbox", 20)}</div>
              <div>
                <div class="f-txt">إدارة الطلبات</div>
                <div class="f-sub">استقبال ومتابعة الطلبات في الوقت الفعلي</div>
              </div>
            </div>

            <div class="hero-feat">
              <div class="f-ico">${icon("users", 20)}</div>
              <div>
                <div class="f-txt">إدارة الصيدليات</div>
                <div class="f-sub">ربط وإدارة جميع الصيدليات من مكان واحد</div>
              </div>
            </div>

            <div class="hero-feat">
              <div class="f-ico">${icon("chart", 20)}</div>
              <div>
                <div class="f-txt">التقارير والإحصائيات</div>
                <div class="f-sub">تحليلات دقيقة لمتابعة الأداء واتخاذ القرار</div>
              </div>
            </div>

            <div class="hero-feat">
              <div class="f-ico">${icon("shield", 20)}</div>
              <div>
                <div class="f-txt">أمان وموثوقية</div>
                <div class="f-sub">حماية البيانات وإدارة صلاحيات المستخدمين</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="login-panel">
        <div class="login-box">
          <div class="logo-row">
            <div class="logo-mark"><img src="assets/hakeem_logo.png" alt="HAKEEM" style="width:100%;height:100%;object-fit:contain;border-radius:inherit" /></div>
            <div>
              <div style="font-weight:900;font-size:20px">HAKEEM</div>
              <div class="small muted">حكيم • Pharmacy Management System</div>
            </div>
          </div>

          <h2>تسجيل الدخول</h2>

          <div class="welcome">
            أدخل بياناتك للوصول إلى لوحة التحكم.
          </div>

          <div class="login-card">
            <div class="login-error" id="login-error"></div>

            <form id="login-form" autocomplete="off">
              <div class="field">
                <label>اسم المستخدم</label>
                <div class="input-wrap">
                  ${icon("user", 17)}
                  <input
                    class="input"
                    id="login-username"
                    placeholder="اسم المستخدم"
                    required
                  />
                </div>
              </div>

              <div class="field">
                <label>كلمة المرور</label>
                <div class="input-wrap">
                  ${icon("key", 17)}
                  <input
                    class="input"
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    class="pass-toggle"
                    id="pass-toggle"
                  >
                    ${icon("eye", 17)}
                  </button>
                </div>
              </div>

              <button
                class="btn btn-primary btn-lg btn-block"
                type="submit"
                id="login-submit-btn"
                style="margin-top:6px"
              >
                ${icon("logout", 18)}
                تسجيل الدخول
              </button>
            </form>

            <div class="demo-box">
              <div class="d-title">
                ${icon("sparkles", 15)}
                حسابات تجريبية — اضغط للتعبئة
              </div>

              <div class="d-row">
                <span>مدير النظام (Admin)</span>
                <span><code data-fill="admin">admin</code> / <code>123456</code></span>
              </div>

              <div class="d-row">
                <span>صيدلي — صيدلية النور</span>
                <span><code data-fill="noor">noor</code> / <code>123456</code></span>
              </div>

              <div class="d-row">
                <span>صيدلي — صيدلية الشفاء</span>
                <span><code data-fill="shefaa">shefaa</code> / <code>123456</code></span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>`;
  }

  /* ============================================================
     🛠️ (تعديل) mountLogin
     ------------------------------------------------------------
     دالة S().login() بقت async دلوقتي (بتتحقق من السيرفر الحقيقي
     عبر /auth/login بدل النسخة المحلية اللي كانت بتتلخبط بعد أي
     refresh). فـ form.onsubmit بقى async وبيستخدم await، ومع تعطيل
     زرار الإرسال أثناء الانتظار عشان المستخدم مايضغطش أكتر من مرة.
     ============================================================ */
  function mountLogin() {
    const form = document.getElementById("login-form");
    const err = document.getElementById("login-error");
    document.getElementById("pass-toggle").onclick = () => {
      const inp = document.getElementById("login-password");
      const show = inp.type === "password";
      inp.type = show ? "text" : "password";
      document.getElementById("pass-toggle").innerHTML = icon(show ? "eyeOff" : "eye", 17);
    };
    document.querySelectorAll("[data-fill]").forEach((c) => {
      c.onclick = () => {
        document.getElementById("login-username").value = c.dataset.fill;
        document.getElementById("login-password").value = "123456";
        err.classList.remove("show");
      };
    });
    form.onsubmit = async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("login-submit-btn");
      if (submitBtn) submitBtn.disabled = true;

      let res;
      try {
        res = await S().login(
          document.getElementById("login-username").value,
          document.getElementById("login-password").value
        );
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }

      if (!res.ok) {
        err.innerHTML = icon("alert", 17) + " " + esc(res.error);
        err.classList.add("show");
        /* 🆕 لو الحساب موقوف (صيدلي أوقفه الأدمن)، نظهر تنبيه (Toast) واضح
           فوق الشاشة بالإضافة للرسالة تحت الفورم — عشان الرسالة تبان
           كإشعار مباشر مش مجرد سطر تحت الحقول */
        if (res.suspended) {
          toast(
            "🚫 الحساب موقوف مؤقتًا",
            "تم إيقاف عملك مع مجموعة حكيم مؤقتًا — تواصل مع الإدارة لمزيد من التفاصيل",
            "warning",
            8000
          );
        }
        return;
      }
      toast("تم تسجيل الدخول بنجاح", `أهلًا بك، ${res.user.name}`, "success");
      App.enterApp();
    };
  }

  App.pages.login = { render: loginHTML, mount: mountLogin };

  /* ============================================================
     الإعدادات — Webhook n8n والتنبيهات
     ============================================================ */
  function settingsHTML() {
    const st = S().getSettings();
    return `
      <div class="page-anim">
        <div class="grid" style="grid-template-columns:1fr;align-items:start" id="settings-grid">

          <div style="display:flex;flex-direction:column;gap:20px">
            <div class="card">
              <div class="card-head"><div class="card-title">${icon("bell", 20)} إعدادات التنبيهات</div></div>
              <div class="setting-row">
                <div><div class="s-title">صوت تنبيه عند طلب جديد</div><div class="s-desc">نغمة قصيرة عند وصول طلب من الشات بوت</div></div>
                <label class="switch"><input type="checkbox" id="sw-sound" ${st.notifySound ? "checked" : ""} /><span class="track"></span></label>
              </div>
              <div class="setting-row">
                <div><div class="s-title">تنبيهات المتصفح</div><div class="s-desc">إشعار نظام حتى واللوحة في الخلفية</div></div>
                <label class="switch"><input type="checkbox" id="sw-browser" ${st.notifyBrowser ? "checked" : ""} /><span class="track"></span></label>
              </div>
              <div class="setting-row">
                <div><div class="s-title">محاكاة وصول الطلبات</div><div class="s-desc">وضع تجريبي: طلب جديد كل فترة (يحاكي n8n)</div></div>
                <label class="switch"><input type="checkbox" id="sw-simulate" ${st.simulate ? "checked" : ""} /><span class="track"></span></label>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title">${icon("zap", 20)} أدوات تجريبية</div></div>
              <p class="small muted" style="margin-bottom:14px">جرّب النظام كأن الشات بوت أرسل طلبًا حقيقيًا.</p>
              <button class="btn btn-primary btn-block" id="simulate-order" style="margin-bottom:10px">${icon("send", 16)} محاكاة طلب جديد الآن</button>
              <button class="btn btn-warning-soft btn-block" id="reset-demo">${icon("refresh", 16)} إعادة تعيين البيانات التجريبية</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  App.pages.settings = {
    title: "الإعدادات",
    crumb: "إعدادات التنبيهات",
    render: settingsHTML,
    mount() {
      const grid = document.getElementById("settings-grid");
      if (window.innerWidth < 1100 && grid) grid.style.gridTemplateColumns = "1fr";

      const bindSwitch = (id, key, after) => {
        document.getElementById(id).addEventListener("change", (e) => {
          S().updateSettings({ [key]: e.target.checked });
          if (after) after(e.target.checked);
        });
      };
      bindSwitch("sw-sound", "notifySound", (v) => toast(v ? "تم تفعيل صوت التنبيه" : "تم كتم صوت التنبيه", "", "info"));
      bindSwitch("sw-browser", "notifyBrowser", (v) => {
        if (v && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
        toast(v ? "تم تفعيل تنبيهات المتصفح" : "تم إيقاف تنبيهات المتصفح", "", "info");
      });
      bindSwitch("sw-simulate", "simulate", (v) => {
        App.simulation.sync();
        toast(v ? "وضع المحاكاة يعمل الآن" : "تم إيقاف المحاكاة", "", "info");
      });

      document.getElementById("simulate-order").onclick = () => App.simulation.fireOnce(true);
      document.getElementById("reset-demo").onclick = () => confirmModal({
        title: "إعادة تعيين البيانات",
        icon: "refresh",
        danger: true,
        message: "سيتم مسح جميع الطلبات والتعديلات الحالية وإعادة توليد البيانات التجريبية من جديد. هل أنت متأكد؟",
        confirmText: "نعم، إعادة التعيين",
        onConfirm() {
          S().resetDemo();
          toast("تمت إعادة تعيين البيانات", "عادت النسخة التجريبية لحالتها الأولى", "success");
          App.router.refresh();
        },
      });
    },
  };

  /* ============================================================
     الملف الشخصي
     ============================================================ */
  function profileHTML(user) {
    const isPh = user.role === "pharmacist";
    const mine = isPh ? S().mineFor(user.id) : [];
    const revenue = mine.reduce((s, o) => s + (o.price || 0), 0);
    return `
      <div class="page-anim">
        <div class="profile-head">
          ${avatar(isPh ? user.pharmacyName : user.name, "rgba(255,255,255,.28)", "avatar-lg")}
          <div>
            <div class="ph-name">${esc(user.name)}</div>
            <div style="opacity:.9;font-size:14px">${isPh ? esc(user.pharmacyName) : esc(user.title || "مدير النظام")}</div>
            <span class="ph-role">${isPh ? "صيدلي" : "مدير النظام (Admin)"}</span>
          </div>
          ${isPh ? `
          <div style="margin-right:auto;display:flex;gap:26px;position:relative;z-index:1;flex-wrap:wrap">
            <div style="text-align:center"><div style="font-size:23px;font-weight:900">${mine.length}</div><div style="font-size:12px;opacity:.85">طلباتي</div></div>
            <div style="text-align:center"><div style="font-size:23px;font-weight:900">${revenue}</div><div style="font-size:12px;opacity:.85">إجمالي المبيعات (جنيه)</div></div>
          </div>` : ""}
        </div>

        <div class="grid grid-2" style="align-items:start">
          <div class="card">
            <div class="card-head"><div class="card-title">${icon("user", 20)} البيانات الأساسية</div></div>
            <div class="field"><label>الاسم</label><input class="input" id="pr-name" value="${esc(user.name)}" /></div>
            ${isPh ? `<div class="field"><label>اسم الصيدلية</label><input class="input" id="pr-pharmacy" value="${esc(user.pharmacyName)}" /></div>` : ""}
            <div class="field"><label>رقم الهاتف</label><input class="input mono" id="pr-phone" dir="ltr" style="text-align:right" value="${esc(user.phone || "")}" placeholder="01000000000" /></div>
            <div class="field"><label>اسم المستخدم</label><input class="input mono" value="${esc(user.username)}" disabled style="background:var(--bg-soft);color:var(--muted)" /></div>
            <button class="btn btn-primary" id="pr-save">${icon("check", 16)} حفظ البيانات</button>
          </div>

          <div class="card">
            <div class="card-head"><div class="card-title">${icon("shield", 20)} تغيير كلمة المرور</div></div>
            <div class="field"><label>كلمة المرور الحالية</label><input class="input" id="pw-current" type="password" placeholder="••••••" /></div>
            <div class="field"><label>كلمة المرور الجديدة</label><input class="input" id="pw-new" type="password" placeholder="6 أحرف على الأقل" /></div>
            <div class="field"><label>تأكيد كلمة المرور الجديدة</label><input class="input" id="pw-confirm" type="password" placeholder="أعد كتابتها" /></div>
            <div id="pw-error" class="login-error"></div>
            <button class="btn btn-primary" id="pw-save">${icon("key", 16)} تحديث كلمة المرور</button>
          </div>
        </div>
      </div>`;
  }

  App.pages.profile = {
    title: "الملف الشخصي",
    crumb: "بياناتك وإعدادات حسابك",
    render: (user) => profileHTML(user),
    mount(user) {
      document.getElementById("pr-save").onclick = () => {
        const name = document.getElementById("pr-name").value.trim();
        const phone = document.getElementById("pr-phone").value.trim();
        if (!name) return toast("الاسم مطلوب", "", "error");
        if (phone && !/^01[0-9]{9}$/.test(phone)) return toast("رقم الهاتف غير صحيح", "مثال: 01012345678", "error");
        const patch = { name, phone };
        const phInput = document.getElementById("pr-pharmacy");
        if (phInput) {
          if (!phInput.value.trim()) return toast("اسم الصيدلية مطلوب", "", "error");
          patch.pharmacyName = phInput.value.trim();
        }
        S().updateProfile(user.id, patch);
        toast("تم حفظ البيانات بنجاح", "", "success");
        App.enterApp(false);
      };
      document.getElementById("pw-save").onclick = () => {
        const err = document.getElementById("pw-error");
        const fail = (m) => { err.innerHTML = icon("alert", 16) + " " + m; err.classList.add("show"); };
        const cur = document.getElementById("pw-current").value;
        const nw = document.getElementById("pw-new").value;
        const cf = document.getElementById("pw-confirm").value;
        if (cur !== user.password) return fail("كلمة المرور الحالية غير صحيحة");
        if (nw.length < 6) return fail("كلمة المرور الجديدة: 6 أحرف على الأقل");
        if (nw !== cf) return fail("تأكيد كلمة المرور غير متطابق");
        S().updateProfile(user.id, { password: nw });
        err.classList.remove("show");
        document.getElementById("pw-current").value = document.getElementById("pw-new").value = document.getElementById("pw-confirm").value = "";
        toast("تم تحديث كلمة المرور", "استخدمها في تسجيل الدخول القادم", "success");
      };
    },
  };
})();
