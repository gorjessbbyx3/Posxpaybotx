# POS System Audit Report

**Date**: 2026-03-05
**Scope**: Full system audit to identify gaps preventing production-ready operation
**Test Results**: 596/596 passing (after `npm install`)

---

## Executive Summary

The system has a **substantial and well-structured codebase** with 208 API endpoints, comprehensive frontend JS (~414KB), full test coverage (596 tests), and proper security patterns (JWT, CSP, CORS, field whitelisting). However, several critical gaps prevent it from operating as a fully functional production POS:

| Priority | Category | Issues |
|----------|----------|--------|
| **CRITICAL** | Architecture | Node.js API server missing from Docker deployment |
| **CRITICAL** | Payments | PaybotX terminal provider `_sendRequest()` throws — no real HTTP client |
| **CRITICAL** | Data | JSON file store is not production-grade (no concurrent access, no ACID) |
| **HIGH** | Deployment | Nginx proxies `/api/` to Java port 8080, not Node.js port 3000 |
| **HIGH** | Auth | Hardcoded employee PINs in `auth.js` — no admin UI to manage them |
| **HIGH** | Integration | Java backend and Node.js API are disconnected — two separate systems |
| **MEDIUM** | Frontend | Several admin panels not wired to API (inventory, recipes, POs, delivery) |
| **MEDIUM** | Realtime | No WebSocket/SSE — kitchen display relies on polling |
| **LOW** | Testing | No integration tests for Docker deployment |
| **LOW** | Monitoring | No health check endpoint in Docker healthcheck directive |

---

## Critical Issues (Must Fix)

### 1. Node.js API Server Missing from Docker Deployment

**Files**: `docker-compose.yml`, `Dockerfile`, `etc/nginx.conf`

The web frontend (`webapp/`) communicates with the Express API server on port 3000 (`webapp/api/server.js`). However:

- **`Dockerfile`** only runs the Java `PaybotXProxyServer` (line 56-59) — Node.js is never installed or started
- **`docker-compose.yml`** has no Node.js service definition
- **`nginx.conf`** proxies `/api/` to `http://pos:8080` (Java) instead of the Express server on port 3000

**Impact**: The entire web frontend is non-functional in Docker deployment. All 208 REST endpoints are unreachable.

**Fix needed**:
- Add a `webapp` service to `docker-compose.yml` that runs `node api/server.js`
- Update `nginx.conf` to proxy `/api/` to the Node.js service
- Or: add Node.js runtime to the existing Dockerfile and run both processes

### 2. PaybotX Terminal Provider Cannot Send Requests

**File**: `webapp/api/paybotx-provider.js`, lines 110-127

The `_sendRequest()` method unconditionally throws an error:
```javascript
throw new Error(
    `PaybotX terminal communication requires the Java proxy server. ...`
);
```

This means all card payment operations (sale, void, refund, pre-auth, tip adjust, batch settle) will fail when using the PaybotX provider. The system falls back to `InMemoryProvider` which simulates payments but never talks to a real terminal.

**Impact**: No real credit card processing is possible from the web frontend.

**Fix needed**: Implement actual HTTP/HTTPS request to the PaybotX proxy or Valor gateway using Node.js `https` module or `fetch()`.

### 3. JSON File Store is Not Production-Grade

**File**: `webapp/api/server.js`, lines 72-160

All data (tickets, orders, customers, inventory, etc.) is stored in a single JSON file (`webapp/data/store.json`, currently 68KB). Issues:

- **No concurrent access protection**: Multiple requests can cause write corruption
- **No ACID guarantees**: A crash mid-write loses data
- **No indexing**: Linear search through arrays for every query
- **Single file**: All data in one blob — grows unbounded
- **No backup rotation**: Manual backup endpoint exists but no scheduled backups

**Impact**: Data loss risk under load. Not suitable for a restaurant processing real orders.

**Fix needed**: Connect to MySQL/PostgreSQL (already configured in `docker-compose.yml` but unused by Node.js), or at minimum add file locking and atomic writes.

### 4. Nginx Routing Mismatch

**File**: `etc/nginx.conf`, line 11

```nginx
proxy_pass http://pos:8080/api/;
```

This routes to the Java backend (port 8080), but the web frontend's API is the Express server (port 3000). The Java `PaybotXProxyServer` on 8080 only handles terminal proxy requests — it doesn't serve the REST API the frontend expects.

**Impact**: Complete API routing failure in production deployment.

---

## High Priority Issues

### 5. Hardcoded Employee Database

**File**: `webapp/api/auth.js`

Employee PINs and roles are hardcoded in the auth module. While the API has `POST /api/employees` to add employees, the auth system reads from its internal list, not from the data store. New employees added via API cannot log in.

**Fix needed**: Auth should read employee data from the store (or database), not from a hardcoded array.

### 6. Java Backend and Node.js API Are Disconnected

The system has two independent backends:
1. **Java** (Hibernate + Derby/MySQL): Full POS with Swing UI, PaybotX integration, cash discount engine
2. **Node.js** (Express + JSON file): REST API for web frontend

These don't share data. A ticket created in the web UI doesn't exist in the Java backend, and vice versa. The cash discount configuration in Java (`CashDiscountConfig.java`) is separate from the Node.js config (`store.config.cashDiscount`).

**Fix needed**: Either:
- Make Node.js the sole backend (replace Java for web-only deployment), or
- Make Node.js proxy to Java backend APIs, or
- Use a shared database

### 7. No Real Receipt/Ticket Printing

The system generates HTML receipts in the browser but has no integration with actual receipt printers (ESC/POS protocol, Star, Epson). The hardware printer endpoints (`POST /api/hardware/printers`) store configuration but don't send print jobs.

**Fix needed**: Implement ESC/POS command generation and printer communication (via USB, network, or browser WebUSB API).

### 8. No Real Email Sending

**File**: `webapp/api/server.js` — email campaign endpoints

The email campaign and email report endpoints store records but don't actually send emails. No SMTP configuration, no email service integration (SendGrid, SES, etc.).

### 9. Missing HTTPS/TLS Configuration

**File**: `etc/nginx.conf`

Nginx listens on port 80 only. Port 443 is exposed in `docker-compose.yml` but there's no SSL configuration, no certificate path, no redirect from HTTP to HTTPS.

**Impact**: All data including JWT tokens and payment info transmitted in cleartext.

---

## Medium Priority Issues

### 10. Kitchen Display Has No Real-Time Push

The KDS (`webapp/js/pos-kitchen.js`) renders orders but relies on manual refresh or polling. There's no WebSocket or Server-Sent Events connection for real-time order updates. In a busy kitchen, this means delayed order visibility.

### 11. Several Admin Features Not Wired to UI

The API has full CRUD endpoints for these features, but the admin frontend (`admin.html`) doesn't have UI panels to manage them:
- **Inventory/ingredient management** — API exists, no admin UI
- **Recipe costing** — API exists, no admin UI
- **Purchase orders** — Full workflow API, no frontend
- **Vendor management** — API exists, no admin UI
- **Waste logging** — API exists, no admin UI
- **Delivery integrations** — API exists, basic config only
- **Plugin marketplace** — API exists, no UI
- **Multi-location management** — API exists, no UI
- **2FA setup** — API exists, no enrollment UI

### 12. No Webhook Delivery Implementation

**File**: `webapp/api/server.js`

The webhook system stores webhook registrations and has a `fireWebhook()` function, but it calls `fetch()` which may not be available in all Node.js 18 environments without the `--experimental-fetch` flag. No retry logic, no delivery logging, no failure handling.

### 13. Online/QR Ordering Has No Customer-Facing UI

The API endpoints for online ordering (`POST /api/online-orders`), QR ordering (`POST /api/qr-orders`), and scheduled orders exist and work. But there's no customer-facing HTML page for placing orders. The endpoints are designed to be called by a frontend that doesn't exist yet.

### 14. No Payment Terminal Device Management UI

Terminal configuration is done via XML files (`resources/paybotx-terminals.xml`). There's no web UI to add/configure/test payment terminals. The admin panel has a "Terminal Settings" section but it's display-only.

---

## Low Priority Issues

### 15. Service Worker Cache Strategy May Serve Stale Content

**File**: `webapp/sw.js`

The service worker caches static assets with a "network-first, cache-fallback" strategy, but the cache key is version-based. If the version isn't bumped on deploy, users may get stale JS/CSS.

### 16. No Rate Limiting

No rate limiting on any endpoint, including the login endpoint (`POST /api/auth/login`). PIN brute-force is possible since PINs are typically 4 digits (10,000 combinations).

### 17. No Graceful Shutdown

The Express server doesn't handle SIGTERM/SIGINT for graceful shutdown. In-flight requests and unsaved data could be lost on container restart.

### 18. Missing Docker Healthcheck

`docker-compose.yml` doesn't define healthcheck directives. The `GET /api/health` endpoint exists but isn't used for container orchestration health monitoring.

### 19. No Log Aggregation

Application logs go to stdout only. No structured logging, no log levels beyond console.log/warn/error, no integration with logging services.

### 20. No Database Migration Runner for Node.js

The `database/migrate.sh` script runs SQL migrations for the Java/Hibernate backend. The Node.js API uses a JSON file store and has no migration concept. If the store schema changes between versions, there's no upgrade path.

---

## What Works Well

Despite the gaps above, the system has strong foundations:

- **596 passing tests** covering calculations, auth, API endpoints, and payments
- **Comprehensive API design** — 208 well-structured REST endpoints with proper auth
- **Security-first approach** — JWT, CSP headers, CORS, field whitelisting, no plaintext PINs
- **Full calculation engine** — tax, cash discount/surcharge, dual pricing, split checks, loyalty, gift cards, inventory deduction, labor cost — all tested
- **Clean separation of concerns** — `calculations.js` is pure functions, `api-client.js` handles transport, `pos.js` handles UI
- **Offline-first PWA** — service worker with IndexedDB queue for offline writes
- **Complete KDS logic** — station routing, course firing, color-coded timers, expo view
- **Table management** — floor plans, merge/transfer, multi-area support
- **Loyalty program** — tier system, points multipliers, combo meals

---

## Recommended Fix Priority

### Phase 1: Make it deployable (Critical)
1. Add Node.js service to Docker deployment
2. Fix Nginx routing to proxy to Node.js API
3. Implement `_sendRequest()` in PaybotX provider (or document InMemoryProvider as demo mode)
4. Add atomic writes + file locking to JSON store (or connect to MySQL)

### Phase 2: Make it production-safe (High)
5. Move employee data to the store / database
6. Add HTTPS/TLS to Nginx
7. Add rate limiting on login endpoint
8. Implement graceful shutdown
9. Add Docker healthchecks

### Phase 3: Complete the feature set (Medium)
10. Add WebSocket/SSE for real-time kitchen display updates
11. Build admin UI panels for inventory, recipes, vendors, POs
12. Build customer-facing online/QR ordering pages
13. Implement real email sending (SMTP/SendGrid)
14. Implement ESC/POS receipt printing

### Phase 4: Operational maturity (Low)
15. Structured logging with levels
16. Store schema versioning/migration
17. Automated backup scheduling
18. Monitoring and alerting integration
