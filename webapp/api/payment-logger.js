/**
 * Centralized Payment Logging Service
 *
 * Structured JSON logging for all payment operations.
 * Captures: request details, gateway responses, state transitions,
 * errors, and audit-relevant fields.
 *
 * Logs are stored in the audit log and optionally written to a
 * separate payment log for analysis.
 */

// ==========================================
// Payment Event Types
// ==========================================
const PaymentEventType = {
    CHARGE_INITIATED: 'payment.charge.initiated',
    CHARGE_SUCCESS: 'payment.charge.success',
    CHARGE_FAILED: 'payment.charge.failed',
    AUTHORIZE_INITIATED: 'payment.authorize.initiated',
    AUTHORIZE_SUCCESS: 'payment.authorize.success',
    AUTHORIZE_FAILED: 'payment.authorize.failed',
    CAPTURE_INITIATED: 'payment.capture.initiated',
    CAPTURE_SUCCESS: 'payment.capture.success',
    CAPTURE_FAILED: 'payment.capture.failed',
    VOID_INITIATED: 'payment.void.initiated',
    VOID_SUCCESS: 'payment.void.success',
    VOID_FAILED: 'payment.void.failed',
    REFUND_INITIATED: 'payment.refund.initiated',
    REFUND_SUCCESS: 'payment.refund.success',
    REFUND_FAILED: 'payment.refund.failed',
    TIP_ADJUSTED: 'payment.tip.adjusted',
    TIP_ADJUST_FAILED: 'payment.tip.failed',
    BATCH_SETTLE_INITIATED: 'payment.batch.initiated',
    BATCH_SETTLE_SUCCESS: 'payment.batch.success',
    BATCH_SETTLE_FAILED: 'payment.batch.failed',
    STATE_TRANSITION: 'payment.state.transition',
    IDEMPOTENCY_HIT: 'payment.idempotency.hit',
    DUPLICATE_DETECTED: 'payment.duplicate.detected',
    PROVIDER_ERROR: 'payment.provider.error'
};

/**
 * PaymentLogger class
 *
 * Collects structured payment log entries and forwards them
 * to the store's audit log and an optional separate payment log.
 */
class PaymentLogger {
    /**
     * @param {object} options
     * @param {function} options.auditFn - Function to write to audit log (action, user, details)
     * @param {Array} [options.paymentLog] - Array to push payment log entries to
     */
    constructor({ auditFn, paymentLog = null }) {
        this._auditFn = auditFn;
        this._paymentLog = paymentLog;
    }

    /**
     * Log a payment event.
     * @param {string} eventType - One of PaymentEventType
     * @param {object} data - Event data
     * @param {object} [user] - User who triggered the event
     */
    log(eventType, data, user = null) {
        const entry = {
            eventType,
            requestId: data.requestId || null,
            transactionId: data.transactionId || null,
            ticketId: data.ticketId || null,
            provider: data.provider || null,
            amount: data.amount !== undefined ? Math.round((parseFloat(data.amount) || 0) * 100) / 100 : null,
            method: data.method || null,
            state: data.state || null,
            previousState: data.previousState || null,
            gatewayTransactionId: data.gatewayTransactionId || null,
            gatewayResponseCode: data.gatewayResponseCode || null,
            idempotencyKey: data.idempotencyKey || null,
            reason: data.reason || null,
            error: data.error || null,
            user: user ? user.name : (data.user || 'system'),
            role: user ? user.role : (data.role || 'system'),
            beforeValue: data.beforeValue !== undefined ? data.beforeValue : null,
            afterValue: data.afterValue !== undefined ? data.afterValue : null,
            timestamp: new Date().toISOString()
        };

        // Write to payment log array if provided
        if (this._paymentLog) {
            this._paymentLog.push(entry);
        }

        // Forward to audit log
        if (this._auditFn) {
            this._auditFn(eventType, user, {
                transactionId: entry.transactionId,
                ticketId: entry.ticketId,
                amount: entry.amount,
                provider: entry.provider,
                method: entry.method,
                state: entry.state,
                gatewayResponseCode: entry.gatewayResponseCode,
                idempotencyKey: entry.idempotencyKey,
                reason: entry.reason,
                error: entry.error
            });
        }

        return entry;
    }

    /**
     * Log a charge initiation.
     */
    logChargeInitiated(data, user) {
        return this.log(PaymentEventType.CHARGE_INITIATED, data, user);
    }

    /**
     * Log a successful charge.
     */
    logChargeSuccess(data, user) {
        return this.log(PaymentEventType.CHARGE_SUCCESS, data, user);
    }

    /**
     * Log a failed charge.
     */
    logChargeFailed(data, user) {
        return this.log(PaymentEventType.CHARGE_FAILED, data, user);
    }

    /**
     * Log a void initiation.
     */
    logVoidInitiated(data, user) {
        return this.log(PaymentEventType.VOID_INITIATED, data, user);
    }

    /**
     * Log a successful void.
     */
    logVoidSuccess(data, user) {
        return this.log(PaymentEventType.VOID_SUCCESS, data, user);
    }

    /**
     * Log a failed void.
     */
    logVoidFailed(data, user) {
        return this.log(PaymentEventType.VOID_FAILED, data, user);
    }

    /**
     * Log a refund initiation.
     */
    logRefundInitiated(data, user) {
        return this.log(PaymentEventType.REFUND_INITIATED, data, user);
    }

    /**
     * Log a successful refund.
     */
    logRefundSuccess(data, user) {
        return this.log(PaymentEventType.REFUND_SUCCESS, data, user);
    }

    /**
     * Log a failed refund.
     */
    logRefundFailed(data, user) {
        return this.log(PaymentEventType.REFUND_FAILED, data, user);
    }

    /**
     * Log a state transition.
     */
    logStateTransition(data, user) {
        return this.log(PaymentEventType.STATE_TRANSITION, data, user);
    }

    /**
     * Log an idempotency cache hit.
     */
    logIdempotencyHit(data, user) {
        return this.log(PaymentEventType.IDEMPOTENCY_HIT, data, user);
    }

    /**
     * Log a duplicate charge detection.
     */
    logDuplicateDetected(data, user) {
        return this.log(PaymentEventType.DUPLICATE_DETECTED, data, user);
    }

    /**
     * Log a provider error.
     */
    logProviderError(data, user) {
        return this.log(PaymentEventType.PROVIDER_ERROR, data, user);
    }
}

module.exports = { PaymentLogger, PaymentEventType };
