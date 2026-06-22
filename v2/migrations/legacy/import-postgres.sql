-- import-postgres.sql
-- Import transformed data into the v2 PostgreSQL schema
-- Run after transform.ts has generated .copy files in OUTPUT_DIR
-- Usage: psql -U <user> -d <database> -f import-postgres.sql

BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create temporary staging tables for validation
CREATE TEMP TABLE _import_boards (LIKE boards INCLUDING DEFAULTS);
CREATE TEMP TABLE _import_threads (LIKE threads INCLUDING DEFAULTS);
CREATE TEMP TABLE _import_posts (LIKE posts INCLUDING DEFAULTS);
CREATE TEMP TABLE _import_files (LIKE files INCLUDING DEFAULTS);
CREATE TEMP TABLE _import_bans (LIKE bans INCLUDING DEFAULTS);

-- Import boards
\copy _import_boards (id, slug, title, description, is_sfw, max_filesize, max_pages, threads_per_page, bump_limit, image_limit, post_cooldown, created_at, updated_at) FROM '/tmp/migration_import/boards.copy' WITH (FORMAT text, NULL '\\N')

-- Import threads
\copy _import_threads (id, board_id, subject, message, author_name, tripcode, sticky, closed, archived, last_bumped_at, reply_count, image_count, unique_ips, created_at) FROM '/tmp/migration_import/threads.copy' WITH (FORMAT text, NULL '\\N')

-- Import posts
\copy _import_posts (id, thread_id, board_id, message, author_name, tripcode, capcode, country, country_name, created_at) FROM '/tmp/migration_import/posts.copy' WITH (FORMAT text, NULL '\\N')

-- Import files
\copy _import_files (id, post_id, board_id, storage_key, thumbnail_key, original_filename, extension, file_size, md5, width, height, thumb_width, thumb_height, spoiler, deleted) FROM '/tmp/migration_import/files.copy' WITH (FORMAT text, NULL '\\N')

-- Import bans
\copy _import_bans (id, board_id, ip_hash, banned_name, reason, banned_by, duration_seconds, is_global, created_at, expires_at) FROM '/tmp/migration_import/bans.copy' WITH (FORMAT text, NULL '\\N')

-- Validate referential integrity before moving to production tables
DO $$
DECLARE
  orphan_threads INTEGER;
  orphan_posts INTEGER;
  orphan_files INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_threads
  FROM _import_threads t
  WHERE NOT EXISTS (SELECT 1 FROM _import_boards b WHERE b.id = t.board_id);

  SELECT COUNT(*) INTO orphan_posts
  FROM _import_posts p
  WHERE NOT EXISTS (SELECT 1 FROM _import_threads t WHERE t.id = p.thread_id);

  SELECT COUNT(*) INTO orphan_files
  FROM _import_files f
  WHERE NOT EXISTS (SELECT 1 FROM _import_posts p WHERE p.id = f.post_id)
    AND NOT EXISTS (SELECT 1 FROM _import_threads t WHERE t.id = f.post_id);

  IF orphan_threads > 0 THEN
    RAISE WARNING 'Found % orphan threads (missing board references)', orphan_threads;
  END IF;
  IF orphan_posts > 0 THEN
    RAISE WARNING 'Found % orphan posts (missing thread references)', orphan_posts;
  END IF;
  IF orphan_files > 0 THEN
    RAISE WARNING 'Found % orphan files (missing post references)', orphan_files;
  END IF;
END $$;

-- Mark imported data with migration source
ALTER TABLE _import_boards ADD COLUMN IF NOT EXISTS migration_source TEXT DEFAULT 'legacy_mysql';
ALTER TABLE _import_threads ADD COLUMN IF NOT EXISTS migration_source TEXT DEFAULT 'legacy_mysql';
ALTER TABLE _import_posts ADD COLUMN IF NOT EXISTS migration_source TEXT DEFAULT 'legacy_mysql';

-- Insert into production tables (ON CONFLICT skip duplicates)
INSERT INTO boards SELECT * FROM _import_boards ON CONFLICT (id) DO NOTHING;
INSERT INTO threads SELECT * FROM _import_threads ON CONFLICT (id) DO NOTHING;
INSERT INTO posts SELECT * FROM _import_posts ON CONFLICT (id) DO NOTHING;
INSERT INTO files SELECT * FROM _import_files ON CONFLICT (id) DO NOTHING;
INSERT INTO bans SELECT * FROM _import_bans ON CONFLICT (id) DO NOTHING;

-- Update sequence counters
SELECT setval('boards_id_seq', COALESCE((SELECT MAX(id) FROM boards), 0) + 1, false);
SELECT setval('threads_id_seq', COALESCE((SELECT MAX(id) FROM threads), 0) + 1, false);

-- Report import summary
DO $$
BEGIN
  RAISE NOTICE 'Import complete:';
  RAISE NOTICE '  Boards:  % rows', (SELECT COUNT(*) FROM _import_boards);
  RAISE NOTICE '  Threads: % rows', (SELECT COUNT(*) FROM _import_threads);
  RAISE NOTICE '  Posts:   % rows', (SELECT COUNT(*) FROM _import_posts);
  RAISE NOTICE '  Files:   % rows', (SELECT COUNT(*) FROM _import_files);
  RAISE NOTICE '  Bans:    % rows', (SELECT COUNT(*) FROM _import_bans);
END $$;

COMMIT;
