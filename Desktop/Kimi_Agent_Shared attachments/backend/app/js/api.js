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
})();
