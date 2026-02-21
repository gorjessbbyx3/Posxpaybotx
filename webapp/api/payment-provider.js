/**
 * Payment Abstraction Layer
 *
 * Defines the PaymentProvider interface and transaction state machine.
 * All payment processing goes through this layer — POS core never
 * calls gateway APIs directly.
 *
 * Designed for future providers (Stripe, Square, direct processor, etc.).
 */

const crypto = require('crypto');

// ==========================================
// Transaction States
// ==========================================
const TransactionState = Object.freeze({
    PENDING:    'PENDING',
    AUTHORIZED: 'AUTHORIZED',
    CAPTURED:   'CAPTURED',
    VOIDED:     'VOIDED',
    REFUNDED:   'REFUNDED',
    FAILED:     'FAILED',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED'
});

// Valid state transitions
const VALID_TRANSITIONS = Object.freeze({
    [TransactionState.PENDING]:    [TransactionState.AUTHORIZED, TransactionState.CAPTURED, TransactionState.FAILED],
    [TransactionState.AUTHORIZED]: [TransactionState.CAPTURED, TransactionState.VOIDED, TransactionState.FAILED],
    [TransactionState.CAPTURED]:   [TransactionState.VOIDED, TransactionState.REFUNDED, TransactionState.PARTIALLY_REFUNDED],
    [TransactionState.VOIDED]:     [],
    [TransactionState.REFUNDED]:   [],
    [TransactionState.FAILED]:     [TransactionState.PENDING],
    [TransactionState.PARTIALLY_REFUNDED]: [TransactionState.REFUNDED, TransactionState.PARTIALLY_REFUNDED]
});

// ==========================================
// Transaction Record
// ==========================================
/**
 * Create a new transaction record with a unique ID and idempotency key.
 * @param {Object} params
 * @param {number} params.ticketId
 * @param {number} params.amount
 * @param {string} params.method - 'cash', 'credit', 'debit', 'gift_card'
 * @param {number} [params.tip=0]
 * @param {string} [params.idempotencyKey] - Caller-supplied; generated if absent
 * @param {Object} [params.metadata={}] - Provider-specific data
 * @returns {Object} Transaction record
 */
function createTransaction(params) {
    return {
        id: crypto.randomUUID(),
        ticketId: params.ticketId,
        amount: Math.round((parseFloat(params.amount) || 0) * 100) / 100,
        tip: Math.round((parseFloat(params.tip) || 0) * 100) / 100,
        method: params.method || 'cash',
        state: TransactionState.PENDING,
        idempotencyKey: params.idempotencyKey || crypto.randomUUID(),
        providerTransactionId: null,
        authCode: null,
        cardType: null,
        cardLastFour: null,
        cardHolderName: null,
        isDebit: false,
        metadata: params.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stateHistory: [{ state: TransactionState.PENDING, at: new Date().toISOString() }],
        error: null
    };
}

/**
 * Transition a transaction to a new state. Validates the transition.
 * @param {Object} transaction - Transaction record
 * @param {string} newState - Target state from TransactionState
 * @param {string} [reason] - Optional reason for the transition
 * @returns {Object} Updated transaction
 * @throws {Error} If the transition is invalid
 */
function transitionState(transaction, newState, reason) {
    const allowed = VALID_TRANSITIONS[transaction.state];
    if (!allowed || !allowed.includes(newState)) {
        throw new Error(
            `Invalid state transition: ${transaction.state} -> ${newState}. ` +
            `Allowed transitions from ${transaction.state}: ${(allowed || []).join(', ') || 'none'}`
        );
    }
    transaction.state = newState;
    transaction.updatedAt = new Date().toISOString();
    transaction.stateHistory.push({
        state: newState,
        at: transaction.updatedAt,
        reason: reason || null
    });
    return transaction;
}

// ==========================================
// PaymentProvider Interface
// ==========================================
/**
 * Base class that defines the PaymentProvider contract.
 * Concrete providers must override every method.
 *
 * All amounts are in dollars (float, 2 decimal places).
 * All methods return Promises resolving to PaymentResult objects.
 */
class PaymentProvider {
    /**
     * @param {string} name - Human-readable provider name
     */
    constructor(name) {
        if (new.target === PaymentProvider) {
            throw new Error('PaymentProvider is abstract — instantiate a concrete subclass');
        }
        this.name = name;
    }

    /**
     * Authorize (pre-auth) an amount without capturing.
     * Used for bar tabs and hold-and-capture flows.
     * @param {Object} transaction - Transaction record from createTransaction()
     * @returns {Promise<PaymentResult>}
     */
    async authorize(transaction) {
        throw new Error('authorize() not implemented');
    }

    /**
     * Capture a previously authorized transaction.
     * @param {Object} transaction - Must be in AUTHORIZED state
     * @param {number} [amount] - Capture amount (can differ from auth for tip adjust)
     * @returns {Promise<PaymentResult>}
     */
    async capture(transaction, amount) {
        throw new Error('capture() not implemented');
    }

    /**
     * Charge (sale) — authorize + capture in one step.
     * @param {Object} transaction - Transaction record
     * @returns {Promise<PaymentResult>}
     */
    async charge(transaction) {
        throw new Error('charge() not implemented');
    }

    /**
     * Void a transaction (before batch settlement).
     * @param {Object} transaction - Must be in AUTHORIZED or CAPTURED state
     * @param {string} [reason]
     * @returns {Promise<PaymentResult>}
     */
    async void(transaction, reason) {
        throw new Error('void() not implemented');
    }

    /**
     * Refund a captured transaction (full or partial).
     * @param {Object} transaction - Must be in CAPTURED state
     * @param {number} amount - Refund amount
     * @param {string} [reason]
     * @returns {Promise<PaymentResult>}
     */
    async refund(transaction, amount, reason) {
        throw new Error('refund() not implemented');
    }

    /**
     * Adjust the tip on a captured transaction.
     * @param {Object} transaction - Must be in CAPTURED state
     * @param {number} newTip
     * @returns {Promise<PaymentResult>}
     */
    async adjustTip(transaction, newTip) {
        throw new Error('adjustTip() not implemented');
    }

    /**
     * Settle the current batch.
     * @returns {Promise<BatchResult>}
     */
    async settleBatch() {
        throw new Error('settleBatch() not implemented');
    }

    /**
     * Check if the provider is reachable / healthy.
     * @returns {Promise<{healthy: boolean, message: string}>}
     */
    async healthCheck() {
        return { healthy: true, message: `${this.name} provider active` };
    }
}

// ==========================================
// PaymentResult
// ==========================================
/**
 * Standard result object returned by all provider methods.
 * @param {boolean} success
 * @param {Object} [data={}] - Provider-specific response fields
 * @param {string} [error=null] - Error message if !success
 * @returns {Object}
 */
function paymentResult(success, data, error) {
    return {
        success: !!success,
        providerTransactionId: (data && data.providerTransactionId) || null,
        authCode: (data && data.authCode) || null,
        cardType: (data && data.cardType) || null,
        cardLastFour: (data && data.cardLastFour) || null,
        cardHolderName: (data && data.cardHolderName) || null,
        isDebit: (data && data.isDebit) || false,
        amount: (data && data.amount) || null,
        batchId: (data && data.batchId) || null,
        metadata: (data && data.metadata) || {},
        error: error || null,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    TransactionState,
    VALID_TRANSITIONS,
    PaymentProvider,
    createTransaction,
    transitionState,
    paymentResult
};
