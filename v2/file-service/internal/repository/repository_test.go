package repository

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/api/models"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// These tests exercise the repository layer against a real PostgreSQL
// instance — the repositories are built on *pgxpool.Pool (a concrete type),
// so they cannot be unit-tested with sqlmock/pgxmock without changing
// production signatures.
//
// Run them with:
//
//	FILE_SERVICE_TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/file_service_test?sslmode=disable" \
//	  go test ./internal/repository/...
//
// Without the env var they skip cleanly.

const testSchema = `
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
CREATE TABLE IF NOT EXISTS banned_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    md5_hash VARCHAR(32) NOT NULL UNIQUE,
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS file_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL,
    processing_type VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'queued',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);
`

func testDB(t *testing.T) *database.PostgresDB {
	t.Helper()
	dsn := os.Getenv("FILE_SERVICE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("FILE_SERVICE_TEST_DATABASE_URL not set; skipping database-backed test")
	}
	db, err := database.NewPostgresDB(config.DatabaseConfig{
		ConnectionString: dsn,
		MaxOpenConns:     4,
		MaxIdleConns:     2,
		ConnMaxLifetime:  60,
	})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}
	if _, err := db.GetPool().Exec(context.Background(), testSchema); err != nil {
		t.Fatalf("failed to create test schema: %v", err)
	}
	if _, err := db.GetPool().Exec(context.Background(),
		"TRUNCATE files, banned_files, file_processing_queue"); err != nil {
		t.Fatalf("failed to truncate test tables: %v", err)
	}
	t.Cleanup(db.Close)
	return db
}

func testFile(postID string) *models.File {
	return &models.File{
		Filename:          "cat.jpg",
		StoredFilename:    uuid.New().String() + ".jpg",
		Filesize:          12345,
		Width:             800,
		Height:            600,
		ThumbnailFilename: "thumb.jpg",
		MimeType:          "image/jpeg",
		MD5Hash:           uuid.New().String()[:32],
		SHA256Hash:        uuid.New().String() + uuid.New().String()[:8],
		IsSpoilered:       false,
		PostID:            postID,
	}
}

func TestFileRepository_CreateAndGetByID(t *testing.T) {
	db := testDB(t)
	repo := NewFileRepository(db)
	ctx := context.Background()

	f := testFile(uuid.New().String())
	if err := repo.CreateFile(ctx, f); err != nil {
		t.Fatalf("CreateFile failed: %v", err)
	}
	if f.ID == "" {
		t.Fatal("expected CreateFile to assign an ID")
	}
	if f.CreatedAt.IsZero() {
		t.Fatal("expected CreateFile to assign CreatedAt")
	}

	got, err := repo.GetFileByID(ctx, f.ID)
	if err != nil {
		t.Fatalf("GetFileByID failed: %v", err)
	}
	if got == nil {
		t.Fatal("expected file, got nil")
	}
	if got.Filename != "cat.jpg" || got.Filesize != 12345 || got.Width != 800 || got.MimeType != "image/jpeg" {
		t.Fatalf("file fields mismatch: %+v", got)
	}
}

func TestFileRepository_GetFileByID_NotFound(t *testing.T) {
	db := testDB(t)
	repo := NewFileRepository(db)

	got, err := repo.GetFileByID(context.Background(), uuid.New().String())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for missing file, got %+v", got)
	}
}

func TestFileRepository_GetFileByMD5Hash(t *testing.T) {
	db := testDB(t)
	repo := NewFileRepository(db)
	ctx := context.Background()

	f := testFile(uuid.New().String())
	if err := repo.CreateFile(ctx, f); err != nil {
		t.Fatalf("CreateFile failed: %v", err)
	}

	got, err := repo.GetFileByMD5Hash(ctx, f.MD5Hash)
	if err != nil || got == nil {
		t.Fatalf("GetFileByMD5Hash got=%+v err=%v", got, err)
	}
	if got.ID != f.ID {
		t.Fatalf("id mismatch: %v vs %v", got.ID, f.ID)
	}

	got, err = repo.GetFileByMD5Hash(ctx, "0000000000000000000000000000dead")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for unknown hash, got %+v", got)
	}
}

func TestFileRepository_DeleteFile(t *testing.T) {
	db := testDB(t)
	repo := NewFileRepository(db)
	ctx := context.Background()

	f := testFile(uuid.New().String())
	if err := repo.CreateFile(ctx, f); err != nil {
		t.Fatalf("CreateFile failed: %v", err)
	}
	if err := repo.DeleteFile(ctx, f.ID); err != nil {
		t.Fatalf("DeleteFile failed: %v", err)
	}
	got, err := repo.GetFileByID(ctx, f.ID)
	if err != nil || got != nil {
		t.Fatalf("expected deleted file to be gone, got=%+v err=%v", got, err)
	}
}

func TestFileRepository_GetFilesByPostID(t *testing.T) {
	db := testDB(t)
	repo := NewFileRepository(db)
	ctx := context.Background()
	postID := uuid.New().String()

	for _, name := range []string{"a.png", "b.png", "c.png"} {
		f := testFile(postID)
		f.Filename = name
		f.MimeType = "image/png"
		if err := repo.CreateFile(ctx, f); err != nil {
			t.Fatalf("CreateFile failed: %v", err)
		}
	}
	// A file belonging to another post must not leak into results.
	other := testFile(uuid.New().String())
	if err := repo.CreateFile(ctx, other); err != nil {
		t.Fatalf("CreateFile failed: %v", err)
	}

	files, err := repo.GetFilesByPostID(ctx, postID)
	if err != nil {
		t.Fatalf("GetFilesByPostID failed: %v", err)
	}
	if len(files) != 3 {
		t.Fatalf("expected 3 files, got %d", len(files))
	}
	for _, f := range files {
		if f.PostID != postID {
			t.Fatalf("wrong post_id on %+v", f)
		}
	}
}

func TestFileRepository_GetBannedHashes(t *testing.T) {
	db := testDB(t)
	repo := NewFileRepository(db)
	ctx := context.Background()

	if _, err := db.GetPool().Exec(ctx,
		"INSERT INTO banned_files (md5_hash, is_active) VALUES ('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', true), ('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', false)"); err != nil {
		t.Fatalf("seed banned_files failed: %v", err)
	}

	hashes, err := repo.GetBannedHashes(ctx)
	if err != nil {
		t.Fatalf("GetBannedHashes failed: %v", err)
	}
	if len(hashes) != 1 || hashes[0] != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" {
		t.Fatalf("expected only the active hash, got %v", hashes)
	}
}

func TestFileRepository_GetFileStats(t *testing.T) {
	db := testDB(t)
	repo := NewFileRepository(db)
	ctx := context.Background()
	postID := uuid.New().String()

	for i, mt := range []string{"image/png", "image/png", "video/mp4"} {
		f := testFile(postID)
		f.MimeType = mt
		f.Filesize = int64(100 * (i + 1))
		if err := repo.CreateFile(ctx, f); err != nil {
			t.Fatalf("CreateFile failed: %v", err)
		}
	}

	stats, err := repo.GetFileStats(ctx)
	if err != nil {
		t.Fatalf("GetFileStats failed: %v", err)
	}
	if stats.TotalFiles != 3 {
		t.Fatalf("TotalFiles=%d want 3", stats.TotalFiles)
	}
	if stats.TotalSize != 600 {
		t.Fatalf("TotalSize=%d want 600", stats.TotalSize)
	}
	if stats.AverageFileSize != 200 {
		t.Fatalf("AverageFileSize=%d want 200", stats.AverageFileSize)
	}
	if stats.FilesByType["image/png"] != 2 || stats.FilesByType["video/mp4"] != 1 {
		t.Fatalf("FilesByType wrong: %v", stats.FilesByType)
	}
	if stats.FilesLastDay != 3 || stats.FilesLastWeek != 3 {
		t.Fatalf("recent counts wrong: %+v", stats)
	}
}

func TestFileRepository_GetFileStats_Empty(t *testing.T) {
	db := testDB(t)
	repo := NewFileRepository(db)

	stats, err := repo.GetFileStats(context.Background())
	if err != nil {
		t.Fatalf("GetFileStats failed: %v", err)
	}
	if stats.TotalFiles != 0 || stats.AverageFileSize != 0 {
		t.Fatalf("expected zero stats, got %+v", stats)
	}
}

func TestQueueRepository_EnqueueDequeue(t *testing.T) {
	db := testDB(t)
	repo := NewQueueRepository(db)
	ctx := context.Background()

	low := uuid.New().String()
	high := uuid.New().String()
	if err := repo.Enqueue(ctx, low, "thumbnail", 1); err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}
	if err := repo.Enqueue(ctx, high, "thumbnail", 10); err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	item, err := repo.Dequeue(ctx)
	if err != nil {
		t.Fatalf("Dequeue failed: %v", err)
	}
	if item == nil || item.FileID != high {
		t.Fatalf("expected highest-priority item first, got %+v", item)
	}
	if item.Status != "processing" || item.Attempts != 1 || item.MaxAttempts != 3 {
		t.Fatalf("unexpected item state: %+v", item)
	}
	if item.StartedAt == nil {
		t.Fatal("expected started_at to be set")
	}

	item, err = repo.Dequeue(ctx)
	if err != nil {
		t.Fatalf("Dequeue failed: %v", err)
	}
	if item.FileID != low {
		t.Fatalf("expected remaining item, got %+v", item)
	}
}

func TestQueueRepository_DequeueFIFOWithinPriority(t *testing.T) {
	db := testDB(t)
	repo := NewQueueRepository(db)
	ctx := context.Background()

	first, second := uuid.New().String(), uuid.New().String()
	if _, err := db.GetPool().Exec(ctx,
		`INSERT INTO file_processing_queue (file_id, processing_type, priority, status, created_at)
		 VALUES ($1, 'scan', 0, 'queued', NOW() - INTERVAL '1 hour'),
		        ($2, 'scan', 0, 'queued', NOW())`, first, second); err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	item, err := repo.Dequeue(ctx)
	if err != nil {
		t.Fatalf("Dequeue failed: %v", err)
	}
	if item.FileID != first {
		t.Fatalf("expected oldest queued item first, got %+v", item)
	}
}

func TestQueueRepository_DequeueEmpty(t *testing.T) {
	db := testDB(t)
	repo := NewQueueRepository(db)

	item, err := repo.Dequeue(context.Background())
	if item != nil {
		t.Fatalf("expected nil item, got %+v", item)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("expected pgx.ErrNoRows, got %v", err)
	}
}

func TestQueueRepository_Complete(t *testing.T) {
	db := testDB(t)
	repo := NewQueueRepository(db)
	ctx := context.Background()

	if err := repo.Enqueue(ctx, uuid.New().String(), "thumbnail", 0); err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}
	item, err := repo.Dequeue(ctx)
	if err != nil {
		t.Fatalf("Dequeue failed: %v", err)
	}
	if err := repo.Complete(ctx, item.ID); err != nil {
		t.Fatalf("Complete failed: %v", err)
	}

	var status string
	var completedAt *time.Time
	if err := db.GetPool().QueryRow(ctx,
		"SELECT status, completed_at FROM file_processing_queue WHERE id = $1", item.ID,
	).Scan(&status, &completedAt); err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if status != "completed" || completedAt == nil {
		t.Fatalf("expected completed status, got %q completedAt=%v", status, completedAt)
	}
}

func TestQueueRepository_Fail(t *testing.T) {
	db := testDB(t)
	repo := NewQueueRepository(db)
	ctx := context.Background()

	if err := repo.Enqueue(ctx, uuid.New().String(), "scan", 0); err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}
	item, err := repo.Dequeue(ctx)
	if err != nil {
		t.Fatalf("Dequeue failed: %v", err)
	}
	if err := repo.Fail(ctx, item.ID, "clamav timeout"); err != nil {
		t.Fatalf("Fail failed: %v", err)
	}

	var status, errMsg string
	if err := db.GetPool().QueryRow(ctx,
		"SELECT status, error_message FROM file_processing_queue WHERE id = $1", item.ID,
	).Scan(&status, &errMsg); err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if status != "failed" || errMsg != "clamav timeout" {
		t.Fatalf("expected failed status with message, got %q %q", status, errMsg)
	}
}
