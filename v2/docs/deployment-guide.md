# Production Deployment Guide

This guide covers deploying the 4chan v2 platform to production, including all microservices, infrastructure dependencies, and monitoring.

## Architecture Overview

```
                    ┌──────────────┐
                    │   Nginx/Lua  │  (Rate limiting, routing)
                    │   Gateway    │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
    │  API Core    │ │  File    │ │   Media    │
    │  (NestJS)    │ │  Service │ │  Processor │
    │              │ │  (Go)    │ │  (Rust)    │
    └──────┬───────┘ └────┬─────┘ └─────┬──────┘
           │              │              │
    ┌──────▼──────────────▼──────────────▼──────┐
    │         PostgreSQL  │  Redis  │  MinIO    │
    └───────────────────────────────────────────┘
```

## Prerequisites

- Docker 24+ and Docker Compose v2
- Kubernetes 1.28+ (for K8s deployment)
- Domain name with DNS configured
- TLS certificates (Let's Encrypt recommended)
- Minimum resources:
  - 4 CPU cores, 8 GB RAM, 100 GB SSD (single-node)
  - 8+ CPU cores, 16+ GB RAM (production cluster)

## Environment Variables

All services require configuration via environment variables. Create a `.env.production` file (never commit this):

```bash
# Database
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://:<password>@<host>:6379/0

# S3/MinIO
S3_ENDPOINT=https://<minio-host>:9000
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
S3_BUCKET=uploads
S3_THUMB_BUCKET=thumbnails
S3_REGION=us-east-1

# JWT Authentication
JWT_SECRET=<generate-with: openssl rand -hex 64>
JWT_EXPIRY=900
JWT_REFRESH_EXPIRY=604800

# API Core
API_PORT=3000
NODE_ENV=production
CORS_ORIGINS=https://your-domain.com

# File Service
FILE_SERVICE_PORT=8080
MAX_FILE_SIZE=10485760
ALLOWED_EXTENSIONS=.jpg,.jpeg,.png,.gif,.webm,.webp,.pdf

# Media Processor
MEDIA_PROCESSOR_PORT=8081
THUMBNAIL_WIDTH=250
THUMBNAIL_HEIGHT=250
THUMBNAIL_QUALITY=85

# ClamAV (malware scanning)
CLAMAV_HOST=clamav
CLAMAV_PORT=3310

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Docker Compose Deployment

### 1. Clone and configure

```bash
git clone https://github.com/erkinalp/4chan-go-rs.git
cd 4chan-go-rs/v2
cp .env.example .env.production
# Edit .env.production with your values
```

### 2. Build and start services

```bash
docker compose -f infrastructure/docker-compose.yml \
  --env-file .env.production \
  up -d --build
```

### 3. Run database migrations

```bash
docker compose exec api-core npx prisma migrate deploy
```

### 4. Verify deployment

```bash
curl -f http://localhost:3000/api/v1/health
```

## Kubernetes Deployment

### 1. Create namespace and secrets

```bash
kubectl create namespace 4chan-v2

# Create secrets from env file
kubectl create secret generic app-secrets \
  --from-env-file=.env.production \
  -n 4chan-v2
```

### 2. Apply manifests

```bash
kubectl apply -f v2/infrastructure/kubernetes/ -n 4chan-v2
```

### 3. Verify pods

```bash
kubectl get pods -n 4chan-v2
kubectl logs -f deployment/api-core -n 4chan-v2
```

## TLS/HTTPS Setup

### With Nginx (Docker)

Place certificates at `/etc/nginx/ssl/` and configure in the Nginx gateway:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    location /api/ {
        proxy_pass http://api-core:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### With cert-manager (Kubernetes)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Apply ClusterIssuer for Let's Encrypt
kubectl apply -f v2/infrastructure/kubernetes/cert-issuer.yaml
```

## Monitoring Setup

### Prometheus

Prometheus is included in the Docker Compose stack. Configure scrape targets in `v2/infrastructure/docker/prometheus/prometheus.yml`.

Access Prometheus UI: `http://localhost:9090`

### Grafana

Grafana dashboards are auto-provisioned from `v2/infrastructure/docker/grafana/dashboards/`.

Access Grafana: `http://localhost:3001` (default credentials in your `.env`)

Available dashboards:
- **Service Health** — Up/down status, request counts, error rates
- **Performance** — P50/P95/P99 latency, throughput, connection pools

### Alerting

Prometheus alerting rules are in `v2/infrastructure/docker/prometheus/alerts/slo-alerts.yml`.

Configure alert delivery via Alertmanager:
```yaml
# alertmanager.yml
route:
  receiver: 'ops-team'
receivers:
  - name: 'ops-team'
    webhook_configs:
      - url: 'https://your-webhook-endpoint'
```

## Health Checks

All services expose health endpoints:

| Service | Endpoint | Expected |
|---|---|---|
| API Core | `GET /api/v1/health` | `{"status":"ok"}` |
| File Service | `GET /health` | `{"status":"ok"}` |
| Media Processor | `GET /health` | `{"status":"ok"}` |

## Backup Strategy

### Database

```bash
# Automated daily backup
pg_dump -Fc $DATABASE_URL > backup_$(date +%Y%m%d).dump

# Restore
pg_restore -d $DATABASE_URL backup_20240101.dump
```

### S3/MinIO Files

Use `mc mirror` for MinIO or AWS S3 replication for production.

```bash
mc mirror minio/uploads s3/backup-bucket/uploads
```

## Scaling

### Horizontal scaling

- **API Core**: Scale replicas behind load balancer. Stateless.
- **File Service**: Scale replicas. Uses S3 for storage (stateless).
- **Media Processor**: Scale based on upload queue depth.

### Vertical scaling

- **PostgreSQL**: Increase `shared_buffers`, `work_mem`, connection pool size.
- **Redis**: Increase `maxmemory`. Use Redis Cluster for >64 GB.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| 502 Bad Gateway | Service crashed | Check `docker logs <service>` |
| Slow responses | DB connection pool exhaustion | Increase `DATABASE_POOL_SIZE` |
| File upload fails | MinIO unreachable or full | Check MinIO health, disk space |
| Rate limit errors | Legitimate traffic spike | Adjust `RATE_LIMIT_MAX_REQUESTS` |
| JWT errors | Clock skew between services | Sync NTP across all nodes |
