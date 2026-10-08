# Enterprise POS System — Database Backup & Disaster Recovery Guide

This guide establishes the production backup standards, automation scripts, and disaster recovery runbook for the PostgreSQL database (`pos_production_db`).

---

## 1. Backup Strategy & Objectives

| Objective                          | Target Metric            | Description                                                              |
| :--------------------------------- | :----------------------- | :----------------------------------------------------------------------- |
| **Recovery Point Objective (RPO)** | **< 15 minutes**         | Maximum allowable data loss in the event of hardware or cluster failure  |
| **Recovery Time Objective (RTO)**  | **< 30 minutes**         | Maximum allowable system downtime to restore operations from backup      |
| **Retention Policy**               | **30 Daily, 12 Monthly** | Daily backups retained for 30 days, monthly archives retained for 1 year |
| **Storage Redundancy**             | **3-2-1 Rule**           | 3 copies of data, 2 different media (local NVMe & cloud S3), 1 offsite   |

---

## 2. Automated Logical Backup Script (`scripts/backup-database.sh`)

Create `/opt/pos/scripts/backup-database.sh` on the database server:

```bash
#!/usr/bin/env bash
# ==============================================================================
# Enterprise POS Automated Database Backup Script
# Creates a compressed, encrypted logical backup of pos_production_db
# ==============================================================================
set -euo pipefail

# Configuration
BACKUP_DIR="/data/backups/postgres"
DATE_STAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/pos_db_backup_${DATE_STAMP}.sql.gz"
RETENTION_DAYS=30

DB_USER="${POSTGRES_USER:-pos_prod_admin}"
DB_NAME="${POSTGRES_DB:-pos_production_db}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting logical backup for ${DB_NAME} on ${DB_HOST}:${DB_PORT}..."

# Execute pg_dump with custom compression and clean transaction isolation
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  | gzip -9 > "${BACKUP_FILE}"

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup created successfully: ${BACKUP_FILE} (${FILE_SIZE})"

# Optional: Sync to offsite S3 / Cloud Storage
if command -v aws &> /dev/null && [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploading backup to S3 bucket ${S3_BACKUP_BUCKET}..."
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BACKUP_BUCKET}/postgres/$(basename "${BACKUP_FILE}")" --sse AES256
fi

# Clean up backups older than retention period
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Purging backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "pos_db_backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup procedure completed cleanly."
```

Make executable and schedule in cron:

```bash
chmod +x /opt/pos/scripts/backup-database.sh

# Run every 6 hours via crontab
crontab -e
# Add:
0 */6 * * * /opt/pos/scripts/backup-database.sh >> /var/log/pos-db-backup.log 2>&1
```

---

## 3. Database Restoration Procedure

### Scenario 1: Restoring to a Standby or Fresh Instance

```bash
# 1. Uncompress the target backup file
gunzip -k /data/backups/postgres/pos_db_backup_20261008_120000.sql.gz

# 2. Terminate existing application connections
psql -U postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'pos_production_db' AND pid <> pg_backend_pid();
"

# 3. Drop existing corrupted database and recreate
psql -U postgres -c "DROP DATABASE IF EXISTS pos_production_db;"
psql -U postgres -c "CREATE DATABASE pos_production_db WITH ENCODING 'UTF8' LC_COLLATE = 'C' LC_CTYPE = 'C';"

# 4. Restore using pg_restore
pg_restore \
  -U pos_prod_admin \
  -d pos_production_db \
  --clean \
  --if-exists \
  --verbose \
  /data/backups/postgres/pos_db_backup_20261008_120000.sql

# 5. Verify database integrity
pnpm exec tsx scripts/verify-database.ts
```

### Scenario 2: Restoring within Docker Compose Container

```bash
# Copy backup into container
docker cp /data/backups/pos_db_backup_20261008_120000.sql pos_postgres:/tmp/backup.sql

# Execute restore inside container
docker exec -i pos_postgres pg_restore \
  -U pos_prod_admin \
  -d pos_production_db \
  --clean \
  /tmp/backup.sql
```

---

## 4. Point-In-Time Recovery (PITR) with WAL Archiving

For zero-data-loss mission-critical deployments:

1. Configure WAL archiving in `postgresql.conf`:

```ini
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /data/wal_archive/%f && cp %p /data/wal_archive/%f'
archive_timeout = 900
```

2. In disaster recovery, restore the base backup and configure `recovery.signal` with target restore timestamp:

```ini
restore_command = 'cp /data/wal_archive/%f %p'
recovery_target_time = '2026-10-08 11:45:00 UTC'
```

---

## 5. Backup Verification Testing Runbook

Test backups monthly on staging environment:

1. Fetch latest automated backup from S3/local.
2. Spin up isolated test PostgreSQL container on port `5433`.
3. Restore the backup file.
4. Execute `pnpm test:db` against the restored database.
5. If test fails, sound high-severity pager alert immediately.
