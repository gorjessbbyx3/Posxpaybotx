/**
 * Payment Abstraction Layer Tests
 *
 * Tests the PaymentProvider interface, InMemoryProvider, PaymentService,
 * transaction state machine, idempotency, and integrated API endpoints.
 *
 * Uses Node.js built-in test runner (node --test).
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { TransactionState, VALID_TRANSITIONS, PaymentProvider, createTransaction, transitionState, paymentResult } = require('../api/payment-provider');
const { InMemoryProvider } = require('../api/inmemory-provider');
const { PaymentService } = require('../api/payment-service');
const { PaybotXProvider } = require('../api/paybotx-provider');
const { app, store, paymentService: serverPaymentService } = require('../api/server');
const { createToken } = require('../api/auth');

// ==========================================
// Unit Tests — Transaction State Machine
// ==========================================
describe('Transaction State Machine', () => {
    it('creates a transaction with PENDING state', () => {
        const txn = createTransaction({ ticketId: 1, amount: 25.50, method: 'credit' });
        assert.equal(txn.state, TransactionState.PENDING);
        assert.equal(txn.amount, 25.50);
        assert.equal(txn.method, 'credit');
        assert.ok(txn.id);
        assert.ok(txn.idempotencyKey);
        assert.equal(txn.stateHistory.length, 1);
        assert.equal(txn.stateHistory[0].state, TransactionState.PENDING);
    });

    it('generates unique IDs for each transaction', () => {
        const t1 = createTransaction({ ticketId: 1, amount: 10, method: 'cash' });
        const t2 = createTransaction({ ticketId: 1, amount: 10, method: 'cash' });
        assert.notEqual(t1.id, t2.id);
        assert.notEqual(t1.idempotencyKey, t2.idempotencyKey);
    });

    it('preserves caller-supplied idempotency key', () => {
        const txn = createTransaction({ ticketId: 1, amount: 10, method: 'cash', idempotencyKey: 'my-key-123' });
        assert.equal(txn.idempotencyKey, 'my-key-123');
    });

    it('rounds amounts to 2 decimal places', () => {
        const txn = createTransaction({ ticketId: 1, amount: 10.999, method: 'cash', tip: 2.555 });
        assert.equal(txn.amount, 11.00);
        assert.equal(txn.tip, 2.56);
    });

    it('transitions PENDING -> AUTHORIZED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.AUTHORIZED);
        assert.equal(txn.state, TransactionState.AUTHORIZED);
        assert.equal(txn.stateHistory.length, 2);
    });

    it('transitions PENDING -> CAPTURED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'cash' });
        transitionState(txn, TransactionState.CAPTURED);
        assert.equal(txn.state, TransactionState.CAPTURED);
    });

    it('transitions PENDING -> FAILED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.FAILED, 'Card declined');
        assert.equal(txn.state, TransactionState.FAILED);
        assert.equal(txn.stateHistory[1].reason, 'Card declined');
    });

    it('transitions AUTHORIZED -> CAPTURED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.AUTHORIZED);
        transitionState(txn, TransactionState.CAPTURED);
        assert.equal(txn.state, TransactionState.CAPTURED);
        assert.equal(txn.stateHistory.length, 3);
    });

    it('transitions AUTHORIZED -> VOIDED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.AUTHORIZED);
        transitionState(txn, TransactionState.VOIDED, 'Customer cancelled');
        assert.equal(txn.state, TransactionState.VOIDED);
    });

    it('transitions CAPTURED -> VOIDED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.CAPTURED);
        transitionState(txn, TransactionState.VOIDED, 'Error');
        assert.equal(txn.state, TransactionState.VOIDED);
    });

    it('transitions CAPTURED -> REFUNDED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.CAPTURED);
        transitionState(txn, TransactionState.REFUNDED, 'Customer request');
        assert.equal(txn.state, TransactionState.REFUNDED);
    });

    it('transitions CAPTURED -> PARTIALLY_REFUNDED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.CAPTURED);
        transitionState(txn, TransactionState.PARTIALLY_REFUNDED, 'Partial refund');
        assert.equal(txn.state, TransactionState.PARTIALLY_REFUNDED);
    });

    it('transitions PARTIALLY_REFUNDED -> REFUNDED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.CAPTURED);
        transitionState(txn, TransactionState.PARTIALLY_REFUNDED);
        transitionState(txn, TransactionState.REFUNDED);
        assert.equal(txn.state, TransactionState.REFUNDED);
    });

    it('transitions FAILED -> PENDING (retry)', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.FAILED);
        transitionState(txn, TransactionState.PENDING);
        assert.equal(txn.state, TransactionState.PENDING);
    });

    it('rejects invalid transition: PENDING -> VOIDED', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        assert.throws(() => transitionState(txn, TransactionState.VOIDED), /Invalid state transition/);
    });

    it('rejects invalid transition: VOIDED -> anything', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.CAPTURED);
        transitionState(txn, TransactionState.VOIDED);
        assert.throws(() => transitionState(txn, TransactionState.CAPTURED), /Invalid state transition/);
        assert.throws(() => transitionState(txn, TransactionState.REFUNDED), /Invalid state transition/);
    });

    it('rejects invalid transition: REFUNDED -> anything', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.CAPTURED);
        transitionState(txn, TransactionState.REFUNDED);
        assert.throws(() => transitionState(txn, TransactionState.CAPTURED), /Invalid state transition/);
    });

    it('records transition history with timestamps', () => {
        const txn = createTransaction({ ticketId: 1, amount: 50, method: 'credit' });
        transitionState(txn, TransactionState.AUTHORIZED);
        transitionState(txn, TransactionState.CAPTURED);
        assert.equal(txn.stateHistory.length, 3);
        assert.ok(txn.stateHistory[2].at);
    });
});

// ==========================================
// Unit Tests — paymentResult helper
// ==========================================
describe('paymentResult', () => {
    it('creates a success result', () => {
        const r = paymentResult(true, { providerTransactionId: 'ABC', authCode: '123456', amount: 50 });
        assert.equal(r.success, true);
        assert.equal(r.providerTransactionId, 'ABC');
        assert.equal(r.authCode, '123456');
        assert.equal(r.error, null);
        assert.ok(r.timestamp);
    });

    it('creates a failure result', () => {
        const r = paymentResult(false, {}, 'Card declined');
        assert.equal(r.success, false);
        assert.equal(r.error, 'Card declined');
    });
});

// ==========================================
// Unit Tests — PaymentProvider base class
// ==========================================
describe('PaymentProvider base class', () => {
    it('cannot be instantiated directly', () => {
        assert.throws(() => new PaymentProvider('test'), /abstract/);
    });

    it('subclass must implement methods', async () => {
        class Stub extends PaymentProvider {
            constructor() { super('Stub'); }
        }
        const stub = new Stub();
        await assert.rejects(() => stub.authorize({}), /not implemented/);
        await assert.rejects(() => stub.capture({}), /not implemented/);
        await assert.rejects(() => stub.charge({}), /not implemented/);
        await assert.rejects(() => stub.void({}), /not implemented/);
        await assert.rejects(() => stub.refund({}, 10), /not implemented/);
        await assert.rejects(() => stub.adjustTip({}, 5), /not implemented/);
        await assert.rejects(() => stub.settleBatch(), /not implemented/);
    });

    it('provides default healthCheck', async () => {
        class Stub extends PaymentProvider {
            constructor() { super('Stub'); }
        }
        const stub = new Stub();
        const h = await stub.healthCheck();
        assert.equal(h.healthy, true);
    });
});

// ==========================================
// Unit Tests — InMemoryProvider
// ==========================================
describe('InMemoryProvider', () => {
    it('charges a transaction successfully', async () => {
        const provider = new InMemoryProvider();
        const txn = createTransaction({ ticketId: 1, amount: 25.50, method: 'cash' });
        const result = await provider.charge(txn);
        assert.equal(result.success, true);
        assert.equal(txn.state, TransactionState.CAPTURED);
        assert.ok(txn.providerTransactionId);
        assert.ok(txn.authCode);
    });

    it('authorizes a transaction', async () => {
        const provider = new InMemoryProvider();
        const txn = createTransaction({ ticketId: 2, amount: 100, method: 'credit' });
        const result = await provider.authorize(txn);
        assert.equal(result.success, true);
        assert.equal(txn.state, TransactionState.AUTHORIZED);
    });

    it('captures an authorized transaction', async () => {
        const provider = new InMemoryProvider();
        const txn = createTransaction({ ticketId: 3, amount: 75, method: 'credit' });
        await provider.authorize(txn);
        const result = await provider.capture(txn);
        assert.equal(result.success, true);
        assert.equal(txn.state, TransactionState.CAPTURED);
    });

    it('voids a captured transaction', async () => {
        const provider = new InMemoryProvider();
        const txn = createTransaction({ ticketId: 4, amount: 50, method: 'credit' });
        await provider.charge(txn);
        const result = await provider.void(txn, 'Customer request');
        assert.equal(result.success, true);
        assert.equal(txn.state, TransactionState.VOIDED);
    });

    it('refunds a captured transaction (full)', async () => {
        const provider = new InMemoryProvider();
        const txn = createTransaction({ ticketId: 5, amount: 40, method: 'credit' });
        await provider.charge(txn);
        const result = await provider.refund(txn, 40, 'Full refund');
        assert.equal(result.success, true);
        assert.equal(txn.state, TransactionState.REFUNDED);
    });

    it('refunds a captured transaction (partial)', async () => {
        const provider = new InMemoryProvider();
        const txn = createTransaction({ ticketId: 6, amount: 100, method: 'credit' });
        await provider.charge(txn);
        const result = await provider.refund(txn, 25, 'Partial');
        assert.equal(result.success, true);
        assert.equal(txn.state, TransactionState.PARTIALLY_REFUNDED);
    });

    it('adjusts tip on a captured transaction', async () => {
        const provider = new InMemoryProvider();
        const txn = createTransaction({ ticketId: 7, amount: 50, method: 'credit', tip: 5 });
        await provider.charge(txn);
        const result = await provider.adjustTip(txn, 10);
        assert.equal(result.success, true);
        assert.equal(txn.tip, 10);
    });

    it('settles a batch', async () => {
        const provider = new InMemoryProvider();
        const txn1 = createTransaction({ ticketId: 1, amount: 25, method: 'credit' });
        const txn2 = createTransaction({ ticketId: 2, amount: 50, method: 'credit', tip: 5 });
        await provider.charge(txn1);
        await provider.charge(txn2);
        const batch = await provider.settleBatch();
        assert.equal(batch.success, true);
        assert.ok(batch.batchId);
        assert.equal(batch.transactionCount, 2);
        assert.equal(batch.totalAmount, 80); // 25 + 50 + 5
    });

    it('simulates failures when fail mode is on', async () => {
        const provider = new InMemoryProvider();
        provider.setFailMode(true, 'Terminal offline');
        const txn = createTransaction({ ticketId: 1, amount: 25, method: 'credit' });
        const result = await provider.charge(txn);
        assert.equal(result.success, false);
        assert.equal(result.error, 'Terminal offline');
        assert.equal(txn.state, TransactionState.FAILED);
    });

    it('provides health check', async () => {
        const provider = new InMemoryProvider();
        const h = await provider.healthCheck();
        assert.equal(h.healthy, true);
    });
});

// ==========================================
// Unit Tests — PaybotXProvider
// ==========================================
describe('PaybotXProvider', () => {
    it('constructs with config', () => {
        const provider = new PaybotXProvider({
            merchantId: 'M123',
            apiKey: 'KEY',
            terminalId: 'T001',
            ipAddress: '192.168.1.100'
        });
        assert.equal(provider.name, 'PaybotX/Valor');
        assert.equal(provider.config.merchantId, 'M123');
    });

    it('uses LAN URL when ipAddress is configured', () => {
        const provider = new PaybotXProvider({
            merchantId: 'M123',
            apiKey: 'KEY',
            terminalId: 'T001',
            ipAddress: '192.168.1.100',
            port: 8443
        });
        assert.equal(provider._getBaseUrl(), 'https://192.168.1.100:8443');
    });

    it('uses cloud URL when ipAddress is not configured', () => {
        const provider = new PaybotXProvider({
            merchantId: 'M123',
            apiKey: 'KEY',
            terminalId: 'T001'
        });
        assert.equal(provider._getBaseUrl(), 'https://vt.isoaccess.com');
    });

    it('builds XML request', () => {
        const provider = new PaybotXProvider({
            merchantId: 'M123',
            apiKey: 'KEY',
            terminalId: 'T001'
        });
        const xml = provider._buildRequest('Sale', { amount: 25.50, tip: 3.00 });
        assert.ok(xml.includes('<TransType>Sale</TransType>'));
        assert.ok(xml.includes('<Amount>28.50</Amount>'));
        assert.ok(xml.includes('<TipAmount>3.00</TipAmount>'));
        assert.ok(xml.includes('<MerchantId>M123</MerchantId>'));
    });

    it('parses XML response', () => {
        const provider = new PaybotXProvider({ merchantId: 'M', apiKey: 'K', terminalId: 'T' });
        const xml = '<Response><Status>Approved</Status><RefId>REF123</RefId><AuthCode>AUTH456</AuthCode><CardType>VISA</CardType><CardNumber>****1234</CardNumber><IsDebit>false</IsDebit></Response>';
        const parsed = provider._parseResponse(xml);
        assert.equal(parsed.status, 'Approved');
        assert.equal(parsed.refId, 'REF123');
        assert.equal(parsed.authCode, 'AUTH456');
        assert.equal(parsed.cardType, 'VISA');
        assert.equal(parsed.isDebit, false);
    });

    it('provides health check', async () => {
        const provider = new PaybotXProvider({
            merchantId: 'M123',
            apiKey: 'KEY',
            terminalId: 'T001'
        });
        const h = await provider.healthCheck();
        assert.equal(h.healthy, true);
        assert.equal(h.mode, 'cloud');
    });
});

// ==========================================
// Unit Tests — PaymentService
// ==========================================
describe('PaymentService', () => {
    let service;
    let auditLog;

    beforeEach(() => {
        auditLog = [];
        service = new PaymentService({
            cardProvider: new InMemoryProvider(),
            cashProvider: new InMemoryProvider(),
            auditLogger: (action, user, details) => auditLog.push({ action, user, details }),
            paymentLogger: () => {}
        });
    });

    describe('processPayment', () => {
        it('processes a cash payment', async () => {
            const { transaction, result } = await service.processPayment({
                ticketId: 1001,
                amount: 25.50,
                method: 'cash'
            });
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.CAPTURED);
            assert.equal(transaction.amount, 25.50);
            assert.equal(transaction.method, 'cash');
        });

        it('processes a credit card payment', async () => {
            const { transaction, result } = await service.processPayment({
                ticketId: 1002,
                amount: 50,
                method: 'credit',
                tip: 7.50
            });
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.CAPTURED);
            assert.equal(transaction.tip, 7.50);
        });

        it('processes a debit card payment', async () => {
            const { transaction, result } = await service.processPayment({
                ticketId: 1003,
                amount: 30,
                method: 'debit'
            });
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.CAPTURED);
        });

        it('processes a gift card payment', async () => {
            const { transaction, result } = await service.processPayment({
                ticketId: 1004,
                amount: 15,
                method: 'gift_card'
            });
            assert.equal(result.success, true);
        });

        it('enforces idempotency - returns existing transaction on duplicate key', async () => {
            const first = await service.processPayment({
                ticketId: 1005,
                amount: 40,
                method: 'credit',
                idempotencyKey: 'idem-001'
            });
            assert.equal(first.duplicate, false);

            const second = await service.processPayment({
                ticketId: 1005,
                amount: 40,
                method: 'credit',
                idempotencyKey: 'idem-001'
            });
            assert.equal(second.duplicate, true);
            assert.equal(second.transaction.id, first.transaction.id);
        });

        it('allows different payments with different idempotency keys', async () => {
            const first = await service.processPayment({
                ticketId: 1006,
                amount: 20,
                method: 'cash',
                idempotencyKey: 'key-a'
            });
            const second = await service.processPayment({
                ticketId: 1006,
                amount: 20,
                method: 'cash',
                idempotencyKey: 'key-b'
            });
            assert.notEqual(first.transaction.id, second.transaction.id);
        });

        it('records audit log entry', async () => {
            await service.processPayment({
                ticketId: 1007,
                amount: 30,
                method: 'credit',
                user: { name: 'John', role: 'server' }
            });
            const entry = auditLog.find(e => e.action === 'payment_processed');
            assert.ok(entry);
            assert.equal(entry.details.ticketId, 1007);
            assert.equal(entry.details.amount, 30);
            assert.equal(entry.details.success, true);
        });

        it('handles payment failure', async () => {
            service.cardProvider.setFailMode(true, 'Declined');
            const { transaction, result } = await service.processPayment({
                ticketId: 1008,
                amount: 50,
                method: 'credit'
            });
            assert.equal(result.success, false);
            assert.equal(result.error, 'Declined');
            assert.equal(transaction.state, TransactionState.FAILED);
        });
    });

    describe('authorizePayment', () => {
        it('authorizes a card payment', async () => {
            const { transaction, result } = await service.authorizePayment({
                ticketId: 2001,
                amount: 100,
                method: 'credit'
            });
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.AUTHORIZED);
        });

        it('enforces idempotency on authorize', async () => {
            const first = await service.authorizePayment({
                ticketId: 2002,
                amount: 75,
                method: 'credit',
                idempotencyKey: 'auth-001'
            });
            const second = await service.authorizePayment({
                ticketId: 2002,
                amount: 75,
                method: 'credit',
                idempotencyKey: 'auth-001'
            });
            assert.equal(second.duplicate, true);
            assert.equal(second.transaction.id, first.transaction.id);
        });
    });

    describe('capturePayment', () => {
        it('captures an authorized transaction', async () => {
            const { transaction } = await service.authorizePayment({
                ticketId: 3001,
                amount: 60,
                method: 'credit'
            });
            const { result } = await service.capturePayment(transaction.id);
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.CAPTURED);
        });

        it('rejects capture of non-authorized transaction', async () => {
            const { transaction } = await service.processPayment({
                ticketId: 3002,
                amount: 40,
                method: 'cash'
            });
            const { result } = await service.capturePayment(transaction.id);
            assert.equal(result.success, false);
            assert.ok(result.error.includes('Cannot capture'));
        });

        it('returns error for non-existent transaction', async () => {
            const { result } = await service.capturePayment('nonexistent');
            assert.equal(result.success, false);
            assert.equal(result.error, 'Transaction not found');
        });
    });

    describe('voidPayment', () => {
        it('voids a captured transaction', async () => {
            const { transaction } = await service.processPayment({
                ticketId: 4001,
                amount: 50,
                method: 'credit'
            });
            const { result } = await service.voidPayment(transaction.id, 'Customer request');
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.VOIDED);
        });

        it('voids an authorized transaction', async () => {
            const { transaction } = await service.authorizePayment({
                ticketId: 4002,
                amount: 80,
                method: 'credit'
            });
            const { result } = await service.voidPayment(transaction.id, 'Cancelled');
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.VOIDED);
        });

        it('records void in audit log', async () => {
            const { transaction } = await service.processPayment({
                ticketId: 4003,
                amount: 30,
                method: 'credit'
            });
            await service.voidPayment(transaction.id, 'Error', { name: 'Manager', role: 'manager' });
            const entry = auditLog.find(e => e.action === 'payment_voided');
            assert.ok(entry);
            assert.equal(entry.details.reason, 'Error');
        });
    });

    describe('refundPayment', () => {
        it('refunds a captured transaction (full)', async () => {
            const { transaction } = await service.processPayment({
                ticketId: 5001,
                amount: 50,
                method: 'credit'
            });
            const { result } = await service.refundPayment(transaction.id, 50, 'Full refund');
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.REFUNDED);
        });

        it('refunds a captured transaction (partial)', async () => {
            const { transaction } = await service.processPayment({
                ticketId: 5002,
                amount: 100,
                method: 'credit'
            });
            const { result } = await service.refundPayment(transaction.id, 25, 'Partial');
            assert.equal(result.success, true);
            assert.equal(transaction.state, TransactionState.PARTIALLY_REFUNDED);
        });

        it('rejects refund exceeding original amount', async () => {
            const { transaction } = await service.processPayment({
                ticketId: 5003,
                amount: 50,
                method: 'credit'
            });
            const { result } = await service.refundPayment(transaction.id, 75);
            assert.equal(result.success, false);
            assert.ok(result.error.includes('exceeds'));
        });

        it('rejects refund of zero amount', async () => {
            const { transaction } = await service.processPayment({
                ticketId: 5004,
                amount: 50,
                method: 'credit'
            });
            const { result } = await service.refundPayment(transaction.id, 0);
            assert.equal(result.success, false);
            assert.ok(result.error.includes('positive'));
        });
    });

    describe('adjustTip', () => {
        it('adjusts tip on a captured transaction', async () => {
            const { transaction } = await service.processPayment({
                ticketId: 6001,
                amount: 50,
                method: 'credit',
                tip: 5
            });
            const { result } = await service.adjustTip(transaction.id, 10);
            assert.equal(result.success, true);
            assert.equal(transaction.tip, 10);
        });

        it('rejects tip adjustment on non-captured transaction', async () => {
            const { transaction } = await service.authorizePayment({
                ticketId: 6002,
                amount: 50,
                method: 'credit'
            });
            const { result } = await service.adjustTip(transaction.id, 8);
            assert.equal(result.success, false);
        });
    });

    describe('settleBatch', () => {
        it('settles the current batch', async () => {
            await service.processPayment({ ticketId: 7001, amount: 25, method: 'credit' });
            await service.processPayment({ ticketId: 7002, amount: 50, method: 'credit' });
            const batch = await service.settleBatch({ name: 'Admin', role: 'owner' });
            assert.equal(batch.success, true);
            assert.ok(batch.batchId);

            const entry = auditLog.find(e => e.action === 'batch_settled');
            assert.ok(entry);
        });
    });

    describe('getTransactionsForTicket', () => {
        it('returns all transactions for a ticket', async () => {
            await service.processPayment({ ticketId: 8001, amount: 20, method: 'cash' });
            await service.processPayment({ ticketId: 8001, amount: 30, method: 'credit' });
            await service.processPayment({ ticketId: 8002, amount: 15, method: 'cash' });

            const txns = service.getTransactionsForTicket(8001);
            assert.equal(txns.length, 2);
        });
    });

    describe('getTicketPaymentSummary', () => {
        it('returns payment summary for a ticket', async () => {
            await service.processPayment({ ticketId: 9001, amount: 20, method: 'cash', tip: 3 });
            await service.processPayment({ ticketId: 9001, amount: 30, method: 'credit', tip: 5 });

            const summary = service.getTicketPaymentSummary(9001);
            assert.equal(summary.totalPaid, 50);
            assert.equal(summary.totalTips, 8);
            assert.equal(summary.transactionCount, 2);
            assert.equal(summary.capturedCount, 2);
        });
    });

    describe('healthCheck', () => {
        it('checks all providers', async () => {
            const health = await service.healthCheck();
            assert.equal(health.healthy, true);
            assert.ok(health.cardProvider);
            assert.ok(health.cashProvider);
        });
    });
});

// ==========================================
// Integration Tests — API Endpoints
// ==========================================
let server;
let port;

const ownerToken = createToken({ id: 'A001', name: 'Admin', role: 'owner' });
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

describe('Payment API Endpoints', () => {
    before(() => {
        return new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', () => {
                port = server.address().port;
                // Reset store
                store.tickets.length = 0;
                store.refunds.length = 0;
                store.auditLog.length = 0;
                store.nextTicketId = 5001;
                resolve();
            });
        });
    });

    after(() => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });

    describe('POST /api/tickets/:id/pay (via PaymentService)', () => {
        it('pays a ticket through the payment service', async () => {
            // Create ticket first
            const create = await req('POST', '/api/tickets', {
                items: [{ name: 'Burger', price: 12.99, qty: 2 }],
                type: 'dine-in'
            }, serverToken);
            assert.equal(create.status, 201);
            const ticketId = create.body.id;

            // Pay the ticket
            const pay = await req('POST', `/api/tickets/${ticketId}/pay`, {
                method: 'credit',
                tip: 5
            }, serverToken);
            assert.equal(pay.status, 200);
            assert.equal(pay.body.status, 'paid');
            assert.equal(pay.body.paid, true);
            assert.ok(pay.body.payments.length > 0);
            assert.ok(pay.body.payments[0].transactionId);
            assert.equal(pay.body.payments[0].transactionState, 'CAPTURED');
        });

        it('supports idempotent partial payments', async () => {
            const create = await req('POST', '/api/tickets', {
                items: [{ name: 'Salad', price: 20, qty: 1 }, { name: 'Drink', price: 5, qty: 1 }],
                type: 'dine-in'
            }, serverToken);
            const ticketId = create.body.id;

            // First partial payment with idempotency key
            const pay1 = await req('POST', `/api/tickets/${ticketId}/pay`, {
                method: 'cash',
                amount: 10,
                idempotencyKey: 'test-idem-001'
            }, serverToken);
            assert.equal(pay1.status, 200);
            assert.equal(pay1.body.status, 'partial');

            // Same idempotency key — should return existing state, not add another payment
            const pay2 = await req('POST', `/api/tickets/${ticketId}/pay`, {
                method: 'cash',
                amount: 10,
                idempotencyKey: 'test-idem-001'
            }, serverToken);
            assert.equal(pay2.status, 200);
            // Should still have the same number of payments (not doubled)
            assert.equal(pay2.body.payments.length, pay1.body.payments.length);
        });

        it('rejects paying an already-paid ticket', async () => {
            const create = await req('POST', '/api/tickets', {
                items: [{ name: 'Soup', price: 6.99, qty: 1 }]
            }, serverToken);
            const ticketId = create.body.id;

            await req('POST', `/api/tickets/${ticketId}/pay`, { method: 'cash' }, serverToken);

            const again = await req('POST', `/api/tickets/${ticketId}/pay`, { method: 'cash' }, serverToken);
            assert.equal(again.status, 400);
            assert.ok(again.body.error.includes('Already paid'));
        });
    });

    describe('POST /api/tickets/:id/partial-pay (via PaymentService)', () => {
        it('processes partial payments through payment service', async () => {
            const create = await req('POST', '/api/tickets', {
                items: [{ name: 'Steak', price: 45, qty: 1 }]
            }, serverToken);
            const ticketId = create.body.id;

            const partial = await req('POST', `/api/tickets/${ticketId}/partial-pay`, {
                amount: 20,
                method: 'credit'
            }, serverToken);
            assert.equal(partial.status, 200);
            assert.ok(partial.body.partialPayments.length > 0);
            assert.ok(partial.body.partialPayments[0].transactionId);
            assert.ok(partial.body.remainingBalance > 0);
        });
    });

    describe('POST /api/tickets/:id/void (via PaymentService)', () => {
        it('voids a ticket and its payment transactions', async () => {
            const create = await req('POST', '/api/tickets', {
                items: [{ name: 'Pasta', price: 18, qty: 1 }]
            }, serverToken);
            const ticketId = create.body.id;

            await req('POST', `/api/tickets/${ticketId}/pay`, {
                method: 'credit'
            }, serverToken);

            const voidRes = await req('POST', `/api/tickets/${ticketId}/void`, {
                reason: 'Customer complaint'
            }, ownerToken);
            assert.equal(voidRes.status, 200);
            assert.equal(voidRes.body.status, 'voided');
            assert.equal(voidRes.body.voidReason, 'Customer complaint');
        });
    });

    describe('POST /api/refunds (via PaymentService)', () => {
        it('refunds a paid ticket through payment service', async () => {
            const create = await req('POST', '/api/tickets', {
                items: [{ name: 'Pizza', price: 15, qty: 1 }]
            }, serverToken);
            const ticketId = create.body.id;

            await req('POST', `/api/tickets/${ticketId}/pay`, {
                method: 'credit'
            }, serverToken);

            const refund = await req('POST', '/api/refunds', {
                ticketId,
                amount: 15,
                reason: 'Wrong order',
                type: 'full'
            }, ownerToken);
            assert.equal(refund.status, 201);
            assert.equal(refund.body.amount, 15);
        });
    });

    describe('Payment Service API Endpoints', () => {
        it('GET /api/payments/ticket/:ticketId returns payment summary', async () => {
            const create = await req('POST', '/api/tickets', {
                items: [{ name: 'Wine', price: 12, qty: 1 }]
            }, serverToken);
            const ticketId = create.body.id;

            await req('POST', `/api/tickets/${ticketId}/pay`, {
                method: 'credit',
                tip: 3
            }, serverToken);

            const summary = await req('GET', `/api/payments/ticket/${ticketId}`, null, serverToken);
            assert.equal(summary.status, 200);
            assert.equal(summary.body.ticketId, ticketId);
            assert.ok(summary.body.totalPaid >= 0);
        });

        it('POST /api/payments/batch/settle settles batch', async () => {
            const settle = await req('POST', '/api/payments/batch/settle', {}, ownerToken);
            assert.equal(settle.status, 200);
            assert.equal(settle.body.success, true);
        });

        it('GET /api/payments/log returns payment logs', async () => {
            const logs = await req('GET', '/api/payments/log', null, ownerToken);
            assert.equal(logs.status, 200);
            assert.ok(Array.isArray(logs.body.logs));
        });

        it('GET /api/payments/health returns provider health', async () => {
            const health = await req('GET', '/api/payments/health', null, ownerToken);
            assert.equal(health.status, 200);
            assert.equal(health.body.healthy, true);
        });
    });
});
