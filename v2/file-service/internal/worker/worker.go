package worker

import (
	"context"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/repository"
	"github.com/rs/zerolog"
)

type Worker struct {
	queueRepo *repository.QueueRepository
	stopChan  chan struct{}
	logger    zerolog.Logger
}

func NewWorker(queueRepo *repository.QueueRepository, logger zerolog.Logger) *Worker {
	return &Worker{
		queueRepo: queueRepo,
		stopChan:  make(chan struct{}),
		logger:    logger,
	}
}

func (w *Worker) Start() {
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-w.stopChan:
				return
			case <-ticker.C:
				w.processNextItem()
			}
		}
	}()
}

func (w *Worker) Stop() {
	close(w.stopChan)
}

func (w *Worker) processNextItem() {
	ctx := context.Background()
	item, err := w.queueRepo.Dequeue(ctx)
	if err != nil {
		// Log error if it's not "no rows" (although Dequeue returns nil/error for empty queue handling depends on implementation)
		// Our Dequeue implementation returns pgx.ErrNoRows if empty, which we might want to ignore or log as debug.
		return
	}

	if item == nil {
		return
	}

	w.logger.Info().Str("item_id", item.ID).Str("type", item.ProcessingType).Msg("Processing queue item")

	// Simulate processing
	// In real implementation, this would call media-processor or do image manipulation
	time.Sleep(1 * time.Second)

	// Determine success/failure (simulated)
	// For now, we just complete it
	if err := w.queueRepo.Complete(ctx, item.ID); err != nil {
		w.logger.Error().Err(err).Str("item_id", item.ID).Msg("Failed to complete item")
	} else {
		w.logger.Info().Str("item_id", item.ID).Msg("Completed item")
	}
}
