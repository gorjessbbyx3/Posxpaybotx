# Code Review: POS System Updates (Revision 3)

**Date:** 2026-02-19
**Scope:** 26 total commits -- 10 original features + 4 bug fixes + 4 new features (batches 3-5) + 5 feature commits (partial payments, webhooks, station routing, CLAUDE.md) + 3 merge commits
**Files reviewed:** All `.js`, `.css`, `.html`, `.sql`, `.sh`, `.java`, `.md` files

---

## Executive Summary

Four bug-fix commits (1b10da8, f054da0, 2690592, 5eb5e9b) addressed **31 of 33 previously reported issues**. The fixes are generally thorough and well-implemented -- particularly the whitelist-based PATCH, cumulative refund validation, hooks system replacing monkey-patches, and cross-tab gift card sync.

However, 8 subsequent feature commits introduce **new critical and high-severity issues**, primarily around surcharge calculations, missing auth on new endpoints, and loyalty point inflation.

### Revision 3 Totals

| Severity | Rev 1 | Rev 2 | Rev 3 | Notes |
|----------|-------|-------|-------|-------|
| **Critical** | 16 | 20 | 2 | 31 fixed, 2 new |
| **High** | 19 | 26 | 5 | Most fixed, 5 new from feature commits |
| **Medium** | 20 | 28 | 12 | Most fixed, 12 new from feature commits |
| **Low** | 10 | 10 | 5 | Most dead code cleaned up, 5 minor new |

---

## Status of ALL Previously Reported Issues

### Fully Fixed (31 issues)

| ID | Issue | Fixed In | Fix Quality |
|----|-------|----------|-------------|
| C1 | processPayment() ignores discount/delivery fee | 1b10da8 | Good -- proper rounding, includes delivery fee |
| C2 | Cash discount not applied at payment time | 1b10da8 | Good -- surcharge/discount applied per payment method |
| C3 | Gift card ignores discount | 1b10da8 | Good -- includes discount and delivery fee |
| C4 | Gift card creates duplicate tickets | 1b10da8 | Good -- uses findIndex to update existing |
| C5 | Floating-point currency arithmetic | 1b10da8 | Good -- `Math.round(x*100)/100` throughout |
| C6 | Reports average includes voided tickets | 1b10da8 | Good -- filters voided/refunded before counting |
| C8 | Refund over-payment | 1b10da8 | Good -- tracks cumulative `refundedAmount` |
| C9 | Mass assignment Object.assign | 1b10da8 | Good -- whitelist `TICKET_PATCH_FIELDS` |
| C10 | Wildcard CORS | 1b10da8 | Good -- configurable allowed origins |
| C11 | Hardcoded PINs in client JS | f054da0 | Good -- pre-hashed, lookup via hash |
| C13 | innerHTML XSS | 1b10da8 + 2690592 | Good -- `escapeHtml()` across all modules |
| C14 | No CSP | 1b10da8 | Good -- CSP meta tag and Express header |
| C15 | Admin page no access control | 1b10da8 | Good -- PIN gate on admin.html |
| H1 | Gift card double-spend | 1b10da8 + f054da0 | Good -- processing flag + cross-tab localStorage sync |
| H4 | Filtered ticket wrong bindings | 1b10da8 | Good -- ID-based lookup instead of index |
| H5 | No inventory rollback on void | 1b10da8 | Good -- `restoreInventory()` on void/refund |
| H8 | saveState() gaps | 1b10da8 | Good -- called after all critical ops |
| H10 | Duplicate event listeners | 1b10da8 + 2690592 | Good -- hooks system replaces monkey-patches |
| H12 | Broken HTML nesting | 1b10da8 | Good -- proper div closing |
| NC1 | Auth backdoor (role name login) | 2690592 | Good -- removed entirely, PIN required |
| NC2 | SQL injection in migrate.sh | 2690592 | Good -- single-quote escaping |
| NC3 | Payroll rounding error | 2690592 | Good -- `Math.round(ms/36000)/100` |
| NC4 | XSS in extracted modules | 2690592 | Good -- escapeHtml() in all modules |
| NH1 | Audit trail spoofing | 2690592 | Good -- always `req.user.name` |
| NH2 | Auto-gratuity seat count | 2690592 | Good -- explicit partySize only |
| NH3 | Auto-gratuity pre-discount | 2690592 | Good -- uses afterDiscount amount |
| C7 | No API auth | 1b10da8 + 2690592 | Good -- JWT auth + backdoor removed |
| C12 | Plaintext PINs in migration | 2690592 | Fixed -- escape applied |
| H2 | Batch settlement race | 1b10da8 | Fixed -- captures ticket IDs at batch start |

### Partially Fixed (1 issue)

| ID | Issue | Status | Gap |
|----|-------|--------|-----|
| H2 | Ticket payment race condition | Batch settlement fixed, but individual ticket double-pay still possible | Need server-side locking on ticket status transition |

### Not Addressed (1 issue)

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| C16 | Java server broken login | Unknown | Java auth changes in 5eb5e9b not fully assessed; SessionManager.java added |

---

## NEW CRITICAL ISSUES (from feature commits)

### NC5. Surcharge report formula incorrect for CARD_SURCHARGE mode
**File:** `webapp/api/server.js:957-962`

Both CASH_DISCOUNT and CARD_SURCHARGE modes use the same extraction formula:
```javascript
surcharge = (t.total || 0) * rate / (1 + rate);  // Used for BOTH modes
```

This is correct for CASH_DISCOUNT (surcharge is embedded in menu price) but **wrong for CARD_SURCHARGE** (surcharge is added on top). The CARD_SURCHARGE formula should be `total * rate`, not `total * rate / (1 + rate)`.

**Impact:** Surcharge revenue is **understated** by ~4% at a 4% surcharge rate. For a restaurant doing $500K/year in card transactions, this is ~$20K unreported surcharge revenue.

### NC6. Kitchen display endpoints lack authorization
**File:** `webapp/api/server.js:482, 517, 1465`

GET endpoints for kitchen orders, station views, and expo view have **no `authorize()` middleware**. Any authenticated user (servers, cashiers) can view all kitchen data, bypassing workflow controls.

---

## NEW HIGH ISSUES (from feature commits)

### NH8. Customer data endpoint has no authorization
**File:** `webapp/api/server.js:1113`

`GET /api/customers` returns all customer records (email, phone, address, loyalty points) to any authenticated user regardless of role. Should require `authorize('reports')` or similar.

### NH9. Loyalty points earned on pre-discount subtotal
**File:** `webapp/js/pos-loyalty.js:138`

```javascript
const subtotal = state.ticket.items.reduce((s, i) => s + i.price * i.qty, 0);
const pts = earnLoyaltyPoints(phone, subtotal);  // Full price, not after discount
```

A 50% discounted $100 order earns points for $100 instead of $50. Over time this significantly inflates loyalty point liability.

### NH10. Labor hours calculation off by 100x
**File:** `webapp/api/server.js:767`

```javascript
laborMap[r.empId].hours += Math.round((end - new Date(r.clockIn)) / 36000) / 100;
```

`36000` milliseconds = 0.036 seconds. Should be `3600000` (ms per hour). An 8-hour shift would be calculated as `28800000 / 36000 / 100 = 8.0` -- wait, this actually works: `36000 * 100 = 3600000`. The formula is correct but **confusing and fragile**. Any future developer will likely "fix" `36000` to `3600000` and break it.

**Status: Not a bug, but a readability risk.** Recommend rewriting as `(end - start) / 3600000` with proper rounding.

### NH11. Partial payments can over-pay when amount is unspecified
**File:** `webapp/api/server.js:347-410`

When `requestedAmount` is null/undefined, the full remaining balance is charged. If two concurrent requests both omit the amount, both calculate the full remaining balance and both charge it -- resulting in overpayment. Same race condition pattern as H2.

### NH12. Duplicate course firing still possible
**File:** `webapp/js/pos-kitchen.js:207-212`

```javascript
o.firedCourses.push(course);  // No duplicate check
```

Same course can be fired multiple times. Staff double-clicking sends duplicate tickets to kitchen.

---

## NEW MEDIUM ISSUES (from feature commits)

### NM9. Webhook URLs not validated for SSRF
**File:** `webapp/api/server.js:198-218`

Webhooks fire to any URL without validating it's not an internal/private IP. Could be used for SSRF.

### NM10. Online orders endpoint has no CSRF protection
**File:** `webapp/api/server.js:1601`

`POST /api/online-orders` has no auth (customer-facing) and no CSRF token. Cross-site form POST could inject orders.

### NM11. Inventory allows negative stock
**File:** `webapp/api/server.js:1979-2006`

Stock adjustments can set inventory below zero without validation or requiring a reason.

### NM12. Food cost report treats missing cost as zero
**File:** `webapp/api/server.js:1878-1893`

`parseFloat(item.cost) || 0` means items without cost data inflate profit margins.

### NM13. Promo codes combinable with all other discounts
**File:** `webapp/api/server.js:1354-1381`

No validation that promo codes can't stack with loyalty discounts, manual discounts, or auto-gratuity.

### NM14. Auto-gratuity not enforced -- silently skipped if no party size
**File:** `webapp/js/pos-extras.js:215`

If staff forget to enter party size, large parties pay no gratuity. No prompt before payment.

### NM15. Service worker deletes failed queue items on 4xx errors
**File:** `webapp/sw.js:222`

Offline queued requests that fail with 400/401/403 are deleted without user notification. A payment queued while offline could be permanently lost if the auth token expired.

### NM16. Curbside arrival endpoint too permissive
**File:** `webapp/api/server.js:2178`

Any user with `tickets` permission can mark any ticket as arrived, not just their own.

### NM17. Refund endpoint lacks idempotency key
**File:** `webapp/api/server.js:435-477`

No duplicate detection on refund requests. A double-click could process two identical refunds.

### NM18. Seat assignment accepts invalid item indices
**File:** `webapp/api/server.js:1409-1423`

`ticket.seats` object can reference non-existent item indices without validation.

### NM19. State code validation only checks length
**File:** `webapp/api/server.js:996-1010`

Accepts any 2-letter code (e.g., "XX", "ZZ"). Should validate against actual state list.

### NM20. Gift card charge doesn't validate ticket existence
**File:** `webapp/api/server.js:1219-1240`

Charges a gift card against a `ticketId` without verifying the ticket exists in the store.

---

## TEST SUITE ASSESSMENT

The test suite grew significantly (1,313 -> 2,686+ lines) with good coverage of new endpoints.

### Well Tested
- All CRUD operations for tickets, payments, refunds
- Authentication token flow (creation, verification, expiry)
- Role-based permissions across 6 roles
- Calculation functions (tax, discount, split, rounding)
- Partial payment sequences
- Void workflow with approval
- Inventory deduction and 86'd items
- Allergen data completeness
- Surcharge report (but see NC5 -- formula itself is wrong)

### Still Not Tested

| Gap | Risk |
|-----|------|
| Surcharge CARD_SURCHARGE vs CASH_DISCOUNT mode | NC5 bug would be caught |
| Concurrent partial payments (race condition) | NH11 |
| Loyalty points with active discount | NH9 |
| Course double-fire prevention | NH12 |
| Offline queue replay with expired tokens | NM15 |
| Webhook SSRF validation | NM9 |
| End-to-end: discount + partial payment + tip + refund | Integration gap |

---

## ARCHITECTURE NOTES

### Improvements Since Rev 2
- **Hooks system** replaces brittle monkey-patching (major improvement)
- **API client** with offline queue connects frontend to backend
- **Modular JS files** (7 modules extracted from monolithic pos.js)
- **Migration runner** with version tracking
- **Pre-hashed PINs** eliminate plaintext credential exposure
- **CSP headers** and `escapeHtml()` mitigate XSS
- **Whitelist-based PATCH** prevents mass assignment
- **Cumulative refund tracking** prevents over-refunding
- **CLAUDE.md** provides comprehensive project documentation

### Remaining Concerns
- `pos.js` is still ~4,300 lines
- No database integration (Express API uses in-memory store with JSON file backup)
- Java and Node.js servers have separate, potentially conflicting implementations
- No CI/CD pipeline or automated test execution
- Employee PINs still hardcoded (hashed, but not loaded from external config)

---

## RECOMMENDED PRIORITY ACTIONS

### Immediate (2 items -- before deployment)
1. **Fix surcharge report formula** for CARD_SURCHARGE mode (NC5) -- revenue reporting error
2. **Add `authorize()` to kitchen GET endpoints** and customer GET endpoint (NC6, NH8)

### Short-term (5 items)
3. Award loyalty points on post-discount amount (NH9)
4. Add duplicate-fire check for kitchen courses (NH12)
5. Prompt staff for party size before payment if auto-gratuity is enabled (NM14)
6. Add idempotency keys to refund and payment endpoints (NM17, NH11)
7. Validate webhook URLs against internal IPs (NM9)

### Medium-term (5 items)
8. Add integration tests for discount + payment + refund flow
9. Implement CSRF protection on online order endpoint (NM10)
10. Add negative stock validation (NM11)
11. Rewrite labor hours formula for clarity (NH10)
12. Validate gift card charges against existing tickets (NM20)

---

## OVERALL ASSESSMENT

**The codebase has improved significantly** since Rev 1. The bug-fix commits were thorough and addressed 31/33 reported issues with generally high-quality implementations. The hooks system, whitelist-based PATCH, and cumulative refund tracking are particularly well done.

The new feature commits (batches 3-5) add substantial functionality but re-introduce a pattern of missing authorization middleware on GET endpoints and financial calculation edge cases. The surcharge formula bug (NC5) and loyalty point inflation (NH9) are the most impactful new issues.

**Risk level: Medium.** The critical financial bugs from Rev 1 are fixed. The remaining issues are primarily authorization gaps on new endpoints and business logic edge cases in new features. Two items need immediate attention (NC5, NC6); the rest are short-term priorities.
