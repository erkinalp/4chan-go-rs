package repository

import (
	"context"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/database"
)

type QueueRepository struct {
	db *database.PostgresDB
}

type QueueItem struct {
	ID             string
	FileID         string
	ProcessingType string
	Priority       int
	Status         string
	Attempts       int
	MaxAttempts    int
	ErrorMessage   *string
	CreatedAt      time.Time
	StartedAt      *time.Time
	CompletedAt    *time.Time
}

func NewQueueRepository(db *database.PostgresDB) *QueueRepository {
	return &QueueRepository{
		db: db,
	}
}

func (r *QueueRepository) Enqueue(ctx context.Context, fileID string, processingType string, priority int) error {
	query := `
		INSERT INTO file_processing_queue (
			file_id, processing_type, priority, status, max_attempts
		) VALUES (
			$1, $2, $3, 'queued', 3
		)
	`
	_, err := r.db.GetPool().Exec(ctx, query, fileID, processingType, priority)
	return err
}

func (r *QueueRepository) Dequeue(ctx context.Context) (*QueueItem, error) {
	// Simple dequeue implementation: find oldest queued item, lock it, update status to processing
	// This uses FOR UPDATE SKIP LOCKED to avoid contention
	query := `
		UPDATE file_processing_queue
		SET status = 'processing', started_at = NOW(), attempts = attempts + 1
		WHERE id = (
			SELECT id
			FROM file_processing_queue
			WHERE status = 'queued'
			ORDER BY priority DESC, created_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id, file_id, processing_type, priority, status, attempts, max_attempts, created_at, started_at
	`

	var item QueueItem
	err := r.db.GetPool().QueryRow(ctx, query).Scan(
		&item.ID,
		&item.FileID,
		&item.ProcessingType,
		&item.Priority,
		&item.Status,
		&item.Attempts,
		&item.MaxAttempts,
		&item.CreatedAt,
		&item.StartedAt,
	)

	if err != nil {
		// pgx.ErrNoRows is returned if no rows are updated (i.e. queue is empty)
		return nil, err
	}

	return &item, nil
}

func (r *QueueRepository) Complete(ctx context.Context, id string) error {
	query := `
		UPDATE file_processing_queue
		SET status = 'completed', completed_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.GetPool().Exec(ctx, query, id)
	return err
}

func (r *QueueRepository) Fail(ctx context.Context, id string, errorMessage string) error {
	query := `
		UPDATE file_processing_queue
		SET status = 'failed', error_message = $2, completed_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.GetPool().Exec(ctx, query, id, errorMessage)
	return err
}
