# Enterprise POS System — Database Migrations Guide

This document defines the schema change management lifecycle, zero-downtime migration guidelines, and operational runbooks for applying Prisma migrations across environments.

---

## 1. Migration Philosophy & Safety Rules

1. **NEVER use `prisma db push` in Production or Staging**:
   - `prisma db push` bypasses version control, generates no immutable migration SQL files, and can drop columns or tables without warning.
2. **ALWAYS use `prisma migrate deploy` in CI/CD and Production**:
   - `prisma migrate deploy` strictly applies pending migrations recorded in `prisma/migrations` in deterministic chronological order and verifies checksums against `_prisma_migrations`.
3. **All Migrations Must Be Forward-Compatible**:
   - Migrations should not lock high-traffic tables (`orders`, `inventory`, `payments`) for prolonged periods.
   - Use additive, multi-phase changes for breaking schema alterations.

---

## 2. Standard Workflow: Creating and Testing Migrations

### Step 1: Update Schema in Development

Modify `prisma/schema.prisma` with your model or index changes.

### Step 2: Generate Migration SQL File

Run:

```bash
pnpm exec prisma migrate dev --name <descriptive_migration_name>
```

This generates a new folder: `prisma/migrations/<TIMESTAMP>_<descriptive_migration_name>/migration.sql`.

### Step 3: Inspect and Review Generated SQL

Open the generated `migration.sql` and verify:

- Are column additions using `DEFAULT` or `NULL`?
- Are indexes being created concurrently where appropriate?
- Are foreign keys correctly configured with `ON DELETE RESTRICT` or `ON DELETE CASCADE`?

### Step 4: Run Automated Migration & Regression Tests

```bash
# Verify database tests pass cleanly
pnpm test:db
pnpm test:all
```

---

## 3. Production Deployment Execution

In your CI/CD deployment pipeline or production container startup script, execute:

```bash
# 1. Check current migration status
pnpm exec prisma migrate status

# 2. Apply all pending migrations safely
pnpm exec prisma migrate deploy

# 3. Generate updated Prisma Client types
pnpm exec prisma generate
```

---

## 4. Zero-Downtime Migration Pattern: The Expand-Contract Strategy

When modifying high-frequency tables (such as renaming a column or splitting data):

### Phase 1: Expand (Migration 1)

- Add the new column as `NULLABLE` (e.g., `new_column_name VARCHAR`).
- Add triggers or application logic to write to **both** the old and new columns.
- Deploy API service.

### Phase 2: Backfill (Background Job)

- Run a background script to backfill existing records:
  ```sql
  UPDATE products SET new_column_name = old_column_name WHERE new_column_name IS NULL;
  ```

### Phase 3: Contract (Migration 2)

- Update application to read and write **only** from `new_column_name`.
- Remove references to `old_column_name`.
- Deploy updated API service.

### Phase 4: Cleanup (Migration 3)

- Drop `old_column_name` safely in a follow-up migration.

---

## 5. Troubleshooting & Baselining Existing Databases

### If Database Shows Migrations as Unapplied on Already Synced Database:

If a database already has the schema tables created but `_prisma_migrations` is empty:

```bash
# Mark existing migrations as resolved without re-executing SQL:
pnpm exec prisma migrate resolve --applied 20261007000000_init_foundation
pnpm exec prisma migrate resolve --applied 20261007120000_real_database_foundation
```

### If a Migration Failed in Production:

1. Identify the root cause from `_prisma_migrations` log:
   ```sql
   SELECT * FROM _prisma_migrations WHERE finished_at IS NULL;
   ```
2. Manually fix the failing SQL statement in the database.
3. Mark migration as resolved:
   ```bash
   pnpm exec prisma migrate resolve --applied <failed_migration_folder_name>
   ```
   Or mark as rolled back:
   ```bash
   pnpm exec prisma migrate resolve --rolled-back <failed_migration_folder_name>
   ```
