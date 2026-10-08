# Enterprise POS System — Monitoring, Logging & Observability Guide

This guide establishes the production monitoring standards, structured logging architecture, health probes, and incident alerting rules for the POS platform.

---

## 1. Health-Check Probes & SLA Endpoints

The API service provides dedicated endpoints for container orchestrators (Kubernetes, Docker Swarm, AWS ECS) and uptime monitoring tools:

| Endpoint                  | Purpose                    | Target Response                                                           | HTTP Code                    | Frequency            |
| :------------------------ | :------------------------- | :------------------------------------------------------------------------ | :--------------------------- | :------------------- |
| `GET /api/health`         | **Detailed System Status** | Full JSON with DB latency, Redis status, memory RSS/heap, uptime, version | 200 (OK) / 503 (Error)       | Every 30s            |
| `GET /api/health/live`    | **Liveness Probe**         | Process alive check (restarts container if unresponsive)                  | 200 (`{"status":"ok"}`)      | Every 10s            |
| `GET /api/health/ready`   | **Readiness Probe**        | DB connectivity check (routes traffic only when DB is connected)          | 200 (`{"status":"ready"}`)   | Every 5s             |
| `GET /api/health/startup` | **Startup Probe**          | Initial container boot verification                                       | 200 (`{"status":"started"}`) | Every 3s during boot |

### Example Health Response (`GET /api/health`):

```json
{
  "status": "ok",
  "timestamp": "2026-10-08T05:34:38.689Z",
  "uptimeSeconds": 1420,
  "environment": "production",
  "services": {
    "database": {
      "status": "connected",
      "latencyMs": 4
    },
    "redis": {
      "status": "connected",
      "latencyMs": 1
    }
  },
  "version": "1.0.0",
  "memory": {
    "rssMb": 118,
    "heapUsedMb": 24,
    "heapTotalMb": 28
  }
}
```

---

## 2. Structured Logging Architecture

The API uses **Pino** for zero-overhead JSON logging.

### Log Levels

- `error`: Uncaught exceptions, database disconnection, payment gateway timeouts, failed financial reconciliations.
- `warn`: Rate limit hits, authentication failures, in-memory cache fallbacks, negative inventory warnings.
- `info`: Server startup, HTTP request completion with latency, session opening/closing, transaction commits.
- `debug`: Detailed query timings, barcode parser raw events (disabled in production).

### Production Log Format (NDJSON)

```json
{
  "level": 30,
  "time": 1760000000000,
  "pid": 1,
  "hostname": "pos-api-prod-01",
  "method": "POST",
  "url": "/api/pos/checkout",
  "status": 201,
  "durationMs": 34,
  "msg": "POST /api/pos/checkout 201 - 34ms"
}
```

### Log Forwarding & Ingestion

In production containers, logs are piped to stdout and collected by:

- **Grafana Loki** with Promtail
- **Elasticsearch / Filebeat** (ELK Stack)
- **AWS CloudWatch Logs** or **Datadog Agent**

---

## 3. Key Performance Indicators (KPIs) & Alerting Rules

### Tier 1: Critical Alerts (P1 - Immediate On-Call Page)

| Metric                       | Threshold                                     | Action                                        |
| :--------------------------- | :-------------------------------------------- | :-------------------------------------------- |
| **API Readiness**            | `status != ready` for > 30 seconds            | Automated container restart + PagerDuty alert |
| **HTTP 5xx Error Rate**      | > 2% of total requests over 3 minutes         | Immediate engineer investigation              |
| **Database Pool Exhaustion** | Active connections > 90% of `max_connections` | Connection pool inspection                    |
| **High Latency (P99)**       | `/api/pos/checkout` P99 latency > 2,000ms     | Performance trace / lock contention check     |

### Tier 2: Warning Alerts (P2 - Business Hours Alert)

| Metric                   | Threshold                                       | Action                                      |
| :----------------------- | :---------------------------------------------- | :------------------------------------------ |
| **Memory RSS**           | Container memory > 85% of limit                 | Check for memory leaks                      |
| **Redis Connectivity**   | `status == in-memory-fallback`                  | Check Redis container status                |
| **Offline Sync Backlog** | Unsynced transactions > 50 records per terminal | Check network link at affected store branch |
| **Failed Logins**        | > 10 failed logins for single account in 15 min | Security inspection for brute-force attempt |

---

## 4. PostgreSQL Performance Monitoring

Enable `pg_stat_statements` in `postgresql.conf` to identify slow queries:

```sql
SELECT
    query,
    calls,
    total_exec_time / calls as avg_time_ms,
    rows / calls as avg_rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

Alert if any frequent POS query (`product lookup`, `order commit`) exceeds **50ms**.
