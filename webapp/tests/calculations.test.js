/**
 * Unit Tests - Business Logic Calculations
 *
 * Tests all pure calculation functions that handle
 * money, tax, discounts, tips, inventory, and labor.
 *
 * Uses Node.js built-in test runner (node --test).
 * Zero dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../js/calculations');

// ==========================================
// Subtotal
// ==========================================
describe('subtotal', () => {
    it('sums price * qty for all items', () => {
        const items = [
            { price: 12.99, qty: 2 },
            { price: 5.99, qty: 1 }
        ];
        assert.equal(Calc.subtotal(items), 31.97);
    });

    it('returns 0 for empty array', () => {
        assert.equal(Calc.subtotal([]), 0);
    });

    it('returns 0 for null/undefined', () => {
        assert.equal(Calc.subtotal(null), 0);
        assert.equal(Calc.subtotal(undefined), 0);
    });

    it('handles items with 0 qty', () => {
        assert.equal(Calc.subtotal([{ price: 10, qty: 0 }]), 0);
    });

    it('handles items with 0 price (water)', () => {
        assert.equal(Calc.subtotal([{ price: 0, qty: 3 }]), 0);
    });

    it('handles string prices and quantities', () => {
        const items = [{ price: '12.99', qty: '2' }];
        assert.equal(Calc.subtotal(items), 25.98);
    });
});

// ==========================================
// Discount
// ==========================================
describe('discountAmount', () => {
    it('calculates percentage discount', () => {
        assert.equal(Calc.discountAmount(100, { type: 'percent', value: 10 }), 10);
    });

    it('calculates dollar discount', () => {
        assert.equal(Calc.discountAmount(100, { type: 'dollar', value: 15 }), 15);
    });

    it('caps dollar discount at subtotal', () => {
        assert.equal(Calc.discountAmount(10, { type: 'dollar', value: 15 }), 10);
    });

    it('handles fixed amount field', () => {
        assert.equal(Calc.discountAmount(100, { amount: 7.50 }), 7.50);
    });

    it('returns 0 for null discount', () => {
        assert.equal(Calc.discountAmount(100, null), 0);
    });

    it('returns 0 for zero subtotal', () => {
        assert.equal(Calc.discountAmount(0, { type: 'percent', value: 10 }), 0);
    });
});

// ==========================================
// Tax
// ==========================================
describe('tax', () => {
    it('calculates standard tax rate', () => {
        const result = Calc.tax(100, 8.875);
        assert.equal(result, 8.88); // rounded
    });

    it('returns 0 for zero taxable amount', () => {
        assert.equal(Calc.tax(0, 8.875), 0);
    });

    it('returns 0 for zero tax rate', () => {
        assert.equal(Calc.tax(100, 0), 0);
    });

    it('returns 0 for negative taxable amount', () => {
        assert.equal(Calc.tax(-50, 8.875), 0);
    });

    it('handles fractional cents correctly', () => {
        // 33.33 * 8.875% = 2.9580375 -> should round to 2.96
        assert.equal(Calc.tax(33.33, 8.875), 2.96);
    });
});

// ==========================================
// Delivery Fee
// ==========================================
describe('deliveryFee', () => {
    const schedule = [
        { threshold: 0, fee: 5.99 },
        { threshold: 25, fee: 3.99 },
        { threshold: 50, fee: 0 }
    ];

    it('returns highest applicable fee tier', () => {
        assert.equal(Calc.deliveryFee(10, schedule), 5.99);
        assert.equal(Calc.deliveryFee(30, schedule), 3.99);
        assert.equal(Calc.deliveryFee(75, schedule), 0);
    });

    it('returns 0 for empty schedule', () => {
        assert.equal(Calc.deliveryFee(100, []), 0);
    });

    it('returns 0 for null schedule', () => {
        assert.equal(Calc.deliveryFee(100, null), 0);
    });
});

// ==========================================
// Full Ticket Total
// ==========================================
describe('ticketTotal', () => {
    it('calculates complete ticket with all components', () => {
        const result = Calc.ticketTotal({
            items: [
                { price: 12.99, qty: 1 },
                { price: 8.99, qty: 2 }
            ],
            discount: { type: 'percent', value: 10 },
            taxRate: 8.875,
            deliveryFee: 3.99,
            tip: 5.00
        });

        assert.equal(result.subtotal, 30.97);
        assert.equal(result.discount, 3.10);   // 10% of 30.97
        assert.equal(result.afterDiscount, 27.87);
        assert.equal(result.tax, 2.47);        // 8.875% of 27.87
        assert.equal(result.deliveryFee, 3.99);
        assert.equal(result.tip, 5.00);
        assert.equal(result.total, 34.33);     // 27.87 + 2.47 + 3.99
        assert.equal(result.grandTotal, 39.33); // 34.33 + 5.00
    });

    it('handles ticket with no discount', () => {
        const result = Calc.ticketTotal({
            items: [{ price: 10, qty: 1 }],
            discount: null,
            taxRate: 10
        });

        assert.equal(result.subtotal, 10);
        assert.equal(result.discount, 0);
        assert.equal(result.tax, 1);
        assert.equal(result.total, 11);
    });

    it('handles empty ticket', () => {
        const result = Calc.ticketTotal({
            items: [],
            discount: null,
            taxRate: 8.875
        });

        assert.equal(result.subtotal, 0);
        assert.equal(result.total, 0);
    });
});

// ==========================================
// Dual Pricing (Cash Discount / Card Surcharge)
// ==========================================
describe('dualPricing', () => {
    it('calculates cash discount mode', () => {
        const result = Calc.dualPricing(100, {
            enabled: true,
            mode: 'CASH_DISCOUNT',
            rate: 4.0
        });

        assert.equal(result.cashPrice, 96);
        assert.equal(result.cardPrice, 100);
        assert.equal(result.savings, 4);
    });

    it('calculates card surcharge mode', () => {
        const result = Calc.dualPricing(100, {
            enabled: true,
            mode: 'CARD_SURCHARGE',
            rate: 4.0
        });

        assert.equal(result.cashPrice, 100);
        assert.equal(result.cardPrice, 104);
        assert.equal(result.savings, 4);
    });

    it('returns same prices when disabled', () => {
        const result = Calc.dualPricing(100, { enabled: false });
        assert.equal(result.cashPrice, 100);
        assert.equal(result.cardPrice, 100);
        assert.equal(result.savings, 0);
    });

    it('returns same prices for null config', () => {
        const result = Calc.dualPricing(100, null);
        assert.equal(result.cashPrice, 100);
        assert.equal(result.cardPrice, 100);
    });

    it('applies surcharge cap in CASH_DISCOUNT mode', () => {
        const result = Calc.dualPricing(100, {
            enabled: true,
            mode: 'CASH_DISCOUNT',
            rate: 4.0,
            maxSurcharge: 3.00
        });

        assert.equal(result.savings, 3);
        assert.equal(result.cashPrice, 97);
        assert.equal(result.cardPrice, 100);
        assert.equal(result.capped, true);
    });

    it('applies surcharge cap in CARD_SURCHARGE mode', () => {
        const result = Calc.dualPricing(100, {
            enabled: true,
            mode: 'CARD_SURCHARGE',
            rate: 4.0,
            maxSurcharge: 2.50
        });

        assert.equal(result.savings, 2.50);
        assert.equal(result.cashPrice, 100);
        assert.equal(result.cardPrice, 102.50);
        assert.equal(result.capped, true);
    });

    it('does not cap when surcharge is below max', () => {
        const result = Calc.dualPricing(50, {
            enabled: true,
            mode: 'CARD_SURCHARGE',
            rate: 4.0,
            maxSurcharge: 10.00
        });

        assert.equal(result.savings, 2);
        assert.equal(result.cardPrice, 52);
        assert.equal(result.capped, false);
    });

    it('ignores cap when maxSurcharge is null', () => {
        const result = Calc.dualPricing(100, {
            enabled: true,
            mode: 'CASH_DISCOUNT',
            rate: 4.0,
            maxSurcharge: null
        });

        assert.equal(result.savings, 4);
        assert.equal(result.capped, false);
    });
});

// ==========================================
// Auto Gratuity
// ==========================================
describe('autoGratuity', () => {
    const config = { enabled: true, minPartySize: 6, percentage: 18 };

    it('applies gratuity for large party', () => {
        assert.equal(Calc.autoGratuity(100, 8, config), 18);
    });

    it('applies at exact threshold', () => {
        assert.equal(Calc.autoGratuity(100, 6, config), 18);
    });

    it('does not apply below threshold', () => {
        assert.equal(Calc.autoGratuity(100, 4, config), 0);
    });

    it('returns 0 when disabled', () => {
        assert.equal(Calc.autoGratuity(100, 8, { enabled: false, minPartySize: 6, percentage: 18 }), 0);
    });

    it('handles fractional amounts correctly', () => {
        // 78.50 * 18% = 14.13
        assert.equal(Calc.autoGratuity(78.50, 6, config), 14.13);
    });
});

// ==========================================
// Loyalty Points
// ==========================================
describe('loyaltyPointsEarned', () => {
    it('calculates standard points', () => {
        assert.equal(Calc.loyaltyPointsEarned(50, 1), 50);
    });

    it('applies multiplier', () => {
        assert.equal(Calc.loyaltyPointsEarned(50, 1, 1.5), 75);
    });

    it('floors fractional points', () => {
        assert.equal(Calc.loyaltyPointsEarned(33.33, 1, 1), 33);
    });

    it('handles 2x multiplier for birthday', () => {
        assert.equal(Calc.loyaltyPointsEarned(25, 1, 2), 50);
    });
});

describe('loyaltyRedemption', () => {
    it('calculates single redemption', () => {
        const result = Calc.loyaltyRedemption(150, 100, 5);
        assert.equal(result.redeemSets, 1);
        assert.equal(result.dollarValue, 5);
        assert.equal(result.pointsUsed, 100);
    });

    it('calculates multiple redemptions', () => {
        const result = Calc.loyaltyRedemption(350, 100, 5);
        assert.equal(result.redeemSets, 3);
        assert.equal(result.dollarValue, 15);
        assert.equal(result.pointsUsed, 300);
    });

    it('returns 0 when below threshold', () => {
        const result = Calc.loyaltyRedemption(50, 100, 5);
        assert.equal(result.redeemSets, 0);
        assert.equal(result.dollarValue, 0);
    });
});

// ==========================================
// Gift Card
// ==========================================
describe('giftCardTransaction', () => {
    it('charges against balance', () => {
        const result = Calc.giftCardTransaction(50, 30);
        assert.equal(result.newBalance, 20);
        assert.equal(result.approved, true);
        assert.equal(result.chargedAmount, 30);
    });

    it('partially charges when balance insufficient', () => {
        const result = Calc.giftCardTransaction(20, 50);
        assert.equal(result.newBalance, 0);
        assert.equal(result.approved, true);
        assert.equal(result.chargedAmount, 20);
    });

    it('rejects when balance is 0', () => {
        const result = Calc.giftCardTransaction(0, 30);
        assert.equal(result.approved, false);
        assert.equal(result.chargedAmount, 0);
    });

    it('handles reload (negative amount)', () => {
        const result = Calc.giftCardTransaction(20, -50);
        assert.equal(result.newBalance, 70);
        assert.equal(result.approved, true);
    });
});

// ==========================================
// Inventory Deduction
// ==========================================
describe('inventoryDeduction', () => {
    const inventory = {
        1: { stock: 10, lowThreshold: 3 },
        2: { stock: 2, lowThreshold: 5 },
        3: { stock: 1, lowThreshold: 1 }
    };

    it('deducts correctly', () => {
        const result = Calc.inventoryDeduction(
            [{ id: 1, qty: 2 }],
            inventory
        );
        assert.equal(result.deductions[0].newQty, 8);
        assert.equal(result.lowStockWarnings.length, 0);
        assert.equal(result.outOfStock.length, 0);
    });

    it('flags low stock warnings', () => {
        const result = Calc.inventoryDeduction(
            [{ id: 2, qty: 1 }],
            inventory
        );
        assert.equal(result.lowStockWarnings.length, 1);
        assert.equal(result.lowStockWarnings[0].remaining, 1);
    });

    it('flags out of stock', () => {
        const result = Calc.inventoryDeduction(
            [{ id: 3, qty: 2 }],
            inventory
        );
        assert.equal(result.outOfStock.length, 1);
        assert.equal(result.outOfStock[0], 3);
    });

    it('skips items not in inventory', () => {
        const result = Calc.inventoryDeduction(
            [{ id: 999, qty: 1 }],
            inventory
        );
        assert.equal(result.deductions.length, 0);
    });
});

// ==========================================
// Split Check
// ==========================================
describe('splitCheck', () => {
    it('splits evenly', () => {
        const result = Calc.splitCheck(100, 4);
        assert.equal(result.length, 4);
        assert.equal(result.reduce((s, a) => s + a, 0), 100);
    });

    it('handles uneven split (rounding)', () => {
        const result = Calc.splitCheck(100, 3);
        assert.equal(result.length, 3);
        // 33.33 + 33.33 + 33.34 = 100
        assert.equal(result[0], 33.33);
        assert.equal(result[1], 33.33);
        assert.equal(result[2], 33.34);
    });

    it('returns single amount for ways=1', () => {
        const result = Calc.splitCheck(50, 1);
        assert.deepEqual(result, [50]);
    });

    it('handles 0 ways', () => {
        const result = Calc.splitCheck(50, 0);
        assert.deepEqual(result, [50]);
    });

    it('preserves total across all splits', () => {
        const total = 78.53;
        for (let ways = 2; ways <= 10; ways++) {
            const result = Calc.splitCheck(total, ways);
            const sum = Calc.round(result.reduce((s, a) => s + a, 0));
            assert.equal(sum, total, `Split ${ways} ways should sum to ${total}, got ${sum}`);
        }
    });
});

// ==========================================
// Labor Cost
// ==========================================
describe('laborCost', () => {
    it('calculates hours and cost', () => {
        const clockIn = '2026-02-19T09:00:00.000Z';
        const clockOut = '2026-02-19T17:00:00.000Z'; // 8 hours
        const result = Calc.laborCost(clockIn, clockOut, 15);

        assert.equal(result.hoursWorked, 8);
        assert.equal(result.netHours, 8);
        assert.equal(result.laborCost, 120);
    });

    it('deducts break time', () => {
        const clockIn = '2026-02-19T09:00:00.000Z';
        const clockOut = '2026-02-19T17:00:00.000Z';
        const result = Calc.laborCost(clockIn, clockOut, 15, 30);

        assert.equal(result.hoursWorked, 8);
        assert.equal(result.netHours, 7.5);
        assert.equal(result.laborCost, 112.5);
    });

    it('handles null clockOut (still working)', () => {
        const clockIn = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
        const result = Calc.laborCost(clockIn, null, 12);

        assert(result.hoursWorked >= 0.99 && result.hoursWorked <= 1.01);
    });
});

// ==========================================
// Currency Formatting
// ==========================================
describe('formatCurrency', () => {
    it('formats positive amounts', () => {
        assert.equal(Calc.formatCurrency(12.5), '$12.50');
    });

    it('formats zero', () => {
        assert.equal(Calc.formatCurrency(0), '$0.00');
    });

    it('handles string input', () => {
        assert.equal(Calc.formatCurrency('8.9'), '$8.90');
    });

    it('handles NaN', () => {
        assert.equal(Calc.formatCurrency(NaN), '$0.00');
    });
});

// ==========================================
// Rounding
// ==========================================
describe('round', () => {
    it('rounds to 2 decimal places', () => {
        assert.equal(Calc.round(1.005), 1.01);
        assert.equal(Calc.round(1.004), 1);
        assert.equal(Calc.round(2.345), 2.35);
    });

    it('handles negative numbers', () => {
        assert.equal(Calc.round(-1.005), -1);
    });

    it('avoids floating-point penny errors', () => {
        // 0.1 + 0.2 = 0.30000000000000004 in JS
        assert.equal(Calc.round(0.1 + 0.2), 0.30);
        // Typical POS calculation: $12.99 * 8.875% tax
        assert.equal(Calc.round(12.99 * 0.08875), 1.15);
    });

    it('preserves exact values', () => {
        assert.equal(Calc.round(10.00), 10);
        assert.equal(Calc.round(0), 0);
    });
});

// ==========================================
// Critical Payment Path: Discount + Tax + Delivery
// ==========================================
describe('ticketTotal (discount + tax + delivery)', () => {
    it('calculates total with percentage discount applied before tax', () => {
        const result = Calc.ticketTotal({
            items: [{ price: 50, qty: 2 }],
            discount: { type: 'percent', value: 10 },
            taxRate: 8.875,
            deliveryFee: 0
        });
        // $100 - 10% = $90, tax on $90 = $7.99, total = $97.99
        assert.equal(result.afterDiscount, 90);
        assert.equal(result.tax, 7.99);
        assert.equal(result.total, 97.99);
    });

    it('calculates total with fixed discount', () => {
        const result = Calc.ticketTotal({
            items: [{ price: 25, qty: 2 }],
            discount: { type: 'fixed', value: 5 },
            taxRate: 8.875,
            deliveryFee: 0
        });
        // $50 - $5 = $45, tax on $45 = $3.99, total = $48.99
        assert.equal(result.afterDiscount, 45);
        assert.equal(result.tax, 3.99);
        assert.equal(result.total, 48.99);
    });

    it('includes delivery fee in total', () => {
        const result = Calc.ticketTotal({
            items: [{ price: 15, qty: 2 }],
            discount: null,
            taxRate: 8.875,
            deliveryFee: 5.99
        });
        // $30 + $2.66 tax + $5.99 delivery = $38.65
        assert.equal(result.afterDiscount, 30);
        assert.equal(result.tax, 2.66);
        assert.equal(result.total, 38.65);
    });

    it('discount cannot go below zero', () => {
        const result = Calc.ticketTotal({
            items: [{ price: 10, qty: 1 }],
            discount: { type: 'fixed', value: 15 },
            taxRate: 8.875,
            deliveryFee: 0
        });
        assert.equal(result.afterDiscount, 0);
        assert.equal(result.tax, 0);
        assert.equal(result.total, 0);
    });

    it('avoids penny discrepancy on discount + tax combo', () => {
        const result = Calc.ticketTotal({
            items: [{ price: 12.99, qty: 1 }],
            discount: { type: 'percent', value: 25 },
            taxRate: 8.875,
            deliveryFee: 0
        });
        // $12.99 * 0.75 = $9.74 (rounded), tax = $0.86, total = $10.60
        assert.equal(result.afterDiscount, 9.74);
        assert.equal(result.tax, 0.86);
        assert.equal(result.total, 10.60);
    });

    it('discount applied before tax, not after', () => {
        const withDiscount = Calc.ticketTotal({
            items: [{ price: 100, qty: 1 }],
            discount: { type: 'fixed', value: 50 },
            taxRate: 10,
            deliveryFee: 0
        });
        const withoutDiscount = Calc.ticketTotal({
            items: [{ price: 100, qty: 1 }],
            discount: null,
            taxRate: 10,
            deliveryFee: 0
        });
        // With discount: tax on $50 = $5, total = $55
        assert.equal(withDiscount.tax, 5);
        assert.equal(withDiscount.total, 55);
        // Without discount: tax on $100 = $10, total = $110
        assert.equal(withoutDiscount.tax, 10);
        assert.equal(withoutDiscount.total, 110);
    });
});

// ==========================================
// Auto-Gratuity Calculation
// ==========================================
describe('autoGratuity', () => {
    const config = { enabled: true, minPartySize: 6, percentage: 18 };

    it('applies 18% for party of 6+', () => {
        assert.equal(Calc.autoGratuity(100, 6, config), 18);
    });

    it('returns 0 for small party', () => {
        assert.equal(Calc.autoGratuity(100, 5, config), 0);
    });

    it('returns 0 when disabled', () => {
        assert.equal(Calc.autoGratuity(100, 8, { ...config, enabled: false }), 0);
    });

    it('calculates on post-discount amount correctly', () => {
        // $80 after discount, 18% = $14.40
        assert.equal(Calc.autoGratuity(80, 6, config), 14.40);
    });
});
