/**
 * Payment Service — Central Payment Orchestrator
 *
 * Decouples all payment logic from route handlers and ticket services.
 * Routes call PaymentService methods; PaymentService delegates to the
 * appropriate PaymentProvider and manages transactions, idempotency,
 * state machine, and logging.
 *
 * Design goals:
 * - POS core communicates ONLY through PaymentService
 * - No direct gateway calls from route handlers
 * - Provider is injected (dependency injection), enabling future providers
 * - All payment mutations go through the transaction state machine
 * - Idempotency keys prevent duplicate charge submissions
 * - Centralized payment logging for every operation
 */

const crypto = require('crypto');
const {
    TransactionState,
    createTransaction,
    transitionState,
    isValidTransition
} = require('./payment-provider');
const { PaybotXProvider, ManualProvider } = require('./payment-paybotx');
const { PaymentLogger } = require('./payment-logger');

// Idempotency key TTL (1 hour)
const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000;

// Duplicate detection window (30 seconds)
const DUPLICATE_WINDOW_MS = 30 * 1000;

class PaymentService {
    /**
     * @param {object} options
     * @param {object} options.store - Reference to the data store
     * @param {function} options.auditFn - Audit log function (action, user, details)
     * @param {function} options.saveFn - Trigger data persistence
     * @param {function} [options.webhookFn] - Fire webhooks
     * @param {object} [options.providerConfig] - Provider configuration overrides
     */
    constructor({ store, auditFn, saveFn, webhookFn = null, providerConfig = {} }) {
        this._store = store;
        this._saveFn = saveFn;
        this._webhookFn = webhookFn;

        // Initialize transaction storage on store if not present
        if (!this._store.transactions) {
            this._store.transactions = [];
        }
        if (!this._store.paymentLog) {
            this._store.paymentLog = [];
        }

        // Initialize payment logger
        this._logger = new PaymentLogger({
            auditFn,
            paymentLog: this._store.paymentLog
        });

        // Initialize providers
        this._providers = new Map();
        this._registerDefaultProviders(providerConfig);

        // Idempotency cache: key -> { result, expiresAt }
        this._idempotencyCache = new Map();
    }

    // ==========================================
    // Provider Management
    // ==========================================

    /**
     * Register default payment providers.
     * @private
     */
    _registerDefaultProviders(providerConfig) {
        // Manual provider (cash, check, etc.) — always available
        const manual = new ManualProvider();
        manual.initialize();
        this._providers.set('manual', manual);

        // PaybotX provider — configured from store or explicit config
        const terminalConfig = this._store.config && this._store.config.terminal
            ? this._store.config.terminal
            : {};

        const paybotxConfig = {
            merchantId: providerConfig.merchantId || terminalConfig.merchantId || process.env.PAYBOTX_MERCHANT_ID || '',
            apiKey: providerConfig.apiKey || terminalConfig.apiKey || process.env.PAYBOTX_API_KEY || '',
            gatewayUrl: providerConfig.gatewayUrl || terminalConfig.gatewayUrl || 'https://vt.isoaccess.com',
            terminalId: providerConfig.terminalId || terminalConfig.terminalId || '',
            proxyUrl: providerConfig.proxyUrl || process.env.PAYBOTX_PROXY_URL || null,
            ...providerConfig
        };

        const paybotx = new PaybotXProvider(paybotxConfig);
        paybotx.initialize();
        this._providers.set('paybotx', paybotx);
    }

    /**
     * Register a custom payment provider.
     * @param {string} name
     * @param {PaymentProvider} provider
     */
    registerProvider(name, provider) {
        this._providers.set(name, provider);
    }

    /**
     * Get a provider by name.
     * @param {string} name
     * @returns {PaymentProvider}
     */
    getProvider(name) {
        return this._providers.get(name) || null;
    }

    /**
     * Resolve which provider to use for a payment method.
     * @param {string} method - 'cash', 'card', 'credit', 'debit', etc.
     * @returns {PaymentProvider}
     */
    _resolveProvider(method) {
        if (!method || method === 'cash' || method === 'check') {
            return this._providers.get('manual');
        }
        // Card payments go through PaybotX (or whatever card provider is registered)
        return this._providers.get('paybotx') || this._providers.get('manual');
    }

    // ==========================================
    // Idempotency
    // ==========================================

    /**
     * Check idempotency cache for a previous result.
     * @param {string} key
     * @returns {object|null} Previous result or null
     */
    _checkIdempotency(key) {
        if (!key) return null;

        const cached = this._idempotencyCache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expiresAt) {
            this._idempotencyCache.delete(key);
            return null;
        }

        return cached.result;
    }

    /**
     * Store a result in the idempotency cache.
     * @param {string} key
     * @param {object} result
     */
    _storeIdempotency(key, result) {
        if (!key) return;
        this._idempotencyCache.set(key, {
            result,
            expiresAt: Date.now() + IDEMPOTENCY_TTL_MS
        });
    }

    /**
     * Clean expired idempotency entries.
     */
    cleanIdempotencyCache() {
        const now = Date.now();
        for (const [key, entry] of this._idempotencyCache) {
            if (now > entry.expiresAt) {
                this._idempotencyCache.delete(key);
            }
        }
    }

    // ==========================================
    // Duplicate Detection
    // ==========================================

    /**
     * Check for duplicate charge submissions.
     * @param {number} ticketId
     * @param {number} amount
     * @param {string} method
     * @returns {object|null} Existing transaction if duplicate
     */
    _checkDuplicate(ticketId, amount, method) {
        const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();

        return this._store.transactions.find(t =>
            t.ticketId === ticketId &&
            t.amount === amount &&
            t.method === method &&
            t.createdAt > cutoff &&
            t.state !== TransactionState.FAILED &&
            t.state !== TransactionState.VOIDED
        ) || null;
    }

    // ==========================================
    // Transaction ID Generation
    // ==========================================

    _nextTransactionId() {
        const txns = this._store.transactions;
        if (!txns || txns.length === 0) return 'TXN-0001';
        const max = Math.max(...txns.map(t => {
            const num = parseInt(String(t.id).replace('TXN-', ''), 10);
            return isNaN(num) ? 0 : num;
        }));
        return 'TXN-' + String(max + 1).padStart(4, '0');
    }

    _generateRequestId() {
        return 'REQ-' + crypto.randomBytes(8).toString('hex');
    }

    // ==========================================
    // Core Payment Operations
    // ==========================================

    /**
     * Process a payment (charge) for a ticket.
     *
     * @param {object} params
     * @param {object} params.ticket - The ticket object
     * @param {number} params.amount - Payment amount
     * @param {string} params.method - Payment method ('cash', 'card', etc.)
     * @param {number} [params.tip=0] - Tip amount
     * @param {string} [params.idempotencyKey] - Idempotency key
     * @param {object} [params.savedPayment] - Saved payment method
     * @param {object} [params.tokenEntry] - Token vault entry
     * @param {object} params.user - User performing the payment
     * @returns {Promise<{success: boolean, transaction: object, ticket: object, error?: string}>}
     */
    async processPayment(params) {
        const {
            ticket,
            amount,
            method = 'cash',
            tip = 0,
            idempotencyKey = null,
            savedPayment = null,
            tokenEntry = null,
            user
        } = params;

        const requestId = this._generateRequestId();
        const payAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;
        const tipAmount = Math.round((parseFloat(tip) || 0) * 100) / 100;

        // 1. Check idempotency
        if (idempotencyKey) {
            const cached = this._checkIdempotency(idempotencyKey);
            if (cached) {
                this._logger.logIdempotencyHit({
                    requestId,
                    ticketId: ticket.id,
                    idempotencyKey,
                    transactionId: cached.transaction ? cached.transaction.id : null
                }, user);
                return cached;
            }
        }

        // 2. Validate ticket state
        if (ticket.status === 'paid') {
            return { success: false, error: 'Already paid', transaction: null, ticket };
        }
        if (ticket.status === 'voided') {
            return { success: false, error: 'Cannot pay a voided ticket', transaction: null, ticket };
        }

        // 3. Calculate remaining balance
        if (!ticket.payments) ticket.payments = [];
        const previouslyPaid = ticket.payments.reduce((s, p) => s + p.amount, 0);
        const remaining = Math.round((ticket.total - previouslyPaid) * 100) / 100;

        if (payAmount <= 0) {
            return { success: false, error: 'Payment amount must be positive', transaction: null, ticket };
        }
        if (payAmount > remaining) {
            return {
                success: false,
                error: 'Payment amount exceeds remaining balance',
                remaining,
                previouslyPaid,
                transaction: null,
                ticket
            };
        }

        // 4. Duplicate detection
        const duplicate = this._checkDuplicate(ticket.id, payAmount, method);
        if (duplicate) {
            this._logger.logDuplicateDetected({
                requestId,
                ticketId: ticket.id,
                amount: payAmount,
                method,
                transactionId: duplicate.id
            }, user);
            // Return the existing result rather than charging again
            return { success: true, transaction: duplicate, ticket, duplicate: true };
        }

        // 5. Create transaction record
        const transaction = createTransaction({
            id: this._nextTransactionId(),
            ticketId: ticket.id,
            amount: payAmount,
            method,
            tip: tipAmount,
            provider: this._resolveProvider(method).name,
            idempotencyKey,
            metadata: {
                requestId,
                savedPaymentId: savedPayment ? savedPayment.id : null,
                tokenId: tokenEntry ? tokenEntry.id : null
            }
        });

        // Set card info from saved payment or token
        if (savedPayment) {
            transaction.cardLastFour = savedPayment.lastFour;
            transaction.tokenId = savedPayment.id;
        }
        if (tokenEntry) {
            transaction.cardLastFour = tokenEntry.lastFour;
            transaction.cardBrand = tokenEntry.cardBrand;
            transaction.tokenId = tokenEntry.id;
        }

        this._store.transactions.push(transaction);

        // 6. Log initiation
        this._logger.logChargeInitiated({
            requestId,
            transactionId: transaction.id,
            ticketId: ticket.id,
            amount: payAmount,
            method,
            provider: transaction.provider,
            idempotencyKey
        }, user);

        // 7. Call provider
        const provider = this._resolveProvider(method);
        let result;
        try {
            result = await provider.charge({
                amount: payAmount,
                tip: tipAmount,
                ticketId: ticket.id,
                metadata: {
                    requestId,
                    cardLastFour: transaction.cardLastFour,
                    tokenId: transaction.tokenId
                }
            });
        } catch (err) {
            // Provider threw — mark as failed
            transitionState(transaction, TransactionState.FAILED, err.message);
            this._logger.logChargeFailed({
                requestId,
                transactionId: transaction.id,
                ticketId: ticket.id,
                amount: payAmount,
                error: err.message,
                provider: provider.name
            }, user);
            this._saveFn();
            return { success: false, error: err.message, transaction, ticket };
        }

        // 8. Update transaction from gateway result
        if (result.success) {
            transitionState(transaction, TransactionState.CAPTURED, 'Payment approved');
            transaction.gatewayTransactionId = result.gatewayTransactionId;
            transaction.gatewayResponseCode = result.responseCode;
            transaction.cardLastFour = result.cardLastFour || transaction.cardLastFour;
            transaction.cardBrand = result.cardBrand || transaction.cardBrand;
            transaction.isDebit = result.isDebit || false;

            // 9. Update ticket
            const payment = {
                amount: payAmount,
                method,
                tip: tipAmount,
                transactionId: transaction.id,
                savedPaymentId: savedPayment ? savedPayment.id : null,
                tokenId: tokenEntry ? tokenEntry.id : null,
                cardLastFour: transaction.cardLastFour,
                paidBy: user ? user.name : 'unknown',
                paidAt: new Date().toISOString()
            };
            ticket.payments.push(payment);

            const totalPaid = Math.round((previouslyPaid + payAmount) * 100) / 100;

            if (totalPaid >= ticket.total) {
                ticket.status = 'paid';
                ticket.paid = true;
                ticket.paidAt = new Date().toISOString();
            } else {
                ticket.status = 'partial';
            }

            // Legacy fields for backward compatibility
            ticket.paymentMethod = method;
            ticket.tip = ticket.payments.reduce((s, p) => s + (p.tip || 0), 0);
            ticket.paidBy = user ? user.name : 'unknown';
            ticket.totalPaid = totalPaid;
            ticket.remaining = Math.round((ticket.total - totalPaid) * 100) / 100;

            this._logger.logChargeSuccess({
                requestId,
                transactionId: transaction.id,
                ticketId: ticket.id,
                amount: payAmount,
                method,
                provider: provider.name,
                gatewayTransactionId: result.gatewayTransactionId,
                gatewayResponseCode: result.responseCode,
                state: transaction.state
            }, user);

            if (ticket.status === 'paid' && this._webhookFn) {
                this._webhookFn('ticket.paid', { ticketId: ticket.id, total: ticket.total, method });
            }

            // Update customer stats
            if (ticket.status === 'paid' && ticket.customerId) {
                const customer = this._store.customers.find(c => c.id === ticket.customerId);
                if (customer) {
                    customer.totalSpent = Math.round(((customer.totalSpent || 0) + ticket.total) * 100) / 100;
                    customer.visitCount = (customer.visitCount || 0) + 1;
                    customer.lastVisit = new Date().toISOString();
                }
            }
        } else {
            transitionState(transaction, TransactionState.FAILED, result.responseMessage);
            transaction.gatewayResponseCode = result.responseCode;

            this._logger.logChargeFailed({
                requestId,
                transactionId: transaction.id,
                ticketId: ticket.id,
                amount: payAmount,
                error: result.responseMessage,
                provider: provider.name,
                gatewayResponseCode: result.responseCode
            }, user);
        }

        // 10. Store idempotency result
        const response = { success: result.success, transaction, ticket };
        if (!result.success) response.error = result.responseMessage;
        this._storeIdempotency(idempotencyKey, response);

        this._saveFn();
        return response;
    }

    /**
     * Process a void on a ticket.
     *
     * @param {object} params
     * @param {object} params.ticket - The ticket object
     * @param {string} [params.reason] - Void reason
     * @param {object} params.user - User performing the void
     * @returns {Promise<{success: boolean, ticket: object, error?: string}>}
     */
    async processVoid(params) {
        const { ticket, reason = '', user } = params;
        const requestId = this._generateRequestId();

        this._logger.logVoidInitiated({
            requestId,
            ticketId: ticket.id,
            reason,
            beforeValue: ticket.status
        }, user);

        // Find related transactions and void them
        const ticketTransactions = this._store.transactions.filter(
            t => t.ticketId === ticket.id &&
            (t.state === TransactionState.CAPTURED || t.state === TransactionState.AUTHORIZED)
        );

        for (const txn of ticketTransactions) {
            const provider = this._providers.get(txn.provider) || this._providers.get('manual');
            try {
                const result = await provider.void({
                    transactionId: txn.id,
                    gatewayTransactionId: txn.gatewayTransactionId,
                    reason
                });

                if (result.success) {
                    transitionState(txn, TransactionState.VOIDED, reason || 'Ticket voided');
                } else {
                    // Log failure but continue — the ticket void still happens in the POS
                    this._logger.logVoidFailed({
                        requestId,
                        transactionId: txn.id,
                        ticketId: ticket.id,
                        error: result.responseMessage,
                        provider: provider.name
                    }, user);
                }
            } catch (err) {
                this._logger.logProviderError({
                    requestId,
                    transactionId: txn.id,
                    ticketId: ticket.id,
                    error: err.message,
                    provider: provider.name
                }, user);
            }
        }

        // Update ticket status
        ticket.status = 'voided';
        ticket.voidedBy = user ? user.name : 'unknown';
        ticket.voidedAt = new Date().toISOString();
        ticket.voidReason = reason;

        this._logger.logVoidSuccess({
            requestId,
            ticketId: ticket.id,
            reason,
            afterValue: 'voided'
        }, user);

        this._saveFn();
        return { success: true, ticket };
    }

    /**
     * Process a refund.
     *
     * @param {object} params
     * @param {object} params.ticket - The ticket object
     * @param {number} params.amount - Refund amount
     * @param {string} [params.reason] - Refund reason
     * @param {string} [params.type] - 'full' or 'partial'
     * @param {object} params.user - User performing the refund
     * @returns {Promise<{success: boolean, refund: object, ticket: object, error?: string}>}
     */
    async processRefund(params) {
        const { ticket, amount, reason = 'No reason provided', type = 'full', user } = params;
        const requestId = this._generateRequestId();
        const refundAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;

        // Validate
        if (ticket.status !== 'paid') {
            return { success: false, error: 'Can only refund paid tickets', refund: null, ticket };
        }

        const previousRefunds = ticket.refundedAmount || 0;
        const remainingBalance = Math.round((ticket.total - previousRefunds) * 100) / 100;

        if (refundAmount <= 0) {
            return { success: false, error: 'Refund amount must be positive', refund: null, ticket };
        }
        if (refundAmount > remainingBalance) {
            return {
                success: false,
                error: 'Refund amount exceeds remaining balance',
                remainingBalance,
                previousRefunds,
                refund: null,
                ticket
            };
        }

        this._logger.logRefundInitiated({
            requestId,
            ticketId: ticket.id,
            amount: refundAmount,
            reason,
            beforeValue: previousRefunds
        }, user);

        // Find the original transaction to refund through the provider
        const originalTxn = this._store.transactions.find(
            t => t.ticketId === ticket.id &&
            (t.state === TransactionState.CAPTURED || t.state === TransactionState.SETTLED)
        );

        let providerResult = null;
        if (originalTxn) {
            const provider = this._providers.get(originalTxn.provider) || this._providers.get('manual');
            try {
                providerResult = await provider.refund({
                    transactionId: originalTxn.id,
                    gatewayTransactionId: originalTxn.gatewayTransactionId,
                    amount: refundAmount,
                    reason
                });

                if (providerResult.success) {
                    const newState = (refundAmount >= remainingBalance)
                        ? TransactionState.REFUNDED
                        : TransactionState.PARTIALLY_REFUNDED;
                    if (isValidTransition(originalTxn.state, newState)) {
                        transitionState(originalTxn, newState, reason);
                    }
                }
            } catch (err) {
                this._logger.logRefundFailed({
                    requestId,
                    ticketId: ticket.id,
                    amount: refundAmount,
                    error: err.message
                }, user);
                // Continue with refund record — the POS records it regardless
            }
        }

        // Create refund record (compatible with existing store.refunds format)
        const refundRecord = {
            id: this._nextRefundId(),
            ticketId: ticket.id,
            amount: refundAmount,
            reason,
            type,
            method: ticket.paymentMethod,
            processedBy: user ? user.name : 'unknown',
            time: new Date().toISOString(),
            transactionId: originalTxn ? originalTxn.id : null,
            gatewayRefundId: providerResult ? providerResult.gatewayTransactionId : null
        };

        this._store.refunds.push(refundRecord);

        // Update ticket
        ticket.refundedAmount = Math.round((previousRefunds + refundAmount) * 100) / 100;
        if (type === 'full' || ticket.refundedAmount >= ticket.total) {
            ticket.status = 'refunded';
        }

        this._logger.logRefundSuccess({
            requestId,
            ticketId: ticket.id,
            amount: refundAmount,
            reason,
            afterValue: ticket.refundedAmount
        }, user);

        this._saveFn();
        return { success: true, refund: refundRecord, ticket };
    }

    /**
     * Process a partial payment on a ticket.
     * Uses the partialPayments array for backward compatibility with existing endpoint.
     *
     * @param {object} params
     * @param {object} params.ticket - The ticket object
     * @param {number} params.amount - Payment amount
     * @param {string} [params.method='card'] - Payment method
     * @param {string} [params.idempotencyKey] - Idempotency key
     * @param {object} params.user - User performing the payment
     * @returns {Promise<{success: boolean, ticket: object, transaction?: object, error?: string}>}
     */
    async processPartialPayment(params) {
        const { ticket, amount, method = 'card', idempotencyKey = null, user } = params;
        const requestId = this._generateRequestId();
        const payAmount = Math.round((parseFloat(amount) || 0) * 100) / 100;

        if (ticket.status === 'paid') {
            return { success: false, error: 'Ticket already fully paid', ticket };
        }
        if (ticket.status === 'voided') {
            return { success: false, error: 'Cannot pay a voided ticket', ticket };
        }
        if (payAmount <= 0) {
            return { success: false, error: 'Valid payment amount required', ticket };
        }

        if (!ticket.partialPayments) ticket.partialPayments = [];

        // Idempotency check
        if (idempotencyKey) {
            const cached = this._checkIdempotency(idempotencyKey);
            if (cached) {
                this._logger.logIdempotencyHit({
                    requestId, ticketId: ticket.id, idempotencyKey
                }, user);
                return cached;
            }

            const duplicate = ticket.partialPayments.find(p => p.idempotencyKey === idempotencyKey);
            if (duplicate) {
                return { success: true, ticket, duplicate: true };
            }
        }

        // Prevent overpayment
        const currentPaid = ticket.partialPayments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = Math.round(((ticket.total || 0) - currentPaid) * 100) / 100;
        const finalAmount = Math.round(Math.min(payAmount, remaining) * 100) / 100;

        if (finalAmount <= 0) {
            return { success: false, error: 'Ticket already fully paid', ticket };
        }

        // Create transaction
        const transaction = createTransaction({
            id: this._nextTransactionId(),
            ticketId: ticket.id,
            amount: finalAmount,
            method,
            provider: this._resolveProvider(method).name,
            idempotencyKey
        });
        this._store.transactions.push(transaction);

        // Process through provider
        const provider = this._resolveProvider(method);
        try {
            const result = await provider.charge({ amount: finalAmount, ticketId: ticket.id });
            if (result.success) {
                transitionState(transaction, TransactionState.CAPTURED, 'Partial payment approved');
                transaction.gatewayTransactionId = result.gatewayTransactionId;
                transaction.gatewayResponseCode = result.responseCode;
            } else {
                transitionState(transaction, TransactionState.FAILED, result.responseMessage);
                this._saveFn();
                return { success: false, error: result.responseMessage, ticket, transaction };
            }
        } catch (err) {
            transitionState(transaction, TransactionState.FAILED, err.message);
            this._saveFn();
            return { success: false, error: err.message, ticket, transaction };
        }

        // Update ticket
        ticket.partialPayments.push({
            amount: finalAmount,
            method,
            paidAt: new Date().toISOString(),
            idempotencyKey: idempotencyKey || null,
            transactionId: transaction.id
        });

        const totalPaid = ticket.partialPayments.reduce((sum, p) => sum + p.amount, 0);
        ticket.amountPaid = Math.round(totalPaid * 100) / 100;
        ticket.remainingBalance = Math.round(((ticket.total || 0) - totalPaid) * 100) / 100;

        if (ticket.remainingBalance <= 0) {
            ticket.status = 'paid';
            ticket.paidAt = new Date().toISOString();
        }

        const response = { success: true, ticket, transaction };
        this._storeIdempotency(idempotencyKey, response);
        this._saveFn();
        return response;
    }

    /**
     * Get transaction history for a ticket.
     * @param {number} ticketId
     * @returns {Array} transactions
     */
    getTransactionsForTicket(ticketId) {
        return this._store.transactions.filter(t => t.ticketId === ticketId);
    }

    /**
     * Get a transaction by ID.
     * @param {string} transactionId
     * @returns {object|null}
     */
    getTransaction(transactionId) {
        return this._store.transactions.find(t => t.id === transactionId) || null;
    }

    /**
     * Health check across all registered providers.
     * @returns {Promise<object>}
     */
    async healthCheck() {
        const results = {};
        for (const [name, provider] of this._providers) {
            results[name] = await provider.healthCheck();
        }
        return {
            healthy: Object.values(results).some(r => r.available),
            providers: results
        };
    }

    /**
     * Get next refund ID (compatible with existing format).
     * @private
     */
    _nextRefundId() {
        if (!this._store.refunds || this._store.refunds.length === 0) return 1;
        return Math.max(...this._store.refunds.map(r => {
            const val = r.id;
            return typeof val === 'number' ? val : 0;
        })) + 1;
    }
}

module.exports = { PaymentService };
