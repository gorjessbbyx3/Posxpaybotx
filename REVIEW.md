# Code Review: POS System — Deep Wiring Audit (Revision 8 - Fixes Applied)

**Date:** 2026-02-20
**Scope:** Full audit of all HTML, JS, CSS, and API files for disconnected buttons, dead endpoints, broken modals, incomplete views, and unwired features — **with all actionable fixes applied**
**Files audited:** `index.html`, `admin.html`, `customer-display.html`, `compliance-signage.html`, `pos.js`, `pos-core.js`, `pos-kitchen.js`, `pos-tables.js`, `pos-loyalty.js`, `pos-extras.js`, `api-client.js`, `calculations.js`, `server.js`, `auth.js`, `sw.js`

## Fixes Applied in Revision 8

| # | Fix | File(s) Modified |
|---|-----|-----------------|
| 1 | Removed 3 duplicate event listeners (`#btn-split`, `#menu-clock-in`, `#menu-open-drawer`) | `pos.js` |
| 2 | Wired split confirm to create actual split tickets with line items | `pos.js` |
| 3 | Wired report tabs (Hourly, Item Mix, Labor) to call `APIClient` + local fallback | `pos.js` |
| 4 | Wired `switchToView()` to call `populateReports()` and `populateTables()` on view switch | `pos.js` |
| 5 | Wired held orders (hold, recall, delete) to call `APIClient.holdOrder/recallHeldOrder` | `pos.js` |
| 6 | Wired gift card activate, reload, and charge to call `APIClient` | `pos.js` |
| 7 | Wired offline queue: flush on reconnect, SW message listener, online/offline toast | `pos.js` |
| 8 | Fixed 5 admin save buttons (terminal, tax, restaurant, receipt) to make real `PUT /api/config/*` calls | `admin.html` |
| 9 | Fixed admin test terminal to make real health check fetch instead of fake setTimeout | `admin.html` |
| 10 | Added 30+ new `APIClient` methods (customers, gift cards, promo codes, inventory, waitlist, reservations, online/QR orders, advanced reports, audit, fraud, partial pay, backups) | `api-client.js` |
| 11 | Wired waitlist add/seat to call `APIClient.addToWaitlist/updateWaitlistEntry` | `pos-extras.js` |
| 12 | Wired reservation create to call `APIClient.createReservation` | `pos-tables.js` |
| 13 | Added `compliance-signage.html` to service worker precache list | `sw.js` |

**Tests:** All 477 tests pass after changes.

---

---

## Executive Summary

The previous 6 revisions focused on correctness and security of the code that IS wired up. This audit examines what ISN'T wired up. The findings reveal a **massive frontend-backend disconnect**: only 15 of 177 API endpoints (~8.5%) are actually called from the frontend. Many features have backend endpoints and frontend UI elements that exist independently but are never connected.

### Findings by Category

| Category | Count | Severity |
|----------|-------|----------|
| Broken UI features (buttons/views that do nothing) | 12 | High |
| Backend endpoints with zero frontend callers | 147 | High |
| API client methods defined but never called | 14 | Medium |
| Admin panel buttons that only show toasts | 5 | High |
| Duplicate event listeners (last one wins) | 4 | Medium |
| Incomplete modals (open but can't complete workflow) | 5 | High |
| Dead code / unused data structures | 6 | Low |

---

## 1. BROKEN UI FEATURES

These are buttons, tabs, and views visible to the user that either do nothing or show empty content.

### 1.1 Check Split Button -- Shows Toast Only
**File:** `pos.js:837, 1133`
**Element:** `#btn-split`

Button is wired twice. First handler (line 837) shows `showToast('Split check feature', 'warning')`. Second handler (line 1133) defines `openSplitModal()` but the modal only shows an empty preview -- no actual split logic that creates separate tickets. The backend `POST /api/tickets/:id/seats` and `GET /api/tickets/:id/split-by-seat` endpoints exist but are never called.

### 1.2 Report Tabs -- Only Summary Works
**File:** `pos.js:1502+`, `index.html:301-389`

Four report tab panels exist in HTML: Summary, Hourly, Item Mix, Labor. Only Summary is populated with data. Clicking Hourly, Item Mix, Labor, or Refunds tabs switches the active CSS class but shows **empty panels**. The backend has 16 report endpoints; the APIClient has 4 report methods defined; none are called.

### 1.3 Floor Plan Tabs -- Dead Buttons
**File:** `pos-tables.js`, `index.html:214-219`

Four floor tabs exist: "Main Floor", "Patio", "Bar", "Private". No event listeners are wired to these buttons. The `activeFloor` variable exists but is never changed. All tabs appear clickable but do nothing.

### 1.4 Reservations Button -- Dead
**File:** `index.html:221`, `pos-tables.js`

`#btn-reservations` exists in the table management bar. A reservation modal exists in HTML (lines 957-1001). But no click handler connects the button to the modal. The backend has full reservation CRUD endpoints; none are wired to the UI.

### 1.5 EOD Close-Out Step Navigation -- Broken
**File:** `index.html:681-750`

The End-of-Day modal has a 3-step wizard (Review, Cash Count, Confirm) with `#eod-prev` and `#eod-next` buttons. **No event listeners exist** for step navigation. The wizard is stuck on step 1.

### 1.6 Gift Card Buttons -- Dead
**File:** `index.html:921-951`

Gift card modal has `#gc-lookup-btn` and `#gc-sell-btn` buttons, plus amount selection buttons ($25/$50/$75/$100). **No JavaScript handlers** exist for lookup or sell flows. The backend has 5 gift card endpoints; none are called.

### 1.7 Admin Terminal Save -- Toast Only
**File:** `admin.html:800`

`#btn-save-terminal` shows a success toast but **never makes an API call**. Terminal configuration edits are lost on page refresh.

### 1.8 Admin Tax Save -- Toast Only
**File:** `admin.html:815`

`#btn-save-tax` shows a success toast but never saves to the backend.

### 1.9 Admin Restaurant Save -- Toast Only
**File:** `admin.html:819`

`#btn-save-restaurant` shows a toast but never saves.

### 1.10 Admin Receipt Save -- Toast Only
**File:** `admin.html:823`

`#btn-save-receipt` shows a toast but never saves.

### 1.11 Admin Test Terminal -- Fake
**File:** `admin.html:804`

`#btn-test-terminal` uses `setTimeout` to simulate a test -- no actual terminal communication.

### 1.12 Allergen Tracking -- Data Only, No UI
**File:** `pos-extras.js:268+`

`ALLERGENS`, `DIETARY_FLAGS`, and `ITEM_ALLERGENS` data structures are defined. No modal, no buttons, no way to mark allergies on orders from the UI.

---

## 2. BACKEND-FRONTEND DISCONNECT

### 2.1 Only 15 of 177 Endpoints Are Called From Frontend

**Connected (15):**
```
POST /api/auth/login
POST /api/tickets
PATCH /api/tickets/:id
POST /api/tickets/:id/pay
POST /api/tickets/:id/void
POST /api/refunds
GET  /api/kitchen
POST /api/kitchen
POST /api/kitchen/:id/bump
GET  /api/timeclock
POST /api/timeclock/clock-in
POST /api/timeclock/clock-out
PUT  /api/config/cashdiscount  (admin.html only)
GET  /api/health
```

**Disconnected Feature Categories (162 endpoints):**

| Feature | Endpoints | Backend | Frontend UI | Wired |
|---------|-----------|---------|-------------|-------|
| Customer profiles | 7 | Full CRUD | Modal exists | **No** |
| Gift cards | 5 | Full CRUD + charge/reload | Modal + buttons exist | **No** |
| Loyalty program | 3 | Earn/redeem/history | Module exists | **No** |
| Reports | 16 | All report types | Tabs exist | **No** |
| Promo codes | 5 | Full CRUD + validate | -- | **No** |
| Online orders | 4 | Create/accept/reject | -- | **No** |
| QR orders | 4 | Create/accept/reject/complete | -- | **No** |
| Scheduled orders | 4 | Create/confirm/cancel/fulfill | -- | **No** |
| Inventory/ingredients | 6+ | CRUD + adjust + alerts | -- | **No** |
| Recipes | 4 | Full CRUD | -- | **No** |
| Vendors | 4 | Full CRUD | -- | **No** |
| Purchase orders | 5 | CRUD + workflow | -- | **No** |
| Delivery integrations | 3 | CRUD + test | -- | **No** |
| Webhooks | 3 | CRUD | -- | **No** |
| Hardware/printers | 8+ | Discovery/config/KDS | -- | **No** |
| Security/compliance | 6+ | Encryption/PCI/2FA | -- | **No** |
| Sync engine | 3 | Snapshot/push/resync | -- | **No** |
| Backups | 3 | Create/list/restore | -- | **No** |
| Merchants | 4 | Multi-tenant CRUD | -- | **No** |
| Locations | 4 | Multi-location CRUD | -- | **No** |
| Feature toggles | 2 | GET/PUT | -- | **No** |
| Branding | 2 | GET/PUT | -- | **No** |
| Plugins | 4 | Marketplace CRUD | -- | **No** |
| Audit log | 1 | GET | Side menu item | **No** |
| Fraud alerts | 2 | GET + resolve | -- | **No** |
| Waste log | 2 | GET/POST | -- | **No** |
| Waitlist | 3 | GET/POST/PATCH | Modal exists | **No** |
| Email campaigns | 3 | CRUD + send | -- | **No** |
| Saved payments | 2 | GET/POST | -- | **No** |
| Token vault | 2 | GET/POST | -- | **No** |
| Held orders | 3 | GET/POST/DELETE | Hold button exists | **Partial** (local only) |
| Partial payments | 1 | POST | -- | **No** |
| Seats/split-by-seat | 2 | POST/GET | Split button exists | **No** |
| Curbside | 2 | GET/POST arrival | -- | **No** |
| Ticket receipt | 1 | GET | -- | **No** |
| Remote void | 1 | POST | -- | **No** |
| Void requests | 3 | GET + approve/reject | Modal exists | **No** |

### 2.2 APIClient Methods Defined But Never Called (14)

```javascript
getTickets(filters)      // Defined line 78, never called
getTicket(id)            // Defined line 87, never called
getRefunds()             // Defined line 117, never called
getHeldOrders()          // Defined line 138, never called
holdOrder(order)         // Defined line 145, never called
recallHeldOrder(index)   // Defined line 152, never called
getConfig(section)       // Defined line 176, never called
updateConfig(section)    // Defined line 183, never called
getReportSummary()       // Defined line 195, never called
getReportHourly()        // Defined line 202, never called
getReportItemMix()       // Defined line 209, never called
getReportLabor()         // Defined line 216, never called
healthCheck()            // Defined line 223, never called
flushOfflineQueue()      // Defined line 260, never called
```

---

## 3. INCOMPLETE MODALS AND WORKFLOWS

### 3.1 Void Workflow -- Modal Chain Unclear
- Void reason modal (`#void-reason-modal`, line 1036) and void approval modal (`#void-approval-modal`, line 1062) exist in HTML
- `voidTicket()` in pos.js does NOT explicitly trigger the void reason modal first
- The void approval PIN input exists but the approval flow may not chain correctly

### 3.2 Waitlist Modal -- Partially Wired
- Modal HTML exists (lines 1004-1033)
- `openWaitlistModal()` exists in pos-extras.js
- `#btn-waitlist` handler exists but integration between button, modal, and form submission is fragile

### 3.3 Gift Card Modal -- Empty Shell
- Modal HTML exists (lines 913-955) with lookup input, balance display, sell buttons
- No JavaScript implements the lookup, activate, or charge workflows

### 3.4 Customer Tab Modal -- Partially Wired
- Modal HTML exists (lines 879-910)
- pos.js has tab functions but they operate on in-memory state only
- Backend customer endpoints are never called

### 3.5 Reservation Modal -- Unreachable
- Modal HTML exists (lines 957-1001) with date/time/party-size/notes inputs
- No button click handler opens this modal
- Backend reservation CRUD endpoints exist but are unused

---

## 4. DUPLICATE EVENT LISTENERS

| Element | First Wiring | Second Wiring | Impact |
|---------|-------------|---------------|--------|
| `#menu-clock-in` | pos.js:2635 | pos.js:2754 | Only second handler fires |
| `#menu-open-drawer` | pos.js:2647 | pos.js:2883 | Only second handler fires |
| `#btn-split` | pos.js:837 (toast) | pos.js:1133 (modal) | Only second handler fires |
| Report tabs | pos.js:1678 | pos.js (later redefinition) | Potential double-fire |

---

## 5. SERVICE WORKER GAPS

### 5.1 compliance-signage.html Not Cached
`compliance-signage.html` is linked from the side menu but not listed in the precache manifest. It won't be available offline.

### 5.2 api-client.js May Not Be Cached
Verify that `api-client.js` is in the `ASSETS_TO_CACHE` array since it handles offline queueing.

---

## 6. ADMIN.HTML SUMMARY

| Button | Element ID | Makes API Call | Actually Saves |
|--------|-----------|---------------|----------------|
| Save Cash Discount | `#btn-save-cd` | `PUT /api/config/cashdiscount` | **Yes** |
| Save Terminal | `#btn-save-terminal` | None | **No** -- toast only |
| Test Terminal | `#btn-test-terminal` | None | **No** -- fake setTimeout |
| Save Tax | `#btn-save-tax` | None | **No** -- toast only |
| Save Restaurant | `#btn-save-restaurant` | None | **No** -- toast only |
| Save Receipt | `#btn-save-receipt` | None | **No** -- toast only |

Only 1 of 6 admin save operations actually persists to the backend.

---

## RECOMMENDED PRIORITY ACTIONS

### Tier 1 -- Core POS Features That Should Work (High Priority)

1. **Wire split check to backend** -- Call `POST /api/tickets/:id/seats` and `GET /api/tickets/:id/split-by-seat` from `openSplitModal()`
2. **Wire report tabs to backend** -- Call `APIClient.getReportSummary()`, `getReportHourly()`, `getReportItemMix()`, `getReportLabor()` from report tab click handlers
3. **Wire held orders to backend** -- Call `APIClient.holdOrder()`, `getHeldOrders()`, `recallHeldOrder()` instead of local-only state
4. **Fix EOD step navigation** -- Add event listeners to `#eod-prev`/`#eod-next` for step transitions
5. **Wire admin save buttons** -- Make all 5 dead save buttons call `PUT /api/config/:section`
6. **Wire gift card modal** -- Connect `#gc-lookup-btn` to `GET /api/gift-cards/:number` and `#gc-sell-btn` to `POST /api/gift-cards`

### Tier 2 -- Restaurant Operations Features (Medium Priority)

7. **Wire floor plan tabs** -- Add click handlers to switch `activeFloor` and re-render tables
8. **Wire reservations button** -- Connect `#btn-reservations` to reservation modal open
9. **Wire waitlist fully** -- Ensure `#btn-waitlist` → modal → `POST /api/waitlist` flow works
10. **Wire customer profiles** -- Connect customer modal to `GET/POST /api/customers`
11. **Wire void reason workflow** -- Ensure void → reason modal → approval modal → `POST /api/tickets/:id/void` chain works
12. **Wire loyalty module to API** -- Call `/api/customers/:id/loyalty/earn` and `/redeem` from pos-loyalty.js

### Tier 3 -- Advanced Features (Lower Priority)

13. Wire inventory/ingredients to API
14. Wire promo codes to API
15. Wire online/QR ordering to API
16. Wire delivery integrations to API
17. Wire security/compliance endpoints to admin UI
18. Wire backup/restore to admin UI
19. Implement allergen UI or remove dead data structures
20. Add `compliance-signage.html` to service worker precache

---

## METRICS

| Metric | Value |
|--------|-------|
| Total API endpoints | 177 |
| Endpoints connected to frontend | 15 (8.5%) |
| Endpoints with no frontend caller | 162 (91.5%) |
| APIClient methods defined | 27 |
| APIClient methods actually used | 13 (48%) |
| HTML buttons/interactive elements | 180+ |
| Broken/dead UI elements | 12 |
| Admin save buttons that work | 1 of 6 |
| Report tabs that show data | 1 of 5 |
| Modals with incomplete workflows | 5 |
| Test count | 477 passing |
