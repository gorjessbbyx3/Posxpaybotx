# Code Review: POS System Updates (Revision 5)

**Date:** 2026-02-19
**Scope:** 33 total commits. 5 new commits since Rev 4: `d8c959e` (8 bug fixes), `4024212` (incomplete impl fixes, 410 tests), `c25f0ae` (flesh out stubs, 449 tests), `0baf350` (connect features, 454 tests), `4dacb56` (safe IDs, audit logging)
**Files changed:** `server.js` (+1,864 lines), `api.test.js` (+886 lines), `auth.js`, `CLAUDE.md`

---

## Executive Summary

Five new commits directly address Rev 4 findings -- fleshing out stub implementations, adding real 2FA with TOTP, implementing actual backup file creation, making PCI SAQ dynamic, and expanding webhook events. **4 of 17 previously reported issues are now fully fixed, 4 are partially fixed, and 9 remain open.**

The most persistent issues (NC5 surcharge formula, NC6/NH8/NH13 missing auth on GET endpoints) are now flagged for the **4th consecutive review** without being addressed. These are the most straightforward fixes remaining.

### Revision 5 Totals

| Severity | Rev 4 | Rev 5 | Change | Notes |
|----------|-------|-------|--------|-------|
| **Critical** | 5 | 3 | -2 | 2FA fixed, PCI SAQ fixed; NC5 + NC9 + auth gaps persist |
| **High** | 10 | 7 | -3 | Backups fixed, webhooks fixed; auth gaps + delivery keys persist |
| **Medium** | 18 | 10 | -8 | Several stubs implemented; sync/inventory/loyalty still open |
| **Low** | 7 | 5 | -2 | ID generation mostly fixed, minor gaps remain |

---

## Issue Tracking: Full Status

### Fixed Since Rev 4 (4 issues)

| ID | Issue | Fix Quality |
|----|-------|-------------|
| NC8 | 2FA accepts any code | **Good** -- proper TOTP (RFC 4226) with HMAC-SHA1, +-30s window, failed attempt logging |
| NH15 | Backup doesn't save files | **Good** -- writes to `webapp/backups/`, supports AES-256-GCM encryption, logs metadata |
| NH17 | PCI SAQ hardcoded compliance | **Good** -- dynamically checks encryption, 2FA, CORS, audit logs, backup recency |
| NM22 | Webhook events incomplete | **Good** -- 11 events now supported including ticket.created/voided, order.ready, reservation.created |

### Partially Fixed (4 issues)

| ID | Issue | Status | Remaining Gap |
|----|-------|--------|---------------|
| NC7 | Token vault plaintext | Masked on GET | Full tokens still stored unencrypted in `store.json` at rest |
| NH11 | Partial payment race | Validation improved | No locking/idempotency key for concurrent requests |
| NH16 | Email campaign | Recipients tracked | No actual SMTP/SendGrid/SES integration; mock delivery only |
| NM21 | Sync only tickets | +config, +ingredients | Still missing: customers, gift cards, promo codes, refunds, held orders, timeclock |

### Still Open (9 issues) -- Severity Re-assessed

#### CRITICAL (flagged 4+ reviews)

**NC5. Surcharge report formula wrong for CARD_SURCHARGE mode**
**File:** `webapp/api/server.js:1097-1103`
```javascript
if (config.mode === 'CASH_DISCOUNT') {
    surcharge = (t.total || 0) * rate / (1 + rate);
} else {
    surcharge = (t.total || 0) * rate / (1 + rate);  // STILL IDENTICAL
}
```
**Fix (1 line):** Change line 1103 to `surcharge = (t.total || 0) * rate;`

#### HIGH (flagged 3+ reviews)

**NC6 + NH13. Missing `authorize()` on 8 GET endpoints**

| Endpoint | Fix |
|----------|-----|
| `GET /api/kitchen` | Add `authorize('kitchen')` |
| `GET /api/kitchen/station/:station` | Add `authorize('kitchen')` |
| `GET /api/kitchen/expo` | Add `authorize('kitchen')` |
| `GET /api/customers` | Add `authorize('reports')` |
| `GET /api/customers/:id` | Add `authorize('reports')` |
| `GET /api/held-orders` | Add `authorize('tickets')` |
| `GET /api/timeclock` | Add `authorize('timeclock')` |
| `GET /api/qr-orders` | Add `authorize('tickets')` |

**NC9. SSRF in webhook handler**
**File:** `webapp/api/server.js:272-293`
Webhook URLs not validated against private IPs. Fix: reject localhost, 10.x, 172.16.x, 192.168.x, 169.254.x before making request.

**NH14. Delivery API keys in plaintext**
**File:** `webapp/api/server.js:2914-2959`
API keys stored and returned unencrypted. Fix: encrypt at rest, mask in GET responses.

#### MEDIUM

**NH9. Loyalty points earned on arbitrary client-provided amount**
**File:** `webapp/api/server.js:1684-1705`
Fix: validate `amount` against actual ticket total from server store.

**NH12. Duplicate course firing**
**File:** `webapp/api/server.js:655-675`
Fix: check `order.courseFiredAt[courseToFire]` before firing.

**NM25. Inventory allows negative stock**
**File:** `webapp/api/server.js:2158-2186`
Fix: reject if `ingredient.stock + qty < 0`.

---

## NEW Issues from Fix Commits

### NI1. Unsafe ID generation in locations and KDS displays (Low)
**File:** `webapp/api/server.js:3447, 3617`

Commit 4dacb56 claims to fix all ID generation but missed two instances using `Math.max(...arr.map(x => x.id)) + 1`. These can produce ID collisions if records are deleted.

### NI2. No backup restore endpoint (Medium)
Backups are created but there is no `POST /api/backups/:id/restore` endpoint. Backups are write-only.

### NI3. Ticket PATCH with empty items leaves stale totals (Low)
**File:** `webapp/api/server.js:~407`

Clearing all items via PATCH doesn't recalculate totals because the condition `if (ticket.items && ticket.items.length > 0)` skips recalculation on empty arrays.

### NI4. 2FA re-setup overwrites previous secret without warning (Low)
Calling `POST /api/auth/2fa/setup` multiple times overwrites the stored secret. If a user runs setup but doesn't verify, they lose their existing 2FA.

---

## TEST SUITE (454 tests)

Tests grew from 385 to 454 (+69 new tests) covering the newly implemented features.

### Improvements
- 2FA tests verify actual TOTP rejection (not just success)
- Backup tests check file creation on disk
- PCI SAQ tests verify dynamic compliance scoring
- Webhook event tests cover new event types
- Recipe, vendor, and purchase order tests check financial math

### Remaining Gaps

| Scenario | Risk |
|----------|------|
| Surcharge CARD_SURCHARGE vs CASH_DISCOUNT mode | NC5 formula bug |
| Kitchen/customer GET without auth token | NC6/NH8 auth gaps |
| Concurrent partial payments | NH11 race condition |
| Loyalty points with inflated amount | NH9 point inflation |
| Webhook with private IP URL | NC9 SSRF |
| Backup restore flow | NI2 no endpoint |

---

## Progress Across All Revisions

| Review | Date | Issues Open | Issues Fixed | Net |
|--------|------|-------------|-------------|-----|
| Rev 1 | Feb 19 | 65 | 0 | 65 open |
| Rev 2 | Feb 19 | 84 | 0 | 84 open (+19 new) |
| Rev 3 | Feb 19 | 21 | 31 | 21 open (31 fixed, -42 net) |
| Rev 4 | Feb 19 | 40 | 0 | 40 open (+19 new from stubs) |
| Rev 5 | Feb 19 | **22** | 4+4 partial | **22 open** (8 resolved) |

### Trend
The core POS bugs (payment math, auth, XSS) are **fully resolved**. The remaining 22 issues are:
- 9 persistent (auth gaps, surcharge formula, SSRF, delivery keys, loyalty, course fire, inventory)
- 4 partially addressed (tokens, partial payments, email, sync)
- 4 new minor issues from fix commits
- 5 carried forward medium issues

---

## RECOMMENDED PRIORITY ACTIONS

### Immediate -- These are 1-line to 10-line fixes

1. **NC5: Fix surcharge formula** -- change 1 line: `surcharge = (t.total || 0) * rate;` for CARD_SURCHARGE mode
2. **NC6/NH8/NH13: Add authorize() to 8 GET endpoints** -- add middleware parameter to 8 route definitions
3. **NH12: Add course duplicate check** -- add `if (order.courseFiredAt?.[courseToFire]) return 400;` before firing

### Short-term

4. Validate webhook URLs against private IPs (NC9)
5. Encrypt delivery API keys at rest and mask in responses (NH14)
6. Validate loyalty earn amount against actual ticket total (NH9)
7. Reject negative inventory stock (NM25)
8. Add backup restore endpoint (NI2)

### Medium-term

9. Encrypt token vault at rest (NC7)
10. Add idempotency keys to partial payments (NH11)
11. Extend sync engine to all entity types (NM21)
12. Integrate actual email sending (NH16)

---

## OVERALL ASSESSMENT

**Significant progress.** The 5 fix commits demonstrate responsive development, particularly the 2FA TOTP implementation, real backup file creation, and dynamic PCI assessment. Test count grew from 385 to 454.

**However, the 3 most-reported issues remain unfixed after 4 reviews:**
1. NC5 (surcharge formula) -- a 1-line fix
2. NC6/NH8/NH13 (missing auth on GET endpoints) -- 8 one-line additions
3. NC9 (webhook SSRF) -- ~10-line URL validation

These are trivial fixes that would resolve the most persistent findings. The core POS is otherwise solid and approaching production readiness.

**Risk level: Medium.** Down from Medium-High in Rev 4. The stub features are now partially or fully implemented. Auth gaps on GET endpoints remain the most actionable concern.
