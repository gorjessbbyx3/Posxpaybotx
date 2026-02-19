# Code Review: POS System Updates (Revision 4)

**Date:** 2026-02-19
**Scope:** 28 total commits including commit `84b88a2` ("batches 6-11 -- complete all 42 remaining roadmap items"), which adds 6,267 lines across server.js and api.test.js
**Files reviewed:** `server.js` (3,174 lines), `api.test.js` (5,082+ lines), `auth.js`, `calculations.test.js`, `CLAUDE.md`

---

## Executive Summary

Commit 84b88a2 claims to complete all 123 roadmap items with 385 passing tests. In reality, **many "completed" features are HTTP stubs** that return success responses without implementing actual business logic. The most concerning are 2FA (accepts any code), encryption (returns hardcoded status), backups (logs metadata without saving files), and email campaigns (marks "sent" without sending).

The 6 issues flagged in Rev 3 (**NC5, NC6, NH8, NH9, NH11, NH12**) are **all still unfixed**.

New critical issues include plaintext token storage (PCI violation), SSRF in webhooks, and stub features that create false security confidence.

### Revision 4 Totals

| Severity | Rev 3 | Rev 4 | Change | Notes |
|----------|-------|-------|--------|-------|
| **Critical** | 2 | 5 | +3 | Token vault PCI, 2FA stub, SSRF (plus NC5 and NC6 still open) |
| **High** | 5 | 10 | +5 | More missing auth, partial payment race, stubs advertised as features |
| **Medium** | 12 | 18 | +6 | Sync engine incomplete, backup stub, webhook event mismatch |
| **Low** | 5 | 7 | +2 | Feature toggle validation, diagnostics exposure |

---

## Status of Rev 3 Issues -- ALL STILL OPEN

| ID | Issue | Status |
|----|-------|--------|
| NC5 | Surcharge report formula wrong for CARD_SURCHARGE mode | **NOT FIXED** -- both modes still use `total * rate / (1 + rate)` |
| NC6 | Kitchen GET endpoints lack authorization | **NOT FIXED** -- `GET /api/kitchen` still has no `authorize()` |
| NH8 | Customer data endpoint no authorization | **NOT FIXED** -- `GET /api/customers` still unprotected |
| NH9 | Loyalty points on pre-discount subtotal | **NOT FIXED** -- still trusts client-provided amount |
| NH11 | Partial payments race condition | **NOT FIXED** -- no locking mechanism |
| NH12 | Duplicate course firing | **NOT FIXED** -- no duplicate check before push |

---

## NEW CRITICAL ISSUES

### NC7. Token vault stores card data in plaintext
**File:** `webapp/api/server.js:2553-2569`

Card tokens are stored unencrypted in `store.json`. While the GET endpoint masks tokens on retrieval, the data at rest is plaintext. This is a **PCI DSS violation** (Requirement 3: protect stored cardholder data).

Combined with the backup endpoint (which serializes the entire store), card tokens could be exposed through backup files.

### NC8. 2FA verification accepts any code
**File:** `webapp/api/server.js:2667-2671`

```javascript
app.post('/api/auth/2fa/verify', authorize('config'), (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Verification code required' });
    res.json({ verified: true, message: '2FA enabled successfully' });  // Always true
});
```

No TOTP validation, no secret key comparison, no time-based check. Any 6-digit code "verifies" 2FA. CLAUDE.md marks this as "[x] DONE" which is misleading.

### NC9. SSRF vulnerability in webhook handler
**File:** `webapp/api/server.js:244-265`

Webhook URLs are not validated against internal/private IP ranges. An admin could register `http://169.254.169.254/latest/meta-data/` (AWS metadata) or `http://localhost:3000/api/...` as a webhook target.

---

## NEW HIGH ISSUES

### NH13. Additional endpoints missing authorization

These GET endpoints have **no `authorize()` middleware**, exposing data to any authenticated user:

| Endpoint | Line | Data Exposed |
|----------|------|-------------|
| `GET /api/held-orders` | 614 | All held orders |
| `GET /api/timeclock` | 648 | All employee clock records |
| `GET /api/kitchen/station/:station` | 563 | Kitchen station orders |
| `GET /api/kitchen/expo` | 1465 | Expo screen data |
| `GET /api/customers/:id` | 1176 | Individual customer details |
| `GET /api/qr-orders` | 2510 | QR orders (no auth at all) |

### NH14. Delivery integration API keys stored in plaintext
**File:** `webapp/api/server.js:2537-2547`

DoorDash, Uber Eats, and other delivery platform API keys are stored unencrypted in `store.json`:
```javascript
apiKey: apiKey || '',  // Plaintext in JSON file
```

### NH15. Backup endpoint doesn't actually create backups
**File:** `webapp/api/server.js:2641-2652`

The endpoint logs metadata and returns `status: 'completed'` but **never writes a file to disk**. Operators may believe they have working backups when they don't.

### NH16. Email campaign endpoint marks "sent" without sending
**File:** `webapp/api/server.js:2497-2504`

Sets `campaign.status = 'sent'` without any SMTP/email service integration. Marketing campaigns appear sent when they aren't.

### NH17. PCI SAQ endpoint returns false compliance claims
**File:** `webapp/api/server.js:2697-2714`

Returns hardcoded `status: 'compliant'` for all PCI requirements, including "Protect stored cardholder data" -- while the system stores tokens in plaintext (NC7).

---

## NEW MEDIUM ISSUES

### NM21. Sync engine only handles tickets
**File:** `webapp/api/server.js:2973-2996`

The `/api/sync/push` endpoint only processes `type === 'ticket'` changes. Inventory, kitchen orders, customer data, and configuration changes are silently ignored. Multi-terminal setups will have inconsistent non-ticket data.

### NM22. Webhook events list incomplete
**File:** `webapp/api/server.js:2242-2273`

The `WEBHOOK_EVENTS` whitelist only includes 4 events, but the server fires 7+ event types. Webhook subscribers can't register for `email_campaign.sent`, `order.ready`, `qr_order.created`, `purchase_order.created`, or `ticket.voided`.

### NM23. Encryption status endpoint is hardcoded
**File:** `webapp/api/server.js:2676-2682`

Returns `algorithm: 'AES-256-GCM'` and `keyRotationDays: 90` regardless of actual encryption state (which is none).

### NM24. QR orders lack CSRF and rate limiting
**File:** `webapp/api/server.js:2510-2527`

Public POST endpoint for creating QR orders has no protection against automated abuse.

### NM25. Inventory allows negative stock
**File:** `webapp/api/server.js:1979-2006`

Stock adjustments can set values below zero without validation. (Carried forward from NM11.)

### NM26. Rounding inconsistency in QR order totals
**File:** `webapp/api/server.js:2517`

QR orders round per-item before summing, while purchase orders round per-item then sum. Different rounding strategies cause cent discrepancies between systems.

---

## TEST SUITE ASSESSMENT (385 tests)

### Auth Tests -- Solid
- Backdoor removal properly tested (rejects role-name login)
- Token expiry and signature validation tested
- Role-based permissions tested across all 6 roles

### Financial Tests -- Partially Hollow
- Calculation functions (tax, discount, split, rounding) well tested with exact values
- But many batch 6-11 tests only check `typeof x === 'number'` instead of verifying correct math
- Recipe cost test checks exact values (good): `assert.equal(res.body.totalCost, 1.25)`
- Surcharge report test doesn't distinguish between CASH_DISCOUNT and CARD_SURCHARGE modes

### Stub Feature Tests -- Meaningless
These tests always pass because the underlying implementations are stubs:

| Test | What It Tests | Why It's Hollow |
|------|--------------|----------------|
| 2FA verify | Sends code, checks `verified: true` | Endpoint accepts ANY code |
| Encryption status | Checks response shape | Response is hardcoded |
| Backup creation | Checks `status: 'completed'` | No file is actually written |
| Email send | Checks `status: 'sent'` | No email is actually sent |
| PCI compliance | Checks all items `compliant` | All values are hardcoded |

### Missing Test Coverage

| Scenario | Risk |
|----------|------|
| Surcharge CARD_SURCHARGE vs CASH_DISCOUNT mode | NC5 -- formula bug |
| Concurrent partial payments | NH11 -- race condition |
| Loyalty points with active discount | NH9 -- point inflation |
| Course double-fire prevention | NH12 -- kitchen confusion |
| Token vault PCI compliance | NC7 -- plaintext storage |
| Webhook URL validation | NC9 -- SSRF |

---

## ROADMAP ACCURACY

CLAUDE.md now claims 123/123 items complete (100%). In reality:

| Feature | CLAUDE.md Status | Actual Status |
|---------|-----------------|---------------|
| 2FA for managers | [x] Done | Stub -- accepts any code |
| Encrypted database | [x] Done | Stub -- hardcoded response |
| Backup automation | [x] Done | Stub -- no files saved |
| Email marketing | [x] Done | Stub -- no emails sent |
| PCI SAQ documentation | [x] Done | Hardcoded false compliance |
| Cloud-hosted reporting | [x] Done | Local endpoint, not cloud |
| Multi-location dashboard | [x] Done | Single-store with multi-location field |
| Remote diagnostics | [x] Done | Basic process.memoryUsage() |
| Automated updates | [x] Done | Stub |
| White-labeling | [x] Done | CSS config only, no build system |
| App marketplace | [x] Done | CRUD for plugin metadata, no execution |
| Sync conflict resolution | [x] Done | Only handles tickets, server-always-wins |

**Realistic completion: ~85/123 items (69%)** -- the remaining ~38 are stubs or minimal implementations.

---

## RECOMMENDED PRIORITY ACTIONS

### Immediate (5 items -- before any deployment)
1. **Fix surcharge report formula** for CARD_SURCHARGE mode (NC5) -- 4th review flagging this
2. **Add `authorize()` to all unprotected GET endpoints** (NC6, NH8, NH13) -- 3rd review flagging this
3. **Remove or clearly mark stub features** (2FA, encryption, backup, email) -- false security
4. **Fix PCI SAQ endpoint** to accurately reflect compliance gaps (NH17)
5. **Encrypt or remove token vault** (NC7) -- PCI violation

### Short-term (5 items)
6. Implement actual 2FA with TOTP library (NC8)
7. Validate webhook URLs against private IP ranges (NC9)
8. Fix loyalty points to use post-discount amount (NH9)
9. Add duplicate-fire check for kitchen courses (NH12)
10. Add locking/idempotency to partial payments (NH11)

### Medium-term (5 items)
11. Encrypt delivery integration API keys (NH14)
12. Implement actual backup file creation (NH15)
13. Extend sync engine beyond tickets (NM21)
14. Add integration tests for critical financial flows
15. Update CLAUDE.md roadmap to accurately reflect stub vs implemented status

---

## OVERALL ASSESSMENT

**The codebase has two distinct quality tiers:**

**Tier 1 (High Quality):** The core POS features from the original 10 commits + 4 bug fixes are solid. Payment processing, cash discount engine, kitchen display, ticket management, authentication, and the calculation library are well-implemented with proper rounding, XSS protection, auth, and test coverage.

**Tier 2 (Stubs):** The batch 6-11 features are largely HTTP endpoint shells that return success responses without implementing actual business logic. 2FA, encryption, backups, email campaigns, cloud sync, and several other features exist as API contracts only.

**Risk level: Medium-High.** The core POS is production-ready after fixing the 6 persistent issues (NC5, NC6, NH8, NH9, NH11, NH12). The stub features must either be implemented or removed -- leaving them in place creates false security confidence and misleading compliance claims.
