package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	authRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_requests_total",
			Help: "Total number of authentication requests",
		},
		[]string{"status"},
	)
	authDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "auth_duration_seconds",
			Help:    "Duration of authentication operations",
			Buckets: prometheus.DefBuckets,
		},
	)
)

func init() {
	prometheus.MustRegister(authRequestsTotal)
	prometheus.MustRegister(authDuration)
}

type AuthMiddleware struct {
	gnapClient *auth.GNAPClient
}

func NewAuthMiddleware(gnapClient *auth.GNAPClient) *AuthMiddleware {
	return &AuthMiddleware{
		gnapClient: gnapClient,
	}
}

func (am *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		defer func() {
			authDuration.Observe(time.Since(start).Seconds())
		}()

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			authRequestsTotal.WithLabelValues("missing").Inc()
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 {
			authRequestsTotal.WithLabelValues("invalid_format").Inc()
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		authType := strings.ToUpper(parts[0])
		token := parts[1]

		var userCtx *auth.UserContext
		var err error

		switch authType {
		case "GNAP", "BEARER":
			userCtx, err = am.gnapClient.ValidateToken(c.Request.Context(), token)
		default:
			authRequestsTotal.WithLabelValues("unsupported_type").Inc()
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Unsupported authorization type",
			})
			c.Abort()
			return
		}

		if err != nil {
			authRequestsTotal.WithLabelValues("invalid_token").Inc()
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		authRequestsTotal.WithLabelValues("success").Inc()

		c.Set("userID", userCtx.Sub)
		c.Set("userEmail", userCtx.Email)
		c.Set("userRole", userCtx.Role)
		c.Set("userPermissions", userCtx.Permissions)
		c.Set("userContext", userCtx)

		c.Next()
	}
}

func (am *AuthMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 {
			c.Next()
			return
		}

		authType := strings.ToUpper(parts[0])
		token := parts[1]

		var userCtx *auth.UserContext
		var err error

		switch authType {
		case "GNAP", "BEARER":
			userCtx, err = am.gnapClient.ValidateToken(c.Request.Context(), token)
		default:
			c.Next()
			return
		}

		if err != nil {
			c.Next()
			return
		}

		c.Set("userID", userCtx.Sub)
		c.Set("userEmail", userCtx.Email)
		c.Set("userRole", userCtx.Role)
		c.Set("userPermissions", userCtx.Permissions)
		c.Set("userContext", userCtx)

		c.Next()
	}
}

func (am *AuthMiddleware) RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
			})
			c.Abort()
			return
		}

		roleStr, ok := userRole.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid user role format",
			})
			c.Abort()
			return
		}

		for _, allowedRole := range roles {
			if roleStr == allowedRole {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error": "Insufficient permissions",
		})
		c.Abort()
	}
}

func (am *AuthMiddleware) RequirePermission(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userPerms, exists := c.Get("userPermissions")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
			})
			c.Abort()
			return
		}

		permsSlice, ok := userPerms.([]string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid permissions format",
			})
			c.Abort()
			return
		}

		permMap := make(map[string]bool)
		for _, p := range permsSlice {
			permMap[p] = true
		}

		for _, requiredPerm := range permissions {
			if !permMap[requiredPerm] {
				c.JSON(http.StatusForbidden, gin.H{
					"error": "Missing required permission: " + requiredPerm,
				})
				c.Abort()
				return
			}
		}

		c.Next()
	}
}
