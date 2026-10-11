DROP INDEX IF EXISTS idx_files_uploader_id;
ALTER TABLE files DROP COLUMN IF EXISTS uploader_id;
