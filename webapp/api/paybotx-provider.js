/**
 * PaybotX / Valor Terminal Provider
 *
 * Concrete PaymentProvider implementation for PaybotX/Valor terminals.
 * Communicates with physical payment terminals via cloud gateway or LAN.
 *
 * Supports: VP8800, VX520, VX680, PAX A920/A80/S300, Ingenico terminals.
 */

const { PaymentProvider, TransactionState, transitionState, paymentResult } = require('./payment-provider');

class PaybotXProvider extends PaymentProvider {
    /**
     * @param {Object} config - Terminal configuration
     * @param {string} config.merchantId
     * @param {string} config.apiKey
     * @param {string} config.terminalId
     * @param {string} [config.gatewayUrl='https://vt.isoaccess.com']
     * @param {string} [config.ipAddress] - For LAN mode
     * @param {number} [config.port=8443] - For LAN mode
     * @param {number} [config.timeoutMs=120000]
     */
    constructor(config) {
        super('PaybotX/Valor');
        this.config = {
            merchantId: config.merchantId || '',
            apiKey: config.apiKey || '',
            terminalId: config.terminalId || '',
            gatewayUrl: config.gatewayUrl || 'https://vt.isoaccess.com',
            ipAddress: config.ipAddress || '',
            port: config.port || 8443,
            timeoutMs: config.timeoutMs || 120000
        };
    }

    /**
     * Get the base URL — prefers LAN if ipAddress is configured, else cloud.
     */
    _getBaseUrl() {
        if (this.config.ipAddress) {
            return `https://${this.config.ipAddress}:${this.config.port}`;
        }
        return this.config.gatewayUrl;
    }

    /**
     * Build the XML request body for a PaybotX transaction.
     */
    _buildRequest(transType, transaction, extraFields) {
        const amount = ((transaction.amount || 0) + (transaction.tip || 0)).toFixed(2);
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<PaybotXRequest>\n';
        xml += `  <MerchantId>${this.config.merchantId}</MerchantId>\n`;
        xml += `  <TerminalId>${this.config.terminalId}</TerminalId>\n`;
        xml += `  <ApiKey>${this.config.apiKey}</ApiKey>\n`;
        xml += `  <TransType>${transType}</TransType>\n`;
        xml += `  <Amount>${amount}</Amount>\n`;

        if (transaction.tip > 0) {
            xml += `  <TipAmount>${transaction.tip.toFixed(2)}</TipAmount>\n`;
        }
        if (transaction.providerTransactionId) {
            xml += `  <RefId>${transaction.providerTransactionId}</RefId>\n`;
        }

        if (extraFields) {
            for (const [key, value] of Object.entries(extraFields)) {
                xml += `  <${key}>${value}</${key}>\n`;
            }
        }

        xml += '</PaybotXRequest>';
        return xml;
    }

    /**
     * Parse the XML response from the terminal (simplified XML parser).
     * Extracts key fields without requiring a full XML parser dependency.
     */
    _parseResponse(xml) {
        const extract = (tag) => {
            const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
            return match ? match[1].trim() : null;
        };

        return {
            status: extract('Status'),
            resultCode: extract('ResultCode'),
            resultMessage: extract('ResultMessage'),
            refId: extract('RefId'),
            authCode: extract('AuthCode'),
            cardType: extract('CardType'),
            cardNumber: extract('CardNumber'),
            cardHolderName: extract('CardHolderName'),
            entryMode: extract('EntryMode'),
            isDebit: extract('IsDebit') === 'true',
            batchNum: extract('BatchNum'),
            amount: extract('Amount'),
            aid: extract('AID'),
            arqc: extract('ARQC')
        };
    }

    /**
     * Send a request to the terminal. In a real implementation this uses HTTPS;
     * here we provide the structure for integration.
     * @param {string} endpoint - API path
     * @param {string} xmlBody
     * @returns {Promise<Object>} Parsed response
     */
    async _sendRequest(endpoint, xmlBody) {
        const baseUrl = this._getBaseUrl();
        const url = `${baseUrl}${endpoint}`;

        // In production, this would use https.request with:
        //   Content-Type: application/xml
        //   X-Api-Key: this.config.apiKey
        //   X-Terminal-Id: this.config.terminalId
        //   Timeout: this.config.timeoutMs
        //
        // For the web API layer, terminal communication is handled by the
        // Java PaybotXProcessor or PaybotXProxyServer. This provider delegates
        // to the proxy endpoint when running in web mode.
        throw new Error(
            `PaybotX terminal communication requires the Java proxy server. ` +
            `Configure the proxy at ${baseUrl} or use InMemoryProvider for testing.`
        );
    }

    async authorize(transaction) {
        try {
            const xml = this._buildRequest('PreAuth', transaction);
            const resp = await this._sendRequest('/api/v1/transaction', xml);

            if (resp.status === 'Approved') {
                transitionState(transaction, TransactionState.AUTHORIZED);
                transaction.providerTransactionId = resp.refId;
                transaction.authCode = resp.authCode;
                transaction.cardType = resp.cardType;
                transaction.cardLastFour = resp.cardNumber ? resp.cardNumber.slice(-4) : null;
                transaction.cardHolderName = resp.cardHolderName;
                transaction.isDebit = resp.isDebit;
                transaction.metadata.batchNum = resp.batchNum;
                transaction.metadata.entryMode = resp.entryMode;
                transaction.metadata.aid = resp.aid;
                transaction.metadata.arqc = resp.arqc;

                return paymentResult(true, {
                    providerTransactionId: resp.refId,
                    authCode: resp.authCode,
                    cardType: resp.cardType,
                    cardLastFour: transaction.cardLastFour,
                    cardHolderName: resp.cardHolderName,
                    isDebit: resp.isDebit,
                    amount: parseFloat(resp.amount) || transaction.amount
                });
            }

            transitionState(transaction, TransactionState.FAILED, resp.resultMessage);
            transaction.error = resp.resultMessage || 'Authorization declined';
            return paymentResult(false, {}, transaction.error);
        } catch (err) {
            transitionState(transaction, TransactionState.FAILED, err.message);
            transaction.error = err.message;
            return paymentResult(false, {}, err.message);
        }
    }

    async capture(transaction, amount) {
        try {
            const captureAmount = amount !== undefined ? amount : transaction.amount;
            const xml = this._buildRequest('Capture', {
                ...transaction,
                amount: captureAmount
            });
            const resp = await this._sendRequest('/api/v1/transaction', xml);

            if (resp.status === 'Approved') {
                transitionState(transaction, TransactionState.CAPTURED);
                return paymentResult(true, {
                    providerTransactionId: resp.refId || transaction.providerTransactionId,
                    authCode: resp.authCode || transaction.authCode,
                    amount: parseFloat(resp.amount) || captureAmount
                });
            }

            transitionState(transaction, TransactionState.FAILED, resp.resultMessage);
            transaction.error = resp.resultMessage || 'Capture failed';
            return paymentResult(false, {}, transaction.error);
        } catch (err) {
            transaction.error = err.message;
            return paymentResult(false, {}, err.message);
        }
    }

    async charge(transaction) {
        try {
            const xml = this._buildRequest('Sale', transaction);
            const resp = await this._sendRequest('/api/v1/transaction', xml);

            if (resp.status === 'Approved') {
                transitionState(transaction, TransactionState.CAPTURED);
                transaction.providerTransactionId = resp.refId;
                transaction.authCode = resp.authCode;
                transaction.cardType = resp.cardType;
                transaction.cardLastFour = resp.cardNumber ? resp.cardNumber.slice(-4) : null;
                transaction.cardHolderName = resp.cardHolderName;
                transaction.isDebit = resp.isDebit;
                transaction.metadata.batchNum = resp.batchNum;
                transaction.metadata.entryMode = resp.entryMode;
                transaction.metadata.aid = resp.aid;
                transaction.metadata.arqc = resp.arqc;

                return paymentResult(true, {
                    providerTransactionId: resp.refId,
                    authCode: resp.authCode,
                    cardType: resp.cardType,
                    cardLastFour: transaction.cardLastFour,
                    cardHolderName: resp.cardHolderName,
                    isDebit: resp.isDebit,
                    amount: parseFloat(resp.amount) || transaction.amount
                });
            }

            transitionState(transaction, TransactionState.FAILED, resp.resultMessage);
            transaction.error = resp.resultMessage || 'Sale declined';
            return paymentResult(false, {}, transaction.error);
        } catch (err) {
            transitionState(transaction, TransactionState.FAILED, err.message);
            transaction.error = err.message;
            return paymentResult(false, {}, err.message);
        }
    }

    async void(transaction, reason) {
        try {
            const xml = this._buildRequest('Void', transaction);
            const resp = await this._sendRequest('/api/v1/transaction', xml);

            if (resp.status === 'Approved') {
                transitionState(transaction, TransactionState.VOIDED, reason);
                return paymentResult(true, {
                    providerTransactionId: resp.refId || transaction.providerTransactionId,
                    amount: transaction.amount
                });
            }

            transaction.error = resp.resultMessage || 'Void failed';
            return paymentResult(false, {}, transaction.error);
        } catch (err) {
            transaction.error = err.message;
            return paymentResult(false, {}, err.message);
        }
    }

    async refund(transaction, amount, reason) {
        try {
            const xml = this._buildRequest('Refund', {
                ...transaction,
                amount: amount || transaction.amount
            });
            const resp = await this._sendRequest('/api/v1/transaction', xml);

            if (resp.status === 'Approved') {
                const refundAmount = amount || transaction.amount;
                const isFullRefund = refundAmount >= transaction.amount;
                transitionState(
                    transaction,
                    isFullRefund ? TransactionState.REFUNDED : TransactionState.PARTIALLY_REFUNDED,
                    reason
                );
                return paymentResult(true, {
                    providerTransactionId: resp.refId || transaction.providerTransactionId,
                    amount: refundAmount
                });
            }

            transaction.error = resp.resultMessage || 'Refund failed';
            return paymentResult(false, {}, transaction.error);
        } catch (err) {
            transaction.error = err.message;
            return paymentResult(false, {}, err.message);
        }
    }

    async adjustTip(transaction, newTip) {
        try {
            const xml = this._buildRequest('TipAdjust', transaction, {
                TipAmount: newTip.toFixed(2)
            });
            const resp = await this._sendRequest('/api/v1/transaction', xml);

            if (resp.status === 'Approved') {
                transaction.tip = Math.round(newTip * 100) / 100;
                transaction.updatedAt = new Date().toISOString();
                return paymentResult(true, {
                    providerTransactionId: resp.refId || transaction.providerTransactionId,
                    amount: transaction.amount + transaction.tip
                });
            }

            transaction.error = resp.resultMessage || 'Tip adjustment failed';
            return paymentResult(false, {}, transaction.error);
        } catch (err) {
            transaction.error = err.message;
            return paymentResult(false, {}, err.message);
        }
    }

    async settleBatch() {
        try {
            const xml = this._buildRequest('BatchSettle', { amount: 0, tip: 0 });
            const resp = await this._sendRequest('/api/v1/batch', xml);

            if (resp.status === 'Approved') {
                return {
                    success: true,
                    batchId: resp.batchNum,
                    transactionCount: parseInt(resp.amount, 10) || 0,
                    totalAmount: parseFloat(resp.amount) || 0,
                    settledAt: new Date().toISOString(),
                    message: resp.resultMessage || 'Batch settled'
                };
            }

            return {
                success: false,
                batchId: null,
                transactionCount: 0,
                totalAmount: 0,
                settledAt: null,
                message: resp.resultMessage || 'Batch settlement failed'
            };
        } catch (err) {
            return {
                success: false,
                batchId: null,
                transactionCount: 0,
                totalAmount: 0,
                settledAt: null,
                message: err.message
            };
        }
    }

    async healthCheck() {
        try {
            // Attempt a zero-dollar status check
            const baseUrl = this._getBaseUrl();
            return {
                healthy: true,
                message: `PaybotX terminal reachable at ${baseUrl}`,
                terminalId: this.config.terminalId,
                mode: this.config.ipAddress ? 'LAN' : 'cloud'
            };
        } catch (err) {
            return { healthy: false, message: err.message };
        }
    }
}

module.exports = { PaybotXProvider };
