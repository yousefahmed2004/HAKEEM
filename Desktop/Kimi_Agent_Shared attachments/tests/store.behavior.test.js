const assert = require('assert');

class MemoryStorage {
    constructor() { this.store = new Map(); }
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
    setItem(key, value) { this.store.set(key, String(value)); }
    removeItem(key) { this.store.delete(key); }
    clear() { this.store.clear(); }
}

const storage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
global.window = { App: {} }; global.App = global.window.App; global.localStorage = storage;
global.sessionStorage = sessionStorage;
global.document = { createElement: () => ({}) };

global.window.App.api = { getPharmacists: async () => ({ ok: true, pharmacists: [] }) };
global.window.App.ui = {};
global.window.App.webhook = { sendStatusUpdate() { } };

require('../app/js/store.js');

const store = global.window.App.store;

function createUser(id, role = 'pharmacist') {
    return {
        id,
        role,
        name: `User ${id}`,
        pharmacyName: `Pharmacy ${id}`,
        username: `${id}`,
        password: '123456',
        status: 'active',
        maxActiveOrders: 2,
    };
}

function createOrder() {
    return {
        id: 'order-1',
        customerName: 'عميل تجريبي',
        phone: '01000000000',
        address: 'العنوان',
        items: ['Panadol'],
        prescriptionImage: '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        pharmacyId: null,
        pharmacyName: null,
        price: null,
        availableItems: [],
        unavailableItems: [],
        notes: '',
        rejectedBy: [],
        timeline: [],
    };
}

(function run() {
    const user = createUser('ph1');
    store.addOrder(createOrder());
    const order = store.acceptOrder('order-1', user);

    assert.strictEqual(order.executionPending, true, 'acceptOrder should mark the order as pending execution');
    assert.ok(order.executionDeadline, 'acceptOrder should set an execution deadline');

    const expired = store.expirePendingExecution('order-1');
    assert.strictEqual(expired.status, 'pending', 'expired execution should return the order to pending');
    assert.strictEqual(expired.pharmacyId, null, 'expired execution should clear pharmacy assignment');
    assert.strictEqual(expired.executionFailed, true, 'expired execution should mark the pharmacy as failed');

    store.addOrder({ ...createOrder(), id: 'order-2' });
    store.addOrder({ ...createOrder(), id: 'order-3' });
    store.addOrder({ ...createOrder(), id: 'order-4' });
    assert.ok(store.acceptOrder('order-2', user), 'accept should succeed within capacity');
    assert.ok(store.acceptOrder('order-3', user), 'accept should succeed within capacity');
    assert.strictEqual(store.acceptOrder('order-4', user), null, 'accept should be blocked once the capacity limit is reached');

    const released = store.updateOrderWorkflowStatus('order-2', user, 'delivered');
    assert.strictEqual(released.workflowStatus, 'delivered', 'workflow status should update');
    assert.ok(store.acceptOrder('order-4', user), 'accept should succeed again after a slot is released');

    console.log('store behavior tests passed');
})();
