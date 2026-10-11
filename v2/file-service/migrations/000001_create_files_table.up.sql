CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL UNIQUE,
    filesize INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    thumbnail_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    md5_hash VARCHAR(32) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    is_spoilered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    post_id UUID
);

CREATE INDEX IF NOT EXISTS idx_files_md5_hash ON files(md5_hash);
CREATE INDEX IF NOT EXISTS idx_files_post_id ON files(post_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);

CREATE TABLE IF NOT EXISTS banned_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    md5_hash VARCHAR(32) NOT NULL UNIQUE,
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_banned_files_md5_hash ON banned_files(md5_hash);
CREATE INDEX IF NOT EXISTS idx_banned_files_is_active ON banned_files(is_active);
