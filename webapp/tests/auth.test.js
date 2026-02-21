/**
 * Unit Tests - Authentication & Authorization
 *
 * Tests JWT token creation/verification, PIN-based login,
 * and role-based permission checks for all 13 roles.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createToken, verifyToken, hashPin, EMPLOYEES, ROLE_PERMISSIONS, ROLES } = require('../api/auth');

// ==========================================
// Token Creation & Verification
// ==========================================
describe('createToken', () => {
    it('creates a valid token string', () => {
        const token = createToken({ id: 'M001', name: 'Maria', role: 'general_manager' });
        assert.ok(token);
        assert.equal(typeof token, 'string');
        assert.equal(token.split('.').length, 3);
    });

    it('creates different tokens for different payloads', () => {
        const t1 = createToken({ id: 'M001', name: 'Maria', role: 'general_manager' });
        const t2 = createToken({ id: 'S001', name: 'John', role: 'server' });
        assert.notEqual(t1, t2);
    });
});

describe('verifyToken', () => {
    it('verifies a valid token', () => {
        const token = createToken({ id: 'M001', name: 'Maria', role: 'general_manager' });
        const payload = verifyToken(token);
        assert.ok(payload);
        assert.equal(payload.id, 'M001');
        assert.equal(payload.name, 'Maria');
        assert.equal(payload.role, 'general_manager');
    });

    it('includes iat and exp fields', () => {
        const token = createToken({ id: 'test' });
        const payload = verifyToken(token);
        assert.ok(payload.iat);
        assert.ok(payload.exp);
        assert.ok(payload.exp > payload.iat);
    });

    it('rejects tampered token', () => {
        const token = createToken({ id: 'M001', name: 'Maria', role: 'general_manager' });
        const parts = token.split('.');
        const tampered = parts[0] + '.' + Buffer.from(JSON.stringify({ id: 'hacker', role: 'owner' })).toString('base64url') + '.' + parts[2];
        assert.equal(verifyToken(tampered), null);
    });

    it('rejects null token', () => {
        assert.equal(verifyToken(null), null);
    });

    it('rejects empty string', () => {
        assert.equal(verifyToken(''), null);
    });

    it('rejects malformed token', () => {
        assert.equal(verifyToken('not.a.valid.token'), null);
        assert.equal(verifyToken('abc'), null);
    });
});

// ==========================================
// Employee Database
// ==========================================
describe('EMPLOYEES', () => {
    it('has all expected employees via hashed PINs', () => {
        assert.ok(EMPLOYEES[hashPin('1234')]); // general_manager (Maria)
        assert.ok(EMPLOYEES[hashPin('1111')]); // server (John)
        assert.ok(EMPLOYEES[hashPin('6533')]); // owner (Admin)
    });

    it('keys are hashed (no plaintext PINs)', () => {
        Object.keys(EMPLOYEES).forEach(key => {
            assert.ok(key.startsWith('ph_'), `Key ${key} should be a PIN hash`);
        });
    });

    it('each employee has required fields', () => {
        Object.values(EMPLOYEES).forEach(emp => {
            assert.ok(emp.id, 'Employee missing id');
            assert.ok(emp.name, 'Employee missing name');
            assert.ok(emp.role, 'Employee missing role');
        });
    });

    it('all roles have corresponding permissions', () => {
        const roles = new Set(Object.values(EMPLOYEES).map(e => e.role));
        roles.forEach(role => {
            assert.ok(ROLE_PERMISSIONS[role], `No permissions defined for role: ${role}`);
        });
    });

    it('includes new roles via PINs (host, kitchen_manager, bookkeeper, assistant_manager)', () => {
        assert.ok(EMPLOYEES[hashPin('7777')]); // assistant_manager (David)
        assert.ok(EMPLOYEES[hashPin('8888')]); // host (Emma)
        assert.ok(EMPLOYEES[hashPin('9999')]); // kitchen_manager (Rosa)
        assert.ok(EMPLOYEES[hashPin('2468')]); // bookkeeper (Frank)
        const roles = new Set(Object.values(EMPLOYEES).map(e => e.role));
        assert.ok(roles.has('host'));
        assert.ok(roles.has('kitchen_manager'));
        assert.ok(roles.has('bookkeeper'));
        assert.ok(roles.has('assistant_manager'));
    });
});

// ==========================================
// Role Metadata
// ==========================================
describe('ROLES', () => {
    it('has metadata for all 13 roles', () => {
        const expectedRoles = [
            'owner', 'general_manager', 'assistant_manager',
            'server', 'bartender', 'host', 'cashier',
            'kitchen', 'kitchen_manager',
            'bookkeeper', 'payroll_admin', 'inventory_admin', 'online_ordering_admin'
        ];
        expectedRoles.forEach(role => {
            assert.ok(ROLES[role], `Missing ROLES metadata for: ${role}`);
            assert.ok(ROLES[role].label, `Missing label for: ${role}`);
            assert.ok(ROLES[role].category, `Missing category for: ${role}`);
        });
    });

    it('every role with metadata has permissions defined', () => {
        Object.keys(ROLES).forEach(role => {
            assert.ok(ROLE_PERMISSIONS[role], `Role ${role} in ROLES but not in ROLE_PERMISSIONS`);
        });
    });
});

// ==========================================
// Role Permissions
// ==========================================
describe('ROLE_PERMISSIONS', () => {
    // ── Owner / Admin ──
    it('owner has all permissions', () => {
        const perms = ROLE_PERMISSIONS['owner'];
        Object.values(perms).forEach(v => assert.equal(v, true));
    });

    it('admin (backward compat) has all permissions', () => {
        const perms = ROLE_PERMISSIONS['admin'];
        Object.values(perms).forEach(v => assert.equal(v, true));
    });

    // ── General Manager ──
    it('general_manager has almost all permissions', () => {
        const perms = ROLE_PERMISSIONS['general_manager'];
        assert.equal(perms.tickets, true);
        assert.equal(perms.void, true);
        assert.equal(perms.refund, true);
        assert.equal(perms.config, true);
        assert.equal(perms.reports, true);
        assert.equal(perms.menu, true);
        assert.equal(perms.employees, true);
    });

    it('general_manager cannot change payment config or security', () => {
        const perms = ROLE_PERMISSIONS['general_manager'];
        assert.equal(perms.payment_config, false);
        assert.equal(perms.security, false);
    });

    it('manager (backward compat) matches general_manager', () => {
        const gm = ROLE_PERMISSIONS['general_manager'];
        const m = ROLE_PERMISSIONS['manager'];
        Object.keys(gm).forEach(k => {
            assert.equal(m[k], gm[k], `manager.${k} should match general_manager.${k}`);
        });
    });

    // ── Assistant Manager ──
    it('assistant_manager can void, refund, and manage operations', () => {
        const perms = ROLE_PERMISSIONS['assistant_manager'];
        assert.equal(perms.tickets, true);
        assert.equal(perms.void, true);
        assert.equal(perms.refund, true);
        assert.equal(perms.comp, true);
        assert.equal(perms.cash_drawer, true);
        assert.equal(perms.close_day, true);
        assert.equal(perms.tables, true);
        assert.equal(perms.menu, true);
        assert.equal(perms.kitchen, true);
        assert.equal(perms.reports, true);
    });

    it('assistant_manager has no system-level access', () => {
        const perms = ROLE_PERMISSIONS['assistant_manager'];
        assert.equal(perms.config, false);
        assert.equal(perms.payment_config, false);
        assert.equal(perms.security, false);
        assert.equal(perms.hardware, false);
        assert.equal(perms.locations, false);
        assert.equal(perms.employees, false);
        assert.equal(perms.export, false);
        assert.equal(perms.backups, false);
    });

    // ── Server ──
    it('server cannot void or refund', () => {
        const perms = ROLE_PERMISSIONS['server'];
        assert.equal(perms.void, false);
        assert.equal(perms.refund, false);
    });

    it('server can create tickets and manage tables', () => {
        const perms = ROLE_PERMISSIONS['server'];
        assert.equal(perms.tickets, true);
        assert.equal(perms.tables, true);
        assert.equal(perms.discounts, true);
    });

    it('server has no reporting, config, or kitchen access', () => {
        const perms = ROLE_PERMISSIONS['server'];
        assert.equal(perms.reports, false);
        assert.equal(perms.config, false);
        assert.equal(perms.kitchen, false);
    });

    // ── Bartender ──
    it('bartender has server permissions plus cash drawer', () => {
        const perms = ROLE_PERMISSIONS['bartender'];
        assert.equal(perms.tickets, true);
        assert.equal(perms.tables, true);
        assert.equal(perms.discounts, true);
        assert.equal(perms.cash_drawer, true);
        assert.equal(perms.void, false);
        assert.equal(perms.refund, false);
    });

    // ── Host ──
    it('host can only manage tables and waitlist', () => {
        const perms = ROLE_PERMISSIONS['host'];
        assert.equal(perms.tables, true);
        assert.equal(perms.waitlist, true);
        assert.equal(perms.timeclock, true);
        assert.equal(perms.tickets, false);
        assert.equal(perms.void, false);
        assert.equal(perms.reports, false);
        assert.equal(perms.config, false);
    });

    // ── Cashier ──
    it('cashier can process tickets and manage cash drawer', () => {
        const perms = ROLE_PERMISSIONS['cashier'];
        assert.equal(perms.tickets, true);
        assert.equal(perms.cash_drawer, true);
        assert.equal(perms.discounts, true);
        assert.equal(perms.reports, false);
        assert.equal(perms.config, false);
    });

    // ── Kitchen (Line Cook) ──
    it('kitchen can only access kitchen display', () => {
        const perms = ROLE_PERMISSIONS['kitchen'];
        assert.equal(perms.kitchen, true);
        assert.equal(perms.timeclock, true);
        assert.equal(perms.tickets, false);
        assert.equal(perms.void, false);
        assert.equal(perms.refund, false);
        assert.equal(perms.config, false);
        assert.equal(perms.reports, false);
    });

    // ── Kitchen Manager ──
    it('kitchen_manager has kitchen + inventory access', () => {
        const perms = ROLE_PERMISSIONS['kitchen_manager'];
        assert.equal(perms.kitchen, true);
        assert.equal(perms.inventory, true);
        assert.equal(perms.vendors, true);
        assert.equal(perms.recipes, true);
        assert.equal(perms.purchase_orders, true);
        assert.equal(perms.waste_log, true);
        assert.equal(perms.reports, true);
    });

    it('kitchen_manager has no POS financial access', () => {
        const perms = ROLE_PERMISSIONS['kitchen_manager'];
        assert.equal(perms.tickets, false);
        assert.equal(perms.void, false);
        assert.equal(perms.refund, false);
        assert.equal(perms.config, false);
    });

    // ── Bookkeeper ──
    it('bookkeeper can view reports and export data', () => {
        const perms = ROLE_PERMISSIONS['bookkeeper'];
        assert.equal(perms.reports, true);
        assert.equal(perms.export, true);
        assert.equal(perms.audit, true);
    });

    it('bookkeeper cannot operate POS or void/comp', () => {
        const perms = ROLE_PERMISSIONS['bookkeeper'];
        assert.equal(perms.tickets, false);
        assert.equal(perms.void, false);
        assert.equal(perms.comp, false);
        assert.equal(perms.config, false);
    });

    // ── Payroll Admin ──
    it('payroll_admin can manage employees and payroll', () => {
        const perms = ROLE_PERMISSIONS['payroll_admin'];
        assert.equal(perms.employees, true);
        assert.equal(perms.payroll, true);
        assert.equal(perms.reports, true);
        assert.equal(perms.export, true);
    });

    // ── Inventory Admin ──
    it('inventory_admin can manage full inventory pipeline', () => {
        const perms = ROLE_PERMISSIONS['inventory_admin'];
        assert.equal(perms.inventory, true);
        assert.equal(perms.vendors, true);
        assert.equal(perms.recipes, true);
        assert.equal(perms.purchase_orders, true);
        assert.equal(perms.waste_log, true);
        assert.equal(perms.reports, true);
    });

    // ── Online Ordering Admin ──
    it('online_ordering_admin can manage menus and integrations', () => {
        const perms = ROLE_PERMISSIONS['online_ordering_admin'];
        assert.equal(perms.menu, true);
        assert.equal(perms.online_orders, true);
        assert.equal(perms.integrations, true);
        assert.equal(perms.tickets, false);
        assert.equal(perms.config, false);
    });

    // ── Cross-cutting checks ──
    it('all roles can access timeclock', () => {
        Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
            // bookkeeper is the only exception — no timeclock (read-only role)
            if (role === 'bookkeeper') return;
            assert.equal(perms.timeclock, true, `${role} should have timeclock access`);
        });
    });

    it('every role has all 31 permission keys defined', () => {
        const expectedKeys = [
            'tickets', 'void', 'refund', 'comp', 'discounts', 'cash_drawer', 'close_day',
            'reports', 'export', 'audit', 'fraud',
            'menu', 'tables', 'waitlist', 'kitchen', 'online_orders',
            'config', 'payment_config', 'security', 'hardware', 'locations', 'integrations',
            'employees', 'payroll', 'timeclock',
            'inventory', 'vendors', 'recipes', 'purchase_orders', 'waste_log',
            'backups'
        ];
        Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
            expectedKeys.forEach(key => {
                assert.ok(typeof perms[key] === 'boolean', `${role}.${key} should be boolean, got ${typeof perms[key]}`);
            });
        });
    });

    it('no non-admin role has security permission', () => {
        const nonAdmin = ['assistant_manager', 'server', 'bartender', 'host', 'cashier',
            'kitchen', 'kitchen_manager', 'bookkeeper', 'payroll_admin',
            'inventory_admin', 'online_ordering_admin'];
        nonAdmin.forEach(role => {
            assert.equal(ROLE_PERMISSIONS[role].security, false, `${role} should not have security`);
        });
    });

    it('only owner/admin have payment_config', () => {
        Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
            if (role === 'owner' || role === 'admin') {
                assert.equal(perms.payment_config, true, `${role} should have payment_config`);
            } else {
                assert.equal(perms.payment_config, false, `${role} should NOT have payment_config`);
            }
        });
    });
});
