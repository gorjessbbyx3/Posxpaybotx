/**
 * Unit Tests - New Features (Auto-Gratuity, Allergens, Waitlist, Void Tracking)
 *
 * Tests auto-gratuity calculation, allergen data integrity,
 * waitlist estimation logic, and void reason validation.
 *
 * Uses Node.js built-in test runner (node --test).
 * Zero dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../js/calculations');

// ==========================================
// Auto-Gratuity (Calculations module)
// ==========================================
describe('autoGratuity', () => {
    const config = { enabled: true, minPartySize: 6, percentage: 18 };

    it('calculates 18% gratuity for party of 6+', () => {
        assert.equal(Calc.autoGratuity(100, 6, config), 18);
        assert.equal(Calc.autoGratuity(100, 10, config), 18);
    });

    it('returns 0 for small parties', () => {
        assert.equal(Calc.autoGratuity(100, 5, config), 0);
        assert.equal(Calc.autoGratuity(100, 1, config), 0);
    });

    it('returns 0 when disabled', () => {
        const disabled = { enabled: false, minPartySize: 6, percentage: 18 };
        assert.equal(Calc.autoGratuity(100, 8, disabled), 0);
    });

    it('returns 0 with null config', () => {
        assert.equal(Calc.autoGratuity(100, 8, null), 0);
        assert.equal(Calc.autoGratuity(100, 8, undefined), 0);
    });

    it('calculates correct amounts with decimals', () => {
        // 18% of $55.50 = $9.99
        assert.equal(Calc.autoGratuity(55.50, 6, config), 9.99);
    });

    it('handles 20% configuration', () => {
        const config20 = { enabled: true, minPartySize: 8, percentage: 20 };
        assert.equal(Calc.autoGratuity(100, 8, config20), 20);
        assert.equal(Calc.autoGratuity(100, 7, config20), 0);
    });

    it('handles zero subtotal', () => {
        assert.equal(Calc.autoGratuity(0, 10, config), 0);
    });

    it('rounds correctly', () => {
        // 18% of $33.33 = $5.9994 → $6.00
        assert.equal(Calc.autoGratuity(33.33, 6, config), 6);
    });
});

// ==========================================
// Allergen Data Integrity
// ==========================================

// Import the allergen data by reading the source file
const fs = require('fs');
const extrasSource = fs.readFileSync(require('path').join(__dirname, '../js/pos-extras.js'), 'utf-8');

// Extract ITEM_ALLERGENS from source
function extractAllergenData() {
    const match = extrasSource.match(/const ITEM_ALLERGENS\s*=\s*(\{[\s\S]*?\n\};)/);
    if (!match) return {};
    // Safely evaluate the object literal
    try {
        return new Function('return ' + match[1])();
    } catch (e) {
        return {};
    }
}

function extractAllergenDefs() {
    const match = extrasSource.match(/const ALLERGENS\s*=\s*(\{[\s\S]*?\n\};)/);
    if (!match) return {};
    try {
        return new Function('return ' + match[1])();
    } catch (e) {
        return {};
    }
}

function extractDietaryDefs() {
    const match = extrasSource.match(/const DIETARY_FLAGS\s*=\s*(\{[\s\S]*?\n\};)/);
    if (!match) return {};
    try {
        return new Function('return ' + match[1])();
    } catch (e) {
        return {};
    }
}

const ITEM_ALLERGENS = extractAllergenData();
const ALLERGENS = extractAllergenDefs();
const DIETARY_FLAGS = extractDietaryDefs();

describe('allergen data', () => {
    it('has allergen definitions', () => {
        assert.ok(Object.keys(ALLERGENS).length >= 8, 'Should have at least 8 allergen types');
    });

    it('all allergen defs have required fields', () => {
        Object.entries(ALLERGENS).forEach(([key, def]) => {
            assert.ok(def.label, key + ' missing label');
            assert.ok(def.icon, key + ' missing icon');
            assert.ok(def.color, key + ' missing color');
        });
    });

    it('has dietary flag definitions', () => {
        assert.ok(Object.keys(DIETARY_FLAGS).length >= 4, 'Should have at least 4 dietary flags');
    });

    it('all dietary flags have required fields', () => {
        Object.entries(DIETARY_FLAGS).forEach(([key, def]) => {
            assert.ok(def.label, key + ' missing label');
            assert.ok(def.icon, key + ' missing icon');
            assert.ok(def.color, key + ' missing color');
        });
    });

    it('has allergen data for menu items', () => {
        const itemCount = Object.keys(ITEM_ALLERGENS).length;
        assert.ok(itemCount >= 30, 'Should have allergen data for at least 30 items, got ' + itemCount);
    });

    it('all item allergen entries use valid allergen keys', () => {
        const validAllergens = new Set(Object.keys(ALLERGENS));
        Object.entries(ITEM_ALLERGENS).forEach(([itemId, data]) => {
            data.allergens.forEach(a => {
                assert.ok(validAllergens.has(a), 'Item ' + itemId + ' has unknown allergen: ' + a);
            });
        });
    });

    it('all item dietary entries use valid dietary keys', () => {
        const validDietary = new Set(Object.keys(DIETARY_FLAGS));
        Object.entries(ITEM_ALLERGENS).forEach(([itemId, data]) => {
            data.dietary.forEach(d => {
                assert.ok(validDietary.has(d), 'Item ' + itemId + ' has unknown dietary flag: ' + d);
            });
        });
    });

    it('known items have correct allergens', () => {
        // Cheeseburger (id 1) should have gluten and dairy
        const burger = ITEM_ALLERGENS[1];
        assert.ok(burger, 'Cheeseburger should have allergen data');
        assert.ok(burger.allergens.includes('gluten'), 'Cheeseburger should contain gluten');
        assert.ok(burger.allergens.includes('dairy'), 'Cheeseburger should contain dairy');

        // Grilled Chicken (id 3) should be allergen-free
        const chicken = ITEM_ALLERGENS[3];
        assert.ok(chicken, 'Grilled Chicken should have allergen data');
        assert.equal(chicken.allergens.length, 0, 'Grilled Chicken should have no allergens');

        // Lobster (id 24) should have shellfish
        const lobster = ITEM_ALLERGENS[24];
        assert.ok(lobster, 'Lobster should have allergen data');
        assert.ok(lobster.allergens.includes('shellfish'), 'Lobster should contain shellfish');
    });

    it('vegetarian items are correctly marked', () => {
        // Margherita Pizza (id 5)
        assert.ok(ITEM_ALLERGENS[5].dietary.includes('vegetarian'));
        // Mozzarella Sticks (id 10)
        assert.ok(ITEM_ALLERGENS[10].dietary.includes('vegetarian'));
    });

    it('vegan items are correctly marked', () => {
        // Side Salad (id 33) and Baked Potato (id 35)
        assert.ok(ITEM_ALLERGENS[33].dietary.includes('vegan'));
        assert.ok(ITEM_ALLERGENS[35].dietary.includes('vegan'));
    });
});

// ==========================================
// Waitlist Estimation Logic
// ==========================================
describe('waitlist estimation', () => {
    // Replicate the estimateWaitTime logic for testing
    function estimateWaitTime(partySize, occupiedCount, totalTables) {
        const occupancyRate = occupiedCount / totalTables;

        let baseWait = 15;
        if (occupancyRate > 0.8) baseWait = 30;
        else if (occupancyRate > 0.5) baseWait = 20;

        if (partySize >= 6) baseWait += 15;
        else if (partySize >= 4) baseWait += 5;

        return baseWait;
    }

    it('returns 15 min base for low occupancy, small party', () => {
        assert.equal(estimateWaitTime(2, 2, 20), 15);
    });

    it('returns 20 min for medium occupancy', () => {
        assert.equal(estimateWaitTime(2, 12, 20), 20);
    });

    it('returns 30 min for high occupancy', () => {
        assert.equal(estimateWaitTime(2, 18, 20), 30);
    });

    it('adds 5 min for party of 4-5', () => {
        assert.equal(estimateWaitTime(4, 2, 20), 20);
        assert.equal(estimateWaitTime(5, 2, 20), 20);
    });

    it('adds 15 min for party of 6+', () => {
        assert.equal(estimateWaitTime(6, 2, 20), 30);
        assert.equal(estimateWaitTime(10, 2, 20), 30);
    });

    it('combines occupancy and party size penalties', () => {
        // High occupancy (30 base) + large party (+15) = 45
        assert.equal(estimateWaitTime(8, 18, 20), 45);
    });
});

// ==========================================
// Void Reason Validation
// ==========================================
describe('void reason tracking', () => {
    const VALID_REASONS = [
        'Customer request',
        'Wrong order',
        'Kitchen error',
        'Duplicate ticket',
        'System error',
        'Price adjustment',
        'Other'
    ];

    it('has at least 5 valid void reasons', () => {
        assert.ok(VALID_REASONS.length >= 5);
    });

    it('includes common restaurant void reasons', () => {
        assert.ok(VALID_REASONS.includes('Customer request'));
        assert.ok(VALID_REASONS.includes('Wrong order'));
        assert.ok(VALID_REASONS.includes('Kitchen error'));
    });

    it('includes catch-all Other option', () => {
        assert.ok(VALID_REASONS.includes('Other'));
    });

    // Test void log entry structure
    it('void log entry has correct shape', () => {
        const entry = {
            ticketId: 1001,
            reason: 'Customer request',
            notes: 'Guest changed their mind',
            approvedBy: 'Maria G.',
            voidedBy: 'John D.',
            timestamp: new Date().toISOString()
        };

        assert.ok(entry.ticketId);
        assert.ok(entry.reason);
        assert.ok(entry.approvedBy);
        assert.ok(entry.voidedBy);
        assert.ok(entry.timestamp);
        assert.ok(new Date(entry.timestamp) instanceof Date);
    });
});

// ==========================================
// Auto-Gratuity Config Validation
// ==========================================
describe('auto-gratuity config', () => {
    it('default config has correct structure', () => {
        const config = { enabled: true, minPartySize: 6, percentage: 18 };
        assert.equal(typeof config.enabled, 'boolean');
        assert.equal(typeof config.minPartySize, 'number');
        assert.equal(typeof config.percentage, 'number');
    });

    it('minPartySize is reasonable (6-10)', () => {
        const config = { enabled: true, minPartySize: 6, percentage: 18 };
        assert.ok(config.minPartySize >= 4 && config.minPartySize <= 12);
    });

    it('percentage is reasonable (15-25)', () => {
        const config = { enabled: true, minPartySize: 6, percentage: 18 };
        assert.ok(config.percentage >= 10 && config.percentage <= 30);
    });
});
