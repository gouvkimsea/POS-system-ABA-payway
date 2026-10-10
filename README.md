# Enterprise Point of Sale (POS) Platform

A modern, production-ready, touch-first Enterprise Point of Sale (POS) platform engineered as a high-performance TypeScript monorepo with **pnpm**, **Next.js 14**, **Node.js / Express**, **Prisma ORM**, **PostgreSQL**, **Redis**, and a dedicated **Hardware Device Bridge**.

Built specifically for high-throughput retail operations with full **dual-currency (USD & KHR)** financial precision, multi-store inventory transfers, offline-first resilient checkout, cash register session reconciliation (X/Z reports), returns & refunds, and hardware peripherals (ESC/POS thermal printers, barcode scanners, customer-facing secondary displays, and cash drawers).

---

## 🏗️ Monorepo Architecture Overview

The codebase is organized into modular workspaces and shared packages:

```
/
├── apps/
│   ├── web/                     # Next.js 14 touch-first POS application (App Router, Tailwind CSS)
│   ├── api/                     # Node.js + Express REST API server with Pino logger & JWT/RBAC
│   └── bridge/                  # Standalone local device bridge daemon (WebSocket + HTTP on port 5050)
├── packages/
│   ├── types/                   # Shared TypeScript models, contracts, DTOs, and state enums
│   ├── config/                  # Environment variable schema (Zod) & system defaults
│   ├── validation/              # Shared Zod validation schemas for forms and API requests
│   └── ui/                      # Reusable accessible dark-mode UI components & design system
├── prisma/                      # PostgreSQL schema, migrations & seed scripts
├── docs/                        # Architecture guides (Deployment, Backup, Migrations, Monitoring)
├── scripts/                     # Automation, database runner, and 15+ comprehensive test suites
├── docker/                      # Production multi-stage Dockerfiles (Dockerfile.api, web, bridge)
├── docker-compose.yml           # Local development orchestration
├── docker-compose.prod.yml      # Production stack orchestration
├── package.json                 # Monorepo root configuration & test orchestration scripts
└── pnpm-workspace.yaml          # pnpm workspace definition
```

---

## 🚀 Key Modules & Capabilities

### 1. Touch-First POS Checkout Workstation (`apps/web/src/app/pos`)
- **Fast Product Discovery**: Instant fuzzy search by barcode, SKU, or name with real-time category filtering.
- **Scanning Modalities**: USB/Bluetooth barcode scanner wedge support with fast input debouncing and camera-based barcode scanning.
- **Flexible Cart Actions**: Item discounts, transaction-level discounts, custom line notes, quantity increment/decrement, and order hold/resume.
- **Dual-Currency Tender**: Native support for USD and Cambodian Riel (KHR) with fixed exchange rates, dual subtotal displays, and split payment handling.
- **Customer Loyalty**: Link registered customers to orders to earn points and apply member tiers.

### 2. Hardware Device Bridge (`apps/bridge`)
- **Local Micro-Daemon**: Runs as a lightweight local service on `http://localhost:5050` to bridge browser sandboxes to physical POS hardware.
- **ESC/POS Thermal Printing**: Raw byte buffer generation, 58mm/80mm receipt printing, QR code rendering, and automatic paper cutting.
- **Cash Drawer Interface**: Kick drawer pulses sent through printer RJ11 connectors upon cash transactions.
- **Customer Facing Display**: Real-time dual-screen live order mirroring with dynamic item breakdown and total displays.

### 3. Register Session Management & Auditing (`apps/web/src/app/reports/register-sessions`)
- **Session Lifecycle**: Structured register open float, mid-shift pay-ins and pay-outs, safe drops, and closing blind reconciliation.
- **Cash Discrepancy Auditing**: Real-time variance tracking between expected and actual drawer cash.
- **X and Z Reports**: Generate mid-shift inspection (X-Report) and permanent end-of-day closing audit (Z-Report) with detailed tender breakdowns.

### 4. Multi-Store Inventory & Transfers (`apps/web/src/app/inventory/transfers`)
- **Multi-Location Inventory**: Separate stock levels tracked across central warehouses and retail branch stores.
- **Stock Transfer Workflow**: Three-phase lifecycle: `REQUESTED` &rarr; `IN_TRANSIT` (source stock deducted) &rarr; `RECEIVED` (target stock incremented) with audit trail.
- **Discrepancy Logging**: Reconcile damaged or missing quantities during receiving.

### 5. Offline-First PWA Checkout & Sync Engine (`apps/web/src/app/settings/sync`)
- **Resilient Offline Sales**: IndexedDB / LocalStorage queue for continuing checkouts during network interruptions.
- **Idempotent Synchronization**: UUID-based idempotency keys prevent duplicate transaction processing on network reconnection.
- **Conflict Management**: Visual conflict inspector with administrator override or retry mechanisms when stock or prices collide.

### 6. Returns & Refunds Engine (`apps/web/src/components/pos/ReturnRefundModal.tsx`)
- **Line-Item Returns**: Partial and full order returns linked directly to original sales receipts.
- **Restocking Inspection**: Condition grading (`RESTOCKABLE`, `DAMAGED`, `DEFECTIVE`) to automatically restock or write off items.
- **Refund Reconciliation**: Return to original payment method or store credit with full accounting logging.

---

## 📋 System Requirements

- **Node.js**: `v20.x` or higher (Active LTS)
- **pnpm**: `v9.x` or higher (`npm install -g pnpm`)
- **Database**: PostgreSQL `16.x` (or built-in local Embedded Postgres runner)
- **Cache**: Redis `7.x` (optional for local dev; includes an automatic in-memory cache fallback)

---

## 🛠️ Quick Start & Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/gouvkimsea/POS-system-ABA-payway.git
cd POS-system-ABA-payway

# Install all workspace dependencies
pnpm install
```

### 2. Environment Configuration

Copy the development environment template:

```bash
cp .env.example .env
```

Key environment configurations:

| Variable                    | Default Value                                                        | Description                                               |
| :-------------------------- | :------------------------------------------------------------------- | :-------------------------------------------------------- |
| `NODE_ENV`                  | `development`                                                        | Runtime environment (`development`, `production`, `test`) |
| `API_PORT`                  | `4000`                                                               | Port for backend Express API server                       |
| `WEB_PORT`                  | `3000`                                                               | Port for Next.js web application                          |
| `BRIDGE_PORT`               | `5050`                                                               | Port for Local Hardware Bridge daemon                     |
| `DATABASE_URL`              | `postgresql://postgres:postgres@localhost:5432/pos_db?schema=public` | PostgreSQL connection string                              |
| `REDIS_URL`                 | `redis://localhost:6379`                                             | Redis connection URL (fallback to in-memory)              |
| `DEFAULT_TIMEZONE`          | `Asia/Phnom_Penh`                                                    | Default system timezone                                   |
| `DEFAULT_CURRENCY`          | `USD`                                                                | Base store currency                                       |
| `DEFAULT_EXCHANGE_RATE_KHR` | `4100`                                                               | Fixed exchange rate (1 USD = 4,100 KHR)                   |
| `NEXT_PUBLIC_API_URL`       | `http://localhost:4000/api`                                          | API URL consumed by web client                            |

### 3. Database Initialization & Seeding

```bash
# Start embedded PostgreSQL database (if running locally without Docker)
pnpm db:start

# Generate Prisma Client and apply migrations
pnpm db:generate
pnpm db:migrate

# Seed sample store data, categories, products, and administrative accounts
pnpm db:seed
```

---

## 💻 Development Commands

| Command               | Description                                                                             |
| :-------------------- | :-------------------------------------------------------------------------------------- |
| `pnpm dev`            | Start both Backend API and Web Frontend concurrently in development mode                |
| `pnpm dev:api`        | Start only the Backend API server (`http://localhost:4000`)                             |
| `pnpm dev:web`        | Start only the Web Frontend (`http://localhost:3000`)                                   |
| `pnpm dev:bridge`     | Start the Local Hardware Bridge daemon (`http://localhost:5050`)                        |
| `pnpm build:packages` | Compile all shared packages (`@pos/types`, `@pos/config`, `@pos/validation`, `@pos/ui`) |
| `pnpm build`          | Full production build of all packages, bridge, API, and web application                 |
| `pnpm typecheck`      | Run TypeScript type checks across all workspaces with zero errors                       |
| `pnpm lint`           | Run ESLint across all TypeScript and JavaScript files                                   |
| `pnpm pos:doctor`     | Run comprehensive system doctor & environment diagnostics scorecard     |
| `pnpm db:studio`      | Launch Prisma Studio visual database editor                                             |

---

## 🧪 Comprehensive Verification & Test Suites

The repository contains an enterprise testing harness covering all mission-critical workflows:

```bash
# Run system doctor diagnostics
pnpm pos:doctor

# Run all automated test suites
pnpm test:all

# Domain-specific test suites
pnpm test:unit           # Core calculations & financial rounding logic
pnpm test:db             # Prisma database schema constraints and relations
pnpm test:e2e            # End-to-end checkout, payment, and inventory deduction
pnpm test:edge-cases     # Split tender, zero-stock, network drops, concurrent sales
pnpm test:auth           # JWT security, PIN authentication, and RBAC permissions
pnpm test:pos            # POS workstation cart actions and discounts
pnpm test:inventory      # SKU management, adjustments, and low stock thresholds
pnpm test:transactions   # Transaction engine validation and state transitions
pnpm test:register       # Register session float, pay-in/out, and X/Z reporting
pnpm test:returns        # Customer line-item returns and restocking validation
pnpm test:hardware       # Hardware bridge ESC/POS buffer generator & status
pnpm test:offline        # Offline sync queue, idempotency, and reconciliation
pnpm test:reporting      # Financial reporting, margin calculations, and exports
pnpm test:settings       # Business, store, and payment configuration services
```

---

## 🐳 Docker Deployment

Run the complete multi-service production stack with Docker Compose:

```bash
# Build and start PostgreSQL, Redis, API, Bridge, and Web frontend
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 🔐 Security

The platform applies defence-in-depth across authentication, authorisation, and data access layers.

### Recent Patches

| Severity | CVE-Class | Description | File |
|:---:|:---|:---|:---|
| 🔴 Critical | Token Leakage | Password-reset token removed from API response (prevented account takeover via response body) | `apps/api/src/auth/service.ts` |
| 🔴 Critical | Cross-Tenant IDOR | `businessId` scope enforced on all store write/delete routes — prevents accessing or mutating another tenant's stores | `apps/api/src/routes/stores.ts` |
| 🟠 High | IP Spoofing | Auth audit log now reads `req.ip` (Express trust-proxy aware) instead of the raw `x-forwarded-for` header | `apps/api/src/routes/auth.ts` |
| 🟠 High | Privilege Escalation | `storeId` and `roleId` ownership validated against caller's `businessId` during user create/update | `apps/api/src/routes/settings.ts` |
| 🟠 High | Role Tampering | System-level `ADMIN` role protected from permission mutations by non-system callers | `apps/api/src/routes/settings.ts` |

### Architecture Security Controls

- **JWT + RBAC**: Short-lived access tokens (`ACCESS_TOKEN_SECRET`) with granular permission scopes enforced on every route.
- **Password Hashing**: bcrypt with a cost factor ≥ 12.
- **Rate Limiting**: Auth endpoints protected against brute-force via request-rate middleware.
- **Audit Logging**: All state-mutating operations are persisted to an immutable `AuditLog` table (actor, IP, action, resource, diff).
- **Multi-Tenant Isolation**: All database queries include an explicit `businessId` predicate — cross-tenant data access is structurally impossible at the ORM layer.
- **Redis Session Blacklist**: Signed-out tokens are blacklisted for the remainder of their TTL.

---

## 📄 License & Documentation

Refer to the [`docs/`](./docs) folder for detailed guides:
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Backup & Disaster Recovery](./docs/BACKUP_AND_RECOVERY.md)
- [Database Migrations](./docs/MIGRATIONS.md)
- [Monitoring & Logging](./docs/MONITORING_AND_LOGGING.md)
