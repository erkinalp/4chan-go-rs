package database

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
)

func newTestRedisClient(t *testing.T) (*RedisClient, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	port, err := strconv.Atoi(mr.Port())
	if err != nil {
		t.Fatalf("bad miniredis port: %v", err)
	}
	rc, err := NewRedisClient(config.RedisConfig{
		Host: "127.0.0.1",
		Port: port,
	})
	if err != nil {
		t.Fatalf("NewRedisClient failed: %v", err)
	}
	t.Cleanup(func() { rc.Close() })
	return rc, mr
}

func TestNewRedisClient_ConnectionFailure(t *testing.T) {
	// Point at a port nothing listens on.
	mr := miniredis.RunT(t)
	port, _ := strconv.Atoi(mr.Port())
	mr.Close()

	_, err := NewRedisClient(config.RedisConfig{Host: "127.0.0.1", Port: port})
	if err == nil {
		t.Fatal("expected connection error")
	}
}

func TestRedisClient_SetGetDelete(t *testing.T) {
	rc, _ := newTestRedisClient(t)
	ctx := context.Background()

	if err := rc.Set(ctx, "k1", "v1", time.Minute); err != nil {
		t.Fatalf("Set failed: %v", err)
	}
	got, err := rc.Get(ctx, "k1")
	if err != nil || got != "v1" {
		t.Fatalf("Get=%q err=%v", got, err)
	}

	if err := rc.Delete(ctx, "k1"); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if _, err := rc.Get(ctx, "k1"); err == nil {
		t.Fatal("expected error getting deleted key")
	}
}

func TestRedisClient_Exists(t *testing.T) {
	rc, _ := newTestRedisClient(t)
	ctx := context.Background()

	ok, err := rc.Exists(ctx, "nope")
	if err != nil || ok {
		t.Fatalf("Exists=%v err=%v want false", ok, err)
	}

	_ = rc.Set(ctx, "k", "v", time.Minute)
	ok, err = rc.Exists(ctx, "k")
	if err != nil || !ok {
		t.Fatalf("Exists=%v err=%v want true", ok, err)
	}
}

func TestRedisClient_Increment(t *testing.T) {
	rc, _ := newTestRedisClient(t)
	ctx := context.Background()

	for want := int64(1); want <= 3; want++ {
		got, err := rc.Increment(ctx, "counter")
		if err != nil || got != want {
			t.Fatalf("Increment=%d err=%v want %d", got, err, want)
		}
	}
}

func TestRedisClient_SetWithTTL(t *testing.T) {
	rc, mr := newTestRedisClient(t)
	ctx := context.Background()

	if err := rc.SetWithTTL(ctx, "ttl-key", "v", 30*time.Second); err != nil {
		t.Fatalf("SetWithTTL failed: %v", err)
	}
	if !mr.Exists("ttl-key") {
		t.Fatal("key missing")
	}
	if ttl := mr.TTL("ttl-key"); ttl != 30*time.Second {
		t.Fatalf("TTL=%v want 30s", ttl)
	}
}

func TestRedisClient_RateLimiter(t *testing.T) {
	rc, _ := newTestRedisClient(t)
	ctx := context.Background()
	key := "rl:test"
	limit := 3
	window := time.Minute

	// First call creates the counter at 1 — never exceeds.
	for i := 1; i <= limit; i++ {
		exceeded, err := rc.RateLimiter(ctx, key, limit, window)
		if err != nil {
			t.Fatalf("RateLimiter call %d failed: %v", i, err)
		}
		if exceeded {
			t.Fatalf("call %d unexpectedly exceeded the limit", i)
		}
	}

	exceeded, err := rc.RateLimiter(ctx, key, limit, window)
	if err != nil {
		t.Fatalf("RateLimiter failed: %v", err)
	}
	if !exceeded {
		t.Fatal("expected limit to be exceeded")
	}
}
