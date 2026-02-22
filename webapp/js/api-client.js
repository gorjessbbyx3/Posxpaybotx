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

    function restoreBackup(id) {
        return request('POST', '/backups/' + id + '/restore');
    }

    function getBackupSchedule() {
        return request('GET', '/backups/schedule');
    }

    function updateBackupSchedule(schedule) {
        return request('PUT', '/backups/schedule', schedule);
    }

    // ---- Employees ----
    function getRoles() { return request('GET', '/roles'); }
    function getEmployees() { return request('GET', '/employees'); }
    function createEmployee(emp) { return request('POST', '/employees', emp); }
    function updateEmployee(id, u) { return request('PUT', '/employees/' + id, u); }
    function deleteEmployee(id) { return request('DELETE', '/employees/' + id); }

    // ---- Recipes ----
    function getRecipes() { return request('GET', '/recipes'); }
    function createRecipe(r) { return request('POST', '/recipes', r); }
    function updateRecipe(id, r) { return request('PUT', '/recipes/' + id, r); }
    function deleteRecipe(id) { return request('DELETE', '/recipes/' + id); }

    // ---- Vendors ----
    function getVendors() { return request('GET', '/vendors'); }
    function createVendor(v) { return request('POST', '/vendors', v); }
    function updateVendor(id, v) { return request('PUT', '/vendors/' + id, v); }
    function deleteVendor(id) { return request('DELETE', '/vendors/' + id); }

    // ---- Purchase Orders ----
    function getPurchaseOrders() { return request('GET', '/purchase-orders'); }
    function createPurchaseOrder(po) { return request('POST', '/purchase-orders', po); }
    function approvePurchaseOrder(id) { return request('POST', '/purchase-orders/' + id + '/approve'); }
    function orderPurchaseOrder(id) { return request('POST', '/purchase-orders/' + id + '/order'); }
    function receivePurchaseOrder(id) { return request('POST', '/purchase-orders/' + id + '/receive'); }
    function cancelPurchaseOrder(id) { return request('POST', '/purchase-orders/' + id + '/cancel'); }

    // ---- Ingredients (additional) ----
    function createIngredient(ing) { return request('POST', '/ingredients', ing); }
    function updateIngredient(id, u) { return request('PATCH', '/ingredients/' + id, u); }
    function deleteIngredient(id) { return request('DELETE', '/ingredients/' + id); }
    function getInventoryMovements() { return request('GET', '/inventory-movements'); }
    function getInventoryDepletionReport() { return request('GET', '/reports/inventory-depletion'); }

    // ---- Scheduled Orders ----
    function getScheduledOrders() { return request('GET', '/scheduled-orders'); }
    function confirmScheduledOrder(id) { return request('POST', '/scheduled-orders/' + id + '/confirm'); }
    function cancelScheduledOrder(id) { return request('POST', '/scheduled-orders/' + id + '/cancel'); }
    function fulfillScheduledOrder(id) { return request('POST', '/scheduled-orders/' + id + '/fulfill'); }

    // ---- Curbside ----
    function getCurbsideOrders() { return request('GET', '/curbside'); }
    function curbsideArrival(ticketId) { return request('POST', '/tickets/' + ticketId + '/curbside-arrival'); }

    // ---- Webhooks ----
    function getWebhooks() { return request('GET', '/webhooks'); }
    function createWebhook(w) { return request('POST', '/webhooks', w); }
    function deleteWebhook(id) { return request('DELETE', '/webhooks/' + id); }

    // ---- Delivery Integrations ----
    function getDeliveryIntegrations() { return request('GET', '/delivery-integrations'); }
    function createDeliveryIntegration(i) { return request('POST', '/delivery-integrations', i); }
    function updateDeliveryIntegration(id, u) { return request('PUT', '/delivery-integrations/' + id, u); }
    function testDeliveryIntegration(id) { return request('POST', '/delivery-integrations/' + id + '/test'); }

    // ---- Waste Log ----
    function getWasteLog() { return request('GET', '/waste-log'); }
    function createWasteEntry(e) { return request('POST', '/waste-log', e); }

    // ---- Email Campaigns ----
    function getEmailCampaigns() { return request('GET', '/email-campaigns'); }
    function createEmailCampaign(c) { return request('POST', '/email-campaigns', c); }
    function sendEmailCampaign(id) { return request('POST', '/email-campaigns/' + id + '/send'); }

    // ---- Email Reports ----
    function getEmailReports() { return request('GET', '/email-reports'); }
    function createEmailReport(r) { return request('POST', '/email-reports', r); }

    // ---- Saved Payments / Token Vault ----
    function getSavedPaymentMethods() { return request('GET', '/saved-payment-methods'); }
    function createSavedPaymentMethod(m) { return request('POST', '/saved-payment-methods', m); }
    function getTokenVault() { return request('GET', '/token-vault'); }
    function createToken(t) { return request('POST', '/token-vault', t); }

    // ---- Void Requests ----
    function getVoidRequests() { return request('GET', '/void-requests'); }
    function approveVoidRequest(id, pin) { return request('POST', '/void-requests/' + id + '/approve', { managerPin: pin }); }
    function rejectVoidRequest(id, reason) { return request('POST', '/void-requests/' + id + '/reject', { reason }); }
    function remoteVoid(ticketId, reason) { return request('POST', '/tickets/' + ticketId + '/remote-void', { reason }); }

    // ---- Security ----
    function setup2FA() { return request('POST', '/auth/2fa/setup'); }
    function verify2FA(token) { return request('POST', '/auth/2fa/verify', { token }); }
    function getEncryptionStatus() { return request('GET', '/security/encryption-status'); }
    function updateEncryption(s) { return request('PUT', '/security/encryption', s); }
    function rotateKey() { return request('POST', '/security/rotate-key'); }
    function getPCISaq() { return request('GET', '/compliance/pci-saq'); }

    // ---- Locations ----
    function getLocations() { return request('GET', '/locations'); }
    function createLocation(l) { return request('POST', '/locations', l); }
    function updateLocation(id, u) { return request('PUT', '/locations/' + id, u); }
    function deleteLocation(id) { return request('DELETE', '/locations/' + id); }

    // ---- Merchants ----
    function getMerchants() { return request('GET', '/merchants'); }
    function createMerchant(m) { return request('POST', '/merchants', m); }
    function updateMerchant(id, u) { return request('PUT', '/merchants/' + id, u); }
    function deleteMerchant(id) { return request('DELETE', '/merchants/' + id); }

    // ---- Feature Toggles ----
    function getFeatureToggles() { return request('GET', '/feature-toggles'); }
    function updateFeatureToggles(t) { return request('PUT', '/feature-toggles', t); }

    // ---- Branding ----
    function getBranding() { return request('GET', '/branding'); }
    function updateBranding(b) { return request('PUT', '/branding', b); }

    // ---- Plugins ----
    function getPlugins() { return request('GET', '/plugins'); }
    function installPlugin(p) { return request('POST', '/plugins', p); }
    function updatePlugin(id, u) { return request('PUT', '/plugins/' + id, u); }
    function deletePlugin(id) { return request('DELETE', '/plugins/' + id); }

    // ---- Hardware ----
    function getPrinters() { return request('GET', '/hardware/printers'); }
    function addPrinter(p) { return request('POST', '/hardware/printers', p); }
    function openCashDrawer() { return request('POST', '/hardware/cash-drawer/open'); }
    function barcodeScan(code) { return request('POST', '/hardware/barcode-scan', { barcode: code }); }
    function getKDSDisplays() { return request('GET', '/hardware/kds-displays'); }
    function addKDSDisplay(d) { return request('POST', '/hardware/kds-displays', d); }

    // ---- Sync ----
    function getSyncSnapshot() { return request('GET', '/sync/snapshot'); }
    function syncPush(data) { return request('POST', '/sync/push', data); }
    function syncResync() { return request('POST', '/sync/resync'); }
    function syncReconcile() { return request('POST', '/sync/reconcile'); }

    // ---- Menu ----
    function getMenu() { return request('GET', '/menu'); }
    function updateMenu(menu) { return request('PUT', '/menu', menu); }

    // ---- Tables ----
    function getTables() { return request('GET', '/tables'); }
    function updateTables(tables) { return request('PUT', '/tables', tables); }

    // ---- Payment Details ----
    function getPaymentTransaction(id) { return request('GET', '/payments/transactions/' + id); }
    function getPaymentsByTicket(tid) { return request('GET', '/payments/ticket/' + tid); }
    function adjustTip(tid, tip) { return request('POST', '/payments/transactions/' + tid + '/adjust-tip', { tipAmount: tip }); }
    function batchSettle() { return request('POST', '/payments/batch/settle'); }
    function getPaymentLog() { return request('GET', '/payments/log'); }
    function getPaymentHealth() { return request('GET', '/payments/health'); }

    // ---- Advanced Reports ----
    function getHourlyHeatmap() { return request('GET', '/reports/hourly-heatmap'); }
    function getCategoryMarginReport() { return request('GET', '/reports/category-margin'); }
    function getModifierProfitabilityReport() { return request('GET', '/reports/modifier-profitability'); }
    function getFoodCostReport() { return request('GET', '/reports/food-cost'); }
    function getPaymentBreakdownReport() { return request('GET', '/reports/payment-breakdown'); }
    function getAdminSummary() { return request('GET', '/admin/summary'); }
    function getMobileDashboard() { return request('GET', '/mobile/dashboard'); }
    function getOwnerAnalytics() { return request('GET', '/analytics/owner'); }
    function getCloudReports() { return request('GET', '/cloud-reports'); }
    function getExportQuickbooks() { return request('GET', '/export/quickbooks'); }
    function getLiveFeed() { return request('GET', '/live-feed'); }
    function getSurchargeCapConfig() { return request('GET', '/surcharge-cap'); }
    function updateSurchargeCapConfig(c) { return request('PUT', '/surcharge-cap', c); }

    // ---- System ----
    function getSystemDiagnostics() { return request('GET', '/system/diagnostics'); }
    function systemUpdate(v) { return request('POST', '/system/update', { version: v }); }
    function getDeployStatus() { return request('GET', '/deploy/status'); }
    function deploy(c) { return request('POST', '/deploy', c); }
    function getDeveloperDocs() { return request('GET', '/developer/docs'); }

    // ---- Happy Hour ----
    function getHappyHour() { return request('GET', '/happy-hour'); }
    function createHappyHourRule(r) { return request('POST', '/happy-hour/rules', r); }
    function updateHappyHourRule(id, r) { return request('PUT', '/happy-hour/rules/' + id, r); }
    function deleteHappyHourRule(id) { return request('DELETE', '/happy-hour/rules/' + id); }
    function toggleHappyHour(en) { return request('PUT', '/happy-hour/toggle', { enabled: en }); }

    // ---- State Rules ----
    function getStateRules() { return request('GET', '/config/cashDiscount/state-rules'); }
    function updateStateRule(st, rule) { return request('PUT', '/config/cashDiscount/state-rules/' + st, rule); }
    function deleteStateRule(st) { return request('DELETE', '/config/cashDiscount/state-rules/' + st); }

    // ---- Kitchen Extras ----
    function kitchenAlert(id, alert) { return request('POST', '/kitchen/' + id + '/alert', alert); }
    function getKitchenExpo() { return request('GET', '/kitchen/expo'); }

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
        restoreBackup,
        getBackupSchedule,
        updateBackupSchedule,

        // Employees
        getRoles,
        getEmployees,
        createEmployee,
        updateEmployee,
        deleteEmployee,

        // Recipes
        getRecipes,
        createRecipe,
        updateRecipe,
        deleteRecipe,

        // Vendors
        getVendors,
        createVendor,
        updateVendor,
        deleteVendor,

        // Purchase Orders
        getPurchaseOrders,
        createPurchaseOrder,
        approvePurchaseOrder,
        orderPurchaseOrder,
        receivePurchaseOrder,
        cancelPurchaseOrder,

        // Ingredients (additional)
        createIngredient,
        updateIngredient,
        deleteIngredient,
        getInventoryMovements,
        getInventoryDepletionReport,

        // Scheduled Orders
        getScheduledOrders,
        confirmScheduledOrder,
        cancelScheduledOrder,
        fulfillScheduledOrder,

        // Curbside
        getCurbsideOrders,
        curbsideArrival,

        // Webhooks
        getWebhooks,
        createWebhook,
        deleteWebhook,

        // Delivery Integrations
        getDeliveryIntegrations,
        createDeliveryIntegration,
        updateDeliveryIntegration,
        testDeliveryIntegration,

        // Waste Log
        getWasteLog,
        createWasteEntry,

        // Email Campaigns
        getEmailCampaigns,
        createEmailCampaign,
        sendEmailCampaign,

        // Email Reports
        getEmailReports,
        createEmailReport,

        // Saved Payments / Token Vault
        getSavedPaymentMethods,
        createSavedPaymentMethod,
        getTokenVault,
        createToken,

        // Void Requests
        getVoidRequests,
        approveVoidRequest,
        rejectVoidRequest,
        remoteVoid,

        // Security
        setup2FA,
        verify2FA,
        getEncryptionStatus,
        updateEncryption,
        rotateKey,
        getPCISaq,

        // Locations
        getLocations,
        createLocation,
        updateLocation,
        deleteLocation,

        // Merchants
        getMerchants,
        createMerchant,
        updateMerchant,
        deleteMerchant,

        // Feature Toggles
        getFeatureToggles,
        updateFeatureToggles,

        // Branding
        getBranding,
        updateBranding,

        // Plugins
        getPlugins,
        installPlugin,
        updatePlugin,
        deletePlugin,

        // Hardware
        getPrinters,
        addPrinter,
        openCashDrawer,
        barcodeScan,
        getKDSDisplays,
        addKDSDisplay,

        // Sync
        getSyncSnapshot,
        syncPush,
        syncResync,
        syncReconcile,

        // Menu
        getMenu,
        updateMenu,

        // Tables
        getTables,
        updateTables,

        // Payment Details
        getPaymentTransaction,
        getPaymentsByTicket,
        adjustTip,
        batchSettle,
        getPaymentLog,
        getPaymentHealth,

        // Advanced Reports
        getHourlyHeatmap,
        getCategoryMarginReport,
        getModifierProfitabilityReport,
        getFoodCostReport,
        getPaymentBreakdownReport,
        getAdminSummary,
        getMobileDashboard,
        getOwnerAnalytics,
        getCloudReports,
        getExportQuickbooks,
        getLiveFeed,
        getSurchargeCapConfig,
        updateSurchargeCapConfig,

        // System
        getSystemDiagnostics,
        systemUpdate,
        getDeployStatus,
        deploy,
        getDeveloperDocs,

        // Happy Hour
        getHappyHour,
        createHappyHourRule,
        updateHappyHourRule,
        deleteHappyHourRule,
        toggleHappyHour,

        // State Rules
        getStateRules,
        updateStateRule,
        deleteStateRule,

        // Kitchen Extras
        kitchenAlert,
        getKitchenExpo,

        // Offline
        flushOfflineQueue,
        getQueueLength
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}
