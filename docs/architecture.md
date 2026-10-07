# POS System Architecture Overview

## Monorepo Architecture

The Point of Sale system is organized as a high-performance TypeScript monorepo managed by `pnpm`:

```
/
├── apps/
│   ├── web/               # Next.js 14 touch-first web interface (PWA ready)
│   └── api/               # Express + Prisma REST API server & WebSockets
├── packages/
│   ├── types/             # Shared TypeScript models, contracts, DTOs
│   ├── config/            # Environment variable validation & system constants
│   ├── validation/        # Shared Zod validation schemas
│   └── ui/                # Reusable accessible UI components
├── prisma/                # PostgreSQL schema & migration history
├── docker/                # Multi-stage production container definitions
├── docs/                  # Architecture & operational guides
└── scripts/               # Automation, runner, and diagnostic scripts
```

## Service Boundaries

1. **`apps/web` (Frontend)**
   - Built on Next.js 14 App Router and Tailwind CSS.
   - Communicates with `apps/api` via REST.
   - Offline-first storage powered by IndexedDB.
   - Hardware listeners for physical USB/Bluetooth barcode scanners and ESC/POS thermal printers.

2. **`apps/api` (Backend)**
   - Express server with structured Pino logging.
   - Strict server-side financial calculations (taxes, discounts, change, currency conversions).
   - Atomic database transactions using Prisma.
   - Redis caching for product catalog and session storage, with transparent in-memory fallback.

3. **`prisma/` (Database Layer)**
   - PostgreSQL 16 database.
   - Multi-tenant data model supporting multiple businesses and branches (`Store`).
   - Audit log tracking for all financial and operational events.

4. **Shared Packages (`packages/*`)**
   - `@pos/types`: Single source of truth for interfaces and shared contracts.
   - `@pos/config`: Zod-validated configuration loaded from environment variables.
   - `@pos/validation`: Shared validation rules between client and server.
   - `@pos/ui`: Component primitives ensuring visual consistency.
