# Code Review: POS System Updates (Revision 2)

**Date:** 2026-02-19
**Scope:** 14 commits total -- 10 original feature commits + 4 new commits (loyalty, modularization, tests, waitlist/allergens)
**Files reviewed:** All `.js`, `.css`, `.html`, `.sql`, `.sh`, `.java` files across the codebase

---

## Executive Summary

Four new commits added modularization (7 new JS modules), an auth layer, test suites, a migration runner, a loyalty/combo system, waitlist, allergen tracking, and auto-gratuity. These address some previous findings (M10 tests, M11 modularization, M4 migration tooling, C7 auth) but introduce **new critical issues** and leave most original financial bugs unfixed.

### Revision 2 Totals

| Severity | Rev 1 | Rev 2 | Change | Categories |
|----------|-------|-------|--------|------------|
| **Critical** | 16 | 20 | +4 | Auth backdoor, SQL injection in migrate.sh, new XSS in modules, payroll rounding |
| **High** | 19 | 26 | +7 | Audit trail spoofing, auto-gratuity logic bugs, function patch conflicts, offline queue flaws |
| **Medium** | 20 | 28 | +8 | Missing modal CSS, test gaps on financial paths, API input validation, cache strategy bugs |
| **Low** | 10 | 10 | 0 | Dead code (unchanged) |

### Status of Previously Reported Issues

| Previous Finding | Status | Notes |
|------------------|--------|-------|
| C1. processPayment() ignores discount | **STILL OPEN** | Not fixed in any new commit |
| C2. Cash discount not applied at payment | **STILL OPEN** | Not fixed |
| C3. Gift card ignores discount | **STILL OPEN** | Not fixed |
| C4. Gift card creates duplicate tickets | **STILL OPEN** | Not fixed |
| C5. Floating-point currency | **PARTIALLY FIXED** | `calculations.js` adds `round()` but `pos.js` still has raw arithmetic |
| C6. Reports average includes voided | **STILL OPEN** | Not fixed |
| C7. No API authentication | **PARTIALLY FIXED** | `auth.js` added but has critical backdoor (see NC1) |
| C8. Refund over-payment | **STILL OPEN** | Still validates against total, not remaining |
| C9. Mass assignment Object.assign | **STILL OPEN** | server.js still uses Object.assign |
| C10. Wildcard CORS | **STILL OPEN** | Still `Access-Control-Allow-Origin: *` |
| C11. Hardcoded PINs in client JS | **STILL OPEN** | Still in pos-core.js |
| C13. innerHTML XSS vectors | **WORSE** | New modules add more innerHTML with user data |
| M4. No migration tooling | **FIXED** | migrate.sh added (but has SQL injection) |
| M10. No tests | **PARTIALLY FIXED** | 4 test files added (but gaps on critical paths) |
| M11. Monolithic pos.js | **PARTIALLY FIXED** | 7 modules extracted, but pos.js still ~4,300 lines |
| M12. Frontend/backend disconnected | **PARTIALLY FIXED** | api-client.js added with offline queue |

---

## NEW CRITICAL ISSUES (from commits a640dca, 2dab1ba, d620d99, b06d20b)

### NC1. Authentication backdoor -- login by role name without PIN
**File:** `webapp/api/auth.js:113-130`

The login endpoint allows authentication by sending a role name (e.g., `"admin"`, `"manager"`) in the `user` field **without a PIN**. This completely bypasses PIN authentication.

```javascript
// Anyone can send: POST /api/auth/login { "user": "admin" }
// and receive a valid admin JWT token
```

**Impact:** The entire auth layer is meaningless. Any client can obtain admin privileges.
**Fix:** Remove the role-name fallback immediately.

### NC2. SQL injection in migration runner
**File:** `database/migrate.sh:199, 204`

Variables `$desc` and `$file` are interpolated directly into SQL INSERT statements without escaping:

```bash
run_sql "INSERT INTO schema_version (...) VALUES ($ver, '$desc', '$file', ...);"
```

If a migration filename contains a single quote, the SQL breaks. A crafted filename could execute arbitrary SQL.
**Fix:** Escape single quotes or use parameterized queries.

### NC3. Payroll calculation rounding error
**File:** `webapp/js/calculations.js:241`

```javascript
const totalHours = totalMs / 3600000;
```

Time-to-hours conversion has no rounding. A 30-minute shift = 0.5 hours, but intermediate calculations can produce artifacts like `0.4999999...` which, when multiplied by hourly rate and truncated, shorts employee pay.
**Fix:** Round hours to 2 decimal places.

### NC4. New XSS vectors in extracted modules
**Files:**
- `pos-extras.js:88-106` -- Waitlist name/phone injected via innerHTML
- `pos-extras.js:457` -- Allergen key in onclick attribute (quote breakout)
- `pos-kitchen.js:46` -- Modifier names in innerHTML
- `pos-loyalty.js:170, 255` -- Member name in innerHTML
- `pos-tables.js:398, 431` -- Table numbers and reservation names in innerHTML

Every new module introduces user-controllable data into innerHTML without sanitization.

---

## NEW HIGH ISSUES

### NH1. Audit trail spoofing -- voidedBy and processedBy from request body
**File:** `webapp/api/server.js:188, 220`

The void endpoint accepts `voidedBy` from `req.body` instead of using `req.user.name`. A server can void their own ticket and claim a manager did it. Same for `processedBy` on refunds.

```javascript
voidedBy: req.body.voidedBy || req.user?.name  // attacker controls req.body.voidedBy
```

**Fix:** Always use `req.user.name` from the authenticated token.

### NH2. Auto-gratuity uses table seat count, not actual party size
**File:** `webapp/js/pos-extras.js:209-220`

Party size detection falls back to `tbl.seats` (total capacity) instead of actual guest count. A 2-person table at a 6-seat table triggers the auto-gratuity threshold. Customers are charged gratuity they shouldn't owe.

### NH3. Auto-gratuity calculated on pre-discount subtotal
**File:** `webapp/js/pos-extras.js:185`

Gratuity is calculated on the raw subtotal, not the after-discount amount. If a $100 order has a 50% discount, gratuity should be on $50, not $100.

### NH4. Function monkey-patch conflicts between modules
**Files:** `pos-extras.js`, `pos-loyalty.js`, `pos-kitchen.js`

Multiple modules patch the same global functions (`openPayment`, `completePayment`, `addItemDirectly`, `populateKitchen`, `populateTicketsList`). The last-loaded module's patch overwrites previous patches. Script loading order in index.html determines which features work.

Example: Both `pos-extras.js` and `pos-loyalty.js` patch `completePayment`. Only the last-loaded module's wrapper executes; the other is lost.

### NH5. Offline queue not truly persistent
**File:** `webapp/sw.js:71-76`

The offline queue uses Cache API, which the browser can clear at any time. Payment operations queued offline could be silently lost. IndexedDB should be used for persistent financial data.

### NH6. Service worker cache doesn't fall back on 5xx errors
**File:** `webapp/sw.js:104-126`

If the network returns a 500 error, the service worker returns the error to the user instead of serving the cached version. Users see a broken page when the server is down, defeating the purpose of offline support.

### NH7. Drinks assigned to appetizer course in KDS
**File:** `webapp/js/pos-kitchen.js:110`

```javascript
} else if (catName === 'drinks') {
    item.course = 'appetizer';  // Should be 'expo' or separate drink course
```

Drinks are routed to the appetizer course instead of the bar/expo station, causing incorrect kitchen fire sequencing.

---

## NEW MEDIUM ISSUES

### NM1. No input validation on ticket creation
**File:** `webapp/api/server.js:127-153`

`req.body` is passed through without schema validation. A client can send negative prices, non-numeric quantities, or inject arbitrary fields.

### NM2. API response JSON-parsed before ok check
**File:** `webapp/js/api-client.js:52`

```javascript
const data = await res.json();
if (!res.ok) { throw new APIError(...); }
```

If the server returns a 4xx/5xx with non-JSON body, `res.json()` throws an unhandled parse error before the status check runs.

### NM3. No rate limiting on login endpoint
**File:** `webapp/api/auth.js:91-133`

PINs are 4 digits (10,000 combinations). Without rate limiting, all PINs can be brute-forced in seconds.

### NM4. No token revocation mechanism
**File:** `webapp/api/auth.js`

Tokens cannot be invalidated before their 12-hour expiry. A fired employee retains API access until their token expires. No logout endpoint exists.

### NM5. JWT secret regenerated on every server restart
**File:** `webapp/api/auth.js:13`

```javascript
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
```

Without `JWT_SECRET` env var, every restart invalidates all existing tokens. In production, this would force all terminals to re-login on every deploy.

### NM6. Missing CSS for new modal elements
**File:** `webapp/css/pos.css`

New HTML modals for waitlist, allergen filters, void approval, and auto-gratuity confirmation have no corresponding CSS rules. These modals display with incorrect dimensions.

### NM7. Duplicate course firing allowed
**File:** `webapp/js/pos-kitchen.js:209-210`

```javascript
o.firedCourses.push(course);  // No duplicate check
```

A course can be fired multiple times, sending duplicate tickets to kitchen stations.

### NM8. Reservation seating doesn't create new ticket
**File:** `webapp/js/pos-tables.js:468-482`

`seatReservation()` sets `state.ticket.table` but doesn't call `newTicket()`. If a previous ticket exists, it's reassigned to the reservation's table, mixing orders.

---

## TEST SUITE ASSESSMENT

Four test files were added (388 + 142 + 483 + 300 = 1,313 lines of tests). This is a significant improvement, but critical financial paths remain untested.

### What's Covered Well
- Authentication token creation and verification
- Role-based permission matrix (all 6 roles)
- Individual calculation functions (tax, discount, split check, rounding)
- Currency rounding edge cases
- Allergen data completeness
- Basic CRUD on tickets, payments, refunds

### Critical Gaps -- Not Tested

| Scenario | Status | Risk |
|----------|--------|------|
| Payment with discount applied | **NOT TESTED** | Customers charged wrong amount (C1) |
| Gift card payment creates duplicate ticket | **NOT TESTED** | Double revenue recording (C4) |
| Cumulative refund exceeds total | **NOT TESTED** | Unlimited refund fraud (C8) |
| Cash discount/surcharge at payment time | **NOT TESTED** | Wrong amount charged (C2) |
| Auto-gratuity + discount interaction | **NOT TESTED** | Gratuity on wrong base (NH3) |
| End-to-end: create ticket -> discount -> pay -> verify total | **NOT TESTED** | Integration gap |
| Auth backdoor via role name login | **NOT TESTED** | Full auth bypass (NC1) |
| Offline queue persistence and replay | **NOT TESTED** | Data loss risk (NH5) |

### Test Anti-Patterns Found
- **Allergen tests** parse source code with regex instead of importing the module -- fragile and won't catch runtime issues
- **Waitlist tests** re-implement calculation logic instead of testing actual code -- tests prove the formula works, not that the code uses it
- **Void reason tests** validate a hardcoded array, not the actual reasons from the API
- **No integration tests** that exercise the full ticket lifecycle through the API

---

## UPDATED: Recommended Priority Actions

### Immediate (before any deployment)
1. **Remove auth backdoor** -- delete role-name login fallback in auth.js (NC1)
2. **Fix `processPayment()` to include discount and delivery fee** (C1, C2) -- STILL OPEN
3. **Fix gift card payment to use correct total and update existing ticket** (C3, C4) -- STILL OPEN
4. **Fix audit trail spoofing** -- always use `req.user.name` for voidedBy/processedBy (NH1)
5. **Fix refund validation to track cumulative refunds** (C8) -- STILL OPEN
6. **Remove wildcard CORS** (C10) -- STILL OPEN
7. **Sanitize all innerHTML** across all modules (C13, NC4) -- GETTING WORSE
8. **Round all currency calculations** in pos.js (C5) -- STILL PARTIALLY OPEN
9. **Fix auto-gratuity party size detection** (NH2)
10. **Fix SQL injection in migrate.sh** (NC2)

### Short-term
11. Add integration tests for discount + payment, gift card, and refund flows
12. Fix Object.assign mass assignment (C9) -- STILL OPEN
13. Add input validation to ticket creation (NM1)
14. Add rate limiting to login (NM3)
15. Fix function monkey-patch conflicts between modules (NH4)
16. Replace Cache API with IndexedDB for offline queue (NH5)
17. Require JWT_SECRET env var, fail on startup if missing (NM5)
18. Add token revocation / short expiry with refresh (NM4)

### Medium-term
19. Add foreign key constraints to all financial tables (M1)
20. Implement CSP headers (C14)
21. Continue pos.js modularization -- still ~4,300 lines (M11)
22. Replace monkey-patching with event bus or middleware pattern (NH4, H13)
23. Add ARIA attributes and fix accessibility (M6-M8)
24. Remove dead code and unused variables (Low section)
25. Remove hardcoded PINs from client code; use server-side auth only (C11)
