# Enterprise Point of Sale (POS) Platform - Foundation

A modern, production-ready Point of Sale (POS) architecture engineered as a high-performance TypeScript monorepo with **pnpm**, **Next.js 14**, **Node.js / Express**, **Prisma ORM**, **PostgreSQL**, and **Redis**.

This foundation is designed to scale across diverse form factors (mobile, tablets, desktop, commercial touchscreen terminals) and integrate with retail hardware (USB/Bluetooth barcode scanners, ESC/POS thermal printers, cash drawers, customer-facing displays).

---

## 🏗️ Architecture Overview

The codebase is organized as a clean, modular monorepo:

```
/
├── apps/
│   ├── web/                     # Next.js 14 touch-first web application (App Router)
│   └── api/                     # Node.js + Express REST API server with Pino logger
├── packages/
│   ├── types/                   # Shared TypeScript models, contracts, DTOs
│   ├── config/                  # Environment variable schema (Zod) & system defaults
│   ├── validation/              # Shared Zod validation schemas
│   └── ui/                      # Reusable accessible UI primitives (StatusBadge, Card, Button)
├── prisma/                      # PostgreSQL schema & migration history
│   └── migrations/              # Verifiable database migrations
├── docs/                        # Architecture documentation & developer guides
├── scripts/                     # Automation, database runner, connection diagnostics
├── docker/                      # Production multi-stage Dockerfiles (Dockerfile.api, Dockerfile.web)
├── .env.example                 # Development environment variable template
├── .env.production.example      # Production environment variable template
├── docker-compose.yml           # Local multi-service orchestration (Postgres, Redis, API, Web)
├── package.json                 # Monorepo root workspace configuration
└── pnpm-workspace.yaml          # pnpm workspace definition
```

---

## 📋 Requirements

- **Node.js**: `v20.x` or higher (Active LTS)
- **pnpm**: `v9.x` or higher (`npm install -g pnpm`)
- **Database**: PostgreSQL `16.x` (or built-in local Embedded Postgres runner)
- **Cache**: Redis `7.x` (optional for local dev; includes an automatic in-memory cache fallback)

---

## 🚀 Installation & Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/gouvkimsea/POS-system-ABA-payway.git
cd POS-system-ABA-payway

# Install all workspace dependencies and link internal packages
pnpm install
```

### 2. Environment Configuration

Copy the development environment template:

```bash
cp .env.example .env
```

Review and adjust variables in `.env` as required:

| Variable                    | Default Value                                                        | Description                                               |
| :-------------------------- | :------------------------------------------------------------------- | :-------------------------------------------------------- |
| `NODE_ENV`                  | `development`                                                        | Runtime environment (`development`, `production`, `test`) |
| `API_PORT`                  | `4000`                                                               | Port for the backend Express API server                   |
| `WEB_PORT`                  | `3000`                                                               | Port for the Next.js web application                      |
| `DATABASE_URL`              | `postgresql://postgres:postgres@localhost:5432/pos_db?schema=public` | PostgreSQL connection string                              |
| `REDIS_URL`                 | `redis://localhost:6379`                                             | Redis connection URL                                      |
| `DEFAULT_TIMEZONE`          | `Asia/Phnom_Penh`                                                    | Default system timezone                                   |
| `DEFAULT_CURRENCY`          | `USD`                                                                | Base store currency                                       |
| `DEFAULT_EXCHANGE_RATE_KHR` | `4100`                                                               | Exchange rate (1 USD = 4,100 KHR)                         |
| `NEXT_PUBLIC_API_URL`       | `http://localhost:4000/api`                                          | API URL consumed by the web client                        |

---

## 🗄️ Database Setup & Migrations

### Start Local PostgreSQL

If running without external PostgreSQL or Docker, start the embedded PostgreSQL engine:

```bash
pnpm db:start
```

### Apply Migrations & Generate Client

```bash
# Generate Prisma Client
pnpm db:generate

# Apply migrations
pnpm db:migrate
```

### Database Management Tools

```bash
# Launch Prisma Studio web GUI
pnpm db:studio
```

---

## 💻 Development Commands

| Command               | Description                                                                             |
| :-------------------- | :-------------------------------------------------------------------------------------- |
| `pnpm dev`            | Start both Backend API and Web Frontend concurrently in development mode                |
| `pnpm dev:api`        | Start only the Backend API server with live reload (`http://localhost:4000`)            |
| `pnpm dev:web`        | Start only the Web Frontend (`http://localhost:3000`)                                   |
| `pnpm build:packages` | Compile all shared packages (`@pos/types`, `@pos/config`, `@pos/validation`, `@pos/ui`) |
| `pnpm build`          | Full production build of all packages and applications                                  |
| `pnpm typecheck`      | Run TypeScript type checks across all workspaces                                        |
| `pnpm lint`           | Run ESLint across all TypeScript and JavaScript files                                   |
| `pnpm format`         | Format the entire codebase with Prettier                                                |
| `pnpm format:check`   | Verify formatting consistency with Prettier                                             |

---

## 🧪 Testing & Verification Commands

### Infrastructure Connectivity Diagnostics

Run the automated diagnostic suite to verify connections to PostgreSQL and Redis:

```bash
pnpm test:connections
```

### Verify Endpoints

- **API Health Check**: `GET http://localhost:4000/api/health`
- **API Metadata**: `GET http://localhost:4000/api`
- **Frontend Foundation Dashboard**: `http://localhost:3000`

---

## 🐳 Docker Deployment

To launch the full stack (PostgreSQL, Redis, API, and Web) using Docker Compose:

```bash
docker-compose up -d --build
```

---

## 📜 Stage 1 Foundation Checklist

- [x] Monorepo workspace configuration with `pnpm`
- [x] Clean directory layout (`apps/web`, `apps/api`, `packages/types`, `packages/config`, `packages/validation`, `packages/ui`)
- [x] Strict TypeScript configuration with project references
- [x] ESLint and Prettier rules configured and passing with zero errors
- [x] PostgreSQL database connection layer with Prisma ORM
- [x] Initial migration created (`20261007000000_init_foundation`)
- [x] Redis connection layer with graceful in-memory fallback
- [x] Backend structured logging using Pino
- [x] Backend `/api/health` diagnostic endpoint
- [x] Initial Next.js foundation page verifying full-stack connectivity
- [x] Development (`.env.example`) and Production (`.env.production.example`) templates
- [x] Production multi-stage Dockerfiles and `docker-compose.yml`
