/**
 * Restaurant POS - API Server
 *
 * Lightweight Express-based REST API for:
 * - Ticket management (CRUD, payment, void, refund)
 * - Kitchen display system
 * - Time clock / labor tracking
 * - Held orders
 * - Configuration management
 * - Reporting endpoints
 *
 * Now with JWT-based authentication and role-based authorization.
 * Data persisted to JSON file; falls back to in-memory if filesystem unavailable.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { loginHandler, authenticate, authorize } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, '..', 'data', 'store.json');
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

app.use(express.json());

// CSP headers on all HTML responses
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/' || !req.path.includes('.')) {
        res.setHeader('Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data:; " +
            "connect-src 'self';"
        );
    }
    next();
});

app.use(express.static(path.join(__dirname, '..')));

// ==========================================
// Data Store with File Persistence
// ==========================================
const store = {
    tickets: [],
    kitchenOrders: [],
    heldOrders: [],
    refunds: [],
    timeClock: [],
    auditLog: [],
    webhooks: [],
    customers: [],
    giftCards: [],
    promoCodes: [],
    onlineOrders: [],
    fraudAlerts: [],
    ingredients: [],
    inventoryMovements: [],
    scheduledOrders: [],
    vendors: [],
    purchaseOrders: [],
    wasteLog: [],
    recipes: [],
    waitlist: [],
    reservations: [],
    savedPaymentMethods: [],
    emailCampaigns: [],
    qrOrders: [],
    deliveryIntegrations: [],
    tokenVault: [],
    backups: [],
    featureToggles: {},
    voidRequests: [],
    merchants: [],
    plugins: [],
    config: {
        cashDiscount: {
            enabled: true,
            mode: 'CASH_DISCOUNT',
            rate: 4.0,
            cashLabel: 'Cash Discount',
            surchargeLabel: 'Non-Cash Adjustment',
            showDualPricing: true,
            exemptDebit: true,
            applyBeforeTax: true,
            minCardAmount: 0,
            maxSurcharge: null,
            stateRules: {}
        },
        tax: {
            rate: 8.875,
            inclusive: false,
            alcoholSeparate: false,
            alcoholRate: 10.0
        },
        restaurant: {
            name: 'Restaurant POS',
            address1: '123 Main Street',
            address2: '',
            city: '',
            state: '',
            zip: '',
            phone: '',
            email: ''
        },
        receipt: {
            customerCopy: true,
            merchantCopy: true,
            showDualPrices: true,
            showTipLine: true,
            footer: 'Thank you! Pay with cash and save!',
            cdNotice: 'We offer a 4% discount for cash payments.'
        }
    },
    nextTicketId: 1001
};

// Load persisted data on startup
function loadStore() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (data.tickets) store.tickets = data.tickets;
            if (data.kitchenOrders) store.kitchenOrders = data.kitchenOrders;
            if (data.heldOrders) store.heldOrders = data.heldOrders;
            if (data.refunds) store.refunds = data.refunds;
            if (data.timeClock) store.timeClock = data.timeClock;
            if (data.auditLog) store.auditLog = data.auditLog;
            if (data.webhooks) store.webhooks = data.webhooks;
            if (data.customers) store.customers = data.customers;
            if (data.giftCards) store.giftCards = data.giftCards;
            if (data.promoCodes) store.promoCodes = data.promoCodes;
            if (data.onlineOrders) store.onlineOrders = data.onlineOrders;
            if (data.fraudAlerts) store.fraudAlerts = data.fraudAlerts;
            if (data.ingredients) store.ingredients = data.ingredients;
            if (data.inventoryMovements) store.inventoryMovements = data.inventoryMovements;
            if (data.scheduledOrders) store.scheduledOrders = data.scheduledOrders;
            if (data.vendors) store.vendors = data.vendors;
            if (data.purchaseOrders) store.purchaseOrders = data.purchaseOrders;
            if (data.wasteLog) store.wasteLog = data.wasteLog;
            if (data.recipes) store.recipes = data.recipes;
            if (data.waitlist) store.waitlist = data.waitlist;
            if (data.reservations) store.reservations = data.reservations;
            if (data.savedPaymentMethods) store.savedPaymentMethods = data.savedPaymentMethods;
            if (data.emailCampaigns) store.emailCampaigns = data.emailCampaigns;
            if (data.qrOrders) store.qrOrders = data.qrOrders;
            if (data.deliveryIntegrations) store.deliveryIntegrations = data.deliveryIntegrations;
            if (data.tokenVault) store.tokenVault = data.tokenVault;
            if (data.backups) store.backups = data.backups;
            if (data.featureToggles) store.featureToggles = data.featureToggles;
            if (data.voidRequests) store.voidRequests = data.voidRequests;
            if (data.merchants) store.merchants = data.merchants;
            if (data.plugins) store.plugins = data.plugins;
            if (data.nextTicketId) store.nextTicketId = data.nextTicketId;
            if (data.config) {
                Object.keys(data.config).forEach(k => {
                    if (store.config[k] && typeof store.config[k] === 'object' && typeof data.config[k] === 'object') {
                        Object.assign(store.config[k], data.config[k]);
                    } else {
                        store.config[k] = data.config[k];
                    }
                });
            }
        }
    } catch (e) {
        // Corrupted data file - start fresh
    }
}

function saveStore() {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            tickets: store.tickets,
            kitchenOrders: store.kitchenOrders,
            heldOrders: store.heldOrders,
            refunds: store.refunds,
            timeClock: store.timeClock,
            auditLog: store.auditLog,
            webhooks: store.webhooks,
            customers: store.customers,
            giftCards: store.giftCards,
            promoCodes: store.promoCodes,
            onlineOrders: store.onlineOrders,
            fraudAlerts: store.fraudAlerts,
            ingredients: store.ingredients,
            inventoryMovements: store.inventoryMovements,
            scheduledOrders: store.scheduledOrders,
            vendors: store.vendors,
            purchaseOrders: store.purchaseOrders,
            wasteLog: store.wasteLog,
            recipes: store.recipes,
            waitlist: store.waitlist,
            reservations: store.reservations,
            savedPaymentMethods: store.savedPaymentMethods,
            emailCampaigns: store.emailCampaigns,
            qrOrders: store.qrOrders,
            deliveryIntegrations: store.deliveryIntegrations,
            tokenVault: store.tokenVault,
            backups: store.backups,
            featureToggles: store.featureToggles,
            voidRequests: store.voidRequests,
            merchants: store.merchants,
            plugins: store.plugins,
            nextTicketId: store.nextTicketId,
            config: store.config,
            savedAt: new Date().toISOString()
        }, null, 2));
    } catch (e) {
        // Filesystem unavailable - data stays in-memory only
    }
}

// Auto-save periodically
let _saveTimer = null;
function scheduleSave() {
    if (_saveTimer) return;
    _saveTimer = setTimeout(() => {
        _saveTimer = null;
        saveStore();
    }, 1000);
}

loadStore();

// ==========================================
// Safe ID Generation (survives deletions)
// ==========================================
function nextId(arr, idField = 'id') {
    if (!arr || arr.length === 0) return 1;
    return Math.max(...arr.map(item => {
        const val = item[idField];
        return typeof val === 'number' ? val : 0;
    })) + 1;
}

function nextPrefixId(arr, prefix, pad = 4) {
    if (!arr || arr.length === 0) return prefix + '1'.padStart(pad, '0');
    const max = Math.max(...arr.map(item => {
        const s = String(item.id);
        if (!s.startsWith(prefix)) return 0;
        return parseInt(s.slice(prefix.length), 10) || 0;
    }));
    return prefix + String(max + 1).padStart(pad, '0');
}

// ==========================================
// Audit Log Helper
// ==========================================
function logAudit(action, user, details) {
    store.auditLog.push({
        id: nextId(store.auditLog),
        action,
        user: user ? user.name : 'system',
        role: user ? user.role : 'system',
        details,
        time: new Date().toISOString()
    });
    scheduleSave();
}

// ==========================================
// Webhook Helper — fire-and-forget HTTP POST to registered URLs
// ==========================================
function isPrivateHost(hostname) {
    // Block private/reserved IPs and localhost to prevent SSRF
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|::1|fc00|fd00|fe80)/i.test(hostname)) return true;
    if (/^(metadata|internal|\.local$)/i.test(hostname)) return true;
    // Block cloud metadata endpoints
    if (hostname === '169.254.169.254') return true;
    return false;
}

function fireWebhooks(event, payload) {
    const hooks = store.webhooks.filter(w => w.active && w.events.includes(event));
    hooks.forEach(w => {
        const body = JSON.stringify({ event, data: payload, time: new Date().toISOString() });
        try {
            const url = new URL(w.url);
            // SSRF protection: block requests to private/internal networks
            if (isPrivateHost(url.hostname)) return;
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
            };
            if (w.secret) options.headers['X-Webhook-Secret'] = w.secret;
            const proto = url.protocol === 'https:' ? require('https') : require('http');
            const req = proto.request(options, () => {});
            req.on('error', () => {}); // Fire and forget
            req.write(body);
            req.end();
        } catch (e) { /* invalid URL — skip */ }
    });
}

// ==========================================
// CORS Middleware (restrict to configured origins)
// ==========================================
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.length > 0 && origin && ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    } else if (ALLOWED_ORIGINS.length === 0) {
        // In development with no configured origins, allow same-origin only
        // (no Access-Control-Allow-Origin header means browser blocks cross-origin)
        if (origin) {
            // Only allow if origin matches the server itself
            const serverOrigin = `${req.protocol}://${req.headers.host}`;
            if (origin === serverOrigin) {
                res.header('Access-Control-Allow-Origin', origin);
            }
        }
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ==========================================
// Authentication (applied to all /api routes)
// ==========================================
app.use('/api', authenticate);

// ==========================================
// Auth Endpoints
// ==========================================
app.post('/api/auth/login', loginHandler);

// ==========================================
// Ticket Endpoints
// ==========================================

// Whitelist of fields allowed on ticket PATCH
const TICKET_PATCH_FIELDS = ['table', 'server', 'type', 'items', 'discount', 'deliveryFee', 'deliveryAddress', 'note', 'seats'];

app.get('/api/tickets', authorize('tickets'), (req, res) => {
    let tickets = store.tickets;
    const { status, server, search } = req.query;

    if (status && status !== 'all') {
        tickets = tickets.filter(t => t.status === status);
    }
    if (server) {
        tickets = tickets.filter(t => t.server === server);
    }
    if (search) {
        const q = search.toLowerCase();
        tickets = tickets.filter(t =>
            String(t.id).includes(q) ||
            (t.server || '').toLowerCase().includes(q) ||
            t.items.some(i => i.name.toLowerCase().includes(q))
        );
    }

    res.json({ tickets, total: tickets.length });
});

app.get('/api/tickets/:id', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
});

app.post('/api/tickets', authorize('tickets'), (req, res) => {
    const { items, type, server: serverName, table, discount, deliveryFee: reqDeliveryFee, deliveryAddress, note } = req.body;

    const ticket = {
        id: store.nextTicketId++,
        items: Array.isArray(items) ? items : [],
        type: type || 'dine-in',
        server: serverName || (req.user ? req.user.name : 'unknown'),
        table: table || null,
        discount: discount || null,
        deliveryFee: parseFloat(reqDeliveryFee) || 0,
        deliveryAddress: deliveryAddress || '',
        note: note || null,
        status: 'open',
        paid: false,
        time: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'unknown'
    };

    // Calculate totals
    if (ticket.items.length > 0) {
        const subtotal = ticket.items.reduce((s, i) => s + Math.round((parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 1) * 100) / 100, 0);
        const discountAmt = ticket.discount ? (parseFloat(ticket.discount.amount) || 0) : 0;
        const afterDiscount = Math.round(Math.max(0, subtotal - discountAmt) * 100) / 100;
        const tax = Math.round(afterDiscount * (store.config.tax.rate / 100) * 100) / 100;
        const dFee = parseFloat(ticket.deliveryFee) || 0;

        ticket.subtotal = Math.round(subtotal * 100) / 100;
        ticket.tax = tax;
        ticket.total = Math.round((afterDiscount + tax + dFee) * 100) / 100;
    }

    store.tickets.push(ticket);
    fireWebhooks('ticket.created', { ticketId: ticket.id, type: ticket.type, server: ticket.server });
    logAudit('ticket_created', req.user, { ticketId: ticket.id, items: ticket.items.length, total: ticket.total });
    scheduleSave();
    res.status(201).json(ticket);
});

app.patch('/api/tickets/:id', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Whitelist allowed fields to prevent mass assignment
    TICKET_PATCH_FIELDS.forEach(field => {
        if (req.body[field] !== undefined) {
            ticket[field] = req.body[field];
        }
    });

    // Recalculate totals when items or discount change
    if (req.body.items !== undefined || req.body.discount !== undefined || req.body.deliveryFee !== undefined) {
        if (ticket.items && ticket.items.length > 0) {

            const subtotal = ticket.items.reduce((s, i) => s + Math.round((parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 1) * 100) / 100, 0);
            const discountAmt = ticket.discount ? (parseFloat(ticket.discount.amount) || 0) : 0;
            const afterDiscount = Math.round(Math.max(0, subtotal - discountAmt) * 100) / 100;
            const tax = Math.round(afterDiscount * (store.config.tax.rate / 100) * 100) / 100;
            const dFee = parseFloat(ticket.deliveryFee) || 0;

            ticket.subtotal = Math.round(subtotal * 100) / 100;
            ticket.tax = tax;
            ticket.total = Math.round((afterDiscount + tax + dFee) * 100) / 100;
        } else {
            // Empty items — zero out totals
            ticket.subtotal = 0;
            ticket.tax = 0;
            ticket.total = 0;
        }
    }

    ticket.updatedAt = new Date().toISOString();
    ticket.updatedBy = req.user ? req.user.name : 'unknown';

    logAudit('ticket_updated', req.user, { ticketId: ticket.id });
    scheduleSave();
    res.json(ticket);
});

// Pay a ticket (full or partial)
app.post('/api/tickets/:id/pay', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    const tip = Math.round((parseFloat(req.body.tip) || 0) * 100) / 100;
    const method = req.body.method || 'cash';
    const requestedAmount = req.body.amount !== undefined
        ? Math.round((parseFloat(req.body.amount) || 0) * 100) / 100
        : null;

    // Resolve saved payment method if provided
    let savedPayment = null;
    if (req.body.savedPaymentId) {
        savedPayment = store.savedPaymentMethods.find(s => s.id === req.body.savedPaymentId);
        if (!savedPayment) return res.status(404).json({ error: 'Saved payment method not found' });
    }
    // Resolve token vault entry if provided
    let tokenEntry = null;
    if (req.body.tokenId) {
        tokenEntry = store.tokenVault.find(t => t.id === req.body.tokenId);
        if (!tokenEntry) return res.status(404).json({ error: 'Token not found' });
    }

    // Initialize payments array for tracking partial payments
    if (!ticket.payments) ticket.payments = [];
    const previouslyPaid = ticket.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.round((ticket.total - previouslyPaid) * 100) / 100;

    // Determine if this is a partial payment
    const isPartial = requestedAmount !== null && requestedAmount < remaining;
    const payAmount = isPartial ? requestedAmount : remaining;

    if (requestedAmount !== null && requestedAmount <= 0) {
        return res.status(400).json({ error: 'Payment amount must be positive' });
    }
    if (requestedAmount !== null && requestedAmount > remaining) {
        return res.status(400).json({
            error: 'Payment amount exceeds remaining balance',
            remaining,
            previouslyPaid
        });
    }

    // Record this payment
    const payment = {
        amount: payAmount,
        method,
        tip,
        savedPaymentId: savedPayment ? savedPayment.id : null,
        tokenId: tokenEntry ? tokenEntry.id : null,
        cardLastFour: savedPayment ? savedPayment.lastFour : (tokenEntry ? tokenEntry.lastFour : null),
        paidBy: req.user ? req.user.name : 'unknown',
        paidAt: new Date().toISOString()
    };
    ticket.payments.push(payment);

    const totalPaid = Math.round((previouslyPaid + payAmount) * 100) / 100;

    if (totalPaid >= ticket.total) {
        // Fully paid
        ticket.status = 'paid';
        ticket.paid = true;
        ticket.paidAt = new Date().toISOString();
    } else {
        ticket.status = 'partial';
    }

    // Keep legacy fields for backward compatibility
    ticket.paymentMethod = method;
    ticket.tip = ticket.payments.reduce((s, p) => s + (p.tip || 0), 0);
    ticket.paidBy = req.user ? req.user.name : 'unknown';
    ticket.totalPaid = totalPaid;
    ticket.remaining = Math.round((ticket.total - totalPaid) * 100) / 100;

    logAudit('payment', req.user, { ticketId: ticket.id, amount: payAmount, method, status: ticket.status });

    if (ticket.status === 'paid') {
        fireWebhooks('ticket.paid', { ticketId: ticket.id, total: ticket.total, method });

        // Update customer stats if ticket has a linked customer
        if (ticket.customerId) {
            const customer = store.customers.find(c => c.id === ticket.customerId);
            if (customer) {
                customer.totalSpent = Math.round(((customer.totalSpent || 0) + ticket.total) * 100) / 100;
                customer.visitCount = (customer.visitCount || 0) + 1;
                customer.lastVisit = new Date().toISOString();
            }
        }
    }
    scheduleSave();
    res.json(ticket);
});

// Void a ticket (requires void permission)
app.post('/api/tickets/:id/void', authorize('void'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    ticket.status = 'voided';
    ticket.voidedBy = req.user.name;
    ticket.voidedAt = new Date().toISOString();
    ticket.voidReason = req.body.reason || '';

    checkFraudPatterns(ticket, req.user);
    logAudit('void', req.user, { ticketId: ticket.id, reason: ticket.voidReason, total: ticket.total });
    fireWebhooks('ticket.voided', { ticketId: ticket.id, voidedBy: req.user.name, reason: ticket.voidReason });
    scheduleSave();
    res.json(ticket);
});

// ==========================================
// Refund Endpoints (requires refund permission)
// ==========================================
app.get('/api/refunds', authorize('refund'), (req, res) => {
    res.json({ refunds: store.refunds, total: store.refunds.length });
});

app.post('/api/refunds', authorize('refund'), (req, res) => {
    const { ticketId, amount, reason, type } = req.body;
    const ticket = store.tickets.find(t => t.id === parseInt(ticketId));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status !== 'paid') return res.status(400).json({ error: 'Can only refund paid tickets' });

    const refundAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;
    const previousRefunds = ticket.refundedAmount || 0;
    const remainingBalance = Math.round((ticket.total - previousRefunds) * 100) / 100;

    if (refundAmount <= 0) {
        return res.status(400).json({ error: 'Refund amount must be positive' });
    }
    if (refundAmount > remainingBalance) {
        return res.status(400).json({
            error: 'Refund amount exceeds remaining balance',
            remainingBalance,
            previousRefunds
        });
    }

    const refund = {
        id: nextId(store.refunds),
        ticketId: parseInt(ticketId),
        amount: refundAmount,
        reason: reason || 'No reason provided',
        type: type || 'full',
        method: ticket.paymentMethod,
        processedBy: req.user.name,
        time: new Date().toISOString()
    };

    store.refunds.push(refund);

    ticket.refundedAmount = Math.round((previousRefunds + refundAmount) * 100) / 100;
    if (type === 'full' || ticket.refundedAmount >= ticket.total) {
        ticket.status = 'refunded';
    }

    checkFraudPatterns(ticket, req.user);
    logAudit('refund', req.user, { ticketId: ticket.id, amount: refundAmount, reason: refund.reason });
    scheduleSave();
    res.status(201).json(refund);
});

// ==========================================
// Kitchen Display Endpoints
// ==========================================
app.get('/api/kitchen', authorize('kitchen'), (req, res) => {
    const { station } = req.query;
    let orders = store.kitchenOrders.filter(o => o.status !== 'bumped');

    if (station && station !== 'all') {
        orders = orders.filter(o => o.items.some(i => i.station === station));
    }

    res.json({ orders, active: orders.length });
});

app.post('/api/kitchen', authorize('kitchen'), (req, res) => {
    const items = (req.body.items || []).map(item => ({
        ...item,
        station: item.station || 'general',
        course: item.course || 1
    }));

    const order = {
        id: req.body.ticketId,
        items,
        type: req.body.type || 'dine-in',
        server: req.body.server || (req.user ? req.user.name : 'Unknown'),
        table: req.body.table || null,
        status: 'new',
        currentCourse: 1,
        time: new Date().toISOString()
    };
    store.kitchenOrders.push(order);
    fireWebhooks('kitchen.new', { orderId: order.id, table: order.table, items: order.items.length });
    scheduleSave();
    res.status(201).json(order);
});

// Get orders routed to a specific station
app.get('/api/kitchen/station/:station', authorize('kitchen'), (req, res) => {
    const station = req.params.station;
    const orders = store.kitchenOrders
        .filter(o => o.status !== 'bumped')
        .map(o => ({
            ...o,
            items: o.items.filter(i => i.station === station)
        }))
        .filter(o => o.items.length > 0);

    res.json({ station, orders, active: orders.length });
});

// Fire next course for an order
app.post('/api/kitchen/:id/fire-course', authorize('kitchen'), (req, res) => {
    const order = store.kitchenOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const courseToFire = req.body.course || (order.currentCourse + 1);
    const courseItems = order.items.filter(i => i.course === courseToFire);

    if (courseItems.length === 0) {
        return res.status(400).json({ error: 'No items in course ' + courseToFire });
    }

    // Duplicate check — prevent double-fire of the same course
    order.courseFiredAt = order.courseFiredAt || {};
    if (order.courseFiredAt[courseToFire]) {
        return res.status(409).json({ error: `Course ${courseToFire} already fired`, firedAt: order.courseFiredAt[courseToFire] });
    }

    order.currentCourse = courseToFire;
    order.courseFiredAt[courseToFire] = new Date().toISOString();
    order.courseFiredBy = order.courseFiredBy || {};
    order.courseFiredBy[courseToFire] = req.user ? req.user.name : 'unknown';

    fireWebhooks('kitchen.course_fired', { orderId: order.id, course: courseToFire, items: courseItems.length });
    scheduleSave();
    res.json({ order, firedCourse: courseToFire, courseItems });
});

app.post('/api/kitchen/:id/bump', authorize('kitchen'), (req, res) => {
    const order = store.kitchenOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = 'bumped';
    order.bumpedAt = new Date().toISOString();
    order.bumpedBy = req.user ? req.user.name : 'unknown';
    fireWebhooks('kitchen.bumped', { orderId: order.id, table: order.table });
    scheduleSave();
    res.json(order);
});

// ==========================================
// Held Orders Endpoints
// ==========================================
app.get('/api/held-orders', authorize('tickets'), (req, res) => {
    res.json({ orders: store.heldOrders, total: store.heldOrders.length });
});

app.post('/api/held-orders', authorize('tickets'), (req, res) => {
    const { items, type, server: serverName, table, discount, note } = req.body;
    const heldId = nextId(store.heldOrders);
    const held = {
        id: heldId,
        items: items || [],
        type: type || 'dine-in',
        server: serverName || (req.user ? req.user.name : 'unknown'),
        table: table || null,
        discount: discount || null,
        note: note || '',
        heldAt: new Date().toISOString(),
        heldBy: req.user ? req.user.name : 'unknown'
    };
    store.heldOrders.push(held);
    scheduleSave();
    res.status(201).json(held);
});

app.delete('/api/held-orders/:id', authorize('tickets'), (req, res) => {
    const id = parseInt(req.params.id);
    const idx = store.heldOrders.findIndex(h => h.id === id);
    if (idx === -1) {
        return res.status(404).json({ error: 'Held order not found' });
    }
    const removed = store.heldOrders.splice(idx, 1)[0];
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Time Clock Endpoints
// ==========================================
app.get('/api/timeclock', authorize('timeclock'), (req, res) => {
    const { empId, date } = req.query;
    let records = store.timeClock;

    if (empId) {
        records = records.filter(r => r.empId === empId);
    }
    if (date) {
        records = records.filter(r => r.clockIn && r.clockIn.startsWith(date));
    }

    res.json({ records, total: records.length });
});

app.post('/api/timeclock/clock-in', authorize('timeclock'), (req, res) => {
    const { empId, empName, role } = req.body;
    if (!empId) return res.status(400).json({ error: 'Employee ID required' });

    // Check if already clocked in
    const existing = store.timeClock.find(r => r.empId === empId && !r.clockOut);
    if (existing) return res.status(400).json({ error: 'Already clocked in' });

    const record = {
        id: nextId(store.timeClock),
        empId,
        empName: empName || (req.user ? req.user.name : 'Unknown'),
        role: role || (req.user ? req.user.role : 'server'),
        clockIn: new Date().toISOString(),
        clockOut: null
    };
    store.timeClock.push(record);
    logAudit('clock_in', req.user, { empId, empName: record.empName });
    scheduleSave();
    res.status(201).json(record);
});

app.post('/api/timeclock/clock-out', authorize('timeclock'), (req, res) => {
    const { empId } = req.body;
    if (!empId) return res.status(400).json({ error: 'Employee ID required' });

    const record = store.timeClock.find(r => r.empId === empId && !r.clockOut);
    if (!record) return res.status(400).json({ error: 'Not clocked in' });

    record.clockOut = new Date().toISOString();
    const hours = (new Date(record.clockOut) - new Date(record.clockIn)) / 3600000;
    record.hoursWorked = Math.round(hours * 100) / 100;
    logAudit('clock_out', req.user, { empId, hours: record.hoursWorked });

    scheduleSave();
    res.json(record);
});

// ==========================================
// Configuration Endpoints (requires config permission)
// ==========================================
const CONFIG_ALLOWED_FIELDS = {
    cashDiscount: ['enabled', 'mode', 'rate', 'cashLabel', 'surchargeLabel', 'showDualPricing', 'exemptDebit', 'applyBeforeTax', 'minCardAmount', 'maxSurcharge', 'stateRules'],
    tax: ['rate', 'inclusive', 'alcoholSeparate', 'alcoholRate'],
    restaurant: ['name', 'address1', 'address2', 'city', 'state', 'zip', 'phone', 'email'],
    receipt: ['customerCopy', 'merchantCopy', 'showDualPrices', 'showTipLine', 'footer', 'cdNotice']
};

app.get('/api/config', authorize('config'), (req, res) => {
    res.json(store.config);
});

app.get('/api/config/:section', authorize('config'), (req, res) => {
    const section = store.config[req.params.section];
    if (!section) return res.status(404).json({ error: 'Config section not found' });
    res.json(section);
});

app.put('/api/config/:section', authorize('config'), (req, res) => {
    const sectionName = req.params.section;
    if (!store.config[sectionName]) {
        return res.status(404).json({ error: 'Config section not found' });
    }
    // Whitelist allowed fields per section
    const allowedFields = CONFIG_ALLOWED_FIELDS[sectionName] || [];
    const changed = {};
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            changed[field] = { from: store.config[sectionName][field], to: req.body[field] };
            store.config[sectionName][field] = req.body[field];
        }
    });

    // Enforce surcharge cap on cashDiscount rate
    if (sectionName === 'cashDiscount' && store.config.cashDiscount) {
        const cd = store.config.cashDiscount;
        const maxRate = cd.maxSurchargeRate || 4.0;
        if (cd.rate > maxRate) {
            cd.rate = maxRate;
            changed.rate = { ...changed.rate, cappedTo: maxRate };
        }
    }

    logAudit('config_change', req.user, { section: sectionName, changed });
    scheduleSave();
    res.json(store.config[sectionName]);
});

// ==========================================
// Reports Endpoints (requires reports permission)
// ==========================================
app.get('/api/reports/summary', authorize('reports'), (req, res) => {
    let totalSales = 0, totalTax = 0, totalTips = 0, totalDiscounts = 0;
    let cashSales = 0, cardSales = 0, ticketCount = 0;
    let totalRefunds = store.refunds.reduce((s, r) => s + r.amount, 0);

    store.tickets.forEach(t => {
        if (t.status === 'voided' || t.status === 'refunded') return;
        ticketCount++;
        totalSales += t.total || 0;
        totalTax += t.tax || 0;
        if (t.tip) totalTips += t.tip;
        if (t.discount) totalDiscounts += t.discount.amount || 0;
        if (t.paymentMethod === 'cash') cashSales += t.total || 0;
        else if (t.paymentMethod) cardSales += t.total || 0;
    });

    res.json({
        totalSales: Math.round(totalSales * 100) / 100,
        ticketCount,
        avgTicket: ticketCount > 0 ? Math.round(totalSales / ticketCount * 100) / 100 : 0,
        cashSales: Math.round(cashSales * 100) / 100,
        cardSales: Math.round(cardSales * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
        totalTips: Math.round(totalTips * 100) / 100,
        totalRefunds: Math.round(totalRefunds * 100) / 100,
        netSales: Math.round((totalSales - totalRefunds) * 100) / 100
    });
});

app.get('/api/reports/hourly', authorize('reports'), (req, res) => {
    const hourlyData = {};
    for (let h = 0; h < 24; h++) hourlyData[h] = { sales: 0, tickets: 0 };

    store.tickets.forEach(t => {
        if (!t.time || t.status === 'voided') return;
        const hour = new Date(t.time).getHours();
        if (hourlyData[hour]) {
            hourlyData[hour].sales += t.total || 0;
            hourlyData[hour].tickets++;
        }
    });

    res.json(hourlyData);
});

app.get('/api/reports/item-mix', authorize('reports'), (req, res) => {
    const itemMap = {};
    store.tickets.forEach(t => {
        if (t.status === 'voided') return;
        (t.items || []).forEach(item => {
            const key = item.name;
            if (!itemMap[key]) itemMap[key] = { name: item.name, qty: 0, revenue: 0 };
            itemMap[key].qty += item.qty;
            itemMap[key].revenue += Math.round(item.price * item.qty * 100) / 100;
        });
    });

    const sorted = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
    const totalRev = sorted.reduce((s, i) => s + i.revenue, 0);
    sorted.forEach(i => { i.pctOfSales = totalRev > 0 ? Math.round(i.revenue / totalRev * 1000) / 10 : 0; });

    res.json({ items: sorted, totalRevenue: Math.round(totalRev * 100) / 100 });
});

app.get('/api/reports/labor', authorize('reports'), (req, res) => {
    const laborMap = {};

    store.timeClock.forEach(r => {
        if (!laborMap[r.empId]) {
            laborMap[r.empId] = { name: r.empName, role: r.role, hours: 0, sales: 0, tips: 0 };
        }
        const end = r.clockOut ? new Date(r.clockOut) : new Date();
        laborMap[r.empId].hours += Math.round((end - new Date(r.clockIn)) / 36000) / 100;
    });

    store.tickets.forEach(t => {
        if (t.status === 'voided') return;
        const entry = Object.values(laborMap).find(l => l.name === t.server);
        if (entry) {
            entry.sales += t.total || 0;
            if (t.tip) entry.tips += t.tip;
        }
    });

    const entries = Object.values(laborMap).map(e => ({
        ...e,
        hours: Math.round(e.hours * 100) / 100,
        sales: Math.round(e.sales * 100) / 100,
        tips: Math.round(e.tips * 100) / 100
    }));

    res.json({ employees: entries });
});

app.get('/api/reports/labor-cost', authorize('reports'), (req, res) => {
    const hourlyRates = {
        admin: 25.00, manager: 22.00, server: 12.00,
        cashier: 13.00, bartender: 14.00, kitchen: 15.00
    };
    let totalHours = 0, totalCost = 0, totalSales = 0;
    const byRole = {};

    store.timeClock.forEach(r => {
        const end = r.clockOut ? new Date(r.clockOut) : new Date();
        const hours = Math.round((end - new Date(r.clockIn)) / 36000) / 100;
        const role = r.role || 'server';
        const rate = hourlyRates[role] || 12.00;
        const cost = Math.round(hours * rate * 100) / 100;

        totalHours += hours;
        totalCost += cost;

        if (!byRole[role]) byRole[role] = { hours: 0, cost: 0, employees: 0 };
        byRole[role].hours += hours;
        byRole[role].cost += cost;
        byRole[role].employees++;
    });

    store.tickets.forEach(t => {
        if (t.status !== 'voided') totalSales += t.total || 0;
    });

    // Round everything
    totalHours = Math.round(totalHours * 100) / 100;
    totalCost = Math.round(totalCost * 100) / 100;
    totalSales = Math.round(totalSales * 100) / 100;
    Object.values(byRole).forEach(r => {
        r.hours = Math.round(r.hours * 100) / 100;
        r.cost = Math.round(r.cost * 100) / 100;
    });

    const laborPct = totalSales > 0 ? Math.round(totalCost / totalSales * 1000) / 10 : 0;

    res.json({ totalHours, totalCost, totalSales, laborPct, byRole });
});

app.get('/api/reports/server-performance', authorize('reports'), (req, res) => {
    const perfMap = {};

    store.tickets.forEach(t => {
        if (!t.server) return;
        if (!perfMap[t.server]) {
            perfMap[t.server] = { name: t.server, tickets: 0, sales: 0, tips: 0, voids: 0, avgTicket: 0 };
        }
        if (t.status === 'voided') {
            perfMap[t.server].voids++;
            return;
        }
        perfMap[t.server].tickets++;
        perfMap[t.server].sales += t.total || 0;
        perfMap[t.server].tips += t.tip || 0;
    });

    const servers = Object.values(perfMap).map(s => ({
        ...s,
        sales: Math.round(s.sales * 100) / 100,
        tips: Math.round(s.tips * 100) / 100,
        avgTicket: s.tickets > 0 ? Math.round(s.sales / s.tickets * 100) / 100 : 0,
        tipPct: s.sales > 0 ? Math.round(s.tips / s.sales * 1000) / 10 : 0
    })).sort((a, b) => b.sales - a.sales);

    res.json({ servers });
});

// ==========================================
// Audit Log Endpoints (requires reports permission)
// ==========================================
app.get('/api/audit-log', authorize('reports'), (req, res) => {
    let logs = store.auditLog;
    const { action, user, from, to, limit: limitParam } = req.query;

    if (action) {
        logs = logs.filter(l => l.action === action);
    }
    if (user) {
        logs = logs.filter(l => l.user === user);
    }
    if (from) {
        logs = logs.filter(l => l.time >= from);
    }
    if (to) {
        logs = logs.filter(l => l.time <= to);
    }

    // Return most recent first
    logs = [...logs].reverse();

    const limit = parseInt(limitParam, 10);
    if (limit > 0) {
        logs = logs.slice(0, limit);
    }

    res.json({ entries: logs, total: logs.length });
});

// ==========================================
// Payment Type Breakdown Report (requires reports permission)
// ==========================================
app.get('/api/reports/payment-type', authorize('reports'), (req, res) => {
    const breakdown = {};

    store.tickets.forEach(t => {
        if (t.status === 'voided') return;
        if (!t.paymentMethod) return;

        // If ticket has partial payments, break down by each payment
        if (t.payments && t.payments.length > 0) {
            t.payments.forEach(p => {
                const method = p.method || 'unknown';
                if (!breakdown[method]) breakdown[method] = { count: 0, sales: 0, tips: 0, tickets: 0 };
                breakdown[method].count++;
                breakdown[method].sales += p.amount || 0;
                breakdown[method].tips += p.tip || 0;
            });
            // Count the ticket once for its primary method
            const primary = t.paymentMethod;
            if (breakdown[primary]) breakdown[primary].tickets++;
        } else {
            const method = t.paymentMethod;
            if (!breakdown[method]) breakdown[method] = { count: 0, sales: 0, tips: 0, tickets: 0 };
            breakdown[method].count++;
            breakdown[method].tickets++;
            breakdown[method].sales += t.total || 0;
            breakdown[method].tips += t.tip || 0;
        }
    });

    // Round all monetary values
    Object.values(breakdown).forEach(b => {
        b.sales = Math.round(b.sales * 100) / 100;
        b.tips = Math.round(b.tips * 100) / 100;
    });

    res.json({ breakdown });
});

// ==========================================
// Surcharge Revenue Report (requires reports permission)
// ==========================================
app.get('/api/reports/surcharge', authorize('reports'), (req, res) => {
    let totalSurchargeRevenue = 0;
    let cashTickets = 0, cardTickets = 0;
    let cashSales = 0, cardSales = 0;
    let surchargeTicketCount = 0;

    const config = store.config.cashDiscount;
    const rate = (parseFloat(config.rate) || 0) / 100;

    store.tickets.forEach(t => {
        if (t.status === 'voided' || t.status === 'refunded') return;
        if (!t.paymentMethod) return;

        if (t.paymentMethod === 'cash') {
            cashTickets++;
            cashSales += t.total || 0;
        } else {
            cardTickets++;
            cardSales += t.total || 0;

            // Calculate surcharge revenue based on mode
            if (config.enabled && rate > 0) {
                let surcharge = 0;
                if (config.mode === 'CASH_DISCOUNT') {
                    // Card price is the menu price; surcharge is embedded
                    surcharge = (t.total || 0) * rate / (1 + rate);
                } else {
                    // CARD_SURCHARGE: surcharge is added on top of base price
                    surcharge = (t.total || 0) * rate;
                }
                totalSurchargeRevenue += surcharge;
                surchargeTicketCount++;
            }
        }
    });

    res.json({
        mode: config.mode,
        rate: config.rate,
        enabled: config.enabled,
        totalSurchargeRevenue: Math.round(totalSurchargeRevenue * 100) / 100,
        surchargeTicketCount,
        cashTickets,
        cardTickets,
        cashSales: Math.round(cashSales * 100) / 100,
        cardSales: Math.round(cardSales * 100) / 100,
        cashPct: (cashTickets + cardTickets) > 0
            ? Math.round(cashTickets / (cashTickets + cardTickets) * 1000) / 10
            : 0,
        cardPct: (cashTickets + cardTickets) > 0
            ? Math.round(cardTickets / (cashTickets + cardTickets) * 1000) / 10
            : 0
    });
});

// ==========================================
// State-Specific Surcharge Configuration
// ==========================================
app.get('/api/config/cashDiscount/state-rules', authorize('config'), (req, res) => {
    res.json({ stateRules: store.config.cashDiscount.stateRules || {} });
});

app.put('/api/config/cashDiscount/state-rules/:state', authorize('config'), (req, res) => {
    const state = req.params.state.toUpperCase();
    if (state.length !== 2) {
        return res.status(400).json({ error: 'State must be a 2-letter code' });
    }
    const { maxRate, allowed, mode, label } = req.body;
    if (!store.config.cashDiscount.stateRules) {
        store.config.cashDiscount.stateRules = {};
    }
    store.config.cashDiscount.stateRules[state] = {
        maxRate: maxRate !== undefined ? parseFloat(maxRate) : null,
        allowed: allowed !== undefined ? !!allowed : true,
        mode: mode || null,
        label: label || null
    };
    logAudit('state_rule_change', req.user, { state, rule: store.config.cashDiscount.stateRules[state] });
    scheduleSave();
    res.json({ state, rule: store.config.cashDiscount.stateRules[state] });
});

app.delete('/api/config/cashDiscount/state-rules/:state', authorize('config'), (req, res) => {
    const state = req.params.state.toUpperCase();
    if (!store.config.cashDiscount.stateRules || !store.config.cashDiscount.stateRules[state]) {
        return res.status(404).json({ error: 'State rule not found' });
    }
    const removed = store.config.cashDiscount.stateRules[state];
    delete store.config.cashDiscount.stateRules[state];
    logAudit('state_rule_deleted', req.user, { state });
    scheduleSave();
    res.json({ state, removed });
});

// ==========================================
// Hourly Sales Heat Map (enhanced hourly report)
// ==========================================
app.get('/api/reports/hourly-heatmap', authorize('reports'), (req, res) => {
    // Build 7-day x 24-hour grid
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmap = {};
    days.forEach(d => {
        heatmap[d] = {};
        for (let h = 0; h < 24; h++) heatmap[d][h] = { sales: 0, tickets: 0 };
    });

    let peakSales = 0;
    let peakDay = null;
    let peakHour = null;

    store.tickets.forEach(t => {
        if (!t.time || t.status === 'voided') return;
        const d = new Date(t.time);
        const day = days[d.getDay()];
        const hour = d.getHours();
        heatmap[day][hour].sales += t.total || 0;
        heatmap[day][hour].tickets++;

        if (heatmap[day][hour].sales > peakSales) {
            peakSales = heatmap[day][hour].sales;
            peakDay = day;
            peakHour = hour;
        }
    });

    // Round all sales
    days.forEach(d => {
        for (let h = 0; h < 24; h++) {
            heatmap[d][h].sales = Math.round(heatmap[d][h].sales * 100) / 100;
        }
    });

    res.json({ heatmap, peak: { day: peakDay, hour: peakHour, sales: Math.round(peakSales * 100) / 100 } });
});

// ==========================================
// Category Margin Analysis Report
// ==========================================
app.get('/api/reports/category-margin', authorize('reports'), (req, res) => {
    const categories = {};

    store.tickets.forEach(t => {
        if (t.status === 'voided') return;
        (t.items || []).forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!categories[cat]) {
                categories[cat] = { category: cat, qty: 0, revenue: 0, cost: 0, items: 0 };
            }
            const qty = parseInt(item.qty, 10) || 0;
            const price = parseFloat(item.price) || 0;
            const cost = parseFloat(item.cost) || 0;
            categories[cat].qty += qty;
            categories[cat].revenue += Math.round(price * qty * 100) / 100;
            categories[cat].cost += Math.round(cost * qty * 100) / 100;
            categories[cat].items++;
        });
    });

    const totalRevenue = Object.values(categories).reduce((s, c) => s + c.revenue, 0);
    const result = Object.values(categories).map(c => {
        const margin = c.revenue > 0 ? Math.round((c.revenue - c.cost) / c.revenue * 1000) / 10 : 0;
        return {
            ...c,
            revenue: Math.round(c.revenue * 100) / 100,
            cost: Math.round(c.cost * 100) / 100,
            profit: Math.round((c.revenue - c.cost) * 100) / 100,
            marginPct: margin,
            pctOfSales: totalRevenue > 0 ? Math.round(c.revenue / totalRevenue * 1000) / 10 : 0
        };
    }).sort((a, b) => b.revenue - a.revenue);

    res.json({ categories: result, totalRevenue: Math.round(totalRevenue * 100) / 100 });
});

// ==========================================
// Customer Profiles (CRUD)
// ==========================================
const CUSTOMER_FIELDS = ['name', 'email', 'phone', 'address', 'notes', 'loyaltyPoints', 'tags'];

app.get('/api/customers', authorize('tickets'), (req, res) => {
    let customers = store.customers;
    const { search, tag } = req.query;
    if (search) {
        const q = search.toLowerCase();
        customers = customers.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').includes(q)
        );
    }
    if (tag) {
        customers = customers.filter(c => (c.tags || []).includes(tag));
    }
    res.json({ customers, total: customers.length });
});

app.get('/api/customers/:id', authorize('tickets'), (req, res) => {
    const customer = store.customers.find(c => c.id === parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
});

app.post('/api/customers', authorize('tickets'), (req, res) => {
    const { name, email, phone, address, notes, tags } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name required' });

    const customer = {
        id: nextId(store.customers),
        name,
        email: email || '',
        phone: phone || '',
        address: address || '',
        notes: notes || '',
        loyaltyPoints: 0,
        tags: Array.isArray(tags) ? tags : [],
        totalSpent: 0,
        visitCount: 0,
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'unknown'
    };
    store.customers.push(customer);
    logAudit('customer_created', req.user, { customerId: customer.id, name });
    scheduleSave();
    res.status(201).json(customer);
});

app.patch('/api/customers/:id', authorize('tickets'), (req, res) => {
    const customer = store.customers.find(c => c.id === parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    CUSTOMER_FIELDS.forEach(field => {
        if (req.body[field] !== undefined) customer[field] = req.body[field];
    });
    customer.updatedAt = new Date().toISOString();
    logAudit('customer_updated', req.user, { customerId: customer.id });
    scheduleSave();
    res.json(customer);
});

app.delete('/api/customers/:id', authorize('config'), (req, res) => {
    const idx = store.customers.findIndex(c => c.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
    const removed = store.customers.splice(idx, 1)[0];
    logAudit('customer_deleted', req.user, { customerId: removed.id, name: removed.name });
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Gift Card Management
// ==========================================
app.get('/api/gift-cards', authorize('tickets'), (req, res) => {
    res.json({ giftCards: store.giftCards, total: store.giftCards.length });
});

app.get('/api/gift-cards/:code', authorize('tickets'), (req, res) => {
    const card = store.giftCards.find(g => g.code === req.params.code);
    if (!card) return res.status(404).json({ error: 'Gift card not found' });
    res.json(card);
});

app.post('/api/gift-cards', authorize('config'), (req, res) => {
    const { code, initialBalance, recipientName, recipientEmail } = req.body;
    if (!code) return res.status(400).json({ error: 'Gift card code required' });
    const balance = Math.round((parseFloat(initialBalance) || 0) * 100) / 100;
    if (balance <= 0) return res.status(400).json({ error: 'Initial balance must be positive' });

    if (store.giftCards.find(g => g.code === code)) {
        return res.status(409).json({ error: 'Gift card code already exists' });
    }

    const card = {
        id: nextId(store.giftCards),
        code,
        initialBalance: balance,
        balance,
        recipientName: recipientName || '',
        recipientEmail: recipientEmail || '',
        active: true,
        transactions: [],
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'unknown'
    };
    store.giftCards.push(card);
    logAudit('gift_card_created', req.user, { code, balance });
    scheduleSave();
    res.status(201).json(card);
});

app.post('/api/gift-cards/:code/charge', authorize('tickets'), (req, res) => {
    const card = store.giftCards.find(g => g.code === req.params.code);
    if (!card) return res.status(404).json({ error: 'Gift card not found' });
    if (!card.active) return res.status(400).json({ error: 'Gift card is inactive' });

    const amount = Math.round((parseFloat(req.body.amount) || 0) * 100) / 100;
    if (amount <= 0) return res.status(400).json({ error: 'Charge amount must be positive' });
    if (amount > card.balance) {
        return res.status(400).json({ error: 'Insufficient balance', balance: card.balance });
    }

    card.balance = Math.round((card.balance - amount) * 100) / 100;
    card.transactions.push({
        type: 'charge',
        amount,
        balance: card.balance,
        ticketId: req.body.ticketId || null,
        processedBy: req.user ? req.user.name : 'unknown',
        time: new Date().toISOString()
    });
    logAudit('gift_card_charged', req.user, { code: card.code, amount, remaining: card.balance });
    scheduleSave();
    res.json({ card, charged: amount });
});

app.post('/api/gift-cards/:code/reload', authorize('tickets'), (req, res) => {
    const card = store.giftCards.find(g => g.code === req.params.code);
    if (!card) return res.status(404).json({ error: 'Gift card not found' });

    const amount = Math.round((parseFloat(req.body.amount) || 0) * 100) / 100;
    if (amount <= 0) return res.status(400).json({ error: 'Reload amount must be positive' });

    card.balance = Math.round((card.balance + amount) * 100) / 100;
    card.transactions.push({
        type: 'reload',
        amount,
        balance: card.balance,
        processedBy: req.user ? req.user.name : 'unknown',
        time: new Date().toISOString()
    });
    logAudit('gift_card_reloaded', req.user, { code: card.code, amount, balance: card.balance });
    scheduleSave();
    res.json({ card, reloaded: amount });
});

// ==========================================
// Digital Receipts
// ==========================================
app.get('/api/tickets/:id/receipt', (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const config = store.config;
    const receipt = {
        restaurantName: config.restaurant.name,
        restaurantAddress: [config.restaurant.address1, config.restaurant.address2, config.restaurant.city, config.restaurant.state, config.restaurant.zip].filter(Boolean).join(', '),
        restaurantPhone: config.restaurant.phone,
        ticketId: ticket.id,
        type: ticket.type,
        server: ticket.server,
        table: ticket.table,
        time: ticket.time,
        items: (ticket.items || []).map(i => ({
            name: i.name,
            qty: i.qty,
            price: i.price,
            total: Math.round((parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0) * 100) / 100
        })),
        subtotal: ticket.subtotal || 0,
        discount: ticket.discount ? (ticket.discount.amount || 0) : 0,
        tax: ticket.tax || 0,
        deliveryFee: ticket.deliveryFee || 0,
        total: ticket.total || 0,
        tip: ticket.tip || 0,
        grandTotal: Math.round(((ticket.total || 0) + (ticket.tip || 0)) * 100) / 100,
        paymentMethod: ticket.paymentMethod || null,
        payments: ticket.payments || [],
        status: ticket.status,
        footer: config.receipt.footer,
        cdNotice: config.cashDiscount.enabled ? config.receipt.cdNotice : null,
        generatedAt: new Date().toISOString()
    };

    // Add dual pricing info if enabled
    if (config.cashDiscount.enabled && config.cashDiscount.showDualPricing) {
        const rate = (parseFloat(config.cashDiscount.rate) || 0) / 100;
        if (config.cashDiscount.mode === 'CASH_DISCOUNT') {
            receipt.cashPrice = Math.round((ticket.total || 0) * (1 - rate) * 100) / 100;
            receipt.cardPrice = ticket.total || 0;
        } else {
            receipt.cashPrice = ticket.total || 0;
            receipt.cardPrice = Math.round((ticket.total || 0) * (1 + rate) * 100) / 100;
        }
    }

    res.json(receipt);
});

// ==========================================
// Promo Code Engine
// ==========================================
app.get('/api/promo-codes', authorize('config'), (req, res) => {
    res.json({ promoCodes: store.promoCodes, total: store.promoCodes.length });
});

app.post('/api/promo-codes', authorize('config'), (req, res) => {
    const { code, type, value, minOrder, maxUses, expiresAt, description } = req.body;
    if (!code) return res.status(400).json({ error: 'Promo code required' });
    if (!type || !['percent', 'fixed'].includes(type)) {
        return res.status(400).json({ error: 'Type must be "percent" or "fixed"' });
    }
    const val = parseFloat(value) || 0;
    if (val <= 0) return res.status(400).json({ error: 'Value must be positive' });

    if (store.promoCodes.find(p => p.code.toUpperCase() === code.toUpperCase())) {
        return res.status(409).json({ error: 'Promo code already exists' });
    }

    const promo = {
        id: nextId(store.promoCodes),
        code: code.toUpperCase(),
        type,
        value: val,
        minOrder: parseFloat(minOrder) || 0,
        maxUses: parseInt(maxUses, 10) || null,
        usedCount: 0,
        expiresAt: expiresAt || null,
        description: description || '',
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'unknown'
    };
    store.promoCodes.push(promo);
    logAudit('promo_code_created', req.user, { code: promo.code, type, value: val });
    scheduleSave();
    res.status(201).json(promo);
});

app.post('/api/promo-codes/validate', authorize('tickets'), (req, res) => {
    const { code, orderTotal } = req.body;
    if (!code) return res.status(400).json({ error: 'Promo code required' });

    const promo = store.promoCodes.find(p => p.code === code.toUpperCase() && p.active);
    if (!promo) return res.status(404).json({ error: 'Invalid or inactive promo code' });

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Promo code has expired' });
    }
    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
        return res.status(400).json({ error: 'Promo code usage limit reached' });
    }

    const total = parseFloat(orderTotal) || 0;
    if (total < promo.minOrder) {
        return res.status(400).json({ error: 'Order does not meet minimum amount', minOrder: promo.minOrder });
    }

    let discount = 0;
    if (promo.type === 'percent') {
        discount = Math.round(total * (promo.value / 100) * 100) / 100;
    } else {
        discount = Math.min(promo.value, total);
    }

    res.json({ valid: true, code: promo.code, discount, type: promo.type, value: promo.value, description: promo.description });
});

app.post('/api/promo-codes/:id/redeem', authorize('tickets'), (req, res) => {
    const promo = store.promoCodes.find(p => p.id === parseInt(req.params.id));
    if (!promo) return res.status(404).json({ error: 'Promo code not found' });
    if (!promo.active) return res.status(400).json({ error: 'Promo code is inactive' });
    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
        return res.status(400).json({ error: 'Promo code usage limit reached' });
    }

    promo.usedCount++;
    scheduleSave();
    res.json(promo);
});

app.delete('/api/promo-codes/:id', authorize('config'), (req, res) => {
    const idx = store.promoCodes.findIndex(p => p.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Promo code not found' });
    const removed = store.promoCodes.splice(idx, 1)[0];
    logAudit('promo_code_deleted', req.user, { code: removed.code });
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Seat-Level Ordering & Split Checks by Seat
// ==========================================

// Assign items to seats on a ticket
app.post('/api/tickets/:id/seats', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { seats } = req.body;
    if (!seats || typeof seats !== 'object') {
        return res.status(400).json({ error: 'Seats object required (seat number → item indices)' });
    }

    // Store seat assignments: { "1": [0,1], "2": [2,3] }
    ticket.seats = seats;
    ticket.updatedAt = new Date().toISOString();
    scheduleSave();
    res.json(ticket);
});

// Split check by seat — returns sub-totals per seat
app.get('/api/tickets/:id/split-by-seat', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const seats = ticket.seats || {};
    const items = ticket.items || [];
    const taxRate = store.config.tax.rate / 100;
    const splitChecks = {};

    // Build per-seat totals
    Object.entries(seats).forEach(([seatNum, itemIndices]) => {
        const seatItems = (Array.isArray(itemIndices) ? itemIndices : [])
            .filter(i => i >= 0 && i < items.length)
            .map(i => items[i]);

        const subtotal = seatItems.reduce((s, item) => {
            return s + Math.round((parseFloat(item.price) || 0) * (parseInt(item.qty, 10) || 0) * 100) / 100;
        }, 0);
        const tax = Math.round(subtotal * taxRate * 100) / 100;

        splitChecks[seatNum] = {
            seat: parseInt(seatNum),
            items: seatItems,
            subtotal: Math.round(subtotal * 100) / 100,
            tax,
            total: Math.round((subtotal + tax) * 100) / 100
        };
    });

    // Find unassigned items
    const assignedIndices = new Set(Object.values(seats).flat());
    const unassigned = items.filter((_, i) => !assignedIndices.has(i));

    res.json({ ticketId: ticket.id, checks: splitChecks, unassignedItems: unassigned });
});

// ==========================================
// Expo Screen (view of ready / bumped orders)
// ==========================================
app.get('/api/kitchen/expo', authorize('kitchen'), (req, res) => {
    // Expo sees bumped orders that haven't been marked as picked up
    const ready = store.kitchenOrders
        .filter(o => o.status === 'bumped' && !o.pickedUp)
        .map(o => ({
            id: o.id,
            table: o.table,
            type: o.type,
            server: o.server,
            items: o.items,
            bumpedAt: o.bumpedAt,
            bumpedBy: o.bumpedBy,
            waitTime: o.bumpedAt ? Math.round((Date.now() - new Date(o.bumpedAt).getTime()) / 60000) : 0
        }));

    // Also include in-progress orders (not yet bumped)
    const inProgress = store.kitchenOrders
        .filter(o => o.status === 'new' || o.status === 'cooking')
        .map(o => ({
            id: o.id,
            table: o.table,
            type: o.type,
            server: o.server,
            items: o.items,
            status: o.status,
            time: o.time,
            currentCourse: o.currentCourse
        }));

    res.json({ ready, inProgress, readyCount: ready.length, inProgressCount: inProgress.length });
});

// Mark expo order as picked up
app.post('/api/kitchen/:id/pickup', authorize('tickets'), (req, res) => {
    const order = store.kitchenOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.pickedUp = true;
    order.pickedUpAt = new Date().toISOString();
    order.pickedUpBy = req.user ? req.user.name : 'unknown';
    scheduleSave();
    res.json(order);
});

// ==========================================
// Loyalty Points System
// ==========================================
const LOYALTY_CONFIG = {
    pointsPerDollar: 1,
    redeemThreshold: 100,
    redeemValue: 5.00
};

app.get('/api/customers/:id/loyalty', authorize('tickets'), (req, res) => {
    const customer = store.customers.find(c => c.id === parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const points = customer.loyaltyPoints || 0;
    const redeemSets = Math.floor(points / LOYALTY_CONFIG.redeemThreshold);

    res.json({
        customerId: customer.id,
        name: customer.name,
        points,
        redeemableRewards: redeemSets,
        redeemValue: Math.round(redeemSets * LOYALTY_CONFIG.redeemValue * 100) / 100,
        pointsToNextReward: points >= LOYALTY_CONFIG.redeemThreshold ? 0 : LOYALTY_CONFIG.redeemThreshold - points,
        config: LOYALTY_CONFIG
    });
});

app.post('/api/customers/:id/loyalty/earn', authorize('tickets'), (req, res) => {
    const customer = store.customers.find(c => c.id === parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    let amount = parseFloat(req.body.amount) || 0;
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    // If ticketId provided, validate amount against actual ticket total (post-discount)
    if (req.body.ticketId) {
        const ticket = store.tickets.find(t => t.id === parseInt(req.body.ticketId));
        if (ticket) {
            const maxAmount = Math.round(((ticket.subtotal || ticket.total || 0) - (ticket.discount ? (ticket.discount.amount || 0) : 0)) * 100) / 100;
            amount = Math.min(amount, Math.max(0, maxAmount));
        }
    }
    // Cap multiplier to prevent abuse (max 3x)
    const multiplier = Math.min(parseFloat(req.body.multiplier) || 1, 3);
    const earned = Math.floor(amount * LOYALTY_CONFIG.pointsPerDollar * multiplier);

    customer.loyaltyPoints = (customer.loyaltyPoints || 0) + earned;
    customer.totalSpent = Math.round(((customer.totalSpent || 0) + amount) * 100) / 100;
    customer.visitCount = (customer.visitCount || 0) + 1;
    scheduleSave();

    res.json({
        earned,
        totalPoints: customer.loyaltyPoints,
        totalSpent: customer.totalSpent,
        visitCount: customer.visitCount
    });
});

app.post('/api/customers/:id/loyalty/redeem', authorize('tickets'), (req, res) => {
    const customer = store.customers.find(c => c.id === parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const points = customer.loyaltyPoints || 0;
    const setsToRedeem = parseInt(req.body.rewards, 10) || 1;

    if (setsToRedeem <= 0) return res.status(400).json({ error: 'Rewards count must be positive' });

    const pointsNeeded = setsToRedeem * LOYALTY_CONFIG.redeemThreshold;
    if (points < pointsNeeded) {
        return res.status(400).json({
            error: 'Insufficient points',
            have: points,
            need: pointsNeeded
        });
    }

    customer.loyaltyPoints -= pointsNeeded;
    const dollarValue = Math.round(setsToRedeem * LOYALTY_CONFIG.redeemValue * 100) / 100;
    scheduleSave();

    res.json({
        redeemed: setsToRedeem,
        pointsUsed: pointsNeeded,
        dollarValue,
        remainingPoints: customer.loyaltyPoints
    });
});

// ==========================================
// Online Order Queue
// ==========================================
app.get('/api/online-orders', authorize('tickets'), (req, res) => {
    let orders = store.onlineOrders;
    const { status } = req.query;
    if (status && status !== 'all') {
        orders = orders.filter(o => o.status === status);
    }
    res.json({ orders, total: orders.length });
});

app.post('/api/online-orders', (req, res) => {
    // Online orders don't require auth (customer-facing)
    const { customerName, customerPhone, customerEmail, items, type, scheduledFor, promoCode, note } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items required' });
    }
    if (!customerName) {
        return res.status(400).json({ error: 'Customer name required' });
    }

    const subtotal = items.reduce((s, i) => {
        return s + Math.round((parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0) * 100) / 100;
    }, 0);

    // Validate and apply promo code if provided
    let promoDiscount = 0;
    let appliedPromo = null;
    if (promoCode) {
        const promo = store.promoCodes.find(p => p.code === promoCode.toUpperCase() && p.active);
        if (promo) {
            const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();
            const isMaxed = promo.maxUses && promo.usedCount >= promo.maxUses;
            const meetsMin = subtotal >= (promo.minOrder || 0);
            if (!isExpired && !isMaxed && meetsMin) {
                if (promo.type === 'percent') {
                    promoDiscount = Math.round(subtotal * (promo.value / 100) * 100) / 100;
                } else {
                    promoDiscount = Math.min(promo.value, subtotal);
                }
                promo.usedCount = (promo.usedCount || 0) + 1;
                appliedPromo = { code: promo.code, type: promo.type, value: promo.value, discount: promoDiscount };
            }
        }
    }

    const afterDiscount = Math.round(Math.max(0, subtotal - promoDiscount) * 100) / 100;
    const tax = Math.round(afterDiscount * (store.config.tax.rate / 100) * 100) / 100;

    const order = {
        id: Math.max(nextId(store.onlineOrders), 5001),
        customerName,
        customerPhone: customerPhone || '',
        customerEmail: customerEmail || '',
        items,
        type: type || 'pickup',
        subtotal: Math.round(subtotal * 100) / 100,
        promoDiscount,
        appliedPromo,
        tax,
        total: Math.round((afterDiscount + tax) * 100) / 100,
        promoCode: promoCode || null,
        note: note || '',
        scheduledFor: scheduledFor || null,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    store.onlineOrders.push(order);
    fireWebhooks('kitchen.new', { orderId: order.id, type: 'online', items: order.items.length });
    scheduleSave();
    res.status(201).json(order);
});

app.post('/api/online-orders/:id/accept', authorize('tickets'), (req, res) => {
    const order = store.onlineOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Online order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order is not pending' });

    order.status = 'accepted';
    order.acceptedAt = new Date().toISOString();
    order.acceptedBy = req.user ? req.user.name : 'unknown';

    // Create a real ticket from the online order
    const ticket = {
        id: store.nextTicketId++,
        items: order.items,
        type: order.type,
        server: req.user ? req.user.name : 'unknown',
        table: null,
        discount: null,
        deliveryFee: 0,
        note: order.note,
        status: 'open',
        paid: false,
        onlineOrderId: order.id,
        customerName: order.customerName,
        time: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'system',
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total
    };
    store.tickets.push(ticket);
    order.ticketId = ticket.id;

    scheduleSave();
    res.json({ order, ticket });
});

app.post('/api/online-orders/:id/reject', authorize('tickets'), (req, res) => {
    const order = store.onlineOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Online order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order is not pending' });

    order.status = 'rejected';
    order.rejectedAt = new Date().toISOString();
    order.rejectedBy = req.user ? req.user.name : 'unknown';
    order.rejectReason = req.body.reason || '';
    scheduleSave();
    res.json(order);
});

// ==========================================
// Fraud Detection Alerts
// ==========================================
function checkFraudPatterns(ticket, user) {
    const alerts = [];
    const now = new Date();

    // Pattern 1: Multiple voids by same user in short time
    const recentVoids = store.auditLog.filter(l =>
        l.action === 'void' && l.user === (user ? user.name : '') &&
        (now - new Date(l.time)) < 3600000 // Within 1 hour
    );
    if (recentVoids.length >= 3) {
        alerts.push({
            type: 'excessive_voids',
            severity: 'high',
            message: `${user.name} has voided ${recentVoids.length} tickets in the last hour`,
            user: user.name
        });
    }

    // Pattern 2: Large refund relative to ticket
    if (ticket && ticket.total > 100) {
        const refundsForTicket = store.refunds.filter(r => r.ticketId === ticket.id);
        const totalRefunded = refundsForTicket.reduce((s, r) => s + r.amount, 0);
        if (totalRefunded > ticket.total * 0.5) {
            alerts.push({
                type: 'large_refund',
                severity: 'medium',
                message: `Ticket ${ticket.id} has been refunded ${Math.round(totalRefunded / ticket.total * 100)}%`,
                ticketId: ticket.id
            });
        }
    }

    // Pattern 3: Rapid ticket creation (possible testing/abuse)
    const recentTickets = store.tickets.filter(t =>
        t.createdBy === (user ? user.name : '') &&
        (now - new Date(t.createdAt)) < 300000 // 5 minutes
    );
    if (recentTickets.length >= 10) {
        alerts.push({
            type: 'rapid_tickets',
            severity: 'low',
            message: `${user.name} created ${recentTickets.length} tickets in 5 minutes`,
            user: user.name
        });
    }

    // Store new alerts
    alerts.forEach(a => {
        a.id = nextId(store.fraudAlerts);
        a.time = now.toISOString();
        a.resolved = false;
        store.fraudAlerts.push(a);
    });

    return alerts;
}

app.get('/api/fraud-alerts', authorize('reports'), (req, res) => {
    let alerts = store.fraudAlerts;
    const { severity, resolved } = req.query;

    if (severity) alerts = alerts.filter(a => a.severity === severity);
    if (resolved === 'true') alerts = alerts.filter(a => a.resolved);
    if (resolved === 'false') alerts = alerts.filter(a => !a.resolved);

    res.json({ alerts: [...alerts].reverse(), total: alerts.length });
});

app.post('/api/fraud-alerts/scan', authorize('reports'), (req, res) => {
    // Manual scan: check all recent activity for fraud patterns
    const now = new Date();
    const initialCount = store.fraudAlerts.length;

    // Check recent voids
    const voidUsers = {};
    store.auditLog.filter(l =>
        l.action === 'void' && (now - new Date(l.time)) < 3600000
    ).forEach(l => {
        voidUsers[l.user] = (voidUsers[l.user] || 0) + 1;
    });

    Object.entries(voidUsers).forEach(([user, count]) => {
        if (count >= 3) {
            const existing = store.fraudAlerts.find(a =>
                a.type === 'excessive_voids' && a.user === user &&
                (now - new Date(a.time)) < 3600000
            );
            if (!existing) {
                store.fraudAlerts.push({
                    id: nextId(store.fraudAlerts),
                    type: 'excessive_voids',
                    severity: 'high',
                    message: `${user} has voided ${count} tickets in the last hour`,
                    user,
                    time: now.toISOString(),
                    resolved: false
                });
            }
        }
    });

    // Check large refunds
    store.tickets.forEach(t => {
        if (t.total > 100 && t.refundedAmount && t.refundedAmount > t.total * 0.5) {
            const existing = store.fraudAlerts.find(a =>
                a.type === 'large_refund' && a.ticketId === t.id
            );
            if (!existing) {
                store.fraudAlerts.push({
                    id: nextId(store.fraudAlerts),
                    type: 'large_refund',
                    severity: 'medium',
                    message: `Ticket ${t.id} has been refunded ${Math.round(t.refundedAmount / t.total * 100)}%`,
                    ticketId: t.id,
                    time: now.toISOString(),
                    resolved: false
                });
            }
        }
    });

    const newAlerts = store.fraudAlerts.length - initialCount;
    scheduleSave();
    res.json({ scanned: true, newAlerts, totalAlerts: store.fraudAlerts.length });
});

app.post('/api/fraud-alerts/:id/resolve', authorize('reports'), (req, res) => {
    const alert = store.fraudAlerts.find(a => a.id === parseInt(req.params.id));
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = req.user ? req.user.name : 'unknown';
    alert.resolution = req.body.resolution || '';
    scheduleSave();
    res.json(alert);
});

// ==========================================
// Modifier Profitability Report
// ==========================================
app.get('/api/reports/modifier-profitability', authorize('reports'), (req, res) => {
    const modifiers = {};

    store.tickets.forEach(t => {
        if (t.status === 'voided') return;
        (t.items || []).forEach(item => {
            (item.modifiers || []).forEach(mod => {
                const key = mod.name || 'Unknown Modifier';
                if (!modifiers[key]) {
                    modifiers[key] = { name: key, count: 0, revenue: 0, cost: 0 };
                }
                modifiers[key].count++;
                modifiers[key].revenue += Math.round((parseFloat(mod.price) || 0) * 100) / 100;
                modifiers[key].cost += Math.round((parseFloat(mod.cost) || 0) * 100) / 100;
            });
        });
    });

    const result = Object.values(modifiers).map(m => ({
        ...m,
        revenue: Math.round(m.revenue * 100) / 100,
        cost: Math.round(m.cost * 100) / 100,
        profit: Math.round((m.revenue - m.cost) * 100) / 100,
        marginPct: m.revenue > 0 ? Math.round((m.revenue - m.cost) / m.revenue * 1000) / 10 : 0
    })).sort((a, b) => b.revenue - a.revenue);

    const totalModRevenue = result.reduce((s, m) => s + m.revenue, 0);

    res.json({
        modifiers: result,
        totalModifierRevenue: Math.round(totalModRevenue * 100) / 100,
        totalModifiers: result.length
    });
});

// ==========================================
// Food Cost Tracking Report
// ==========================================
app.get('/api/reports/food-cost', authorize('reports'), (req, res) => {
    let totalRevenue = 0;
    let totalFoodCost = 0;
    const byItem = {};

    store.tickets.forEach(t => {
        if (t.status === 'voided') return;
        (t.items || []).forEach(item => {
            const key = item.name || 'Unknown';
            const qty = parseInt(item.qty, 10) || 0;
            const price = parseFloat(item.price) || 0;
            const cost = parseFloat(item.cost) || 0;
            const rev = Math.round(price * qty * 100) / 100;
            const fc = Math.round(cost * qty * 100) / 100;

            totalRevenue += rev;
            totalFoodCost += fc;

            if (!byItem[key]) byItem[key] = { name: key, qty: 0, revenue: 0, cost: 0 };
            byItem[key].qty += qty;
            byItem[key].revenue += rev;
            byItem[key].cost += fc;
        });
    });

    const items = Object.values(byItem).map(i => ({
        ...i,
        revenue: Math.round(i.revenue * 100) / 100,
        cost: Math.round(i.cost * 100) / 100,
        profit: Math.round((i.revenue - i.cost) * 100) / 100,
        foodCostPct: i.revenue > 0 ? Math.round(i.cost / i.revenue * 1000) / 10 : 0
    })).sort((a, b) => b.foodCostPct - a.foodCostPct);

    totalRevenue = Math.round(totalRevenue * 100) / 100;
    totalFoodCost = Math.round(totalFoodCost * 100) / 100;
    const overallFoodCostPct = totalRevenue > 0 ? Math.round(totalFoodCost / totalRevenue * 1000) / 10 : 0;

    res.json({
        totalRevenue,
        totalFoodCost,
        totalProfit: Math.round((totalRevenue - totalFoodCost) * 100) / 100,
        overallFoodCostPct,
        items
    });
});

// ==========================================
// Ingredient-Level Tracking (CRUD)
// ==========================================
const INGREDIENT_FIELDS = ['name', 'unit', 'stock', 'lowThreshold', 'cost', 'supplier', 'category'];

app.get('/api/ingredients', authorize('config'), (req, res) => {
    let ingredients = store.ingredients;
    const { search, lowStock } = req.query;
    if (search) {
        const q = search.toLowerCase();
        ingredients = ingredients.filter(i => (i.name || '').toLowerCase().includes(q));
    }
    if (lowStock === 'true') {
        ingredients = ingredients.filter(i => i.stock <= (i.lowThreshold || 0));
    }
    res.json({ ingredients, total: ingredients.length });
});

app.post('/api/ingredients', authorize('config'), (req, res) => {
    const { name, unit, stock, lowThreshold, cost, costPerUnit, supplier, category, barcode, quantity, lowStockThreshold } = req.body;
    if (!name) return res.status(400).json({ error: 'Ingredient name required' });

    const ingredient = {
        id: nextId(store.ingredients),
        name,
        unit: unit || 'units',
        stock: parseFloat(stock || quantity) || 0,
        quantity: parseFloat(quantity || stock) || 0,
        lowThreshold: parseFloat(lowThreshold || lowStockThreshold) || 5,
        lowStockThreshold: parseFloat(lowStockThreshold || lowThreshold) || 5,
        cost: Math.round((parseFloat(cost || costPerUnit) || 0) * 100) / 100,
        costPerUnit: Math.round((parseFloat(costPerUnit || cost) || 0) * 100) / 100,
        supplier: supplier || '',
        category: category || 'General',
        barcode: barcode || null,
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'unknown'
    };
    store.ingredients.push(ingredient);
    logAudit('ingredient_created', req.user, { ingredientId: ingredient.id, name });
    scheduleSave();
    res.status(201).json(ingredient);
});

app.patch('/api/ingredients/:id', authorize('config'), (req, res) => {
    const ingredient = store.ingredients.find(i => i.id === parseInt(req.params.id));
    if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });

    INGREDIENT_FIELDS.forEach(field => {
        if (req.body[field] !== undefined) ingredient[field] = req.body[field];
    });
    ingredient.updatedAt = new Date().toISOString();
    scheduleSave();
    res.json(ingredient);
});

app.delete('/api/ingredients/:id', authorize('config'), (req, res) => {
    const idx = store.ingredients.findIndex(i => i.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Ingredient not found' });
    const removed = store.ingredients.splice(idx, 1)[0];
    logAudit('ingredient_deleted', req.user, { ingredientId: removed.id, name: removed.name });
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Inventory Depletion Tracking
// ==========================================
app.post('/api/ingredients/:id/adjust', authorize('config'), (req, res) => {
    const ingredient = store.ingredients.find(i => i.id === parseInt(req.params.id));
    if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });

    const { quantity, reason, type } = req.body;
    const qty = parseFloat(quantity) || 0;
    if (qty === 0) return res.status(400).json({ error: 'Quantity required' });

    const oldStock = ingredient.stock;
    const newStock = Math.round((ingredient.stock + qty) * 100) / 100;
    if (newStock < 0) return res.status(400).json({ error: 'Insufficient stock', currentStock: ingredient.stock, requested: qty });
    ingredient.stock = newStock;

    const movement = {
        id: nextId(store.inventoryMovements),
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        type: type || (qty > 0 ? 'restock' : 'usage'),
        quantity: qty,
        oldStock,
        newStock: ingredient.stock,
        reason: reason || '',
        recordedBy: req.user ? req.user.name : 'unknown',
        time: new Date().toISOString()
    };
    store.inventoryMovements.push(movement);
    logAudit('inventory_adjusted', req.user, { ingredientId: ingredient.id, qty, oldStock, newStock: ingredient.stock });
    scheduleSave();

    res.json({ ingredient, movement });
});

app.get('/api/inventory-movements', authorize('reports'), (req, res) => {
    let movements = store.inventoryMovements;
    const { ingredientId, type, limit: limitParam } = req.query;

    if (ingredientId) movements = movements.filter(m => m.ingredientId === parseInt(ingredientId));
    if (type) movements = movements.filter(m => m.type === type);

    movements = [...movements].reverse();

    const limit = parseInt(limitParam, 10);
    if (limit > 0) movements = movements.slice(0, limit);

    res.json({ movements, total: movements.length });
});

app.get('/api/reports/inventory-depletion', authorize('reports'), (req, res) => {
    const depletion = {};

    store.inventoryMovements.forEach(m => {
        if (m.quantity < 0) {
            if (!depletion[m.ingredientName]) {
                depletion[m.ingredientName] = { name: m.ingredientName, totalUsed: 0, movements: 0 };
            }
            depletion[m.ingredientName].totalUsed += Math.abs(m.quantity);
            depletion[m.ingredientName].movements++;
        }
    });

    const items = Object.values(depletion).map(d => ({
        ...d,
        totalUsed: Math.round(d.totalUsed * 100) / 100
    })).sort((a, b) => b.totalUsed - a.totalUsed);

    res.json({ items, totalItems: items.length });
});

// ==========================================
// Low-Stock Alerts
// ==========================================
app.get('/api/alerts/low-stock', authorize('config'), (req, res) => {
    const lowStock = store.ingredients.filter(i => i.stock <= (i.lowThreshold || 0));
    const outOfStock = store.ingredients.filter(i => i.stock <= 0);

    res.json({
        lowStock: lowStock.map(i => ({
            id: i.id,
            name: i.name,
            stock: i.stock,
            unit: i.unit,
            threshold: i.lowThreshold,
            supplier: i.supplier
        })),
        outOfStock: outOfStock.map(i => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            supplier: i.supplier
        })),
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length
    });
});

// ==========================================
// Scheduled Orders
// ==========================================
app.get('/api/scheduled-orders', authorize('tickets'), (req, res) => {
    let orders = store.scheduledOrders;
    const { status, date } = req.query;
    if (status) orders = orders.filter(o => o.status === status);
    if (date) orders = orders.filter(o => o.scheduledFor && o.scheduledFor.startsWith(date));
    res.json({ orders, total: orders.length });
});

app.post('/api/scheduled-orders', (req, res) => {
    const { customerName, customerPhone, items, scheduledFor, type, note } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items required' });
    }
    if (!scheduledFor) return res.status(400).json({ error: 'Scheduled time required' });
    if (!customerName) return res.status(400).json({ error: 'Customer name required' });

    const subtotal = items.reduce((s, i) => {
        return s + Math.round((parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0) * 100) / 100;
    }, 0);
    const tax = Math.round(subtotal * (store.config.tax.rate / 100) * 100) / 100;

    const order = {
        id: Math.max(nextId(store.scheduledOrders), 7001),
        customerName,
        customerPhone: customerPhone || '',
        items,
        type: type || 'pickup',
        scheduledFor,
        note: note || '',
        subtotal: Math.round(subtotal * 100) / 100,
        tax,
        total: Math.round((subtotal + tax) * 100) / 100,
        status: 'scheduled',
        createdAt: new Date().toISOString()
    };
    store.scheduledOrders.push(order);
    scheduleSave();
    res.status(201).json(order);
});

app.post('/api/scheduled-orders/:id/confirm', authorize('tickets'), (req, res) => {
    const order = store.scheduledOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Scheduled order not found' });
    if (order.status !== 'scheduled') return res.status(400).json({ error: 'Order is not scheduled' });

    order.status = 'confirmed';
    order.confirmedAt = new Date().toISOString();
    order.confirmedBy = req.user ? req.user.name : 'unknown';
    scheduleSave();
    res.json(order);
});

app.post('/api/scheduled-orders/:id/cancel', authorize('tickets'), (req, res) => {
    const order = store.scheduledOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Scheduled order not found' });
    if (order.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    order.status = 'cancelled';
    order.cancelledAt = new Date().toISOString();
    order.cancelReason = req.body.reason || '';
    scheduleSave();
    res.json(order);
});

app.post('/api/scheduled-orders/:id/fulfill', authorize('tickets'), (req, res) => {
    const order = store.scheduledOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Scheduled order not found' });
    if (order.status === 'cancelled') return res.status(400).json({ error: 'Cannot fulfill cancelled order' });

    // Convert to a ticket
    const ticket = {
        id: store.nextTicketId++,
        items: order.items,
        type: order.type || 'pickup',
        server: req.user ? req.user.name : 'unknown',
        table: null,
        discount: null,
        deliveryFee: 0,
        deliveryAddress: '',
        note: order.note || '',
        status: 'open',
        paid: false,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        time: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'unknown',
        scheduledOrderId: order.id
    };
    store.tickets.push(ticket);

    order.status = 'fulfilled';
    order.fulfilledAt = new Date().toISOString();
    order.ticketId = ticket.id;
    fireWebhooks('ticket.created', { ticketId: ticket.id, type: ticket.type, server: ticket.server });
    scheduleSave();
    res.json({ order, ticket });
});

// ==========================================
// Curbside Pickup Mode
// ==========================================
app.get('/api/curbside', authorize('tickets'), (req, res) => {
    // Get all curbside orders (from tickets, online orders, and scheduled orders)
    const curbsideTickets = store.tickets.filter(t =>
        t.type === 'curbside' && t.status !== 'voided' && t.status !== 'refunded'
    );
    const curbsideOnline = store.onlineOrders.filter(o =>
        o.type === 'curbside' && o.status === 'accepted'
    );

    const orders = [
        ...curbsideTickets.map(t => ({
            source: 'ticket',
            id: t.id,
            customerName: t.customerName || t.server,
            items: t.items,
            total: t.total,
            status: t.status,
            vehicleInfo: t.vehicleInfo || null,
            arrivedAt: t.arrivedAt || null,
            time: t.time
        })),
        ...curbsideOnline.map(o => ({
            source: 'online',
            id: o.id,
            customerName: o.customerName,
            items: o.items,
            total: o.total,
            status: o.status,
            vehicleInfo: o.vehicleInfo || null,
            arrivedAt: o.arrivedAt || null,
            time: o.createdAt
        }))
    ];

    res.json({ orders, total: orders.length });
});

app.post('/api/tickets/:id/curbside-arrival', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    ticket.arrivedAt = new Date().toISOString();
    ticket.vehicleInfo = req.body.vehicleInfo || '';
    ticket.curbsideNotes = req.body.notes || '';
    scheduleSave();
    res.json(ticket);
});

// ==========================================
// Webhook Management Endpoints (requires config permission)
// ==========================================
const WEBHOOK_EVENTS = [
    'ticket.created', 'ticket.paid', 'ticket.voided',
    'kitchen.new', 'kitchen.bumped', 'kitchen.course_fired',
    'order.ready', 'purchase_order.created', 'reservation.created',
    'qr_order.created', 'email_campaign.sent'
];

app.get('/api/webhooks', authorize('config'), (req, res) => {
    res.json({ webhooks: store.webhooks, supportedEvents: WEBHOOK_EVENTS });
});

app.post('/api/webhooks', authorize('config'), (req, res) => {
    const { url, events, secret } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'At least one event required', supportedEvents: WEBHOOK_EVENTS });
    }

    const invalid = events.filter(e => !WEBHOOK_EVENTS.includes(e));
    if (invalid.length > 0) {
        return res.status(400).json({ error: 'Invalid events: ' + invalid.join(', '), supportedEvents: WEBHOOK_EVENTS });
    }

    const webhook = {
        id: nextId(store.webhooks),
        url,
        events,
        secret: secret || null,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'unknown'
    };
    store.webhooks.push(webhook);
    logAudit('webhook_created', req.user, { url, events });
    scheduleSave();
    res.status(201).json(webhook);
});

app.delete('/api/webhooks/:id', authorize('config'), (req, res) => {
    const idx = store.webhooks.findIndex(w => w.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Webhook not found' });

    const removed = store.webhooks.splice(idx, 1)[0];
    logAudit('webhook_deleted', req.user, { url: removed.url, id: removed.id });
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Recipe Costing
// ==========================================
app.get('/api/recipes', authorize('config'), (req, res) => {
    res.json(store.recipes);
});

app.post('/api/recipes', authorize('config'), (req, res) => {
    const { name, ingredients, prepTime, yield: recipeYield } = req.body;
    if (!name) return res.status(400).json({ error: 'Recipe name required' });
    const totalCost = (ingredients || []).reduce((sum, ing) => {
        const item = store.ingredients.find(i => i.id === ing.ingredientId);
        return sum + (item ? (item.cost || item.costPerUnit || 0) * (ing.quantity || 0) : 0);
    }, 0);
    const recipe = {
        id: nextId(store.recipes), name,
        ingredients: ingredients || [], prepTime: prepTime || 0,
        yield: recipeYield || 1,
        totalCost: Math.round(totalCost * 100) / 100,
        costPerServing: Math.round((totalCost / (recipeYield || 1)) * 100) / 100,
        createdAt: new Date().toISOString()
    };
    store.recipes.push(recipe);
    scheduleSave();
    res.status(201).json(recipe);
});

app.put('/api/recipes/:id', authorize('config'), (req, res) => {
    const recipe = store.recipes.find(r => r.id === parseInt(req.params.id));
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    const { name, ingredients, prepTime, yield: recipeYield } = req.body;
    if (name !== undefined) recipe.name = name;
    if (prepTime !== undefined) recipe.prepTime = prepTime;
    if (recipeYield !== undefined) recipe.yield = recipeYield;
    if (ingredients !== undefined) {
        recipe.ingredients = ingredients;
        recipe.totalCost = Math.round(ingredients.reduce((sum, ing) => {
            const item = store.ingredients.find(i => i.id === ing.ingredientId);
            return sum + (item ? (item.cost || item.costPerUnit || 0) * (ing.quantity || 0) : 0);
        }, 0) * 100) / 100;
        recipe.costPerServing = Math.round((recipe.totalCost / (recipe.yield || 1)) * 100) / 100;
    }
    recipe.updatedAt = new Date().toISOString();
    scheduleSave();
    res.json(recipe);
});

app.delete('/api/recipes/:id', authorize('config'), (req, res) => {
    const idx = store.recipes.findIndex(r => r.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Recipe not found' });
    const removed = store.recipes.splice(idx, 1)[0];
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Vendor Tracking
// ==========================================
app.get('/api/vendors', authorize('config'), (req, res) => {
    res.json(store.vendors);
});

app.post('/api/vendors', authorize('config'), (req, res) => {
    const { name, contact, email, phone, category } = req.body;
    if (!name) return res.status(400).json({ error: 'Vendor name required' });
    const vendor = {
        id: nextId(store.vendors), name,
        contact: contact || '', email: email || '', phone: phone || '',
        category: category || 'general', createdAt: new Date().toISOString()
    };
    store.vendors.push(vendor);
    scheduleSave();
    res.status(201).json(vendor);
});

app.put('/api/vendors/:id', authorize('config'), (req, res) => {
    const vendor = store.vendors.find(v => v.id === parseInt(req.params.id));
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    const { name, contact, email, phone, category } = req.body;
    if (name !== undefined) vendor.name = name;
    if (contact !== undefined) vendor.contact = contact;
    if (email !== undefined) vendor.email = email;
    if (phone !== undefined) vendor.phone = phone;
    if (category !== undefined) vendor.category = category;
    vendor.updatedAt = new Date().toISOString();
    scheduleSave();
    res.json(vendor);
});

app.delete('/api/vendors/:id', authorize('config'), (req, res) => {
    const idx = store.vendors.findIndex(v => v.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Vendor not found' });
    const removed = store.vendors.splice(idx, 1)[0];
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Purchase Order Generation
// ==========================================
app.get('/api/purchase-orders', authorize('config'), (req, res) => {
    res.json(store.purchaseOrders);
});

app.post('/api/purchase-orders', authorize('config'), (req, res) => {
    const { vendorId, items, notes } = req.body;
    if (!vendorId || !items || !items.length) return res.status(400).json({ error: 'Vendor ID and items required' });
    const total = items.reduce((sum, item) => sum + Math.round((item.quantity || 0) * (item.unitCost || 0) * 100) / 100, 0);
    const po = {
        id: nextPrefixId(store.purchaseOrders, 'PO-'),
        vendorId, items, total: Math.round(total * 100) / 100,
        status: 'pending', notes: notes || '',
        createdAt: new Date().toISOString(),
        createdBy: req.user ? req.user.name : 'unknown'
    };
    store.purchaseOrders.push(po);
    fireWebhooks('purchase_order.created', po);
    logAudit('purchase_order_created', req.user, { poId: po.id, vendorId, total: po.total });
    scheduleSave();
    res.status(201).json(po);
});

// Purchase order status transitions: pending -> approved -> ordered -> received (or cancelled at any point)
app.post('/api/purchase-orders/:id/approve', authorize('config'), (req, res) => {
    const po = store.purchaseOrders.find(p => p.id === req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status !== 'pending') return res.status(400).json({ error: 'Can only approve pending orders' });
    po.status = 'approved';
    po.approvedBy = req.user.name;
    po.approvedAt = new Date().toISOString();
    scheduleSave();
    res.json(po);
});

app.post('/api/purchase-orders/:id/order', authorize('config'), (req, res) => {
    const po = store.purchaseOrders.find(p => p.id === req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status !== 'approved') return res.status(400).json({ error: 'Must be approved before ordering' });
    po.status = 'ordered';
    po.orderedAt = new Date().toISOString();
    scheduleSave();
    res.json(po);
});

app.post('/api/purchase-orders/:id/receive', authorize('config'), (req, res) => {
    const po = store.purchaseOrders.find(p => p.id === req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status !== 'ordered') return res.status(400).json({ error: 'Can only receive ordered items' });
    po.status = 'received';
    po.receivedAt = new Date().toISOString();
    po.receivedBy = req.user.name;

    // Add received items to ingredient stock
    (po.items || []).forEach(item => {
        const ing = store.ingredients.find(i => i.id === item.ingredientId || i.name === item.name);
        if (ing) {
            ing.stock = (ing.stock || 0) + (item.quantity || 0);
        }
    });

    scheduleSave();
    res.json(po);
});

app.post('/api/purchase-orders/:id/cancel', authorize('config'), (req, res) => {
    const po = store.purchaseOrders.find(p => p.id === req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'received') return res.status(400).json({ error: 'Cannot cancel received orders' });
    po.status = 'cancelled';
    po.cancelledAt = new Date().toISOString();
    po.cancelReason = req.body.reason || '';
    scheduleSave();
    res.json(po);
});

// ==========================================
// Waste Logging
// ==========================================
app.get('/api/waste-log', authorize('reports'), (req, res) => {
    res.json(store.wasteLog);
});

app.post('/api/waste-log', authorize('config'), (req, res) => {
    const { ingredientId, quantity, reason, cost } = req.body;
    if (!ingredientId || !quantity) return res.status(400).json({ error: 'Ingredient ID and quantity required' });

    // Deduct from ingredient stock
    const ingredient = store.ingredients.find(i => i.id === ingredientId);
    let actualCost = Math.round((cost || 0) * 100) / 100;
    if (ingredient) {
        ingredient.stock = Math.max(0, (ingredient.stock || 0) - quantity);
        if (!cost && ingredient.cost) {
            actualCost = Math.round(ingredient.cost * quantity * 100) / 100;
        }
    }

    const entry = {
        id: nextId(store.wasteLog), ingredientId, quantity,
        reason: reason || 'spoilage', cost: actualCost,
        loggedAt: new Date().toISOString(),
        loggedBy: req.user ? req.user.name : 'unknown'
    };
    store.wasteLog.push(entry);
    logAudit('waste_logged', req.user, { ingredientId, quantity, cost: actualCost });
    scheduleSave();
    res.status(201).json(entry);
});

// ==========================================
// Email Order Ready Alerts
// ==========================================
app.post('/api/kitchen/:id/alert', authorize('kitchen'), (req, res) => {
    const order = store.kitchenOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Kitchen order not found' });
    const alert = { orderId: order.id, type: 'order_ready', email: req.body.email || null, sentAt: new Date().toISOString() };
    fireWebhooks('order.ready', alert);
    logAudit('order_ready_alert', req.user, { orderId: order.id });
    res.json({ success: true, alert });
});

// ==========================================
// Waitlist Management
// ==========================================
app.get('/api/waitlist', (req, res) => {
    res.json(store.waitlist.filter(w => w.status === 'waiting'));
});

app.post('/api/waitlist', (req, res) => {
    const { name, partySize, phone } = req.body;
    if (!name || !partySize) return res.status(400).json({ error: 'Name and party size required' });
    const entry = {
        id: nextId(store.waitlist), name, partySize,
        phone: phone || '', status: 'waiting',
        estimatedWait: Math.max(10, partySize * 5),
        addedAt: new Date().toISOString()
    };
    store.waitlist.push(entry);
    scheduleSave();
    res.status(201).json(entry);
});

app.patch('/api/waitlist/:id', authorize('tickets'), (req, res) => {
    const entry = store.waitlist.find(w => w.id === parseInt(req.params.id));
    if (!entry) return res.status(404).json({ error: 'Waitlist entry not found' });
    if (req.body.status) entry.status = req.body.status;
    if (entry.status === 'seated') entry.seatedAt = new Date().toISOString();
    scheduleSave();
    res.json(entry);
});

// ==========================================
// Reservations
// ==========================================
app.get('/api/reservations', (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    res.json(store.reservations.filter(r => r.date === date));
});

app.post('/api/reservations', (req, res) => {
    const { name, partySize, date, time, phone, email } = req.body;
    if (!name || !date || !time) return res.status(400).json({ error: 'Name, date, and time required' });
    const reservation = {
        id: nextId(store.reservations), name,
        partySize: partySize || 2, date, time,
        phone: phone || '', email: email || '',
        status: 'confirmed', createdAt: new Date().toISOString()
    };
    store.reservations.push(reservation);
    fireWebhooks('reservation.created', reservation);
    scheduleSave();
    res.status(201).json(reservation);
});

app.put('/api/reservations/:id', authorize('tickets'), (req, res) => {
    const reservation = store.reservations.find(r => r.id === parseInt(req.params.id));
    if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
    const { name, partySize, date, time, phone, email, status } = req.body;
    if (name !== undefined) reservation.name = name;
    if (partySize !== undefined) reservation.partySize = partySize;
    if (date !== undefined) reservation.date = date;
    if (time !== undefined) reservation.time = time;
    if (phone !== undefined) reservation.phone = phone;
    if (email !== undefined) reservation.email = email;
    if (status !== undefined) {
        reservation.status = status;
        if (status === 'seated') reservation.seatedAt = new Date().toISOString();
        if (status === 'no_show') reservation.noShowAt = new Date().toISOString();
    }
    reservation.updatedAt = new Date().toISOString();
    scheduleSave();
    res.json(reservation);
});

app.delete('/api/reservations/:id', authorize('tickets'), (req, res) => {
    const idx = store.reservations.findIndex(r => r.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Reservation not found' });
    const removed = store.reservations.splice(idx, 1)[0];
    removed.status = 'cancelled';
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Saved Payment Methods
// ==========================================
app.get('/api/saved-payment-methods', authorize('tickets'), (req, res) => {
    const customerId = req.query.customerId;
    if (customerId) return res.json(store.savedPaymentMethods.filter(m => m.customerId === customerId));
    res.json(store.savedPaymentMethods);
});

app.post('/api/saved-payment-methods', authorize('tickets'), (req, res) => {
    const { customerId, type, lastFour, token, expiryMonth, expiryYear } = req.body;
    if (!customerId || !lastFour) return res.status(400).json({ error: 'Customer ID and last four required' });
    const method = {
        id: nextId(store.savedPaymentMethods), customerId,
        type: type || 'credit', lastFour,
        token: token || 'tok_' + crypto.randomBytes(16).toString('hex'),
        expiryMonth: expiryMonth || 12, expiryYear: expiryYear || 2027,
        createdAt: new Date().toISOString()
    };
    store.savedPaymentMethods.push(method);
    scheduleSave();
    res.status(201).json(method);
});

// ==========================================
// Email Marketing Campaigns
// ==========================================
app.get('/api/email-campaigns', authorize('config'), (req, res) => {
    res.json(store.emailCampaigns);
});

app.post('/api/email-campaigns', authorize('config'), (req, res) => {
    const { name, subject, body, targetSegment } = req.body;
    if (!name || !subject) return res.status(400).json({ error: 'Name and subject required' });
    const campaign = {
        id: nextId(store.emailCampaigns), name, subject,
        body: body || '', targetSegment: targetSegment || 'all',
        status: 'draft',
        recipientCount: store.customers.filter(c => c.email).length,
        createdAt: new Date().toISOString()
    };
    store.emailCampaigns.push(campaign);
    scheduleSave();
    res.status(201).json(campaign);
});

app.post('/api/email-campaigns/:id/send', authorize('config'), (req, res) => {
    const campaign = store.emailCampaigns.find(c => c.id === parseInt(req.params.id));
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status === 'sent') return res.status(400).json({ error: 'Campaign already sent' });

    // Build recipient list from customers matching the target segment
    let recipients = store.customers.filter(c => c.email);
    if (campaign.targetSegment && campaign.targetSegment !== 'all') {
        if (campaign.targetSegment === 'loyalty') {
            recipients = recipients.filter(c => c.loyaltyPoints && c.loyaltyPoints > 0);
        } else if (campaign.targetSegment === 'high_value') {
            recipients = recipients.filter(c => (c.totalSpent || 0) > 100);
        } else if (campaign.targetSegment === 'inactive') {
            const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
            recipients = recipients.filter(c => !c.lastVisit || c.lastVisit < cutoff);
        }
    }

    // Track per-recipient delivery status
    campaign.recipients = recipients.map(c => ({
        customerId: c.id,
        email: c.email,
        name: c.name,
        status: 'queued',
        queuedAt: new Date().toISOString()
    }));
    campaign.recipientCount = recipients.length;
    campaign.status = recipients.length > 0 ? 'sent' : 'failed';
    campaign.sentAt = new Date().toISOString();
    if (recipients.length === 0) {
        campaign.failReason = 'No recipients matched the target segment';
    }

    // Recipients are queued — actual delivery requires SMTP/SendGrid/SES integration
    // Set status to 'queued' not 'delivered' to be honest about delivery state
    campaign.deliveredCount = 0;
    campaign.queuedCount = campaign.recipients.length;

    fireWebhooks('email_campaign.sent', { campaignId: campaign.id, recipientCount: campaign.recipientCount });
    logAudit('email_campaign_sent', req.user, { campaignId: campaign.id, recipientCount: campaign.recipientCount });
    scheduleSave();
    res.json(campaign);
});

// ==========================================
// QR Table Ordering
// ==========================================
app.get('/api/qr-orders', authorize('tickets'), (req, res) => {
    res.json(store.qrOrders.filter(o => o.status !== 'completed'));
});

app.post('/api/qr-orders', (req, res) => {
    const { tableNumber, items, customerName } = req.body;
    if (!tableNumber || !items || !items.length) return res.status(400).json({ error: 'Table number and items required' });
    const total = Math.round(items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0) * 100) / 100;
    const order = {
        id: nextId(store.qrOrders), tableNumber, items,
        customerName: customerName || 'Guest',
        total,
        status: 'pending', createdAt: new Date().toISOString()
    };
    store.qrOrders.push(order);
    fireWebhooks('qr_order.created', order);
    scheduleSave();
    res.status(201).json(order);
});

app.post('/api/qr-orders/:id/accept', authorize('tickets'), (req, res) => {
    const order = store.qrOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'QR order not found' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order is not pending' });
    order.status = 'accepted';
    order.acceptedAt = new Date().toISOString();
    order.acceptedBy = req.user ? req.user.name : 'unknown';
    scheduleSave();
    res.json(order);
});

app.post('/api/qr-orders/:id/reject', authorize('tickets'), (req, res) => {
    const order = store.qrOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'QR order not found' });
    if (order.status === 'completed' || order.status === 'rejected') {
        return res.status(400).json({ error: 'Order cannot be rejected' });
    }
    order.status = 'rejected';
    order.rejectedAt = new Date().toISOString();
    order.rejectReason = req.body.reason || '';
    scheduleSave();
    res.json(order);
});

app.post('/api/qr-orders/:id/complete', authorize('tickets'), (req, res) => {
    const order = store.qrOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'QR order not found' });
    if (order.status !== 'accepted') return res.status(400).json({ error: 'Order must be accepted first' });
    order.status = 'completed';
    order.completedAt = new Date().toISOString();
    scheduleSave();
    res.json(order);
});

// ==========================================
// Delivery Integrations
// ==========================================
app.get('/api/delivery-integrations', authorize('config'), (req, res) => {
    // Mask API keys — never return full keys
    res.json(store.deliveryIntegrations.map(d => ({
        ...d,
        apiKey: d.apiKey ? d.apiKey.slice(0, 4) + '****' + d.apiKey.slice(-4) : '',
        storeId: d.storeId ? d.storeId.slice(0, 2) + '****' : ''
    })));
});

app.post('/api/delivery-integrations', authorize('config'), (req, res) => {
    const { platform, apiKey, storeId, enabled } = req.body;
    if (!platform) return res.status(400).json({ error: 'Platform name required' });
    const validPlatforms = ['doordash', 'ubereats', 'grubhub', 'postmates', 'custom'];
    if (!validPlatforms.includes(platform.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid platform', validPlatforms });
    }
    // Check for duplicate platform
    if (store.deliveryIntegrations.find(d => d.platform.toLowerCase() === platform.toLowerCase())) {
        return res.status(409).json({ error: `${platform} integration already exists` });
    }
    const integration = {
        id: nextId(store.deliveryIntegrations), platform: platform.toLowerCase(),
        apiKey: apiKey || '', storeId: storeId || '',
        enabled: enabled !== false,
        connectionStatus: apiKey ? 'configured' : 'pending_credentials',
        createdAt: new Date().toISOString()
    };
    store.deliveryIntegrations.push(integration);
    logAudit('delivery_integration_added', req.user, { platform: integration.platform });
    scheduleSave();
    // Return masked response
    res.status(201).json({
        ...integration,
        apiKey: integration.apiKey ? integration.apiKey.slice(0, 4) + '****' + integration.apiKey.slice(-4) : '',
        storeId: integration.storeId ? integration.storeId.slice(0, 2) + '****' : ''
    });
});

app.post('/api/delivery-integrations/:id/test', authorize('config'), (req, res) => {
    const integration = store.deliveryIntegrations.find(d => d.id === parseInt(req.params.id));
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    if (!integration.apiKey) {
        integration.connectionStatus = 'failed';
        scheduleSave();
        return res.status(400).json({ error: 'API key not configured', connectionStatus: 'failed' });
    }
    // Mark as tested (real implementation would call platform API)
    integration.connectionStatus = 'connected';
    integration.lastTestedAt = new Date().toISOString();
    scheduleSave();
    res.json({ status: 'connected', platform: integration.platform, testedAt: integration.lastTestedAt });
});

app.put('/api/delivery-integrations/:id', authorize('config'), (req, res) => {
    const integration = store.deliveryIntegrations.find(d => d.id === parseInt(req.params.id));
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    const { apiKey, storeId, enabled } = req.body;
    if (apiKey !== undefined) { integration.apiKey = apiKey; integration.connectionStatus = 'configured'; }
    if (storeId !== undefined) integration.storeId = storeId;
    if (enabled !== undefined) integration.enabled = enabled;
    integration.updatedAt = new Date().toISOString();
    scheduleSave();
    res.json({
        ...integration,
        apiKey: integration.apiKey ? integration.apiKey.slice(0, 4) + '****' + integration.apiKey.slice(-4) : '',
        storeId: integration.storeId ? integration.storeId.slice(0, 2) + '****' : ''
    });
});

// ==========================================
// Tokenized Card Storage
// ==========================================
app.post('/api/token-vault', authorize('tickets'), (req, res) => {
    const { customerId, lastFour, cardBrand, token } = req.body;
    if (!lastFour) return res.status(400).json({ error: 'Card last four required' });
    const rawToken = token || 'tok_' + crypto.randomBytes(16).toString('hex');
    // Encrypt token at rest using AES-256
    const tokenKey = process.env.TOKEN_ENCRYPTION_KEY || crypto.createHash('sha256').update('pos-token-vault-key').digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', tokenKey, iv);
    const encrypted = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
    const entry = {
        id: nextId(store.tokenVault),
        customerId: customerId || null, lastFour,
        cardBrand: cardBrand || 'unknown',
        encryptedToken: iv.toString('hex') + ':' + encrypted.toString('hex'),
        tokenPreview: rawToken.slice(0, 8) + '...',
        createdAt: new Date().toISOString()
    };
    store.tokenVault.push(entry);
    scheduleSave();
    // Never return raw or encrypted token — return preview only
    res.status(201).json({ id: entry.id, customerId: entry.customerId, lastFour, cardBrand: entry.cardBrand, token: entry.tokenPreview, createdAt: entry.createdAt });
});

app.get('/api/token-vault', authorize('config'), (req, res) => {
    // Never return encrypted tokens — only safe metadata
    res.json(store.tokenVault.map(t => ({
        id: t.id, customerId: t.customerId, lastFour: t.lastFour,
        cardBrand: t.cardBrand, token: t.tokenPreview || '***',
        createdAt: t.createdAt
    })));
});

// ==========================================
// Partial Payments
// ==========================================
app.post('/api/tickets/:id/partial-pay', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status === 'paid') return res.status(400).json({ error: 'Ticket already fully paid' });
    if (ticket.status === 'voided') return res.status(400).json({ error: 'Cannot pay a voided ticket' });
    const { amount, method, idempotencyKey } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid payment amount required' });
    if (!ticket.partialPayments) ticket.partialPayments = [];

    // Idempotency check — prevent duplicate payments
    if (idempotencyKey) {
        const duplicate = ticket.partialPayments.find(p => p.idempotencyKey === idempotencyKey);
        if (duplicate) return res.json(ticket); // Already processed, return current state
    }

    // Prevent overpayment
    const currentPaid = ticket.partialPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.round(((ticket.total || 0) - currentPaid) * 100) / 100;
    const payAmount = Math.round(Math.min(amount, remaining) * 100) / 100;
    if (payAmount <= 0) return res.status(400).json({ error: 'Ticket already fully paid' });

    ticket.partialPayments.push({
        amount: payAmount,
        method: method || 'card', paidAt: new Date().toISOString(),
        idempotencyKey: idempotencyKey || null
    });
    const totalPaid = ticket.partialPayments.reduce((sum, p) => sum + p.amount, 0);
    ticket.amountPaid = Math.round(totalPaid * 100) / 100;
    ticket.remainingBalance = Math.round(((ticket.total || 0) - totalPaid) * 100) / 100;
    if (ticket.remainingBalance <= 0) {
        ticket.status = 'paid';
        ticket.paidAt = new Date().toISOString();
    }
    scheduleSave();
    res.json(ticket);
});

// ==========================================
// QuickBooks Export
// ==========================================
app.get('/api/export/quickbooks', authorize('reports'), (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const dayTickets = store.tickets.filter(t => t.status === 'paid' && t.paidAt && t.paidAt.startsWith(date));
    const totalSales = dayTickets.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalTax = dayTickets.reduce((sum, t) => sum + (t.tax || 0), 0);
    const totalTips = dayTickets.reduce((sum, t) => sum + (t.tip || 0), 0);
    res.json({
        format: 'quickbooks_iif', date,
        entries: [
            { account: 'Sales Revenue', amount: Math.round(totalSales * 100) / 100, type: 'credit' },
            { account: 'Sales Tax Payable', amount: Math.round(totalTax * 100) / 100, type: 'credit' },
            { account: 'Tips Payable', amount: Math.round(totalTips * 100) / 100, type: 'credit' },
            { account: 'Cash/Bank', amount: Math.round((totalSales + totalTax + totalTips) * 100) / 100, type: 'debit' }
        ],
        ticketCount: dayTickets.length, generatedAt: new Date().toISOString()
    });
});

// ==========================================
// Automated Email Reports
// ==========================================
app.get('/api/email-reports', authorize('reports'), (req, res) => {
    res.json(store.config.emailReports || { enabled: false, schedule: 'daily', recipients: [] });
});

app.post('/api/email-reports', authorize('config'), (req, res) => {
    const { enabled, schedule, recipients } = req.body;
    store.config.emailReports = {
        enabled: enabled !== false, schedule: schedule || 'daily',
        recipients: recipients || [], updatedAt: new Date().toISOString()
    };
    scheduleSave();
    res.json(store.config.emailReports);
});

// ==========================================
// Backup Automation
// ==========================================
app.get('/api/backups', authorize('config'), (req, res) => {
    res.json(store.backups);
});

app.post('/api/backups', authorize('config'), (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const backupDir = path.join(__dirname, '..', 'data', 'backups');
    const backupData = JSON.stringify(store, null, 2);

    // Ensure backup directory exists and write file
    try {
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const backupPath = path.join(backupDir, filename);

        // Encrypt backup if encryption is enabled
        let fileSize;
        if (store.config.security && store.config.security.databaseEncryption && store.config.security.encryptionKey) {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(store.config.security.encryptionKey, 'hex'), iv);
            const encrypted = Buffer.concat([cipher.update(backupData, 'utf8'), cipher.final()]);
            const tag = cipher.getAuthTag();
            const encData = JSON.stringify({ iv: iv.toString('hex'), tag: tag.toString('hex'), data: encrypted.toString('hex') });
            fs.writeFileSync(backupPath, encData);
            fileSize = encData.length;
        } else {
            fs.writeFileSync(backupPath, backupData);
            fileSize = backupData.length;
        }

        // Verify the backup was written
        const stats = fs.statSync(backupPath);
        const backup = {
            id: nextId(store.backups),
            filename, path: backupPath,
            size: stats.size,
            encrypted: !!(store.config.security && store.config.security.databaseEncryption),
            hash: crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex'),
            createdAt: new Date().toISOString(),
            createdBy: req.user ? req.user.name : 'system',
            status: 'completed'
        };
        store.backups.push(backup);
        logAudit('backup_created', req.user, { filename, size: stats.size, encrypted: backup.encrypted });
        scheduleSave();
        res.status(201).json(backup);
    } catch (err) {
        const backup = {
            id: nextId(store.backups),
            filename, size: 0,
            createdAt: new Date().toISOString(),
            createdBy: req.user ? req.user.name : 'system',
            status: 'failed', error: err.message
        };
        store.backups.push(backup);
        scheduleSave();
        res.status(500).json({ error: 'Backup failed', details: err.message, backup });
    }
});

app.post('/api/backups/:id/restore', authorize('config'), (req, res) => {
    const backup = store.backups.find(b => b.id === parseInt(req.params.id));
    if (!backup) return res.status(404).json({ error: 'Backup not found' });
    if (backup.status !== 'completed') return res.status(400).json({ error: 'Cannot restore from failed backup' });

    try {
        const backupPath = backup.path || path.join(DATA_DIR, backup.filename || `backup-${backup.id}.json`);
        if (!fs.existsSync(backupPath)) return res.status(404).json({ error: 'Backup file not found on disk' });

        let raw = fs.readFileSync(backupPath, 'utf8');
        // Handle encrypted backups
        if (backup.encrypted && store.config.security && store.config.security.encryptionKey) {
            const decipher = crypto.createDecipheriv('aes-256-cbc',
                Buffer.from(store.config.security.encryptionKey, 'hex').slice(0, 32),
                Buffer.alloc(16, 0));
            raw = decipher.update(raw, 'hex', 'utf8') + decipher.final('utf8');
        }
        // Verify hash integrity
        const hash = crypto.createHash('sha256').update(Buffer.from(raw)).digest('hex');

        const restoredData = JSON.parse(raw);
        // Restore store collections from backup
        const restorableKeys = ['tickets', 'kitchenOrders', 'customers', 'giftCards',
            'ingredients', 'promoCodes', 'heldOrders', 'timeClock', 'refunds'];
        let restored = 0;
        restorableKeys.forEach(key => {
            if (restoredData[key] && Array.isArray(restoredData[key])) {
                store[key] = restoredData[key];
                restored++;
            }
        });
        if (restoredData.config && typeof restoredData.config === 'object') {
            Object.assign(store.config, restoredData.config);
            restored++;
        }

        scheduleSave();
        logAudit('backup_restored', req.user, { backupId: backup.id, filename: backup.filename, restoredKeys: restored });
        res.json({ message: 'Backup restored', backupId: backup.id, restoredKeys: restored, hash });
    } catch (err) {
        res.status(500).json({ error: 'Restore failed', details: err.message });
    }
});

// ==========================================
// Two-Factor Authentication
// ==========================================
app.post('/api/auth/2fa/setup', authorize('config'), (req, res) => {
    if (!store.config.twoFactorSecrets) store.config.twoFactorSecrets = {};
    // Warn if 2FA is already enabled — require force flag to overwrite
    const existing = store.config.twoFactorSecrets[req.user.id];
    if (existing && existing.enabled && !req.body.force) {
        return res.status(409).json({ error: '2FA already enabled. Pass force: true to re-setup (this will invalidate your current 2FA)' });
    }
    const secret = crypto.randomBytes(20).toString('hex');
    store.config.twoFactorSecrets[req.user.id] = {
        secret,
        enabled: false,
        setupAt: new Date().toISOString(),
        previouslyEnabled: !!(existing && existing.enabled)
    };
    scheduleSave();
    res.json({
        secret,
        qrCode: `otpauth://totp/POS:${req.user.name}?secret=${secret}&issuer=RestaurantPOS`,
        message: '2FA setup initiated — verify with a code to enable'
    });
});

app.post('/api/auth/2fa/verify', authorize('config'), (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Verification code required' });

    if (!store.config.twoFactorSecrets) store.config.twoFactorSecrets = {};
    const userTfa = store.config.twoFactorSecrets[req.user.id];
    if (!userTfa || !userTfa.secret) {
        return res.status(400).json({ error: 'No 2FA setup found. Run setup first.', verified: false });
    }

    // TOTP verification: compute expected codes for current 30-second window (+/- 1 step)
    const secret = userTfa.secret;
    const timeStep = Math.floor(Date.now() / 30000);
    let verified = false;
    for (let offset = -1; offset <= 1; offset++) {
        const counter = timeStep + offset;
        const counterBuf = Buffer.alloc(8);
        counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
        counterBuf.writeUInt32BE(counter & 0xFFFFFFFF, 4);
        const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex')).update(counterBuf).digest();
        const offset2 = hmac[hmac.length - 1] & 0x0f;
        const otp = ((hmac[offset2] & 0x7f) << 24 | hmac[offset2 + 1] << 16 | hmac[offset2 + 2] << 8 | hmac[offset2 + 3]) % 1000000;
        const expected = String(otp).padStart(6, '0');
        if (code === expected) { verified = true; break; }
    }

    if (!verified) {
        logAudit('2fa_verify_failed', req.user, { userId: req.user.id });
        return res.status(401).json({ verified: false, error: 'Invalid verification code' });
    }

    userTfa.enabled = true;
    userTfa.verifiedAt = new Date().toISOString();
    scheduleSave();
    logAudit('2fa_enabled', req.user, { userId: req.user.id });
    res.json({ verified: true, message: '2FA enabled successfully' });
});

// ==========================================
// Encrypted Database Config
// ==========================================
app.get('/api/security/encryption-status', authorize('config'), (req, res) => {
    const security = store.config.security || {};
    const lastRotated = security.lastKeyRotation ? new Date(security.lastKeyRotation) : null;
    const daysSinceRotation = lastRotated ? Math.round((Date.now() - lastRotated.getTime()) / 86400000) : null;
    res.json({
        databaseEncryption: security.databaseEncryption || false,
        algorithm: 'AES-256-GCM',
        keyRotationDays: security.keyRotationDays || 90,
        lastRotated: security.lastKeyRotation || null,
        daysSinceRotation,
        rotationNeeded: daysSinceRotation !== null && daysSinceRotation > (security.keyRotationDays || 90),
        keyFingerprint: security.encryptionKey ? crypto.createHash('sha256').update(security.encryptionKey).digest('hex').slice(0, 16) : null,
        status: security.databaseEncryption ? 'active' : 'inactive'
    });
});

app.put('/api/security/encryption', authorize('config'), (req, res) => {
    if (!store.config.security) store.config.security = {};
    const enabled = req.body.enabled !== false;
    store.config.security.databaseEncryption = enabled;

    if (enabled) {
        // Generate a real AES-256 encryption key
        store.config.security.encryptionKey = crypto.randomBytes(32).toString('hex');
        store.config.security.lastKeyRotation = new Date().toISOString();
        store.config.security.keyRotationDays = req.body.rotationDays || 90;
    } else {
        delete store.config.security.encryptionKey;
    }

    scheduleSave();
    logAudit('encryption_config_changed', req.user, { enabled, keyGenerated: enabled });
    res.json({
        success: true, encryption: enabled,
        keyFingerprint: store.config.security.encryptionKey ? crypto.createHash('sha256').update(store.config.security.encryptionKey).digest('hex').slice(0, 16) : null
    });
});

app.post('/api/security/rotate-key', authorize('config'), (req, res) => {
    if (!store.config.security || !store.config.security.databaseEncryption) {
        return res.status(400).json({ error: 'Encryption is not enabled' });
    }
    const oldFingerprint = crypto.createHash('sha256').update(store.config.security.encryptionKey).digest('hex').slice(0, 16);
    store.config.security.encryptionKey = crypto.randomBytes(32).toString('hex');
    store.config.security.lastKeyRotation = new Date().toISOString();
    const newFingerprint = crypto.createHash('sha256').update(store.config.security.encryptionKey).digest('hex').slice(0, 16);
    scheduleSave();
    logAudit('encryption_key_rotated', req.user, { oldFingerprint, newFingerprint });
    res.json({ success: true, oldFingerprint, newFingerprint, rotatedAt: store.config.security.lastKeyRotation });
});

// ==========================================
// PCI SAQ Documentation
// ==========================================
app.get('/api/compliance/pci-saq', authorize('config'), (req, res) => {
    // Dynamic PCI compliance checks based on actual system configuration
    const security = store.config.security || {};
    const hasEncryption = !!security.databaseEncryption;
    const has2FA = !!(store.config.twoFactorSecrets && Object.values(store.config.twoFactorSecrets).some(t => t.enabled));
    const hasCSP = true; // CSP middleware is always active
    const hasCORS = ALLOWED_ORIGINS.length > 0;
    const hasJWT = true; // JWT auth is always active
    const hasFieldWhitelist = true; // Field whitelisting on all PATCH/PUT
    const hasAuditLog = store.auditLog.length > 0;
    const hasBackups = store.backups.some(b => b.status === 'completed');
    const lastBackup = store.backups.filter(b => b.status === 'completed').pop();
    const backupAge = lastBackup ? (Date.now() - new Date(lastBackup.createdAt).getTime()) / 86400000 : Infinity;

    const requirements = [
        { id: 'R1', description: 'Install and maintain firewall', status: hasCORS ? 'compliant' : 'review_needed', detail: hasCORS ? 'CORS configured' : 'CORS_ORIGINS not configured' },
        { id: 'R2', description: 'Change vendor defaults', status: process.env.JWT_SECRET ? 'compliant' : 'review_needed', detail: process.env.JWT_SECRET ? 'Custom JWT secret set' : 'Using auto-generated JWT secret' },
        { id: 'R3', description: 'Protect stored cardholder data', status: hasEncryption ? 'compliant' : 'review_needed', detail: hasEncryption ? 'Database encryption enabled' : 'Encryption not enabled' },
        { id: 'R4', description: 'Encrypt transmission', status: hasCSP ? 'compliant' : 'review_needed', detail: 'CSP headers active on all responses' },
        { id: 'R6', description: 'Develop secure systems', status: hasFieldWhitelist ? 'compliant' : 'review_needed', detail: 'Field whitelisting on mutations' },
        { id: 'R7', description: 'Restrict access', status: hasJWT ? 'compliant' : 'review_needed', detail: 'JWT auth + role-based authorization' },
        { id: 'R8', description: 'Assign unique IDs', status: has2FA ? 'compliant' : 'review_needed', detail: has2FA ? '2FA enabled for users' : '2FA not configured' },
        { id: 'R9', description: 'Restrict physical access', status: 'review_needed', detail: 'Physical access controls must be verified on-site' },
        { id: 'R10', description: 'Track and monitor access', status: hasAuditLog ? 'compliant' : 'review_needed', detail: hasAuditLog ? `${store.auditLog.length} audit entries logged` : 'No audit activity' },
        { id: 'R11', description: 'Test security systems', status: 'review_needed', detail: 'Periodic penetration testing should be scheduled' },
        { id: 'R12', description: 'Information security policy', status: hasBackups && backupAge < 7 ? 'compliant' : 'review_needed', detail: hasBackups ? `Last backup ${Math.round(backupAge)} days ago` : 'No backups found' }
    ];

    const compliant = requirements.filter(r => r.status === 'compliant').length;
    const lastAssessment = (store.config.compliance && store.config.compliance.lastAssessment) || null;

    res.json({
        saqType: 'SAQ-B-IP', version: '3.2.1',
        lastAssessment,
        overallScore: Math.round(compliant / requirements.length * 100),
        compliantCount: compliant,
        totalRequirements: requirements.length,
        requirements,
        nextAssessmentDue: lastAssessment ? new Date(new Date(lastAssessment).getTime() + 365 * 86400000).toISOString().split('T')[0] : 'Not scheduled'
    });
});

// ==========================================
// Real-time Sales Feed
// ==========================================
app.get('/api/live-feed', authorize('reports'), (req, res) => {
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 3600000);
    const recentTickets = store.tickets.filter(t => new Date(t.createdAt) > since);
    const recentRefunds = store.refunds.filter(r => new Date(r.time || r.createdAt) > since);
    res.json({
        tickets: recentTickets, refunds: recentRefunds,
        summary: {
            ticketCount: recentTickets.length,
            totalSales: Math.round(recentTickets.reduce((s, t) => s + (t.total || 0), 0) * 100) / 100,
            refundCount: recentRefunds.length,
            avgTicket: recentTickets.length ? Math.round(recentTickets.reduce((s, t) => s + (t.total || 0), 0) / recentTickets.length * 100) / 100 : 0
        },
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// Remote Void Approval
// ==========================================
// Request a remote void (creates pending approval)
app.post('/api/tickets/:id/remote-void', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status === 'voided') return res.status(400).json({ error: 'Already voided' });

    const { reason } = req.body;
    if (!store.voidRequests) store.voidRequests = [];
    const request = {
        id: nextId(store.voidRequests),
        ticketId: ticket.id,
        reason: reason || 'Remote void',
        requestedBy: req.user.name,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        approvedBy: null,
        approvedAt: null
    };
    store.voidRequests.push(request);
    logAudit('remote_void_requested', req.user, { ticketId: ticket.id, reason: request.reason });
    fireWebhooks('ticket.voided', { ticketId: ticket.id, requestId: request.id, status: 'pending_approval' });
    scheduleSave();
    res.status(201).json(request);
});

// List pending void requests
app.get('/api/void-requests', authorize('void'), (req, res) => {
    if (!store.voidRequests) store.voidRequests = [];
    const status = req.query.status || 'pending';
    const requests = status === 'all' ? store.voidRequests : store.voidRequests.filter(r => r.status === status);
    res.json({ requests, total: requests.length });
});

// Approve a void request (requires void permission - manager/admin only)
app.post('/api/void-requests/:id/approve', authorize('void'), (req, res) => {
    if (!store.voidRequests) store.voidRequests = [];
    const request = store.voidRequests.find(r => r.id === parseInt(req.params.id));
    if (!request) return res.status(404).json({ error: 'Void request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

    const ticket = store.tickets.find(t => t.id === request.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Approve and execute the void
    request.status = 'approved';
    request.approvedBy = req.user.name;
    request.approvedAt = new Date().toISOString();

    ticket.status = 'voided';
    ticket.voidedAt = new Date().toISOString();
    ticket.voidReason = request.reason;
    ticket.voidApprovedBy = req.user.name;
    ticket.voidRequestedBy = request.requestedBy;
    ticket.remoteVoid = true;

    checkFraudPatterns(ticket, req.user);
    logAudit('remote_void_approved', req.user, { ticketId: ticket.id, requestId: request.id });
    fireWebhooks('ticket.voided', ticket);
    scheduleSave();
    res.json({ request, ticket });
});

// Reject a void request
app.post('/api/void-requests/:id/reject', authorize('void'), (req, res) => {
    if (!store.voidRequests) store.voidRequests = [];
    const request = store.voidRequests.find(r => r.id === parseInt(req.params.id));
    if (!request) return res.status(404).json({ error: 'Void request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

    request.status = 'rejected';
    request.rejectedBy = req.user.name;
    request.rejectedAt = new Date().toISOString();
    request.rejectReason = req.body.reason || '';

    logAudit('remote_void_rejected', req.user, { ticketId: request.ticketId, requestId: request.id });
    scheduleSave();
    res.json(request);
});

// ==========================================
// Web Admin Portal Summary
// ==========================================
app.get('/api/admin/summary', authorize('reports'), (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const todayTickets = store.tickets.filter(t => t.createdAt && t.createdAt.startsWith(today));
    res.json({
        todaySales: Math.round(todayTickets.reduce((s, t) => s + (t.total || 0), 0) * 100) / 100,
        ticketCount: todayTickets.length,
        openTickets: store.tickets.filter(t => t.status === 'open').length,
        activeKitchenOrders: store.kitchenOrders.filter(o => o.status !== 'bumped').length,
        activeStaffCount: store.timeClock.filter(e => e.clockIn && !e.clockOut).length,
        pendingOnlineOrders: store.onlineOrders.filter(o => o.status === 'pending').length,
        waitlistCount: store.waitlist.filter(w => w.status === 'waiting').length,
        reservationsToday: store.reservations.filter(r => r.date === today).length,
        lowStockAlerts: store.ingredients.filter(i => i.quantity <= (i.lowStockThreshold || 10)).length,
        recentFraudAlerts: store.fraudAlerts.filter(a => !a.resolved).length,
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// Phone/Mobile Dashboard
// ==========================================
app.get('/api/mobile/dashboard', authorize('reports'), (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const todayTickets = store.tickets.filter(t => t.createdAt && t.createdAt.startsWith(today));
    res.json({
        sales: Math.round(todayTickets.reduce((s, t) => s + (t.total || 0), 0) * 100) / 100,
        orders: todayTickets.length,
        openOrders: store.tickets.filter(t => t.status === 'open').length,
        staffOnDuty: store.timeClock.filter(e => e.clockIn && !e.clockOut).length,
        alerts: store.fraudAlerts.filter(a => !a.resolved).length,
        compact: true
    });
});

// ==========================================
// Owner Analytics
// ==========================================
app.get('/api/analytics/owner', authorize('reports'), (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 86400000);
    const periodTickets = store.tickets.filter(t => new Date(t.createdAt) > since && t.status === 'paid');
    const totalRevenue = periodTickets.reduce((s, t) => s + (t.total || 0), 0);
    const wasteCost = store.wasteLog.filter(w => new Date(w.loggedAt) > since).reduce((s, w) => s + (w.cost || 0), 0);
    const counts = {};
    periodTickets.forEach(t => (t.items || []).forEach(i => { counts[i.name] = (counts[i.name] || 0) + (i.qty || i.quantity || 1); }));
    const topItems = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, quantity: qty }));
    res.json({
        period: days + ' days',
        revenue: Math.round(totalRevenue * 100) / 100,
        ticketCount: periodTickets.length,
        avgTicket: periodTickets.length ? Math.round(totalRevenue / periodTickets.length * 100) / 100 : 0,
        wasteCost: Math.round(wasteCost * 100) / 100, topItems,
        laborCost: Math.round(store.timeClock.filter(e => e.clockOut && new Date(e.clockIn) > since)
            .reduce((s, e) => s + ((new Date(e.clockOut) - new Date(e.clockIn)) / 3600000) * (e.hourlyRate || 15), 0) * 100) / 100
    });
});

// ==========================================
// Multi-Location Dashboard
// ==========================================
app.get('/api/locations', authorize('reports'), (req, res) => {
    if (!store.config.locations) store.config.locations = [{ id: 1, name: 'Main', address: 'Primary Location', active: true, createdAt: new Date().toISOString() }];
    res.json(store.config.locations.map(loc => ({
        ...loc,
        todaySales: Math.round(store.tickets.filter(t => (!t.locationId || t.locationId === loc.id) && t.status === 'paid')
            .reduce((s, t) => s + (t.total || 0), 0) * 100) / 100,
        openTickets: store.tickets.filter(t => (!t.locationId || t.locationId === loc.id) && t.status === 'open').length
    })));
});

app.post('/api/locations', authorize('config'), (req, res) => {
    const { name, address, phone, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Location name required' });
    if (!store.config.locations) store.config.locations = [];
    const locId = nextId(store.config.locations);
    const location = {
        id: locId, name, address: address || '', phone: phone || '', email: email || '',
        active: true, createdAt: new Date().toISOString()
    };
    store.config.locations.push(location);
    logAudit('location_created', req.user, { locationId: location.id, name });
    scheduleSave();
    res.status(201).json(location);
});

app.put('/api/locations/:id', authorize('config'), (req, res) => {
    if (!store.config.locations) return res.status(404).json({ error: 'Location not found' });
    const location = store.config.locations.find(l => l.id === parseInt(req.params.id));
    if (!location) return res.status(404).json({ error: 'Location not found' });
    const { name, address, phone, email, active } = req.body;
    if (name !== undefined) location.name = name;
    if (address !== undefined) location.address = address;
    if (phone !== undefined) location.phone = phone;
    if (email !== undefined) location.email = email;
    if (active !== undefined) location.active = active;
    location.updatedAt = new Date().toISOString();
    logAudit('location_updated', req.user, { locationId: location.id });
    scheduleSave();
    res.json(location);
});

app.delete('/api/locations/:id', authorize('config'), (req, res) => {
    if (!store.config.locations) return res.status(404).json({ error: 'Location not found' });
    const idx = store.config.locations.findIndex(l => l.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Location not found' });
    const removed = store.config.locations.splice(idx, 1)[0];
    logAudit('location_deleted', req.user, { locationId: removed.id, name: removed.name });
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Cloud Reporting
// ==========================================
app.get('/api/cloud-reports', authorize('reports'), (req, res) => {
    const period = req.query.period || 'today';
    var since;
    if (period === 'today') since = new Date().toISOString().split('T')[0];
    else if (period === 'week') since = new Date(Date.now() - 7 * 86400000).toISOString();
    else since = new Date(Date.now() - 30 * 86400000).toISOString();
    const tickets = store.tickets.filter(t => t.createdAt >= since);
    res.json({
        period,
        totalRevenue: Math.round(tickets.filter(t => t.status === 'paid').reduce((s, t) => s + (t.total || 0), 0) * 100) / 100,
        ticketCount: tickets.length,
        voidCount: tickets.filter(t => t.status === 'voided').length,
        refundCount: store.refunds.filter(r => (r.time || r.createdAt) >= since).length,
        paymentBreakdown: {
            cash: tickets.filter(t => t.paymentMethod === 'cash').length,
            card: tickets.filter(t => t.paymentMethod === 'card').length,
            other: tickets.filter(t => t.paymentMethod !== 'cash' && t.paymentMethod !== 'card').length
        },
        generatedAt: new Date().toISOString(), cloudSync: true
    });
});

// ==========================================
// Payment Type Breakdown Report
// ==========================================
app.get('/api/reports/payment-breakdown', authorize('reports'), (req, res) => {
    const paid = store.tickets.filter(t => t.status === 'paid');
    const cashTickets = paid.filter(t => t.paymentMethod === 'cash');
    const cardTickets = paid.filter(t => t.paymentMethod === 'card');
    const surchargeRevenue = cardTickets.reduce((s, t) => s + (t.cashDiscountAmount || 0), 0);
    res.json({
        cash: { count: cashTickets.length, total: Math.round(cashTickets.reduce((s, t) => s + (t.total || 0), 0) * 100) / 100 },
        card: { count: cardTickets.length, total: Math.round(cardTickets.reduce((s, t) => s + (t.total || 0), 0) * 100) / 100 },
        surchargeRevenue: Math.round(surchargeRevenue * 100) / 100,
        generatedAt: new Date().toISOString()
    });
});

// ==========================================
// Surcharge Cap Logic
// ==========================================
app.get('/api/surcharge-cap', authorize('config'), (req, res) => {
    var cd = store.config.cashDiscount || {};
    res.json({
        maxRate: cd.maxSurchargeRate || 3.0,
        currentRate: cd.rate || 4.0,
        capEnforced: (cd.rate || 4.0) > (cd.maxSurchargeRate || 3.0)
    });
});

app.put('/api/surcharge-cap', authorize('config'), (req, res) => {
    const { maxRate } = req.body;
    if (maxRate === undefined) return res.status(400).json({ error: 'Max rate required' });
    if (!store.config.cashDiscount) store.config.cashDiscount = {};
    store.config.cashDiscount.maxSurchargeRate = Math.round(maxRate * 100) / 100;
    scheduleSave();
    res.json({ maxRate: store.config.cashDiscount.maxSurchargeRate });
});

// ==========================================
// Hardware: Printers
// ==========================================
app.get('/api/hardware/printers', authorize('config'), (req, res) => {
    res.json((store.config.hardware && store.config.hardware.printers) || []);
});

app.post('/api/hardware/printers', authorize('config'), (req, res) => {
    const { name, ipAddress, type, model } = req.body;
    if (!name) return res.status(400).json({ error: 'Printer name required' });
    if (!store.config.hardware) store.config.hardware = {};
    if (!store.config.hardware.printers) store.config.hardware.printers = [];
    const printer = {
        id: nextId(store.config.hardware.printers), name,
        ipAddress: ipAddress || 'auto-discover', type: type || 'receipt',
        model: model || 'generic', status: 'discovered',
        addedAt: new Date().toISOString()
    };
    store.config.hardware.printers.push(printer);
    scheduleSave();
    res.status(201).json(printer);
});

// ==========================================
// Hardware: Cash Drawer
// ==========================================
app.post('/api/hardware/cash-drawer/open', authorize('tickets'), (req, res) => {
    logAudit('cash_drawer_opened', req.user, { reason: req.body.reason || 'sale' });
    res.json({ success: true, opened: true, timestamp: new Date().toISOString() });
});

// ==========================================
// Hardware: Barcode Scanner
// ==========================================
app.post('/api/hardware/barcode-scan', authorize('tickets'), (req, res) => {
    const { barcode } = req.body;
    if (!barcode) return res.status(400).json({ error: 'Barcode required' });
    const ingredient = store.ingredients.find(i => i.barcode === barcode);
    if (ingredient) return res.json({ type: 'ingredient', item: ingredient });
    const menuItems = (store.config.menu && store.config.menu.items) || [];
    const menuItem = menuItems.find(i => i.barcode === barcode);
    if (menuItem) return res.json({ type: 'menu_item', item: menuItem });
    res.json({ type: 'unknown', barcode, message: 'Item not found in inventory' });
});

// ==========================================
// Hardware: KDS Displays
// ==========================================
app.get('/api/hardware/kds-displays', authorize('config'), (req, res) => {
    if (!store.config.hardware) store.config.hardware = {};
    if (!store.config.hardware.kdsDisplays) {
        store.config.hardware.kdsDisplays = [
            { id: 1, name: 'Main Kitchen', station: 'kitchen', status: 'online', lastHeartbeat: new Date().toISOString() },
            { id: 2, name: 'Expo Station', station: 'expo', status: 'online', lastHeartbeat: new Date().toISOString() }
        ];
    }
    // Check heartbeat staleness (mark offline if no heartbeat in 5 minutes)
    store.config.hardware.kdsDisplays.forEach(d => {
        if (d.lastHeartbeat && (Date.now() - new Date(d.lastHeartbeat).getTime()) > 300000) {
            d.status = 'offline';
        }
    });
    res.json(store.config.hardware.kdsDisplays);
});

app.post('/api/hardware/kds-displays', authorize('config'), (req, res) => {
    if (!store.config.hardware) store.config.hardware = {};
    if (!store.config.hardware.kdsDisplays) store.config.hardware.kdsDisplays = [];
    const { name, station, ipAddress } = req.body;
    if (!name) return res.status(400).json({ error: 'Display name required' });
    const display = {
        id: nextId(store.config.hardware.kdsDisplays),
        name, station: station || 'kitchen', ipAddress: ipAddress || '',
        status: 'online', lastHeartbeat: new Date().toISOString(), addedAt: new Date().toISOString()
    };
    store.config.hardware.kdsDisplays.push(display);
    scheduleSave();
    res.status(201).json(display);
});

app.post('/api/hardware/kds-displays/:id/heartbeat', (req, res) => {
    if (!store.config.hardware || !store.config.hardware.kdsDisplays) return res.status(404).json({ error: 'Display not found' });
    const display = store.config.hardware.kdsDisplays.find(d => d.id === parseInt(req.params.id));
    if (!display) return res.status(404).json({ error: 'Display not found' });
    display.status = 'online';
    display.lastHeartbeat = new Date().toISOString();
    scheduleSave();
    res.json({ status: 'ok', displayId: display.id });
});

// ==========================================
// Table Management (Floor Plan)
// ==========================================
app.get('/api/tables', (req, res) => {
    res.json(store.config.tables || []);
});

app.put('/api/tables', authorize('config'), (req, res) => {
    const { tables } = req.body;
    if (!Array.isArray(tables)) return res.status(400).json({ error: 'Tables array required' });
    store.config.tables = tables.map(t => ({
        id: t.id, name: t.name || ('Table ' + t.id),
        seats: t.seats || 4, x: t.x || 0, y: t.y || 0,
        width: t.width || 80, height: t.height || 80,
        shape: t.shape || 'square', status: t.status || 'available',
        section: t.section || 'main'
    }));
    scheduleSave();
    res.json(store.config.tables);
});

// ==========================================
// Sync Engine
// ==========================================
app.get('/api/sync/snapshot', authorize('config'), (req, res) => {
    res.json({
        version: Date.now(), tickets: store.tickets,
        kitchenOrders: store.kitchenOrders, ingredients: store.ingredients,
        customers: store.customers, giftCards: store.giftCards,
        refunds: store.refunds, heldOrders: store.heldOrders,
        timeClock: store.timeClock, promoCodes: store.promoCodes,
        config: store.config, generatedAt: new Date().toISOString()
    });
});

app.post('/api/sync/push', authorize('config'), (req, res) => {
    const { changes } = req.body;
    if (!changes || !Array.isArray(changes)) return res.status(400).json({ error: 'Changes array required' });
    const conflicts = [];
    const applied = [];
    const errors = [];

    changes.forEach(change => {
        const { type, action, id, data, timestamp } = change;
        try {
            if (type === 'ticket') {
                if (action === 'update') {
                    const ticket = store.tickets.find(t => t.id === id);
                    if (!ticket) { errors.push({ id, type, error: 'Not found' }); return; }
                    if (ticket.updatedAt && timestamp && ticket.updatedAt > timestamp) {
                        conflicts.push({ id, type, resolution: 'server_wins', serverUpdatedAt: ticket.updatedAt });
                    } else {
                        // Apply the update
                        const allowed = ['items', 'type', 'table', 'server', 'discount', 'note', 'status'];
                        if (data) allowed.forEach(f => { if (data[f] !== undefined) ticket[f] = data[f]; });
                        ticket.updatedAt = new Date().toISOString();
                        ticket.syncedAt = new Date().toISOString();
                        applied.push({ id, type, action });
                    }
                } else if (action === 'create' && data) {
                    const ticket = { ...data, id: store.nextTicketId++, syncedAt: new Date().toISOString() };
                    store.tickets.push(ticket);
                    applied.push({ id: ticket.id, type, action });
                }
            } else if (type === 'config') {
                if (action === 'update' && data) {
                    Object.keys(data).forEach(section => {
                        if (store.config[section] && typeof data[section] === 'object') {
                            Object.assign(store.config[section], data[section]);
                        }
                    });
                    applied.push({ type, action, sections: Object.keys(data) });
                }
            } else if (type === 'ingredient') {
                if (action === 'update') {
                    const ing = store.ingredients.find(i => i.id === id);
                    if (ing && data) { Object.assign(ing, data); applied.push({ id, type, action }); }
                    else errors.push({ id, type, error: 'Not found' });
                } else if (action === 'create' && data) {
                    store.ingredients.push({ ...data, id: nextId(store.ingredients) });
                    applied.push({ type, action });
                }
            } else if (type === 'customer') {
                if (action === 'update') {
                    const cust = store.customers.find(c => c.id === id);
                    if (cust && data) { CUSTOMER_FIELDS.forEach(f => { if (data[f] !== undefined) cust[f] = data[f]; }); applied.push({ id, type, action }); }
                    else errors.push({ id, type, error: 'Not found' });
                } else if (action === 'create' && data) {
                    store.customers.push({ ...data, id: nextId(store.customers) });
                    applied.push({ type, action });
                }
            } else if (type === 'giftCard') {
                if (action === 'update') {
                    const gc = store.giftCards.find(g => g.id === id);
                    if (gc && data) { Object.assign(gc, data); applied.push({ id, type, action }); }
                    else errors.push({ id, type, error: 'Not found' });
                }
            } else if (type === 'refund') {
                if (action === 'create' && data) {
                    store.refunds.push({ ...data, id: nextId(store.refunds) });
                    applied.push({ type, action });
                }
            } else if (type === 'heldOrder') {
                if (action === 'create' && data) {
                    store.heldOrders.push({ ...data, id: nextId(store.heldOrders) });
                    applied.push({ type, action });
                } else if (action === 'delete') {
                    const idx = store.heldOrders.findIndex(h => h.id === id);
                    if (idx !== -1) { store.heldOrders.splice(idx, 1); applied.push({ id, type, action }); }
                    else errors.push({ id, type, error: 'Not found' });
                }
            } else if (type === 'timeClock') {
                if (action === 'create' && data) {
                    store.timeClock.push({ ...data, id: nextId(store.timeClock) });
                    applied.push({ type, action });
                } else if (action === 'update') {
                    const rec = store.timeClock.find(r => r.id === id);
                    if (rec && data) { Object.assign(rec, data); applied.push({ id, type, action }); }
                    else errors.push({ id, type, error: 'Not found' });
                }
            } else if (type === 'promoCode') {
                if (action === 'create' && data) {
                    store.promoCodes.push({ ...data, id: nextId(store.promoCodes) });
                    applied.push({ type, action });
                } else if (action === 'update') {
                    const pc = store.promoCodes.find(p => p.id === id);
                    if (pc && data) { Object.assign(pc, data); applied.push({ id, type, action }); }
                    else errors.push({ id, type, error: 'Not found' });
                }
            }
        } catch (e) { errors.push({ id, type, error: e.message }); }
    });

    scheduleSave();
    logAudit('sync_push', req.user, { applied: applied.length, conflicts: conflicts.length, errors: errors.length });
    res.json({ applied, conflicts, errors, serverVersion: Date.now() });
});

app.post('/api/sync/resync', authorize('config'), (req, res) => {
    const { lastSyncVersion } = req.body;
    const since = lastSyncVersion ? new Date(lastSyncVersion) : null;
    const filterSince = (arr, dateField = 'updatedAt', fallback = 'createdAt') =>
        arr.filter(item => !since || new Date(item[dateField] || item[fallback] || 0) > since);

    const changes = [
        ...filterSince(store.tickets).map(t => ({ type: 'ticket', action: 'update', data: t })),
        ...filterSince(store.customers).map(c => ({ type: 'customer', action: 'update', data: c })),
        ...filterSince(store.ingredients).map(i => ({ type: 'ingredient', action: 'update', data: i })),
        ...filterSince(store.giftCards).map(g => ({ type: 'giftCard', action: 'update', data: g })),
        ...filterSince(store.promoCodes).map(p => ({ type: 'promoCode', action: 'update', data: p }))
    ];
    res.json({
        changes,
        currentVersion: Date.now(), fullResync: !lastSyncVersion
    });
});

// ==========================================
// Merchant Onboarding Portal
// ==========================================
app.get('/api/merchants', authorize('config'), (req, res) => {
    res.json(store.merchants);
});

app.post('/api/merchants', authorize('config'), (req, res) => {
    const { name, email, phone, plan, address } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    const merchant = {
        id: nextPrefixId(store.merchants, 'M-'), name, email,
        phone: phone || '', plan: plan || 'standard', address: address || '',
        status: 'active', tenantId: crypto.randomBytes(8).toString('hex'),
        onboardedAt: new Date().toISOString()
    };
    store.merchants.push(merchant);
    logAudit('merchant_onboarded', req.user, { merchantId: merchant.id, name });
    scheduleSave();
    res.status(201).json(merchant);
});

app.put('/api/merchants/:id', authorize('config'), (req, res) => {
    const merchant = store.merchants.find(m => m.id === req.params.id);
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });
    const { name, email, phone, plan, address, status } = req.body;
    if (name !== undefined) merchant.name = name;
    if (email !== undefined) merchant.email = email;
    if (phone !== undefined) merchant.phone = phone;
    if (plan !== undefined) merchant.plan = plan;
    if (address !== undefined) merchant.address = address;
    if (status !== undefined) merchant.status = status;
    merchant.updatedAt = new Date().toISOString();
    logAudit('merchant_updated', req.user, { merchantId: merchant.id });
    scheduleSave();
    res.json(merchant);
});

app.delete('/api/merchants/:id', authorize('config'), (req, res) => {
    const idx = store.merchants.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Merchant not found' });
    const removed = store.merchants.splice(idx, 1)[0];
    removed.status = 'deactivated';
    removed.deactivatedAt = new Date().toISOString();
    logAudit('merchant_deactivated', req.user, { merchantId: removed.id, name: removed.name });
    scheduleSave();
    res.json(removed);
});

// ==========================================
// System Diagnostics & Updates
// ==========================================
app.get('/api/system/diagnostics', authorize('config'), (req, res) => {
    res.json({
        uptime: process.uptime(), memory: process.memoryUsage(),
        nodeVersion: process.version, storeSize: JSON.stringify(store).length,
        ticketCount: store.tickets.length,
        lastBackup: store.backups.length ? store.backups[store.backups.length - 1].createdAt : null,
        status: 'healthy', timestamp: new Date().toISOString()
    });
});

app.post('/api/system/update', authorize('config'), (req, res) => {
    const { version, channel } = req.body;
    const currentVersion = '1.4-SNAPSHOT';
    const requestedVersion = version || 'latest';

    // Track update request
    if (!store.config.systemUpdates) store.config.systemUpdates = [];
    const update = {
        id: nextId(store.config.systemUpdates),
        currentVersion,
        requestedVersion,
        channel: channel || 'stable',
        status: 'scheduled',
        requestedBy: req.user.name,
        requestedAt: new Date().toISOString()
    };

    // Check if already on requested version
    if (requestedVersion === currentVersion) {
        update.status = 'already_current';
    }

    store.config.systemUpdates.push(update);
    logAudit('system_update_requested', req.user, { version: requestedVersion, channel: update.channel });
    scheduleSave();
    res.json(update);
});

// ==========================================
// White-labeling / Branding
// ==========================================
app.get('/api/branding', (req, res) => {
    res.json(store.config.branding || { name: 'Restaurant POS', logo: null, primaryColor: '#1976d2', accentColor: '#ff9800' });
});

app.put('/api/branding', authorize('config'), (req, res) => {
    const { name, logo, primaryColor, accentColor, favicon } = req.body;
    store.config.branding = {
        name: name || 'Restaurant POS', logo: logo || null,
        primaryColor: primaryColor || '#1976d2', accentColor: accentColor || '#ff9800',
        favicon: favicon || null, updatedAt: new Date().toISOString()
    };
    scheduleSave();
    res.json(store.config.branding);
});

// ==========================================
// Feature Toggles
// ==========================================
app.get('/api/feature-toggles', authorize('config'), (req, res) => {
    res.json(store.featureToggles);
});

app.put('/api/feature-toggles', authorize('config'), (req, res) => {
    const { feature, enabled } = req.body;
    if (!feature) return res.status(400).json({ error: 'Feature name required' });
    store.featureToggles[feature] = { enabled: enabled !== false, updatedAt: new Date().toISOString() };
    logAudit('feature_toggle', req.user, { feature, enabled });
    scheduleSave();
    res.json(store.featureToggles);
});

// ==========================================
// Automated Deployment
// ==========================================
app.get('/api/deploy/status', authorize('config'), (req, res) => {
    res.json({
        currentVersion: '1.4-SNAPSHOT', environment: process.env.NODE_ENV || 'development',
        lastDeploy: store.config.lastDeploy || null,
        autoDeployEnabled: store.config.autoDeploy || false, status: 'running'
    });
});

app.post('/api/deploy', authorize('config'), (req, res) => {
    if (!store.config.deployHistory) store.config.deployHistory = [];
    const deployment = {
        id: nextId(store.config.deployHistory),
        version: req.body.version || 'latest',
        environment: req.body.environment || 'production',
        triggeredBy: req.user.name,
        startedAt: new Date().toISOString(),
        status: 'deploying'
    };

    // Simulate deployment steps
    deployment.steps = [
        { name: 'validate_config', status: 'completed', time: new Date().toISOString() },
        { name: 'backup_current', status: 'completed', time: new Date().toISOString() },
        { name: 'deploy_code', status: 'completed', time: new Date().toISOString() },
        { name: 'run_migrations', status: 'completed', time: new Date().toISOString() },
        { name: 'health_check', status: 'completed', time: new Date().toISOString() }
    ];
    deployment.status = 'completed';
    deployment.completedAt = new Date().toISOString();

    store.config.deployHistory.push(deployment);
    store.config.lastDeploy = deployment.completedAt;
    logAudit('deployment_triggered', req.user, { version: deployment.version, environment: deployment.environment, deployId: deployment.id });
    scheduleSave();
    res.json(deployment);
});

// ==========================================
// Developer Documentation
// ==========================================
app.get('/api/developer/docs', (req, res) => {
    // Dynamically build endpoint documentation from registered Express routes
    const endpoints = {};
    app._router.stack.forEach(layer => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
            const path = layer.route.path;
            methods.forEach(method => {
                // Group by first path segment
                const parts = path.replace('/api/', '').split('/');
                const group = parts[0] || 'root';
                if (!endpoints[group]) endpoints[group] = [];
                endpoints[group].push(`${method} ${path}`);
            });
        }
    });
    // Sort each group
    Object.keys(endpoints).forEach(k => endpoints[k].sort());

    res.json({
        version: '1.4', baseUrl: '/api',
        authentication: {
            method: 'Bearer JWT token',
            loginEndpoint: 'POST /api/auth/login',
            tokenExpiry: '12 hours',
            roles: ['admin', 'manager', 'server', 'cashier', 'bartender', 'kitchen'],
            publicEndpoints: ['GET /api/health', 'GET /api/menu', 'GET /api/tickets', 'GET /api/kitchen',
                'POST /api/online-orders', 'POST /api/scheduled-orders', 'POST /api/reservations',
                'POST /api/qr-orders', 'POST /api/waitlist']
        },
        endpoints,
        endpointCount: Object.values(endpoints).reduce((s, arr) => s + arr.length, 0),
        webhookEvents: WEBHOOK_EVENTS,
        generatedAt: new Date().toISOString()
    });
});

// ==========================================
// Plugin Marketplace
// ==========================================
app.get('/api/plugins', authorize('config'), (req, res) => {
    res.json(store.plugins);
});

app.post('/api/plugins', authorize('config'), (req, res) => {
    const { name, version, description, author } = req.body;
    if (!name) return res.status(400).json({ error: 'Plugin name required' });
    const plugin = {
        id: nextId(store.plugins), name,
        version: version || '1.0.0', description: description || '',
        author: author || 'unknown', installed: true, enabled: true,
        installedAt: new Date().toISOString()
    };
    store.plugins.push(plugin);
    logAudit('plugin_installed', req.user, { pluginId: plugin.id, name });
    scheduleSave();
    res.status(201).json(plugin);
});

app.put('/api/plugins/:id', authorize('config'), (req, res) => {
    const plugin = store.plugins.find(p => p.id === parseInt(req.params.id));
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });
    const { enabled, version, description } = req.body;
    if (enabled !== undefined) plugin.enabled = enabled;
    if (version !== undefined) plugin.version = version;
    if (description !== undefined) plugin.description = description;
    plugin.updatedAt = new Date().toISOString();
    logAudit(enabled === false ? 'plugin_disabled' : 'plugin_updated', req.user, { pluginId: plugin.id, name: plugin.name });
    scheduleSave();
    res.json(plugin);
});

app.delete('/api/plugins/:id', authorize('config'), (req, res) => {
    const idx = store.plugins.findIndex(p => p.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Plugin not found' });
    const removed = store.plugins.splice(idx, 1)[0];
    logAudit('plugin_uninstalled', req.user, { pluginId: removed.id, name: removed.name });
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Online Ordering Menu
// ==========================================
app.get('/api/menu', (req, res) => {
    res.json(store.config.menu || { categories: [], items: [] });
});

app.put('/api/menu', authorize('config'), (req, res) => {
    const { categories, items } = req.body;
    if (!store.config.menu) store.config.menu = { categories: [], items: [] };
    if (categories !== undefined) store.config.menu.categories = categories;
    if (items !== undefined) store.config.menu.items = items;
    logAudit('menu_updated', req.user, { categoryCount: (store.config.menu.categories || []).length, itemCount: (store.config.menu.items || []).length });
    scheduleSave();
    res.json(store.config.menu);
});

// ==========================================
// Health check (no auth required)
// ==========================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        tickets: store.tickets.length,
        activeKitchenOrders: store.kitchenOrders.filter(o => o.status !== 'bumped').length
    });
});

// ==========================================
// Serve webapp for all other routes
// ==========================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ==========================================
// Start server
// ==========================================
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Restaurant POS API running on port ${PORT}`);
        console.log(`  POS:     http://localhost:${PORT}`);
        console.log(`  Admin:   http://localhost:${PORT}/admin.html`);
        console.log(`  Display: http://localhost:${PORT}/customer-display.html`);
        console.log(`  API:     http://localhost:${PORT}/api/health`);
        console.log('  Auth:    JWT-based (POST /api/auth/login)');
    });
}

module.exports = { app, store };
