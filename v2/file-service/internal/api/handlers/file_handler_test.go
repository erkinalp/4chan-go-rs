package handlers

import "testing"

func TestExtMatchesMime(t *testing.T) {
	tests := []struct {
		ext  string
		mime string
		ok   bool
	}{
		{".jpg", "image/jpeg", true},
		{".jpeg", "image/jpeg", true},
		{".png", "image/png", true},
		{".gif", "image/gif", true},
		{".webp", "image/webp", true},
		{".mp4", "video/mp4", true},
		{".webm", "video/webm", true},
		{".pdf", "application/pdf", true},
		{".zip", "application/zip", true},
		{".7z", "application/x-7z-compressed", true},
		{".exe", "image/jpeg", false},
		{"", "image/jpeg", false},
	}
	for _, tt := range tests {
		if got := extMatchesMime(tt.ext, tt.mime); got != tt.ok {
			t.Fatalf("extMatchesMime(%s,%s)=%v want %v", tt.ext, tt.mime, got, tt.ok)
		}
	}
}
