# CLAUDE.md — Posxpaybotx (Restaurant POS)

## Project Overview

Self-hosted restaurant Point-of-Sale system built on [Floreant POS](https://floreant.org) (Java), enhanced with a **cash discount / card surcharge engine**, **PaybotX/Valor terminal integration**, and a **modern touch-optimized web frontend**. Targets small-to-medium restaurants needing compliance-friendly dual pricing and modern payment terminal support.

**Version**: 1.4-SNAPSHOT
**License**: MRPL 1.2 (Modified Mozilla Public License)
**Upstream**: [fat-tire/floreantpos](https://github.com/fat-tire/floreantpos)

---

## Repository Structure

```
Posxpaybotx/
├── src/com/floreantpos/           # Java backend (~925 files)
│   ├── cashdiscount/              # Cash discount/surcharge engine (4 files)
│   ├── paybotx/                   # PaybotX/Valor terminal integration (5+ files)
│   │   ├── config/                # Terminal configuration management
│   │   └── proxy/                 # HTTP REST API proxy server
│   ├── dejavoo/                   # Legacy Dejavoo terminal support
│   ├── model/                     # Data models (Ticket, PosTransaction, User, etc.)
│   ├── dal/                       # Data access layer (Hibernate ORM)
│   ├── ui/                        # Java Swing desktop UI (legacy)
│   ├── bo/                        # Back-office operations
│   ├── services/                  # Business logic services
│   ├── config/                    # Application configuration
│   ├── report/                    # Reporting engine (JasperReports)
│   ├── main/                      # Application entry points
│   └── extension/                 # Plugin framework
├── webapp/                        # Modern web frontend (Node.js + vanilla JS)
│   ├── index.html                 # Main POS interface
│   ├── admin.html                 # Admin/back-office interface
│   ├── compliance-signage.html    # Cash discount compliance sign generator
│   ├── customer-display.html      # Customer-facing display
│   ├── js/                        # JavaScript application modules
│   │   ├── pos.js                 # Main POS application (~165KB)
│   │   ├── pos-core.js            # Core POS functionality
│   │   ├── pos-extras.js          # Extended features
│   │   ├── pos-kitchen.js         # Kitchen display system (KDS)
│   │   ├── pos-tables.js          # Table management
│   │   ├── pos-loyalty.js         # Loyalty program
│   │   ├── calculations.js        # Pricing/discount/tax calculations
│   │   └── api-client.js          # API communication
│   ├── css/                       # Styles with dark mode support
│   ├── api/                       # Node.js Express API server
│   │   ├── server.js              # Express REST API (main server)
│   │   └── auth.js                # JWT authentication & role-based authorization
│   ├── tests/                     # Test suite
│   │   ├── calculations.test.js   # Pricing/tax/discount calculations
│   │   ├── auth.test.js           # Authentication & role-based access
│   │   ├── api.test.js            # REST API endpoint tests
│   │   └── extras.test.js         # Extended features
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker (offline support)
│   └── package.json               # Node.js dependencies
├── database/                      # Database migrations
│   ├── migrate.sql                # Schema version tracking
│   ├── migration-cashdiscount-paybotx.sql  # Cash discount + PaybotX tables
│   ├── migration-002-refunds-timeclock-held.sql
│   ├── migration-003-giftcards-tabs-inventory.sql
│   ├── migrate.sh                 # Migration runner
│   └── derby-server/              # Embedded Derby database (posdb.zip)
├── resources/                     # Configuration resources
│   ├── paybotx-terminals.xml      # Terminal device configuration
│   ├── hibernate.cfg.xml.*        # ORM configs per DB type
│   └── log4j.properties           # Logging config
├── config/                        # POS runtime configuration & assets
├── i18n/                          # Internationalization (EN, DE, ES, AR, NL)
├── local-lib/                     # Local Maven dependencies (not in Central)
├── profiles/                      # Maven build profiles (default, devinepos)
├── images/                        # UI icon/asset PNGs (~58 files)
├── etc/                           # Platform binaries, nginx.conf, jpos.xml
├── plugins/                       # Plugin directory (extensible framework)
├── docker-compose.yml             # Multi-container orchestration (pos, db, nginx)
├── Dockerfile                     # Multi-stage container build
├── pom.xml                        # Maven build (Java 17, 46 dependencies)
├── setup.sh                       # Interactive setup script
├── .env.example                   # Environment variable template
└── README.md                      # Project documentation
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Java Backend** | Java 17+, Hibernate 3.2.6, Maven 3.6+ | Core POS, payment processing, ORM |
| **Web Frontend** | HTML5, CSS3, vanilla JavaScript | Touch-optimized, no framework |
| **Web API** | Node.js 18+, Express 4.18 | Lightweight REST server with JWT auth |
| **Database** | Derby (embedded), MySQL 8.0, PostgreSQL 9.5+ | Multi-DB support |
| **Reporting** | JasperReports 4.0.1 | Receipts and reports |
| **Containerization** | Docker, Docker Compose, Nginx (Alpine) | Production deployment |
| **Testing** | Node.js native test runner (`node --test`) | No external test framework |

---

## Build & Run Commands

### Java Backend (Maven)

```bash
# Build (skip tests — Java tests are sparse)
mvn package -DskipTests

# Run full POS application (Swing UI)
java -cp target/classes:local-lib/* com.floreantpos.main.Application

# Run PaybotX Proxy API only
java -cp target/classes:local-lib/* com.floreantpos.paybotx.proxy.PaybotXProxyServer

# Run Dejavoo Proxy (legacy)
java -cp target/classes:local-lib/* com.floreantpos.dejavoo.proxy.DejavooProxyServer

# Clean
mvn clean
```

### Web Frontend (Node.js)

```bash
cd webapp

# Install dependencies
npm install

# Start API server (port 3000)
npm start

# Run all tests
npm test

# Run specific test suites
npm run test:calculations
npm run test:auth
npm run test:api
```

### Docker

```bash
# Start all services (pos on 8080, db on 3306, nginx on 80)
docker-compose up -d

# View logs
docker-compose logs -f pos

# Stop
docker-compose down
```

### Setup Script

```bash
./setup.sh    # Interactive: checks JDK/Maven, installs local deps, configures terminals
```

---

## Testing

Tests live in `webapp/tests/` and use the **Node.js native test runner** (no external framework).

| Test File | What It Covers |
|-----------|---------------|
| `calculations.test.js` | Pricing, tax, cash discount/surcharge math, dual pricing, loyalty, gift cards, inventory, split checks, labor cost |
| `auth.test.js` | Employee PIN login, JWT tokens, role-based access control |
| `api.test.js` | REST endpoints: tickets, kitchen, payments, config, refunds, void, timeclock |
| `extras.test.js` | Extended features (not included in default `npm test` — run separately) |

**Run tests:**
```bash
cd webapp && npm test              # Runs calculations, auth, and api tests (454 tests)
node --test tests/extras.test.js   # Run extras tests separately
```

There is no Java-side test suite of note. Focus testing effort on the Node.js API layer.

---

## Key Architectural Concepts

### Two Frontends

1. **Java Swing UI** (legacy) — desktop app, launched via `com.floreantpos.main.Application`
2. **Web UI** (modern) — `webapp/index.html`, served by Nginx or Express, talks to REST API

The web frontend is the primary development focus going forward.

### Plugin Architecture

Floreant uses a plugin framework. PaybotX is implemented as a `PaymentGatewayPlugin`:
```
PaybotXGatewayPlugin (extends PaymentGatewayPlugin)
  └── PaybotXProcessor (implements CardProcessor)
       ├── chargeAmount()     → Sale
       ├── preAuth()          → Pre-authorization (bar tabs)
       ├── captureAuthAmount()→ Capture
       ├── voidTransaction()  → Void
       └── adjustTips()       → Tip adjustment
```

### Data Flow

```
Browser → Nginx (port 80) → Express API (port 3000) or PaybotX Proxy (port 8080)
                                    ↓
                            JSON file store (webapp/data/store.json)
                            OR Hibernate ORM → Derby/MySQL/PostgreSQL
```

The Express API server persists data to a JSON file (`webapp/data/store.json`) with auto-save. The Java backend uses Hibernate ORM with Derby/MySQL/PostgreSQL.

### Authentication & Authorization

- **Method**: JWT-based (POST `/api/auth/login` with employee PIN)
- **Roles**: `admin`, `manager`, `server`, `cashier`, `bartender`, `kitchen`
- **Permissions**: `tickets`, `void`, `refund`, `kitchen`, `timeclock`, `config`, `reports`
- Admin and manager roles have all permissions
- Server, cashier, and bartender can create tickets and use timeclock only
- Kitchen role can only access kitchen and timeclock
- PINs are stored as pre-hashed values (no plaintext) in `webapp/api/auth.js`
- Auth middleware in `webapp/api/auth.js`

---

## Key Feature Modules

### Cash Discount Engine (`src/com/floreantpos/cashdiscount/`)

Two modes:
- **CASH_DISCOUNT**: Menu prices = card prices; cash customers get a discount
- **CARD_SURCHARGE**: Menu prices = cash prices; card customers pay a surcharge

Key files:
- `CashDiscountConfig.java` — configuration (rate, mode, labels, thresholds)
- `CashDiscountCalculator.java` — pricing math
- `CashDiscountService.java` — integration with Ticket model
- `CashDiscountConfigView.java` — back-office config UI

Web-side calculation logic is in `webapp/js/calculations.js`.

### PaybotX Terminal Integration (`src/com/floreantpos/paybotx/`)

Supports Valor (VP8800, VX520, VX680, etc.), PAX (A920, A80, S300), and Ingenico terminals via cloud (`https://vt.isoaccess.com`) or LAN modes.

Key files:
- `PaybotXGatewayPlugin.java` — plugin registration
- `PaybotXProcessor.java` — CardProcessor (sale, pre-auth, capture, void, tip adjust)
- `PaybotXTerminal.java` — terminal device model
- `OfflinePaymentQueue.java` — store-and-forward for connectivity issues
- `BatchSettlementService.java` — automatic end-of-day batch settlement
- `proxy/PaybotXProxyServer.java` — HTTP REST API (port 8080)

### Kitchen Display System

- Backend: `webapp/api/server.js` (kitchen endpoints)
- Frontend: `webapp/js/pos-kitchen.js`
- Features: real-time orders, station filtering, bump-bar, timers, color-coded status

### Web API Server (`webapp/api/server.js`)

Express REST API with these endpoint groups:

| Group | Endpoints | Auth Required |
|-------|-----------|---------------|
| Auth | `POST /api/auth/login` | No (login endpoint) |
| Tickets | `GET/POST/PATCH /api/tickets`, `/api/tickets/:id/pay`, `/api/tickets/:id/void` | Yes |
| Tickets | `POST /api/tickets/:id/seats`, `GET /api/tickets/:id/split-by-seat` | Yes |
| Tickets | `GET /api/tickets/:id/receipt` | No (digital receipt) |
| Tickets | `POST /api/tickets/:id/curbside-arrival` | Yes |
| Kitchen | `GET/POST /api/kitchen`, `/api/kitchen/:id/bump`, `/api/kitchen/:id/fire-course` | Yes |
| Kitchen | `GET /api/kitchen/station/:station`, `GET /api/kitchen/expo` | Yes |
| Kitchen | `POST /api/kitchen/:id/pickup` | Yes |
| Refunds | `GET/POST /api/refunds` | Yes (refund permission) |
| Held Orders | `GET/POST/DELETE /api/held-orders` | Yes |
| Time Clock | `GET /api/timeclock`, clock-in/clock-out | Yes |
| Customers | `GET/POST/PATCH/DELETE /api/customers` | Yes |
| Customers | `GET/POST /api/customers/:id/loyalty`, earn/redeem | Yes |
| Gift Cards | `GET/POST /api/gift-cards`, charge/reload | Yes |
| Promo Codes | `GET/POST/DELETE /api/promo-codes`, validate/redeem | Yes (config to manage) |
| Online Orders | `POST /api/online-orders` | No (customer-facing) |
| Online Orders | `GET /api/online-orders`, accept/reject | Yes |
| Scheduled | `POST /api/scheduled-orders` | No (customer-facing) |
| Scheduled | `GET /api/scheduled-orders`, confirm/cancel | Yes |
| Curbside | `GET /api/curbside` | Yes |
| Ingredients | `GET/POST/PATCH/DELETE /api/ingredients`, adjust | Yes (config permission) |
| Inventory | `GET /api/inventory-movements`, `GET /api/alerts/low-stock` | Yes |
| Config | `GET/PUT /api/config/:section` | Yes (config permission) |
| Config | `GET/PUT/DELETE /api/config/cashDiscount/state-rules/:state` | Yes (config permission) |
| Reports | `GET /api/reports/summary\|hourly\|item-mix\|labor` | Yes (reports permission) |
| Reports | `GET /api/reports/payment-type\|surcharge\|labor-cost` | Yes (reports permission) |
| Reports | `GET /api/reports/server-performance\|hourly-heatmap` | Yes (reports permission) |
| Reports | `GET /api/reports/category-margin\|modifier-profitability\|food-cost` | Yes (reports permission) |
| Reports | `GET /api/reports/inventory-depletion` | Yes (reports permission) |
| Fraud | `GET /api/fraud-alerts`, scan/resolve | Yes (reports permission) |
| Audit | `GET /api/audit-log` | Yes (reports permission) |
| Webhooks | `GET/POST/DELETE /api/webhooks` | Yes (config permission) |
| Recipes | `GET/POST /api/recipes` | Yes (config permission) |
| Vendors | `GET/POST /api/vendors` | Yes (config permission) |
| Purchase Orders | `GET/POST /api/purchase-orders` | Yes (config permission) |
| Waste Log | `GET/POST /api/waste-log` | Yes (reports/config) |
| Waitlist | `GET/POST /api/waitlist`, `PATCH /api/waitlist/:id` | No (POST), Yes (PATCH) |
| Reservations | `GET/POST/DELETE /api/reservations` | No (POST), Yes (DELETE) |
| Saved Payments | `GET/POST /api/saved-payment-methods` | Yes |
| Email Campaigns | `GET/POST /api/email-campaigns`, send | Yes (config permission) |
| QR Orders | `GET/POST /api/qr-orders` | No (customer-facing) |
| Delivery | `GET/POST /api/delivery-integrations` | Yes (config permission) |
| Token Vault | `GET/POST /api/token-vault` | Yes |
| Partial Pay | `POST /api/tickets/:id/partial-pay` | Yes |
| Remote Void | `POST /api/tickets/:id/remote-void` | Yes (void permission) |
| QB Export | `GET /api/export/quickbooks` | Yes (reports permission) |
| Email Reports | `GET/POST /api/email-reports` | Yes (reports/config) |
| Backups | `GET/POST /api/backups` | Yes (config permission) |
| 2FA | `POST /api/auth/2fa/setup\|verify` | Yes (config permission) |
| Security | `GET /api/security/encryption-status`, `PUT /api/security/encryption` | Yes (config) |
| Compliance | `GET /api/compliance/pci-saq` | Yes (config permission) |
| Live Feed | `GET /api/live-feed` | Yes (reports permission) |
| Admin | `GET /api/admin/summary`, `/api/mobile/dashboard` | Yes (reports permission) |
| Analytics | `GET /api/analytics/owner` | Yes (reports permission) |
| Locations | `GET /api/locations` | Yes (reports permission) |
| Cloud Reports | `GET /api/cloud-reports`, `/api/reports/payment-breakdown` | Yes (reports) |
| Surcharge Cap | `GET/PUT /api/surcharge-cap` | Yes (config permission) |
| Hardware | `GET/POST /api/hardware/printers`, cash-drawer, barcode, kds | Yes |
| Tables | `GET/PUT /api/tables` | No (GET), Yes (PUT config) |
| Sync | `GET /api/sync/snapshot`, `POST /api/sync/push\|resync` | Yes (config) |
| Merchants | `GET/POST /api/merchants` | Yes (config permission) |
| System | `GET /api/system/diagnostics`, `POST /api/system/update` | Yes (config) |
| Branding | `GET/PUT /api/branding` | No (GET), Yes (PUT config) |
| Feature Toggles | `GET/PUT /api/feature-toggles` | Yes (config permission) |
| Deploy | `GET /api/deploy/status`, `POST /api/deploy` | Yes (config permission) |
| Dev Docs | `GET /api/developer/docs` | No |
| Plugins | `GET/POST/PUT/DELETE /api/plugins` | Yes (config permission) |
| Menu | `GET/PUT /api/menu` | No (GET), Yes (PUT config) |
| Void Requests | `GET /api/void-requests`, `POST approve/reject` | Yes (void permission) |
| Locations | `GET/POST/PUT/DELETE /api/locations` | Yes (reports/config) |
| Vendors | `GET/POST/PUT/DELETE /api/vendors` | Yes (config permission) |
| Recipes | `GET/POST/PUT/DELETE /api/recipes` | Yes (config permission) |
| Merchants | `GET/POST/PUT/DELETE /api/merchants` | Yes (config permission) |
| PO Workflow | `POST /api/purchase-orders/:id/approve\|order\|receive\|cancel` | Yes (config) |
| QR Workflow | `POST /api/qr-orders/:id/accept\|reject\|complete` | Yes (tickets) |
| Scheduled | `POST /api/scheduled-orders/:id/fulfill` | Yes (tickets) |
| Reservations | `GET/POST/PUT/DELETE /api/reservations` | No (POST), Yes (PUT/DELETE) |
| Delivery | `GET/POST/PUT /api/delivery-integrations`, `POST test` | Yes (config) |
| KDS Displays | `GET/POST /api/hardware/kds-displays`, `POST heartbeat` | Yes (config), No (heartbeat) |
| Encryption | `GET /api/security/encryption-status`, `PUT encryption`, `POST rotate-key` | Yes (config) |
| Health | `GET /api/health` | No |

---

## Database

### Supported Engines

- **Derby** (default): Embedded, zero-config, lives in `database/derby-server/posdb.zip`
- **MySQL 8.0**: Multi-terminal production use
- **PostgreSQL 9.5+**: Enterprise alternative

### Migrations (run in order)

1. `database/migrate.sql` — schema version tracking table
2. `database/migration-cashdiscount-paybotx.sql` — cash discount + PaybotX tables
3. `database/migration-002-refunds-timeclock-held.sql` — refunds, time clock, held orders
4. `database/migration-003-giftcards-tabs-inventory.sql` — gift cards, tabs, inventory, batch settlement

Run via `database/migrate.sh` or apply manually.

### Key Tables Added Over Base Floreant

| Table | Purpose |
|-------|---------|
| `CASH_DISCOUNT_CONFIG` | Cash discount settings storage |
| `PAYBOTX_TERMINAL` | Terminal device configurations |
| `PAYBOTX_BATCH_LOG` | Batch settlement history |
| `OFFLINE_PAYMENT_QUEUE` | Queued payments during connectivity loss |

Enhanced `TICKET` columns: `CASH_DISCOUNT_APPLIED`, `CASH_DISCOUNT_AMOUNT`, `CASH_DISCOUNT_RATE`

---

## Configuration

### Environment Variables (`.env.example`)

```bash
PAYBOTX_MERCHANT_ID=     # Valor merchant ID
PAYBOTX_API_KEY=         # Valor API key
CORS_ALLOWED_ORIGIN=     # e.g., https://pos.yourrestaurant.com
DB_USER=floreant         # Database user
DB_PASS=floreant         # Database password
MYSQL_ROOT_PASSWORD=     # MySQL root (Docker only)
```

### Cash Discount Properties

Configured via back-office UI or `config/floreant-pos.properties`:
```properties
cashDiscount.enabled=true
cashDiscount.mode=CASH_DISCOUNT       # or CARD_SURCHARGE
cashDiscount.rate=4.0
cashDiscount.applyBeforeTax=true
cashDiscount.showDualPricing=true
cashDiscount.exemptDebit=true
cashDiscount.minCardAmount=0.00
```

### Terminal Configuration (`resources/paybotx-terminals.xml`)

```xml
<terminal id="TERM001" active="true">
  <merchantId>YOUR_MERCHANT_ID</merchantId>
  <apiKey>YOUR_API_KEY</apiKey>
  <ipAddress>192.168.1.100</ipAddress>
  <port>8443</port>
  <model>VP8800</model>
</terminal>
```

---

## Code Conventions

### Java

- Package-by-feature organization (`cashdiscount/`, `paybotx/`, `model/`, `ui/`)
- CamelCase class names, standard Java naming
- Hibernate ORM for persistence via DAO pattern (e.g., `TicketDAO`)
- Plugin architecture: payment gateways implement `CardProcessor` interface
- Service layer pattern for business logic
- Java source level: 17 (compiler + runtime) — required for CVE-2025-10492 mitigation

### JavaScript (Web Frontend)

- Vanilla JS — no framework (no React, no Vue)
- Event-driven architecture (DOM event listeners)
- Module pattern for code organization (separate `.js` files per feature)
- Fetch API for HTTP communication
- `localStorage` for client-side state
- CSS Grid/Flexbox for layout; CSS custom properties for theming/dark mode

### API Design

- RESTful endpoints under `/api/`
- JWT authentication on all `/api/` routes (except `/api/auth/login` and `/api/health`)
- Field whitelisting on PATCH/PUT to prevent mass assignment
- Monetary values use `Math.round(x * 100) / 100` for cent precision
- CSP headers on all HTML responses
- CORS restricted to configured origins

### Security Patterns

- `.env` files are gitignored — never commit credentials
- CSP headers set on all HTML responses
- CORS whitelist via `CORS_ORIGINS` env var
- JWT tokens for API auth
- Field whitelisting on mutations (no open `Object.assign` from request body)
- Role-based authorization middleware (`authorize('permission')`)

---

## Internationalization

Supported languages in `i18n/`:
- English (`messages.properties`)
- German (`messages_de.properties`)
- Spanish (`messages_es.properties`)
- Arabic (`messages_ar.properties`)
- Egyptian Arabic (`messages_ar_EG.properties`)
- Dutch (`messages_nl.properties`)

Uses Java `MessageFormat` properties files.

---

## Docker Deployment Architecture

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| `pos` | `restaurant-pos` | 8080, 8000 | Java backend + PaybotX API |
| `db` | `pos-database` | 3306 | MySQL 8.0 |
| `nginx` | `pos-nginx` | 80, 443 | Static files + reverse proxy |

Nginx config: `etc/nginx.conf` (proxies API to port 8080, serves static files, gzip, CORS headers)

Volumes: `pos-data` (app data), `db-data` (MySQL persistence)

---

## Development Workflow for AI Assistants

### Before Making Changes

1. Read the relevant source files before proposing changes
2. Understand whether the change targets the Java backend, the web frontend, or both
3. Check if there are existing patterns in the codebase to follow

### When Modifying Java Code

- Source is in `src/` (non-standard — not `src/main/java/`)
- Build with `mvn package -DskipTests`
- Follow the existing Hibernate/DAO patterns for data access
- New payment features go through the `CardProcessor` plugin interface
- Cash discount logic is centralized in `cashdiscount/` package

### When Modifying Web Frontend

- All web code is in `webapp/`
- Run tests after changes: `cd webapp && npm test`
- The API server is `webapp/api/server.js` — Express with JWT auth
- New endpoints need `authorize('permission')` middleware
- Use field whitelisting for any new PATCH/PUT endpoints
- Monetary math must use `Math.round(x * 100) / 100`
- Keep vanilla JS style — do not introduce frameworks

### When Adding Database Changes

- Create new migration files in `database/` following the naming pattern
- Prefix with the next migration number (e.g., `migration-004-*.sql`)
- Update `migrate.sh` to include the new migration
- Support all three DB engines (Derby, MySQL, PostgreSQL) where possible

### When Adding API Endpoints

- Add to `webapp/api/server.js`
- Apply `authenticate` middleware (already global on `/api`)
- Add `authorize('permission')` for write operations
- Add corresponding tests in `webapp/tests/`
- Document in the README API section

### Testing Checklist

```bash
cd webapp && npm install           # Install deps first (express required)
npm test                           # Run core tests (454 tests) — must pass
npm run test:calculations          # Pricing/tax/discount math
npm run test:auth                  # Auth and role-based access
npm run test:api                   # API endpoints
node --test tests/extras.test.js   # Extended features (run separately)
```

---

## Product Roadmap (Feature Status)

Features already implemented are marked with checkmarks. This is the full competitive feature set being built toward.

### 1. Modern UI/UX Overhaul
- [x] Touch-optimized tablet interface
- [x] Faster menu navigation
- [x] Customizable layout per restaurant
- [x] Dark mode
- [x] Smooth animations / modern fonts
- [x] Mobile responsive web dashboard
- [x] Real-time order status UI
- [x] Role-based interface (server vs manager vs cashier)

### 2. Fully Integrated Payment System
**Core Payment Features:**
- [x] EMV chip support (via PaybotX/Valor terminals)
- [x] Contactless (Apple Pay, Google Pay) — via terminal
- [x] NFC tap-to-pay — via terminal
- [x] Split payments
- [x] Partial payments
- [x] Tip adjustments
- [x] Refund processing
- [x] Void support
- [x] Offline payment queue (store & forward)

**Advanced Features:**
- [x] Automatic batch settlement
- [x] Tokenized cards for returns
- [x] PCI-compliant semi-integration
- [x] Automatic debit detection (no surcharge on debit)

### 3. Cash Discount / Dual Pricing Engine
- [x] Cash discount mode toggle
- [x] Credit surcharge mode toggle
- [x] Automatic percentage calculation
- [x] Cap logic (e.g., max 3%)
- [x] Debit detection rules
- [x] Clear line-item receipt display
- [x] Dual price display on screen
- [x] Compliance signage generator
- [x] State-specific configuration
- [x] Reporting separated by payment type

### 4. Restaurant Workflow Upgrades
- [x] Advanced table management (visual floor plan drag-and-drop)
- [x] Split checks by seat
- [x] Seat-level ordering
- [x] Course firing
- [x] Kitchen display system (KDS)
- [x] Order routing by prep station
- [x] Expo screen
- [x] Online order queue
- [x] Email "order ready" alerts
- [x] Waitlist management
- [x] Reservation integration

### 5. Cloud Sync + Remote Dashboard
- [x] Cloud-hosted reporting server
- [x] Multi-location dashboard
- [x] Real-time sales feed
- [x] Remote void approval
- [x] Phone-based management portal
- [x] Owner analytics app
- [x] REST API layer (foundation)
- [x] Web admin portal

### 6. Advanced Reporting & Analytics
- [x] Hourly sales heat maps
- [x] Labor cost tracking
- [x] Server performance metrics
- [x] Modifier profitability
- [x] Food cost tracking
- [x] Inventory depletion tracking
- [x] Category margin analysis
- [x] Payment type breakdown
- [x] Surcharge revenue reporting
- [x] Export to QuickBooks
- [x] Automated email reports
- [x] Basic reporting endpoints (summary, hourly, item-mix, labor)

### 7. Inventory & Vendor Management
- [x] Ingredient-level tracking
- [x] Recipe costing
- [x] Low-stock alerts
- [x] Purchase order generation
- [x] Vendor tracking
- [x] Waste logging
- [x] Food cost % dashboard
- [x] Database schema for inventory (migration-003)

### 8. Customer & Loyalty System
- [x] Customer profiles
- [x] Saved payment methods
- [x] Loyalty points
- [x] Rewards engine
- [x] Email marketing
- [x] Digital receipts
- [x] Gift card management
- [x] Loyalty module stub (`pos-loyalty.js`)
- [x] Gift card DB schema (migration-003)

### 9. Online Ordering + QR Ordering
- [x] Online ordering website
- [x] QR table ordering
- [x] Integrated payments
- [x] Delivery integration (DoorDash/Uber Eats APIs)
- [x] Curbside pickup mode
- [x] Scheduled orders
- [x] Promo code engine

### 10. Security & Compliance
- [x] User permission granularity (role-based authorization)
- [x] Audit logs
- [x] Encrypted database
- [x] Tokenized payment storage
- [x] PCI SAQ documentation
- [x] Backup automation
- [x] 2FA for managers
- [x] Fraud detection alerts
- [x] JWT authentication
- [x] CSP headers
- [x] CORS whitelist
- [x] Field whitelisting on mutations

### 11. Hardware Ecosystem
- [x] Terminal provisioning (paybotx-terminals.xml)
- [x] Printer auto-discovery
- [x] Cash drawer auto-open logic
- [x] Barcode scanner integration
- [x] Kitchen display hardware support
- [x] Offline LAN mode with sync

### 12. Offline Mode + Sync Engine
- [x] Offline payment queue (store & forward)
- [x] Full local data caching
- [x] Sync conflict resolution
- [x] Offline transaction storage
- [x] Auto-resync on reconnect
- [x] PWA service worker (sw.js)

### 13. Subscription / Merchant Management Layer
- [x] Merchant onboarding portal
- [x] Multi-tenant architecture
- [x] Automated updates
- [x] Remote diagnostics
- [x] White-labeling capability
- [x] Remote feature toggles
- [x] Automated deployment scripts
- [x] Docker-based deployment

### 14. App Ecosystem
- [x] Plugin framework (Floreant JSPF-based)
- [x] REST API for integrations
- [x] Webhook support
- [x] Developer documentation
- [x] App marketplace capability

---

## Sensitive Files — Never Commit

- `.env` (contains API keys, DB credentials)
- `credentials.json`
- `webapp/data/store.json` (runtime data)
- `offline-payments.queue`
- Any `*.derby/` directories
- `derby.log`

---

## Known Technical Debt

- **Hibernate 3.2.6** is very old (current is 6.x+) — upgrade would require significant refactoring
- **Java Swing UI** is legacy; web UI is the modern interface
- **Log4j version mixing**: Log4j2 in pom.xml but Log4j1-style `log4j.properties` in resources
- **Local JARs** in `local-lib/` instead of Maven Central (MigLayout, JSPF, PAX PosLink, etc.)
- **No Java test suite** — testing is entirely on the Node.js side
- **CVE-2025-10492**: JasperReports 7.0.3 has a deserialization vulnerability with no community edition fix. Mitigated by Java 17+ runtime and `DeserializationSecurity` filter (see `src/com/floreantpos/config/DeserializationSecurity.java`)
