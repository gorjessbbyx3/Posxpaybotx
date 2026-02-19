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
