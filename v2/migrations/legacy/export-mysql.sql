-- export-mysql.sql
-- Export data from legacy 4chan MySQL database for migration to PostgreSQL
-- Run against the source MySQL database
-- Usage: mysql -u <user> -p <database> < export-mysql.sql

-- Disable foreign key checks during export
SET FOREIGN_KEY_CHECKS = 0;
SET @export_dir = '/tmp/migration_export';

-- Export boards configuration
SELECT
  b.id,
  b.dir AS slug,
  b.name AS title,
  b.description,
  b.worksafe AS is_sfw,
  b.max_filesize,
  b.max_pages,
  b.threads_per_page,
  b.bump_limit,
  b.image_limit,
  b.cooldown AS post_cooldown,
  b.created_at,
  b.updated_at
INTO OUTFILE '/tmp/migration_export/boards.csv'
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM boards b
ORDER BY b.id;

-- Export threads
SELECT
  t.no AS id,
  t.board_id,
  t.sub AS subject,
  t.com AS message,
  t.name AS author_name,
  t.trip AS tripcode,
  t.sticky,
  t.closed,
  t.archived,
  t.bumped_on AS last_bumped_at,
  t.replies AS reply_count,
  t.images AS image_count,
  t.unique_ips,
  FROM_UNIXTIME(t.time) AS created_at
INTO OUTFILE '/tmp/migration_export/threads.csv'
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM posts t
WHERE t.resto = 0
ORDER BY t.no;

-- Export posts (replies)
SELECT
  p.no AS id,
  p.resto AS thread_id,
  p.board_id,
  p.com AS message,
  p.name AS author_name,
  p.trip AS tripcode,
  p.capcode,
  p.country,
  p.country_name,
  FROM_UNIXTIME(p.time) AS created_at
INTO OUTFILE '/tmp/migration_export/posts.csv'
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM posts p
WHERE p.resto != 0
ORDER BY p.no;

-- Export file metadata
SELECT
  f.id,
  f.post_no AS post_id,
  f.board_id,
  f.tim AS stored_filename,
  f.filename AS original_filename,
  f.ext AS extension,
  f.fsize AS file_size,
  f.md5,
  f.w AS width,
  f.h AS height,
  f.tn_w AS thumb_width,
  f.tn_h AS thumb_height,
  f.spoiler,
  f.filedeleted AS deleted
INTO OUTFILE '/tmp/migration_export/files.csv'
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM file_metadata f
ORDER BY f.id;

-- Export bans
SELECT
  b.id,
  b.board_id,
  b.ip,
  b.name AS banned_name,
  b.reason,
  b.admin AS banned_by,
  b.length AS duration_seconds,
  b.global AS is_global,
  FROM_UNIXTIME(b.created) AS created_at,
  FROM_UNIXTIME(b.expires) AS expires_at
INTO OUTFILE '/tmp/migration_export/bans.csv'
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM bans b
ORDER BY b.id;

-- Export reports
SELECT
  r.id,
  r.board_id,
  r.post_no AS post_id,
  r.thread_no AS thread_id,
  r.cat AS category,
  r.ip AS reporter_ip,
  FROM_UNIXTIME(r.created) AS created_at,
  r.resolved,
  r.resolved_by
INTO OUTFILE '/tmp/migration_export/reports.csv'
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
FROM reports r
ORDER BY r.id;

SET FOREIGN_KEY_CHECKS = 1;

-- Summary counts for verification
SELECT 'boards' AS entity, COUNT(*) AS count FROM boards
UNION ALL
SELECT 'threads', COUNT(*) FROM posts WHERE resto = 0
UNION ALL
SELECT 'posts', COUNT(*) FROM posts WHERE resto != 0
UNION ALL
SELECT 'files', COUNT(*) FROM file_metadata
UNION ALL
SELECT 'bans', COUNT(*) FROM bans
UNION ALL
SELECT 'reports', COUNT(*) FROM reports;
