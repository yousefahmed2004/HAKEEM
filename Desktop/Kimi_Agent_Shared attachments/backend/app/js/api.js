/* ============================================================
   api.js — ملف الاتصال بالخادم والـ API
   ============================================================ */

window.App = window.App || {};

(function () {
    // استخدام مسار نسبي للـ API ليعمل بكفاءة على أي دومين
    // مثل hakeem.sbs تلقائياً
    const API_BASE_URL = "/api";

    /**
     * دالة مساعدة لإرسال الطلبات للـ Backend
     */
    async function apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "حدث خطأ في الاتصال بالخادم"
                );
            }

            return data;
        } catch (error) {
            console.error(
                `❌ خطأ في الطلب (${endpoint}):`,
                error.message
            );

            throw error;
        }
    }

    /* ============================================================
       App.api — الواجهة الموحّدة اللي بيستخدمها store.js
       ============================================================ */

    App.api = {

        /* ---------- المصادقة ---------- */

        async login(username, password) {
            return apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    username,
                    password
                })
            });
        },

        async addPharmacist(payload) {
            // الباك إند بيقبلها من /auth/register
            // أو /auth/pharmacist
            return apiRequest("/auth/pharmacist", {
                method: "POST",
                body: JSON.stringify({
                    ...payload,
                    role: "pharmacist"
                })
            });
        },

        async updateProfile(userId, patch) {
            return apiRequest(`/auth/user/${userId}`, {
                method: "PUT",
                body: JSON.stringify(patch)
            });
        },

        async updateUserStatus(userId, status) {
            return apiRequest(`/auth/user/${userId}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                    status
                })
            });
        },

        async getPharmacists() {
            try {
                return await apiRequest("/auth/pharmacists");
            } catch (error) {
                console.error(
                    "❌ خطأ في جلب قائمة الصيادلة:",
                    error
                );

                return {
                    ok: false,
                    pharmacists: []
                };
            }
        },

        /* ---------- 🆕 حذف صيدلي نهائيًا ----------
           كانت الدالة دي ناقصة بالكامل، وده هو سبب المشكلة الأساسي:
           الحذف كان بيحصل محليًا بس (store.js) من غير ما يوصل للسيرفر
           أبدًا. الرد المتوقع من الباك إند: { ok: true, id } */
        async deletePharmacist(userId) {
            return apiRequest(`/auth/user/${userId}`, {
                method: "DELETE"
            });
        },

        /* ---------- الطلبات ---------- */

        async getOrders() {
            try {
                return await apiRequest("/orders");
            } catch (error) {
                console.error(
                    "❌ خطأ في جلب الطلبات:",
                    error
                );

                return {
                    ok: false,
                    orders: []
                };
            }
        },

        async getOrder(id) {
            return apiRequest(`/orders/${id}`);
        },

        async createOrder(orderData) {
            return apiRequest("/orders", {
                method: "POST",
                body: JSON.stringify(orderData)
            });
        },

        /* ---------- 🆕 قبول الطلب بالكامل (Race-safe) ----------
           بتنادي /orders/:id/accept الجديد بدل التحديث العام، عشان
           الباك إند يعمل قفل حقيقي على الصف (FOR UPDATE) ويمنع
           صيدليتين من قبول نفس الطلب في نفس اللحظة.
           payload = { pharmacyId, pharmacyName }
           الرد: { ok, id } أو خطأ برسالة واضحة لو الطلب اتاخد قبل كده */
        async acceptOrder(id, payload) {
            return apiRequest(`/orders/${id}/accept`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        },

        async updateOrder(id, patch) {
            return apiRequest(`/orders/${id}`, {
                method: "PUT",
                body: JSON.stringify(patch)
            });
        },

        async rejectOrder(id, pharmacyId) {
            return apiRequest(
                `/orders/${id}/reject/${pharmacyId}`,
                {
                    method: "PATCH"
                }
            );
        },

        /* ---------- 🆕 التنفيذ الجزئي (Partial Fulfillment + Order Splitting) ----------
           payload = { pharmacyId, pharmacyName, availableItems, unavailableItems, price, notes }
           الرد: { ok, orderId, childOrderId, shortageAlerts } */
        async partialOrder(id, payload) {
            return apiRequest(`/orders/${id}/partial`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        },

        /* ---------- 🆕 الإبلاغ عن عدم توفر طلب "فرعي" (ناتج عن تنفيذ جزئي) في السوق ----------
           payload = { pharmacyId, pharmacyName }
           الرد: { ok, shortageAlerts } — متاح فقط للطلبات اللي عندها parentOrderId */
        async reportUnavailableInMarket(id, payload) {
            return apiRequest(`/orders/${id}/unavailable`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        },

        async getOrderShortages(id) {
            return apiRequest(`/orders/${id}/shortages`);
        },

        async getOrdersStats() {
            return apiRequest("/orders-stats");
        }
    };

    /* ============================================================
       🆕 App.api.payments — إيصالات دفع اشتراك الصيدليات
       ------------------------------------------------------------
       - submitReceipt: الصيدلي يرفع إيصال (صورة base64 + مبلغ/ملاحظات)
       - myReceipts: سجل إيصالات صيدلية معينة
       - getReceipts: كل الإيصالات (أدمين) — فلترة اختيارية بـ status/period
       - acceptReceipt / rejectReceipt: قرار الأدمين (رفض ممكن يترفق
         بـ banPharmacy:true عشان يبند الصيدلية في نفس الخطوة)
       - getStatus: نظرة عامة — مين دفع ومين لسه، لفترة معينة (شهر
         افتراضيًا)
       ============================================================ */
    App.api.payments = {
        async submitReceipt(payload) {
            return apiRequest("/payments/receipts", {
                method: "POST",
                body: JSON.stringify(payload)
            });
        },

        async myReceipts(pharmacyId) {
            try {
                return await apiRequest(`/payments/receipts/mine/${pharmacyId}`);
            } catch (error) {
                return { ok: false, receipts: [] };
            }
        },

        async getReceipts(params = {}) {
            const qs = new URLSearchParams(
                Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
            ).toString();
            try {
                return await apiRequest(`/payments/receipts${qs ? "?" + qs : ""}`);
            } catch (error) {
                return { ok: false, receipts: [] };
            }
        },

        async acceptReceipt(id, reviewedBy) {
            return apiRequest(`/payments/receipts/${id}/accept`, {
                method: "POST",
                body: JSON.stringify({ reviewedBy })
            });
        },

        async rejectReceipt(id, payload) {
            return apiRequest(`/payments/receipts/${id}/reject`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        },

        async getStatus(period) {
            try {
                return await apiRequest(`/payments/status${period ? "?period=" + encodeURIComponent(period) : ""}`);
            } catch (error) {
                return { ok: false, summary: {}, pharmacies: [] };
            }
        }
    };
})();
