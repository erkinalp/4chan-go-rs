package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/gin-gonic/gin"
)

type CORSMiddleware struct {
	allowOrigins []string
	allowMethods []string
	allowHeaders []string
	maxAge       int
}

func NewCORSMiddleware(cfg config.CORSConfig) *CORSMiddleware {
	origins := strings.Split(cfg.AllowOrigins, ",")
	for i, o := range origins {
		origins[i] = strings.TrimSpace(o)
	}

	methods := strings.Split(cfg.AllowMethods, ",")
	for i, m := range methods {
		methods[i] = strings.TrimSpace(m)
	}

	headers := strings.Split(cfg.AllowHeaders, ",")
	for i, h := range headers {
		headers[i] = strings.TrimSpace(h)
	}

	return &CORSMiddleware{
		allowOrigins: origins,
		allowMethods: methods,
		allowHeaders: headers,
		maxAge:       cfg.MaxAge,
	}
}

func (cm *CORSMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if cm.isOriginAllowed(origin) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Methods", strings.Join(cm.allowMethods, ", "))
			c.Header("Access-Control-Allow-Headers", strings.Join(cm.allowHeaders, ", "))
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Max-Age", strconv.Itoa(cm.maxAge))
			c.Header("Vary", "Origin")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func (cm *CORSMiddleware) isOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}

	for _, allowed := range cm.allowOrigins {
		if allowed == "*" {
			return true
		}
		if allowed == origin {
			return true
		}
		if strings.HasPrefix(allowed, "*.") {
			suffix := allowed[1:]
			if strings.HasSuffix(origin, suffix) {
				return true
			}
		}
	}

	return false
}
