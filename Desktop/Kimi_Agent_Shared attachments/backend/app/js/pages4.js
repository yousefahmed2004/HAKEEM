/* ============================================================
   pages4.js — الصيدليات + تفاصيل الصيدلية مع الإحصائيات
   ============================================================ */
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  const { icon, esc, avatar, fmtMoney, fmtNum, toast } = App.ui;
  const S = () => App.store;
  
  // تخزين الفترة الزمنية المختارة لكل صيدلية
  const selectedPeriods = {};
  
  // تخزين حالة التوب سيرش لكل صيدلية (هل مفعل أم لا)
  const pharmacyTopSearchStates = {};
  
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

      const pharmaciesHTML = pharmacists
        .filter((p) => p.status === "active")
        .map((p) => {
          const stats = getPharmacyStats(p.id);
          const executionRate = stats.total > 0
            ? Math.round(((stats.accepted + stats.partial) / stats.total) * 100)
            : 0;

          return `
          <div class="card-item pharmacy-card" data-pharmacy-id="${esc(p.id)}">
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
        })
        .join("");

      return `
      <div class="page-container">
        <div class="page-header">
          <h1>الصيدليات المفعّلة</h1>
          <p class="text-muted">عرض وتحليل بيانات جميع الصيدليات</p>
        </div>

        ${pharmacists.length === 0
          ? `<div class="empty-state">
               ${icon("inbox", 56)}
               <h3>لا توجد صيدليات</h3>
               <p>قم بإضافة صيدليات من قسم "الصيادلة" أولاً</p>
             </div>`
          : `<div class="cards-grid" style="grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:20px">
               ${pharmaciesHTML}
             </div>`}
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
      
      // الحصول على الفترة المختارة الحالية (أو استخدام "month" بشكل افتراضي)
      const currentPeriod = selectedPeriods[pharmacyId] || "month";

      // دالة لحساب الإحصائيات حسب الفترة الزمنية
      function getStatsByPeriod(period) {
        const now = new Date();
        let startDate = new Date();

        switch (period) {
          case "day":
            startDate.setDate(now.getDate() - 1);
            break;
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
          case "year":
            startDate.setFullYear(now.getFullYear() - 1);
            break;
          default:
            startDate.setMonth(now.getMonth() - 1);
        }

        const filtered = phOrders.filter(
          (o) => new Date(o.createdAt) >= startDate
        );

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
            month: date.toLocaleDateString("ar-EG", { month: "long" }),
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
      const currentStats = getStatsByPeriod(currentPeriod);
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

        <!-- مختار الفترة الزمنية -->
        <div class="period-selector" style="display:flex;gap:8px;margin-bottom:24px;background:var(--bg-soft);padding:12px;border-radius:12px">
          <label class="period-tab ${currentPeriod === "month" ? "active" : ""}" data-period="month">
            <input type="radio" name="period" value="month" ${currentPeriod === "month" ? "checked" : ""} hidden>
            <span>${icon("calendar", 16)} الشهر</span>
          </label>
          <label class="period-tab ${currentPeriod === "week" ? "active" : ""}" data-period="week">
            <input type="radio" name="period" value="week" ${currentPeriod === "week" ? "checked" : ""} hidden>
            <span>${icon("calendar", 16)} الأسبوع</span>
          </label>
          <label class="period-tab ${currentPeriod === "day" ? "active" : ""}" data-period="day">
            <input type="radio" name="period" value="day" ${currentPeriod === "day" ? "checked" : ""} hidden>
            <span>${icon("calendar", 16)} اليوم</span>
          </label>
          <label class="period-tab ${currentPeriod === "year" ? "active" : ""}" data-period="year">
            <input type="radio" name="period" value="year" ${currentPeriod === "year" ? "checked" : ""} hidden>
            <span>${icon("calendar", 16)} السنة</span>
          </label>
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
                      <div style="font-size:12px;text-align:center;color:var(--text-muted);white-space:nowrap">${m.month.substring(0, 3)}</div>
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
      // معالج اختيار الفترة الزمنية
      document.querySelectorAll(".period-selector .period-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          const period = tab.dataset.period;
          // حفظ الفترة المختارة
          selectedPeriods[pharmacyId] = period;
          
          // تحديث الأزرار النشطة
          document.querySelectorAll(".period-selector .period-tab").forEach((t) => {
            t.classList.toggle("active", t.dataset.period === period);
            t.querySelector("input").checked = t.dataset.period === period;
          });
          
          // إعادة تحميل الصفحة لتحديث البيانات
          App.router.refresh();
        });
      });
    },
  };
})();
