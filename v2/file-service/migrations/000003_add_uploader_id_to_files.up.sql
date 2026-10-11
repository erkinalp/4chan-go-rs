-- Add uploader_id column to files table for ownership checks on DELETE
-- Stores the authenticated user's subject identifier (GNAP sub / JWT sub),
-- which is not guaranteed to be a UUID, so VARCHAR is used.
ALTER TABLE files ADD COLUMN IF NOT EXISTS uploader_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_files_uploader_id ON files(uploader_id);
