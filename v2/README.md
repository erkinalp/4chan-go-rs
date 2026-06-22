# Modernization Project v2

This directory contains the modernized version of the application, implementing a modern architecture based on microservices and micro-frontends.

## Quick Start

```bash
# Start the full development stack
cd infrastructure
docker compose up -d

# Run integration tests
cd ../tests/integration
npm install
npm test

# Run load tests (requires k6)
cd ../load
./run-load-tests.sh
```

## Project Structure

### Services

- **api-core** — Central API (TypeScript/NestJS)
  - REST API gateway and service orchestration
  - JWT authentication and role-based authorization
  - Business logic for boards, threads, posts, moderation

- **file-service** — File management (Go)
  - File upload validation and virus scanning (ClamAV)
  - Image transformation and optimization
  - S3/MinIO storage with deduplication

- **media-processor** — Media processing (Rust)
  - Thumbnail generation and image analysis
  - High-performance concurrent processing
  - Banned hash detection

- **frontend-modern** — Primary web frontend (React/Vite)
  - State management with Redux Toolkit
  - Integration with Web Components
  - Performance-optimized SPA

- **microfrontends** — Modular UI components
  - shell — Host application orchestrating micro-frontends
  - board-viewer — Board and thread visualization
  - post-creator — Post composition with file upload
  - auth — Authentication flows
  - moderation — Moderation tools panel

### Supporting

- **api-specs** — OpenAPI 3.0 specifications for all endpoints
- **docs** — Technical documentation (deployment, migration, API reference, moderation)
- **infrastructure** — Docker Compose, Kubernetes manifests, Nginx gateway, monitoring
- **tests** — Integration, load, and security test suites
- **migrations** — Legacy MySQL → PostgreSQL migration scripts

## Main Technologies

- Backend: TypeScript (NestJS), Go (Gin), Rust (Actix-web)
- Frontend: React, TypeScript, Vite, Web Components
- Storage: PostgreSQL, Redis, S3/MinIO
- Infrastructure: Docker, Kubernetes, Nginx/OpenResty (Lua)
- Monitoring: Prometheus, Grafana
- Testing: Jest, k6, Supertest

## Documentation

| Document | Description |
|---|---|
| [Deployment Guide](docs/deployment-guide.md) | Production deployment steps |
| [Migration Guide](docs/migration-guide.md) | Legacy to v2 migration |
| [API Reference](docs/api-reference.md) | All API endpoints with examples |
| [Moderator Guide](docs/moderator-guide.md) | Moderation tools usage |
| [Architecture](docs/architecture/) | System design documentation |
| [Security](docs/security/) | Security model and practices |

## Development

Each service has its own README with specific instructions:

```bash
# API Core (NestJS)
cd api-core && npm install && npm run start:dev

# File Service (Go)
cd file-service && go run cmd/server/main.go

# Media Processor (Rust)
cd media-processor && cargo run

# Frontend
cd frontend-modern && npm install && npm run dev
```

## Testing

```bash
# Integration tests (requires Docker for postgres/redis/minio)
cd tests/integration
npm install
npm test

# Security tests
cd tests/security
npm install
npm test

# Load tests (requires k6: https://k6.io)
cd tests/load
./run-load-tests.sh
```

## Monitoring

Grafana dashboards and Prometheus alerting rules are pre-configured:

- **Service Health** dashboard — Up/down status, request rates, error rates
- **Performance** dashboard — P50/P95/P99 latency, throughput, connection pools
- **SLO Alerts** — Availability <99.9%, latency P95 >200ms, error rate >1%
