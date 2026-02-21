/**
 * In-Memory Payment Provider
 *
 * Handles cash, gift card, and non-terminal payments.
 * Also serves as a test double for integration testing.
 *
 * All operations succeed immediately (no external calls).
 */

const crypto = require('crypto');
const { PaymentProvider, TransactionState, transitionState, paymentResult } = require('./payment-provider');

class InMemoryProvider extends PaymentProvider {
    constructor() {
        super('InMemory');
        this.transactions = [];
        this.batches = [];
        this._shouldFail = false;
        this._failMessage = 'Simulated failure';
        this._transientFailCount = 0;
        this._transientCallCount = 0;
    }

    /**
     * Test helper: make the next operation fail.
     * @param {boolean} fail
     * @param {string} [message]
     */
    setFailMode(fail, message) {
        this._shouldFail = !!fail;
        this._failMessage = message || 'Simulated failure';
        this._transientFailCount = 0;
        this._transientCallCount = 0;
    }

    /**
     * Test helper: fail the next N calls, then succeed.
     * Simulates transient errors (network timeout, 5xx) for retry testing.
     * @param {number} failCount - Number of times to fail before succeeding
     * @param {string} [message] - Error message (should be a transient error message)
     */
    setTransientFailMode(failCount, message) {
        this._transientFailCount = failCount;
        this._transientCallCount = 0;
        this._shouldFail = false;
        this._failMessage = message || 'Connection timeout';
    }

    _checkFail(transaction) {
        // Transient failure mode: fail N times then succeed
        if (this._transientFailCount > 0) {
            this._transientCallCount++;
            if (this._transientCallCount <= this._transientFailCount) {
                transaction.error = this._failMessage;
                return paymentResult(false, {}, this._failMessage);
            }
            // Reset after passing the fail threshold
            this._transientFailCount = 0;
            this._transientCallCount = 0;
            return null;
        }

        if (this._shouldFail) {
            if (transaction.state === TransactionState.PENDING) {
                transitionState(transaction, TransactionState.FAILED, this._failMessage);
            }
            transaction.error = this._failMessage;
            return paymentResult(false, {}, this._failMessage);
        }
        return null;
    }

    async authorize(transaction) {
        const fail = this._checkFail(transaction);
        if (fail) return fail;

        transitionState(transaction, TransactionState.AUTHORIZED);
        transaction.providerTransactionId = 'MEM-' + crypto.randomUUID().slice(0, 8);
        transaction.authCode = 'AUTH' + Math.floor(Math.random() * 900000 + 100000);
        this.transactions.push(transaction);

        return paymentResult(true, {
            providerTransactionId: transaction.providerTransactionId,
            authCode: transaction.authCode,
            amount: transaction.amount
        });
    }

    async capture(transaction, amount) {
        const captureAmount = amount !== undefined ? amount : transaction.amount;
        transitionState(transaction, TransactionState.CAPTURED);
        return paymentResult(true, {
            providerTransactionId: transaction.providerTransactionId,
            authCode: transaction.authCode,
            amount: captureAmount
        });
    }

    async charge(transaction) {
        const fail = this._checkFail(transaction);
        if (fail) return fail;

        transitionState(transaction, TransactionState.CAPTURED);
        transaction.providerTransactionId = 'MEM-' + crypto.randomUUID().slice(0, 8);
        transaction.authCode = 'AUTH' + Math.floor(Math.random() * 900000 + 100000);
        this.transactions.push(transaction);

        return paymentResult(true, {
            providerTransactionId: transaction.providerTransactionId,
            authCode: transaction.authCode,
            amount: transaction.amount + transaction.tip
        });
    }

    async void(transaction, reason) {
        transitionState(transaction, TransactionState.VOIDED, reason);
        return paymentResult(true, {
            providerTransactionId: transaction.providerTransactionId,
            amount: transaction.amount
        });
    }

    async refund(transaction, amount, reason) {
        const refundAmount = amount || transaction.amount;
        const isFullRefund = refundAmount >= transaction.amount;
        transitionState(
            transaction,
            isFullRefund ? TransactionState.REFUNDED : TransactionState.PARTIALLY_REFUNDED,
            reason
        );
        return paymentResult(true, {
            providerTransactionId: transaction.providerTransactionId,
            amount: refundAmount
        });
    }

    async adjustTip(transaction, newTip) {
        if (typeof newTip !== 'number' || !isFinite(newTip) || newTip < 0) {
            return paymentResult(false, {}, 'Tip must be a non-negative number');
        }
        transaction.tip = Math.round(newTip * 100) / 100;
        transaction.updatedAt = new Date().toISOString();
        return paymentResult(true, {
            providerTransactionId: transaction.providerTransactionId,
            amount: transaction.amount + transaction.tip
        });
    }

    async settleBatch() {
        const batchId = 'BATCH-' + Date.now();
        const captured = this.transactions.filter(t => t.state === TransactionState.CAPTURED);
        const totalAmount = captured.reduce((sum, t) => sum + t.amount + t.tip, 0);
        const batch = {
            success: true,
            batchId,
            transactionCount: captured.length,
            totalAmount: Math.round(totalAmount * 100) / 100,
            settledAt: new Date().toISOString(),
            message: 'Batch settled successfully'
        };
        this.batches.push(batch);
        return batch;
    }

    async healthCheck() {
        return { healthy: true, message: 'InMemory provider active (no terminal)' };
    }
}

module.exports = { InMemoryProvider };
