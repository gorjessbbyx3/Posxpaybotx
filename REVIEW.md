# Code Review: POS System Updates

**Date:** 2026-02-19
**Scope:** 10 recent commits adding POS features (payment processing, kitchen display, reservations, gift cards, inventory, reports, etc.)
**Files reviewed:** `webapp/js/pos.js`, `webapp/css/pos.css`, `webapp/index.html`, `webapp/admin.html`, `webapp/customer-display.html`, `webapp/api/server.js`, `webapp/sw.js`, `database/migration-*.sql`, Java `WebApiServer.java`

---

## Executive Summary

The codebase has grown rapidly (~10,000 lines added across 10 commits) with a comprehensive restaurant POS feature set. However, there are **critical financial calculation bugs** that cause customers to be charged incorrect amounts, **severe security gaps** across both frontend and backend, and **data integrity risks** in payment, inventory, and gift card flows. These must be addressed before any production deployment.

| Severity | Count | Categories |
|----------|-------|------------|
| **Critical** | 16 | Payment math errors, no API auth, XSS, credential exposure |
| **High** | 19 | Race conditions, data loss, mass assignment, broken DOM, wrong ticket bindings |
| **Medium** | 20 | Missing DB constraints, no tests, z-index issues, accessibility gaps |
| **Low** | 10 | Dead code, inline styles, animation naming |

---

## CRITICAL: Financial Calculation Bugs

These bugs cause the **amount charged to differ from the amount displayed**.

### C1. `processPayment()` ignores discount and delivery fee
**File:** `webapp/js/pos.js:1364-1381`

The payment function recalculates total from scratch but **omits discount subtraction and delivery fee addition**. The customer sees one price in the ticket display but is charged a different amount.

```javascript
function processPayment(via) {
    const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * (CONFIG.taxRate / 100);
    let total = subtotal + tax;  // discount NOT subtracted, delivery fee NOT added
    // ...
    completePayment(total, state.paymentMethod);  // wrong total
}
```

Meanwhile, `updateTicketDisplay()` (lines 772-796) correctly computes both. **Fix:** Use the same calculation in both places, or pass the displayed total through.

### C2. Cash discount/surcharge not applied at payment time
**File:** `webapp/js/pos.js:1364-1381`

The payment modal's `openPayment()` correctly shows dual pricing (cash vs card), but `processPayment()` always charges the base total regardless of payment method. Cash customers don't receive their discount; card customers aren't charged the surcharge.

### C3. Gift card payment ignores discount
**File:** `webapp/js/pos.js:4505-4507`

```javascript
const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
const tax = subtotal * (CONFIG.taxRate / 100);
const total = subtotal + tax;  // discount is ignored
```

### C4. Gift card payment creates duplicate tickets
**File:** `webapp/js/pos.js:4520`

Gift card payment pushes a **new** entry to `state.allTickets` instead of finding and updating the existing one. If the order was already sent to kitchen (which also pushes to `allTickets`), this creates a duplicate -- **double revenue recording**.

### C5. Floating-point currency arithmetic (throughout)
All financial calculations use native floating-point without rounding. Tax calculations like `8.875% of 38.97` produce artifacts (`3.45858...`). While `formatCurrency` rounds for display, the **stored total is unrounded**, causing penny discrepancies in reports, batch settlement, and refund comparisons.

**Recommendation:** Round all currency to 2 decimal places immediately after each arithmetic operation: `Math.round(value * 100) / 100`.

### C6. Reports average ticket inflated by voided tickets
**File:** `webapp/js/pos.js:3121-3139`

`ticketCount` includes voided/refunded tickets, but their sales are excluded from `totalSales`. Average ticket = `totalSales / ticketCount` is artificially low.

---

## CRITICAL: Security Vulnerabilities

### C7. No authentication on ANY API endpoint
**Files:** `webapp/api/server.js` (all endpoints), `WebApiServer.java` (all endpoints)

Every endpoint is completely unauthenticated. Any network-accessible client can:
- Void tickets: `POST /api/tickets/:id/void`
- Issue unlimited refunds: `POST /api/refunds`
- Modify cash discount rates: `PUT /api/config/:section`
- View all financial reports
- Clock in/out as any employee

### C8. Refund amount validation allows over-refunding
**File:** `webapp/api/server.js:189-190`

```javascript
if (amount <= 0 || amount > ticket.total) {
    return res.status(400).json({ error: 'Invalid refund amount' });
}
```

Validates against `ticket.total`, not `ticket.total - previousRefunds`. Ten $50 partial refunds on a $50 ticket would all pass validation ($500 total refunded).

### C9. Mass assignment via Object.assign on ticket PATCH
**File:** `webapp/api/server.js:140-146`

```javascript
Object.assign(ticket, req.body, { updatedAt: new Date().toISOString() });
```

A client can send `{"status": "paid", "total": 0}` to mark a ticket as paid without processing payment.

### C10. Wildcard CORS on both servers
**Files:** `webapp/api/server.js:76`, `WebApiServer.java:96`

`Access-Control-Allow-Origin: *` allows any website to make cross-origin requests to the POS API. Combined with no auth, a malicious webpage could issue refunds silently.

### C11. Hardcoded staff PINs in client-side JavaScript
**File:** `webapp/js/pos.js:193-201`

All PINs, employee names, IDs, and hourly rates are in the JS source. Anyone who opens DevTools sees every PIN, including admin (`9999`).

### C12. Plaintext PINs in database migration
**File:** `database/migration-002-refunds-timeclock-held.sql:85-93`

Column named `PIN_HASH` stores plaintext values. No hashing implementation exists.

### C13. 60+ innerHTML XSS vectors
**Files:** `webapp/js/pos.js`, `webapp/admin.html`, `webapp/customer-display.html`

User-controllable data (item notes, customer names, delivery addresses, reservation notes) is injected via `innerHTML` template literals without sanitization. Example:

```javascript
// pos.js:4209 -- item.note could contain: " onload="alert(1)
value="${item.note || ''}" placeholder="Add note...">
```

### C14. No Content Security Policy
None of the HTML files include CSP headers or meta tags.

### C15. Admin page has no access control
**File:** `webapp/admin.html`

Navigating directly to `admin.html` gives full access to terminal config (including API keys), tax settings, and menu management.

### C16. Broken login in Java server -- authenticates by first name only
**File:** `WebApiServer.java:299-305`

Combined with `GET /api/users` (which lists all names unauthenticated), every account is compromised.

---

## HIGH: Data Integrity & Race Conditions

### H1. Gift card double-spend race condition
**File:** `webapp/js/pos.js:4509-4514`

Balance check and deduction are separate, non-atomic operations. Two tabs (BroadcastChannel is active) could both see sufficient balance and both deduct.

### H2. Ticket payment race condition (double-pay)
**File:** `webapp/api/server.js:149-161`

Check-then-set on `ticket.status` is non-atomic. Two concurrent pay requests could both pass the status check.

### H3. Voided tickets can be voided/paid without guards
**File:** `webapp/api/server.js:164-174`

No status check before voiding -- can void an already-paid ticket to circumvent the refund audit trail.

### H4. Filtered ticket list causes wrong button bindings
**File:** `webapp/js/pos.js:4661-4673, 5098-5114`

Tip adjust and reprint buttons index into `state.allTickets` by DOM position, but when filters are active, DOM index 0 is not `allTickets[0]`. **Buttons target the wrong tickets.**

### H5. No inventory rollback on void/refund
**File:** `webapp/js/pos.js`

`deductInventory()` runs on send-to-kitchen, but voiding/refunding never restores stock. Voided orders permanently reduce inventory.

### H6. Batch settlement marks late-arriving tickets
**File:** `webapp/js/pos.js:2260-2268`

A 3.5-second `setTimeout` marks ALL unsettled card tickets. Transactions completed during the delay are marked settled without being included in the batch total.

### H7. Customer tab tracks subtotal, not total with tax
**File:** `webapp/js/pos.js:4363-4369`

Tab limit enforcement uses pre-tax subtotal, but actual bills include tax. Tabs can exceed their dollar limit.

### H8. `saveState()` not called after critical operations
Voiding, refunding, tab operations, reservation changes, and gift card balance changes do not trigger persistence. A browser crash loses these changes.

### H9. In-memory Express store -- all data lost on restart
**File:** `webapp/api/server.js:27-71`

All tickets, refunds, time clock entries are in-memory with no persistence layer.

### H10. Duplicate event listeners throughout
**File:** `webapp/js/pos.js` (multiple locations)

`removeEventListener` with anonymous functions is a no-op. Tab buttons, KDS filters, ticket filters, split buttons, and print buttons all have 2-3 redundant click handlers, causing double execution.

### H11. Java daily report aggregates all-time data, not today's
**File:** `WebApiServer.java:366-411`

Despite computing `today`, it iterates ALL closed tickets. Cash/card breakdown counters are never incremented (always zero).

---

## HIGH: Structural Issues

### H12. Broken HTML nesting in index.html
**File:** `webapp/index.html:279-282`

A premature `</div>` closes `#pos-screen`, causing `#reports-view` to fall outside the screen container, breaking view management.

### H13. Function redefinition via monkey-patching chains
`updateTicketDisplay` is wrapped 4 times, `populateTicketsList` 5 times, `populateKitchen` 3 times. Each call traverses the full chain. The index-based ticket matching in outer wrappers breaks when inner wrappers filter the list.

### H14. `recallTicket` defined twice with different behavior
**File:** `webapp/js/pos.js:2895 vs 5128`

First allows recalling any status; second restricts to `open` only. The second silently shadows the first.

---

## MEDIUM: Database Issues

### M1. No foreign keys on financial tables
Across all three migrations: `REFUND.TICKET_ID`, `TIME_CLOCK.EMPLOYEE_ID`, `GIFT_CARD_TRANSACTION.CARD_NUMBER`, `TAB_TICKET.TAB_ID/TICKET_ID`, etc. have no FK constraints. Orphaned records can exist for all financial data.

### M2. No CHECK constraints on monetary amounts
`AMOUNT`, `BALANCE`, `TOTAL_AMOUNT`, `TIP_AMOUNT` columns allow negative values with no database-level protection.

### M3. API key stored in plaintext
**File:** `migration-cashdiscount-paybotx.sql:40`

PaybotX terminal API key is plain VARCHAR.

### M4. No migration runner or version tracking
Three raw SQL files with no way to track which have been applied.

### M5. Cross-database compatibility claims are false
Comments claim MySQL 5.7+, PostgreSQL 9.5+, Derby 10.x support, but SQL uses MySQL-only syntax (`AUTO_INCREMENT`, `ON DUPLICATE KEY UPDATE`).

---

## MEDIUM: Accessibility

### M6. Zero ARIA attributes in HTML files
No `role`, `aria-label`, `aria-selected`, `aria-modal`, `aria-live`, or `aria-hidden` attributes in `index.html`, `admin.html`, or `customer-display.html`. (Note: the latest commit message claims accessibility improvements were added, but they appear to be in `pos.js` only via JavaScript, not in the HTML source.)

### M7. Global `outline: none` on all buttons
**File:** `webapp/css/pos.css:94`

Removes keyboard focus indicators globally. Later `:focus-visible` rules may partially restore them but the override creates inconsistency.

### M8. `user-scalable=no` blocks zoom
**Files:** `index.html:5`, `customer-display.html:5`

Prevents low-vision users from enlarging content (WCAG 1.4.4 violation).

### M9. No origin validation on postMessage listener
**File:** `customer-display.html:648-653`

Any cross-origin page can send data that gets rendered via innerHTML.

---

## MEDIUM: Architecture

### M10. No tests exist
Zero unit, integration, or end-to-end tests for a financial system with complex business logic.

### M11. Monolithic file sizes
- `pos.js`: ~5,450 lines
- `pos.css`: ~4,120 lines
- `index.html`: ~1,010 lines

All features in single files with no modularization.

### M12. Frontend and backend are disconnected
The frontend manages all data in JavaScript variables. The Express API exists but the frontend does not call it. They are two separate data stores.

### M13. Service worker caches fail silently
**File:** `webapp/sw.js:18-28`

The install handler swallows caching failures. Offline mode will show a broken page. API calls have no offline queue despite `OFFLINE_PAYMENT_QUEUE` table existing in the database.

---

## LOW: Dead Code

| Location | Issue |
|----------|-------|
| `pos.js:3898-3908` | `addToOrderWith86Check` references non-existent `addToOrder` function |
| `pos.js:3109` | `_origPopulateReports` stored but never used |
| `pos.js:2883` | `_origTicketsForRefund` stored but never used |
| `pos.js:4747` | `_origSendToKitchenInv` reads `.onclick` (always null, uses addEventListener) |
| `pos.js:4184` | `activeNoteItemIndex` set but never read |
| `pos.js:171-175` | `DELIVERY_CONFIG.distanceRates` defined but never used |
| `pos.js:700-706` | `pendingModItem` nulled before use in toast message |

---

## Recommended Priority Actions

### Immediate (before any deployment)
1. **Fix `processPayment()` to include discount and delivery fee** (C1, C2)
2. **Fix gift card payment to use correct total and update existing ticket** (C3, C4)
3. **Add authentication middleware to all API endpoints** (C7)
4. **Fix refund validation to track cumulative refunds** (C8)
5. **Sanitize all innerHTML with user-controlled data** (C13)
6. **Remove hardcoded PINs from client-side code** (C11)
7. **Fix filtered ticket index mismatch** (H4)
8. **Round all currency calculations** (C5)

### Short-term
9. Add foreign key constraints to all financial tables (M1)
10. Implement server-side authorization (C7, C15)
11. Replace wildcard CORS with explicit origins (C10)
12. Add basic test coverage for payment flows (M10)
13. Fix broken HTML nesting in index.html (H12)
14. Persist state after all critical operations (H8)

### Medium-term
15. Modularize pos.js into feature modules (M11)
16. Connect frontend to API backend (M12)
17. Add database migration tooling (M4)
18. Implement CSP headers (C14)
19. Add ARIA attributes and fix accessibility (M6-M8)
20. Remove dead code (Low section)
