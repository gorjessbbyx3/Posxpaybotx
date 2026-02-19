/**
 * Authentication & Authorization Middleware
 *
 * JWT-based auth for the POS API.
 * - Login with PIN returns a JWT token
 * - Token required on all mutating endpoints
 * - Role-based access control per endpoint
 */

const crypto = require('crypto');

// Secret key - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_HOURS = 12;

// Employee database (mirrors the frontend staff list)
const EMPLOYEES = {
    '1234': { id: 'M001', name: 'Maria', role: 'manager', pin: '1234' },
    '1111': { id: 'S001', name: 'John', role: 'server', pin: '1111' },
    '2222': { id: 'S002', name: 'Sarah', role: 'server', pin: '2222' },
    '3333': { id: 'C001', name: 'Mike', role: 'cashier', pin: '3333' },
    '4444': { id: 'B001', name: 'Lisa', role: 'bartender', pin: '4444' },
    '5555': { id: 'K001', name: 'Carlos', role: 'kitchen', pin: '5555' },
    '9999': { id: 'A001', name: 'Admin', role: 'admin', pin: '9999' }
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
 * Login handler - validates PIN and returns token.
 */
function loginHandler(req, res) {
    const { pin, user } = req.body;

    // Try PIN-based auth
    if (pin) {
        const employee = EMPLOYEES[pin];
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

    // Quick login by role name (for dev/demo)
    if (user) {
        const employee = Object.values(EMPLOYEES).find(e => e.role === user || e.name.toLowerCase() === user.toLowerCase());
        if (!employee) {
            return res.status(401).json({ error: 'Unknown user' });
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

    res.status(400).json({ error: 'PIN or user required' });
}

/**
 * Authentication middleware.
 * Extracts and verifies the Bearer token.
 * Attaches user info to req.user.
 */
function authenticate(req, res, next) {
    // Allow login and health endpoints without auth
    // req.path is relative to the mount point (e.g. '/auth/login' when mounted at '/api')
    if (req.path === '/api/auth/login' || req.path === '/auth/login' ||
        req.path === '/api/health' || req.path === '/health') {
        return next();
    }

    // Allow GET requests for read-only access (config, menu display)
    // Only require auth on mutating operations
    if (req.method === 'GET') {
        // Still attach user if token present (for filtering by user)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const payload = verifyToken(authHeader.slice(7));
            if (payload) req.user = payload;
        }
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = payload;
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
    EMPLOYEES,
    ROLE_PERMISSIONS
};
