/**
 * Payment Provider Interface & Transaction State Machine
 *
 * Defines the contract all payment providers must implement.
 * Includes transaction state management with idempotency support.
 */

// ==========================================
// Transaction States
// ==========================================
const TransactionState = {
    PENDING: 'PENDING',
    AUTHORIZED: 'AUTHORIZED',
    CAPTURED: 'CAPTURED',
    VOIDED: 'VOIDED',
    REFUNDED: 'REFUNDED',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
    FAILED: 'FAILED',
    SETTLED: 'SETTLED'
};

// Valid state transitions
const VALID_TRANSITIONS = {
    [TransactionState.PENDING]: [TransactionState.AUTHORIZED, TransactionState.CAPTURED, TransactionState.FAILED],
    [TransactionState.AUTHORIZED]: [TransactionState.CAPTURED, TransactionState.VOIDED, TransactionState.FAILED],
    [TransactionState.CAPTURED]: [TransactionState.VOIDED, TransactionState.REFUNDED, TransactionState.PARTIALLY_REFUNDED, TransactionState.SETTLED],
    [TransactionState.PARTIALLY_REFUNDED]: [TransactionState.REFUNDED, TransactionState.PARTIALLY_REFUNDED, TransactionState.SETTLED],
    [TransactionState.VOIDED]: [],
    [TransactionState.REFUNDED]: [],
    [TransactionState.FAILED]: [TransactionState.PENDING],
    [TransactionState.SETTLED]: [TransactionState.REFUNDED, TransactionState.PARTIALLY_REFUNDED]
};

/**
 * Validate a state transition.
 * @param {string} from - Current state
 * @param {string} to - Target state
 * @returns {boolean}
 */
function isValidTransition(from, to) {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.includes(to);
}

// ==========================================
// Transaction Record
// ==========================================

/**
 * Create a new transaction record with all required fields.
 * @param {object} params
 * @returns {object} transaction record
 */
function createTransaction(params) {
    const {
        id,
        ticketId,
        amount,
        method,
        tip = 0,
        provider = 'manual',
        idempotencyKey = null,
        metadata = {}
    } = params;

    return {
        id,
        ticketId,
        amount: Math.round((parseFloat(amount) || 0) * 100) / 100,
        tip: Math.round((parseFloat(tip) || 0) * 100) / 100,
        method,
        provider,
        state: TransactionState.PENDING,
        idempotencyKey,
        gatewayTransactionId: null,
        gatewayResponseCode: null,
        tokenId: null,
        cardLastFour: null,
        cardBrand: null,
        isDebit: false,
        metadata,
        stateHistory: [{
            state: TransactionState.PENDING,
            timestamp: new Date().toISOString(),
            reason: 'Transaction created'
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

/**
 * Transition a transaction to a new state with validation.
 * @param {object} transaction - The transaction record
 * @param {string} newState - Target state
 * @param {string} reason - Reason for transition
 * @returns {object} Updated transaction
 * @throws {Error} If transition is invalid
 */
function transitionState(transaction, newState, reason = '') {
    if (!isValidTransition(transaction.state, newState)) {
        throw new Error(
            `Invalid state transition: ${transaction.state} -> ${newState} ` +
            `for transaction ${transaction.id}`
        );
    }

    transaction.state = newState;
    transaction.updatedAt = new Date().toISOString();
    transaction.stateHistory.push({
        state: newState,
        timestamp: transaction.updatedAt,
        reason
    });

    return transaction;
}

// ==========================================
// PaymentProvider Base Class
// ==========================================

/**
 * Abstract PaymentProvider class.
 * All payment providers must extend this and implement the required methods.
 */
class PaymentProvider {
    /**
     * @param {string} name - Provider name (e.g., 'paybotx', 'stripe', 'manual')
     * @param {object} config - Provider-specific configuration
     */
    constructor(name, config = {}) {
        if (new.target === PaymentProvider) {
            throw new Error('PaymentProvider is abstract and cannot be instantiated directly');
        }
        this.name = name;
        this.config = config;
        this._initialized = false;
    }

    /**
     * Initialize the provider (connect to gateway, validate credentials, etc.)
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async initialize() {
        this._initialized = true;
        return { success: true, message: `${this.name} initialized` };
    }

    /**
     * Check if the provider is ready to process payments.
     * @returns {Promise<{available: boolean, message: string}>}
     */
    async healthCheck() {
        return { available: this._initialized, message: this._initialized ? 'Ready' : 'Not initialized' };
    }

    /**
     * Authorize a payment (hold funds without capturing).
     * @param {object} params - { amount, currency, ticketId, metadata }
     * @returns {Promise<PaymentResult>}
     */
    async authorize(params) {
        throw new Error(`${this.name} does not implement authorize()`);
    }

    /**
     * Capture a previously authorized payment.
     * @param {object} params - { transactionId, amount, metadata }
     * @returns {Promise<PaymentResult>}
     */
    async capture(params) {
        throw new Error(`${this.name} does not implement capture()`);
    }

    /**
     * Charge (authorize + capture in one step).
     * @param {object} params - { amount, currency, ticketId, method, tip, metadata }
     * @returns {Promise<PaymentResult>}
     */
    async charge(params) {
        throw new Error(`${this.name} does not implement charge()`);
    }

    /**
     * Void a transaction (cancel before settlement).
     * @param {object} params - { transactionId, reason, metadata }
     * @returns {Promise<PaymentResult>}
     */
    async void(params) {
        throw new Error(`${this.name} does not implement void()`);
    }

    /**
     * Refund a captured/settled transaction.
     * @param {object} params - { transactionId, amount, reason, metadata }
     * @returns {Promise<PaymentResult>}
     */
    async refund(params) {
        throw new Error(`${this.name} does not implement refund()`);
    }

    /**
     * Adjust tip on an existing transaction.
     * @param {object} params - { transactionId, tipAmount, metadata }
     * @returns {Promise<PaymentResult>}
     */
    async adjustTip(params) {
        throw new Error(`${this.name} does not implement adjustTip()`);
    }

    /**
     * Settle a batch of transactions.
     * @param {object} params - { transactionIds, metadata }
     * @returns {Promise<PaymentResult>}
     */
    async settleBatch(params) {
        throw new Error(`${this.name} does not implement settleBatch()`);
    }

    /**
     * Check if a card is debit (for surcharge exemption).
     * @param {object} params - { tokenId, cardLastFour, metadata }
     * @returns {Promise<{isDebit: boolean}>}
     */
    async checkDebit(params) {
        return { isDebit: false };
    }
}

// ==========================================
// PaymentResult
// ==========================================

/**
 * Standardized result from any payment operation.
 */
class PaymentResult {
    /**
     * @param {object} params
     */
    constructor({
        success,
        transactionId = null,
        gatewayTransactionId = null,
        state = null,
        amount = 0,
        responseCode = null,
        responseMessage = '',
        tokenId = null,
        cardLastFour = null,
        cardBrand = null,
        isDebit = false,
        metadata = {}
    }) {
        this.success = success;
        this.transactionId = transactionId;
        this.gatewayTransactionId = gatewayTransactionId;
        this.state = state;
        this.amount = Math.round((parseFloat(amount) || 0) * 100) / 100;
        this.responseCode = responseCode;
        this.responseMessage = responseMessage;
        this.tokenId = tokenId;
        this.cardLastFour = cardLastFour;
        this.cardBrand = cardBrand;
        this.isDebit = isDebit;
        this.metadata = metadata;
        this.timestamp = new Date().toISOString();
    }
}

module.exports = {
    PaymentProvider,
    PaymentResult,
    TransactionState,
    VALID_TRANSITIONS,
    isValidTransition,
    createTransaction,
    transitionState
};
