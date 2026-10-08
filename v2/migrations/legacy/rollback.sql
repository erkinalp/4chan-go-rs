-- rollback.sql
-- Rollback migration: remove all data imported from legacy MySQL
-- This deletes ONLY rows marked with migration_source = 'legacy_mysql'
-- Usage: psql -U <user> -d <database> -f rollback.sql

BEGIN;

-- Verify we're rolling back the right data
DO $$
DECLARE
  board_count INTEGER;
  thread_count INTEGER;
  post_count INTEGER;
  file_count INTEGER;
  ban_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO board_count FROM boards WHERE migration_source = 'legacy_mysql';
  SELECT COUNT(*) INTO thread_count FROM threads WHERE migration_source = 'legacy_mysql';
  SELECT COUNT(*) INTO post_count FROM posts WHERE migration_source = 'legacy_mysql';
  SELECT COUNT(*) INTO file_count FROM files WHERE migration_source = 'legacy_mysql';
  SELECT COUNT(*) INTO ban_count FROM bans WHERE migration_source = 'legacy_mysql';

  RAISE NOTICE 'Rolling back migration data:';
  RAISE NOTICE '  Boards:  % rows', board_count;
  RAISE NOTICE '  Threads: % rows', thread_count;
  RAISE NOTICE '  Posts:   % rows', post_count;
  RAISE NOTICE '  Files:   % rows', file_count;
  RAISE NOTICE '  Bans:    % rows', ban_count;
END $$;

-- Delete in reverse dependency order
DELETE FROM files WHERE id IN (
  SELECT f.id FROM files f
  JOIN posts p ON f.post_id = p.id
  WHERE p.migration_source = 'legacy_mysql'
);

DELETE FROM files WHERE id IN (
  SELECT f.id FROM files f
  JOIN threads t ON f.post_id = t.id
  WHERE t.migration_source = 'legacy_mysql'
);

DELETE FROM bans WHERE migration_source = 'legacy_mysql';
DELETE FROM posts WHERE migration_source = 'legacy_mysql';
DELETE FROM threads WHERE migration_source = 'legacy_mysql';
DELETE FROM boards WHERE migration_source = 'legacy_mysql';

-- Verify rollback
DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM (
    SELECT id FROM boards WHERE migration_source = 'legacy_mysql'
    UNION ALL
    SELECT id FROM threads WHERE migration_source = 'legacy_mysql'
    UNION ALL
    SELECT id FROM posts WHERE migration_source = 'legacy_mysql'
  ) AS migrated;

  IF remaining = 0 THEN
    RAISE NOTICE 'Rollback complete. All legacy data removed.';
  ELSE
    RAISE EXCEPTION 'Rollback incomplete: % rows still remain', remaining;
  END IF;
END $$;

COMMIT;
