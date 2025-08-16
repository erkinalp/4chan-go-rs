package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/go-service/config"
	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/go-service/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func RequestLogger(_ zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func Recovery(_ zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
			}
		}()
		c.Next()
	}
}

func CORS(_ config.CORSConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func Security() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

type UserClaims struct {
	UserID    string    `json:"user_id"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	jwt.RegisteredClaims
}

func RateLimiter(redis *database.RedisClient, cfg config.RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !cfg.Enabled {
			c.Next()
			return
		}

		userID, createdAt, err := extractUserFromJWT(c, cfg)

		var blocked bool
		if err == nil && userID != "" {
			blocked = checkUserRateLimit(c, redis, cfg, userID, createdAt)
		} else {
			blocked = checkIPRateLimit(c, redis, cfg)
		}

		if blocked {
			return
		}

		c.Next()
	}
}

func extractUserFromJWT(c *gin.Context, cfg config.RateLimitConfig) (string, time.Time, error) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return "", time.Time{}, errors.New("no authorization header")
	}

	if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		return "", time.Time{}, errors.New("invalid authorization header format")
	}

	tokenString := authHeader[7:]
	
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte("default_secret"), nil
	})

	if err != nil {
		return "", time.Time{}, err
	}

	if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
		return claims.UserID, claims.CreatedAt, nil
	}

	return "", time.Time{}, errors.New("invalid token claims")
}

func checkUserRateLimit(c *gin.Context, redis *database.RedisClient, cfg config.RateLimitConfig, userID string, createdAt time.Time) bool {
	ctx := context.Background()
	currentTime := time.Now()
	windowSeconds := time.Duration(cfg.WindowSeconds) * time.Second

	blockKey := fmt.Sprintf("rate_limit:block:user:%s", userID)
	
	blocked, err := redis.Exists(ctx, blockKey)
	if err == nil && blocked {
		redis.SetWithTTL(ctx, blockKey, "blocked", windowSeconds)
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "Rate limit exceeded",
			"message": "User blocked due to rate limit violation - block extended for full window",
			"retry_after": cfg.WindowSeconds,
		})
		c.Abort()
		return true
	}

	windowStart := calculateUserWindowStart(currentTime, createdAt, windowSeconds)
	countKey := fmt.Sprintf("rate_limit:count:user:%s:%d", userID, windowStart.Unix())

	currentCount := 0
	if countStr, err := redis.Get(ctx, countKey); err == nil {
		if count, err := strconv.Atoi(countStr); err == nil {
			currentCount = count
		}
	}

	currentCount++

	if currentCount > cfg.Requests {
		redis.SetWithTTL(ctx, blockKey, "blocked", windowSeconds)
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "Rate limit exceeded",
			"message": "Request limit exceeded, user blocked for full window",
			"limit": cfg.Requests,
			"window": cfg.WindowSeconds,
			"current_count": currentCount,
		})
		c.Abort()
		return true
	}

	windowEnd := windowStart.Add(windowSeconds)
	ttl := windowEnd.Sub(currentTime)
	redis.SetWithTTL(ctx, countKey, strconv.Itoa(currentCount), ttl)

	c.Header("X-RateLimit-Type", "user")
	c.Header("X-RateLimit-Limit", strconv.Itoa(cfg.Requests))
	c.Header("X-RateLimit-Remaining", strconv.Itoa(max(0, cfg.Requests-currentCount)))
	c.Header("X-RateLimit-Reset", strconv.FormatInt(windowEnd.Unix(), 10))

	return false
}

func checkIPRateLimit(c *gin.Context, redis *database.RedisClient, cfg config.RateLimitConfig) bool {
	ctx := context.Background()
	ip := getClientIP(c, cfg.IPHeaderName)
	currentTime := time.Now()
	windowSeconds := time.Duration(cfg.WindowSeconds) * time.Second

	blockKey := fmt.Sprintf("rate_limit:block:ip:%s", ip)
	
	blocked, err := redis.Exists(ctx, blockKey)
	if err == nil && blocked {
		redis.SetWithTTL(ctx, blockKey, "blocked", windowSeconds)
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "Rate limit exceeded",
			"message": "IP blocked due to rate limit violation - block extended for full window",
			"retry_after": cfg.WindowSeconds,
		})
		c.Abort()
		return true
	}

	windowStart := currentTime.Truncate(windowSeconds)
	countKey := fmt.Sprintf("rate_limit:count:ip:%s:%d", ip, windowStart.Unix())

	currentCount := 0
	if countStr, err := redis.Get(ctx, countKey); err == nil {
		if count, err := strconv.Atoi(countStr); err == nil {
			currentCount = count
		}
	}

	currentCount++

	if currentCount > cfg.Requests {
		redis.SetWithTTL(ctx, blockKey, "blocked", windowSeconds)
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "Rate limit exceeded",
			"message": "Request limit exceeded, IP blocked for full window",
			"limit": cfg.Requests,
			"window": cfg.WindowSeconds,
			"current_count": currentCount,
		})
		c.Abort()
		return true
	}

	windowEnd := windowStart.Add(windowSeconds)
	ttl := windowEnd.Sub(currentTime)
	redis.SetWithTTL(ctx, countKey, strconv.Itoa(currentCount), ttl)

	c.Header("X-RateLimit-Type", "ip")
	c.Header("X-RateLimit-Limit", strconv.Itoa(cfg.Requests))
	c.Header("X-RateLimit-Remaining", strconv.Itoa(max(0, cfg.Requests-currentCount)))
	c.Header("X-RateLimit-Reset", strconv.FormatInt(windowEnd.Unix(), 10))

	return false
}

func calculateUserWindowStart(currentTime, createdAt time.Time, windowDuration time.Duration) time.Time {
	timeSinceCreation := currentTime.Sub(createdAt)
	windowsSinceCreation := int64(timeSinceCreation / windowDuration)
	return createdAt.Add(time.Duration(windowsSinceCreation) * windowDuration)
}

func getClientIP(c *gin.Context, headerName string) string {
	if headerName != "" {
		if ip := c.GetHeader(headerName); ip != "" {
			return ip
		}
	}
	return c.ClientIP()
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func JWTAuth(cfg config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Unauthorized",
				"message": "Missing authorization header",
			})
			c.Abort()
			return
		}

		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Unauthorized",
				"message": "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		tokenString := authHeader[7:]
		
		token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(cfg.SecretKey), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Unauthorized",
				"message": "Invalid JWT token",
			})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
			c.Set("user_id", claims.UserID)
			c.Set("user_role", claims.Role)
			c.Set("user_created_at", claims.CreatedAt)
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Unauthorized",
				"message": "Invalid token claims",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func Authorization(_ []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func ValidateCaptcha(_ interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func Metrics() gin.HandlerFunc {
	return gin.WrapH(promhttp.Handler())
}
