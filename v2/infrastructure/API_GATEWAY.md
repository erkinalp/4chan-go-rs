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

The gateway implements a custom fixed-window rate limiter with aggressive blocking behavior:

- **API Endpoints**: 10 requests per 60-second window
- **Auth Endpoints**: 5 requests per 60-second window  
- **File Operations**: 20 requests per 60-second window
- **Global Fallback**: 50 requests per 60-second window

**Fixed-Window Blocking Features**:
- When any IP exceeds the rate limit, it is completely blocked for a full window duration
- If a blocked IP makes any request during the blocked period, the block is extended for another full window
- Window alignment is user-specific: for new IPs, windows align to their first request time; for IPs with previous blocks, new windows start from the end of the last block
- This provides more aggressive protection than standard token bucket rate limiting, specifically designed to defend against coordinated raid attacks

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
- **Rate Limiter**: `/v2/infrastructure/docker/nginx/lua/fixed_window_rate_limiter.lua`
- **Docker Compose**: Updated service definitions in `docker-compose.yml` (uses OpenResty)
- **Prometheus**: Updated scraping configuration
- **Alerts**: Gateway-specific alerts in Prometheus rules

## Testing

### Rate Limiting Test
```bash
# Test fixed-window rate limiting (should block IP after exceeding limit)
for i in {1..15}; do curl -w "%{http_code}\n" http://localhost/api/v1/health; done

# Test blocking behavior - subsequent requests should return 429 for full window
curl -w "%{http_code}\n" http://localhost/api/v1/health

# Test block extension - requests during blocked period extend the block
for i in {1..5}; do curl -w "%{http_code}\n" http://localhost/api/v1/health; sleep 10; done
```

### Authentication Test
```bash
# Test without token (should return 401)
curl -w "%{http_code}\n" http://localhost/api/v1/boards/1

# Test with token
curl -H "Authorization: Bearer your-jwt-token" http://localhost/api/v1/boards/1
```

### Backend User-Based Rate Limiting Test
```bash
# Run the comprehensive test script
chmod +x /v2/api-core/test-user-rate-limiting.sh
./v2/api-core/test-user-rate-limiting.sh

# Or test manually with JWT tokens:
JWT_TOKEN="your-jwt-token-here"

# Test Go file service user rate limiting (50 requests/60s)
for i in {1..55}; do curl -H "Authorization: Bearer $JWT_TOKEN" -w "%{http_code}\n" http://localhost:8080/api/v1/health; done

# Test Rust media processor user rate limiting (20 requests/60s)  
for i in {1..25}; do curl -H "Authorization: Bearer $JWT_TOKEN" -w "%{http_code}\n" http://localhost:8081/api/v1/health; done

# Test NestJS API core user rate limiting (100 requests/60s)
for i in {1..105}; do curl -H "Authorization: Bearer $JWT_TOKEN" -w "%{http_code}\n" http://localhost:3000/api/v1/health; done

# Test fallback IP-based rate limiting for unauthenticated requests
for i in {1..55}; do curl -w "%{http_code}\n" http://localhost:8080/api/v1/health; done

# Test block extension behavior
curl -H "Authorization: Bearer $JWT_TOKEN" -w "%{http_code}\n" http://localhost:8080/api/v1/health
```

#### JWT Token Format for Testing
The user-based rate limiting expects JWT tokens with the following claims:
```json
{
  "sub": "user-id-uuid",
  "role": "USER",
  "created_at": 1704067200,
  "exp": 1755357400,
  "iat": 1755357400
}
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
2. **429 Too Many Requests**: Fixed-window rate limit exceeded, IP blocked for remainder of window
3. **401 Unauthorized**: Missing or invalid JWT token
4. **404 Not Found**: Check route configuration and service endpoints
5. **Rate Limiter Issues**: Check Redis connectivity and Lua script loading

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
