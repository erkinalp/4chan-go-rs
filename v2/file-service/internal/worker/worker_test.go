package worker

import (
	"image"
	"image/color"
	"testing"

	"github.com/rs/zerolog"
)

func TestResizeImage_Landscape(t *testing.T) {
	// Create a 800x400 landscape image
	src := image.NewRGBA(image.Rect(0, 0, 800, 400))
	for x := 0; x < 800; x++ {
		for y := 0; y < 400; y++ {
			src.Set(x, y, color.RGBA{255, 0, 0, 255})
		}
	}

	result := resizeImage(src, 250, 250)
	bounds := result.Bounds()

	// Should fit within 250x250, width-limited
	if bounds.Dx() != 250 {
		t.Errorf("expected width=250, got %d", bounds.Dx())
	}
	if bounds.Dy() != 125 {
		t.Errorf("expected height=125, got %d", bounds.Dy())
	}
}

func TestResizeImage_Portrait(t *testing.T) {
	// Create a 400x800 portrait image
	src := image.NewRGBA(image.Rect(0, 0, 400, 800))

	result := resizeImage(src, 250, 250)
	bounds := result.Bounds()

	// Should fit within 250x250, height-limited
	if bounds.Dy() != 250 {
		t.Errorf("expected height=250, got %d", bounds.Dy())
	}
	if bounds.Dx() != 125 {
		t.Errorf("expected width=125, got %d", bounds.Dx())
	}
}

func TestResizeImage_Square(t *testing.T) {
	// Create a 500x500 square image
	src := image.NewRGBA(image.Rect(0, 0, 500, 500))

	result := resizeImage(src, 250, 250)
	bounds := result.Bounds()

	if bounds.Dx() != 250 {
		t.Errorf("expected width=250, got %d", bounds.Dx())
	}
	if bounds.Dy() != 250 {
		t.Errorf("expected height=250, got %d", bounds.Dy())
	}
}

func TestResizeImage_SmallImage(t *testing.T) {
	// Create a 100x100 image (smaller than max)
	src := image.NewRGBA(image.Rect(0, 0, 100, 100))

	result := resizeImage(src, 250, 250)
	bounds := result.Bounds()

	// Should not upscale
	if bounds.Dx() != 100 {
		t.Errorf("expected width=100 (no upscale), got %d", bounds.Dx())
	}
	if bounds.Dy() != 100 {
		t.Errorf("expected height=100 (no upscale), got %d", bounds.Dy())
	}
}

func TestWorker_NewWorker(t *testing.T) {
	// Verify basic worker creation doesn't panic
	// (queueRepo is nil, which is fine for testing structure)
	w := NewWorker(nil, zerolog.Nop())
	if w == nil {
		t.Fatal("expected non-nil worker")
	}
	if w.stopChan == nil {
		t.Fatal("expected non-nil stop channel")
	}
}

func TestWorker_StopImmediately(t *testing.T) {
	w := NewWorker(nil, zerolog.Nop())
	w.Start()
	w.Stop()
	// If Stop doesn't close the channel, this would deadlock
}
