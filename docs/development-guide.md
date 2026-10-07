# Development Guide

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 16 (or local Embedded Postgres runner)

### Initial Setup

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```
2. Install workspace dependencies:
   ```bash
   pnpm install
   ```
3. Initialize the database and run migrations:
   ```bash
   pnpm db:start
   pnpm db:migrate
   ```
4. Verify infrastructure connections:
   ```bash
   pnpm test:connections
   ```
5. Start development servers:
   ```bash
   pnpm dev
   ```

## Development Commands

- `pnpm dev`: Runs both API and Web servers in parallel.
- `pnpm build`: Builds all workspace packages and applications.
- `pnpm lint`: Lints all workspaces with ESLint.
- `pnpm typecheck`: Validates TypeScript types across the monorepo.
- `pnpm format`: Formats code with Prettier.
- `pnpm test:connections`: Validates PostgreSQL and Redis connectivity.
