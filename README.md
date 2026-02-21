# Restaurant POS - Self-Hosted with Cash Discount & PaybotX Integration

A self-hosted restaurant point-of-sale system built on [Floreant POS](https://floreant.org), enhanced with **cash discount / card surcharge support** and **external card terminal integration** (PaybotX/Valor Gateway).

## What's New Over Base Floreant

| Feature | Description |
|---------|-------------|
| **Cash Discount Engine** | Dual-pricing system supporting cash discount and card surcharge modes |
| **PaybotX/Valor Integration** | External EMV terminal plugin with cloud and LAN communication |
| **Modern Web UI** | Touch-optimized browser-based frontend with dark mode |
| **Kitchen Display (KDS)** | Real-time kitchen order display with bump-bar support |
| **Offline Payment Queue** | Store-and-forward for intermittent connectivity |
| **Batch Settlement** | Automatic end-of-day batch settlement with scheduling |
| **Compliance Signage** | Built-in generator for cash discount compliance signs |
| **Docker Deployment** | One-command self-hosted deployment |

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/gorjessbbyx3/Posxpaybotx.git
cd Posxpaybotx
docker-compose up -d
```

Access the POS at `http://localhost` (web UI) or `http://localhost:8080/api` (API).

### Option 2: Direct Setup

```bash
git clone https://github.com/gorjessbbyx3/Posxpaybotx.git
cd Posxpaybotx
./setup.sh
```

### Option 3: Manual

```bash
# Prerequisites: JDK 17+, Maven 3.6+
mvn package -DskipTests
java -cp target/classes:local-lib/* com.floreantpos.main.Application
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Web Browser                        │
│         (Touch-optimized POS / KDS / Admin)           │
└──────────────┬───────────────────────────┬────────────┘
               │ HTTP                       │ WebSocket
┌──────────────▼───────────────┐   ┌───────▼────────────┐
│       Nginx (port 80)        │   │    KDS Display      │
│   Static files + API proxy   │   │   (real-time)       │
└──────────────┬───────────────┘   └────────────────────┘
               │
┌──────────────▼───────────────────────────────────────┐
│           PaybotX Proxy Server (port 8080)            │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  REST API    │  │ Cash Discount│  │   Payment    │ │
│  │  /api/*      │  │   Engine     │  │   Gateway    │ │
│  └─────────────┘  └──────────────┘  └──────┬───────┘ │
│                                             │         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────▼───────┐ │
│  │  Ticket     │  │  Offline     │  │   PaybotX    │ │
│  │  Manager    │  │  Queue       │  │   Processor  │ │
│  └─────────────┘  └──────────────┘  └──────┬───────┘ │
└────────────────────────────────────────────┼─────────┘
                                             │
                    ┌────────────────────────▼──────────┐
                    │      Floreant POS Core Engine      │
                    │  Orders, Tickets, Menu, Reports    │
                    │  Hibernate ORM + Derby/MySQL/PG    │
                    └───────────────────────────────────┘
                                    │
              ┌─────────────────────┼──────────────────┐
              ▼                     ▼                    ▼
     ┌─────────────┐     ┌────────────────┐   ┌───────────────┐
     │ Derby (embed)│     │ MySQL/MariaDB  │   │  PostgreSQL   │
     │ Zero config  │     │ Multi-terminal │   │  Enterprise   │
     └─────────────┘     └────────────────┘   └───────────────┘
```

---

## Cash Discount / Card Surcharge

### Modes

**Cash Discount Mode** (default): Menu prices are card prices. Cash customers receive a discount.

```
Menu Price:   $10.00 (card price)
Cash Price:   $9.60  (4% discount)
```

**Card Surcharge Mode**: Menu prices are cash prices. Card customers pay a surcharge.

```
Menu Price:   $10.00 (cash price)
Card Price:   $10.40 (4% surcharge)
```

### Configuration

In the POS back-office or via `config/floreant-pos.properties`:

```properties
cashDiscount.enabled=true
cashDiscount.mode=CASH_DISCOUNT
cashDiscount.rate=4.0
cashDiscount.label=Cash Discount
cashDiscount.surchargeLabel=Non-Cash Adjustment
cashDiscount.applyBeforeTax=true
cashDiscount.showDualPricing=true
cashDiscount.exemptDebit=true
cashDiscount.minCardAmount=0.00
```

### Features

- Dual price display on order screen and receipts
- Automatic calculation at settlement based on payment method
- Debit card exemption (configurable)
- Minimum amount threshold for surcharge
- Before-tax or after-tax application
- Compliance signage generator: `http://localhost/compliance-signage.html`
- State-specific legal language support

### Source Files

| File | Purpose |
|------|---------|
| `src/.../cashdiscount/CashDiscountConfig.java` | Configuration management |
| `src/.../cashdiscount/CashDiscountCalculator.java` | Pricing calculation engine |
| `src/.../cashdiscount/CashDiscountService.java` | Service layer for ticket integration |
| `src/.../cashdiscount/CashDiscountConfigView.java` | Back-office configuration UI |

---

## PaybotX / Valor Terminal Integration

### Supported Operations

| Operation | Description |
|-----------|-------------|
| Sale | Charge amount to card |
| Pre-Auth | Authorize and hold (bar tabs) |
| Capture | Capture a pre-authorized amount |
| Void | Reverse a transaction |
| Tip Adjust | Adjust tip after settlement |
| Batch Settle | Close the daily batch |

### Terminal Configuration

Edit `resources/paybotx-terminals.xml`:

```xml
<terminals>
  <terminal id="TERM001" active="true">
    <merchantId>YOUR_MERCHANT_ID</merchantId>
    <apiKey>YOUR_API_KEY</apiKey>
    <ipAddress>192.168.1.100</ipAddress>
    <port>8443</port>
    <model>VP8800</model>
  </terminal>
</terminals>
```

Or configure via Back Office > PaybotX / Valor settings.

### Communication Modes

**Cloud Mode**: POS communicates with terminals via Valor Gateway cloud (`https://vt.isoaccess.com`).

**LAN Mode**: POS communicates directly with terminals on the local network (requires terminal IP).

### Supported Terminal Models

VP8800, VX520, VX680, VX690, VP3300, Pax A920, Pax A80, Pax S300, Ingenico Lane/3000, Ingenico Move/5000

### Plugin Architecture

The PaybotX integration follows Floreant's plugin system:

```
PaybotXGatewayPlugin (extends PaymentGatewayPlugin)
  └── PaybotXProcessor (implements CardProcessor)
       ├── chargeAmount()    → Sale transaction
       ├── preAuth()         → Pre-authorization
       ├── captureAuthAmount()→ Capture
       ├── voidTransaction() → Void
       └── adjustTips()      → Tip adjustment
```

### Source Files

| File | Purpose |
|------|---------|
| `src/.../paybotx/PaybotXGatewayPlugin.java` | Floreant plugin registration |
| `src/.../paybotx/PaybotXProcessor.java` | CardProcessor implementation |
| `src/.../paybotx/PaybotXTerminal.java` | Terminal device model |
| `src/.../paybotx/config/PaybotXConfig.java` | Configuration management |
| `src/.../paybotx/config/PaybotXConfigView.java` | Back-office UI |
| `src/.../paybotx/proxy/PaybotXProxyServer.java` | HTTP proxy/API server |
| `src/.../paybotx/OfflinePaymentQueue.java` | Store-and-forward queue |
| `src/.../paybotx/BatchSettlementService.java` | Auto batch settlement |

---

## Web UI

The modern web frontend provides a touch-optimized interface accessible from any browser.

### Features

- Touch-optimized for tablets and POS terminals
- Dark mode support
- Role-based interface (server, cashier, manager)
- Real-time order status
- Kitchen Display System (KDS) with station filtering
- Table management with visual floor plan
- Dual pricing display (cash vs card)
- Payment modal with terminal integration
- Responsive design (tablet + desktop)

### Views

| View | Access | Description |
|------|--------|-------------|
| New Order | All roles | Menu navigation, item selection, ticket management |
| Tables | All roles | Visual floor plan, table status, assignment |
| Kitchen | Kitchen staff | KDS with timer, bump bar, station filters |
| Tickets | All roles | Open/paid/closed ticket browser |

### Accessing

- Main POS: `http://localhost/`
- KDS Only: `http://localhost/` (Kitchen tab)
- Compliance Signs: `http://localhost/compliance-signage.html`

---

## API Endpoints

The PaybotX Proxy Server exposes a REST API on port 8080:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Server status |
| GET | `/api/tickets` | List open tickets |
| GET | `/api/tickets/{id}` | Ticket detail with dual pricing |
| GET | `/api/tickets/server/{id}` | Tickets by server |
| GET | `/api/tickets/table/{num}` | Tickets by table |
| POST | `/api/payment` | Process payment |
| POST | `/api/payment/void` | Void transaction |
| POST | `/api/payment/tip-adjust` | Adjust tip |
| POST | `/api/batch/settle` | Settle batch |

### Payment Request Example

```json
POST /api/payment
{
  "ticketId": "1001",
  "amount": "25.50",
  "tipAmount": "5.00",
  "paymentType": "Credit",
  "cardType": "Visa",
  "cardLast4": "1234",
  "refId": "TXN-001",
  "authCode": "AUTH123",
  "batchNum": "001"
}
```

### Response

```json
{
  "status": "success",
  "ticketId": 1001,
  "amountPaid": 30.50,
  "dueAmount": 0.00,
  "paid": true,
  "closed": true,
  "cashDiscount": {
    "label": "Cash Discount",
    "amount": 1.22,
    "isDiscount": true
  }
}
```

---

## Docker Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f pos

# Stop
docker-compose down
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| `pos` | 8080 | Java backend + PaybotX API |
| `db` | 3306 | MySQL database |
| `nginx` | 80 | Web UI + API proxy |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_TYPE` | `DERBY` | Database: DERBY, MYSQL, POSTGRESQL |
| `DB_HOST` | `db` | Database hostname |
| `DB_NAME` | `floreantpos` | Database name |
| `PAYBOTX_GATEWAY_URL` | `https://vt.isoaccess.com` | Valor gateway URL |
| `CASH_DISCOUNT_ENABLED` | `true` | Enable cash discount |
| `CASH_DISCOUNT_RATE` | `4.0` | Discount rate (%) |
| `CASH_DISCOUNT_MODE` | `CASH_DISCOUNT` | CASH_DISCOUNT or CARD_SURCHARGE |

---

## Building from Source

```bash
# Prerequisites
# - JDK 17+
# - Maven 3.6+

# Build
mvn package -DskipTests

# Run POS application
java -cp target/classes:local-lib/* com.floreantpos.main.Application

# Run PaybotX Proxy only
java -cp target/classes:local-lib/* com.floreantpos.paybotx.proxy.PaybotXProxyServer

# Run Dejavoo Proxy (legacy)
java -cp target/classes:local-lib/* com.floreantpos.dejavoo.proxy.DejavooProxyServer
```

---

## Project Structure

```
Posxpaybotx/
├── src/com/floreantpos/
│   ├── cashdiscount/           # Cash discount / surcharge engine
│   │   ├── CashDiscountConfig.java
│   │   ├── CashDiscountCalculator.java
│   │   ├── CashDiscountService.java
│   │   └── CashDiscountConfigView.java
│   ├── paybotx/                # PaybotX/Valor terminal integration
│   │   ├── PaybotXGatewayPlugin.java
│   │   ├── PaybotXProcessor.java
│   │   ├── PaybotXTerminal.java
│   │   ├── OfflinePaymentQueue.java
│   │   ├── BatchSettlementService.java
│   │   ├── config/
│   │   │   ├── PaybotXConfig.java
│   │   │   └── PaybotXConfigView.java
│   │   └── proxy/
│   │       └── PaybotXProxyServer.java
│   ├── dejavoo/                # Dejavoo terminal (original)
│   ├── model/                  # Data models (Ticket, Transaction, etc.)
│   ├── extension/              # Plugin framework
│   ├── ui/                     # Java Swing UI
│   └── ...                     # Core Floreant POS
├── webapp/                     # Modern web frontend
│   ├── index.html              # Main POS interface
│   ├── compliance-signage.html # Compliance sign generator
│   ├── css/pos.css             # Styles with dark mode
│   └── js/pos.js               # Application logic
├── resources/
│   └── paybotx-terminals.xml   # Terminal configuration
├── config/                     # POS configuration
├── database/                   # Schema scripts
├── docker-compose.yml          # Docker deployment
├── Dockerfile                  # Container build
├── setup.sh                    # Interactive setup
└── pom.xml                     # Maven build
```

---

## Original Floreant POS

This project is built on [Floreant POS](https://floreant.org), an open-source Java restaurant POS system licensed under MRPL 1.2. The original codebase provides:

- Order management (dine-in, takeout, delivery)
- Table management with floor plans
- Menu management with modifiers and pricing
- Employee management with roles
- Ticket splitting, partial payments
- Kitchen printer integration
- Multi-terminal support
- Reporting and cash drawer management
- Existing payment gateways (Authorize.Net, Mercury)

GitHub mirror: [fat-tire/floreantpos](https://github.com/fat-tire/floreantpos)

---

## License

Floreant POS core is licensed under [MRPL 1.2](http://web.archive.org/web/20191018191240/http://floreantpos.org:80/license.html/) (Modified Mozilla Public License). Extensions in the `cashdiscount/` and `paybotx/` packages follow the same license terms.
