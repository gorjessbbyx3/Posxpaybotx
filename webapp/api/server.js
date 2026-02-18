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
 * Designed to run alongside the static webapp.
 * Data stored in-memory by default; swap store for DB in production.
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ==========================================
// In-Memory Data Store
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

// ==========================================
// Middleware
// ==========================================
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ==========================================
// Ticket Endpoints
// ==========================================
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

app.post('/api/tickets', (req, res) => {
    const ticket = {
        id: store.nextTicketId++,
        ...req.body,
        status: 'open',
        paid: false,
        time: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };

    // Calculate totals
    const subtotal = ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    const discountAmt = ticket.discount ? ticket.discount.amount : 0;
    const afterDiscount = subtotal - discountAmt;
    const tax = afterDiscount * (store.config.tax.rate / 100);
    const deliveryFee = ticket.deliveryFee || 0;

    ticket.subtotal = Math.round(subtotal * 100) / 100;
    ticket.tax = Math.round(tax * 100) / 100;
    ticket.total = Math.round((afterDiscount + tax + deliveryFee) * 100) / 100;

    store.tickets.push(ticket);
    res.status(201).json(ticket);
});

app.patch('/api/tickets/:id', (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    Object.assign(ticket, req.body, { updatedAt: new Date().toISOString() });
    res.json(ticket);
});

// Pay a ticket
app.post('/api/tickets/:id/pay', (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    ticket.status = 'paid';
    ticket.paid = true;
    ticket.paymentMethod = req.body.method || 'cash';
    ticket.tip = req.body.tip || 0;
    ticket.paidAt = new Date().toISOString();

    res.json(ticket);
});

// Void a ticket
app.post('/api/tickets/:id/void', (req, res) => {
    const ticket = store.tickets.find(t => t.id === parseInt(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    ticket.status = 'voided';
    ticket.voidedBy = req.body.user || 'unknown';
    ticket.voidedAt = new Date().toISOString();
    ticket.voidReason = req.body.reason || '';

    res.json(ticket);
});

// ==========================================
// Refund Endpoints
// ==========================================
app.get('/api/refunds', (req, res) => {
    res.json({ refunds: store.refunds, total: store.refunds.length });
});

app.post('/api/refunds', (req, res) => {
    const { ticketId, amount, reason, type } = req.body;
    const ticket = store.tickets.find(t => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status !== 'paid') return res.status(400).json({ error: 'Can only refund paid tickets' });

    if (amount <= 0 || amount > ticket.total) {
        return res.status(400).json({ error: 'Invalid refund amount' });
    }

    const refund = {
        id: store.refunds.length + 1,
        ticketId,
        amount: Math.round(amount * 100) / 100,
        reason: reason || 'No reason provided',
        type: type || 'full',
        method: ticket.paymentMethod,
        processedBy: req.body.processedBy || 'unknown',
        time: new Date().toISOString()
    };

    store.refunds.push(refund);

    if (type === 'full') {
        ticket.status = 'refunded';
    }
    ticket.refundedAmount = (ticket.refundedAmount || 0) + refund.amount;

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

app.post('/api/kitchen', (req, res) => {
    const order = {
        id: req.body.ticketId,
        items: req.body.items || [],
        type: req.body.type || 'dine-in',
        server: req.body.server || 'Unknown',
        table: req.body.table || null,
        status: 'new',
        time: new Date().toISOString()
    };
    store.kitchenOrders.push(order);
    res.status(201).json(order);
});

app.post('/api/kitchen/:id/bump', (req, res) => {
    const order = store.kitchenOrders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = 'bumped';
    order.bumpedAt = new Date().toISOString();
    res.json(order);
});

// ==========================================
// Held Orders Endpoints
// ==========================================
app.get('/api/held-orders', (req, res) => {
    res.json({ orders: store.heldOrders, total: store.heldOrders.length });
});

app.post('/api/held-orders', (req, res) => {
    const held = {
        ...req.body,
        heldAt: new Date().toISOString()
    };
    store.heldOrders.push(held);
    res.status(201).json(held);
});

app.delete('/api/held-orders/:index', (req, res) => {
    const idx = parseInt(req.params.index);
    if (idx < 0 || idx >= store.heldOrders.length) {
        return res.status(404).json({ error: 'Held order not found' });
    }
    const removed = store.heldOrders.splice(idx, 1)[0];
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

app.post('/api/timeclock/clock-in', (req, res) => {
    const { empId, empName, role } = req.body;
    if (!empId) return res.status(400).json({ error: 'Employee ID required' });

    // Check if already clocked in
    const existing = store.timeClock.find(r => r.empId === empId && !r.clockOut);
    if (existing) return res.status(400).json({ error: 'Already clocked in' });

    const record = {
        id: store.timeClock.length + 1,
        empId,
        empName: empName || 'Unknown',
        role: role || 'server',
        clockIn: new Date().toISOString(),
        clockOut: null
    };
    store.timeClock.push(record);
    res.status(201).json(record);
});

app.post('/api/timeclock/clock-out', (req, res) => {
    const { empId } = req.body;
    if (!empId) return res.status(400).json({ error: 'Employee ID required' });

    const record = store.timeClock.find(r => r.empId === empId && !r.clockOut);
    if (!record) return res.status(400).json({ error: 'Not clocked in' });

    record.clockOut = new Date().toISOString();
    const hours = (new Date(record.clockOut) - new Date(record.clockIn)) / 3600000;
    record.hoursWorked = Math.round(hours * 100) / 100;

    res.json(record);
});

// ==========================================
// Configuration Endpoints
// ==========================================
app.get('/api/config', (req, res) => {
    res.json(store.config);
});

app.get('/api/config/:section', (req, res) => {
    const section = store.config[req.params.section];
    if (!section) return res.status(404).json({ error: 'Config section not found' });
    res.json(section);
});

app.put('/api/config/:section', (req, res) => {
    if (!store.config[req.params.section]) {
        return res.status(404).json({ error: 'Config section not found' });
    }
    Object.assign(store.config[req.params.section], req.body);
    res.json(store.config[req.params.section]);
});

// ==========================================
// Reports Endpoints
// ==========================================
app.get('/api/reports/summary', (req, res) => {
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

app.get('/api/reports/hourly', (req, res) => {
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

app.get('/api/reports/item-mix', (req, res) => {
    const itemMap = {};
    store.tickets.forEach(t => {
        if (t.status === 'voided') return;
        t.items.forEach(item => {
            const key = item.name;
            if (!itemMap[key]) itemMap[key] = { name: item.name, qty: 0, revenue: 0 };
            itemMap[key].qty += item.qty;
            itemMap[key].revenue += item.price * item.qty;
        });
    });

    const sorted = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
    const totalRev = sorted.reduce((s, i) => s + i.revenue, 0);
    sorted.forEach(i => { i.pctOfSales = totalRev > 0 ? Math.round(i.revenue / totalRev * 1000) / 10 : 0; });

    res.json({ items: sorted, totalRevenue: totalRev });
});

app.get('/api/reports/labor', (req, res) => {
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
// Health check
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
app.listen(PORT, () => {
    console.log(`Restaurant POS API running on port ${PORT}`);
    console.log(`  POS:     http://localhost:${PORT}`);
    console.log(`  Admin:   http://localhost:${PORT}/admin.html`);
    console.log(`  Display: http://localhost:${PORT}/customer-display.html`);
    console.log(`  API:     http://localhost:${PORT}/api/health`);
});

module.exports = app;
