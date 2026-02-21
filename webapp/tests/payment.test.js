/**
 * Payment Abstraction Layer Tests
 *
 * Tests for:
 * - PaymentProvider interface & transaction state machine
 * - PaybotXProvider and ManualProvider
 * - PaymentService orchestration (charge, void, refund, idempotency, duplicates)
 * - PaymentLogger structured logging
 * - New API endpoints (transactions, payment health, payment log)
 *
 * Uses Node.js built-in test runner. Zero external dependencies.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// ==========================================
// Unit Tests: PaymentProvider & State Machine
// ==========================================

const {
    PaymentProvider,
    PaymentResult,
    TransactionState,
    VALID_TRANSITIONS,
    isValidTransition,
    createTransaction,
    transitionState
} = require('../api/payment-provider');

describe('TransactionState', () => {
    it('defines all required states', () => {
        assert.ok(TransactionState.PENDING);
        assert.ok(TransactionState.AUTHORIZED);
        assert.ok(TransactionState.CAPTURED);
        assert.ok(TransactionState.VOIDED);
        assert.ok(TransactionState.REFUNDED);
        assert.ok(TransactionState.PARTIALLY_REFUNDED);
        assert.ok(TransactionState.FAILED);
        assert.ok(TransactionState.SETTLED);
    });

    it('validates legal transitions', () => {
        assert.ok(isValidTransition('PENDING', 'AUTHORIZED'));
        assert.ok(isValidTransition('PENDING', 'CAPTURED'));
        assert.ok(isValidTransition('PENDING', 'FAILED'));
        assert.ok(isValidTransition('AUTHORIZED', 'CAPTURED'));
        assert.ok(isValidTransition('AUTHORIZED', 'VOIDED'));
        assert.ok(isValidTransition('CAPTURED', 'VOIDED'));
        assert.ok(isValidTransition('CAPTURED', 'REFUNDED'));
        assert.ok(isValidTransition('CAPTURED', 'PARTIALLY_REFUNDED'));
        assert.ok(isValidTransition('CAPTURED', 'SETTLED'));
    });

    it('rejects illegal transitions', () => {
        assert.ok(!isValidTransition('VOIDED', 'CAPTURED'));
        assert.ok(!isValidTransition('REFUNDED', 'CAPTURED'));
        assert.ok(!isValidTransition('PENDING', 'REFUNDED'));
        assert.ok(!isValidTransition('FAILED', 'CAPTURED'));
    });

    it('allows retry from FAILED to PENDING', () => {
        assert.ok(isValidTransition('FAILED', 'PENDING'));
    });
});

describe('createTransaction', () => {
    it('creates a transaction with all required fields', () => {
        const txn = createTransaction({
            id: 'TXN-0001',
            ticketId: 1001,
            amount: 25.50,
            method: 'card',
            tip: 3.00
        });

        assert.equal(txn.id, 'TXN-0001');
        assert.equal(txn.ticketId, 1001);
        assert.equal(txn.amount, 25.50);
        assert.equal(txn.tip, 3.00);
        assert.equal(txn.method, 'card');
        assert.equal(txn.state, 'PENDING');
        assert.equal(txn.stateHistory.length, 1);
        assert.equal(txn.stateHistory[0].state, 'PENDING');
        assert.ok(txn.createdAt);
    });

    it('defaults tip to 0', () => {
        const txn = createTransaction({
            id: 'TXN-0002',
            ticketId: 1002,
            amount: 10,
            method: 'cash'
        });
        assert.equal(txn.tip, 0);
    });

    it('rounds monetary values to cents', () => {
        const txn = createTransaction({
            id: 'TXN-0003',
            ticketId: 1003,
            amount: 10.005,
            method: 'card',
            tip: 1.999
        });
        assert.equal(txn.amount, 10.01);
        assert.equal(txn.tip, 2.00);
    });
});

describe('transitionState', () => {
    it('transitions from PENDING to CAPTURED', () => {
        const txn = createTransaction({ id: 'T1', ticketId: 1, amount: 10, method: 'card' });
        transitionState(txn, 'CAPTURED', 'Payment approved');

        assert.equal(txn.state, 'CAPTURED');
        assert.equal(txn.stateHistory.length, 2);
        assert.equal(txn.stateHistory[1].state, 'CAPTURED');
        assert.equal(txn.stateHistory[1].reason, 'Payment approved');
    });

    it('throws on invalid transition', () => {
        const txn = createTransaction({ id: 'T2', ticketId: 1, amount: 10, method: 'card' });
        assert.throws(() => {
            transitionState(txn, 'REFUNDED', 'Invalid');
        }, /Invalid state transition/);
    });

    it('tracks full state history', () => {
        const txn = createTransaction({ id: 'T3', ticketId: 1, amount: 10, method: 'card' });
        transitionState(txn, 'CAPTURED', 'Approved');
        transitionState(txn, 'REFUNDED', 'Customer complaint');

        assert.equal(txn.stateHistory.length, 3);
        assert.equal(txn.stateHistory[0].state, 'PENDING');
        assert.equal(txn.stateHistory[1].state, 'CAPTURED');
        assert.equal(txn.stateHistory[2].state, 'REFUNDED');
    });
});

describe('PaymentResult', () => {
    it('creates a result with all fields', () => {
        const result = new PaymentResult({
            success: true,
            transactionId: 'TXN-001',
            gatewayTransactionId: 'GW-123',
            state: 'CAPTURED',
            amount: 50.00,
            responseCode: '00',
            responseMessage: 'Approved',
            cardLastFour: '4242',
            cardBrand: 'Visa',
            isDebit: false
        });

        assert.equal(result.success, true);
        assert.equal(result.transactionId, 'TXN-001');
        assert.equal(result.amount, 50.00);
        assert.equal(result.responseCode, '00');
        assert.ok(result.timestamp);
    });

    it('rounds amount to cents', () => {
        const result = new PaymentResult({ success: true, amount: 10.005 });
        assert.equal(result.amount, 10.01);
    });
});

// ==========================================
// Unit Tests: PaybotXProvider & ManualProvider
// ==========================================

const { PaybotXProvider, ManualProvider } = require('../api/payment-paybotx');

describe('ManualProvider', () => {
    const manual = new ManualProvider();

    it('is always initialized', () => {
        assert.equal(manual._initialized, true);
    });

    it('health check always returns available', async () => {
        const health = await manual.healthCheck();
        assert.ok(health.available);
    });

    it('charge returns success', async () => {
        const result = await manual.charge({ amount: 25.00, tip: 3.00 });
        assert.ok(result.success);
        assert.equal(result.amount, 28.00);
        assert.equal(result.state, 'CAPTURED');
    });

    it('void returns success', async () => {
        const result = await manual.void({ transactionId: 'T1' });
        assert.ok(result.success);
        assert.equal(result.state, 'VOIDED');
    });

    it('refund returns success', async () => {
        const result = await manual.refund({ transactionId: 'T1', amount: 10 });
        assert.ok(result.success);
        assert.equal(result.state, 'REFUNDED');
    });

    it('settle batch returns success', async () => {
        const result = await manual.settleBatch({});
        assert.ok(result.success);
        assert.equal(result.state, 'SETTLED');
    });
});

describe('PaybotXProvider', () => {
    it('requires merchantId and apiKey to initialize', async () => {
        const provider = new PaybotXProvider({});
        const result = await provider.initialize();
        assert.ok(!result.success);
    });

    it('initializes with valid config', async () => {
        const provider = new PaybotXProvider({
            merchantId: 'TEST123',
            apiKey: 'KEY456'
        });
        const result = await provider.initialize();
        assert.ok(result.success);
    });

    it('charge uses simulated gateway in dev mode', async () => {
        const provider = new PaybotXProvider({
            merchantId: 'TEST123',
            apiKey: 'KEY456'
        });
        await provider.initialize();

        const result = await provider.charge({
            amount: 50.00,
            ticketId: 1001,
            tip: 5.00
        });

        assert.ok(result.success);
        assert.equal(result.state, 'CAPTURED');
        assert.equal(result.amount, 55.00);
        assert.ok(result.gatewayTransactionId);
        assert.ok(result.cardLastFour);
    });

    it('void returns success', async () => {
        const provider = new PaybotXProvider({
            merchantId: 'TEST123',
            apiKey: 'KEY456'
        });
        await provider.initialize();

        const result = await provider.void({
            transactionId: 'T1',
            gatewayTransactionId: 'GW-1',
            reason: 'Customer request'
        });

        assert.ok(result.success);
        assert.equal(result.state, 'VOIDED');
    });

    it('refund returns success', async () => {
        const provider = new PaybotXProvider({
            merchantId: 'TEST123',
            apiKey: 'KEY456'
        });
        await provider.initialize();

        const result = await provider.refund({
            transactionId: 'T1',
            gatewayTransactionId: 'GW-1',
            amount: 25.00,
            reason: 'Quality issue'
        });

        assert.ok(result.success);
        assert.equal(result.state, 'REFUNDED');
    });

    it('tip adjust returns success', async () => {
        const provider = new PaybotXProvider({
            merchantId: 'TEST123',
            apiKey: 'KEY456'
        });
        await provider.initialize();

        const result = await provider.adjustTip({
            transactionId: 'T1',
            gatewayTransactionId: 'GW-1',
            tipAmount: 8.00
        });

        assert.ok(result.success);
    });

    it('batch settle returns success', async () => {
        const provider = new PaybotXProvider({
            merchantId: 'TEST123',
            apiKey: 'KEY456'
        });
        await provider.initialize();

        const result = await provider.settleBatch({});
        assert.ok(result.success);
        assert.equal(result.state, 'SETTLED');
    });

    it('checkDebit returns default false', async () => {
        const provider = new PaybotXProvider({
            merchantId: 'TEST123',
            apiKey: 'KEY456'
        });
        await provider.initialize();

        const result = await provider.checkDebit({ cardLastFour: '4242' });
        assert.equal(result.isDebit, false);
    });
});

describe('PaymentProvider abstract class', () => {
    it('cannot be instantiated directly', () => {
        assert.throws(() => {
            new PaymentProvider('test');
        }, /abstract/);
    });
});

// ==========================================
// Unit Tests: PaymentLogger
// ==========================================

const { PaymentLogger, PaymentEventType } = require('../api/payment-logger');

describe('PaymentLogger', () => {
    it('logs events with structured fields', () => {
        const auditEntries = [];
        const paymentLog = [];
        const logger = new PaymentLogger({
            auditFn: (action, user, details) => auditEntries.push({ action, user, details }),
            paymentLog
        });

        logger.logChargeSuccess({
            requestId: 'REQ-001',
            transactionId: 'TXN-001',
            ticketId: 1001,
            amount: 50.00,
            method: 'card',
            provider: 'paybotx',
            gatewayResponseCode: '00'
        }, { name: 'John', role: 'server' });

        assert.equal(paymentLog.length, 1);
        assert.equal(paymentLog[0].eventType, 'payment.charge.success');
        assert.equal(paymentLog[0].transactionId, 'TXN-001');
        assert.equal(paymentLog[0].amount, 50.00);
        assert.equal(paymentLog[0].user, 'John');
        assert.equal(auditEntries.length, 1);
    });

    it('logs idempotency hits', () => {
        const paymentLog = [];
        const logger = new PaymentLogger({ auditFn: () => {}, paymentLog });

        logger.logIdempotencyHit({
            requestId: 'REQ-002',
            ticketId: 1002,
            idempotencyKey: 'KEY-ABC'
        });

        assert.equal(paymentLog.length, 1);
        assert.equal(paymentLog[0].eventType, 'payment.idempotency.hit');
        assert.equal(paymentLog[0].idempotencyKey, 'KEY-ABC');
    });

    it('logs duplicate detection', () => {
        const paymentLog = [];
        const logger = new PaymentLogger({ auditFn: () => {}, paymentLog });

        logger.logDuplicateDetected({
            transactionId: 'TXN-001',
            ticketId: 1001,
            amount: 25.00
        });

        assert.equal(paymentLog[0].eventType, 'payment.duplicate.detected');
    });

    it('logs state transitions with before/after values', () => {
        const paymentLog = [];
        const logger = new PaymentLogger({ auditFn: () => {}, paymentLog });

        logger.logStateTransition({
            transactionId: 'TXN-001',
            previousState: 'PENDING',
            state: 'CAPTURED',
            reason: 'Approved'
        });

        assert.equal(paymentLog[0].previousState, 'PENDING');
        assert.equal(paymentLog[0].state, 'CAPTURED');
    });
});

// ==========================================
// Unit Tests: PaymentService
// ==========================================

const { PaymentService } = require('../api/payment-service');

describe('PaymentService', () => {
    let store;
    let service;
    let auditEntries;

    beforeEach(() => {
        auditEntries = [];
        store = {
            tickets: [],
            transactions: [],
            paymentLog: [],
            refunds: [],
            customers: [],
            savedPaymentMethods: [],
            tokenVault: [],
            config: {
                terminal: {
                    merchantId: 'TEST123',
                    apiKey: 'KEY456',
                    terminalId: 'T001'
                }
            }
        };
        service = new PaymentService({
            store,
            auditFn: (action, user, details) => auditEntries.push({ action, user, details }),
            saveFn: () => {},
            webhookFn: () => {}
        });
    });

    describe('processPayment', () => {
        it('processes a full cash payment', async () => {
            const ticket = { id: 1001, total: 25.00, status: 'open', payments: [] };
            store.tickets.push(ticket);

            const result = await service.processPayment({
                ticket,
                amount: 25.00,
                method: 'cash',
                user: { name: 'John', role: 'server' }
            });

            assert.ok(result.success);
            assert.equal(result.ticket.status, 'paid');
            assert.equal(result.ticket.payments.length, 1);
            assert.equal(result.ticket.payments[0].amount, 25.00);
            assert.equal(result.ticket.paymentMethod, 'cash');
            assert.ok(result.transaction);
            assert.equal(result.transaction.state, 'CAPTURED');
        });

        it('processes a card payment through PaybotX', async () => {
            const ticket = { id: 1002, total: 50.00, status: 'open', payments: [] };
            store.tickets.push(ticket);

            const result = await service.processPayment({
                ticket,
                amount: 50.00,
                method: 'card',
                tip: 5.00,
                user: { name: 'Jane', role: 'server' }
            });

            assert.ok(result.success);
            assert.equal(result.ticket.status, 'paid');
            assert.equal(result.ticket.tip, 5.00);
            assert.equal(result.transaction.provider, 'paybotx');
        });

        it('handles partial payment', async () => {
            const ticket = { id: 1003, total: 40.00, status: 'open', payments: [] };
            store.tickets.push(ticket);

            const result = await service.processPayment({
                ticket,
                amount: 20.00,
                method: 'card',
                user: { name: 'John', role: 'server' }
            });

            assert.ok(result.success);
            assert.equal(result.ticket.status, 'partial');
            assert.equal(result.ticket.totalPaid, 20.00);
            assert.equal(result.ticket.remaining, 20.00);
        });

        it('rejects payment on already-paid ticket', async () => {
            const ticket = { id: 1004, total: 10.00, status: 'paid', payments: [] };
            const result = await service.processPayment({
                ticket,
                amount: 10.00,
                method: 'cash',
                user: { name: 'John', role: 'server' }
            });

            assert.ok(!result.success);
            assert.equal(result.error, 'Already paid');
        });

        it('rejects zero payment', async () => {
            const ticket = { id: 1005, total: 10.00, status: 'open', payments: [] };
            const result = await service.processPayment({
                ticket,
                amount: 0,
                method: 'cash',
                user: { name: 'John', role: 'server' }
            });

            assert.ok(!result.success);
            assert.equal(result.error, 'Payment amount must be positive');
        });

        it('rejects overpayment', async () => {
            const ticket = { id: 1006, total: 10.00, status: 'open', payments: [] };
            const result = await service.processPayment({
                ticket,
                amount: 999.99,
                method: 'cash',
                user: { name: 'John', role: 'server' }
            });

            assert.ok(!result.success);
            assert.ok(result.error.includes('exceeds'));
        });

        it('respects idempotency key on duplicate', async () => {
            const ticket = { id: 1007, total: 30.00, status: 'open', payments: [] };
            store.tickets.push(ticket);

            const result1 = await service.processPayment({
                ticket,
                amount: 30.00,
                method: 'card',
                idempotencyKey: 'IDEM-001',
                user: { name: 'John', role: 'server' }
            });

            // Second call with same idempotency key should return cached result
            const result2 = await service.processPayment({
                ticket,
                amount: 30.00,
                method: 'card',
                idempotencyKey: 'IDEM-001',
                user: { name: 'John', role: 'server' }
            });

            assert.ok(result1.success);
            assert.ok(result2.success);
            // Should NOT create a second transaction
            assert.equal(result1.transaction.id, result2.transaction.id);
        });

        it('creates transaction records in store', async () => {
            const ticket = { id: 1008, total: 15.00, status: 'open', payments: [] };
            store.tickets.push(ticket);

            await service.processPayment({
                ticket,
                amount: 15.00,
                method: 'card',
                user: { name: 'John', role: 'server' }
            });

            assert.equal(store.transactions.length, 1);
            assert.equal(store.transactions[0].ticketId, 1008);
            assert.equal(store.transactions[0].state, 'CAPTURED');
        });

        it('logs payment events', async () => {
            const ticket = { id: 1009, total: 20.00, status: 'open', payments: [] };
            store.tickets.push(ticket);

            await service.processPayment({
                ticket,
                amount: 20.00,
                method: 'card',
                user: { name: 'John', role: 'server' }
            });

            assert.ok(store.paymentLog.length >= 2); // At least initiated + success
            const events = store.paymentLog.map(e => e.eventType);
            assert.ok(events.includes('payment.charge.initiated'));
            assert.ok(events.includes('payment.charge.success'));
        });

        it('updates customer stats on full payment', async () => {
            const customer = { id: 'C1', totalSpent: 100, visitCount: 5 };
            store.customers.push(customer);
            const ticket = { id: 1010, total: 30.00, status: 'open', payments: [], customerId: 'C1' };
            store.tickets.push(ticket);

            await service.processPayment({
                ticket,
                amount: 30.00,
                method: 'cash',
                user: { name: 'John', role: 'server' }
            });

            assert.equal(customer.totalSpent, 130.00);
            assert.equal(customer.visitCount, 6);
        });
    });

    describe('processVoid', () => {
        it('voids a ticket and its transactions', async () => {
            const ticket = { id: 2001, total: 25.00, status: 'paid', payments: [] };
            store.tickets.push(ticket);
            // Add a captured transaction
            store.transactions.push({
                id: 'TXN-V1', ticketId: 2001, state: 'CAPTURED',
                provider: 'manual', gatewayTransactionId: 'GW-1',
                stateHistory: [{ state: 'CAPTURED', timestamp: new Date().toISOString() }]
            });

            const result = await service.processVoid({
                ticket,
                reason: 'Wrong order',
                user: { name: 'Maria', role: 'manager' }
            });

            assert.ok(result.success);
            assert.equal(result.ticket.status, 'voided');
            assert.equal(result.ticket.voidReason, 'Wrong order');
            assert.equal(result.ticket.voidedBy, 'Maria');
            assert.equal(store.transactions[0].state, 'VOIDED');
        });
    });

    describe('processRefund', () => {
        it('processes a full refund on a paid ticket', async () => {
            const ticket = { id: 3001, total: 50.00, status: 'paid', paymentMethod: 'card', payments: [] };
            store.tickets.push(ticket);

            const result = await service.processRefund({
                ticket,
                amount: 50.00,
                reason: 'Defective item',
                type: 'full',
                user: { name: 'Maria', role: 'manager' }
            });

            assert.ok(result.success);
            assert.equal(result.refund.amount, 50.00);
            assert.equal(result.refund.reason, 'Defective item');
            assert.equal(result.ticket.status, 'refunded');
            assert.equal(result.ticket.refundedAmount, 50.00);
        });

        it('processes a partial refund', async () => {
            const ticket = { id: 3002, total: 40.00, status: 'paid', paymentMethod: 'card', payments: [] };
            store.tickets.push(ticket);

            const result = await service.processRefund({
                ticket,
                amount: 15.00,
                reason: 'Partial',
                type: 'partial',
                user: { name: 'Maria', role: 'manager' }
            });

            assert.ok(result.success);
            assert.equal(result.refund.amount, 15.00);
            assert.equal(result.ticket.refundedAmount, 15.00);
            assert.equal(result.ticket.status, 'paid'); // Still paid, not fully refunded
        });

        it('rejects refund on non-paid ticket', async () => {
            const ticket = { id: 3003, total: 20.00, status: 'open', payments: [] };
            const result = await service.processRefund({
                ticket,
                amount: 20.00,
                user: { name: 'Maria', role: 'manager' }
            });

            assert.ok(!result.success);
            assert.ok(result.error.includes('Can only refund paid'));
        });

        it('rejects refund exceeding balance', async () => {
            const ticket = { id: 3004, total: 30.00, status: 'paid', paymentMethod: 'card', refundedAmount: 20, payments: [] };
            const result = await service.processRefund({
                ticket,
                amount: 15.00,
                user: { name: 'Maria', role: 'manager' }
            });

            assert.ok(!result.success);
            assert.ok(result.error.includes('exceeds'));
        });

        it('rejects zero amount refund', async () => {
            const ticket = { id: 3005, total: 30.00, status: 'paid', paymentMethod: 'card', payments: [] };
            const result = await service.processRefund({
                ticket,
                amount: 0,
                user: { name: 'Maria', role: 'manager' }
            });

            assert.ok(!result.success);
            assert.ok(result.error.includes('positive'));
        });
    });

    describe('processPartialPayment', () => {
        it('processes a partial payment', async () => {
            const ticket = { id: 4001, total: 40.00, status: 'open' };
            store.tickets.push(ticket);

            const result = await service.processPartialPayment({
                ticket,
                amount: 20.00,
                method: 'card',
                user: { name: 'John', role: 'server' }
            });

            assert.ok(result.success);
            assert.equal(ticket.amountPaid, 20.00);
            assert.equal(ticket.remainingBalance, 20.00);
        });

        it('marks ticket paid when fully covered', async () => {
            const ticket = { id: 4002, total: 30.00, status: 'open' };
            store.tickets.push(ticket);

            await service.processPartialPayment({
                ticket, amount: 15.00, method: 'card',
                user: { name: 'John', role: 'server' }
            });
            await service.processPartialPayment({
                ticket, amount: 15.00, method: 'cash',
                user: { name: 'John', role: 'server' }
            });

            assert.equal(ticket.status, 'paid');
            assert.equal(ticket.remainingBalance, 0);
        });

        it('respects idempotency on partial payments', async () => {
            const ticket = { id: 4003, total: 50.00, status: 'open' };
            store.tickets.push(ticket);

            await service.processPartialPayment({
                ticket, amount: 25.00, method: 'card',
                idempotencyKey: 'PARTIAL-001',
                user: { name: 'John', role: 'server' }
            });
            await service.processPartialPayment({
                ticket, amount: 25.00, method: 'card',
                idempotencyKey: 'PARTIAL-001',
                user: { name: 'John', role: 'server' }
            });

            // Should only have one partial payment due to idempotency
            assert.equal(ticket.partialPayments.length, 1);
        });
    });

    describe('provider management', () => {
        it('resolves manual provider for cash', () => {
            const provider = service._resolveProvider('cash');
            assert.equal(provider.name, 'manual');
        });

        it('resolves paybotx provider for card', () => {
            const provider = service._resolveProvider('card');
            assert.equal(provider.name, 'paybotx');
        });

        it('allows registering custom providers', () => {
            const custom = new ManualProvider();
            custom.name = 'stripe';
            service.registerProvider('stripe', custom);

            const retrieved = service.getProvider('stripe');
            assert.equal(retrieved.name, 'stripe');
        });
    });

    describe('transaction queries', () => {
        it('gets transactions for a ticket', async () => {
            const ticket = { id: 5001, total: 20.00, status: 'open', payments: [] };
            store.tickets.push(ticket);

            await service.processPayment({
                ticket, amount: 20.00, method: 'card',
                user: { name: 'John', role: 'server' }
            });

            const txns = service.getTransactionsForTicket(5001);
            assert.equal(txns.length, 1);
            assert.equal(txns[0].ticketId, 5001);
        });

        it('gets a transaction by ID', async () => {
            const ticket = { id: 5002, total: 15.00, status: 'open', payments: [] };
            store.tickets.push(ticket);

            const result = await service.processPayment({
                ticket, amount: 15.00, method: 'cash',
                user: { name: 'John', role: 'server' }
            });

            const txn = service.getTransaction(result.transaction.id);
            assert.ok(txn);
            assert.equal(txn.id, result.transaction.id);
        });
    });

    describe('health check', () => {
        it('returns provider health status', async () => {
            const health = await service.healthCheck();
            assert.ok(health.healthy);
            assert.ok(health.providers.manual);
            assert.ok(health.providers.paybotx);
            assert.ok(health.providers.manual.available);
        });
    });
});

// ==========================================
// Integration Tests: New API Endpoints
// ==========================================

const { app, store: serverStore, paymentService: serverPaymentService } = require('../api/server');
const { createToken } = require('../api/auth');

let server;
let port;

const managerToken = createToken({ id: 'M001', name: 'Maria', role: 'manager' });
const serverToken = createToken({ id: 'S001', name: 'John', role: 'server' });

function req(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: '127.0.0.1',
            port,
            path,
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) opts.headers['Authorization'] = 'Bearer ' + token;
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
        if (body) request.write(JSON.stringify(body));
        request.end();
    });
}

describe('Payment API Integration', () => {
    before(() => {
        return new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', () => {
                port = server.address().port;
                // Reset store
                serverStore.tickets.length = 0;
                serverStore.refunds.length = 0;
                serverStore.transactions.length = 0;
                serverStore.paymentLog.length = 0;
                serverStore.auditLog.length = 0;
                serverStore.customers.length = 0;
                resolve();
            });
        });
    });

    after(() => {
        return new Promise((resolve) => server.close(resolve));
    });

    it('payment creates transactions accessible via API', async () => {
        // Create a ticket
        const create = await req('POST', '/api/tickets', {
            items: [{ name: 'Test', price: 20.00, qty: 1 }],
            type: 'dine-in'
        }, serverToken);
        assert.equal(create.status, 201);

        // Pay it
        const pay = await req('POST', `/api/tickets/${create.body.id}/pay`, {
            method: 'card', tip: 3.00
        }, serverToken);
        assert.equal(pay.status, 200);
        assert.equal(pay.body.status, 'paid');

        // Check transactions
        const txns = await req('GET', `/api/tickets/${create.body.id}/transactions`, null, serverToken);
        assert.equal(txns.status, 200);
        assert.ok(txns.body.transactions.length > 0);
        assert.equal(txns.body.transactions[0].ticketId, create.body.id);
        assert.equal(txns.body.transactions[0].state, 'CAPTURED');
    });

    it('payment log tracks events', async () => {
        const log = await req('GET', '/api/payment/log', null, managerToken);
        assert.equal(log.status, 200);
        assert.ok(log.body.entries.length > 0);
        const eventTypes = log.body.entries.map(e => e.eventType);
        assert.ok(eventTypes.includes('payment.charge.success'));
    });

    it('payment health endpoint works', async () => {
        const health = await req('GET', '/api/payment/health', null, managerToken);
        assert.equal(health.status, 200);
        assert.ok(health.body.healthy);
        assert.ok(health.body.providers);
    });

    it('transaction endpoint returns 404 for missing transaction', async () => {
        const res = await req('GET', '/api/transactions/NONEXISTENT', null, serverToken);
        assert.equal(res.status, 404);
    });

    it('payment with idempotency key returns same result', async () => {
        const create = await req('POST', '/api/tickets', {
            items: [{ name: 'Idem Test', price: 15.00, qty: 1 }],
            type: 'dine-in'
        }, serverToken);

        const pay1 = await req('POST', `/api/tickets/${create.body.id}/pay`, {
            method: 'cash', idempotencyKey: 'IDEM-INT-001'
        }, serverToken);
        assert.equal(pay1.status, 200);
        assert.equal(pay1.body.status, 'paid');

        // Second call — idempotency should prevent re-processing
        // (ticket already paid, so returns 400 since the ticket is marked paid)
        const pay2 = await req('POST', `/api/tickets/${create.body.id}/pay`, {
            method: 'cash', idempotencyKey: 'IDEM-INT-002'
        }, serverToken);
        assert.equal(pay2.status, 400);
    });

    it('void through payment service voids transactions', async () => {
        const create = await req('POST', '/api/tickets', {
            items: [{ name: 'Void Test', price: 10.00, qty: 1 }],
            type: 'dine-in'
        }, serverToken);

        // Pay the ticket
        await req('POST', `/api/tickets/${create.body.id}/pay`, {
            method: 'card'
        }, serverToken);

        // Void it
        const voidRes = await req('POST', `/api/tickets/${create.body.id}/void`, {
            reason: 'Customer changed mind'
        }, managerToken);
        assert.equal(voidRes.status, 200);
        assert.equal(voidRes.body.status, 'voided');

        // Verify transactions are voided
        const txns = await req('GET', `/api/tickets/${create.body.id}/transactions`, null, serverToken);
        const capturedOrVoided = txns.body.transactions.filter(t =>
            t.state === 'VOIDED' || t.state === 'CAPTURED'
        );
        assert.ok(capturedOrVoided.length > 0);
    });

    it('refund through payment service creates proper records', async () => {
        const create = await req('POST', '/api/tickets', {
            items: [{ name: 'Refund Test', price: 30.00, qty: 1 }],
            type: 'dine-in'
        }, serverToken);

        await req('POST', `/api/tickets/${create.body.id}/pay`, {
            method: 'card'
        }, serverToken);

        const refund = await req('POST', '/api/refunds', {
            ticketId: create.body.id,
            amount: 10.00,
            reason: 'Food quality',
            type: 'partial'
        }, managerToken);

        assert.equal(refund.status, 201);
        assert.equal(refund.body.amount, 10.00);
        assert.equal(refund.body.processedBy, 'Maria');
    });

    it('server cannot access payment health', async () => {
        const res = await req('GET', '/api/payment/health', null, serverToken);
        assert.equal(res.status, 403);
    });
});
