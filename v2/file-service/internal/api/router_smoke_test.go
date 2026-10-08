package api

import (
	"testing"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/rs/zerolog"
)

// Temporary smoke test: verifies the merged route tree registers without panic.
func TestNewRouterDoesNotPanic(t *testing.T) {
	cfg := &config.Config{}
	cfg.Server.APIPrefix = "api"
	cfg.Server.APIVersion = "v1"
	cfg.Environment = "development"
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("NewRouter panicked: %v", r)
		}
	}()
	_ = NewRouter(cfg, zerolog.Nop(), nil, nil, nil)
}
