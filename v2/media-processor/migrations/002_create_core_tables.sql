
CREATE TABLE media_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('thumbnail', 'resize', 'compress', 'scan')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    input_path VARCHAR(500) NOT NULL,
    output_path VARCHAR(500),
    parameters JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE media_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    duration INTEGER,
    bitrate INTEGER,
    codec VARCHAR(50),
    color_profile VARCHAR(100),
    exif_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE virus_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    scanner VARCHAR(50) NOT NULL,
    scan_result VARCHAR(20) NOT NULL CHECK (scan_result IN ('clean', 'infected', 'suspicious', 'error')),
    threat_name VARCHAR(255),
    scan_details JSONB,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_jobs_file_id ON media_jobs(file_id);
CREATE INDEX idx_media_jobs_status ON media_jobs(status);
CREATE INDEX idx_media_jobs_job_type ON media_jobs(job_type);
CREATE INDEX idx_media_metadata_file_id ON media_metadata(file_id);
CREATE INDEX idx_virus_scans_file_id ON virus_scans(file_id);
CREATE INDEX idx_virus_scans_scan_result ON virus_scans(scan_result);
