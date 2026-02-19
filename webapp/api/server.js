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
            minCardAmount: 0
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
const TICKET_PATCH_FIELDS = ['table', 'server', 'type', 'items', 'discount', 'deliveryFee', 'deliveryAddress', 'note'];

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

// Pay a ticket
app.post('/api/tickets/:id/pay', authorize('tickets'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    ticket.status = 'paid';
    ticket.paid = true;
    ticket.paymentMethod = req.body.method || 'cash';
    ticket.tip = Math.round((parseFloat(req.body.tip) || 0) * 100) / 100;
    ticket.paidAt = new Date().toISOString();
    ticket.paidBy = req.user ? req.user.name : 'unknown';

    scheduleSave();
    res.json(ticket);
});

// Void a ticket (requires void permission)
app.post('/api/tickets/:id/void', authorize('void'), (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    ticket.status = 'voided';
    ticket.voidedBy = req.user ? req.user.name : (req.body.user || 'unknown');
    ticket.voidedAt = new Date().toISOString();
    ticket.voidReason = req.body.reason || '';

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
        processedBy: req.user ? req.user.name : (req.body.processedBy || 'unknown'),
        time: new Date().toISOString()
    };

    store.refunds.push(refund);

    ticket.refundedAmount = Math.round((previousRefunds + refundAmount) * 100) / 100;
    if (type === 'full' || ticket.refundedAmount >= ticket.total) {
        ticket.status = 'refunded';
    }

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
    const order = {
        id: req.body.ticketId,
        items: req.body.items || [],
        type: req.body.type || 'dine-in',
        server: req.body.server || (req.user ? req.user.name : 'Unknown'),
        table: req.body.table || null,
        status: 'new',
        time: new Date().toISOString()
    };
    store.kitchenOrders.push(order);
    scheduleSave();
    res.status(201).json(order);
});

app.post('/api/kitchen/:id/bump', authorize('kitchen'), (req, res) => {
    const order = store.kitchenOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = 'bumped';
    order.bumpedAt = new Date().toISOString();
    order.bumpedBy = req.user ? req.user.name : 'unknown';
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
    cashDiscount: ['enabled', 'mode', 'rate', 'cashLabel', 'surchargeLabel', 'showDualPricing', 'exemptDebit', 'applyBeforeTax', 'minCardAmount'],
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
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            store.config[sectionName][field] = req.body[field];
        }
    });
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
        laborMap[r.empId].hours += (end - new Date(r.clockIn)) / 3600000;
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
