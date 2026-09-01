/* ============================================================
   pages4.js — الصيدليات + تفاصيل الصيدلية مع الإحصائيات
   ============================================================ */
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  const { icon, esc, avatar, fmtMoney, fmtNum, toast } = App.ui;
  const S = () => App.store;
  
  // تخزين الفترة الزمنية المختارة لكل صيدلية (اسم الاختصار السريع، أو "custom")
  const selectedPeriods = {};

  // 🆕 تخزين نطاق التاريخ الفعلي (من/إلى) المختار لكل صيدلية — ده اللي
  // بيتحسب عليه الإحصائيات فعليًا، سواء جه من زرار سريع أو من الكالندر
  const selectedRanges = {};

  // تخزين حالة التوب سيرش لكل صيدلية (هل مفعل أم لا)
  const pharmacyTopSearchStates = {};

  // 🆕 تخزين نص البحث الحالي في قائمة الصيدليات (بيفضل محفوظ لو رجعت
  // للصفحة تاني في نفس الجلسة)
  let pharmaciesSearchQuery = "";

  /* ============================================================
     🆕 أدوات مساعدة لنطاق التاريخ (Date Range) — بتغذي حقلَي
     <input type="date"> اللي بيفتحوا كالندر أصلي في المتصفح
     ============================================================ */
  function toDateInputValue(d) {
    // تنسيق YYYY-MM-DD المطلوب لـ <input type="date">
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function getDefaultRange(period) {
    const now = new Date();
    let start = new Date();
    switch (period) {
      case "day":
        start.setDate(now.getDate() - 1);
        break;
      case "week":
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start.setMonth(now.getMonth() - 1);
        break;
      case "year":
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setMonth(now.getMonth() - 1);
    }
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }
  
  // تخزين في window للوصول من صفحات أخرى
  App.pharmacyTopSearchStates = pharmacyTopSearchStates;

  /* ============================================================
     📱 قائمة الصيدليات (Pharmacies List)
     ============================================================ */
  App.pages.pharmacies = {
    title: "الصيدليات",
    crumb: "عرض وتحليل بيانات الصيدليات",
    roles: ["admin"],

    render(user) {
      const pharmacists = S().getPharmacists();
      const orders = S().getOrders();

      // دالة مساعدة لحساب إحصائيات الصيدلية
      function getPharmacyStats(pharmacyId) {
        const phOrders = orders.filter((o) => o.pharmacyId === pharmacyId);
        return {
          total: phOrders.length,
          accepted: phOrders.filter((o) => o.status === "accepted").length,
          partial: phOrders.filter((o) => o.status === "partial").length,
          rejected: phOrders.filter((o) => o.status === "rejected").length,
          totalRevenue: phOrders
            .filter((o) => o.price)
            .reduce((sum, o) => sum + (o.price || 0), 0),
        };
      }

      // 🆕 دالة تبني نص قابل للبحث (اسم الصيدلية + اسم المسؤول + الهاتف + العنوان)
      function buildSearchBlob(p) {
        return [p.pharmacyName, p.name, p.phone, p.address]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
      }

      // 🆕 دالة بناء كارت صيدلية واحدة (اتفصلت لوحدها عشان تتستخدم
      // برضو وقت الفلترة الحيّة من غير إعادة تحميل الصفحة كلها)
      function buildPharmacyCard(p) {
        const stats = getPharmacyStats(p.id);
        const executionRate = stats.total > 0
          ? Math.round(((stats.accepted + stats.partial) / stats.total) * 100)
          : 0;

        return `
        <div class="card-item pharmacy-card" data-pharmacy-id="${esc(p.id)}" data-search="${esc(buildSearchBlob(p))}">
          <div class="card-header">
            <div style="display:flex;align-items:center;gap:12px;flex:1">
              ${avatar(p.pharmacyName, p.color, "avatar-lg")}
              <div>
                <div class="card-title">${esc(p.pharmacyName)}</div>
                <div class="card-sub">${esc(p.name)}</div>
                ${p.phone ? `<div class="small muted" style="margin-top:4px">${icon("phone", 12)} ${esc(p.phone)}</div>` : ""}
                ${p.address ? `<div class="small muted">${icon("pin", 12)} ${esc(p.address)}</div>` : ""}
              </div>
            </div>
          </div>

          <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="stat-box">
              <div class="stat-value">${fmtNum(stats.total)}</div>
              <div class="stat-label">إجمالي الطلبات</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${fmtMoney(stats.totalRevenue)}</div>
              <div class="stat-label">الإيرادات</div>
            </div>
          </div>

          <div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px;margin-top:12px">
            <span class="badge badge-accepted">${icon("check", 14)} ${stats.accepted} منفذة</span>
            <span class="badge badge-partial">${icon("alert", 14)} ${stats.partial} جزئية</span>
            <span class="badge badge-rejected">${icon("x", 14)} ${stats.rejected} مرفوضة</span>
          </div>

          <div class="card-footer" style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="execution-ring small" style="--ring-value:${executionRate};--ring-color:${executionRate > 60 ? "#10b981" : executionRate > 40 ? "#f59e0b" : "#ef4444"}">
                <span>${executionRate}%</span>
              </div>
              <div class="small">معدل التنفيذ</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="toggle-top-search vis-toggle ${pharmacyTopSearchStates[p.id] !== false ? "is-show" : "is-hide"}" data-pharmacy-id="${esc(p.id)}" title="عرض/إخفاء الخدمات الأكثر طلبًا">
                ${icon("eye", 14)} ${pharmacyTopSearchStates[p.id] !== false ? "عرض" : "إخفاء"}
              </button>
              <a href="#/pharmacy/${esc(p.id)}" class="btn btn-primary btn-sm">التفاصيل →</a>
            </div>
          </div>
        </div>
        `;
      }

      const activePharmacists = pharmacists.filter((p) => p.status === "active");
      const pharmaciesHTML = activePharmacists.map(buildPharmacyCard).join("");

      return `
      <div class="page-container">
        <div class="page-header">
          <h1>الصيدليات المفعّلة</h1>
          <p class="text-muted">عرض وتحليل بيانات جميع الصيدليات</p>
        </div>

        ${activePharmacists.length === 0
          ? `<div class="empty-state">
               ${icon("inbox", 56)}
               <h3>لا توجد صيدليات</h3>
               <p>قم بإضافة صيدليات من قسم "الصيادلة" أولاً</p>
             </div>`
          : `
            <!-- 🆕 سيرش بار للبحث عن الصيدليات (بالاسم / اسم المسؤول / الهاتف / العنوان) -->
            <div class="pharmacies-search-bar" style="position:relative;margin-bottom:20px;max-width:420px">
              <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;display:flex">${icon("search", 16)}</span>
              <input
                type="text"
                id="pharmacies-search-input"
                class="input"
                style="padding-right:38px"
                placeholder="ابحث باسم الصيدلية أو المسؤول أو الهاتف..."
                value="${esc(pharmaciesSearchQuery)}"
                autocomplete="off"
              />
            </div>

            <div class="cards-grid" id="pharmacies-cards-grid" style="grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:20px">
              ${pharmaciesHTML}
            </div>

            <div class="empty-state small" id="pharmacies-search-empty" style="display:none">
              ${icon("search", 40)}
              <p>لا توجد صيدليات مطابقة لبحثك</p>
            </div>
          `}
      </div>
      `;
    },

    mount(user) {
      // معالج النقر على بطاقة الصيدلية (للانتقال للتفاصيل)
      document.querySelectorAll(".pharmacy-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (!e.target.closest("a") && !e.target.closest(".toggle-top-search")) {
            const id = card.dataset.pharmacyId;
            App.router.go(`#/pharmacy/${id}`);
          }
        });
      });

      // معالج زر toggle التوب سيرش
      document.querySelectorAll(".toggle-top-search").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const pharmacyId = btn.dataset.pharmacyId;
          
          // تبديل الحالة (إذا لم تكن موجودة، تبدأ بـ true، وإلا تتبدل)
          if (pharmacyTopSearchStates[pharmacyId] === undefined) {
            pharmacyTopSearchStates[pharmacyId] = false;
          } else {
            pharmacyTopSearchStates[pharmacyId] = !pharmacyTopSearchStates[pharmacyId];
          }
          
          const isShowing = pharmacyTopSearchStates[pharmacyId];

          // تحديث شكل الزرار (سويتش أخضر/أحمر) ونصّه
          btn.classList.toggle("is-show", isShowing);
          btn.classList.toggle("is-hide", !isShowing);
          btn.innerHTML = `${icon("eye", 14)} ${isShowing ? "عرض" : "إخفاء"}`;
          
          // تظهير تنبيه
          App.ui.toast(
            isShowing 
              ? `✓ سيتم عرض الخدمات الأكثر طلبًا لهذه الصيدلية` 
              : `✓ سيتم إخفاء الخدمات الأكثر طلبًا لهذه الصيدلية`
          );
        });
      });

      /* 🆕 معالج سيرش بار الصيدليات — فلترة حيّة (بدون إعادة تحميل
         الصفحة) عشان المستخدم يقدر يكمل الكتابة براحته من غير ما
         يفقد تركيز الحقل (focus) */
      const searchInput = document.getElementById("pharmacies-search-input");
      if (searchInput) {
        const cards = Array.from(document.querySelectorAll("#pharmacies-cards-grid .pharmacy-card"));
        const emptyState = document.getElementById("pharmacies-search-empty");
        const grid = document.getElementById("pharmacies-cards-grid");

        function applyFilter(rawQuery) {
          const query = rawQuery.trim().toLowerCase();
          pharmaciesSearchQuery = rawQuery;

          let visibleCount = 0;
          cards.forEach((card) => {
            const haystack = card.dataset.search || "";
            const isMatch = query === "" || haystack.includes(query);
            card.style.display = isMatch ? "" : "none";
            if (isMatch) visibleCount++;
          });

          if (emptyState) emptyState.style.display = visibleCount === 0 ? "" : "none";
          if (grid) grid.style.display = visibleCount === 0 ? "none" : "grid";
        }

        // تطبيق أي قيمة بحث محفوظة من قبل فورًا عند فتح الصفحة
        if (pharmaciesSearchQuery) applyFilter(pharmaciesSearchQuery);

        searchInput.addEventListener("input", (e) => {
          applyFilter(e.target.value);
        });
      }
    },
  };

  /* ============================================================
     🔍 تفاصيل الصيدلية مع الإحصائيات
     ============================================================ */
  App.pages.pharmacyDetails = {
    title: "تفاصيل الصيدلية",
    crumb: "إحصائيات وتحليلات الصيدلية",
    roles: ["admin"],

    render(user, pharmacyId) {
      const pharmacists = S().getPharmacists();
      const pharmacy = pharmacists.find((p) => p.id === pharmacyId);

      if (!pharmacy) {
        return `
        <div class="page-container">
          <div class="empty-state">
            ${icon("alert", 56)}
            <h3>الصيدلية غير موجودة</h3>
            <p><a href="#/pharmacies" class="btn btn-soft">العودة للصيدليات</a></p>
          </div>
        </div>
        `;
      }

      const orders = S().getOrders();
      const phOrders = orders.filter((o) => o.pharmacyId === pharmacyId);
      
      // الفترة السريعة المختارة حاليًا (أو "month" بشكل افتراضي)
      const currentPeriod = selectedPeriods[pharmacyId] || "month";
      // نطاق التاريخ الفعلي (من/إلى) — لو المستخدم لسه ماحددش نطاق مخصص
      // بنستخدم نفس نطاق الفترة السريعة الافتراضية
      const currentRange = selectedRanges[pharmacyId] || getDefaultRange(currentPeriod);
      const todayStr = toDateInputValue(new Date());

      /* ============================================================
         🆕 حساب الإحصائيات حسب نطاق تاريخ (من/إلى) بدل فترة ثابتة —
         بيقبل أي نطاق مختار من الكالندر (input type="date") أو من
         أزرار الاختصار السريعة
         ============================================================ */
      function getStatsByRange(fromStr, toStr) {
        const start = new Date(fromStr + "T00:00:00");
        const end = new Date(toStr + "T23:59:59");

        const filtered = phOrders.filter((o) => {
          const d = new Date(o.createdAt);
          return d >= start && d <= end;
        });

        return {
          total: filtered.length,
          accepted: filtered.filter((o) => o.status === "accepted").length,
          partial: filtered.filter((o) => o.status === "partial").length,
          rejected: filtered.filter((o) => o.status === "rejected").length,
          revenue: filtered
            .filter((o) => o.price)
            .reduce((sum, o) => sum + (o.price || 0), 0),
          orders: filtered,
        };
      }

      /* ============================================================
         🛠️ (تعديل) أسماء الشهور بالعربي — ثابتة بدل الاعتماد على
         toLocaleDateString + substring(0,3)
         ------------------------------------------------------------
         المشكلة القديمة: الاسم المختصر كان بيتحسب بقص أول 3 حروف من
         الاسم الكامل الراجع من toLocaleDateString("ar-EG"، {month:"long"})،
         وده كان بيدي نتائج غلط لبعض الشهور (زي "سبتمبر" اللي المفروض
         تختصر لـ "سبت" لكن كانت بتطلع "ست").
         الحل: مصفوفتين ثابتتين (الاسم الكامل + الاسم المختصر الصحيح)
         مفهرسة بنفس ترتيب getMonth() (0 = يناير ... 11 = ديسمبر). */
      const ARABIC_MONTHS_FULL = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
      const ARABIC_MONTHS_SHORT = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];

      // دالة لحساب الإحصائيات الشهرية
      function getMonthlyStats() {
        const months = [];
        const now = new Date();

        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

          const monthOrders = phOrders.filter((o) => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= date && orderDate < nextMonth;
          });

          months.push({
            month: ARABIC_MONTHS_FULL[date.getMonth()],
            shortMonth: ARABIC_MONTHS_SHORT[date.getMonth()],
            revenue: monthOrders
              .filter((o) => o.price)
              .reduce((sum, o) => sum + (o.price || 0), 0),
            count: monthOrders.length,
            date,
          });
        }

        return months;
      }

      const monthlyStats = getMonthlyStats();
      const currentStats = getStatsByRange(currentRange.from, currentRange.to);
      const executionRate = currentStats.total > 0
        ? Math.round(((currentStats.accepted + currentStats.partial) / currentStats.total) * 100)
        : 0;

      return `
      <div class="page-container">
        <!-- رأس الصيدلية -->
        <div class="page-header" style="display:flex;align-items:center;gap:16px;margin-bottom:32px">
          <div style="display:flex;align-items:center;gap:16px;flex:1">
            ${avatar(pharmacy.pharmacyName, pharmacy.color, "avatar-xl")}
            <div>
              <h1 style="margin:0;margin-bottom:4px">${esc(pharmacy.pharmacyName)}</h1>
              <p class="text-muted" style="margin:0">${esc(pharmacy.name)} • ${esc(pharmacy.phone || "—")} • ${esc(pharmacy.address || "—")}</p>
            </div>
          </div>
          <a href="#/pharmacies" class="btn btn-soft">← العودة</a>
        </div>

        <!-- ============================================================
             🆕 مختار الفترة الزمنية — كالندر (من/إلى) + اختصارات سريعة
             ------------------------------------------------------------
             بدل التابات الثابتة (يوم/أسبوع/شهر/سنة) بس، دلوقتي فيه
             حقلين تاريخ حقيقيين (input type="date") بيفتحوا كالندر
             المتصفح الأصلي، فتقدر تحدد أي نطاق تاريخ عايزه بالظبط.
             الأزرار السريعة لسه موجودة لسهولة الاستخدام وبتملى
             الحقلين تلقائيًا.
             ============================================================ -->
        <div class="period-selector" style="display:flex;flex-direction:column;gap:14px;margin-bottom:24px;background:var(--bg-soft);padding:14px;border-radius:12px">
          <div class="period-quick" style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="period-tab ${currentPeriod === "day" ? "active" : ""}" data-quick="day">${icon("zap", 15)} اليوم</button>
            <button type="button" class="period-tab ${currentPeriod === "week" ? "active" : ""}" data-quick="week">${icon("zap", 15)} الأسبوع</button>
            <button type="button" class="period-tab ${currentPeriod === "month" ? "active" : ""}" data-quick="month">${icon("zap", 15)} الشهر</button>
            <button type="button" class="period-tab ${currentPeriod === "year" ? "active" : ""}" data-quick="year">${icon("zap", 15)} السنة</button>
          </div>
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
            <div class="field" style="margin:0">
              <label>${icon("calendar", 14)} من تاريخ</label>
              <input type="date" class="input" id="range-from" value="${esc(currentRange.from)}" max="${esc(todayStr)}" />
            </div>
            <div class="field" style="margin:0">
              <label>${icon("calendar", 14)} إلى تاريخ</label>
              <input type="date" class="input" id="range-to" value="${esc(currentRange.to)}" max="${esc(todayStr)}" />
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="range-apply">${icon("check", 15)} تطبيق</button>
          </div>
        </div>

        <!-- البطاقات الإحصائية -->
        <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:32px">
          <div class="stat-card">
            <div class="stat-icon" style="background:#e0f2fe">${icon("inbox", 24)}</div>
            <div class="stat-value">${fmtNum(currentStats.total)}</div>
            <div class="stat-label">إجمالي الطلبات</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#dcfce7">${icon("check", 24)}</div>
            <div class="stat-value">${fmtNum(currentStats.accepted)}</div>
            <div class="stat-label">طلبات منفذة</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fef3c7">${icon("alert", 24)}</div>
            <div class="stat-value">${fmtNum(currentStats.partial)}</div>
            <div class="stat-label">طلبات جزئية</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fee2e2">${icon("x", 24)}</div>
            <div class="stat-value">${fmtNum(currentStats.rejected)}</div>
            <div class="stat-label">طلبات مرفوضة</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#f3e8ff;color:#a855f7">${icon("trendingUp", 24)}</div>
            <div class="stat-value">${fmtMoney(currentStats.revenue)}</div>
            <div class="stat-label">إجمالي الإيرادات</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#e0e7ff">
              <div class="execution-ring" style="--ring-value:${executionRate};--ring-color:${executionRate > 60 ? "#10b981" : executionRate > 40 ? "#f59e0b" : "#ef4444"}">
                <span style="font-size:14px;font-weight:bold">${executionRate}%</span>
              </div>
            </div>
            <div class="stat-label">معدل التنفيذ</div>
          </div>
        </div>

        <!-- رسم بياني للمبيعات الشهرية -->
        <div class="card" style="margin-bottom:32px">
          <div class="card-header">
            <h3 style="margin:0">المبيعات الشهرية (آخر 12 شهر)</h3>
          </div>
          <div class="card-body">
            <div class="monthly-chart" style="display:grid;grid-template-columns:repeat(12,1fr);gap:8px;min-height:200px">
              ${monthlyStats
                .map((m) => {
                  const maxRevenue = Math.max(...monthlyStats.map((x) => x.revenue || 0)) || 1;
                  const height = (m.revenue / maxRevenue) * 100;
                  return `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                      <div class="month-bar" style="width:100%;height:${Math.max(height, 10)}px;background:linear-gradient(to top,#0284c7,#0ea5e9);border-radius:4px;cursor:pointer" title="${m.month}: ${fmtMoney(m.revenue)}"></div>
                      <div style="font-size:12px;text-align:center;color:var(--text-muted);white-space:nowrap">${m.shortMonth}</div>
                      <div style="font-size:11px;color:var(--text-muted);text-align:center">${fmtNum(m.count)}</div>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </div>
        </div>

        <!-- قائمة الطلبات -->
        <div class="card">
          <div class="card-header">
            <h3 style="margin:0">الطلبات في الفترة المختارة</h3>
            <div class="badge" style="background:var(--bg-soft);color:var(--text-main)">${currentStats.total}</div>
          </div>
          <div class="card-body">
            ${currentStats.orders.length === 0
              ? `<div class="empty-state small">
                   ${icon("inbox", 40)}
                   <p>لا توجد طلبات في هذه الفترة</p>
                 </div>`
              : `<div class="table-responsive">
                   <table class="table">
                     <thead>
                       <tr>
                         <th>رقم الطلب</th>
                         <th>اسم العميل</th>
                         <th>الأدوية</th>
                         <th>الحالة</th>
                         <th>السعر</th>
                         <th>التاريخ</th>
                       </tr>
                     </thead>
                     <tbody>
                       ${currentStats.orders
                         .slice(0, 20)
                         .map(
                           (o) => `
                           <tr>
                             <td><code style="background:var(--bg-soft);padding:4px 8px;border-radius:6px;font-size:12px">#${esc(o.id)}</code></td>
                             <td>${esc(o.customerName)}</td>
                             <td>
                               <div class="small" style="max-width:150px;overflow:hidden;text-overflow:ellipsis">${o.items.slice(0, 2).map(esc).join("، ")}${o.items.length > 2 ? "…" : ""}</div>
                             </td>
                             <td>
                               <span class="badge badge-${o.status === "accepted" ? "accepted" : o.status === "partial" ? "partial" : "rejected"}">
                                 ${o.status === "accepted" ? "منفذة" : o.status === "partial" ? "جزئية" : "مرفوضة"}
                               </span>
                             </td>
                             <td>${fmtMoney(o.price || 0)}</td>
                             <td class="small muted">${new Date(o.createdAt).toLocaleDateString("ar-EG")}</td>
                           </tr>
                         `
                         )
                         .join("")}
                     </tbody>
                   </table>
                 </div>`}
          </div>
        </div>
      </div>
      `;
    },

    mount(user, pharmacyId) {
      /* 🆕 أزرار الاختصار السريعة (اليوم/الأسبوع/الشهر/السنة) — بتملى
         حقلَي الكالندر تلقائيًا بنطاق التاريخ المناسب وتطبّقه فورًا */
      document.querySelectorAll(".period-selector .period-tab[data-quick]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const period = btn.dataset.quick;
          selectedPeriods[pharmacyId] = period;
          selectedRanges[pharmacyId] = getDefaultRange(period);
          App.router.refresh();
        });
      });

      /* 🆕 زرار "تطبيق" — بياخد التاريخين من حقلَي الكالندر ويحسب
         الإحصائيات على النطاق المخصص ده بالظبط */
      const applyBtn = document.getElementById("range-apply");
      if (applyBtn) applyBtn.addEventListener("click", () => {
        const fromInput = document.getElementById("range-from");
        const toInput = document.getElementById("range-to");
        const from = fromInput.value;
        const to = toInput.value;

        if (!from || !to) {
          toast("حدد تاريخ البداية والنهاية", "", "warning");
          return;
        }
        if (from > to) {
          toast("تاريخ البداية لازم يكون قبل تاريخ النهاية", "", "warning");
          return;
        }

        selectedPeriods[pharmacyId] = "custom";
        selectedRanges[pharmacyId] = { from, to };
        App.router.refresh();
      });
    },
  };
})();
