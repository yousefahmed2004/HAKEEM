/* ============================================================
   webhook.js — طبقة التكامل مع n8n عبر Backend Proxy
   ============================================================
   يتم إرسال طلبات POST إلى Backend Proxy
   الذي يقوم بدوره بتوجيه الطلب إلى n8n Webhook.
   هذا يحل مشكلة CORS في المتصفح.
   ============================================================ */
window.App = window.App || {};
(function () {
  const API_BASE = "/api"; // مسار نسبي عشان يشتغل على أي دومين (Easypanel / hakeem.sbs) مش بس localhost
  App.webhook = {
    /**
     * استقبال طلب جديد قادم من n8n / الشات بوت
     * @param {Object} payload — بيانات الطلب بالشكل المتفق عليه
     */
    receiveOrder(payload) {
      const order = {
        id: String(payload.orderId || payload.id || Date.now()),
        customerName: payload.customerName || "عميل",
        phone: payload.phone || "",
        address: payload.address || "",
        items: Array.isArray(payload.items) ? payload.items : [],
        prescriptionImage: payload.prescriptionImage || "",
        status: "pending",
        createdAt: payload.createdAt ? new Date(payload.createdAt).toISOString() : new Date().toISOString(),
        pharmacyId: null, pharmacyName: null, price: null,
        availableItems: [], unavailableItems: [], notes: "", rejectedBy: [],
        timeline: [{ at: new Date().toISOString(), text: "تم استلام الطلب من الشات بوت", color: "#0ea5e9" }],
      };
      return App.store.addOrder(order);
    },
    /**
     * إرسال تحديث حالة الطلب إلى n8n عبر Backend Proxy
     * لتجنب مشكلة CORS في المتصفح.
     * الصيغة: { "order_id": 10255 }
     * @param {Object} order — كائن الطلب (يجب أن يحتوي على order.id)
     * @returns {boolean} true إذا نجح الإرسال، false إذا فشل
     */
    async sendStatusUpdate(order) {
      if (!order || !order.id) {
        console.error("[Webhook] ❌ لا يوجد طلب صالح للإرسال");
        return false;
      }
      const payload = {
        order_id: Number(order.id),
      };
      console.log(`%c[Webhook] إرسال إلى Proxy Backend:`, "color:#0ea5e9;font-weight:bold", JSON.stringify(payload));
      try {
        const response = await fetch(`${API_BASE}/webhook/shipping`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          console.log(`%c[Webhook ✓] تم إرسال الطلب #${order.id} إلى n8n بنجاح`, "color:#10b981;font-weight:bold");
          return true;
        } else {
          const data = await response.json().catch(() => ({}));
          console.error(`[Webhook ✗] فشل — HTTP ${response.status}: ${data.error || ""}`);
          return false;
        }
      } catch (err) {
        console.error("[Webhook ✗] خطأ في الاتصال بـ Backend Proxy:", err.message);
        return false;
      }
    },
  };
  /* دالة اختبار — يمكن تشغيلها من Console:
     await App.webhook.testConnection() */
  App.webhook.testConnection = async function () {
    console.log("%c[Webhook] اختبار الاتصال بـ Backend Proxy...", "color:#0ea5e9;font-weight:bold");
    const result = await App.webhook.sendStatusUpdate({ id: "99999" });
    if (result) {
      console.log("%c[Webhook] ✅ الاختبار ناجح", "color:#10b981;font-weight:bold");
    } else {
      console.log("%c[Webhook] ❌ الاختبار فاشل — تأكد من تشغيل الخادم", "color:#ef4444;font-weight:bold");
    }
    return result;
  };
})();
