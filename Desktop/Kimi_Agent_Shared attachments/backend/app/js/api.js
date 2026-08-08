/* ============================================================
   api.js — ملف الاتصال بالخادم والـ API
   ============================================================ */
window.App = window.App || {};

(function () {
    // استخدام مسار نسبي للـ API ليعمل بكفاءة على أي دومين (مثل hakeem.sbs) تلقائياً
    const API_BASE_URL = "/api";

    /**
     * دالة مساعدة لإرسال الطلبات للـ Backend
     */
    async function apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(${API_BASE_URL}${endpoint}, {
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers
                },
                ...options
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "حدث خطأ في الاتصال بالخادم");
            }
            return data;
        } catch (error) {
            console.error(❌ خطأ في الطلب (${endpoint}):, error.message);
            throw error;
        }
    }

    /* 
