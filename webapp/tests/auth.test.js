/**
 * Unit Tests - Authentication & Authorization
 *
 * Tests JWT token creation/verification, PIN-based login,
 * and role-based permission checks.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createToken, verifyToken, hashPin, EMPLOYEES, ROLE_PERMISSIONS } = require('../api/auth');

// ==========================================
// Token Creation & Verification
// ==========================================
describe('createToken', () => {
    it('creates a valid token string', () => {
        const token = createToken({ id: 'M001', name: 'Maria', role: 'manager' });
        assert.ok(token);
        assert.equal(typeof token, 'string');
        assert.equal(token.split('.').length, 3);
    });

    it('creates different tokens for different payloads', () => {
        const t1 = createToken({ id: 'M001', name: 'Maria', role: 'manager' });
        const t2 = createToken({ id: 'S001', name: 'John', role: 'server' });
        assert.notEqual(t1, t2);
    });
});

describe('verifyToken', () => {
    it('verifies a valid token', () => {
        const token = createToken({ id: 'M001', name: 'Maria', role: 'manager' });
        const payload = verifyToken(token);
        assert.ok(payload);
        assert.equal(payload.id, 'M001');
        assert.equal(payload.name, 'Maria');
        assert.equal(payload.role, 'manager');
    });

    it('includes iat and exp fields', () => {
        const token = createToken({ id: 'test' });
        const payload = verifyToken(token);
        assert.ok(payload.iat);
        assert.ok(payload.exp);
        assert.ok(payload.exp > payload.iat);
    });

    it('rejects tampered token', () => {
        const token = createToken({ id: 'M001', name: 'Maria', role: 'manager' });
        // Tamper with the payload portion
        const parts = token.split('.');
        const tampered = parts[0] + '.' + Buffer.from(JSON.stringify({ id: 'hacker', role: 'admin' })).toString('base64url') + '.' + parts[2];
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
        assert.ok(EMPLOYEES[hashPin('1234')]); // manager
        assert.ok(EMPLOYEES[hashPin('1111')]); // server
        assert.ok(EMPLOYEES[hashPin('9999')]); // admin
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
});

// ==========================================
// Role Permissions
// ==========================================
describe('ROLE_PERMISSIONS', () => {
    it('admin has all permissions', () => {
        const perms = ROLE_PERMISSIONS['admin'];
        Object.values(perms).forEach(v => assert.equal(v, true));
    });

    it('manager has all permissions', () => {
        const perms = ROLE_PERMISSIONS['manager'];
        Object.values(perms).forEach(v => assert.equal(v, true));
    });

    it('server cannot void or refund', () => {
        const perms = ROLE_PERMISSIONS['server'];
        assert.equal(perms.void, false);
        assert.equal(perms.refund, false);
    });

    it('server can create tickets', () => {
        assert.equal(ROLE_PERMISSIONS['server'].tickets, true);
    });

    it('kitchen can only access kitchen', () => {
        const perms = ROLE_PERMISSIONS['kitchen'];
        assert.equal(perms.kitchen, true);
        assert.equal(perms.tickets, false);
        assert.equal(perms.void, false);
        assert.equal(perms.refund, false);
        assert.equal(perms.config, false);
        assert.equal(perms.reports, false);
    });

    it('cashier cannot access reports or config', () => {
        const perms = ROLE_PERMISSIONS['cashier'];
        assert.equal(perms.reports, false);
        assert.equal(perms.config, false);
    });

    it('all roles can access timeclock', () => {
        Object.values(ROLE_PERMISSIONS).forEach(perms => {
            assert.equal(perms.timeclock, true);
        });
    });
});
