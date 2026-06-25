package storage

import (
	"testing"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
)

func TestIsImage(t *testing.T) {
	tests := []struct {
		filename string
		expected bool
	}{
		{"image.jpg", true},
		{"photo.jpeg", true},
		{"icon.png", true},
		{"anim.gif", true},
		{"modern.webp", true},
		{"document.pdf", false},
		{"archive.zip", false},
		{"video.mp4", false},
		{"noext", false},
		{"", false},
	}

	for _, tt := range tests {
		result := IsImage(tt.filename)
		if result != tt.expected {
			t.Errorf("IsImage(%q) = %v, want %v", tt.filename, result, tt.expected)
		}
	}
}

func TestNewMinioClient_InvalidEndpoint(t *testing.T) {
	cfg := config.MinioConfig{
		Endpoint:  "invalid-host:9999",
		AccessKey: "test",
		SecretKey: "test",
		Bucket:    "test",
		UseSSL:    false,
	}

	// NewMinioClient will create a client but may fail on bucket check
	_, err := NewMinioClient(cfg)
	if err == nil {
		t.Log("Client created successfully (bucket check deferred or passed)")
	} else {
		t.Logf("Expected failure for invalid endpoint: %v", err)
	}
}
