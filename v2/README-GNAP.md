# GNAP Implementation for 4chan v2

This document describes the GNAP (Grant Negotiation and Authorization Protocol) implementation for the 4chan v2 system.

## Overview

GNAP has been implemented as the primary authorization method across all microservices:
- Go services (file-service, api-core/go-service)
- TypeScript/NestJS service (api-core/nodejs-service)
- Rust service (media-processor)
- Frontend authentication microfrontend

## Architecture

### Shared Types
- `v2/api-core/shared/gnap-types.ts` - Common GNAP interfaces and types

### Go Implementation
- `v2/file-service/internal/auth/jwt.go` - Replaced JWT with GNAP client
- `v2/api-core/services/go-service/internal/auth/gnap.go` - GNAP client implementation
- `v2/api-core/services/go-service/internal/api/middleware/stubs.go` - GNAP authentication middleware

### TypeScript/NestJS Implementation
- `v2/api-core/services/nodejs-service/src/auth/gnap.service.ts` - GNAP service
- `v2/api-core/services/nodejs-service/src/auth/gnap.guard.ts` - Authentication guard
- `v2/api-core/services/nodejs-service/src/auth/gnap.decorator.ts` - User context decorator
- `v2/api-core/services/nodejs-service/src/auth/auth.module.ts` - Authentication module
- `v2/api-core/services/nodejs-service/src/controllers/auth.controller.ts` - Auth endpoints

### Rust Implementation
- `v2/media-processor/src/routes/auth.rs` - GNAP client and authentication routes

### Frontend Implementation
- `v2/microfrontends/auth/src/index.ts` - GNAP-based authentication microfrontend

## GNAP Flow

1. **Grant Request**: Client requests access with user identification
2. **Interaction**: User is redirected for authorization (if needed)
3. **Grant Continuation**: Client continues the grant after user interaction
4. **Access Token**: Client receives access token for API calls
5. **Token Validation**: Services validate tokens via introspection

## Environment Variables

All services require these environment variables:
- `GNAP_SERVER_URL` - URL of the GNAP authorization server
- `GNAP_CLIENT_KEY` - Client authentication key
- `GNAP_CLIENT_SECRET` - Client secret

## API Endpoints

### Authentication Endpoints
- `POST /auth/grant` - Request GNAP authorization
- `POST /auth/continue` - Continue GNAP grant flow
- `POST /auth/introspect` - Validate GNAP token
- `GET /auth/user` - Get current user info

### Protected Endpoints
All API endpoints now use GNAP tokens with the format:
```
Authorization: GNAP <access_token>
```

## Testing

Use the provided `docker-compose.gnap.yml` to test the complete GNAP implementation:

```bash
docker-compose -f docker-compose.gnap.yml up
```

## Migration Notes

- JWT authentication has been completely replaced with GNAP
- No backward compatibility is maintained as this is a new instance
- All services use consistent GNAP token validation
- Frontend uses modern GNAP interaction flows instead of simple username/password
