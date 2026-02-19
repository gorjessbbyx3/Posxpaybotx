/**
 * Business Logic - Pure Calculation Functions
 *
 * Extracted from pos.js for testability.
 * All functions are pure (no side effects, no DOM access).
 * Used by both frontend and test suite.
 */

const Calculations = (function () {
    'use strict';

    /**
     * Calculate ticket subtotal from line items.
     * @param {Array<{price: number, qty: number}>} items
     * @returns {number}
     */
    function subtotal(items) {
        if (!Array.isArray(items) || items.length === 0) return 0;
        return items.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const qty = parseInt(item.qty, 10) || 0;
            return sum + price * qty;
        }, 0);
    }

    /**
     * Calculate discount amount.
     * @param {number} subtotalAmt - Pre-discount subtotal
     * @param {{type: string, value: number, amount?: number}|null} discount
     * @returns {number}
     */
    function discountAmount(subtotalAmt, discount) {
        if (!discount) return 0;
        if (discount.amount !== undefined && discount.amount !== null) {
            return Math.min(parseFloat(discount.amount) || 0, subtotalAmt);
        }
        if (discount.type === 'percent') {
            return round(subtotalAmt * ((parseFloat(discount.value) || 0) / 100));
        }
        return Math.min(parseFloat(discount.value) || 0, subtotalAmt);
    }

    /**
     * Calculate tax.
     * @param {number} taxableAmount - Amount after discounts
     * @param {number} taxRate - Tax rate as percentage (e.g. 8.875)
     * @returns {number}
     */
    function tax(taxableAmount, taxRate) {
        if (taxableAmount <= 0 || !taxRate) return 0;
        return round(taxableAmount * (taxRate / 100));
    }

    /**
     * Calculate delivery fee based on a tiered schedule.
     * @param {number} subtotalAmt
     * @param {Array<{threshold: number, fee: number}>} schedule - Sorted ascending by threshold
     * @returns {number}
     */
    function deliveryFee(subtotalAmt, schedule) {
        if (!Array.isArray(schedule) || schedule.length === 0) return 0;
        let fee = schedule[0].fee || 0;
        for (const tier of schedule) {
            if (subtotalAmt >= tier.threshold) {
                fee = tier.fee;
            }
        }
        return fee;
    }

    /**
     * Full ticket total calculation.
     * @param {Object} params
     * @param {Array} params.items - Line items
     * @param {{type: string, value: number}|null} params.discount
     * @param {number} params.taxRate - Tax rate percentage
     * @param {number} [params.deliveryFee=0]
     * @param {number} [params.tip=0]
     * @returns {{subtotal: number, discount: number, afterDiscount: number, tax: number, deliveryFee: number, tip: number, total: number, grandTotal: number}}
     */
    function ticketTotal(params) {
        const sub = subtotal(params.items);
        const disc = discountAmount(sub, params.discount);
        const afterDisc = round(sub - disc);
        const taxAmt = tax(afterDisc, params.taxRate);
        const delFee = params.deliveryFee || 0;
        const tipAmt = params.tip || 0;
        const total = round(afterDisc + taxAmt + delFee);
        const grandTotal = round(total + tipAmt);

        return {
            subtotal: round(sub),
            discount: round(disc),
            afterDiscount: afterDisc,
            tax: taxAmt,
            deliveryFee: delFee,
            tip: tipAmt,
            total: total,
            grandTotal: grandTotal
        };
    }

    /**
     * Calculate cash discount / card surcharge dual pricing.
     * Supports optional maxSurcharge cap (e.g., max 3% or max dollar amount).
     * @param {number} total - Base total
     * @param {{enabled: boolean, mode: string, rate: number, maxSurcharge?: number}} config
     * @returns {{cashPrice: number, cardPrice: number, savings: number, capped: boolean}}
     */
    function dualPricing(total, config) {
        if (!config || !config.enabled) {
            return { cashPrice: total, cardPrice: total, savings: 0, capped: false };
        }

        const rate = (parseFloat(config.rate) || 0) / 100;
        const maxSurcharge = config.maxSurcharge !== undefined && config.maxSurcharge !== null
            ? parseFloat(config.maxSurcharge) : null;

        if (config.mode === 'CASH_DISCOUNT') {
            let savings = round(total * rate);
            let capped = false;
            if (maxSurcharge !== null && savings > maxSurcharge) {
                savings = round(maxSurcharge);
                capped = true;
            }
            const cashPrice = round(total - savings);
            return { cashPrice, cardPrice: total, savings, capped };
        } else {
            let surcharge = round(total * rate);
            let capped = false;
            if (maxSurcharge !== null && surcharge > maxSurcharge) {
                surcharge = round(maxSurcharge);
                capped = true;
            }
            const cardPrice = round(total + surcharge);
            return { cashPrice: total, cardPrice, savings: surcharge, capped };
        }
    }

    /**
     * Calculate auto-gratuity.
     * @param {number} subtotalAmt
     * @param {number} partySize
     * @param {{enabled: boolean, minPartySize: number, percentage: number}} config
     * @returns {number} Gratuity amount, or 0 if not applicable
     */
    function autoGratuity(subtotalAmt, partySize, config) {
        if (!config || !config.enabled) return 0;
        if (partySize < config.minPartySize) return 0;
        return round(subtotalAmt * (config.percentage / 100));
    }

    /**
     * Calculate loyalty points earned.
     * @param {number} amount - Dollar amount spent
     * @param {number} pointsPerDollar
     * @param {number} [multiplier=1]
     * @returns {number}
     */
    function loyaltyPointsEarned(amount, pointsPerDollar, multiplier) {
        return Math.floor(amount * (pointsPerDollar || 1) * (multiplier || 1));
    }

    /**
     * Calculate loyalty redemption value.
     * @param {number} points - Current points balance
     * @param {number} redeemThreshold - Points needed per redemption
     * @param {number} redeemValue - Dollar value per redemption
     * @returns {{redeemSets: number, dollarValue: number, pointsUsed: number}}
     */
    function loyaltyRedemption(points, redeemThreshold, redeemValue) {
        if (points < redeemThreshold) return { redeemSets: 0, dollarValue: 0, pointsUsed: 0 };
        const sets = Math.floor(points / redeemThreshold);
        return {
            redeemSets: sets,
            dollarValue: round(sets * redeemValue),
            pointsUsed: sets * redeemThreshold
        };
    }

    /**
     * Calculate gift card balance after transaction.
     * @param {number} currentBalance
     * @param {number} transactionAmount - Positive = charge, negative = reload
     * @returns {{newBalance: number, approved: boolean, chargedAmount: number}}
     */
    function giftCardTransaction(currentBalance, transactionAmount) {
        if (transactionAmount <= 0) {
            // Reload
            return { newBalance: round(currentBalance + Math.abs(transactionAmount)), approved: true, chargedAmount: 0 };
        }
        if (currentBalance <= 0) {
            return { newBalance: 0, approved: false, chargedAmount: 0 };
        }
        const charged = Math.min(currentBalance, transactionAmount);
        return { newBalance: round(currentBalance - charged), approved: true, chargedAmount: round(charged) };
    }

    /**
     * Calculate inventory deduction for an order.
     * @param {Array<{id: number, qty: number}>} items
     * @param {Object} inventory - Map of itemId -> {stock: number, lowThreshold: number}
     * @returns {{deductions: Array, lowStockWarnings: Array, outOfStock: Array}}
     */
    function inventoryDeduction(items, inventory) {
        const deductions = [];
        const lowStockWarnings = [];
        const outOfStock = [];

        items.forEach(item => {
            const stock = inventory[item.id];
            if (!stock) return;

            const newQty = stock.stock - item.qty;
            deductions.push({ id: item.id, oldQty: stock.stock, newQty: Math.max(0, newQty), deducted: item.qty });

            if (newQty <= 0) {
                outOfStock.push(item.id);
            } else if (newQty <= stock.lowThreshold) {
                lowStockWarnings.push({ id: item.id, remaining: newQty });
            }
        });

        return { deductions, lowStockWarnings, outOfStock };
    }

    /**
     * Calculate split check amounts.
     * @param {number} total
     * @param {number} ways - Number of ways to split
     * @returns {Array<number>} Array of amounts (last one absorbs rounding)
     */
    function splitCheck(total, ways) {
        if (ways <= 0 || !total) return [total || 0];
        if (ways === 1) return [total];

        const perPerson = Math.floor(total / ways * 100) / 100;
        const amounts = Array(ways - 1).fill(perPerson);
        const remainder = round(total - perPerson * (ways - 1));
        amounts.push(remainder);
        return amounts;
    }

    /**
     * Calculate labor cost for a time clock entry.
     * @param {string} clockIn - ISO timestamp
     * @param {string|null} clockOut - ISO timestamp or null (still clocked in)
     * @param {number} hourlyRate
     * @param {number} [breakMinutes=0]
     * @returns {{hoursWorked: number, netHours: number, laborCost: number}}
     */
    function laborCost(clockIn, clockOut, hourlyRate, breakMinutes) {
        const start = new Date(clockIn);
        const end = clockOut ? new Date(clockOut) : new Date();
        const totalMs = end - start;
        const totalHours = totalMs / 3600000;
        const breakHours = (breakMinutes || 0) / 60;
        const netHours = Math.max(0, totalHours - breakHours);

        return {
            hoursWorked: round(totalHours),
            netHours: round(netHours),
            laborCost: round(netHours * hourlyRate)
        };
    }

    /**
     * Round to 2 decimal places (for currency).
     */
    function round(n) {
        return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    /**
     * Format as currency string.
     * @param {number} amount
     * @returns {string}
     */
    function formatCurrency(amount) {
        return '$' + (parseFloat(amount) || 0).toFixed(2);
    }

    return {
        subtotal,
        discountAmount,
        tax,
        deliveryFee,
        ticketTotal,
        dualPricing,
        autoGratuity,
        loyaltyPointsEarned,
        loyaltyRedemption,
        giftCardTransaction,
        inventoryDeduction,
        splitCheck,
        laborCost,
        round,
        formatCurrency
    };
})();

// CommonJS export for Node.js test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Calculations;
}
