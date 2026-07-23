/* ============================================================
   api.js — طبقة التكامل مع الـ Backend
   ============================================================ */
window.App = window.App || {};

(function () {
    const API_BASE = "http://localhost:5000/api";

    /* ============================================================
       دوال مساعدة للـ HTTP
       ============================================================ */
    const http = {
        async get(endpoint) {
            const response = await fetch(`${API_BASE}${endpoint}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },

        async post(endpoint, data) {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },

        async put(endpoint, data) {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },

        async patch(endpoint, data) {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        },
    };

    /* ============================================================
       الواجهة العامة
       ============================================================ */
    App.api = {
        /* المصادقة */
        async login(username, password) {
            try {
                return await http.post("/auth/login", { username, password });
            } catch (err) {
                console.error("❌ خطأ في تسجيل الدخول:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async getUser(userId) {
            try {
                return await http.get(`/auth/user/${userId}`);
            } catch (err) {
                console.error("❌ خطأ في جلب بيانات المستخدم:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async updateProfile(userId, updates) {
            try {
                return await http.put(`/auth/user/${userId}`, updates);
            } catch (err) {
                console.error("❌ خطأ في تحديث الملف الشخصي:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async getPharmacists() {
            try {
                return await http.get("/auth/pharmacists");
            } catch (err) {
                console.error("❌ خطأ في جلب قائمة الصيادلة:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async addPharmacist(data) {
            try {
                return await http.post("/auth/pharmacist", data);
            } catch (err) {
                console.error("❌ خطأ في إضافة صيدلي:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async updateUserStatus(userId, status) {
            try {
                return await http.patch(`/auth/user/${userId}/status`, { status });
            } catch (err) {
                console.error("❌ خطأ في تحديث الحالة:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        /* الطلبات */
        async getOrders(filters = {}) {
            try {
                const query = new URLSearchParams(filters).toString();
                const endpoint = `/orders${query ? "?" + query : ""}`;
                return await http.get(endpoint);
            } catch (err) {
                console.error("❌ خطأ في جلب الطلبات:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async getOrder(orderId) {
            try {
                return await http.get(`/orders/${orderId}`);
            } catch (err) {
                console.error("❌ خطأ في جلب الطلب:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async createOrder(orderData) {
            try {
                return await http.post("/orders", orderData);
            } catch (err) {
                console.error("❌ خطأ في إنشاء الطلب:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async updateOrder(orderId, updates) {
            try {
                return await http.put(`/orders/${orderId}`, updates);
            } catch (err) {
                console.error("❌ خطأ في تحديث الطلب:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async rejectOrder(orderId, pharmacyId) {
            try {
                return await http.patch(`/orders/${orderId}/reject/${pharmacyId}`, {});
            } catch (err) {
                console.error("❌ خطأ في رفض الطلب:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },

        async getOrdersStats() {
            try {
                return await http.get("/orders-stats");
            } catch (err) {
                console.error("❌ خطأ في جلب الإحصائيات:", err.message);
                return { ok: false, error: "فشل الاتصال بالخادم" };
            }
        },
    };
})();
