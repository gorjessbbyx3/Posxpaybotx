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
            store.onlineOrders.length = 0;
            store.fraudAlerts.length = 0;
            store.ingredients.length = 0;
            store.inventoryMovements.length = 0;
            store.scheduledOrders.length = 0;
            store.vendors.length = 0;
            store.purchaseOrders.length = 0;
            store.wasteLog.length = 0;
            store.recipes.length = 0;
            store.waitlist.length = 0;
            store.reservations.length = 0;
            store.savedPaymentMethods.length = 0;
            store.emailCampaigns.length = 0;
            store.qrOrders.length = 0;
            store.deliveryIntegrations.length = 0;
            store.tokenVault.length = 0;
            store.backups.length = 0;
            store.merchants.length = 0;
            store.plugins.length = 0;
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

// ==========================================
// Seat-Level Ordering & Split Checks by Seat
// ==========================================
describe('Seat-Level Ordering & Split by Seat', () => {
    let seatTicketId;

    it('creates ticket with multiple items for seat splitting', async () => {
        const res = await req('POST', '/api/tickets', {
            items: [
                { name: 'Steak', price: 30, qty: 1 },
                { name: 'Salmon', price: 25, qty: 1 },
                { name: 'Salad', price: 12, qty: 1 },
                { name: 'Wine', price: 10, qty: 2 }
            ],
            type: 'dine-in',
            table: 7
        }, serverToken);

        assert.equal(res.status, 201);
        seatTicketId = res.body.id;
    });

    it('assigns items to seats', async () => {
        const res = await req('POST', `/api/tickets/${seatTicketId}/seats`, {
            seats: { "1": [0, 3], "2": [1, 2] }
        }, serverToken);

        assert.equal(res.status, 200);
        assert.ok(res.body.seats);
        assert.deepEqual(res.body.seats["1"], [0, 3]);
    });

    it('splits check by seat with correct totals', async () => {
        const res = await req('GET', `/api/tickets/${seatTicketId}/split-by-seat`, null, serverToken);

        assert.equal(res.status, 200);
        assert.ok(res.body.checks);
        assert.ok(res.body.checks["1"]);
        assert.ok(res.body.checks["2"]);

        // Seat 1: Steak(30) + Wine(10*2=20) = 50
        assert.equal(res.body.checks["1"].subtotal, 50);
        // Seat 2: Salmon(25) + Salad(12) = 37
        assert.equal(res.body.checks["2"].subtotal, 37);

        // Each should have tax
        assert.ok(res.body.checks["1"].tax > 0);
        assert.ok(res.body.checks["2"].tax > 0);
    });

    it('rejects seats without proper object', async () => {
        const res = await req('POST', `/api/tickets/${seatTicketId}/seats`, {}, serverToken);
        assert.equal(res.status, 400);
    });

    it('returns 404 for missing ticket seat split', async () => {
        const res = await req('GET', '/api/tickets/99999/split-by-seat', null, serverToken);
        assert.equal(res.status, 404);
    });
});

// ==========================================
// Expo Screen
// ==========================================
describe('Expo Screen API', () => {
    it('returns expo view with ready and in-progress', async () => {
        const res = await req('GET', '/api/kitchen/expo');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.ready));
        assert.ok(Array.isArray(res.body.inProgress));
        assert.ok('readyCount' in res.body);
        assert.ok('inProgressCount' in res.body);
    });

    it('creates and bumps order, shows as ready in expo', async () => {
        // Create kitchen order
        const create = await req('POST', '/api/kitchen', {
            ticketId: 8001,
            items: [{ name: 'Pasta', station: 'grill', qty: 1 }],
            type: 'dine-in',
            table: 10
        }, kitchenToken);
        assert.equal(create.status, 201);

        // Bump it
        await req('POST', '/api/kitchen/8001/bump', {}, kitchenToken);

        // Check expo
        const expo = await req('GET', '/api/kitchen/expo');
        assert.equal(expo.status, 200);
        const readyOrder = expo.body.ready.find(o => o.id === 8001);
        assert.ok(readyOrder);
        assert.equal(readyOrder.table, 10);
        assert.ok('waitTime' in readyOrder);
    });

    it('marks order as picked up from expo', async () => {
        const res = await req('POST', '/api/kitchen/8001/pickup', {}, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.pickedUp, true);

        // Should no longer appear in expo ready
        const expo = await req('GET', '/api/kitchen/expo');
        const gone = expo.body.ready.find(o => o.id === 8001);
        assert.equal(gone, undefined);
    });

    it('returns 404 for pickup of missing order', async () => {
        const res = await req('POST', '/api/kitchen/99999/pickup', {}, serverToken);
        assert.equal(res.status, 404);
    });
});

// ==========================================
// Loyalty Points System
// ==========================================
describe('Loyalty Points API', () => {
    let loyaltyCustomerId;

    it('creates customer for loyalty testing', async () => {
        const res = await req('POST', '/api/customers', {
            name: 'Loyalty Larry',
            email: 'larry@example.com'
        }, serverToken);

        assert.equal(res.status, 201);
        loyaltyCustomerId = res.body.id;
    });

    it('gets loyalty status (starts at 0)', async () => {
        const res = await req('GET', `/api/customers/${loyaltyCustomerId}/loyalty`);
        assert.equal(res.status, 200);
        assert.equal(res.body.points, 0);
        assert.equal(res.body.redeemableRewards, 0);
        assert.ok(res.body.pointsToNextReward > 0);
        assert.ok(res.body.config);
    });

    it('earns loyalty points', async () => {
        const res = await req('POST', `/api/customers/${loyaltyCustomerId}/loyalty/earn`, {
            amount: 50
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.earned, 50);
        assert.equal(res.body.totalPoints, 50);
        assert.equal(res.body.totalSpent, 50);
        assert.equal(res.body.visitCount, 1);
    });

    it('earns more points with multiplier', async () => {
        const res = await req('POST', `/api/customers/${loyaltyCustomerId}/loyalty/earn`, {
            amount: 30,
            multiplier: 2
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.earned, 60); // 30 * 1pt/$ * 2x
        assert.equal(res.body.totalPoints, 110);
    });

    it('redeems a reward', async () => {
        const res = await req('POST', `/api/customers/${loyaltyCustomerId}/loyalty/redeem`, {
            rewards: 1
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.redeemed, 1);
        assert.equal(res.body.pointsUsed, 100);
        assert.equal(res.body.dollarValue, 5);
        assert.equal(res.body.remainingPoints, 10);
    });

    it('rejects redemption with insufficient points', async () => {
        const res = await req('POST', `/api/customers/${loyaltyCustomerId}/loyalty/redeem`, {
            rewards: 1
        }, serverToken);

        assert.equal(res.status, 400);
        assert.ok(res.body.error.includes('Insufficient'));
    });

    it('returns 404 for missing customer loyalty', async () => {
        const res = await req('GET', '/api/customers/99999/loyalty');
        assert.equal(res.status, 404);
    });
});

// ==========================================
// Online Order Queue
// ==========================================
describe('Online Order Queue', () => {
    let onlineOrderId;

    it('creates an online order (no auth required)', async () => {
        const res = await req('POST', '/api/online-orders', {
            customerName: 'Online Alice',
            customerPhone: '555-8888',
            items: [
                { name: 'Pizza', price: 18, qty: 1 },
                { name: 'Garlic Bread', price: 6, qty: 1 }
            ],
            type: 'pickup'
        });

        assert.equal(res.status, 201);
        onlineOrderId = res.body.id;
        assert.equal(res.body.status, 'pending');
        assert.equal(res.body.customerName, 'Online Alice');
        assert.ok(res.body.total > 0);
    });

    it('rejects online order without items', async () => {
        const res = await req('POST', '/api/online-orders', {
            customerName: 'Bob',
            items: []
        });
        assert.equal(res.status, 400);
    });

    it('rejects online order without customer name', async () => {
        const res = await req('POST', '/api/online-orders', {
            items: [{ name: 'Test', price: 5, qty: 1 }]
        });
        assert.equal(res.status, 400);
    });

    it('lists online orders', async () => {
        const res = await req('GET', '/api/online-orders', null, serverToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.orders.length > 0);
    });

    it('filters online orders by status', async () => {
        const res = await req('GET', '/api/online-orders?status=pending', null, serverToken);
        assert.equal(res.status, 200);
        res.body.orders.forEach(o => assert.equal(o.status, 'pending'));
    });

    it('accepts online order (creates ticket)', async () => {
        const res = await req('POST', `/api/online-orders/${onlineOrderId}/accept`, {}, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.order.status, 'accepted');
        assert.ok(res.body.ticket);
        assert.ok(res.body.ticket.id);
        assert.equal(res.body.ticket.onlineOrderId, onlineOrderId);
    });

    it('rejects accepting non-pending order', async () => {
        const res = await req('POST', `/api/online-orders/${onlineOrderId}/accept`, {}, serverToken);
        assert.equal(res.status, 400);
    });

    it('rejects an online order', async () => {
        // Create another online order to reject
        const create = await req('POST', '/api/online-orders', {
            customerName: 'Reject Bob',
            items: [{ name: 'Wings', price: 12, qty: 1 }],
            type: 'delivery'
        });
        const res = await req('POST', `/api/online-orders/${create.body.id}/reject`, {
            reason: 'Kitchen is closing'
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'rejected');
        assert.equal(res.body.rejectReason, 'Kitchen is closing');
    });
});

// ==========================================
// Fraud Detection Alerts
// ==========================================
describe('Fraud Detection Alerts', () => {
    it('server cannot access fraud alerts', async () => {
        const res = await req('GET', '/api/fraud-alerts', null, serverToken);
        assert.equal(res.status, 403);
    });

    it('runs fraud scan', async () => {
        const res = await req('POST', '/api/fraud-alerts/scan', {}, managerToken);
        assert.equal(res.status, 200);
        assert.ok('scanned' in res.body);
        assert.ok('newAlerts' in res.body);
        assert.ok('totalAlerts' in res.body);
    });

    it('lists fraud alerts', async () => {
        const res = await req('GET', '/api/fraud-alerts', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.alerts));
    });

    it('filters by severity', async () => {
        const res = await req('GET', '/api/fraud-alerts?severity=high', null, managerToken);
        assert.equal(res.status, 200);
        res.body.alerts.forEach(a => assert.equal(a.severity, 'high'));
    });

    it('resolves an alert', async () => {
        // Add a manual alert to resolve
        store.fraudAlerts.push({
            id: store.fraudAlerts.length + 1,
            type: 'test',
            severity: 'low',
            message: 'Test alert',
            time: new Date().toISOString(),
            resolved: false
        });

        const alertId = store.fraudAlerts[store.fraudAlerts.length - 1].id;
        const res = await req('POST', `/api/fraud-alerts/${alertId}/resolve`, {
            resolution: 'Investigated - false positive'
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.resolved, true);
        assert.equal(res.body.resolution, 'Investigated - false positive');
    });

    it('filters resolved/unresolved alerts', async () => {
        const res = await req('GET', '/api/fraud-alerts?resolved=true', null, managerToken);
        assert.equal(res.status, 200);
        res.body.alerts.forEach(a => assert.equal(a.resolved, true));
    });

    it('returns 404 for missing alert', async () => {
        const res = await req('POST', '/api/fraud-alerts/99999/resolve', {}, managerToken);
        assert.equal(res.status, 404);
    });
});

// ==========================================
// Modifier Profitability Report
// ==========================================
describe('Modifier Profitability Report', () => {
    it('creates ticket with modifiers', async () => {
        const res = await req('POST', '/api/tickets', {
            items: [
                {
                    name: 'Burger', price: 12, qty: 1, cost: 4,
                    modifiers: [
                        { name: 'Extra Cheese', price: 1.50, cost: 0.30 },
                        { name: 'Bacon', price: 2.00, cost: 0.50 }
                    ]
                },
                {
                    name: 'Fries', price: 5, qty: 1, cost: 1,
                    modifiers: [
                        { name: 'Extra Cheese', price: 1.50, cost: 0.30 }
                    ]
                }
            ],
            type: 'dine-in'
        }, serverToken);
        assert.equal(res.status, 201);
    });

    it('returns modifier profitability breakdown', async () => {
        const res = await req('GET', '/api/reports/modifier-profitability', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.modifiers));
        assert.ok(res.body.totalModifierRevenue > 0);

        const cheese = res.body.modifiers.find(m => m.name === 'Extra Cheese');
        assert.ok(cheese);
        assert.equal(cheese.count, 2);
        assert.equal(cheese.revenue, 3); // 1.50 * 2
        assert.ok(cheese.marginPct > 0);
    });

    it('server cannot access modifier report', async () => {
        const res = await req('GET', '/api/reports/modifier-profitability', null, serverToken);
        assert.equal(res.status, 403);
    });
});

// ==========================================
// Food Cost Tracking Report
// ==========================================
describe('Food Cost Tracking Report', () => {
    it('returns food cost data', async () => {
        const res = await req('GET', '/api/reports/food-cost', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok('totalRevenue' in res.body);
        assert.ok('totalFoodCost' in res.body);
        assert.ok('totalProfit' in res.body);
        assert.ok('overallFoodCostPct' in res.body);
        assert.ok(Array.isArray(res.body.items));
    });

    it('includes per-item food cost percentage', async () => {
        const res = await req('GET', '/api/reports/food-cost', null, managerToken);
        if (res.body.items.length > 0) {
            const item = res.body.items[0];
            assert.ok('name' in item);
            assert.ok('revenue' in item);
            assert.ok('cost' in item);
            assert.ok('profit' in item);
            assert.ok('foodCostPct' in item);
        }
    });

    it('server cannot access food-cost report', async () => {
        const res = await req('GET', '/api/reports/food-cost', null, serverToken);
        assert.equal(res.status, 403);
    });
});

// ==========================================
// Ingredient-Level Tracking
// ==========================================
describe('Ingredient Tracking API', () => {
    it('creates an ingredient', async () => {
        const res = await req('POST', '/api/ingredients', {
            name: 'Tomatoes',
            unit: 'lbs',
            stock: 50,
            lowThreshold: 10,
            cost: 2.50,
            supplier: 'Farm Fresh',
            category: 'Produce'
        }, managerToken);

        assert.equal(res.status, 201);
        assert.equal(res.body.name, 'Tomatoes');
        assert.equal(res.body.stock, 50);
        assert.equal(res.body.unit, 'lbs');
    });

    it('creates another ingredient', async () => {
        const res = await req('POST', '/api/ingredients', {
            name: 'Chicken Breast',
            unit: 'lbs',
            stock: 30,
            lowThreshold: 5,
            cost: 4.50,
            supplier: 'Meat Co',
            category: 'Protein'
        }, managerToken);
        assert.equal(res.status, 201);
    });

    it('rejects ingredient without name', async () => {
        const res = await req('POST', '/api/ingredients', {
            unit: 'oz'
        }, managerToken);
        assert.equal(res.status, 400);
    });

    it('lists all ingredients', async () => {
        const res = await req('GET', '/api/ingredients', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.ingredients.length, 2);
    });

    it('searches ingredients', async () => {
        const res = await req('GET', '/api/ingredients?search=tomato', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.ingredients.length, 1);
    });

    it('updates an ingredient', async () => {
        const res = await req('PATCH', '/api/ingredients/1', {
            stock: 45,
            cost: 2.75
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.stock, 45);
        assert.equal(res.body.cost, 2.75);
    });

    it('server cannot manage ingredients', async () => {
        const res = await req('POST', '/api/ingredients', {
            name: 'Salt', unit: 'oz', stock: 100
        }, serverToken);
        assert.equal(res.status, 403);
    });
});

// ==========================================
// Inventory Depletion Tracking
// ==========================================
describe('Inventory Depletion Tracking', () => {
    it('adjusts ingredient stock (usage)', async () => {
        const res = await req('POST', '/api/ingredients/1/adjust', {
            quantity: -5,
            reason: 'Daily prep',
            type: 'usage'
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.ingredient.stock, 40); // was 45
        assert.equal(res.body.movement.type, 'usage');
        assert.equal(res.body.movement.quantity, -5);
    });

    it('adjusts ingredient stock (restock)', async () => {
        const res = await req('POST', '/api/ingredients/1/adjust', {
            quantity: 20,
            reason: 'Delivery received',
            type: 'restock'
        }, managerToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.ingredient.stock, 60); // was 40
        assert.equal(res.body.movement.type, 'restock');
    });

    it('rejects zero quantity adjustment', async () => {
        const res = await req('POST', '/api/ingredients/1/adjust', {
            quantity: 0
        }, managerToken);
        assert.equal(res.status, 400);
    });

    it('lists inventory movements', async () => {
        const res = await req('GET', '/api/inventory-movements', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.movements.length >= 2);
    });

    it('filters movements by type', async () => {
        const res = await req('GET', '/api/inventory-movements?type=usage', null, managerToken);
        assert.equal(res.status, 200);
        res.body.movements.forEach(m => assert.equal(m.type, 'usage'));
    });

    it('returns depletion report', async () => {
        const res = await req('GET', '/api/reports/inventory-depletion', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.items));
        if (res.body.items.length > 0) {
            assert.ok('name' in res.body.items[0]);
            assert.ok('totalUsed' in res.body.items[0]);
        }
    });
});

// ==========================================
// Low-Stock Alerts
// ==========================================
describe('Low-Stock Alerts', () => {
    it('detects low stock ingredients', async () => {
        // Deplete Chicken Breast below threshold (stock 30, threshold 5)
        await req('POST', '/api/ingredients/2/adjust', {
            quantity: -26,
            reason: 'Busy night'
        }, managerToken);

        const res = await req('GET', '/api/alerts/low-stock', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.lowStockCount > 0);
        assert.ok(res.body.lowStock.length > 0);

        const chicken = res.body.lowStock.find(i => i.name === 'Chicken Breast');
        assert.ok(chicken);
        assert.equal(chicken.stock, 4);
    });

    it('includes out-of-stock items', async () => {
        const res = await req('GET', '/api/alerts/low-stock', null, managerToken);
        assert.ok('outOfStock' in res.body);
        assert.ok('outOfStockCount' in res.body);
    });

    it('server cannot access low-stock alerts', async () => {
        const res = await req('GET', '/api/alerts/low-stock', null, serverToken);
        assert.equal(res.status, 403);
    });
});

// ==========================================
// Scheduled Orders
// ==========================================
describe('Scheduled Orders', () => {
    let scheduledId;

    it('creates a scheduled order (no auth required)', async () => {
        const res = await req('POST', '/api/scheduled-orders', {
            customerName: 'Schedule Sam',
            customerPhone: '555-3333',
            items: [
                { name: 'Catering Platter', price: 75, qty: 2 },
                { name: 'Drinks Pack', price: 25, qty: 1 }
            ],
            scheduledFor: '2026-03-01T18:00:00Z',
            type: 'pickup'
        });

        assert.equal(res.status, 201);
        scheduledId = res.body.id;
        assert.equal(res.body.status, 'scheduled');
        assert.equal(res.body.customerName, 'Schedule Sam');
        assert.ok(res.body.total > 0);
    });

    it('rejects scheduled order without time', async () => {
        const res = await req('POST', '/api/scheduled-orders', {
            customerName: 'Bob',
            items: [{ name: 'Test', price: 10, qty: 1 }]
        });
        assert.equal(res.status, 400);
    });

    it('rejects scheduled order without items', async () => {
        const res = await req('POST', '/api/scheduled-orders', {
            customerName: 'Bob',
            items: [],
            scheduledFor: '2026-03-01T18:00:00Z'
        });
        assert.equal(res.status, 400);
    });

    it('lists scheduled orders', async () => {
        const res = await req('GET', '/api/scheduled-orders', null, serverToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.orders.length > 0);
    });

    it('confirms a scheduled order', async () => {
        const res = await req('POST', `/api/scheduled-orders/${scheduledId}/confirm`, {}, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'confirmed');
    });

    it('rejects confirming non-scheduled order', async () => {
        const res = await req('POST', `/api/scheduled-orders/${scheduledId}/confirm`, {}, serverToken);
        assert.equal(res.status, 400);
    });

    it('cancels a scheduled order', async () => {
        // Create another to cancel
        const create = await req('POST', '/api/scheduled-orders', {
            customerName: 'Cancel Cathy',
            items: [{ name: 'Cake', price: 30, qty: 1 }],
            scheduledFor: '2026-03-02T12:00:00Z'
        });
        const res = await req('POST', `/api/scheduled-orders/${create.body.id}/cancel`, {
            reason: 'Customer changed plans'
        }, serverToken);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'cancelled');
        assert.equal(res.body.cancelReason, 'Customer changed plans');
    });
});

// ==========================================
// Curbside Pickup Mode
// ==========================================
describe('Curbside Pickup API', () => {
    it('creates a curbside ticket', async () => {
        const res = await req('POST', '/api/tickets', {
            items: [{ name: 'Takeout Combo', price: 18, qty: 1 }],
            type: 'curbside',
            server: 'John'
        }, serverToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.type, 'curbside');
    });

    it('lists curbside orders', async () => {
        const res = await req('GET', '/api/curbside', null, serverToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.orders));
        assert.ok(res.body.orders.length > 0);
        assert.equal(res.body.orders[0].source, 'ticket');
    });

    it('records curbside arrival', async () => {
        // Get the curbside ticket ID
        const curbside = await req('GET', '/api/curbside', null, serverToken);
        const ticketId = curbside.body.orders[0].id;

        const res = await req('POST', `/api/tickets/${ticketId}/curbside-arrival`, {
            vehicleInfo: 'Red Toyota Camry',
            notes: 'Parked in spot 3'
        }, serverToken);

        assert.equal(res.status, 200);
        assert.ok(res.body.arrivedAt);
        assert.equal(res.body.vehicleInfo, 'Red Toyota Camry');
    });

    it('returns 404 for missing ticket arrival', async () => {
        const res = await req('POST', '/api/tickets/99999/curbside-arrival', {}, serverToken);
        assert.equal(res.status, 404);
    });
});


// ==========================================
// Batch 6: Recipe Costing
// ==========================================
describe('Recipe Costing', () => {
    it('creates a recipe with cost calculation', async () => {
        // First add an ingredient
        const ing = await req('POST', '/api/ingredients', { name: 'Flour', unit: 'kg', quantity: 50, costPerUnit: 2.50, lowStockThreshold: 10 }, managerToken);
        assert.equal(ing.status, 201);

        const res = await req('POST', '/api/recipes', {
            name: 'Pizza Dough',
            ingredients: [{ ingredientId: ing.body.id, quantity: 0.5 }],
            prepTime: 30, yield: 4
        }, managerToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.name, 'Pizza Dough');
        assert.equal(res.body.totalCost, 1.25);
        assert.equal(res.body.costPerServing, 0.31);
    });

    it('lists recipes', async () => {
        const res = await req('GET', '/api/recipes', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
        assert.ok(res.body.length >= 1);
    });

    it('rejects recipe without name', async () => {
        const res = await req('POST', '/api/recipes', { ingredients: [] }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 6: Vendor Tracking
// ==========================================
describe('Vendor Tracking', () => {
    it('creates a vendor', async () => {
        const res = await req('POST', '/api/vendors', {
            name: 'Fresh Foods Inc', contact: 'Bob', email: 'bob@fresh.com', phone: '555-1234', category: 'produce'
        }, managerToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.name, 'Fresh Foods Inc');
        assert.equal(res.body.category, 'produce');
    });

    it('lists vendors', async () => {
        const res = await req('GET', '/api/vendors', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects vendor without name', async () => {
        const res = await req('POST', '/api/vendors', { email: 'test@test.com' }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 6: Purchase Orders
// ==========================================
describe('Purchase Order Generation', () => {
    it('creates a purchase order', async () => {
        const res = await req('POST', '/api/purchase-orders', {
            vendorId: 1, items: [{ name: 'Tomatoes', quantity: 50, unitCost: 1.20 }], notes: 'Urgent'
        }, managerToken);
        assert.equal(res.status, 201);
        assert.ok(res.body.id.startsWith('PO-'));
        assert.equal(res.body.total, 60);
        assert.equal(res.body.status, 'pending');
    });

    it('lists purchase orders', async () => {
        const res = await req('GET', '/api/purchase-orders', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects PO without vendor or items', async () => {
        const res = await req('POST', '/api/purchase-orders', { vendorId: 1 }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 6: Waste Logging
// ==========================================
describe('Waste Logging', () => {
    it('logs waste', async () => {
        const res = await req('POST', '/api/waste-log', {
            ingredientId: 1, quantity: 5, reason: 'expired', cost: 12.50
        }, managerToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.reason, 'expired');
        assert.equal(res.body.cost, 12.50);
    });

    it('lists waste log', async () => {
        const res = await req('GET', '/api/waste-log', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects waste log without ingredient', async () => {
        const res = await req('POST', '/api/waste-log', { quantity: 5 }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 6: Email Order Ready Alerts
// ==========================================
describe('Email Order Ready Alerts', () => {
    it('sends order ready alert', async () => {
        // Create a kitchen order first
        const ko = await req('POST', '/api/kitchen', { ticketId: 1001, items: [{ name: 'Burger', quantity: 1 }], station: 'grill' }, managerToken);
        const res = await req('POST', `/api/kitchen/${ko.body.id}/alert`, { email: 'customer@test.com' }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.alert.type, 'order_ready');
    });

    it('returns 404 for invalid kitchen order', async () => {
        const res = await req('POST', '/api/kitchen/99999/alert', {}, managerToken);
        assert.equal(res.status, 404);
    });
});

// ==========================================
// Batch 6: Waitlist Management
// ==========================================
describe('Waitlist Management', () => {
    it('adds to waitlist without auth', async () => {
        const res = await req('POST', '/api/waitlist', { name: 'Smith Family', partySize: 4, phone: '555-0001' });
        assert.equal(res.status, 201);
        assert.equal(res.body.status, 'waiting');
        assert.equal(res.body.estimatedWait, 20);
    });

    it('lists active waitlist', async () => {
        const res = await req('GET', '/api/waitlist');
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
        assert.equal(res.body[0].status, 'waiting');
    });

    it('seats a waitlist entry', async () => {
        const list = await req('GET', '/api/waitlist');
        const res = await req('PATCH', `/api/waitlist/${list.body[0].id}`, { status: 'seated' }, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'seated');
        assert.ok(res.body.seatedAt);
    });

    it('rejects waitlist without name', async () => {
        const res = await req('POST', '/api/waitlist', { partySize: 2 });
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 6: Reservations
// ==========================================
describe('Reservations', () => {
    it('creates a reservation without auth', async () => {
        const res = await req('POST', '/api/reservations', {
            name: 'Johnson', partySize: 6, date: '2026-03-15', time: '19:00', phone: '555-9999', email: 'j@test.com'
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.status, 'confirmed');
        assert.equal(res.body.partySize, 6);
    });

    it('lists reservations by date', async () => {
        const res = await req('GET', '/api/reservations?date=2026-03-15');
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('cancels a reservation', async () => {
        const list = await req('GET', '/api/reservations?date=2026-03-15');
        const res = await req('DELETE', `/api/reservations/${list.body[0].id}`, null, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'cancelled');
    });

    it('rejects reservation without required fields', async () => {
        const res = await req('POST', '/api/reservations', { name: 'Test' });
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 7: Saved Payment Methods
// ==========================================
describe('Saved Payment Methods', () => {
    it('saves a payment method', async () => {
        const res = await req('POST', '/api/saved-payment-methods', {
            customerId: 'C1', type: 'credit', lastFour: '4242', expiryMonth: 6, expiryYear: 2028
        }, serverToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.lastFour, '4242');
        assert.ok(res.body.token.startsWith('tok_'));
    });

    it('lists saved payment methods', async () => {
        const res = await req('GET', '/api/saved-payment-methods', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('filters by customerId', async () => {
        const res = await req('GET', '/api/saved-payment-methods?customerId=C1', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects without required fields', async () => {
        const res = await req('POST', '/api/saved-payment-methods', { type: 'credit' }, serverToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 7: Email Marketing
// ==========================================
describe('Email Marketing Campaigns', () => {
    it('creates a campaign', async () => {
        const res = await req('POST', '/api/email-campaigns', {
            name: 'Summer Special', subject: '20% Off This Week', body: 'Come visit us!', targetSegment: 'loyalty'
        }, managerToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.status, 'draft');
        assert.equal(res.body.name, 'Summer Special');
    });

    it('lists campaigns', async () => {
        const res = await req('GET', '/api/email-campaigns', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('sends a campaign', async () => {
        const list = await req('GET', '/api/email-campaigns', null, managerToken);
        const res = await req('POST', `/api/email-campaigns/${list.body[0].id}/send`, {}, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'sent');
        assert.ok(res.body.sentAt);
    });

    it('rejects campaign without name/subject', async () => {
        const res = await req('POST', '/api/email-campaigns', { body: 'test' }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 7: QR Table Ordering
// ==========================================
describe('QR Table Ordering', () => {
    it('creates a QR order without auth', async () => {
        const res = await req('POST', '/api/qr-orders', {
            tableNumber: 5, items: [{ name: 'Pasta', price: 14.99, quantity: 2 }], customerName: 'Alice'
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.tableNumber, 5);
        assert.equal(res.body.total, 29.98);
        assert.equal(res.body.status, 'pending');
    });

    it('lists active QR orders', async () => {
        const res = await req('GET', '/api/qr-orders');
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects QR order without table/items', async () => {
        const res = await req('POST', '/api/qr-orders', { tableNumber: 1 });
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 7: Delivery Integrations
// ==========================================
describe('Delivery Integrations', () => {
    it('creates a delivery integration', async () => {
        const res = await req('POST', '/api/delivery-integrations', {
            platform: 'DoorDash', apiKey: 'dd_key_123', storeId: 'store_456'
        }, managerToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.platform, 'DoorDash');
        assert.equal(res.body.enabled, true);
    });

    it('lists integrations', async () => {
        const res = await req('GET', '/api/delivery-integrations', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects without platform', async () => {
        const res = await req('POST', '/api/delivery-integrations', { apiKey: 'test' }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 7: Tokenized Card Storage
// ==========================================
describe('Tokenized Card Storage', () => {
    it('stores a tokenized card', async () => {
        const res = await req('POST', '/api/token-vault', {
            customerId: 'C1', lastFour: '1234', cardBrand: 'Visa'
        }, serverToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.lastFour, '1234');
        assert.ok(res.body.token.startsWith('tok_'));
    });

    it('lists tokens with masked values', async () => {
        const res = await req('GET', '/api/token-vault', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body[0].token.endsWith('...'));
    });

    it('rejects without lastFour', async () => {
        const res = await req('POST', '/api/token-vault', { cardBrand: 'MC' }, serverToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 7: Partial Payments
// ==========================================
describe('Partial Payments', () => {
    it('makes a partial payment on a ticket', async () => {
        const ticket = await req('POST', '/api/tickets', {
            items: [{ name: 'Steak', price: 45.00, qty: 1 }], server: 'John'
        }, serverToken);
        const res = await req('POST', `/api/tickets/${ticket.body.id}/partial-pay`, {
            amount: 20.00, method: 'cash'
        }, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.amountPaid, 20);
        assert.ok(res.body.remainingBalance > 0);
    });

    it('fully pays with multiple partial payments', async () => {
        const ticket = await req('POST', '/api/tickets', {
            items: [{ name: 'Wine', price: 30.00, qty: 1 }], server: 'John'
        }, serverToken);
        const total = ticket.body.total; // includes tax
        await req('POST', `/api/tickets/${ticket.body.id}/partial-pay`, { amount: 20.00 }, serverToken);
        const res = await req('POST', `/api/tickets/${ticket.body.id}/partial-pay`, { amount: total - 20.00 + 1 }, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'paid');
        assert.ok(res.body.remainingBalance <= 0);
    });

    it('rejects invalid amount', async () => {
        const res = await req('POST', '/api/tickets/1001/partial-pay', { amount: 0 }, serverToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 8: QuickBooks Export
// ==========================================
describe('QuickBooks Export', () => {
    it('exports data in QuickBooks format', async () => {
        const res = await req('GET', '/api/export/quickbooks', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.format, 'quickbooks_iif');
        assert.ok(Array.isArray(res.body.entries));
        assert.ok(res.body.entries.length === 4);
        assert.equal(res.body.entries[0].account, 'Sales Revenue');
    });
});

// ==========================================
// Batch 8: Automated Email Reports
// ==========================================
describe('Automated Email Reports', () => {
    it('gets email report config', async () => {
        const res = await req('GET', '/api/email-reports', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.enabled, false);
    });

    it('configures email reports', async () => {
        const res = await req('POST', '/api/email-reports', {
            enabled: true, schedule: 'weekly', recipients: ['owner@restaurant.com']
        }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.enabled, true);
        assert.equal(res.body.schedule, 'weekly');
        assert.equal(res.body.recipients.length, 1);
    });
});

// ==========================================
// Batch 8: Backup Automation
// ==========================================
describe('Backup Automation', () => {
    it('creates a backup', async () => {
        const res = await req('POST', '/api/backups', {}, managerToken);
        assert.equal(res.status, 201);
        assert.ok(res.body.filename.startsWith('backup-'));
        assert.equal(res.body.status, 'completed');
        assert.ok(res.body.size > 0);
    });

    it('lists backups', async () => {
        const res = await req('GET', '/api/backups', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });
});

// ==========================================
// Batch 8: Two-Factor Authentication
// ==========================================
describe('Two-Factor Authentication', () => {
    it('sets up 2FA', async () => {
        const res = await req('POST', '/api/auth/2fa/setup', {}, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.secret);
        assert.ok(res.body.qrCode.includes('otpauth://'));
    });

    it('verifies 2FA code', async () => {
        const res = await req('POST', '/api/auth/2fa/verify', { code: '123456' }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.verified, true);
    });

    it('rejects verify without code', async () => {
        const res = await req('POST', '/api/auth/2fa/verify', {}, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 8: Encrypted Database Config
// ==========================================
describe('Encrypted Database Config', () => {
    it('gets encryption status', async () => {
        const res = await req('GET', '/api/security/encryption-status', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.algorithm, 'AES-256-GCM');
        assert.ok(res.body.status === 'active' || res.body.status === 'inactive');
    });

    it('enables encryption', async () => {
        const res = await req('PUT', '/api/security/encryption', { enabled: true }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.encryption, true);
    });
});

// ==========================================
// Batch 8: PCI SAQ Documentation
// ==========================================
describe('PCI SAQ Documentation', () => {
    it('returns PCI SAQ requirements', async () => {
        const res = await req('GET', '/api/compliance/pci-saq', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.saqType, 'SAQ-B-IP');
        assert.ok(Array.isArray(res.body.requirements));
        assert.ok(res.body.requirements.length >= 10);
    });
});

// ==========================================
// Batch 9: Real-time Sales Feed
// ==========================================
describe('Real-time Sales Feed', () => {
    it('returns live feed data', async () => {
        const res = await req('GET', '/api/live-feed', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.summary);
        assert.ok(typeof res.body.summary.ticketCount === 'number');
        assert.ok(typeof res.body.summary.totalSales === 'number');
    });
});

// ==========================================
// Batch 9: Remote Void Approval
// ==========================================
describe('Remote Void Approval', () => {
    it('voids a ticket remotely', async () => {
        const ticket = await req('POST', '/api/tickets', {
            items: [{ name: 'Salad', price: 12.00, quantity: 1 }], server: 'John'
        }, serverToken);
        const res = await req('POST', `/api/tickets/${ticket.body.id}/remote-void`, {
            reason: 'Customer complaint', approvedBy: 'Maria'
        }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'void');
        assert.equal(res.body.remoteVoid, true);
        assert.equal(res.body.voidReason, 'Customer complaint');
    });

    it('returns 404 for invalid ticket', async () => {
        const res = await req('POST', '/api/tickets/99999/remote-void', { reason: 'test' }, managerToken);
        assert.equal(res.status, 404);
    });
});

// ==========================================
// Batch 9: Web Admin Portal
// ==========================================
describe('Web Admin Portal', () => {
    it('returns admin summary', async () => {
        const res = await req('GET', '/api/admin/summary', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(typeof res.body.todaySales === 'number');
        assert.ok(typeof res.body.ticketCount === 'number');
        assert.ok(typeof res.body.openTickets === 'number');
        assert.ok(typeof res.body.waitlistCount === 'number');
    });
});

// ==========================================
// Batch 9: Phone/Mobile Dashboard
// ==========================================
describe('Phone/Mobile Dashboard', () => {
    it('returns compact mobile dashboard', async () => {
        const res = await req('GET', '/api/mobile/dashboard', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.compact, true);
        assert.ok(typeof res.body.sales === 'number');
        assert.ok(typeof res.body.staffOnDuty === 'number');
    });
});

// ==========================================
// Batch 9: Owner Analytics
// ==========================================
describe('Owner Analytics', () => {
    it('returns owner analytics for default period', async () => {
        const res = await req('GET', '/api/analytics/owner', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.period, '7 days');
        assert.ok(typeof res.body.revenue === 'number');
        assert.ok(typeof res.body.wasteCost === 'number');
        assert.ok(Array.isArray(res.body.topItems));
    });

    it('accepts custom days parameter', async () => {
        const res = await req('GET', '/api/analytics/owner?days=30', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.period, '30 days');
    });
});

// ==========================================
// Batch 9: Multi-Location Dashboard
// ==========================================
describe('Multi-Location Dashboard', () => {
    it('returns locations with sales data', async () => {
        const res = await req('GET', '/api/locations', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
        assert.ok(res.body.length >= 1);
        assert.ok(typeof res.body[0].todaySales === 'number');
    });
});

// ==========================================
// Batch 9: Cloud Reporting
// ==========================================
describe('Cloud Reporting', () => {
    it('returns cloud report for today', async () => {
        const res = await req('GET', '/api/cloud-reports', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.period, 'today');
        assert.equal(res.body.cloudSync, true);
        assert.ok(res.body.paymentBreakdown);
    });

    it('supports week period', async () => {
        const res = await req('GET', '/api/cloud-reports?period=week', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.period, 'week');
    });
});

// ==========================================
// Batch 9: Payment Type Breakdown
// ==========================================
describe('Payment Type Breakdown', () => {
    it('returns payment breakdown report', async () => {
        const res = await req('GET', '/api/reports/payment-breakdown', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.cash);
        assert.ok(res.body.card);
        assert.ok(typeof res.body.surchargeRevenue === 'number');
    });
});

// ==========================================
// Batch 9: Surcharge Cap Logic
// ==========================================
describe('Surcharge Cap Logic', () => {
    it('gets surcharge cap config', async () => {
        const res = await req('GET', '/api/surcharge-cap', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(typeof res.body.maxRate === 'number');
        assert.ok(typeof res.body.currentRate === 'number');
    });

    it('updates surcharge cap', async () => {
        const res = await req('PUT', '/api/surcharge-cap', { maxRate: 3.5 }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.maxRate, 3.5);
    });

    it('rejects without maxRate', async () => {
        const res = await req('PUT', '/api/surcharge-cap', {}, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 10: Hardware - Printers
// ==========================================
describe('Hardware: Printers', () => {
    it('discovers/adds a printer', async () => {
        const res = await req('POST', '/api/hardware/printers', {
            name: 'Kitchen Printer', ipAddress: '192.168.1.50', type: 'receipt', model: 'Epson TM-T88'
        }, managerToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.name, 'Kitchen Printer');
        assert.equal(res.body.status, 'discovered');
    });

    it('lists printers', async () => {
        const res = await req('GET', '/api/hardware/printers', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects printer without name', async () => {
        const res = await req('POST', '/api/hardware/printers', { ipAddress: '1.2.3.4' }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 10: Hardware - Cash Drawer
// ==========================================
describe('Hardware: Cash Drawer', () => {
    it('opens cash drawer', async () => {
        const res = await req('POST', '/api/hardware/cash-drawer/open', { reason: 'sale' }, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.opened, true);
    });
});

// ==========================================
// Batch 10: Hardware - Barcode Scanner
// ==========================================
describe('Hardware: Barcode Scanner', () => {
    it('looks up barcode for known item', async () => {
        // Add ingredient with barcode
        await req('POST', '/api/ingredients', { name: 'Olive Oil', unit: 'bottle', quantity: 20, costPerUnit: 8.99, barcode: 'OIL001' }, managerToken);
        const res = await req('POST', '/api/hardware/barcode-scan', { barcode: 'OIL001' }, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.type, 'ingredient');
    });

    it('returns unknown for unrecognized barcode', async () => {
        const res = await req('POST', '/api/hardware/barcode-scan', { barcode: 'UNKNOWN123' }, serverToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.type, 'unknown');
    });

    it('rejects without barcode', async () => {
        const res = await req('POST', '/api/hardware/barcode-scan', {}, serverToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 10: Hardware - KDS Displays
// ==========================================
describe('Hardware: KDS Displays', () => {
    it('returns KDS display list', async () => {
        const res = await req('GET', '/api/hardware/kds-displays', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
        assert.ok(res.body.length >= 1);
    });
});

// ==========================================
// Batch 10: Table Management
// ==========================================
describe('Table Management (Floor Plan)', () => {
    it('gets tables (empty initially)', async () => {
        const res = await req('GET', '/api/tables');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
    });

    it('updates table layout', async () => {
        const res = await req('PUT', '/api/tables', {
            tables: [
                { id: 1, name: 'Table 1', seats: 4, x: 100, y: 100, shape: 'square', section: 'patio' },
                { id: 2, name: 'Table 2', seats: 6, x: 200, y: 100, shape: 'round', section: 'main' }
            ]
        }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.length, 2);
        assert.equal(res.body[0].section, 'patio');
        assert.equal(res.body[1].shape, 'round');
    });

    it('rejects non-array tables', async () => {
        const res = await req('PUT', '/api/tables', { tables: 'invalid' }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 10: Sync Engine
// ==========================================
describe('Sync Engine', () => {
    it('gets data snapshot', async () => {
        const res = await req('GET', '/api/sync/snapshot', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.version);
        assert.ok(Array.isArray(res.body.tickets));
        assert.ok(res.body.config);
    });

    it('pushes changes with conflict detection', async () => {
        const res = await req('POST', '/api/sync/push', {
            changes: [{ type: 'ticket', action: 'update', id: 1, timestamp: '2020-01-01' }]
        }, managerToken);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.applied));
        assert.ok(Array.isArray(res.body.conflicts));
    });

    it('performs resync', async () => {
        const res = await req('POST', '/api/sync/resync', { lastSyncVersion: null }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.fullResync, true);
        assert.ok(Array.isArray(res.body.changes));
    });

    it('rejects push without changes', async () => {
        const res = await req('POST', '/api/sync/push', {}, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 11: Merchant Onboarding
// ==========================================
describe('Merchant Onboarding Portal', () => {
    it('creates a merchant', async () => {
        const res = await req('POST', '/api/merchants', {
            name: 'Pizza Palace', email: 'owner@pizza.com', phone: '555-PIZZA', plan: 'premium'
        }, managerToken);
        assert.equal(res.status, 201);
        assert.ok(res.body.id.startsWith('M-'));
        assert.ok(res.body.tenantId);
        assert.equal(res.body.plan, 'premium');
    });

    it('lists merchants', async () => {
        const res = await req('GET', '/api/merchants', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects without name/email', async () => {
        const res = await req('POST', '/api/merchants', { phone: '555-0000' }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 11: System Diagnostics & Updates
// ==========================================
describe('System Diagnostics & Updates', () => {
    it('returns diagnostics', async () => {
        const res = await req('GET', '/api/system/diagnostics', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.uptime >= 0);
        assert.ok(res.body.memory);
        assert.equal(res.body.status, 'healthy');
    });

    it('requests system update', async () => {
        const res = await req('POST', '/api/system/update', { version: '2.0', channel: 'beta' }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'update_scheduled');
        assert.equal(res.body.requestedVersion, '2.0');
    });
});

// ==========================================
// Batch 11: White-labeling / Branding
// ==========================================
describe('White-labeling / Branding', () => {
    it('gets default branding', async () => {
        const res = await req('GET', '/api/branding');
        assert.equal(res.status, 200);
        assert.equal(res.body.name, 'Restaurant POS');
    });

    it('updates branding', async () => {
        const res = await req('PUT', '/api/branding', {
            name: 'My Custom POS', primaryColor: '#ff0000', accentColor: '#00ff00'
        }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.name, 'My Custom POS');
        assert.equal(res.body.primaryColor, '#ff0000');
    });
});

// ==========================================
// Batch 11: Feature Toggles
// ==========================================
describe('Feature Toggles', () => {
    it('gets feature toggles', async () => {
        const res = await req('GET', '/api/feature-toggles', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(typeof res.body === 'object');
    });

    it('toggles a feature', async () => {
        const res = await req('PUT', '/api/feature-toggles', { feature: 'dark_mode', enabled: true }, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.dark_mode);
        assert.equal(res.body.dark_mode.enabled, true);
    });

    it('rejects without feature name', async () => {
        const res = await req('PUT', '/api/feature-toggles', { enabled: true }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 11: Automated Deployment
// ==========================================
describe('Automated Deployment', () => {
    it('gets deploy status', async () => {
        const res = await req('GET', '/api/deploy/status', null, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.currentVersion, '1.4-SNAPSHOT');
        assert.equal(res.body.status, 'running');
    });

    it('triggers deployment', async () => {
        const res = await req('POST', '/api/deploy', { version: '1.5' }, managerToken);
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'deploying');
        assert.equal(res.body.version, '1.5');
    });
});

// ==========================================
// Batch 11: Developer Documentation
// ==========================================
describe('Developer Documentation', () => {
    it('returns API docs without auth', async () => {
        const res = await req('GET', '/api/developer/docs');
        assert.equal(res.status, 200);
        assert.equal(res.body.version, '1.4');
        assert.ok(res.body.endpoints);
        assert.ok(Array.isArray(res.body.webhookEvents));
    });
});

// ==========================================
// Batch 11: Plugin Marketplace
// ==========================================
describe('Plugin Marketplace', () => {
    it('installs a plugin', async () => {
        const res = await req('POST', '/api/plugins', {
            name: 'Loyalty Plus', version: '2.0.0', description: 'Advanced loyalty program', author: 'DevCo'
        }, managerToken);
        assert.equal(res.status, 201);
        assert.equal(res.body.name, 'Loyalty Plus');
        assert.equal(res.body.installed, true);
    });

    it('lists plugins', async () => {
        const res = await req('GET', '/api/plugins', null, managerToken);
        assert.equal(res.status, 200);
        assert.ok(res.body.length >= 1);
    });

    it('rejects plugin without name', async () => {
        const res = await req('POST', '/api/plugins', { version: '1.0' }, managerToken);
        assert.equal(res.status, 400);
    });
});

// ==========================================
// Batch 11: Online Menu
// ==========================================
describe('Online Ordering Menu', () => {
    it('returns menu data', async () => {
        const res = await req('GET', '/api/menu');
        assert.equal(res.status, 200);
        assert.ok(res.body.categories !== undefined);
        assert.ok(res.body.items !== undefined);
    });
});

