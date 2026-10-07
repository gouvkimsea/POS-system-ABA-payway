# Enterprise POS System with ABA Payway & KHQR Integration

A modern, commercial-grade **Point of Sale (POS)** application designed for retail and hospitality, built with a **Next.js 14** touch-first interface and a high-performance **Node.js / Express / Prisma** backend with **PostgreSQL**.

Supports dual-currency transactions (**USD & Khmer Riel KHR**), instant digital payments via **KHQR & ABA Pay**, offline-first resilience with **IndexedDB**, real-time WebSocket updates, hardware peripherals, and comprehensive register session cash control.

---

## 🚀 Key Features

### 🛒 Point of Sale & Checkout Experience
- **Touch-First Commercial UI**: Fast, responsive layout optimized for POS touchscreen terminals, tablets, and desktops.
- **Dual-Currency Engine**: Real-time conversions between **USD** and **Cambodian Riel (KHR)** with customizable exchange rates (default `1 USD = 4,100 KHR`).
- **Flexible Payments**:
  - **Cash** (with automated change calculation in both USD and KHR).
  - **KHQR / ABA Pay** (Dynamic QR code generation supporting ABA Mobile, Bakong, Wing, ACLEDA, and all KHQR banking apps).
  - **Card & Split Payments**.
- **Accurate Financial Calculations**: Server-side validation of tax (inclusive/exclusive), discounts (percentage or fixed amount), and rounding rules.

### 📶 Offline-First & Data Sync
- **Local IndexedDB Storage (Dexie.js)**: Cache product catalogs, customer data, and register states locally.
- **Offline Transaction Queue**: Continue ringing up sales without internet access; orders are safely queued with idempotent client UUIDs and synchronized automatically once connectivity is restored.
- **Conflict Resolution**: Backend deduplication and idempotency safeguards.

### 📦 Catalog, Inventory & Multi-Store Management
- **Catalog Hierarchy**: Multi-category, brands, suppliers, product variants, and SKU/barcode mapping.
- **Real-Time Stock Movements**: Automatic stock adjustments upon sale or refund with atomic database transactions.
- **Low-Stock Alerts**: Visual badges and warnings when products fall below safe thresholds.
- **Multi-Store & Register Support**: Multi-tenant architecture supporting multiple businesses, branch stores, and physical cash registers.

### 💵 Cash Register & Shift Sessions
- **Shift Opening & Closing**: Log opening float (USD & KHR), track cash in/out, and reconcile expected vs. counted cash at shift closing.
- **Cash Drawer & Cash Movements**: Record cash drops, pay-outs, and float adjustments with audit trails.
- **Quick Lock Screen**: PIN-based fast cashier switching and terminal lock.

### 🖨️ Hardware Peripheral Integrations
- **Barcode Scanners**: Seamless support for handheld USB/Bluetooth hardware scanners and on-device camera scanning (`html5-qrcode`).
- **Thermal Receipt Printing**: Clean printable receipt templates with store headers/footers, tax breakdown, and QR code verification.
- **Cash Drawer Triggers**: Browser print / ESC-POS trigger integration.

### 🔐 Security & Auditability
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for Cashier, Manager, Admin, and Super Admin.
- **JWT & PIN Authentication**: Secure access tokens with refresh rotation and fast 4–6 digit PIN terminal unlock.
- **Audit Logs**: Traceable event logs for sales, refunds, voids, inventory adjustments, and register drawer openings.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, React 18)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Offline Storage**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **Barcode Scanner**: [html5-qrcode](https://github.com/mebjas/html5-qrcode)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/)
- **Web Framework**: [Express.js](https://expressjs.com/)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Validation**: [Zod](https://zod.dev/)
- **Realtime**: [WebSockets (ws)](https://github.com/websockets/ws)
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs`
- **Logger**: [Pino](https://github.com/pinojs/pino)

### Infrastructure & Tooling
- **Package Manager**: [pnpm](https://pnpm.io/) workspaces
- **Containers**: [Docker](https://www.docker.com/) & Docker Compose
- **Embedded Database**: Embedded PostgreSQL runner for zero-config local development

---

## 📁 Project Structure

```
pos/
├── backend/                  # Express + Prisma REST API server
│   ├── prisma/               # Database schema & seed scripts
│   │   ├── schema.prisma     # Enterprise POS PostgreSQL schema
│   │   └── seed.ts           # Demo seed data (stores, users, products)
│   ├── scripts/              # Embedded database utility scripts
│   └── src/
│       ├── config/           # Environment and database configs
│       ├── middleware/       # Auth, RBAC, error handling, validation
│       ├── modules/
│       │   ├── auth/         # Login, PIN auth, JWT token management
│       │   ├── products/     # Catalog and inventory endpoints
│       │   ├── registers/    # Register shifts and cash movements
│       │   ├── reports/      # Sales & inventory summary analytics
│       │   ├── sales/        # Checkout transactions, orders, refunds
│       │   └── sync/         # Offline queue synchronization
│       ├── utils/            # Calculation engine (USD/KHR, taxes, change)
│       └── websocket/        # Real-time WebSocket server
├── frontend/                 # Next.js 14 Touch-First Web Application
│   └── src/
│       ├── app/              # Next.js App Router (layout, styling, root page)
│       ├── components/       # POS components (Cart, Checkout, Catalog, Modals)
│       └── lib/              # API clients, Dexie DB, hardware listeners, sync
├── docker-compose.yml        # Multi-container Docker deployment
├── package.json              # Monorepo root workspace configuration
└── pnpm-workspace.yaml       # pnpm monorepo workspace definition
```

---

## 🏁 Quick Start

### Prerequisites
- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.x` or higher (`npm install -g pnpm`)
- *(Optional)* **Docker & Docker Compose** for containerized setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/gouvkimsea/POS-system-ABA-payway.git
cd POS-system-ABA-payway

# Install all workspace dependencies
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root:
```bash
cp .env.example .env
```

Ensure your PostgreSQL database connection URL is properly configured in `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos_db?schema=public
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 3. Setup Database & Seed Data
Initialize the database schema and seed initial sample data (Admin cashier, categories, sample products):
```bash
# Generate Prisma Client & push schema to database
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:push

# Seed demo data
pnpm --filter backend db:seed
```

### 4. Run Development Servers
Start both backend API and frontend dev servers concurrently:
```bash
pnpm dev
```

- **Frontend POS Interface**: [http://localhost:3000](http://localhost:3000)
- **Backend API Server**: [http://localhost:4000](http://localhost:4000)
- **Health Check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🐳 Running with Docker Compose

To run the complete POS stack with PostgreSQL and Redis in Docker:

```bash
docker-compose up -d --build
```

---

## 💳 Payment & KHQR / ABA Payway Flow

1. Cashier adds items to cart from catalog or via barcode scanning.
2. Select **"Pay"** / **"Checkout"**.
3. Choose **"KHQR / ABA Pay"**.
4. The system calculates the exact total in USD and KHR based on the active store exchange rate.
5. A dynamic KHQR code is rendered on screen.
6. The customer scans the QR code with ABA Mobile, Bakong, or any KHQR-compliant bank application.
7. Cashier confirms completion; receipt is generated and printer / cash drawer is triggered.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
