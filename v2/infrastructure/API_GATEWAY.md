# API Gateway Documentation

## Overview

The API Gateway is implemented using nginx and provides centralized routing, authentication, rate limiting, and monitoring for the 4chan v2 microservices architecture.

## Architecture

### Services Routing

- **Frontend**: `/` → `frontend:3000`
- **Authentication**: `/api/v1/auth/` → `auth:3000`
- **API Core**: `/api/v1/` → `api:3000` (boards, threads, posts, etc.)
- **File Service**: `/api/v1/files/` → `files:8080`
- **Media Processor**: `/api/v1/media/` → `media-processor:8081`

### Rate Limiting

The gateway implements multiple rate limiting zones:

- **Global Limit**: 50 requests/second per IP
- **API Limit**: 10 requests/second per IP for general API endpoints
- **Auth Limit**: 5 requests/second per IP for authentication endpoints
- **Files Limit**: 20 requests/second per IP for file operations

### Authentication

JWT Bearer token validation is enforced at the gateway level for protected endpoints:

- **Public endpoints** (no auth required):
  - `/health`
  - `/api/v1/health`
  - `/api/v1/boards` (read-only)
  - `/api/v1/files/public/`

- **Protected endpoints** (JWT required):
  - All other `/api/v1/` endpoints
  - File upload/management endpoints
  - Media processing endpoints

### Load Balancing

Each service has an upstream configuration with:
- Health checks (max_fails=3, fail_timeout=30s)
- Connection pooling (keepalive=32)
- Round-robin load balancing (ready for horizontal scaling)

### Security Features

- **DoS Protection**: Connection limiting (10 connections per IP)
- **Request Size Limits**: 100MB max body size for file uploads
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- **JWT Validation**: Bearer token format validation

### Monitoring and Logging

- **Structured Logging**: JSON format with request details, timing, and status
- **Prometheus Metrics**: Available at `/nginx_status` endpoint
- **Health Checks**: Simple health endpoint at `/health`
- **Alerting**: Prometheus alerts for error rates, rate limiting, and latency

## Configuration Files

- **Main Config**: `/v2/infrastructure/docker/nginx/conf.d/default.conf`
- **Docker Compose**: Updated service definitions in `docker-compose.yml`
- **Prometheus**: Updated scraping configuration
- **Alerts**: Gateway-specific alerts in Prometheus rules

## Testing

### Rate Limiting Test
```bash
# Test rate limiting
for i in {1..15}; do curl -w "%{http_code}\n" http://localhost/api/v1/health; done
```

### Authentication Test
```bash
# Test without token (should return 401)
curl -w "%{http_code}\n" http://localhost/api/v1/boards/1

# Test with token
curl -H "Authorization: Bearer your-jwt-token" http://localhost/api/v1/boards/1
```

### Load Balancing Test
```bash
# Test service routing
curl http://localhost/api/v1/health
curl http://localhost/api/v1/files/health
curl http://localhost/api/v1/auth/health
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**: Check if backend services are running
2. **429 Too Many Requests**: Rate limiting triggered, reduce request frequency
3. **401 Unauthorized**: Missing or invalid JWT token
4. **404 Not Found**: Check route configuration and service endpoints

### Log Analysis

Gateway logs are in JSON format for easy parsing:
```bash
# View access logs
docker compose logs nginx | grep gateway_access

# View error logs
docker compose logs nginx | grep gateway_error
```

### Metrics Monitoring

Access nginx metrics at:
- `http://localhost/nginx_status` - Basic nginx stats
- Prometheus dashboard for detailed metrics and alerts

## Scaling

To add more service instances:

1. Update upstream blocks in nginx config:
```nginx
upstream api_backend {
    server api:3000 max_fails=3 fail_timeout=30s;
    server api2:3000 max_fails=3 fail_timeout=30s;  # Add new instance
    keepalive 32;
}
```

2. Add new service instances to docker-compose.yml
3. Restart nginx to reload configuration

## Security Considerations

- JWT secrets should be properly configured in environment variables
- Rate limiting thresholds should be adjusted based on expected traffic
- SSL/TLS should be configured for production deployments
- Access to metrics endpoints is restricted to internal networks
- Regular security audits of nginx configuration recommended
