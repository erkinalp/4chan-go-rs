package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	rateLimitHits = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rate_limit_hits_total",
			Help: "Total number of rate limit hits",
		},
		[]string{"type", "blocked"},
	)
	rateLimitBlockDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "rate_limit_block_duration_seconds",
			Help:    "Duration of rate limit blocks",
			Buckets: []float64{60, 120, 300, 600, 1800, 3600},
		},
	)
)

func init() {
	prometheus.MustRegister(rateLimitHits)
	prometheus.MustRegister(rateLimitBlockDuration)
}

type RateLimiter struct {
	redis         *database.RedisClient
	cfg           config.RateLimitConfig
	ipHeaderName  string
}

func NewRateLimiter(redis *database.RedisClient, cfg config.RateLimitConfig) *RateLimiter {
	ipHeader := cfg.IPHeaderName
	if ipHeader == "" {
		ipHeader = "X-Real-IP"
	}
	return &RateLimiter{
		redis:        redis,
		cfg:          cfg,
		ipHeaderName: ipHeader,
	}
}

func (rl *RateLimiter) RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !rl.cfg.Enabled {
			c.Next()
			return
		}

		ctx := c.Request.Context()

		userID, exists := c.Get("userID")
		userCreatedAt, createdAtExists := c.Get("userCreatedAt")

		var identifier string
		var identifierType string
		var windowStart time.Time

		if exists && userID != nil {
			identifier = fmt.Sprintf("user:%v", userID)
			identifierType = "user"
			if createdAtExists && userCreatedAt != nil {
				if createdTime, ok := userCreatedAt.(time.Time); ok {
					windowStart = rl.calculateUserWindowStart(createdTime, ctx, identifier)
				} else {
					windowStart = rl.calculateIPWindowStart(ctx, identifier)
				}
			} else {
				windowStart = rl.calculateIPWindowStart(ctx, identifier)
			}
		} else {
			clientIP := rl.getClientIP(c)
			identifier = fmt.Sprintf("ip:%s", clientIP)
			identifierType = "ip"
			windowStart = rl.calculateIPWindowStart(ctx, identifier)
		}

		blocked, err := rl.isBlocked(ctx, identifier)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Rate limiter error",
			})
			c.Abort()
			return
		}

		if blocked {
			rateLimitHits.WithLabelValues(identifierType, "true").Inc()
			rl.extendBlock(ctx, identifier)
			c.Header("Retry-After", strconv.Itoa(rl.cfg.WindowSeconds))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"retry_after": rl.cfg.WindowSeconds,
			})
			c.Abort()
			return
		}

		count, err := rl.incrementCounter(ctx, identifier, windowStart)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Rate limiter error",
			})
			c.Abort()
			return
		}

		if count > rl.cfg.Requests {
			rateLimitHits.WithLabelValues(identifierType, "true").Inc()
			rl.blockIdentifier(ctx, identifier)
			rateLimitBlockDuration.Observe(float64(rl.cfg.WindowSeconds))
			c.Header("Retry-After", strconv.Itoa(rl.cfg.WindowSeconds))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"retry_after": rl.cfg.WindowSeconds,
			})
			c.Abort()
			return
		}

		rateLimitHits.WithLabelValues(identifierType, "false").Inc()
		c.Header("X-RateLimit-Limit", strconv.Itoa(rl.cfg.Requests))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(rl.cfg.Requests-count))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(windowStart.Add(time.Duration(rl.cfg.WindowSeconds)*time.Second).Unix(), 10))

		c.Next()
	}
}

func (rl *RateLimiter) calculateUserWindowStart(userCreatedAt time.Time, ctx context.Context, identifier string) time.Time {
	blockEndKey := fmt.Sprintf("rate_limit:block_end:%s", identifier)
	blockEndStr, err := rl.redis.Get(ctx, blockEndKey)
	
	var baseTime time.Time
	if err == nil && blockEndStr != "" {
		blockEndUnix, parseErr := strconv.ParseInt(blockEndStr, 10, 64)
		if parseErr == nil {
			baseTime = time.Unix(blockEndUnix, 0)
		} else {
			baseTime = userCreatedAt
		}
	} else {
		baseTime = userCreatedAt
	}

	now := time.Now()
	windowDuration := time.Duration(rl.cfg.WindowSeconds) * time.Second
	
	elapsed := now.Sub(baseTime)
	windowsElapsed := int64(elapsed / windowDuration)
	windowStart := baseTime.Add(time.Duration(windowsElapsed) * windowDuration)
	
	return windowStart
}

func (rl *RateLimiter) calculateIPWindowStart(ctx context.Context, identifier string) time.Time {
	offsetKey := fmt.Sprintf("rate_limit:user_offset:%s", identifier)
	offsetStr, err := rl.redis.Get(ctx, offsetKey)
	
	var baseTime time.Time
	if err == nil && offsetStr != "" {
		offsetUnix, parseErr := strconv.ParseInt(offsetStr, 10, 64)
		if parseErr == nil {
			baseTime = time.Unix(offsetUnix, 0)
		} else {
			baseTime = time.Now()
			rl.redis.Set(ctx, offsetKey, strconv.FormatInt(baseTime.Unix(), 10), 24*time.Hour)
		}
	} else {
		baseTime = time.Now()
		rl.redis.Set(ctx, offsetKey, strconv.FormatInt(baseTime.Unix(), 10), 24*time.Hour)
	}

	blockEndKey := fmt.Sprintf("rate_limit:block_end:%s", identifier)
	blockEndStr, err := rl.redis.Get(ctx, blockEndKey)
	if err == nil && blockEndStr != "" {
		blockEndUnix, parseErr := strconv.ParseInt(blockEndStr, 10, 64)
		if parseErr == nil {
			blockEndTime := time.Unix(blockEndUnix, 0)
			if blockEndTime.After(baseTime) {
				baseTime = blockEndTime
			}
		}
	}

	now := time.Now()
	windowDuration := time.Duration(rl.cfg.WindowSeconds) * time.Second
	
	elapsed := now.Sub(baseTime)
	windowsElapsed := int64(elapsed / windowDuration)
	windowStart := baseTime.Add(time.Duration(windowsElapsed) * windowDuration)
	
	return windowStart
}

func (rl *RateLimiter) isBlocked(ctx context.Context, identifier string) (bool, error) {
	blockKey := fmt.Sprintf("rate_limit:block:%s", identifier)
	exists, err := rl.redis.Exists(ctx, blockKey)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (rl *RateLimiter) blockIdentifier(ctx context.Context, identifier string) error {
	blockKey := fmt.Sprintf("rate_limit:block:%s", identifier)
	blockEndKey := fmt.Sprintf("rate_limit:block_end:%s", identifier)
	
	blockDuration := time.Duration(rl.cfg.WindowSeconds) * time.Second
	blockEndTime := time.Now().Add(blockDuration)
	
	if err := rl.redis.Set(ctx, blockKey, "1", blockDuration); err != nil {
		return err
	}
	
	return rl.redis.Set(ctx, blockEndKey, strconv.FormatInt(blockEndTime.Unix(), 10), 24*time.Hour)
}

func (rl *RateLimiter) extendBlock(ctx context.Context, identifier string) error {
	blockKey := fmt.Sprintf("rate_limit:block:%s", identifier)
	blockEndKey := fmt.Sprintf("rate_limit:block_end:%s", identifier)
	
	blockDuration := time.Duration(rl.cfg.WindowSeconds) * time.Second
	blockEndTime := time.Now().Add(blockDuration)
	
	if err := rl.redis.Set(ctx, blockKey, "1", blockDuration); err != nil {
		return err
	}
	
	return rl.redis.Set(ctx, blockEndKey, strconv.FormatInt(blockEndTime.Unix(), 10), 24*time.Hour)
}

func (rl *RateLimiter) incrementCounter(ctx context.Context, identifier string, windowStart time.Time) (int, error) {
	countKey := fmt.Sprintf("rate_limit:count:%s:%d", identifier, windowStart.Unix())
	
	count, err := rl.redis.Increment(ctx, countKey)
	if err != nil {
		return 0, err
	}
	
	if count == 1 {
		windowDuration := time.Duration(rl.cfg.WindowSeconds) * time.Second
		rl.redis.Set(ctx, countKey, "1", windowDuration)
	}
	
	return int(count), nil
}

func (rl *RateLimiter) getClientIP(c *gin.Context) string {
	if ip := c.GetHeader(rl.ipHeaderName); ip != "" {
		return ip
	}
	
	if ip := c.GetHeader("X-Forwarded-For"); ip != "" {
		return ip
	}
	
	return c.ClientIP()
}
