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
    'ph_7c78c98f': { id: 'M001', name: 'Maria', role: 'manager' },
    'ph_7c78c509': { id: 'S001', name: 'John', role: 'server' },
    'ph_7c7955cd': { id: 'S002', name: 'Sarah', role: 'server' },
    'ph_7c79e691': { id: 'C001', name: 'Mike', role: 'cashier' },
    'ph_7c7a7755': { id: 'B001', name: 'Lisa', role: 'bartender' },
    'ph_7c7b0819': { id: 'K001', name: 'Carlos', role: 'kitchen' },
    'ph_7c7d4b29': { id: 'A001', name: 'Admin', role: 'admin' }
};

// Role-based permissions
const ROLE_PERMISSIONS = {
    admin:     { tickets: true, void: true, refund: true, kitchen: true, config: true, reports: true, timeclock: true },
    manager:   { tickets: true, void: true, refund: true, kitchen: true, config: true, reports: true, timeclock: true },
    server:    { tickets: true, void: false, refund: false, kitchen: false, config: false, reports: false, timeclock: true },
    cashier:   { tickets: true, void: false, refund: false, kitchen: false, config: false, reports: false, timeclock: true },
    bartender: { tickets: true, void: false, refund: false, kitchen: false, config: false, reports: false, timeclock: true },
    kitchen:   { tickets: false, void: false, refund: false, kitchen: true, config: false, reports: false, timeclock: true }
};

// GET endpoints that do NOT require authentication (public read-only)
const PUBLIC_GET_PATHS = new Set([
    '/health',
    '/api/health',
    '/kitchen',
    '/api/kitchen',
    '/tickets',
    '/api/tickets'
]);

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

        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
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
        ((req.path === '/online-orders' || req.path === '/scheduled-orders') && req.method === 'POST')) {
        return next();
    }

    // Extract token if present (for all requests)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const payload = verifyToken(authHeader.slice(7));
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

module.exports = {
    loginHandler,
    authenticate,
    authorize,
    createToken,
    verifyToken,
    hashPin,
    EMPLOYEES,
    ROLE_PERMISSIONS
};
