/**
 * Integration Tests - API Server
 *
 * Tests the Express API endpoints with authentication.
 * Uses Node.js built-in test runner and http module.
 * Zero external dependencies.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, store } = require('../api/server');
const { createToken } = require('../api/auth');

let server;
let port;

// Tokens for different roles
const managerToken = createToken({ id: 'M001', name: 'Maria', role: 'manager' });
const serverToken = createToken({ id: 'S001', name: 'John', role: 'server' });
const kitchenToken = createToken({ id: 'K001', name: 'Carlos', role: 'kitchen' });

// Helper to make HTTP requests
function req(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: '127.0.0.1',
            port,
            path,
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (token) {
            opts.headers['Authorization'] = 'Bearer ' + token;
        }

        const request = http.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        request.on('error', reject);

        if (body) {
            request.write(JSON.stringify(body));
        }
        request.end();
    });
}

before(() => {
    return new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            port = server.address().port;
            // Reset store
            store.tickets.length = 0;
            store.kitchenOrders.length = 0;
            store.heldOrders.length = 0;
            store.refunds.length = 0;
            store.timeClock.length = 0;
            store.auditLog.length = 0;
            store.webhooks.length = 0;
            store.customers.length = 0;
            store.giftCards.length = 0;
            store.promoCodes.length = 0;
            store.nextTicketId = 1001;
            resolve();
        });
    });
});

after(() => {
    return new Promise((resolve) => {
        server.close(resolve);
    });
});

// ==========================================
// Health Check
// ==========================================
describe('GET /api/health', () => {
    it('returns ok without auth', async () => {
        const res = await req('GET', '/api/health');
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'ok');
    });
});

// ==========================================
// Authentication
// ==========================================
describe('POST /api/auth/login', () => {
    it('logs in with valid PIN', async () => {
        const res = await req('POST', '/api/auth/login', { pin: '1234' });
        assert.equal(res.status, 200);
        assert.ok(res.body.token);
        assert.equal(res.body.user.name, 'Maria');
        assert.equal(res.body.user.role, 'manager');
    });

    it('rejects role-name login (backdoor removed)', async () => {
        const res = await req('POST', '/api/auth/login', { user: 'server' });
        assert.equal(res.status, 400);
    });

    it('rejects invalid PIN', async () => {
        const res = await req('POST', '/api/auth/login', { pin: '0000' });
        assert.equal(res.status, 401);
    });

    it('rejects missing credentials', async () => {
        const res = await req('POST', '/api/auth/login', {});
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Ticket CRUD
// ==========================================
describe('Tickets API', () => {
    it('GET /api/tickets returns empty list initially', async () => {
        const res = await req('GET', '/api/tickets');
        assert.equal(res.status, 200);
        assert.equal(res.body.tickets.length, 0);
    });

    it('POST /api/tickets requires auth', async () => {
        const res = await req('POST', '/api/tickets', {
            items: [{ name: 'Burger', price: 12.99, qty: 1 }],
            type: 'dine-in'
        });
        assert.equal(res.status, 401);
    });

    it('POST /api/tickets creates ticket with auth', async () => {
        const res = await req('POST', '/api/tickets', {
            items: [{ name: 'Burger', price: 12.99, qty: 1 }],
            type: 'dine-in',
            server: 'John'
        }, serverToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.id, 1001);
        assert.equal(res.body.status, 'open');
        assert.equal(res.body.subtotal, 12.99);
        assert.ok(res.body.tax > 0);
    });

    it('GET /api/tickets/:id returns the ticket', async () => {
        const res = await req('GET', '/api/tickets/1001');
        assert.equal(res.status, 200);
        assert.equal(res.body.id, 1001);
    });

    it('GET /api/tickets/:id returns 404 for missing', async () => {
        const res = await req('GET', '/api/tickets/9999');
        assert.equal(res.status, 404);
    });

    it('PATCH /api/tickets/:id updates ticket', async () => {
        const res = await req('PATCH', '/api/tickets/1001', {
            table: 5
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.table, 5);
    });
});

// ==========================================
// Payment
// ==========================================
describe('Payment API', () => {
    it('POST /api/tickets/:id/pay marks as paid', async () => {
        const res = await req('POST', '/api/tickets/1001/pay', {
            method: 'card',
            tip: 3.00
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'paid');
        assert.equal(res.body.paymentMethod, 'card');
        assert.equal(res.body.tip, 3);
    });

    it('rejects double payment', async () => {
        const res = await req('POST', '/api/tickets/1001/pay', {
            method: 'cash'
        }, serverToken);

        assert.equal(res.status, 400);
    });
});

// ==========================================
// Void (requires manager/admin)
// ==========================================
describe('Void API', () => {
    it('server cannot void tickets', async () => {
        // Create a ticket first
        await req('POST', '/api/tickets', {
            items: [{ name: 'Salad', price: 10.99, qty: 1 }],
            type: 'dine-in'
        }, serverToken);

        const res = await req('POST', '/api/tickets/1002/void', {
            reason: 'test'
        }, serverToken);

        assert.equal(res.status, 403);
    });

    it('manager can void tickets', async () => {
        const res = await req('POST', '/api/tickets/1002/void', {
            reason: 'Wrong order'
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'voided');
        assert.equal(res.body.voidReason, 'Wrong order');
    });
});

// ==========================================
// Refunds (requires manager/admin)
// ==========================================
describe('Refund API', () => {
    it('server cannot refund', async () => {
        const res = await req('POST', '/api/refunds', {
            ticketId: 1001,
            amount: 5,
            reason: 'test'
        }, serverToken);

        assert.equal(res.status, 403);
    });

    it('manager can refund paid ticket', async () => {
        const res = await req('POST', '/api/refunds', {
            ticketId: 1001,
            amount: 5,
            reason: 'Quality issue',
            type: 'partial'
        }, managerToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.amount, 5);
        assert.equal(res.body.reason, 'Quality issue');
    });

    it('rejects invalid refund amount', async () => {
        const res = await req('POST', '/api/refunds', {
            ticketId: 1001,
            amount: -10,
            reason: 'test'
        }, managerToken);

        assert.equal(res.status, 400);
    });

    it('rejects refund exceeding remaining balance (cumulative)', async () => {
        // The ticket has total ~31.97 and already has a $5 refund from the previous test
        // Attempting to refund more than remaining should fail
        const res = await req('POST', '/api/refunds', {
            ticketId: 1001,
            amount: 30,
            reason: 'over-refund attempt',
            type: 'partial'
        }, managerToken);

        assert.equal(res.status, 400);
        assert.ok(res.body.error.includes('exceeds'));
    });

    it('tracks cumulative refunded amount correctly', async () => {
        // Second partial refund of $3 on same ticket should succeed
        const res = await req('POST', '/api/refunds', {
            ticketId: 1001,
            amount: 3,
            reason: 'Additional adjustment',
            type: 'partial'
        }, managerToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.amount, 3);
    });

    it('audit trail uses server-side identity not req.body', async () => {
        const res = await req('POST', '/api/refunds', {
            ticketId: 1001,
            amount: 1,
            reason: 'Audit test',
            processedBy: 'HACKER'  // This should be ignored
        }, managerToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.processedBy, 'Maria');  // From managerToken, not req.body
    });
});

// ==========================================
// Void - audit trail integrity
// ==========================================
describe('Void API - audit trail', () => {
    it('uses server-side user name, ignoring req.body.user', async () => {
        // Create a second ticket to void
        const createRes = await req('POST', '/api/tickets', {
            items: [{ name: 'Test Item', price: 5, qty: 1 }],
            type: 'dine-in'
        }, managerToken);
        const ticketId = createRes.body.id;

        const res = await req('POST', `/api/tickets/${ticketId}/void`, {
            user: 'SPOOFED_USER',
            reason: 'Testing'
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.voidedBy, 'Maria');  // From token, not spoofed
    });
});

// ==========================================
// Kitchen
// ==========================================
describe('Kitchen API', () => {
    it('kitchen user can send orders', async () => {
        const res = await req('POST', '/api/kitchen', {
            ticketId: 1001,
            items: [{ name: 'Burger', station: 'grill', qty: 1 }],
            type: 'dine-in'
        }, kitchenToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.status, 'new');
    });

    it('server cannot send to kitchen', async () => {
        const res = await req('POST', '/api/kitchen', {
            ticketId: 1002,
            items: [{ name: 'Salad', station: 'salad', qty: 1 }]
        }, serverToken);

        assert.equal(res.status, 403);
    });

    it('GET /api/kitchen returns active orders', async () => {
        const res = await req('GET', '/api/kitchen');
        assert.equal(res.status, 200);
        assert.ok(res.body.orders.length > 0);
    });

    it('kitchen user can bump orders', async () => {
        const res = await req('POST', '/api/kitchen/1001/bump', {}, kitchenToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'bumped');
    });
});

// ==========================================
// Time Clock
// ==========================================
describe('Time Clock API', () => {
    it('clocks in an employee', async () => {
        const res = await req('POST', '/api/timeclock/clock-in', {
            empId: 'S001',
            empName: 'John',
            role: 'server'
        }, serverToken);

        assert.equal(res.status, 201);
        assert.ok(res.body.clockIn);
        assert.equal(res.body.clockOut, null);
    });

    it('rejects double clock-in', async () => {
        const res = await req('POST', '/api/timeclock/clock-in', {
            empId: 'S001'
        }, serverToken);

        assert.equal(res.status, 400);
    });

    it('clocks out an employee', async () => {
        const res = await req('POST', '/api/timeclock/clock-out', {
            empId: 'S001'
        }, serverToken);

        assert.equal(res.status, 200);
        assert.ok(res.body.clockOut);
        assert.ok(res.body.hoursWorked >= 0);
    });
});

// ==========================================
// Configuration
// ==========================================
describe('Configuration API', () => {
    it('GET /api/config returns all config (no auth needed)', async () => {
        const res = await req('GET', '/api/config');
        assert.equal(res.status, 200);
        assert.ok(res.body.cashDiscount);
        assert.ok(res.body.tax);
    });

    it('server cannot update config', async () => {
        const res = await req('PUT', '/api/config/tax', {
            rate: 10
        }, serverToken);

        assert.equal(res.status, 403);
    });

    it('manager can update config', async () => {
        const res = await req('PUT', '/api/config/tax', {
            rate: 9.5
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.rate, 9.5);
    });
});

// ==========================================
// Reports (requires manager/admin)
// ==========================================
describe('Reports API', () => {
    it('server cannot access reports', async () => {
        const res = await req('GET', '/api/reports/summary', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('manager can access summary report', async () => {
        const res = await req('GET', '/api/reports/summary', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok('totalSales' in res.body);
        assert.ok('ticketCount' in res.body);
    });

    it('manager can access item mix report', async () => {
        const res = await req('GET', '/api/reports/item-mix', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.items));
    });
});

// ==========================================
// Partial Payments
// ==========================================
describe('Partial Payments API', () => {
    let partialTicketId;

    it('creates a ticket for partial payment testing', async () => {
        const res = await req('POST', '/api/tickets', {
            items: [{ name: 'Steak', price: 40.00, qty: 1 }],
            type: 'dine-in'
        }, serverToken);

        assert.equal(res.status, 201);
        partialTicketId = res.body.id;
        assert.ok(res.body.total > 0);
    });

    it('accepts partial payment', async () => {
        const res = await req('POST', `/api/tickets/${partialTicketId}/pay`, {
            method: 'card',
            amount: 20.00,
            tip: 2.00
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'partial');
        assert.equal(res.body.totalPaid, 20);
        assert.ok(res.body.remaining > 0);
        assert.equal(res.body.payments.length, 1);
        assert.equal(res.body.payments[0].amount, 20);
    });

    it('accepts second partial payment with different method', async () => {
        const ticket = store.tickets.find(t => t.id === partialTicketId);
        const remaining = ticket.remaining;

        const res = await req('POST', `/api/tickets/${partialTicketId}/pay`, {
            method: 'cash',
            amount: remaining,
            tip: 1.00
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'paid');
        assert.equal(res.body.remaining, 0);
        assert.equal(res.body.payments.length, 2);
    });

    it('rejects payment on fully paid ticket', async () => {
        const res = await req('POST', `/api/tickets/${partialTicketId}/pay`, {
            method: 'cash',
            amount: 5
        }, serverToken);

        assert.equal(res.status, 400);
    });

    it('rejects payment exceeding remaining balance', async () => {
        // Create another ticket
        const create = await req('POST', '/api/tickets', {
            items: [{ name: 'Wine', price: 15.00, qty: 1 }],
            type: 'dine-in'
        }, serverToken);

        const res = await req('POST', `/api/tickets/${create.body.id}/pay`, {
            method: 'card',
            amount: 999.99
        }, serverToken);

        assert.equal(res.status, 400);
        assert.ok(res.body.error.includes('exceeds'));
    });

    it('rejects zero/negative payment amount', async () => {
        const create = await req('POST', '/api/tickets', {
            items: [{ name: 'Soda', price: 3.00, qty: 1 }],
            type: 'dine-in'
        }, serverToken);

        const res = await req('POST', `/api/tickets/${create.body.id}/pay`, {
            method: 'cash',
            amount: 0
        }, serverToken);

        assert.equal(res.status, 400);
    });
});

// ==========================================
// Audit Log
// ==========================================
describe('Audit Log API', () => {
    it('server cannot access audit log', async () => {
        const res = await req('GET', '/api/audit-log', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('manager can access audit log', async () => {
        const res = await req('GET', '/api/audit-log', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.entries));
    });

    it('void actions are logged', async () => {
        const res = await req('GET', '/api/audit-log?action=void', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.entries.length > 0);
        assert.equal(res.body.entries[0].action, 'void');
        assert.ok(res.body.entries[0].details.ticketId);
    });

    it('refund actions are logged', async () => {
        const res = await req('GET', '/api/audit-log?action=refund', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.entries.length > 0);
        assert.equal(res.body.entries[0].action, 'refund');
        assert.ok(res.body.entries[0].details.amount);
    });

    it('config changes are logged', async () => {
        const res = await req('GET', '/api/audit-log?action=config_change', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.entries.length > 0);
        assert.equal(res.body.entries[0].action, 'config_change');
        assert.ok(res.body.entries[0].details.section);
    });

    it('supports limit parameter', async () => {
        const res = await req('GET', '/api/audit-log?limit=2', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.entries.length <= 2);
    });

    it('returns entries in reverse chronological order', async () => {
        const res = await req('GET', '/api/audit-log', null, managerToken);
        if (res.body.entries.length >= 2) {
            assert.ok(res.body.entries[0].time >= res.body.entries[1].time);
        }
    });
});

// ==========================================
// Payment Type Breakdown Report
// ==========================================
describe('Payment Type Breakdown Report', () => {
    it('server cannot access payment-type report', async () => {
        const res = await req('GET', '/api/reports/payment-type', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('manager can access payment-type breakdown', async () => {
        const res = await req('GET', '/api/reports/payment-type', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.breakdown);
        // We have tickets paid by card and cash from earlier tests
        assert.ok(res.body.breakdown.card || res.body.breakdown.cash);
    });

    it('breakdown includes sales and tips per method', async () => {
        const res = await req('GET', '/api/reports/payment-type', null, managerToken);
        const methods = Object.values(res.body.breakdown);
        methods.forEach(m => {
            assert.ok('sales' in m);
            assert.ok('tips' in m);
            assert.ok('count' in m);
            assert.ok('tickets' in m);
        });
    });
});

// ==========================================
// Surcharge Revenue Report
// ==========================================
describe('Surcharge Revenue Report', () => {
    it('server cannot access surcharge report', async () => {
        const res = await req('GET', '/api/reports/surcharge', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('manager can access surcharge report', async () => {
        const res = await req('GET', '/api/reports/surcharge', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok('mode' in res.body);
        assert.ok('rate' in res.body);
        assert.ok('totalSurchargeRevenue' in res.body);
        assert.ok('cashTickets' in res.body);
        assert.ok('cardTickets' in res.body);
        assert.ok('cashSales' in res.body);
        assert.ok('cardSales' in res.body);
        assert.ok('cashPct' in res.body);
        assert.ok('cardPct' in res.body);
    });

    it('includes surcharge ticket count', async () => {
        const res = await req('GET', '/api/reports/surcharge', null, managerToken);
        assert.ok('surchargeTicketCount' in res.body);
        assert.equal(typeof res.body.surchargeTicketCount, 'number');
    });
});

// ==========================================
// Order Routing by Station
// ==========================================
describe('Kitchen Station Routing', () => {
    it('sends order with station-tagged items', async () => {
        const res = await req('POST', '/api/kitchen', {
            ticketId: 9001,
            items: [
                { name: 'Burger', station: 'grill', qty: 1, course: 1 },
                { name: 'Fries', station: 'fryer', qty: 1, course: 1 },
                { name: 'Salad', station: 'salad', qty: 1, course: 1 }
            ],
            type: 'dine-in',
            table: 5
        }, kitchenToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.items.length, 3);
        assert.equal(res.body.items[0].station, 'grill');
        assert.equal(res.body.currentCourse, 1);
    });

    it('filters orders by station', async () => {
        const res = await req('GET', '/api/kitchen/station/grill');
        assert.equal(res.status, 200);
        assert.equal(res.body.station, 'grill');
        assert.ok(res.body.orders.length > 0);
        // Only grill items should be included
        res.body.orders.forEach(o => {
            o.items.forEach(i => assert.equal(i.station, 'grill'));
        });
    });

    it('returns empty for station with no orders', async () => {
        const res = await req('GET', '/api/kitchen/station/pizza');
        assert.equal(res.status, 200);
        assert.equal(res.body.orders.length, 0);
    });

    it('defaults station to general when not specified', async () => {
        const res = await req('POST', '/api/kitchen', {
            ticketId: 9002,
            items: [{ name: 'Water', qty: 1 }]
        }, kitchenToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.items[0].station, 'general');
    });
});

// ==========================================
// Course Firing
// ==========================================
describe('Course Firing API', () => {
    let courseOrderId;

    it('creates multi-course order', async () => {
        const res = await req('POST', '/api/kitchen', {
            ticketId: 9010,
            items: [
                { name: 'Soup', station: 'salad', qty: 1, course: 1 },
                { name: 'Steak', station: 'grill', qty: 1, course: 2 },
                { name: 'Dessert', station: 'salad', qty: 1, course: 3 }
            ]
        }, kitchenToken);

        assert.equal(res.status, 201);
        courseOrderId = res.body.id;
        assert.equal(res.body.currentCourse, 1);
    });

    it('fires course 2', async () => {
        const res = await req('POST', `/api/kitchen/${courseOrderId}/fire-course`, {
            course: 2
        }, kitchenToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.firedCourse, 2);
        assert.equal(res.body.courseItems.length, 1);
        assert.equal(res.body.courseItems[0].name, 'Steak');
        assert.equal(res.body.order.currentCourse, 2);
    });

    it('fires course 3', async () => {
        const res = await req('POST', `/api/kitchen/${courseOrderId}/fire-course`, {
            course: 3
        }, kitchenToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.firedCourse, 3);
        assert.equal(res.body.courseItems[0].name, 'Dessert');
    });

    it('rejects firing empty course', async () => {
        const res = await req('POST', `/api/kitchen/${courseOrderId}/fire-course`, {
            course: 99
        }, kitchenToken);

        assert.equal(res.status, 400);
        assert.ok(res.body.error.includes('No items'));
    });

    it('rejects firing on missing order', async () => {
        const res = await req('POST', '/api/kitchen/99999/fire-course', {
            course: 1
        }, kitchenToken);

        assert.equal(res.status, 404);
    });
});

// ==========================================
// Labor Cost Tracking Report
// ==========================================
describe('Labor Cost Report', () => {
    it('server cannot access labor-cost report', async () => {
        const res = await req('GET', '/api/reports/labor-cost', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('manager can access labor-cost report', async () => {
        const res = await req('GET', '/api/reports/labor-cost', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok('totalHours' in res.body);
        assert.ok('totalCost' in res.body);
        assert.ok('totalSales' in res.body);
        assert.ok('laborPct' in res.body);
        assert.ok('byRole' in res.body);
    });

    it('includes role breakdown', async () => {
        const res = await req('GET', '/api/reports/labor-cost', null, managerToken);
        // We have at least one timeclock entry from earlier tests
        const roles = Object.keys(res.body.byRole);
        if (roles.length > 0) {
            const role = res.body.byRole[roles[0]];
            assert.ok('hours' in role);
            assert.ok('cost' in role);
            assert.ok('employees' in role);
        }
    });
});

// ==========================================
// Server Performance Metrics
// ==========================================
describe('Server Performance Report', () => {
    it('server cannot access performance report', async () => {
        const res = await req('GET', '/api/reports/server-performance', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('manager can access server performance', async () => {
        const res = await req('GET', '/api/reports/server-performance', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.servers));
    });

    it('includes per-server metrics', async () => {
        const res = await req('GET', '/api/reports/server-performance', null, managerToken);
        if (res.body.servers.length > 0) {
            const s = res.body.servers[0];
            assert.ok('name' in s);
            assert.ok('tickets' in s);
            assert.ok('sales' in s);
            assert.ok('tips' in s);
            assert.ok('avgTicket' in s);
            assert.ok('tipPct' in s);
        }
    });

    it('sorts by sales descending', async () => {
        const res = await req('GET', '/api/reports/server-performance', null, managerToken);
        const servers = res.body.servers;
        for (let i = 1; i < servers.length; i++) {
            assert.ok(servers[i - 1].sales >= servers[i].sales);
        }
    });
});

// ==========================================
// Webhook Management
// ==========================================
describe('Webhook Management API', () => {
    it('server cannot manage webhooks', async () => {
        const res = await req('GET', '/api/webhooks', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('manager can list webhooks', async () => {
        const res = await req('GET', '/api/webhooks', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.webhooks));
        assert.ok(Array.isArray(res.body.supportedEvents));
    });

    it('creates a webhook', async () => {
        const res = await req('POST', '/api/webhooks', {
            url: 'https://example.com/hook',
            events: ['ticket.paid', 'kitchen.new'],
            secret: 'test-secret'
        }, managerToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.url, 'https://example.com/hook');
        assert.deepEqual(res.body.events, ['ticket.paid', 'kitchen.new']);
        assert.equal(res.body.active, true);
        assert.ok(res.body.id);
    });

    it('rejects webhook without URL', async () => {
        const res = await req('POST', '/api/webhooks', {
            events: ['ticket.paid']
        }, managerToken);

        assert.equal(res.status, 400);
    });

    it('rejects webhook without events', async () => {
        const res = await req('POST', '/api/webhooks', {
            url: 'https://example.com/hook',
            events: []
        }, managerToken);

        assert.equal(res.status, 400);
    });

    it('rejects webhook with invalid events', async () => {
        const res = await req('POST', '/api/webhooks', {
            url: 'https://example.com/hook',
            events: ['invalid.event']
        }, managerToken);

        assert.equal(res.status, 400);
        assert.ok(res.body.error.includes('Invalid'));
    });

    it('deletes a webhook', async () => {
        // Get the webhook we created
        const list = await req('GET', '/api/webhooks', null, managerToken);
        const hookId = list.body.webhooks[0].id;

        const res = await req('DELETE', `/api/webhooks/${hookId}`, null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.id, hookId);

        // Verify it's gone
        const after = await req('GET', '/api/webhooks', null, managerToken);
        assert.equal(after.body.webhooks.length, 0);
    });

    it('returns 404 for missing webhook', async () => {
        const res = await req('DELETE', '/api/webhooks/99999', null, managerToken);
        assert.equal(res.status, 404);
    });
});

// ==========================================
// State-Specific Surcharge Configuration
// ==========================================
describe('State-Specific Configuration', () => {
    it('gets empty state rules initially', async () => {
        const res = await req('GET', '/api/config/cashDiscount/state-rules', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.stateRules);
    });

    it('sets state rule', async () => {
        const res = await req('PUT', '/api/config/cashDiscount/state-rules/NY', {
            maxRate: 4.0,
            allowed: true,
            mode: 'CASH_DISCOUNT',
            label: 'NY Cash Discount'
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.state, 'NY');
        assert.equal(res.body.rule.maxRate, 4);
        assert.equal(res.body.rule.allowed, true);
    });

    it('normalizes state code to uppercase', async () => {
        const res = await req('PUT', '/api/config/cashDiscount/state-rules/ca', {
            maxRate: 0,
            allowed: false
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.state, 'CA');
        assert.equal(res.body.rule.allowed, false);
    });

    it('rejects invalid state code length', async () => {
        const res = await req('PUT', '/api/config/cashDiscount/state-rules/TEXAS', {
            maxRate: 3.0
        }, managerToken);

        assert.equal(res.status, 400);
    });

    it('deletes a state rule', async () => {
        const res = await req('DELETE', '/api/config/cashDiscount/state-rules/CA', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.state, 'CA');
    });

    it('returns 404 for missing state rule', async () => {
        const res = await req('DELETE', '/api/config/cashDiscount/state-rules/ZZ', null, managerToken);
        assert.equal(res.status, 404);
    });

    it('server cannot modify state rules', async () => {
        const res = await req('PUT', '/api/config/cashDiscount/state-rules/TX', {
            maxRate: 3.0
        }, serverToken);

        assert.equal(res.status, 403);
    });
});

// ==========================================
// Hourly Sales Heat Map
// ==========================================
describe('Hourly Sales Heat Map', () => {
    it('server cannot access heat map', async () => {
        const res = await req('GET', '/api/reports/hourly-heatmap', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('returns heat map grid', async () => {
        const res = await req('GET', '/api/reports/hourly-heatmap', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.heatmap);
        assert.ok(res.body.peak !== undefined);
        // Should have all 7 days
        const days = Object.keys(res.body.heatmap);
        assert.equal(days.length, 7);
    });

    it('each day has 24 hour slots', async () => {
        const res = await req('GET', '/api/reports/hourly-heatmap', null, managerToken);
        const firstDay = Object.values(res.body.heatmap)[0];
        assert.equal(Object.keys(firstDay).length, 24);
    });

    it('includes peak sales info', async () => {
        const res = await req('GET', '/api/reports/hourly-heatmap', null, managerToken);
        assert.ok('day' in res.body.peak);
        assert.ok('hour' in res.body.peak);
        assert.ok('sales' in res.body.peak);
    });
});

// ==========================================
// Category Margin Analysis
// ==========================================
describe('Category Margin Analysis', () => {
    it('server cannot access category-margin report', async () => {
        const res = await req('GET', '/api/reports/category-margin', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('creates ticket with categorized items', async () => {
        const res = await req('POST', '/api/tickets', {
            items: [
                { name: 'Steak', price: 35, qty: 1, category: 'Entrees', cost: 12 },
                { name: 'Beer', price: 7, qty: 2, category: 'Beverages', cost: 2 },
                { name: 'Cake', price: 9, qty: 1, category: 'Desserts', cost: 3 }
            ],
            type: 'dine-in'
        }, serverToken);
        assert.equal(res.status, 201);
    });

    it('returns category breakdown with margins', async () => {
        const res = await req('GET', '/api/reports/category-margin', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.categories));
        assert.ok(res.body.totalRevenue > 0);

        // Check structure of each category entry
        const cat = res.body.categories[0];
        assert.ok('category' in cat);
        assert.ok('revenue' in cat);
        assert.ok('cost' in cat);
        assert.ok('profit' in cat);
        assert.ok('marginPct' in cat);
        assert.ok('pctOfSales' in cat);
    });

    it('items without category go to Uncategorized', async () => {
        const res = await req('GET', '/api/reports/category-margin', null, managerToken);
        // Earlier tickets without category should be in Uncategorized
        const uncategorized = res.body.categories.find(c => c.category === 'Uncategorized');
        // Tickets from earlier tests had no category field
        assert.ok(uncategorized);
    });
});

// ==========================================
// Customer Profiles
// ==========================================
describe('Customer Profiles API', () => {
    it('GET /api/customers returns empty list initially', async () => {
        const res = await req('GET', '/api/customers');
        assert.equal(res.status, 200);
        assert.equal(res.body.customers.length, 0);
    });

    it('creates a customer', async () => {
        const res = await req('POST', '/api/customers', {
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '555-1234',
            tags: ['vip', 'regular']
        }, serverToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.name, 'Jane Doe');
        assert.equal(res.body.email, 'jane@example.com');
        assert.equal(res.body.loyaltyPoints, 0);
        assert.deepEqual(res.body.tags, ['vip', 'regular']);
        assert.ok(res.body.id);
    });

    it('rejects customer without name', async () => {
        const res = await req('POST', '/api/customers', {
            email: 'noname@example.com'
        }, serverToken);

        assert.equal(res.status, 400);
    });

    it('gets customer by ID', async () => {
        const res = await req('GET', '/api/customers/1');
        assert.equal(res.status, 200);
        assert.equal(res.body.name, 'Jane Doe');
    });

    it('returns 404 for missing customer', async () => {
        const res = await req('GET', '/api/customers/999');
        assert.equal(res.status, 404);
    });

    it('updates a customer', async () => {
        const res = await req('PATCH', '/api/customers/1', {
            phone: '555-9999',
            notes: 'Prefers window seat'
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.phone, '555-9999');
        assert.equal(res.body.notes, 'Prefers window seat');
    });

    it('searches customers by name', async () => {
        const res = await req('GET', '/api/customers?search=jane');
        assert.equal(res.status, 200);
        assert.equal(res.body.customers.length, 1);
    });

    it('filters by tag', async () => {
        const res = await req('GET', '/api/customers?tag=vip');
        assert.equal(res.status, 200);
        assert.equal(res.body.customers.length, 1);
    });

    it('deletes a customer (requires config permission)', async () => {
        // Server can't delete
        const fail = await req('DELETE', '/api/customers/1', null, serverToken);
        assert.equal(fail.status, 403);

        // Manager can delete
        const res = await req('DELETE', '/api/customers/1', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.name, 'Jane Doe');
    });
});

// ==========================================
// Gift Card Management
// ==========================================
describe('Gift Card Management API', () => {
    it('creates a gift card', async () => {
        const res = await req('POST', '/api/gift-cards', {
            code: 'GIFT100',
            initialBalance: 100,
            recipientName: 'Bob'
        }, managerToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.code, 'GIFT100');
        assert.equal(res.body.balance, 100);
        assert.equal(res.body.initialBalance, 100);
        assert.equal(res.body.active, true);
    });

    it('rejects duplicate gift card code', async () => {
        const res = await req('POST', '/api/gift-cards', {
            code: 'GIFT100',
            initialBalance: 50
        }, managerToken);

        assert.equal(res.status, 409);
    });

    it('rejects gift card with zero balance', async () => {
        const res = await req('POST', '/api/gift-cards', {
            code: 'EMPTY',
            initialBalance: 0
        }, managerToken);

        assert.equal(res.status, 400);
    });

    it('looks up gift card by code', async () => {
        const res = await req('GET', '/api/gift-cards/GIFT100');
        assert.equal(res.status, 200);
        assert.equal(res.body.balance, 100);
    });

    it('returns 404 for missing gift card', async () => {
        const res = await req('GET', '/api/gift-cards/INVALID');
        assert.equal(res.status, 404);
    });

    it('charges a gift card', async () => {
        const res = await req('POST', '/api/gift-cards/GIFT100/charge', {
            amount: 25,
            ticketId: 1001
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.charged, 25);
        assert.equal(res.body.card.balance, 75);
        assert.equal(res.body.card.transactions.length, 1);
    });

    it('rejects charge exceeding balance', async () => {
        const res = await req('POST', '/api/gift-cards/GIFT100/charge', {
            amount: 200
        }, serverToken);

        assert.equal(res.status, 400);
        assert.ok(res.body.error.includes('Insufficient'));
    });

    it('reloads a gift card', async () => {
        const res = await req('POST', '/api/gift-cards/GIFT100/reload', {
            amount: 50
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.reloaded, 50);
        assert.equal(res.body.card.balance, 125);
    });

    it('lists all gift cards', async () => {
        const res = await req('GET', '/api/gift-cards', null, serverToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.giftCards.length > 0);
    });
});

// ==========================================
// Digital Receipts
// ==========================================
describe('Digital Receipt API', () => {
    it('generates a receipt for a ticket', async () => {
        const res = await req('GET', '/api/tickets/1001/receipt');
        assert.equal(res.status, 200);
        assert.equal(res.body.ticketId, 1001);
        assert.ok(res.body.restaurantName);
        assert.ok(Array.isArray(res.body.items));
        assert.ok('subtotal' in res.body);
        assert.ok('tax' in res.body);
        assert.ok('total' in res.body);
        assert.ok('grandTotal' in res.body);
        assert.ok(res.body.generatedAt);
        assert.ok(res.body.footer);
    });

    it('includes dual pricing when enabled', async () => {
        const res = await req('GET', '/api/tickets/1001/receipt');
        // Cash discount is enabled in default config
        assert.ok('cashPrice' in res.body);
        assert.ok('cardPrice' in res.body);
    });

    it('returns 404 for missing ticket', async () => {
        const res = await req('GET', '/api/tickets/99999/receipt');
        assert.equal(res.status, 404);
    });
});

// ==========================================
// Promo Code Engine
// ==========================================
describe('Promo Code Engine', () => {
    it('creates a percent promo code', async () => {
        const res = await req('POST', '/api/promo-codes', {
            code: 'SAVE10',
            type: 'percent',
            value: 10,
            minOrder: 20,
            maxUses: 100,
            description: '10% off orders over $20'
        }, managerToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.code, 'SAVE10');
        assert.equal(res.body.type, 'percent');
        assert.equal(res.body.value, 10);
        assert.equal(res.body.usedCount, 0);
    });

    it('creates a fixed promo code', async () => {
        const res = await req('POST', '/api/promo-codes', {
            code: 'FLAT5',
            type: 'fixed',
            value: 5,
            description: '$5 off any order'
        }, managerToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.type, 'fixed');
    });

    it('rejects duplicate promo code', async () => {
        const res = await req('POST', '/api/promo-codes', {
            code: 'save10',
            type: 'percent',
            value: 5
        }, managerToken);

        assert.equal(res.status, 409);
    });

    it('rejects invalid type', async () => {
        const res = await req('POST', '/api/promo-codes', {
            code: 'BAD',
            type: 'bogus',
            value: 5
        }, managerToken);

        assert.equal(res.status, 400);
    });

    it('validates a percent promo code', async () => {
        const res = await req('POST', '/api/promo-codes/validate', {
            code: 'SAVE10',
            orderTotal: 50
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.valid, true);
        assert.equal(res.body.discount, 5); // 10% of 50
    });

    it('validates a fixed promo code', async () => {
        const res = await req('POST', '/api/promo-codes/validate', {
            code: 'FLAT5',
            orderTotal: 30
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.discount, 5);
    });

    it('rejects promo for order below minimum', async () => {
        const res = await req('POST', '/api/promo-codes/validate', {
            code: 'SAVE10',
            orderTotal: 10
        }, serverToken);

        assert.equal(res.status, 400);
        assert.ok(res.body.error.includes('minimum'));
    });

    it('rejects invalid promo code', async () => {
        const res = await req('POST', '/api/promo-codes/validate', {
            code: 'NONEXISTENT',
            orderTotal: 50
        }, serverToken);

        assert.equal(res.status, 404);
    });

    it('redeems a promo code (increments count)', async () => {
        const list = await req('GET', '/api/promo-codes', null, managerToken);
        const promoId = list.body.promoCodes.find(p => p.code === 'SAVE10').id;

        const res = await req('POST', `/api/promo-codes/${promoId}/redeem`, {}, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.usedCount, 1);
    });

    it('lists all promo codes', async () => {
        const res = await req('GET', '/api/promo-codes', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.promoCodes.length >= 2);
    });

    it('deletes a promo code', async () => {
        const list = await req('GET', '/api/promo-codes', null, managerToken);
        const flatId = list.body.promoCodes.find(p => p.code === 'FLAT5').id;

        const res = await req('DELETE', `/api/promo-codes/${flatId}`, null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.code, 'FLAT5');
    });

    it('server cannot create promo codes', async () => {
        const res = await req('POST', '/api/promo-codes', {
            code: 'HACK',
            type: 'percent',
            value: 99
        }, serverToken);

        assert.equal(res.status, 403);
    });
});
