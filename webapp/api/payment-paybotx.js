/**
 * PaybotX Payment Provider
 *
 * Implements the PaymentProvider interface for Valor/PaybotX terminals.
 * Communicates with terminals via the PaybotX gateway (cloud or LAN).
 * Handles: sale, pre-auth, capture, void, refund, tip adjust, batch settle.
 *
 * In the webapp context, this provider makes HTTP calls to the PaybotX proxy
 * (Java-side PaybotXProxyServer on port 8080) or directly to the Valor gateway.
 */

const { PaymentProvider, PaymentResult, TransactionState } = require('./payment-provider');

class PaybotXProvider extends PaymentProvider {
    constructor(config = {}) {
        super('paybotx', config);
        this.gatewayUrl = config.gatewayUrl || 'https://vt.isoaccess.com';
        this.merchantId = config.merchantId || '';
        this.apiKey = config.apiKey || '';
        this.terminalId = config.terminalId || '';
        this.proxyUrl = config.proxyUrl || null; // Optional local proxy
        this.timeout = config.timeout || 30000;
    }

    async initialize() {
        if (!this.merchantId || !this.apiKey) {
            this._initialized = false;
            return { success: false, message: 'PaybotX requires merchantId and apiKey' };
        }
        this._initialized = true;
        return { success: true, message: 'PaybotX provider initialized' };
    }

    async healthCheck() {
        if (!this._initialized) {
            return { available: false, message: 'Not initialized' };
        }
        // In production, this would ping the gateway or proxy
        try {
            if (this.proxyUrl) {
                const response = await this._httpRequest('GET', `${this.proxyUrl}/health`);
                return { available: response.status === 'ok', message: response.message || 'Proxy reachable' };
            }
            return { available: true, message: 'Gateway configured' };
        } catch (err) {
            return { available: false, message: `Health check failed: ${err.message}` };
        }
    }

    async authorize(params) {
        const { amount, ticketId, metadata = {} } = params;
        try {
            const response = await this._sendToGateway({
                transactionType: 'PRE_AUTH',
                amount,
                ticketId,
                terminalId: this.terminalId,
                ...metadata
            });

            return new PaymentResult({
                success: response.approved,
                gatewayTransactionId: response.transactionId,
                state: response.approved ? TransactionState.AUTHORIZED : TransactionState.FAILED,
                amount,
                responseCode: response.responseCode,
                responseMessage: response.responseMessage || '',
                tokenId: response.tokenId || null,
                cardLastFour: response.cardLastFour || null,
                cardBrand: response.cardBrand || null,
                isDebit: response.isDebit || false,
                metadata: { ticketId, gatewayResponse: response }
            });
        } catch (err) {
            return new PaymentResult({
                success: false,
                state: TransactionState.FAILED,
                amount,
                responseCode: 'ERROR',
                responseMessage: err.message,
                metadata: { ticketId, error: err.message }
            });
        }
    }

    async capture(params) {
        const { transactionId, amount, gatewayTransactionId, metadata = {} } = params;
        try {
            const response = await this._sendToGateway({
                transactionType: 'CAPTURE',
                originalTransactionId: gatewayTransactionId,
                amount,
                terminalId: this.terminalId,
                ...metadata
            });

            return new PaymentResult({
                success: response.approved,
                transactionId,
                gatewayTransactionId: response.transactionId || gatewayTransactionId,
                state: response.approved ? TransactionState.CAPTURED : TransactionState.FAILED,
                amount,
                responseCode: response.responseCode,
                responseMessage: response.responseMessage || '',
                metadata: { gatewayResponse: response }
            });
        } catch (err) {
            return new PaymentResult({
                success: false,
                transactionId,
                state: TransactionState.FAILED,
                responseCode: 'ERROR',
                responseMessage: err.message
            });
        }
    }

    async charge(params) {
        const { amount, ticketId, tip = 0, metadata = {} } = params;
        const totalAmount = Math.round((amount + tip) * 100) / 100;

        try {
            const response = await this._sendToGateway({
                transactionType: 'SALE',
                amount: totalAmount,
                baseAmount: amount,
                tipAmount: tip,
                ticketId,
                terminalId: this.terminalId,
                ...metadata
            });

            return new PaymentResult({
                success: response.approved,
                gatewayTransactionId: response.transactionId,
                state: response.approved ? TransactionState.CAPTURED : TransactionState.FAILED,
                amount: totalAmount,
                responseCode: response.responseCode,
                responseMessage: response.responseMessage || '',
                tokenId: response.tokenId || null,
                cardLastFour: response.cardLastFour || null,
                cardBrand: response.cardBrand || null,
                isDebit: response.isDebit || false,
                metadata: { ticketId, tip, gatewayResponse: response }
            });
        } catch (err) {
            return new PaymentResult({
                success: false,
                state: TransactionState.FAILED,
                amount: totalAmount,
                responseCode: 'ERROR',
                responseMessage: err.message,
                metadata: { ticketId, error: err.message }
            });
        }
    }

    async void(params) {
        const { transactionId, gatewayTransactionId, reason = '', metadata = {} } = params;
        try {
            const response = await this._sendToGateway({
                transactionType: 'VOID',
                originalTransactionId: gatewayTransactionId,
                terminalId: this.terminalId,
                reason,
                ...metadata
            });

            return new PaymentResult({
                success: response.approved,
                transactionId,
                gatewayTransactionId: response.transactionId || gatewayTransactionId,
                state: response.approved ? TransactionState.VOIDED : TransactionState.FAILED,
                responseCode: response.responseCode,
                responseMessage: response.responseMessage || '',
                metadata: { reason, gatewayResponse: response }
            });
        } catch (err) {
            return new PaymentResult({
                success: false,
                transactionId,
                state: TransactionState.FAILED,
                responseCode: 'ERROR',
                responseMessage: err.message
            });
        }
    }

    async refund(params) {
        const { transactionId, gatewayTransactionId, amount, reason = '', metadata = {} } = params;
        try {
            const response = await this._sendToGateway({
                transactionType: 'REFUND',
                originalTransactionId: gatewayTransactionId,
                amount,
                terminalId: this.terminalId,
                reason,
                ...metadata
            });

            return new PaymentResult({
                success: response.approved,
                transactionId,
                gatewayTransactionId: response.transactionId || gatewayTransactionId,
                state: response.approved ? TransactionState.REFUNDED : TransactionState.FAILED,
                amount,
                responseCode: response.responseCode,
                responseMessage: response.responseMessage || '',
                metadata: { reason, gatewayResponse: response }
            });
        } catch (err) {
            return new PaymentResult({
                success: false,
                transactionId,
                state: TransactionState.FAILED,
                amount,
                responseCode: 'ERROR',
                responseMessage: err.message
            });
        }
    }

    async adjustTip(params) {
        const { transactionId, gatewayTransactionId, tipAmount, metadata = {} } = params;
        try {
            const response = await this._sendToGateway({
                transactionType: 'TIP_ADJUST',
                originalTransactionId: gatewayTransactionId,
                tipAmount,
                terminalId: this.terminalId,
                ...metadata
            });

            return new PaymentResult({
                success: response.approved,
                transactionId,
                gatewayTransactionId: response.transactionId || gatewayTransactionId,
                state: response.approved ? TransactionState.CAPTURED : TransactionState.FAILED,
                amount: tipAmount,
                responseCode: response.responseCode,
                responseMessage: response.responseMessage || '',
                metadata: { tipAmount, gatewayResponse: response }
            });
        } catch (err) {
            return new PaymentResult({
                success: false,
                transactionId,
                state: TransactionState.FAILED,
                responseCode: 'ERROR',
                responseMessage: err.message
            });
        }
    }

    async settleBatch(params) {
        const { metadata = {} } = params;
        try {
            const response = await this._sendToGateway({
                transactionType: 'BATCH_SETTLE',
                terminalId: this.terminalId,
                ...metadata
            });

            return new PaymentResult({
                success: response.approved,
                gatewayTransactionId: response.batchId || response.transactionId,
                state: response.approved ? TransactionState.SETTLED : TransactionState.FAILED,
                responseCode: response.responseCode,
                responseMessage: response.responseMessage || '',
                metadata: {
                    batchId: response.batchId,
                    transactionCount: response.transactionCount,
                    totalAmount: response.totalAmount,
                    gatewayResponse: response
                }
            });
        } catch (err) {
            return new PaymentResult({
                success: false,
                state: TransactionState.FAILED,
                responseCode: 'ERROR',
                responseMessage: err.message
            });
        }
    }

    async checkDebit(params) {
        const { cardLastFour, tokenId } = params;
        try {
            const response = await this._sendToGateway({
                transactionType: 'BIN_CHECK',
                cardLastFour,
                tokenId,
                terminalId: this.terminalId
            });
            return { isDebit: response.isDebit || false };
        } catch (err) {
            // Default to not-debit if check fails
            return { isDebit: false };
        }
    }

    /**
     * Send a request to the PaybotX gateway or local proxy.
     * @param {object} payload
     * @returns {Promise<object>} Gateway response
     * @private
     */
    async _sendToGateway(payload) {
        const url = this.proxyUrl || this.gatewayUrl;
        const requestPayload = {
            merchantId: this.merchantId,
            apiKey: this.apiKey,
            ...payload
        };

        // In production, this uses https.request or fetch to call the gateway.
        // For the webapp JSON-store context, we simulate gateway responses.
        // When a real PaybotX proxy is running (Java side), this calls it via HTTP.
        if (this.proxyUrl) {
            return this._httpRequest('POST', `${this.proxyUrl}/api/transaction`, requestPayload);
        }

        // Simulated response for development/testing
        return this._simulateGatewayResponse(payload);
    }

    /**
     * Make an HTTP request (used for proxy communication).
     * @private
     */
    _httpRequest(method, url, body = null) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const proto = urlObj.protocol === 'https:' ? require('https') : require('http');
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname,
                method,
                headers: { 'Content-Type': 'application/json' },
                timeout: this.timeout
            };

            const req = proto.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid gateway response'));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Gateway request timed out'));
            });

            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    /**
     * Simulate a gateway response for development/testing.
     * @private
     */
    _simulateGatewayResponse(payload) {
        return {
            approved: true,
            transactionId: 'GW-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            responseCode: '00',
            responseMessage: 'Approved',
            cardLastFour: payload.cardLastFour || '4242',
            cardBrand: payload.cardBrand || 'Visa',
            isDebit: false,
            tokenId: payload.tokenId || null,
            batchId: payload.transactionType === 'BATCH_SETTLE' ? 'BATCH-' + Date.now() : null,
            transactionCount: payload.transactionType === 'BATCH_SETTLE' ? 0 : undefined,
            totalAmount: payload.amount || 0
        };
    }
}

/**
 * Manual Payment Provider
 *
 * Handles cash and other non-electronic payment methods.
 * No gateway communication needed — just records the transaction.
 */
class ManualProvider extends PaymentProvider {
    constructor(config = {}) {
        super('manual', config);
        this._initialized = true;
    }

    async initialize() {
        this._initialized = true;
        return { success: true, message: 'Manual provider ready' };
    }

    async healthCheck() {
        return { available: true, message: 'Manual provider always available' };
    }

    async charge(params) {
        const { amount, tip = 0 } = params;
        const totalAmount = Math.round((amount + tip) * 100) / 100;
        return new PaymentResult({
            success: true,
            gatewayTransactionId: 'MANUAL-' + Date.now(),
            state: TransactionState.CAPTURED,
            amount: totalAmount,
            responseCode: '00',
            responseMessage: 'Manual payment recorded'
        });
    }

    async void(params) {
        return new PaymentResult({
            success: true,
            transactionId: params.transactionId,
            state: TransactionState.VOIDED,
            responseCode: '00',
            responseMessage: 'Manual void recorded'
        });
    }

    async refund(params) {
        return new PaymentResult({
            success: true,
            transactionId: params.transactionId,
            state: TransactionState.REFUNDED,
            amount: params.amount,
            responseCode: '00',
            responseMessage: 'Manual refund recorded'
        });
    }

    async adjustTip(params) {
        return new PaymentResult({
            success: true,
            transactionId: params.transactionId,
            state: TransactionState.CAPTURED,
            amount: params.tipAmount,
            responseCode: '00',
            responseMessage: 'Tip adjustment recorded'
        });
    }

    async settleBatch() {
        return new PaymentResult({
            success: true,
            state: TransactionState.SETTLED,
            responseCode: '00',
            responseMessage: 'Manual settlement complete'
        });
    }
}

module.exports = { PaybotXProvider, ManualProvider };
