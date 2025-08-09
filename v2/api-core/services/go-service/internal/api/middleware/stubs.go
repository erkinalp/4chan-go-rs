package middleware

import (
	"net/http"

	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/go-service/config"
	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/go-service/internal/database"
	"github.com/gin-gonic/gin"
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

func RateLimiter(_ *database.RedisClient, _ config.RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func JWTAuth(_ config.JWTConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
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
