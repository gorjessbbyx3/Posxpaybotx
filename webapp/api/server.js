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
            if (data.nextTicketId) store.nextTicketId = data.nextTicketId;
            if (data.config) {
                Object.keys(data.config).forEach(k => {
                    if (store.config[k]) Object.assign(store.config[k], data.config[k]);
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
// Audit Log Helper
// ==========================================
function logAudit(action, user, details) {
    store.auditLog.push({
        id: store.auditLog.length + 1,
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
function fireWebhooks(event, payload) {
    const hooks = store.webhooks.filter(w => w.active && w.events.includes(event));
    hooks.forEach(w => {
        const body = JSON.stringify({ event, data: payload, time: new Date().toISOString() });
        try {
            const url = new URL(w.url);
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

app.get('/api/tickets', (req, res) => {
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

app.get('/api/tickets/:id', (req, res) => {
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
        const subtotal = ticket.items.reduce((s, i) => s + Math.round((parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0) * 100) / 100, 0);
        const discountAmt = ticket.discount ? (parseFloat(ticket.discount.amount) || 0) : 0;
        const afterDiscount = Math.round(Math.max(0, subtotal - discountAmt) * 100) / 100;
        const tax = Math.round(afterDiscount * (store.config.tax.rate / 100) * 100) / 100;
        const dFee = parseFloat(ticket.deliveryFee) || 0;

        ticket.subtotal = Math.round(subtotal * 100) / 100;
        ticket.tax = tax;
        ticket.total = Math.round((afterDiscount + tax + dFee) * 100) / 100;
    }

    store.tickets.push(ticket);
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
    ticket.updatedAt = new Date().toISOString();
    ticket.updatedBy = req.user ? req.user.name : 'unknown';

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

    if (ticket.status === 'paid') {
        fireWebhooks('ticket.paid', { ticketId: ticket.id, total: ticket.total, method });
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

    logAudit('void', req.user, { ticketId: ticket.id, reason: ticket.voidReason, total: ticket.total });
    scheduleSave();
    res.json(ticket);
});

// ==========================================
// Refund Endpoints (requires refund permission)
// ==========================================
app.get('/api/refunds', (req, res) => {
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
        id: store.refunds.length + 1,
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

    logAudit('refund', req.user, { ticketId: ticket.id, amount: refundAmount, reason: refund.reason });
    scheduleSave();
    res.status(201).json(refund);
});

// ==========================================
// Kitchen Display Endpoints
// ==========================================
app.get('/api/kitchen', (req, res) => {
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
app.get('/api/kitchen/station/:station', (req, res) => {
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

    order.currentCourse = courseToFire;
    order.courseFiredAt = order.courseFiredAt || {};
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
app.get('/api/held-orders', (req, res) => {
    res.json({ orders: store.heldOrders, total: store.heldOrders.length });
});

app.post('/api/held-orders', authorize('tickets'), (req, res) => {
    const { items, type, server: serverName, table, discount, note } = req.body;
    const held = {
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

app.delete('/api/held-orders/:index', authorize('tickets'), (req, res) => {
    const idx = parseInt(req.params.index);
    if (idx < 0 || idx >= store.heldOrders.length) {
        return res.status(404).json({ error: 'Held order not found' });
    }
    const removed = store.heldOrders.splice(idx, 1)[0];
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Time Clock Endpoints
// ==========================================
app.get('/api/timeclock', (req, res) => {
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
        id: store.timeClock.length + 1,
        empId,
        empName: empName || (req.user ? req.user.name : 'Unknown'),
        role: role || (req.user ? req.user.role : 'server'),
        clockIn: new Date().toISOString(),
        clockOut: null
    };
    store.timeClock.push(record);
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

app.get('/api/config', (req, res) => {
    res.json(store.config);
});

app.get('/api/config/:section', (req, res) => {
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
    for (let h = 6; h <= 23; h++) hourlyData[h] = { sales: 0, tickets: 0 };

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
        if (t.status === 'voided' || !t.server) return;
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
                    // CARD_SURCHARGE: surcharge is added on top
                    surcharge = (t.total || 0) * rate / (1 + rate);
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

app.get('/api/customers', (req, res) => {
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

app.get('/api/customers/:id', (req, res) => {
    const customer = store.customers.find(c => c.id === parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
});

app.post('/api/customers', authorize('tickets'), (req, res) => {
    const { name, email, phone, address, notes, tags } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name required' });

    const customer = {
        id: store.customers.length > 0 ? Math.max(...store.customers.map(c => c.id)) + 1 : 1,
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
    scheduleSave();
    res.json(customer);
});

app.delete('/api/customers/:id', authorize('config'), (req, res) => {
    const idx = store.customers.findIndex(c => c.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
    const removed = store.customers.splice(idx, 1)[0];
    scheduleSave();
    res.json(removed);
});

// ==========================================
// Gift Card Management
// ==========================================
app.get('/api/gift-cards', authorize('tickets'), (req, res) => {
    res.json({ giftCards: store.giftCards, total: store.giftCards.length });
});

app.get('/api/gift-cards/:code', (req, res) => {
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
        id: store.giftCards.length > 0 ? Math.max(...store.giftCards.map(g => g.id)) + 1 : 1,
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
        id: store.promoCodes.length > 0 ? Math.max(...store.promoCodes.map(p => p.id)) + 1 : 1,
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
app.get('/api/kitchen/expo', (req, res) => {
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

app.get('/api/customers/:id/loyalty', (req, res) => {
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

    const amount = parseFloat(req.body.amount) || 0;
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    const multiplier = parseFloat(req.body.multiplier) || 1;
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
    const tax = Math.round(subtotal * (store.config.tax.rate / 100) * 100) / 100;

    const order = {
        id: store.onlineOrders.length > 0 ? Math.max(...store.onlineOrders.map(o => o.id)) + 1 : 5001,
        customerName,
        customerPhone: customerPhone || '',
        customerEmail: customerEmail || '',
        items,
        type: type || 'pickup',
        subtotal: Math.round(subtotal * 100) / 100,
        tax,
        total: Math.round((subtotal + tax) * 100) / 100,
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
        a.id = store.fraudAlerts.length + 1;
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
                    id: store.fraudAlerts.length + 1,
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
                    id: store.fraudAlerts.length + 1,
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
// Webhook Management Endpoints (requires config permission)
// ==========================================
const WEBHOOK_EVENTS = ['ticket.paid', 'kitchen.new', 'kitchen.bumped', 'kitchen.course_fired'];

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
        id: store.webhooks.length + 1,
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
