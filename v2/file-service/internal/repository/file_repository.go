package repository

import (
	"context"
	"errors"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/api/models"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type FileRepository struct {
	db *database.PostgresDB
}

func NewFileRepository(db *database.PostgresDB) *FileRepository {
	return &FileRepository{
		db: db,
	}
}

func (r *FileRepository) GetFileByID(ctx context.Context, fileID string) (*models.File, error) {
	query := `
		SELECT id, filename, stored_filename, filesize, width, height, 
		       thumbnail_filename, mime_type, md5_hash, sha256_hash, 
		       is_spoilered, created_at, post_id
		FROM files
		WHERE id = $1
	`

	var file models.File
	err := r.db.GetPool().QueryRow(ctx, query, fileID).Scan(
		&file.ID,
		&file.Filename,
		&file.StoredFilename,
		&file.Filesize,
		&file.Width,
		&file.Height,
		&file.ThumbnailFilename,
		&file.MimeType,
		&file.MD5Hash,
		&file.SHA256Hash,
		&file.IsSpoilered,
		&file.CreatedAt,
		&file.PostID,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // File not found
		}
		return nil, err
	}

	return &file, nil
}

func (r *FileRepository) GetFileByMD5Hash(ctx context.Context, md5Hash string) (*models.File, error) {
	query := `
		SELECT id, filename, stored_filename, filesize, width, height, 
		       thumbnail_filename, mime_type, md5_hash, sha256_hash, 
		       is_spoilered, created_at, post_id
		FROM files
		WHERE md5_hash = $1
		LIMIT 1
	`

	var file models.File
	err := r.db.GetPool().QueryRow(ctx, query, md5Hash).Scan(
		&file.ID,
		&file.Filename,
		&file.StoredFilename,
		&file.Filesize,
		&file.Width,
		&file.Height,
		&file.ThumbnailFilename,
		&file.MimeType,
		&file.MD5Hash,
		&file.SHA256Hash,
		&file.IsSpoilered,
		&file.CreatedAt,
		&file.PostID,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // File not found
		}
		return nil, err
	}

	return &file, nil
}

func (r *FileRepository) CreateFile(ctx context.Context, file *models.File) error {
	query := `
		INSERT INTO files (
			id, filename, stored_filename, filesize, width, height, 
			thumbnail_filename, mime_type, md5_hash, sha256_hash, 
			is_spoilered, created_at, post_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
		)
	`

	if file.ID == "" {
		file.ID = uuid.New().String()
	}

	if file.CreatedAt.IsZero() {
		file.CreatedAt = time.Now()
	}

	_, err := r.db.GetPool().Exec(ctx, query,
		file.ID,
		file.Filename,
		file.StoredFilename,
		file.Filesize,
		file.Width,
		file.Height,
		file.ThumbnailFilename,
		file.MimeType,
		file.MD5Hash,
		file.SHA256Hash,
		file.IsSpoilered,
		file.CreatedAt,
		file.PostID,
	)

	return err
}

func (r *FileRepository) DeleteFile(ctx context.Context, fileID string) error {
	query := `DELETE FROM files WHERE id = $1`
	_, err := r.db.GetPool().Exec(ctx, query, fileID)
	return err
}

func (r *FileRepository) GetFilesByPostID(ctx context.Context, postID string) ([]models.File, error) {
	query := `
		SELECT id, filename, stored_filename, filesize, width, height, 
		       thumbnail_filename, mime_type, md5_hash, sha256_hash, 
		       is_spoilered, created_at, post_id
		FROM files
		WHERE post_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.GetPool().Query(ctx, query, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []models.File
	for rows.Next() {
		var file models.File
		if err := rows.Scan(
			&file.ID,
			&file.Filename,
			&file.StoredFilename,
			&file.Filesize,
			&file.Width,
			&file.Height,
			&file.ThumbnailFilename,
			&file.MimeType,
			&file.MD5Hash,
			&file.SHA256Hash,
			&file.IsSpoilered,
			&file.CreatedAt,
			&file.PostID,
		); err != nil {
			return nil, err
		}
		files = append(files, file)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return files, nil
}

func (r *FileRepository) GetBannedHashes(ctx context.Context) ([]string, error) {
	query := `
		SELECT md5_hash
		FROM banned_files
		WHERE is_active = true
	`

	rows, err := r.db.GetPool().Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hashes []string
	for rows.Next() {
		var hash string
		if err := rows.Scan(&hash); err != nil {
			return nil, err
		}
		hashes = append(hashes, hash)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return hashes, nil
}

func (r *FileRepository) GetFileStats(ctx context.Context) (*models.FileStats, error) {
	totalQuery := `
		SELECT COUNT(*), COALESCE(SUM(filesize), 0)
		FROM files
	`

	var totalFiles int
	var totalSize int64
	err := r.db.GetPool().QueryRow(ctx, totalQuery).Scan(&totalFiles, &totalSize)
	if err != nil {
		return nil, err
	}

	dayQuery := `
		SELECT COUNT(*)
		FROM files
		WHERE created_at > NOW() - INTERVAL '1 day'
	`

	var filesLastDay int
	err = r.db.GetPool().QueryRow(ctx, dayQuery).Scan(&filesLastDay)
	if err != nil {
		return nil, err
	}

	weekQuery := `
		SELECT COUNT(*)
		FROM files
		WHERE created_at > NOW() - INTERVAL '7 days'
	`

	var filesLastWeek int
	err = r.db.GetPool().QueryRow(ctx, weekQuery).Scan(&filesLastWeek)
	if err != nil {
		return nil, err
	}

	typeQuery := `
		SELECT mime_type, COUNT(*)
		FROM files
		GROUP BY mime_type
	`

	rows, err := r.db.GetPool().Query(ctx, typeQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	filesByType := make(map[string]int)
	for rows.Next() {
		var mimeType string
		var count int
		if err := rows.Scan(&mimeType, &count); err != nil {
			return nil, err
		}
		filesByType[mimeType] = count
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	var averageFileSize int64
	if totalFiles > 0 {
		averageFileSize = totalSize / int64(totalFiles)
	}

	return &models.FileStats{
		TotalFiles:      totalFiles,
		TotalSize:       totalSize,
		AverageFileSize: averageFileSize,
		FilesLastDay:    filesLastDay,
		FilesLastWeek:   filesLastWeek,
		FilesByType:     filesByType,
	}, nil
}
