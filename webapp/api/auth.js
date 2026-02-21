/**
 * Authentication & Authorization Middleware
 *
 * JWT-based auth for the POS API.
 * - Login with PIN returns a JWT token
 * - Token required on all mutating endpoints
 * - Sensitive GET endpoints (reports, config) also require auth
 * - Role-based access control per endpoint
 */

const crypto = require('crypto');

// Secret key - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_HOURS = 12;

// PIN hash utility (must match frontend hashPin)
function hashPin(pin) {
    let hash = 5381;
    for (let i = 0; i < pin.length; i++) {
        hash = ((hash << 5) + hash) + pin.charCodeAt(i);
        hash = hash & hash;
    }
    return 'ph_' + (hash >>> 0).toString(16);
}

// Employee database keyed by pre-computed PIN hashes - no plaintext PINs
const EMPLOYEES = {
    'ph_7c78c98f': { id: 'M001', name: 'Maria', role: 'general_manager' },
    'ph_7c78c509': { id: 'S001', name: 'John', role: 'server' },
    'ph_7c7955cd': { id: 'S002', name: 'Sarah', role: 'server' },
    'ph_7c79e691': { id: 'C001', name: 'Mike', role: 'cashier' },
    'ph_7c7a7755': { id: 'B001', name: 'Lisa', role: 'bartender' },
    'ph_7c7b0819': { id: 'K001', name: 'Carlos', role: 'kitchen' },
    'ph_7c7b9436': { id: 'A001', name: 'Admin', role: 'owner' },
    'ph_7c7c29a1': { id: 'AM01', name: 'David', role: 'assistant_manager' },
    'ph_7c7cba65': { id: 'H001', name: 'Emma', role: 'host' },
    'ph_7c7d4b29': { id: 'KM01', name: 'Rosa', role: 'kitchen_manager' },
    'ph_7c795ed9': { id: 'BK01', name: 'Frank', role: 'bookkeeper' }
};

// ==========================================
// Granular Permission Keys (31 total)
// ==========================================
// Financial:  tickets, void, refund, comp, discounts, cash_drawer, close_day
// Reports:    reports, export, audit, fraud
// Operations: menu, tables, waitlist, kitchen, online_orders
// System:     config, payment_config, security, hardware, locations, integrations
// Labor:      employees, payroll, timeclock
// Inventory:  inventory, vendors, recipes, purchase_orders, waste_log
// Admin:      backups

const _allPerms = [
    'tickets', 'void', 'refund', 'comp', 'discounts', 'cash_drawer', 'close_day',
    'reports', 'export', 'audit', 'fraud',
    'menu', 'tables', 'waitlist', 'kitchen', 'online_orders',
    'config', 'payment_config', 'security', 'hardware', 'locations', 'integrations',
    'employees', 'payroll', 'timeclock',
    'inventory', 'vendors', 'recipes', 'purchase_orders', 'waste_log',
    'backups'
];
const _allTrue  = Object.fromEntries(_allPerms.map(k => [k, true]));
const _allFalse = Object.fromEntries(_allPerms.map(k => [k, false]));

// Role-based permissions
const ROLE_PERMISSIONS = {

    // ── 1. Owner (Super Admin) ── full system access
    //    Controls surcharge/cash discount setup, payment processor, security.
    owner: { ..._allTrue },

    // Backward-compat alias for 'owner'
    admin: { ..._allTrue },

    // ── 2. General Manager ── 80-95% access
    //    Cannot change payment processor or merchant account settings.
    //    Cannot alter security settings.
    general_manager: {
        ..._allTrue,
        payment_config: false,
        security: false
    },

    // Backward-compat alias for 'general_manager'
    manager: {
        ..._allTrue,
        payment_config: false,
        security: false
    },

    // ── 3. Assistant Manager / Shift Manager ──
    //    Void checks, limited comps/refunds, cash drawer reconciliation,
    //    close shifts, manage tables, adjust orders, 86 items.
    //    No payment processing settings or system-level financial exports.
    assistant_manager: {
        ..._allFalse,
        tickets: true, void: true, refund: true, comp: true, discounts: true,
        cash_drawer: true, close_day: true,
        reports: true,
        menu: true, tables: true, waitlist: true, kitchen: true, online_orders: true,
        timeclock: true,
        inventory: true, waste_log: true
    },

    // ── FRONT OF HOUSE ──

    // ── 4. Server ──
    //    Open/close checks, pre-set discounts, transfer tables, print receipts,
    //    split checks, add tips. No voids, refunds, or reporting.
    server: {
        ..._allFalse,
        tickets: true, discounts: true, tables: true, waitlist: true,
        cash_drawer: true, timeclock: true
    },

    // ── 5. Bartender ── same as Server + bar tabs, cash drawer
    bartender: {
        ..._allFalse,
        tickets: true, discounts: true, tables: true, waitlist: true,
        cash_drawer: true, timeclock: true
    },

    // ── 6. Host ── table & waitlist management only, no financial access
    host: {
        ..._allFalse,
        tables: true, waitlist: true, timeclock: true
    },

    // ── 7. Cashier (Quick Service) ──
    //    Process payments, cash/card, limited discounts. No reporting or config.
    cashier: {
        ..._allFalse,
        tickets: true, discounts: true, cash_drawer: true, timeclock: true
    },

    // ── BACK OF HOUSE ──

    // ── 8. Line Cook (KDS Only) ──
    //    View tickets, bump orders, mark items ready. No financials or POS.
    kitchen: {
        ..._allFalse,
        kitchen: true, timeclock: true
    },

    // ── 9. Kitchen Manager ──
    //    Inventory, waste logging, recipe management, food cost reporting,
    //    vendor management. Limited POS financial access.
    kitchen_manager: {
        ..._allFalse,
        kitchen: true, reports: true, timeclock: true,
        inventory: true, vendors: true, recipes: true,
        purchase_orders: true, waste_log: true
    },

    // ── ACCOUNTING / ADMIN ──

    // ── 10. Bookkeeper / Accountant ──
    //    View reports, export sales data, access payout/tax/labor reports.
    //    Cannot operate POS, void/comp, or change settings.
    bookkeeper: {
        ..._allFalse,
        reports: true, export: true, audit: true, timeclock: true
    },

    // ── SPECIALIZED MODULE ROLES ──

    // ── 11. Payroll Admin ──
    //    Process payroll, edit pay rates, manage employee records.
    payroll_admin: {
        ..._allFalse,
        employees: true, payroll: true, reports: true, export: true, timeclock: true
    },

    // ── 12. Inventory Admin ──
    //    Manage vendors, cost recipes, food cost analytics, receive POs.
    inventory_admin: {
        ..._allFalse,
        reports: true, timeclock: true,
        inventory: true, vendors: true, recipes: true,
        purchase_orders: true, waste_log: true
    },

    // ── 13. Online Ordering Admin ──
    //    Manage digital menus, online pricing, delivery zones, service fees.
    online_ordering_admin: {
        ..._allFalse,
        menu: true, online_orders: true, integrations: true, timeclock: true
    }
};

// Role metadata for UI display
const ROLES = {
    owner:                  { label: 'Owner',                  category: 'Admin / Ownership' },
    general_manager:        { label: 'General Manager',        category: 'Admin / Ownership' },
    assistant_manager:      { label: 'Assistant Manager',      category: 'Admin / Ownership' },
    server:                 { label: 'Server',                 category: 'Front of House' },
    bartender:              { label: 'Bartender',              category: 'Front of House' },
    host:                   { label: 'Host',                   category: 'Front of House' },
    cashier:                { label: 'Cashier',                category: 'Front of House' },
    kitchen:                { label: 'Line Cook',              category: 'Back of House' },
    kitchen_manager:        { label: 'Kitchen Manager',        category: 'Back of House' },
    bookkeeper:             { label: 'Bookkeeper',             category: 'Accounting' },
    payroll_admin:          { label: 'Payroll Admin',          category: 'Specialized' },
    inventory_admin:        { label: 'Inventory Admin',        category: 'Specialized' },
    online_ordering_admin:  { label: 'Online Ordering Admin',  category: 'Specialized' }
};

/**
 * Create a simple JWT-like token.
 * Uses HMAC-SHA256 for signing.
 */
function createToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_HOURS * 3600
    })).toString('base64url');

    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(header + '.' + body)
        .digest('base64url');

    return header + '.' + body + '.' + signature;
}

/**
 * Verify and decode a token.
 * @returns {Object|null} Decoded payload or null if invalid
 */
function verifyToken(token) {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
        const expectedSig = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(parts[0] + '.' + parts[1])
            .digest('base64url');

        if (expectedSig !== parts[2]) return null;

        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

        // Check expiration (item 15: detect and flag expired tokens)
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return { _expired: true };
        }

        return payload;
    } catch (e) {
        return null;
    }
}

/**
 * Login handler - validates PIN (hashed) and returns token.
 */
function loginHandler(req, res) {
    const { pin } = req.body;

    // Try PIN-based auth (hash the PIN and look up)
    if (pin) {
        const hashed = hashPin(pin);
        const employee = EMPLOYEES[hashed];
        if (!employee) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        const token = createToken({
            id: employee.id,
            name: employee.name,
            role: employee.role
        });

        return res.json({
            token,
            user: { id: employee.id, name: employee.name, role: employee.role }
        });
    }

    res.status(400).json({ error: 'PIN required' });
}

/**
 * Authentication middleware.
 * Extracts and verifies the Bearer token.
 * Attaches user info to req.user.
 *
 * Auth policy:
 * - Login/health: no auth needed
 * - Public GET (tickets, kitchen): no auth required, but user attached if present
 * - Sensitive GET (reports, config, refunds, timeclock): auth required via authorize()
 * - All mutating methods (POST/PATCH/PUT/DELETE): auth required
 */
function authenticate(req, res, next) {
    // Allow login, health, and public-facing endpoints without auth
    if (req.path === '/api/auth/login' || req.path === '/auth/login' ||
        req.path === '/api/health' || req.path === '/health' ||
        ((req.path === '/online-orders' || req.path === '/scheduled-orders' || req.path === '/reservations' || req.path === '/qr-orders' || req.path === '/waitlist') && req.method === 'POST') ||
        (req.path.match(/^\/hardware\/kds-displays\/\d+\/heartbeat$/) && req.method === 'POST')) {
        return next();
    }

    // Extract token if present (for all requests)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const payload = verifyToken(authHeader.slice(7));
        if (payload && payload._expired) {
            // Item 15: explicit 401 for expired tokens with clear message
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        if (payload) req.user = payload;
    }

    // GET requests: allow public endpoints without auth
    // Sensitive GETs are protected by authorize() middleware on the route
    if (req.method === 'GET') {
        return next();
    }

    // Mutating requests require authentication
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    next();
}

/**
 * Authorization middleware factory.
 * Returns middleware that checks if the user has the required permission.
 * @param {string} permission - Permission key (e.g. 'void', 'refund')
 */
function authorize(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const perms = ROLE_PERMISSIONS[req.user.role];
        if (!perms || !perms[permission]) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: permission,
                role: req.user.role
            });
        }

        next();
    };
}

/**
 * Get all employees (safe for listing - no PIN hashes exposed).
 */
function getEmployeeList() {
    return Object.values(EMPLOYEES).map(e => ({
        id: e.id,
        name: e.name,
        role: e.role
    }));
}

/**
 * Add a new employee with a PIN.
 * @param {string} pin - 4-digit PIN
 * @param {Object} info - { id, name, role }
 * @returns {Object|null} Employee or null if PIN already taken
 */
function addEmployee(pin, info) {
    const hashed = hashPin(pin);
    if (EMPLOYEES[hashed]) return null; // PIN collision
    EMPLOYEES[hashed] = { id: info.id, name: info.name, role: info.role };
    return { id: info.id, name: info.name, role: info.role };
}

/**
 * Remove an employee by ID.
 * @param {string} employeeId
 * @returns {boolean} true if removed
 */
function removeEmployee(employeeId) {
    for (const [hash, emp] of Object.entries(EMPLOYEES)) {
        if (emp.id === employeeId) {
            delete EMPLOYEES[hash];
            return true;
        }
    }
    return false;
}

/**
 * Update an employee (name, role). Optionally update PIN.
 * @param {string} employeeId
 * @param {Object} updates - { name, role, pin }
 * @returns {Object|null}
 */
function updateEmployee(employeeId, updates) {
    for (const [hash, emp] of Object.entries(EMPLOYEES)) {
        if (emp.id === employeeId) {
            if (updates.name) emp.name = updates.name;
            if (updates.role) emp.role = updates.role;
            if (updates.pin) {
                const newHash = hashPin(updates.pin);
                if (newHash !== hash && EMPLOYEES[newHash]) return null; // New PIN already taken
                if (newHash !== hash) {
                    EMPLOYEES[newHash] = emp;
                    delete EMPLOYEES[hash];
                }
            }
            return { id: emp.id, name: emp.name, role: emp.role };
        }
    }
    return null;
}

module.exports = {
    loginHandler,
    authenticate,
    authorize,
    createToken,
    verifyToken,
    hashPin,
    EMPLOYEES,
    ROLE_PERMISSIONS,
    ROLES,
    getEmployeeList,
    addEmployee,
    removeEmployee,
    updateEmployee
};
