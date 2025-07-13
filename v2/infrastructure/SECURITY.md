# Security Configuration Guide

## ⚠️ IMPORTANT: Set Secure Credentials Before Deployment

This infrastructure includes default development credentials that **MUST** be changed before any production deployment. Failure to do so will result in serious security vulnerabilities.

## Required Actions Before Deployment

### 1. Local Development Setup

For local development, copy the example environment file:

```bash
cp .env.example .env
```

Then edit `.env` with secure values for all credentials.

### 2. Kubernetes Production Deployment

Before deploying to Kubernetes, you **MUST** set the following environment variables:

```bash
# Database credentials
export POSTGRES_USER="your_secure_db_user"
export POSTGRES_PASSWORD="your_secure_db_password_32_chars_min"
export POSTGRES_DB="4chan"

# JWT secrets (generate with: openssl rand -base64 32)
export JWT_SECRET="$(openssl rand -base64 32)"
export JWT_REFRESH_SECRET="$(openssl rand -base64 32)"

# MinIO credentials
export MINIO_ACCESS_KEY="your_secure_access_key"
export MINIO_SECRET_KEY="your_secure_secret_key_32_chars_min"

# Grafana admin password
export GRAFANA_ADMIN_PASSWORD="your_secure_grafana_password"
```

Then deploy with:
```bash
kubectl apply -k v2/infrastructure/kubernetes/base
```

### 3. Docker Compose Production

For production docker-compose deployment, create a `.env` file in the root directory with all required variables set to secure values.

## Security Checklist

- [ ] All default passwords changed
- [ ] JWT secrets are at least 32 characters and randomly generated
- [ ] Database credentials use strong passwords
- [ ] MinIO access keys are unique and secure
- [ ] Grafana admin password is changed from default
- [ ] Environment variables are set in deployment environment
- [ ] `.env` file is added to `.gitignore` (already done)

## Credential Generation Commands

Generate secure random credentials:

```bash
# Generate JWT secrets
openssl rand -base64 32

# Generate secure passwords
openssl rand -base64 24

# Generate MinIO access key (20 chars alphanumeric)
openssl rand -base64 15 | tr -d "=+/" | cut -c1-20

# Generate MinIO secret key (40 chars)
openssl rand -base64 30 | tr -d "=+/" | cut -c1-40
```

## Default Credentials (CHANGE THESE!)

The following default credentials are used in development and **MUST** be changed:

- **PostgreSQL**: `postgres/postgres`
- **MinIO**: `minioadmin/minioadmin`  
- **Grafana**: `admin/admin`
- **JWT secrets**: Development placeholder values

## Environment Variable Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `POSTGRES_USER` | Database username | Yes | postgres |
| `POSTGRES_PASSWORD` | Database password | Yes | postgres |
| `POSTGRES_DB` | Database name | No | 4chan |
| `JWT_SECRET` | JWT signing secret | Yes | dev_placeholder |
| `JWT_REFRESH_SECRET` | JWT refresh secret | Yes | dev_placeholder |
| `MINIO_ROOT_USER` | MinIO admin user | Yes | minioadmin |
| `MINIO_ROOT_PASSWORD` | MinIO admin password | Yes | minioadmin |
| `MINIO_ACCESS_KEY` | MinIO access key | Yes | minioadmin |
| `MINIO_SECRET_KEY` | MinIO secret key | Yes | minioadmin |
| `GRAFANA_ADMIN_USER` | Grafana admin user | No | admin |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password | Yes | admin |

## Production Deployment Notes

1. **Never commit `.env` files** - They are already in `.gitignore`
2. **Use Kubernetes secrets** for production deployments
3. **Rotate credentials regularly** in production environments
4. **Monitor for credential exposure** in logs and error messages
5. **Use strong, unique passwords** for each service
6. **Enable TLS/SSL** for all external communications

## Troubleshooting

If you encounter authentication errors after changing credentials:

1. Verify all environment variables are set correctly
2. Restart all services after credential changes
3. Check that database migrations can connect with new credentials
4. Verify MinIO buckets are accessible with new keys
5. Test Grafana login with new admin password

## Security Contacts

For security issues or questions about this configuration, please:

1. Check this documentation first
2. Review the main project security policy
3. Contact the project maintainers through appropriate channels
