# Administrator Guide

Posxpaybotx Restaurant POS — v1.4

---

## Table of Contents

1. [Deployment](#1-deployment)
2. [First-Time Setup](#2-first-time-setup)
3. [Admin Dashboard](#3-admin-dashboard)
4. [Employee Management](#4-employee-management)
5. [Roles & Permissions](#5-roles--permissions)
6. [Configuration](#6-configuration)
7. [Cash Discount / Surcharge](#7-cash-discount--surcharge)
8. [Payment Terminal Setup](#8-payment-terminal-setup)
9. [Happy Hour / Time-Based Pricing](#9-happy-hour--time-based-pricing)
10. [Reports](#10-reports)
11. [Backup & Recovery](#11-backup--recovery)
12. [Security](#12-security)
13. [Hardware](#13-hardware)
14. [System Diagnostics](#14-system-diagnostics)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Deployment

### Option A: Docker (Recommended)

```bash
git clone https://github.com/gorjessbbyx3/Posxpaybotx.git
cd Posxpaybotx
cp .env.example .env        # Edit with your credentials
docker-compose up -d
```

Three containers start automatically:

| Service | Port | Purpose |
|---------|------|---------|
| nginx | 80 / 443 | Web UI + reverse proxy |
| pos | 8080 | Java backend + API |
| db | 3306 | MySQL 8.0 database |

Access the POS at **http://localhost** and the admin panel at **http://localhost/admin.html**.

### Option B: Interactive Setup

```bash
./setup.sh
```

The script checks prerequisites (Java 11+, Maven, Docker), installs local dependencies, and walks you through terminal and cash discount configuration.

### Option C: Manual

```bash
# Backend
mvn package -DskipTests

# Web API
cd webapp && npm install && npm start    # Starts on port 3000
```

### Environment Variables

Copy `.env.example` to `.env` and set these values:

| Variable | Purpose | Example |
|----------|---------|---------|
| `PAYBOTX_MERCHANT_ID` | Valor merchant ID | `MID123456` |
| `PAYBOTX_API_KEY` | Valor API key | `ak_live_...` |
| `CORS_ALLOWED_ORIGIN` | Your POS domain | `https://pos.myrestaurant.com` |
| `DB_USER` | Database user | `floreant` |
| `DB_PASS` | Database password | Change from default |
| `MYSQL_ROOT_PASSWORD` | MySQL root (Docker) | Change from default |

**Never commit `.env` to version control.**

---

## 2. First-Time Setup

After deployment, open the admin panel (`/admin.html`) and configure these sections in order:

1. **Restaurant Info** — Name, address, phone, email (appears on receipts)
2. **Tax Configuration** — Set your local tax rate
3. **Cash Discount** — Enable and choose mode (see [Section 7](#7-cash-discount--surcharge))
4. **Terminal Setup** — Connect your PaybotX/Valor terminal (see [Section 8](#8-payment-terminal-setup))
5. **Receipt Settings** — Customize footer text, tip line, dual pricing display
6. **Employee Accounts** — Add your staff with appropriate roles and PINs

### Default Login

The system ships with a default admin account:

| Name | Role | PIN |
|------|------|-----|
| Admin | Owner | `1234` |

**Change the default PIN immediately after first login.**

---

## 3. Admin Dashboard

Access at `/admin.html`. The sidebar navigation provides:

- **Dashboard** — Revenue overview, transaction counts, quick stats
- **Restaurant Info** — Business details for receipts and compliance
- **Cash Discount** — Discount/surcharge mode and rate configuration
- **Tax** — Tax rate, inclusive pricing, alcohol-specific rates
- **Terminal** — PaybotX device connection and settings
- **Receipt** — Receipt text, tip line, dual pricing, footer
- **Happy Hour** — Time-based pricing rules
- **Employees** — Staff accounts, roles, PINs
- **Backups** — Manual and scheduled backup management
- **Time Clock** — Staff hours and clock-in/out records
- **Audit Log** — Full history of admin actions
- **Feature Toggles** — Enable/disable system features
- **Diagnostics** — System health, memory, uptime

---

## 4. Employee Management

### Adding an Employee

```
POST /api/employees
{
  "name": "Jane",
  "pin": "5678",
  "role": "server"
}
```

Or use the admin panel: Employees > Add Employee.

- PINs must be exactly **4 digits**
- PINs must be **unique** across all employees
- Each employee needs a **role** (see Section 5)

### Updating an Employee

Change name, role, or PIN through the admin panel or:

```
PUT /api/employees/:id
{ "role": "assistant_manager" }
```

Role and name changes are logged in the audit trail with before/after values.

### Removing an Employee

Employees can be removed through the admin panel. You cannot delete your own account. All removals are audit-logged.

---

## 5. Roles & Permissions

The system has 13 roles organized by function. Each role grants a specific set of permissions.

### Ownership & Management

| Role | Key Permissions | Use For |
|------|----------------|---------|
| **owner** | All 31 permissions | Restaurant owner, full control |
| **general_manager** | All except payment processor and security settings | GM running daily operations |
| **assistant_manager** | Tickets, void, refund, comp, discounts, reports, menu, tables, kitchen, inventory, timeclock | Shift managers |

### Front of House

| Role | Key Permissions | Use For |
|------|----------------|---------|
| **server** | Tickets, discounts, tables, waitlist, cash drawer, timeclock | Wait staff |
| **bartender** | Tickets, discounts, tables, waitlist, cash drawer, timeclock | Bar staff |
| **cashier** | Tickets, discounts, cash drawer, timeclock | Counter/register staff |
| **host** | Tables, waitlist, timeclock | Host/hostess |

### Back of House

| Role | Key Permissions | Use For |
|------|----------------|---------|
| **kitchen** | Kitchen display, timeclock | Line cooks |
| **kitchen_manager** | Kitchen, reports, inventory, vendors, recipes, purchase orders, waste log, timeclock | Head chef / kitchen lead |

### Specialized

| Role | Key Permissions | Use For |
|------|----------------|---------|
| **bookkeeper** | Reports, export, audit, timeclock | Accountant / bookkeeper |
| **payroll_admin** | Employees, payroll, reports, export, timeclock | Payroll manager |
| **inventory_admin** | Reports, inventory, vendors, recipes, purchase orders, waste log, timeclock | Inventory manager |
| **online_ordering_admin** | Menu, online orders, integrations, timeclock | Online channel manager |

### Key Permission Rules

- **Void / Refund**: Only owner, GM, and assistant manager can void or refund
- **Config changes**: Only owner and GM can change system settings
- **Payment config**: Only owner can change payment processor settings
- **Security**: Only owner can manage encryption and security settings
- Servers and cashiers **cannot void** — they must request manager approval

---

## 6. Configuration

All configuration is managed through the admin panel or the API (`PUT /api/config/:section`).

### Tax

| Setting | Default | Description |
|---------|---------|-------------|
| `rate` | 8.875% | Sales tax percentage |
| `inclusive` | false | Tax included in menu prices |
| `alcoholSeparate` | false | Use a different rate for alcohol |
| `alcoholRate` | 10.0% | Alcohol-specific tax rate |

### Restaurant Info

Set your restaurant's name, address, city, state, ZIP, phone, and email. This information appears on printed receipts, digital receipts, and compliance signage.

### Receipt

| Setting | Default | Description |
|---------|---------|-------------|
| `customerCopy` | true | Print customer receipt copy |
| `merchantCopy` | true | Print merchant receipt copy |
| `showDualPrices` | true | Show cash and card prices |
| `showTipLine` | true | Include tip line on receipts |
| `footer` | "Thank you! Pay with cash and save!" | Receipt footer text |
| `cdNotice` | "We offer a 4% discount for cash payments." | Cash discount disclosure |

---

## 7. Cash Discount / Surcharge

The system supports two compliance-friendly dual pricing modes:

### CASH_DISCOUNT Mode (Default)

Menu prices are the **card price**. Cash customers receive a discount.

Example at 4% rate:
- Menu price: $10.00 (card pays this)
- Cash price: $9.60 (4% discount applied)

### CARD_SURCHARGE Mode

Menu prices are the **cash price**. Card customers pay a surcharge.

Example at 4% rate:
- Menu price: $10.00 (cash pays this)
- Card price: $10.40 (4% surcharge added)

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | true | Enable cash discount/surcharge |
| `mode` | CASH_DISCOUNT | CASH_DISCOUNT or CARD_SURCHARGE |
| `rate` | 4.0% | Discount/surcharge percentage |
| `showDualPricing` | true | Display both prices on screen |
| `exemptDebit` | true | No surcharge on debit transactions |
| `applyBeforeTax` | true | Apply discount before calculating tax |
| `minCardAmount` | $0.00 | Minimum transaction for card surcharge |
| `maxSurcharge` | null | Cap the surcharge amount |

### State-Specific Rules

Different states have different surcharge regulations. Configure per-state rules:

```
PUT /api/config/cashDiscount/state-rules/NY
{
  "maxRate": 3.0,
  "allowed": true,
  "mode": "CASH_DISCOUNT",
  "label": "Cash Price Adjustment"
}
```

### Compliance Signage

Access `/compliance-signage.html` to generate printable signage that explains your cash discount program to customers.

---

## 8. Payment Terminal Setup

### Supported Terminals

| Brand | Models |
|-------|--------|
| Valor | VP8800, VX520, VX680 |
| PAX | A920, A80, S300 |
| Ingenico | Various |

### Configuration

Set these in the admin panel under Terminal Setup:

| Setting | Description |
|---------|-------------|
| Terminal ID | Your PaybotX terminal identifier |
| Model | Terminal hardware model |
| Merchant ID | Valor merchant account ID |
| API Key | Valor API key |
| Gateway URL | `https://vt.isoaccess.com` (cloud) or terminal IP (LAN) |
| IP Address | Terminal LAN IP (for direct connection) |
| Port | 443 (HTTPS default) |
| Auto Settle | Automatically settle batch daily |
| Settle Time | Time for auto-settlement (default: 23:30) |

### Connection Modes

- **Cloud mode**: Terminal connects through `vt.isoaccess.com` gateway
- **LAN mode**: Direct connection via terminal IP address (faster, works offline)

### Testing

Use the "Test Terminal Connection" button in the admin panel, or:

```
GET /api/payments/health
```

Returns provider connectivity status for each configured payment method.

---

## 9. Happy Hour / Time-Based Pricing

Create time-based pricing rules that automatically apply discounts during specified windows.

### Enabling Happy Hour

```
PUT /api/happy-hour/toggle
{ "enabled": true }
```

### Creating a Rule

```
POST /api/happy-hour/rules
{
  "name": "Weekday Happy Hour",
  "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "startTime": "15:00",
  "endTime": "18:00",
  "discountType": "percent",
  "discountValue": 20,
  "categories": ["drinks"]
}
```

### Discount Types

| Type | Example | Effect |
|------|---------|--------|
| `percent` | `25` | 25% off the item price |
| `fixed` | `2.00` | $2.00 off the item price |
| `price` | `5.99` | Set the item to $5.99 during happy hour |

### How It Works

- When a ticket is created, active happy hour rules are checked
- Matching items get their prices adjusted automatically
- The ticket records `happyHourApplied: true` and preserves the `originalPrice`
- Rules are filtered by day of week and time window (HH:MM format)
- Categories can target specific menu sections (e.g., only "drinks")

---

## 10. Reports

Access reports from the POS main screen (Reports tab) or the API. All require the `reports` permission.

### Available Reports

| Report | Endpoint | Description |
|--------|----------|-------------|
| **Daily Summary** | `/api/reports/summary` | Total sales, ticket count, average check, cash/card split, tax, tips, refunds |
| **Hourly Sales** | `/api/reports/hourly` | Revenue broken down by hour |
| **Hourly Heatmap** | `/api/reports/hourly-heatmap` | 7-day x 24-hour sales grid |
| **Item Mix** | `/api/reports/item-mix` | Top items by quantity and revenue |
| **Payment Type** | `/api/reports/payment-type` | Breakdown by payment method |
| **Surcharge Revenue** | `/api/reports/surcharge` | Cash discount/surcharge financial impact |
| **Payment Breakdown** | `/api/reports/payment-breakdown` | Detailed payment method comparison |
| **Server Performance** | `/api/reports/server-performance` | Per-employee: avg check, items/hour, tips |
| **Labor** | `/api/reports/labor` | Employee hours and sales |
| **Labor Cost** | `/api/reports/labor-cost` | Labor expense by position |
| **Category Margin** | `/api/reports/category-margin` | Profit margin by menu category |
| **Modifier Profitability** | `/api/reports/modifier-profitability` | Revenue from add-ons and modifiers |
| **Food Cost** | `/api/reports/food-cost` | Cost of goods by category |
| **Inventory Depletion** | `/api/reports/inventory-depletion` | Ingredient usage tracking |

### Exporting

- **QuickBooks**: `GET /api/export/quickbooks` — exports financial data for QB import
- **Email Reports**: `POST /api/email-reports` — schedule automated email reports

### End of Day (Close Day)

From the Reports tab, select **Close Day** to:

1. Review daily sales summary (totals, payment types, tips, discounts)
2. Count physical cash in the drawer
3. Enter counted amount — system calculates variance
4. Settle the payment batch (if auto-settle is disabled)
5. Confirm and close the business day

---

## 11. Backup & Recovery

### Manual Backup

Create a backup at any time from the admin panel (Backup & Recovery) or:

```
POST /api/backups
```

Backups include all store data: tickets, customers, config, audit logs, etc.

### Scheduled Backups

Enable automatic backups on a recurring interval:

```
PUT /api/backups/schedule
{
  "enabled": true,
  "intervalHours": 24
}
```

- Scheduled backups run automatically at the configured interval
- The system keeps the **7 most recent** auto-backups and prunes older ones
- If encryption is enabled, scheduled backups are encrypted with AES-256-GCM

### Check Schedule Status

```
GET /api/backups/schedule
```

Returns whether scheduling is enabled, the interval, and the last scheduled backup time.

### Restoring from Backup

```
POST /api/backups/:id/restore
```

The system verifies backup integrity via SHA-256 hash before restoring. Encrypted backups are decrypted using the current encryption key.

### Backup Storage

Backups are saved to `webapp/data/backups/` as JSON files. Each backup records:

- Filename, file size, creation time
- Creator (user or "scheduler" for automated)
- Encryption status
- SHA-256 integrity hash

---

## 12. Security

### Authentication

- **Method**: 4-digit employee PIN
- **Token**: JWT with 12-hour expiry
- **2FA**: Available for manager and admin roles (`/api/auth/2fa/setup`)

### Encryption

Enable database encryption (AES-256):

```
PUT /api/security/encryption
{ "enabled": true }
```

Rotate encryption keys:

```
POST /api/security/rotate-key
```

Check encryption status:

```
GET /api/security/encryption-status
```

### Audit Log

Every admin action is logged with:

- **User** — who performed the action
- **Timestamp** — when it happened
- **Action** — what was done (config_change, employee_updated, etc.)
- **Details** — before/after values for changes

View the audit log in the admin panel or:

```
GET /api/audit-log?action=config_change&limit=50
```

### PCI Compliance

Review your PCI SAQ compliance checklist:

```
GET /api/compliance/pci-saq
```

Key compliance measures already in place:

- No raw card data stored (token + last 4 only)
- AES-256-GCM encryption for sensitive data
- JWT authentication on all API endpoints
- CSP headers on all HTML responses
- CORS restricted to configured origins
- Field whitelisting on all mutations

### Fraud Detection

```
GET /api/fraud-alerts
```

The system monitors for suspicious patterns (unusual void frequency, high-value refunds, etc.).

---

## 13. Hardware

### Printers

```
GET  /api/hardware/printers       # List configured printers
POST /api/hardware/printers       # Add a printer
```

### Cash Drawer

```
POST /api/hardware/cash-drawer    # Open cash drawer
```

The drawer auto-opens on cash transactions.

### Barcode Scanner

```
POST /api/hardware/barcode        # Process barcode scan
```

### Kitchen Display (KDS)

```
GET  /api/hardware/kds-displays                # List KDS units
POST /api/hardware/kds-displays                # Add a KDS display
POST /api/hardware/kds-displays/:id/heartbeat  # Device heartbeat (no auth)
```

KDS displays report their online/offline status via heartbeat. Monitor device health from the admin panel.

---

## 14. System Diagnostics

Check system health from the admin panel (Diagnostics) or:

```
GET /api/system/diagnostics
```

Returns:

- Process uptime
- Memory usage (heap used/total)
- Node.js version
- Data store size
- Total ticket count
- Last backup timestamp

### Health Check

```
GET /api/health
```

Quick health check returning uptime, provider status, and memory info. No authentication required — suitable for monitoring tools and load balancer health checks.

---

## 15. Troubleshooting

### POS won't load

1. Check that all Docker containers are running: `docker-compose ps`
2. Check logs: `docker-compose logs -f pos`
3. Verify port 80 is not in use by another service

### Terminal not connecting

1. Verify terminal IP and port in admin settings
2. Test connectivity: Admin > Terminal > Test Connection
3. Check `GET /api/payments/health` for provider status
4. For LAN mode: ensure the terminal and POS are on the same network

### Payment stuck in PENDING

1. Check the payment log: `GET /api/payments/log`
2. Look for gateway error codes in log entries
3. The system retries transient errors (network/5xx) with backoff
4. Business errors (declined/invalid) are not retried

### Batch settlement failed

1. Check auto-settle time in terminal config (default: 23:30)
2. Manual settle: Reports > Settle Batch
3. API: `POST /api/payments/batch/settle`

### Offline mode

When the POS loses network connectivity:

- Payments are queued in the offline payment queue
- The service worker caches the UI for continued operation
- On reconnect, queued transactions replay automatically
- Use `POST /api/sync/reconcile` to verify data integrity after reconnection

### Resetting data

If you need to reset the store data during testing:

1. Stop the server
2. Delete `webapp/data/store.json`
3. Restart — the system initializes with default data

### Viewing logs

```bash
# Docker logs
docker-compose logs -f pos

# API payment logs
GET /api/payments/log

# Audit trail
GET /api/audit-log
```
