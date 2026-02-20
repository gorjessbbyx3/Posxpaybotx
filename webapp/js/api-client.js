/**
 * API Client - Frontend-to-Backend Bridge
 *
 * Connects the POS frontend to the Express API server,
 * eliminating the dual data store problem.
 *
 * All methods return Promises. The client handles:
 * - Auth token injection
 * - Error normalization
 * - Offline queue for critical operations
 */

const APIClient = (function () {
    'use strict';

    const BASE_URL = '/api';
    let authToken = null;
    const offlineQueue = [];

    /**
     * Set the auth token for subsequent requests.
     * @param {string} token
     */
    function setToken(token) {
        authToken = token;
    }

    /**
     * Core fetch wrapper with auth and error handling.
     */
    async function request(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers['Authorization'] = 'Bearer ' + authToken;
        }

        const opts = { method, headers };
        if (body && method !== 'GET') {
            opts.body = JSON.stringify(body);
        }

        try {
            const res = await fetch(BASE_URL + path, opts);

            if (res.status === 401) {
                throw new APIError('Unauthorized - please log in again', 401);
            }
            if (res.status === 403) {
                throw new APIError('Forbidden - insufficient permissions', 403);
            }

            const data = await res.json();

            if (!res.ok) {
                throw new APIError(data.error || 'Request failed', res.status, data);
            }

            return data;
        } catch (err) {
            if (err instanceof APIError) throw err;

            // Network error - queue if it's a write operation
            if (method !== 'GET' && body) {
                offlineQueue.push({ method, path, body, timestamp: Date.now() });
                console.warn('Queued offline operation:', method, path);
            }

            throw new APIError('Network error - check connection', 0, { offline: true });
        }
    }

    class APIError extends Error {
        constructor(message, status, data) {
            super(message);
            this.name = 'APIError';
            this.status = status;
            this.data = data;
        }
    }

    // ---- Tickets ----

    function getTickets(filters) {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') params.set(k, v);
            });
        }
        const qs = params.toString();
        return request('GET', '/tickets' + (qs ? '?' + qs : ''));
    }

    function getTicket(id) {
        return request('GET', '/tickets/' + id);
    }

    function createTicket(ticket) {
        return request('POST', '/tickets', ticket);
    }

    function updateTicket(id, updates) {
        return request('PATCH', '/tickets/' + id, updates);
    }

    function payTicket(id, method, tip) {
        return request('POST', '/tickets/' + id + '/pay', { method, tip });
    }

    function voidTicket(id, user, reason) {
        return request('POST', '/tickets/' + id + '/void', { user, reason });
    }

    // ---- Refunds ----

    function getRefunds() {
        return request('GET', '/refunds');
    }

    function createRefund(ticketId, amount, reason, type, processedBy) {
        return request('POST', '/refunds', { ticketId, amount, reason, type, processedBy });
    }

    // ---- Kitchen ----

    function getKitchenOrders(station) {
        const qs = station && station !== 'all' ? '?station=' + station : '';
        return request('GET', '/kitchen' + qs);
    }

    function sendToKitchen(ticketId, items, type, server, table) {
        return request('POST', '/kitchen', { ticketId, items, type, server, table });
    }

    function bumpKitchenOrder(id) {
        return request('POST', '/kitchen/' + id + '/bump');
    }

    function fireCourse(id, course) {
        return request('POST', '/kitchen/' + id + '/fire-course', { course });
    }

    function pickupKitchenOrder(id) {
        return request('POST', '/kitchen/' + id + '/pickup');
    }

    // ---- Held Orders ----

    function getHeldOrders() {
        return request('GET', '/held-orders');
    }

    function holdOrder(order) {
        return request('POST', '/held-orders', order);
    }

    function recallHeldOrder(index) {
        return request('DELETE', '/held-orders/' + index);
    }

    // ---- Time Clock ----

    function getTimeClock(empId, date) {
        const params = new URLSearchParams();
        if (empId) params.set('empId', empId);
        if (date) params.set('date', date);
        return request('GET', '/timeclock?' + params.toString());
    }

    function clockIn(empId, empName, role) {
        return request('POST', '/timeclock/clock-in', { empId, empName, role });
    }

    function clockOut(empId) {
        return request('POST', '/timeclock/clock-out', { empId });
    }

    // ---- Config ----

    function getConfig(section) {
        return request('GET', section ? '/config/' + section : '/config');
    }

    function updateConfig(section, data) {
        return request('PUT', '/config/' + section, data);
    }

    // ---- Reports ----

    function getReportSummary() {
        return request('GET', '/reports/summary');
    }

    function getReportHourly() {
        return request('GET', '/reports/hourly');
    }

    function getReportItemMix() {
        return request('GET', '/reports/item-mix');
    }

    function getReportLabor() {
        return request('GET', '/reports/labor');
    }

    // ---- Health ----

    function healthCheck() {
        return request('GET', '/health');
    }

    // ---- Auth ----

    function login(pin, user) {
        return request('POST', '/auth/login', { pin, user });
    }

    // ---- Customers ----

    function getCustomers() {
        return request('GET', '/customers');
    }

    function getCustomer(id) {
        return request('GET', '/customers/' + id);
    }

    function createCustomer(customer) {
        return request('POST', '/customers', customer);
    }

    function updateCustomer(id, updates) {
        return request('PATCH', '/customers/' + id, updates);
    }

    function getLoyalty(customerId) {
        return request('GET', '/customers/' + customerId + '/loyalty');
    }

    function earnLoyalty(customerId, points, ticketId) {
        return request('POST', '/customers/' + customerId + '/loyalty/earn', { points, ticketId });
    }

    function redeemLoyalty(customerId, points) {
        return request('POST', '/customers/' + customerId + '/loyalty/redeem', { points });
    }

    // ---- Gift Cards ----

    function getGiftCards() {
        return request('GET', '/gift-cards');
    }

    function getGiftCard(number) {
        return request('GET', '/gift-cards/' + number);
    }

    function createGiftCard(amount) {
        return request('POST', '/gift-cards', { amount });
    }

    function chargeGiftCard(number, amount, ticketId) {
        return request('POST', '/gift-cards/' + number + '/charge', { amount, ticketId });
    }

    function reloadGiftCard(number, amount) {
        return request('POST', '/gift-cards/' + number + '/reload', { amount });
    }

    // ---- Promo Codes ----

    function validatePromoCode(code) {
        return request('POST', '/promo-codes/validate', { code });
    }

    function redeemPromoCode(code, ticketId) {
        return request('POST', '/promo-codes/redeem', { code, ticketId });
    }

    // ---- Inventory ----

    function getIngredients() {
        return request('GET', '/ingredients');
    }

    function adjustIngredient(id, qty, reason) {
        return request('POST', '/ingredients/' + id + '/adjust', { quantity: qty, reason });
    }

    function getLowStockAlerts() {
        return request('GET', '/alerts/low-stock');
    }

    // ---- Waitlist ----

    function getWaitlist() {
        return request('GET', '/waitlist');
    }

    function addToWaitlist(entry) {
        return request('POST', '/waitlist', entry);
    }

    function updateWaitlistEntry(id, updates) {
        return request('PATCH', '/waitlist/' + id, updates);
    }

    // ---- Reservations ----

    function getReservations() {
        return request('GET', '/reservations');
    }

    function createReservation(reservation) {
        return request('POST', '/reservations', reservation);
    }

    function deleteReservation(id) {
        return request('DELETE', '/reservations/' + id);
    }

    // ---- Online / QR Orders ----

    function getOnlineOrders() {
        return request('GET', '/online-orders');
    }

    function acceptOnlineOrder(id) {
        return request('POST', '/online-orders/' + id + '/accept');
    }

    function getQROrders() {
        return request('GET', '/qr-orders');
    }

    function acceptQROrder(id) {
        return request('POST', '/qr-orders/' + id + '/accept');
    }

    // ---- Advanced Reports ----

    function getPaymentTypeReport() {
        return request('GET', '/reports/payment-type');
    }

    function getSurchargeReport() {
        return request('GET', '/reports/surcharge');
    }

    function getServerPerformanceReport() {
        return request('GET', '/reports/server-performance');
    }

    function getLaborCostReport() {
        return request('GET', '/reports/labor-cost');
    }

    // ---- Audit / Fraud ----

    function getAuditLog() {
        return request('GET', '/audit-log');
    }

    function getFraudAlerts() {
        return request('GET', '/fraud-alerts');
    }

    // ---- Partial / Advanced Payments ----

    function partialPay(ticketId, amount, method) {
        return request('POST', '/tickets/' + ticketId + '/partial-pay', { amount, method });
    }

    function getTicketReceipt(ticketId) {
        return request('GET', '/tickets/' + ticketId + '/receipt');
    }

    // ---- Backups ----

    function getBackups() {
        return request('GET', '/backups');
    }

    function createBackup() {
        return request('POST', '/backups');
    }

    // ---- Offline Queue ----

    /**
     * Flush queued offline operations.
     * Call this when the connection is restored.
     */
    async function flushOfflineQueue() {
        const queue = [...offlineQueue];
        offlineQueue.length = 0;
        const results = [];

        for (const op of queue) {
            try {
                const result = await request(op.method, op.path, op.body);
                results.push({ success: true, op, result });
            } catch (err) {
                results.push({ success: false, op, error: err.message });
                // Re-queue failed ops
                offlineQueue.push(op);
            }
        }

        return results;
    }

    function getQueueLength() {
        return offlineQueue.length;
    }

    return {
        setToken,
        APIError,

        // Tickets
        getTickets,
        getTicket,
        createTicket,
        updateTicket,
        payTicket,
        voidTicket,

        // Refunds
        getRefunds,
        createRefund,

        // Kitchen
        getKitchenOrders,
        sendToKitchen,
        bumpKitchenOrder,
        fireCourse,
        pickupKitchenOrder,

        // Held Orders
        getHeldOrders,
        holdOrder,
        recallHeldOrder,

        // Time Clock
        getTimeClock,
        clockIn,
        clockOut,

        // Config
        getConfig,
        updateConfig,

        // Reports
        getReportSummary,
        getReportHourly,
        getReportItemMix,
        getReportLabor,

        // Health
        healthCheck,

        // Auth
        login,

        // Customers
        getCustomers,
        getCustomer,
        createCustomer,
        updateCustomer,
        getLoyalty,
        earnLoyalty,
        redeemLoyalty,

        // Gift Cards
        getGiftCards,
        getGiftCard,
        createGiftCard,
        chargeGiftCard,
        reloadGiftCard,

        // Promo Codes
        validatePromoCode,
        redeemPromoCode,

        // Inventory
        getIngredients,
        adjustIngredient,
        getLowStockAlerts,

        // Waitlist
        getWaitlist,
        addToWaitlist,
        updateWaitlistEntry,

        // Reservations
        getReservations,
        createReservation,
        deleteReservation,

        // Online / QR Orders
        getOnlineOrders,
        acceptOnlineOrder,
        getQROrders,
        acceptQROrder,

        // Advanced Reports
        getPaymentTypeReport,
        getSurchargeReport,
        getServerPerformanceReport,
        getLaborCostReport,

        // Audit / Fraud
        getAuditLog,
        getFraudAlerts,

        // Advanced Payments
        partialPay,
        getTicketReceipt,

        // Backups
        getBackups,
        createBackup,

        // Offline
        flushOfflineQueue,
        getQueueLength
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}
