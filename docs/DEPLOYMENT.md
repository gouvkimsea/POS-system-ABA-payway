# Enterprise POS System — Production Deployment Guide

This guide details the complete, end-to-end production deployment process for the Enterprise Point of Sale system across all infrastructure tiers:

1. **Frontend Web Application** (Next.js 14)
2. **Backend API Service** (Express / Node.js)
3. **Database** (PostgreSQL 16)
4. **Cache & Session Store** (Redis 7)
5. **Hardware & Device Bridge** (Node.js ESC/POS Companion)

---

## 1. System Architecture & Topology

```
                   +----------------------------------+
                   |   HTTPS Load Balancer / Nginx    |
                   |   (SSL Termination / Certbot)    |
                   +----------------+-----------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
  https://pos.domain.com                         https://api.pos.domain.com
            |                                               |
+-----------v------------+                      +-----------v------------+
|  Frontend Container    |                      |   Backend API Service  |
|  (Next.js PWA Port 3000|                      |  (Express Port 4000)   |
+------------------------+                      +-----------+------------+
                                                            |
                                        +-------------------+-------------------+
                                        |                                       |
                              +---------v---------+                   +---------v---------+
                              |   PostgreSQL 16   |                   |      Redis 7      |
                              |    (Port 5432)    |                   |    (Port 6379)    |
                              +-------------------+                   +-------------------+

+-----------------------------------------------------------------------------------------+
| Local Store LAN / Edge Terminal                                                         |
|                                                                                         |
|  +--------------------+        HTTP / WebSockets       +-----------------------------+  |
|  | Tablet / Web Client| -----------------------------> | Device Bridge Service       |  |
|  | (Touchscreen POS)  |                                | (Port 9124 on localhost/LAN)|  |
|  +--------------------+                                +--------------+--------------+  |
|                                                                       |                 |
|                                         +-----------------------------+---------------+ |
|                                         |                             |               | |
|                                   +-----v------+                +-----v------+  +-----v-v----+
|                                   |  ESC/POS   |                |    Cash    |  |  Customer  |
|                                   |  Thermal   |                |   Drawer   |  |  Pole CFD  |
|                                   |  Printer   |                | (RJ11/Kick)|  | (Serial/COM|
|                                   +------------+                +------------+  +------------+
+-----------------------------------------------------------------------------------------+
```

---

## 2. Server Sizing & Minimum Requirements

### Minimum Production Host (Up to 10 Concurrent Terminals)

- **CPU**: 4 vCPU (x86_64 or ARM64)
- **RAM**: 8 GB RAM (PostgreSQL 2GB, Redis 512MB, API 2GB, Web 1.5GB, OS 2GB)
- **Storage**: 100 GB NVMe SSD (Encrypted with LUKS or EBS encryption)
- **OS**: Ubuntu 22.04 LTS / Debian 12 / Rocky Linux 9

### Scale Host (50+ Concurrent Terminals across Multi-Store Chains)

- **Database**: Managed Cloud Database (AWS RDS Aurora PostgreSQL / GCP Cloud SQL) 4 vCPU, 16 GB RAM
- **Redis**: Managed Redis Cluster (ElastiCache / Cloud Memorystore)
- **API & Web**: Distributed Docker containers orchestrated with Kubernetes or Docker Swarm

---

## 3. Tier 1: PostgreSQL Deployment

### Option A: Docker Container (Docker Compose)

Use the included `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml up -d postgres
```

### PostgreSQL Production Tuning Parameters

Add these settings to `/etc/postgresql/postgresql.conf` or Docker container command:

```ini
shared_buffers = 2GB                  # 25% of total server RAM
max_connections = 150
work_mem = 16MB
maintenance_work_mem = 128MB
effective_cache_size = 6GB            # 75% of total server RAM
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1                # Fast SSD / NVMe
effective_io_concurrency = 200
autovacuum = on
```

### Database Initialization & Migration

Run Prisma migration deploy before routing traffic to the API:

```bash
# Apply all pending versioned migrations in production
pnpm prisma migrate deploy
```

---

## 4. Tier 2: Redis Deployment

Redis is used for caching, rate limiting, and real-time session stores.

### Docker Configuration

```bash
docker compose -f docker-compose.prod.yml up -d redis
```

### Configuration Parameters

```ini
requirepass <STRONG_RANDOM_PASSWORD>
appendonly yes                         # Enable AOF persistence to prevent data loss
appendfsync everysec
maxmemory 512mb
maxmemory-policy volatile-lru
```

---

## 5. Tier 3: Backend API Service Deployment

### Step 1: Environment Configuration

Copy `.env.production.example` to `.env.production` on the production server:

```bash
cp .env.production.example .env.production
```

Populate secrets:

```bash
# Generate high-entropy secrets
JWT_SECRET=$(openssl rand -hex 32)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)
```

### Step 2: Build and Run via Docker

```bash
# Build the production image
docker build -f docker/Dockerfile.api -t pos-api:latest .

# Run with environment file
docker run -d \
  --name pos_api \
  --restart always \
  --env-file .env.production \
  -p 4000:4000 \
  pos-api:latest
```

### Step 3: Verify Health

```bash
curl -I http://localhost:4000/api/health/ready
# Expected: HTTP 200 OK {"status":"ready","database":{"status":"connected"}}
```

---

## 6. Tier 4: Frontend Web Application Deployment

### Option A: Containerized Deployment (Recommended)

```bash
# Build the production image with public API URL baked in
docker build \
  -f docker/Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=https://api.pos.yourdomain.com/api \
  -t pos-web:latest .

# Run the container
docker run -d \
  --name pos_web \
  --restart always \
  -p 3000:3000 \
  pos-web:latest
```

### Option B: Node.js Systemd / PM2 Service

```bash
# Install and build
pnpm install --frozen-lockfile
pnpm run build

# Start using PM2
pm2 start pnpm --name "pos-web" --filter @pos/web -- start
```

---

## 7. Tier 5: Hardware & Device Bridge Deployment

The Device Bridge runs locally on the store terminal machine (Windows, Linux, or Raspberry Pi) to control raw hardware:

- Thermal receipt printers (USB, Network IP, Serial)
- Electronic Cash Drawers (RJ11/Kick pulse)
- Customer Display Screens / VFD Pole Displays

### Local Installation on Windows/Linux POS Terminal:

```bash
# 1. Clone repository or copy bridge dist bundle
cd /opt/pos-bridge # or C:\pos-bridge

# 2. Install dependencies & build
pnpm --filter @pos/bridge build

# 3. Start bridge service
pnpm --filter @pos/bridge start
```

### Auto-start as Systemd Service (Linux):

Create `/etc/systemd/system/pos-bridge.service`:

```ini
[Unit]
Description=POS Hardware & ESC/POS Bridge Service
After=network.target

[Service]
Type=simple
User=posuser
WorkingDirectory=/opt/pos/apps/bridge
ExecStart=/usr/bin/node /opt/pos/apps/bridge/dist/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=BRIDGE_PORT=9124

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pos-bridge
sudo systemctl start pos-bridge
```

---

## 8. Reverse Proxy & SSL Configuration (Nginx)

Place Nginx in front of both API and Web containers for TLS termination and HTTP/2:

```nginx
# /etc/nginx/sites-available/pos.conf

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name pos.yourdomain.com api.pos.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Frontend Web Application
server {
    listen 443 ssl http2;
    server_name pos.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/pos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pos.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API Service
server {
    listen 443 ssl http2;
    server_name api.pos.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/pos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pos.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 9. One-Command Production Stack Deployment

With Docker and Docker Compose installed:

```bash
# 1. Clone repository
git clone https://github.com/your-org/POS-system-ABA-payway.git /opt/pos
cd /opt/pos

# 2. Configure production secrets
cp .env.production.example .env
nano .env

# 3. Launch full stack
docker compose -f docker-compose.prod.yml up -d --build

# 4. Check stack status
docker compose -f docker-compose.prod.yml ps
```
