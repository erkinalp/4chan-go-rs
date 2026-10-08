package worker

import (
	"context"
	"fmt"
	"time"

	"bytes"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/repository"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/storage"
	"github.com/rs/zerolog"
	"golang.org/x/image/draw"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
)

type Worker struct {
	queueRepo   *repository.QueueRepository
	fileRepo    *repository.FileRepository
	fileStorage *storage.MinioClient
	stopChan    chan struct{}
	logger      zerolog.Logger
}

func NewWorker(queueRepo *repository.QueueRepository, logger zerolog.Logger) *Worker {
	return &Worker{
		queueRepo: queueRepo,
		stopChan:  make(chan struct{}),
		logger:    logger,
	}
}

func NewWorkerWithStorage(queueRepo *repository.QueueRepository, fileRepo *repository.FileRepository, fileStorage *storage.MinioClient, logger zerolog.Logger) *Worker {
	return &Worker{
		queueRepo:   queueRepo,
		fileRepo:    fileRepo,
		fileStorage: fileStorage,
		stopChan:    make(chan struct{}),
		logger:      logger,
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
		return
	}

	if item == nil {
		return
	}

	w.logger.Info().Str("item_id", item.ID).Str("type", item.ProcessingType).Msg("Processing queue item")

	if err := w.processItem(ctx, item); err != nil {
		w.logger.Error().Err(err).Str("item_id", item.ID).Msg("Failed to process item")
		if item.Attempts >= item.MaxAttempts {
			if failErr := w.queueRepo.Fail(ctx, item.ID, err.Error()); failErr != nil {
				w.logger.Error().Err(failErr).Str("item_id", item.ID).Msg("Failed to mark item as failed")
			}
		}
		return
	}

	if err := w.queueRepo.Complete(ctx, item.ID); err != nil {
		w.logger.Error().Err(err).Str("item_id", item.ID).Msg("Failed to complete item")
	} else {
		w.logger.Info().Str("item_id", item.ID).Msg("Completed item")
	}
}

func (w *Worker) processItem(ctx context.Context, item *repository.QueueItem) error {
	switch item.ProcessingType {
	case "process_file":
		return w.generateThumbnail(ctx, item.FileID)
	default:
		w.logger.Warn().Str("type", item.ProcessingType).Msg("Unknown processing type, skipping")
		return nil
	}
}

func (w *Worker) generateThumbnail(ctx context.Context, fileID string) error {
	if w.fileRepo == nil || w.fileStorage == nil {
		// Storage not configured, skip thumbnail generation
		return nil
	}

	file, err := w.fileRepo.GetFileByID(ctx, fileID)
	if err != nil {
		return fmt.Errorf("failed to get file: %w", err)
	}
	if file == nil {
		return fmt.Errorf("file not found: %s", fileID)
	}

	// Only generate thumbnails for images
	if file.MimeType != "image/jpeg" && file.MimeType != "image/png" && file.MimeType != "image/gif" && file.MimeType != "image/webp" {
		return nil
	}

	// Retrieve original file from storage
	fileData, err := w.fileStorage.GetFile(ctx, file.StoredFilename)
	if err != nil {
		return fmt.Errorf("failed to retrieve file from storage: %w", err)
	}

	// Decode image
	reader := bytes.NewReader(fileData)
	src, _, err := image.Decode(reader)
	if err != nil {
		return fmt.Errorf("failed to decode image: %w", err)
	}

	// Resize to max 250x250 preserving aspect ratio
	thumbnail := resizeImage(src, 250, 250)

	// Encode thumbnail as JPEG
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, thumbnail, &jpeg.Options{Quality: 85}); err != nil {
		return fmt.Errorf("failed to encode thumbnail: %w", err)
	}

	// Upload thumbnail to storage
	thumbFilename := fmt.Sprintf("thumb_%s.jpg", fileID)
	_, err = w.fileStorage.UploadFile(ctx, buf.Bytes(), thumbFilename, "image/jpeg")
	if err != nil {
		return fmt.Errorf("failed to upload thumbnail: %w", err)
	}

	w.logger.Info().Str("file_id", fileID).Str("thumbnail", thumbFilename).Msg("Generated thumbnail")
	return nil
}

// resizeImage resizes an image to fit within maxWidth x maxHeight preserving aspect ratio
func resizeImage(src image.Image, maxWidth, maxHeight int) image.Image {
	bounds := src.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()

	// Calculate target dimensions preserving aspect ratio
	ratio := float64(srcWidth) / float64(srcHeight)
	targetRatio := float64(maxWidth) / float64(maxHeight)

	var newWidth, newHeight int
	if ratio > targetRatio {
		newWidth = maxWidth
		newHeight = int(float64(maxWidth) / ratio)
	} else {
		newHeight = maxHeight
		newWidth = int(float64(maxHeight) * ratio)
	}

	if newWidth < 1 {
		newWidth = 1
	}
	if newHeight < 1 {
		newHeight = 1
	}

	// If the image is already smaller, don't upscale
	if srcWidth <= maxWidth && srcHeight <= maxHeight {
		return src
	}

	dst := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)
	return dst
}
