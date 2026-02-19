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

        // Offline
        flushOfflineQueue,
        getQueueLength
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}
