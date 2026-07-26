/* ============================================================
   api.js — ملف الاتصال بالخادم والـ API
   ============================================================ */

// استخدام مسار نسبي للـ API ليعمل بكفاءة على أي دومين (مثل hakeem.sbs) تلقائياً
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
            throw new Error(data.error || "حدث خطأ في الاتصال بالخادم");
        }

        return data;
    } catch (error) {
        console.error(`❌ خطأ في الطلب (${endpoint}):`, error.message);
        throw error;
    }
}

/* ============================================================
   خدمات المصادقة (Auth Services)
   ============================================================ */

async function loginUser(username, password) {
    try {
        const result = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });
        return result;
    } catch (error) {
        console.error("❌ خطأ في تسجيل الدخول:", error);
        throw error;
    }
}

async function registerUser(userData) {
    try {
        const result = await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify(userData)
        });
        return result;
    } catch (error) {
        console.error("❌ خطأ في إنشاء الحساب:", error);
        throw error;
    }
}

async function getPharmacists() {
    try {
        const result = await apiRequest("/auth/pharmacists");
        return result;
    } catch (error) {
        console.error("❌ خطأ في جلب قائمة الصيادلة:", error);
        return { success: false, data: [] };
    }
}

/* ============================================================
   خدمات الطلبات والبيانات (Orders Services)
   ============================================================ */

async function getOrders() {
    try {
        const result = await apiRequest("/orders");
        return result;
    } catch (error) {
        console.error("❌ خطأ في جلب الطلبات:", error);
        return { success: false, data: [] };
    }
}

async function createOrder(orderData) {
    try {
        const result = await apiRequest("/orders", {
            method: "POST",
            body: JSON.stringify(orderData)
        });
        return result;
    } catch (error) {
        console.error("❌ خطأ في إنشاء الطلب:", error);
        throw error;
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        const result = await apiRequest(`/orders/${orderId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });
        return result;
    } catch (error) {
        console.error("❌ خطأ في تحديث حالة الطلب:", error);
        throw error;
    }
}
