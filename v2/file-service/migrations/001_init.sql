CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) UNIQUE NOT NULL,
  filesize INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  thumbnail_filename VARCHAR(255),
  mime_type VARCHAR(100) NOT NULL,
  md5_hash VARCHAR(32) NOT NULL,
  sha256_hash VARCHAR(64) NOT NULL,
  is_spoilered BOOLEAN DEFAULT false,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id),
  status VARCHAR(20) DEFAULT 'PENDING',
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS banned_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash VARCHAR(64) UNIQUE NOT NULL,
  hash_type VARCHAR(10) DEFAULT 'md5',
  reason TEXT,
  added_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_files_md5 ON files(md5_hash);
CREATE INDEX idx_files_post ON files(post_id);
CREATE INDEX idx_queue_status ON processing_queue(status, priority);
CREATE INDEX idx_banned_hash ON banned_hashes(hash);
