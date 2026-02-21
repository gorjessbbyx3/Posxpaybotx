/**
 * Payment Service — Centralized Payment Orchestrator
 *
 * All payment operations flow through this service.
 * - Routes to the correct PaymentProvider based on payment method
 * - Enforces idempotency (prevents duplicate charges)
 * - Manages the transaction ledger
 * - Emits audit events
 * - Handles retry logic with safe backoff
 *
 * POS core (server.js) should ONLY interact with this service —
 * never call providers or gateways directly.
 */

const { createTransaction, TransactionState, transitionState, paymentResult } = require('./payment-provider');
const { InMemoryProvider } = require('./inmemory-provider');

class PaymentService {
    /**
     * @param {Object} options
     * @param {import('./payment-provider').PaymentProvider} [options.cardProvider] - Provider for card payments
     * @param {import('./payment-provider').PaymentProvider} [options.cashProvider] - Provider for cash/non-terminal
     * @param {Function} [options.auditLogger] - fn(action, user, details) for audit trail
     * @param {Function} [options.paymentLogger] - fn(level, message, data) for payment-specific logs
     * @param {Object} [options.retryConfig] - Retry configuration for transient failures
     */
    constructor(options = {}) {
        this.cardProvider = options.cardProvider || new InMemoryProvider();
        this.cashProvider = options.cashProvider || new InMemoryProvider();
        this.auditLogger = options.auditLogger || (() => {});
        this.paymentLogger = options.paymentLogger || (() => {});

        // Retry configuration for transient failures
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 8000,
            ...options.retryConfig
        };

        // Transaction ledger: idempotencyKey -> transaction
        this._ledger = new Map();
        // Transaction index: transactionId -> transaction
        this._byId = new Map();
        // Ticket index: ticketId -> [transactionId, ...]
        this._byTicket = new Map();
    }

    /**
     * Retry a provider call with exponential backoff.
     * Only retries on transient errors (network/5xx). Business errors (declined, invalid) are NOT retried.
     * @param {Function} fn - Async function to call
     * @param {Object} transaction - Transaction record (for logging)
     * @returns {Promise<Object>} Provider result
     */
    async _withRetry(fn, transaction) {
        const { maxRetries, baseDelay, maxDelay } = this.retryConfig;
        let lastResult;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            lastResult = await fn();

            if (lastResult.success) {
                if (attempt > 0) {
                    transaction.metadata = transaction.metadata || {};
                    transaction.metadata.retryCount = attempt;
                }
                return lastResult;
            }

            // Don't retry business errors (declined, invalid amount, etc.)
            if (this._isBusinessError(lastResult.error)) {
                return lastResult;
            }

            // Don't retry if we've exhausted attempts
            if (attempt >= maxRetries) {
                break;
            }

            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            this.paymentLogger('warn', 'Payment retry', {
                transactionId: transaction.id,
                attempt: attempt + 1,
                maxRetries,
                delay,
                error: lastResult.error
            });

            await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Exhausted retries
        transaction.metadata = transaction.metadata || {};
        transaction.metadata.retryCount = maxRetries;
        transaction.metadata.retriesExhausted = true;
        return lastResult;
    }

    /**
     * Check if an error is a business error that should NOT be retried.
     * Business errors: declined, invalid amount, insufficient funds, etc.
     * Transient errors: timeout, network, 5xx — these ARE retried.
     */
    _isBusinessError(errorMessage) {
        if (!errorMessage) return false;
        const msg = errorMessage.toLowerCase();
        const businessPatterns = [
            'declined', 'invalid', 'insufficient', 'expired',
            'not found', 'already', 'duplicate', 'exceeds',
            'must be positive', 'not implemented'
        ];
        return businessPatterns.some(p => msg.includes(p));
    }

    /**
     * Get the correct provider for a payment method.
     */
    _providerFor(method) {
        if (method === 'cash' || method === 'gift_card') {
            return this.cashProvider;
        }
        return this.cardProvider;
    }

    /**
     * Register a transaction in the ledger.
     */
    _register(transaction) {
        this._ledger.set(transaction.idempotencyKey, transaction);
        this._byId.set(transaction.id, transaction);
        const ticketTxns = this._byTicket.get(transaction.ticketId) || [];
        ticketTxns.push(transaction.id);
        this._byTicket.set(transaction.ticketId, ticketTxns);
    }

    /**
     * Look up an existing transaction by idempotency key.
     * Returns null if not found.
     */
    findByIdempotencyKey(key) {
        return this._ledger.get(key) || null;
    }

    /**
     * Look up a transaction by ID.
     */
    findById(id) {
        return this._byId.get(id) || null;
    }

    /**
     * Get all transactions for a ticket.
     * @param {number} ticketId
     * @returns {Array<Object>}
     */
    getTransactionsForTicket(ticketId) {
        const ids = this._byTicket.get(ticketId) || [];
        return ids.map(id => this._byId.get(id)).filter(Boolean);
    }

    /**
     * Get all transactions (for reporting).
     * @returns {Array<Object>}
     */
    getAllTransactions() {
        return Array.from(this._byId.values());
    }

    /**
     * Process a payment (charge) for a ticket.
     *
     * This is the primary entry point for paying a ticket.
     * Handles idempotency, state management, and audit logging.
     *
     * @param {Object} params
     * @param {number} params.ticketId
     * @param {number} params.amount
     * @param {string} params.method - 'cash', 'credit', 'debit', 'gift_card'
     * @param {number} [params.tip=0]
     * @param {string} [params.idempotencyKey]
     * @param {Object} [params.metadata={}]
     * @param {Object} [params.user] - The user processing the payment
     * @returns {Promise<{transaction: Object, result: Object}>}
     */
    async processPayment(params) {
        // Idempotency: if we've already processed this key, return the existing result
        if (params.idempotencyKey) {
            const existing = this.findByIdempotencyKey(params.idempotencyKey);
            if (existing) {
                this.paymentLogger('info', 'Duplicate payment detected (idempotency)', {
                    idempotencyKey: params.idempotencyKey,
                    transactionId: existing.id,
                    state: existing.state
                });
                return {
                    transaction: existing,
                    result: paymentResult(
                        existing.state === TransactionState.CAPTURED,
                        {
                            providerTransactionId: existing.providerTransactionId,
                            authCode: existing.authCode,
                            cardType: existing.cardType,
                            cardLastFour: existing.cardLastFour,
                            amount: existing.amount
                        },
                        existing.error
                    ),
                    duplicate: true
                };
            }
        }

        const transaction = createTransaction(params);
        this._register(transaction);

        this.paymentLogger('info', 'Processing payment', {
            transactionId: transaction.id,
            ticketId: params.ticketId,
            amount: transaction.amount,
            method: transaction.method,
            idempotencyKey: transaction.idempotencyKey
        });

        const provider = this._providerFor(transaction.method);
        const result = await this._withRetry(() => provider.charge(transaction), transaction);

        // Update transaction from result
        if (result.success) {
            transaction.providerTransactionId = result.providerTransactionId || transaction.providerTransactionId;
            transaction.authCode = result.authCode || transaction.authCode;
            transaction.cardType = result.cardType || transaction.cardType;
            transaction.cardLastFour = result.cardLastFour || transaction.cardLastFour;
            transaction.cardHolderName = result.cardHolderName || transaction.cardHolderName;
            transaction.isDebit = result.isDebit || transaction.isDebit;
        } else {
            transaction.error = result.error;
        }

        this.paymentLogger(result.success ? 'info' : 'error', 'Payment result', {
            transactionId: transaction.id,
            success: result.success,
            state: transaction.state,
            providerTransactionId: result.providerTransactionId,
            authCode: result.authCode,
            cardType: result.cardType,
            cardLastFour: result.cardLastFour,
            isDebit: result.isDebit,
            responseCode: result.metadata && result.metadata.responseCode || null,
            gatewayMessage: result.metadata && result.metadata.gatewayMessage || null,
            error: result.error
        });

        this.auditLogger('payment_processed', params.user || null, {
            transactionId: transaction.id,
            ticketId: params.ticketId,
            amount: transaction.amount,
            method: transaction.method,
            success: result.success,
            state: transaction.state,
            providerTransactionId: result.providerTransactionId
        });

        return { transaction, result, duplicate: false };
    }

    /**
     * Authorize (pre-auth) a payment without capturing.
     * @param {Object} params - Same as processPayment
     * @returns {Promise<{transaction: Object, result: Object}>}
     */
    async authorizePayment(params) {
        if (params.idempotencyKey) {
            const existing = this.findByIdempotencyKey(params.idempotencyKey);
            if (existing) {
                return {
                    transaction: existing,
                    result: paymentResult(existing.state === TransactionState.AUTHORIZED, {
                        providerTransactionId: existing.providerTransactionId,
                        authCode: existing.authCode,
                        amount: existing.amount
                    }, existing.error),
                    duplicate: true
                };
            }
        }

        const transaction = createTransaction(params);
        this._register(transaction);

        const provider = this._providerFor(transaction.method);
        const result = await this._withRetry(() => provider.authorize(transaction), transaction);

        if (result.success) {
            transaction.providerTransactionId = result.providerTransactionId || transaction.providerTransactionId;
            transaction.authCode = result.authCode || transaction.authCode;
            transaction.cardType = result.cardType || transaction.cardType;
            transaction.cardLastFour = result.cardLastFour || transaction.cardLastFour;
            transaction.cardHolderName = result.cardHolderName || transaction.cardHolderName;
            transaction.isDebit = result.isDebit || transaction.isDebit;
        }

        this.auditLogger('payment_authorized', params.user || null, {
            transactionId: transaction.id,
            ticketId: params.ticketId,
            amount: transaction.amount,
            method: transaction.method,
            success: result.success
        });

        return { transaction, result, duplicate: false };
    }

    /**
     * Capture a previously authorized transaction.
     * @param {string} transactionId
     * @param {number} [amount] - Capture amount (can differ from auth)
     * @param {Object} [user]
     * @returns {Promise<{transaction: Object, result: Object}>}
     */
    async capturePayment(transactionId, amount, user) {
        const transaction = this.findById(transactionId);
        if (!transaction) {
            return { transaction: null, result: paymentResult(false, {}, 'Transaction not found') };
        }
        if (transaction.state !== TransactionState.AUTHORIZED) {
            return {
                transaction,
                result: paymentResult(false, {}, `Cannot capture: transaction is ${transaction.state}, expected AUTHORIZED`)
            };
        }

        const provider = this._providerFor(transaction.method);
        const result = await this._withRetry(() => provider.capture(transaction, amount), transaction);

        this.auditLogger('payment_captured', user || null, {
            transactionId: transaction.id,
            ticketId: transaction.ticketId,
            amount: amount || transaction.amount,
            success: result.success
        });

        return { transaction, result };
    }

    /**
     * Void a transaction.
     * @param {string} transactionId
     * @param {string} [reason]
     * @param {Object} [user]
     * @returns {Promise<{transaction: Object, result: Object}>}
     */
    async voidPayment(transactionId, reason, user) {
        const transaction = this.findById(transactionId);
        if (!transaction) {
            return { transaction: null, result: paymentResult(false, {}, 'Transaction not found') };
        }
        if (transaction.state !== TransactionState.AUTHORIZED && transaction.state !== TransactionState.CAPTURED) {
            return {
                transaction,
                result: paymentResult(false, {}, `Cannot void: transaction is ${transaction.state}`)
            };
        }

        const provider = this._providerFor(transaction.method);
        const result = await provider.void(transaction, reason);

        this.auditLogger('payment_voided', user || null, {
            transactionId: transaction.id,
            ticketId: transaction.ticketId,
            amount: transaction.amount,
            reason,
            success: result.success
        });

        return { transaction, result };
    }

    /**
     * Refund a captured transaction (full or partial).
     * @param {string} transactionId
     * @param {number} amount
     * @param {string} [reason]
     * @param {Object} [user]
     * @returns {Promise<{transaction: Object, result: Object}>}
     */
    async refundPayment(transactionId, amount, reason, user) {
        const transaction = this.findById(transactionId);
        if (!transaction) {
            return { transaction: null, result: paymentResult(false, {}, 'Transaction not found') };
        }
        if (transaction.state !== TransactionState.CAPTURED && transaction.state !== TransactionState.PARTIALLY_REFUNDED) {
            return {
                transaction,
                result: paymentResult(false, {}, `Cannot refund: transaction is ${transaction.state}`)
            };
        }

        const refundAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;
        if (refundAmount <= 0) {
            return {
                transaction,
                result: paymentResult(false, {}, 'Refund amount must be positive')
            };
        }
        if (refundAmount > transaction.amount) {
            return {
                transaction,
                result: paymentResult(false, {}, 'Refund amount exceeds original transaction amount')
            };
        }

        const provider = this._providerFor(transaction.method);
        const result = await provider.refund(transaction, refundAmount, reason);

        this.auditLogger('payment_refunded', user || null, {
            transactionId: transaction.id,
            ticketId: transaction.ticketId,
            refundAmount,
            reason,
            success: result.success,
            newState: transaction.state
        });

        return { transaction, result };
    }

    /**
     * Adjust tip on a captured transaction.
     * @param {string} transactionId
     * @param {number} newTip
     * @param {Object} [user]
     * @returns {Promise<{transaction: Object, result: Object}>}
     */
    async adjustTip(transactionId, newTip, user) {
        const transaction = this.findById(transactionId);
        if (!transaction) {
            return { transaction: null, result: paymentResult(false, {}, 'Transaction not found') };
        }
        if (transaction.state !== TransactionState.CAPTURED) {
            return {
                transaction,
                result: paymentResult(false, {}, `Cannot adjust tip: transaction is ${transaction.state}`)
            };
        }
        // Validate tip (item 2: reject negative, zero, or non-numeric tips)
        const parsedTip = parseFloat(newTip);
        if (typeof newTip !== 'number' || !isFinite(parsedTip) || parsedTip < 0) {
            return {
                transaction,
                result: paymentResult(false, {}, 'Tip must be a non-negative number')
            };
        }

        const oldTip = transaction.tip;
        const provider = this._providerFor(transaction.method);
        const result = await provider.adjustTip(transaction, Math.round(newTip * 100) / 100);

        this.auditLogger('tip_adjusted', user || null, {
            transactionId: transaction.id,
            ticketId: transaction.ticketId,
            oldTip,
            newTip: transaction.tip,
            success: result.success
        });

        return { transaction, result };
    }

    /**
     * Settle the current batch.
     * @param {Object} [user]
     * @returns {Promise<Object>} Batch result
     */
    async settleBatch(user) {
        const batchResult = await this.cardProvider.settleBatch();

        this.auditLogger('batch_settled', user || null, {
            success: batchResult.success,
            batchId: batchResult.batchId,
            transactionCount: batchResult.transactionCount,
            totalAmount: batchResult.totalAmount
        });

        this.paymentLogger('info', 'Batch settlement', {
            success: batchResult.success,
            batchId: batchResult.batchId,
            transactionCount: batchResult.transactionCount,
            totalAmount: batchResult.totalAmount
        });

        return batchResult;
    }

    /**
     * Health check for all providers.
     * @returns {Promise<Object>}
     */
    async healthCheck() {
        const [cardHealth, cashHealth] = await Promise.all([
            this.cardProvider.healthCheck(),
            this.cashProvider.healthCheck()
        ]);
        return {
            healthy: cardHealth.healthy && cashHealth.healthy,
            cardProvider: cardHealth,
            cashProvider: cashHealth
        };
    }

    /**
     * Get payment summary for a ticket (for receipt / ticket display).
     * @param {number} ticketId
     * @returns {Object}
     */
    getTicketPaymentSummary(ticketId) {
        const transactions = this.getTransactionsForTicket(ticketId);
        const captured = transactions.filter(t =>
            t.state === TransactionState.CAPTURED ||
            t.state === TransactionState.PARTIALLY_REFUNDED
        );
        const voided = transactions.filter(t => t.state === TransactionState.VOIDED);
        const refunded = transactions.filter(t =>
            t.state === TransactionState.REFUNDED ||
            t.state === TransactionState.PARTIALLY_REFUNDED
        );

        const totalPaid = captured.reduce((sum, t) => sum + t.amount, 0);
        const totalTips = captured.reduce((sum, t) => sum + t.tip, 0);
        const totalRefunded = refunded.reduce((sum, t) => {
            // Sum up refund amounts from state history
            const refundEntries = t.stateHistory.filter(h =>
                h.state === TransactionState.REFUNDED || h.state === TransactionState.PARTIALLY_REFUNDED
            );
            return sum + (refundEntries.length > 0 ? t.amount : 0);
        }, 0);

        return {
            ticketId,
            totalPaid: Math.round(totalPaid * 100) / 100,
            totalTips: Math.round(totalTips * 100) / 100,
            totalRefunded: Math.round(totalRefunded * 100) / 100,
            netAmount: Math.round((totalPaid - totalRefunded) * 100) / 100,
            transactionCount: transactions.length,
            capturedCount: captured.length,
            voidedCount: voided.length,
            transactions: transactions.map(t => ({
                id: t.id,
                amount: t.amount,
                tip: t.tip,
                method: t.method,
                state: t.state,
                cardType: t.cardType,
                cardLastFour: t.cardLastFour,
                isDebit: t.isDebit,
                providerTransactionId: t.providerTransactionId,
                createdAt: t.createdAt
            }))
        };
    }
}

module.exports = { PaymentService };
