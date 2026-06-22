# Legacy to v2 Migration Guide

This document describes the process of migrating from the legacy 4chan PHP/MySQL application to the v2 microservices architecture.

## Overview

The migration transfers:
- **Boards** — Configuration and metadata
- **Threads** — Opening posts and thread state
- **Posts** — All replies and their metadata
- **Files** — Image/media files and thumbnails
- **Bans** — Active and historical ban records

## Migration Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Legacy MySQL  │──────▶│   Transform     │──────▶│   PostgreSQL    │
│   (source)      │ export│   (Node.js)     │ import│   (v2 target)   │
└─────────────────┘       └─────────────────┘       └─────────────────┘

┌─────────────────┐                                  ┌─────────────────┐
│  Filesystem     │─────────────────────────────────▶│  S3/MinIO       │
│  (images/thumbs)│          migrate-files           │  (v2 storage)   │
└─────────────────┘                                  └─────────────────┘
```

## Preparation Checklist

Before beginning migration:

- [ ] v2 PostgreSQL schema is applied and empty
- [ ] S3/MinIO buckets created (`uploads`, `thumbnails`)
- [ ] Legacy MySQL database accessible (read-only is sufficient)
- [ ] Legacy file storage mounted/accessible
- [ ] Node.js 18+ installed with TypeScript
- [ ] Sufficient disk space for intermediate CSV files (~2x MySQL data dir)
- [ ] Downtime window scheduled (or use live migration with cutover)
- [ ] Backup of legacy database taken
- [ ] Rollback plan reviewed

## Execution

### Phase 1: Export (Estimated: 5–30 min depending on data size)

```bash
cd v2/migrations/legacy

# Create output directory
mkdir -p /tmp/migration_export

# Run MySQL export
mysql -u <user> -p <database> < export-mysql.sql
```

**Verification**: Check row counts printed at the end of export.

### Phase 2: Transform (Estimated: 1–10 min)

```bash
npm install
INPUT_DIR=/tmp/migration_export OUTPUT_DIR=/tmp/migration_import npx ts-node transform.ts
```

The transform:
- Generates deterministic UUIDs from legacy integer IDs
- Maps MySQL column names to v2 PostgreSQL schema
- Converts timestamps to ISO 8601
- Maps file paths to S3 object keys
- Produces PostgreSQL COPY-format files

### Phase 3: Import (Estimated: 5–60 min)

```bash
psql -h <host> -U <user> -d <database> -f import-postgres.sql
```

The import script:
1. Creates staging tables for validation
2. Loads data via efficient COPY
3. Validates referential integrity
4. Inserts into production tables with conflict resolution
5. Reports summary counts

### Phase 4: File Migration (Estimated: Hours, depends on data volume)

```bash
export LEGACY_FILES_DIR=/var/www/4chan/images
export LEGACY_THUMBS_DIR=/var/www/4chan/thumbs
export S3_ENDPOINT=http://minio:9000
export S3_BUCKET=uploads
export S3_THUMB_BUCKET=thumbnails
export S3_ACCESS_KEY=<key>
export S3_SECRET_KEY=<secret>
export MIGRATION_CONCURRENCY=20

# Dry run first
DRY_RUN=true npx ts-node migrate-files.ts

# Execute
npx ts-node migrate-files.ts
```

### Phase 5: Verification

```bash
export DB_HOST=<host> DB_PORT=5432 DB_NAME=<db> DB_USER=<user> DB_PASSWORD=<pass>
export S3_ENDPOINT=http://minio:9000 S3_BUCKET=uploads
export S3_ACCESS_KEY=<key> S3_SECRET_KEY=<secret>

npx ts-node verify-migration.ts
```

Checks performed:
- Row count parity between source and destination
- Thread→Board referential integrity
- Post→Thread referential integrity
- File→Post referential integrity
- File hash verification (MD5 sample)

## Verification Acceptance Criteria

| Check | Required |
|---|---|
| Board count matches | Yes |
| Thread count within 1% | Yes |
| Post count within 0.1% | Yes |
| File count within 5% | Acceptable (some deleted files) |
| Zero orphan threads | Yes |
| Zero orphan posts | Yes |
| File hash sample passes | Yes (100% of sampled files) |

## Rollback

If verification fails or issues are discovered post-migration:

```bash
# Remove all migrated data (only rows tagged as legacy_mysql)
psql -h <host> -U <user> -d <database> -f rollback.sql
```

Note: File rollback (removing from S3) is not automated. Files in S3 are harmless if the database references are removed. To clean S3:

```bash
mc rm --recursive minio/uploads/legacy/
mc rm --recursive minio/thumbnails/legacy/
```

## Live Migration Strategy

For zero-downtime migration:

1. **Phase A** — Run export/transform/import while legacy is still active
2. **Phase B** — Enable write-ahead log capture on MySQL (using Debezium or binlog)
3. **Phase C** — Apply incremental changes from binlog to PostgreSQL
4. **Phase D** — Switch DNS/routing to v2 services
5. **Phase E** — Stop binlog sync, verify final consistency

This approach requires additional tooling (Debezium, Kafka) not included in the basic migration scripts.

## Data Mapping Reference

| Legacy (MySQL) | v2 (PostgreSQL) | Transformation |
|---|---|---|
| `boards.id` (INT) | `boards.id` (UUID) | Deterministic UUID |
| `boards.dir` | `boards.slug` | Direct |
| `posts.no` (OP, INT) | `threads.id` (UUID) | Deterministic UUID |
| `posts.no` (reply, INT) | `posts.id` (UUID) | Deterministic UUID |
| `posts.resto` | `posts.thread_id` | UUID lookup |
| `posts.com` | `posts.message` | HTML sanitization preserved |
| `posts.trip` | `posts.tripcode` | Direct |
| `file_metadata.tim` | `files.storage_key` | S3 path mapping |
| `bans.ip` | `bans.ip_hash` | SHA-256 hashed |
| UNIX timestamps | ISO 8601 | `FROM_UNIXTIME()` |

## Troubleshooting

### Export fails with permission errors
MySQL's `secure_file_priv` may restrict `SELECT INTO OUTFILE`. Solutions:
- Configure `secure_file_priv` to allow the export directory
- Use `mysqldump --tab` as an alternative

### Transform OOM for large datasets
Set Node.js heap size: `NODE_OPTIONS="--max-old-space-size=4096"`

### Import shows constraint violations
Review orphan warnings. Some orphans are expected if boards were deleted. The import uses `ON CONFLICT DO NOTHING` to skip duplicates.

### File migration slow
- Increase `MIGRATION_CONCURRENCY` (default 10, try 50)
- Use multiple migration processes for different board ranges
- Ensure network bandwidth to S3 is sufficient
