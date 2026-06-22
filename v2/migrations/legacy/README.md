# Legacy MySQL → PostgreSQL Migration Guide

This directory contains scripts to migrate data from the legacy 4chan PHP/MySQL application to the v2 PostgreSQL-based microservices architecture.

## Overview

The migration process follows these stages:

1. **Export** — Extract data from MySQL into CSV files
2. **Transform** — Convert CSV data to PostgreSQL COPY format with UUID mapping
3. **Import** — Load transformed data into PostgreSQL
4. **File Migration** — Move files from local filesystem to S3/MinIO
5. **Verification** — Validate data integrity post-migration

## Prerequisites

- Access to the legacy MySQL database (read-only is sufficient)
- PostgreSQL v2 database with schema already applied
- Node.js 18+ with TypeScript
- S3/MinIO credentials for file migration
- Sufficient disk space for CSV exports (estimate: 2x your MySQL data directory)

## Step-by-Step Instructions

### 1. Export from MySQL

```bash
# Create export directory
mkdir -p /tmp/migration_export

# Run the export (adjust credentials)
mysql -u <user> -p <database> < export-mysql.sql
```

This generates CSV files in `/tmp/migration_export/`:
- `boards.csv`
- `threads.csv`
- `posts.csv`
- `files.csv`
- `bans.csv`
- `reports.csv`

### 2. Transform Data

```bash
# Install dependencies
npm install

# Run transformation
INPUT_DIR=/tmp/migration_export \
OUTPUT_DIR=/tmp/migration_import \
npx ts-node transform.ts
```

This generates PostgreSQL COPY-format files in `/tmp/migration_import/`.

### 3. Import to PostgreSQL

```bash
# Run import (adjust connection details)
psql -h <host> -U <user> -d <database> -f import-postgres.sql
```

The script:
- Creates staging tables for validation
- Loads data via COPY
- Checks referential integrity
- Inserts into production tables
- Reports row counts

### 4. Migrate Files

```bash
# Set environment variables for S3 access
export LEGACY_FILES_DIR=/var/www/4chan/images
export LEGACY_THUMBS_DIR=/var/www/4chan/thumbs
export S3_ENDPOINT=http://minio:9000
export S3_BUCKET=uploads
export S3_THUMB_BUCKET=thumbnails
export S3_ACCESS_KEY=<your-access-key>
export S3_SECRET_KEY=<your-secret-key>
export IMPORT_DIR=/tmp/migration_import
export MIGRATION_CONCURRENCY=20

# Optional: dry run first
DRY_RUN=true npx ts-node migrate-files.ts

# Execute migration
npx ts-node migrate-files.ts
```

### 5. Verify Migration

```bash
export DB_HOST=<host>
export DB_PORT=5432
export DB_NAME=<database>
export DB_USER=<user>
export DB_PASSWORD=<password>
export S3_ENDPOINT=http://minio:9000
export S3_BUCKET=uploads
export S3_ACCESS_KEY=<your-access-key>
export S3_SECRET_KEY=<your-secret-key>

npx ts-node verify-migration.ts
```

Verification checks:
- Row counts match between export and import
- All thread→board references are valid
- All post→thread references are valid
- All file→post references are valid
- File MD5 hashes match (sampled)

### 6. Rollback (if needed)

```bash
psql -h <host> -U <user> -d <database> -f rollback.sql
```

This removes only data tagged with `migration_source = 'legacy_mysql'`.

## Data Mapping

| Legacy MySQL | v2 PostgreSQL | Notes |
|---|---|---|
| `posts.no` (OP) | `threads.id` (UUID) | Deterministic UUID from legacy ID |
| `posts.no` (reply) | `posts.id` (UUID) | Deterministic UUID from legacy ID |
| `posts.resto` | `posts.thread_id` | Mapped to thread UUID |
| `boards.dir` | `boards.slug` | Direct mapping |
| `file_metadata.tim` | `files.storage_key` | Mapped to S3 key path |
| `bans.ip` | `bans.ip_hash` | IP is hashed for privacy |

## Troubleshooting

### Export fails with "secure_file_priv" error
MySQL's `secure_file_priv` restricts `SELECT INTO OUTFILE`. Either:
- Set `secure_file_priv = '/tmp/migration_export'` in `my.cnf`
- Use `mysqldump` with `--tab` option instead

### Transform runs out of memory
For very large datasets (>50M posts), use streaming mode:
```bash
STREAM_MODE=true npx ts-node transform.ts
```

### S3 upload timeouts
Increase concurrency timeout or reduce batch size:
```bash
MIGRATION_CONCURRENCY=5 S3_TIMEOUT=60000 npx ts-node migrate-files.ts
```

### Verification shows orphan records
Some orphans are expected if boards were deleted in the legacy system.
Review the orphan counts and decide if they're acceptable before proceeding.
