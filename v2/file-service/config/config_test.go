package config

import "testing"

// NOTE: viper holds global state; Load() re-registers defaults each call.
// Tests that exercise DATABASE_URL must run after the defaults test because
// Load() persists it via viper.Set once the env var is present.

func TestLoad_Defaults(t *testing.T) {
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if cfg.Environment != "development" {
		t.Fatalf("Environment=%q want development", cfg.Environment)
	}
	if cfg.LogLevel != "info" {
		t.Fatalf("LogLevel=%q want info", cfg.LogLevel)
	}
	if cfg.Server.Port != 8080 {
		t.Fatalf("Port=%d want 8080", cfg.Server.Port)
	}
	if cfg.Server.ReadTimeoutSeconds != 10 || cfg.Server.WriteTimeoutSeconds != 30 || cfg.Server.IdleTimeoutSeconds != 120 {
		t.Fatalf("unexpected timeouts: %+v", cfg.Server)
	}
	if cfg.Server.APIPrefix != "api" || cfg.Server.APIVersion != "v1" {
		t.Fatalf("unexpected api prefix/version: %+v", cfg.Server)
	}
	if cfg.Database.MaxOpenConns != 25 || cfg.Database.MaxIdleConns != 10 || cfg.Database.ConnMaxLifetime != 300 {
		t.Fatalf("unexpected database pool config: %+v", cfg.Database)
	}
	if cfg.Redis.Port != 6379 || cfg.Redis.DB != 0 {
		t.Fatalf("unexpected redis config: %+v", cfg.Redis)
	}
	if !cfg.Minio.UseSSL {
		t.Fatal("expected MINIO_USE_SSL default true")
	}
	if cfg.JWT.ExpirationHours != 24 || cfg.JWT.RefreshHours != 168 || cfg.JWT.Issuer != "4chan-v2" {
		t.Fatalf("unexpected jwt config: %+v", cfg.JWT)
	}
	if cfg.CORS.MaxAge != 86400 {
		t.Fatalf("unexpected cors config: %+v", cfg.CORS)
	}
	if !cfg.RateLimit.Enabled || cfg.RateLimit.Requests != 100 || cfg.RateLimit.WindowSeconds != 60 || cfg.RateLimit.IPHeaderName != "X-Real-IP" {
		t.Fatalf("unexpected rate limit config: %+v", cfg.RateLimit)
	}
	if !cfg.MalwareScanner.Enabled || cfg.MalwareScanner.FailOpen || cfg.MalwareScanner.Host != "clamav" || cfg.MalwareScanner.Port != 3310 {
		t.Fatalf("unexpected malware scanner config: %+v", cfg.MalwareScanner)
	}
}

func TestLoad_EnvOverrides(t *testing.T) {
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("LOG_LEVEL", "warn")
	t.Setenv("PORT", "9090")
	t.Setenv("REDIS_HOST", "redis.internal")
	t.Setenv("REDIS_PORT", "6380")
	t.Setenv("REDIS_DB", "3")
	t.Setenv("MINIO_USE_SSL", "false")
	t.Setenv("MINIO_BUCKET", "uploads")
	t.Setenv("MINIO_ENDPOINT", "minio.internal:9000")
	t.Setenv("JWT_SECRET", "super-secret")
	t.Setenv("JWT_EXPIRATION_HOURS", "12")
	t.Setenv("CORS_ALLOW_ORIGINS", "https://boards.example.com")
	t.Setenv("RATE_LIMIT_REQUESTS", "42")
	t.Setenv("MALWARE_SCANNER_ENABLED", "false")
	t.Setenv("CLAMAV_HOST", "clamav.internal")
	t.Setenv("CLAMAV_PORT", "3311")
	t.Setenv("DATABASE_URL", "postgres://user:pass@db:5432/imageboard")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if cfg.Environment != "production" {
		t.Fatalf("Environment=%q want production", cfg.Environment)
	}
	if cfg.LogLevel != "warn" {
		t.Fatalf("LogLevel=%q want warn", cfg.LogLevel)
	}
	if cfg.Server.Port != 9090 {
		t.Fatalf("Port=%d want 9090", cfg.Server.Port)
	}
	if cfg.Redis.Host != "redis.internal" || cfg.Redis.Port != 6380 || cfg.Redis.DB != 3 {
		t.Fatalf("unexpected redis config: %+v", cfg.Redis)
	}
	if cfg.Minio.UseSSL || cfg.Minio.Bucket != "uploads" || cfg.Minio.Endpoint != "minio.internal:9000" {
		t.Fatalf("unexpected minio config: %+v", cfg.Minio)
	}
	if cfg.JWT.SecretKey != "super-secret" {
		t.Fatalf("JWT_SECRET not bound: %+v", cfg.JWT)
	}
	if cfg.JWT.ExpirationHours != 12 {
		t.Fatalf("ExpirationHours=%d want 12", cfg.JWT.ExpirationHours)
	}
	if cfg.CORS.AllowOrigins != "https://boards.example.com" {
		t.Fatalf("CORS_ALLOW_ORIGINS not bound: %+v", cfg.CORS)
	}
	if cfg.RateLimit.Requests != 42 {
		t.Fatalf("Requests=%d want 42", cfg.RateLimit.Requests)
	}
	if cfg.MalwareScanner.Enabled || cfg.MalwareScanner.Host != "clamav.internal" || cfg.MalwareScanner.Port != 3311 {
		t.Fatalf("unexpected malware scanner config: %+v", cfg.MalwareScanner)
	}
	if cfg.Database.ConnectionString != "postgres://user:pass@db:5432/imageboard" {
		t.Fatalf("ConnectionString=%q", cfg.Database.ConnectionString)
	}
}
