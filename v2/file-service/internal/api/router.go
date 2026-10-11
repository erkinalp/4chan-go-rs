package api

import (
	"net/http"
	"strings"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/api/handlers"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/api/middleware"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/auth"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/database"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/repository"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/services"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/storage"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// NewRouter creates a router for the file-service with full middleware stack
func NewRouter(
	cfg *config.Config,
	logger zerolog.Logger,
	db *database.PostgresDB,
	redis *database.RedisClient,
	fileStorage *storage.MinioClient,
) *gin.Engine {
	router := gin.New()

	// Restrict which proxies may supply X-Forwarded-For values. Without this
	// gin trusts every proxy, letting any direct client spoof its apparent IP.
	if cfg.Server.TrustedProxies != "" {
		proxies := strings.Split(cfg.Server.TrustedProxies, ",")
		for i, p := range proxies {
			proxies[i] = strings.TrimSpace(p)
		}
		if err := router.SetTrustedProxies(proxies); err != nil {
			logger.Warn().Err(err).Msg("Invalid TRUSTED_PROXIES value; keeping gin defaults")
		}
	}

	// Initialize GNAP client for authentication. Bearer tokens are first
	// validated locally as HS256 JWTs (what api-core issues); only when that
	// fails does the client fall back to GNAP introspection, so uploads and
	// deletes keep working without a GNAP server deployed.
	gnapClient := auth.NewGNAPClient(
		cfg.GNAP.ServerURL,
		cfg.GNAP.ClientKey,
		cfg.GNAP.ClientSecret,
	)
	gnapClient.LocalSecret = cfg.JWT.SecretKey

	// Initialize media processor client for thumbnail generation
	var mediaProcessor *services.MediaProcessorClient
	if cfg.MediaProcessor.Enabled && cfg.MediaProcessor.BaseURL != "" {
		mediaProcessor = services.NewMediaProcessorClient(cfg.MediaProcessor.BaseURL)
	}

	// Initialize middleware
	corsMiddleware := middleware.NewCORSMiddleware(cfg.CORS)
	authMiddleware := middleware.NewAuthMiddleware(gnapClient)
	rateLimiter := middleware.NewRateLimiter(redis, cfg.RateLimit)

	// Global middleware stack
	router.Use(gin.Recovery())
	router.Use(middleware.PrometheusMiddleware())
	router.Use(corsMiddleware.Handler())

	// Metrics endpoint (no auth required)
	router.GET("/metrics", middleware.Metrics())

	// Health check endpoint (no auth required)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "file-service",
		})
	})

	// Initialize repositories and services
	fileRepo := repository.NewFileRepository(db)
	queueRepo := repository.NewQueueRepository(db)
	malwareScanner := services.NewClamAVScanner(cfg.MalwareScanner)
	fileHandler := handlers.NewFileHandler(fileStorage, fileRepo, queueRepo, malwareScanner, mediaProcessor, logger)

	// API routes
	apiPrefix := cfg.Server.APIPrefix + "/" + cfg.Server.APIVersion
	api := router.Group(apiPrefix)

	// Swagger documentation (non-production only)
	if cfg.Environment != "production" {
		api.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	// Public file routes (read-only, with optional auth for rate limiting)
	publicFiles := api.Group("/files")
	publicFiles.Use(authMiddleware.OptionalAuth())
	publicFiles.Use(rateLimiter.RateLimitMiddleware())
	{
		publicFiles.GET("/:fileId", fileHandler.GetFile)
		publicFiles.GET("/:fileId/content", fileHandler.GetFileContent)
		// /download kept as an alias of /content for backwards compatibility
		publicFiles.GET("/:fileId/download", fileHandler.GetFileContent)
		publicFiles.GET("/:fileId/thumbnail", fileHandler.GetThumbnail)
	}

	// File check endpoint (optional auth for rate limiting)
	api.POST("/files/check", authMiddleware.OptionalAuth(), rateLimiter.RateLimitMiddleware(), fileHandler.CheckFile)

	// Post-scoped file listing (public, optional auth for rate limiting)
	api.GET("/posts/:postId/files", authMiddleware.OptionalAuth(), rateLimiter.RateLimitMiddleware(), fileHandler.ListByPost)

	// Protected file routes (require authentication)
	protectedFiles := api.Group("/files")
	protectedFiles.Use(authMiddleware.RequireAuth())
	protectedFiles.Use(rateLimiter.RateLimitMiddleware())
	{
		protectedFiles.POST("", fileHandler.Upload)
		protectedFiles.POST("/upload", fileHandler.Upload)
		protectedFiles.DELETE("/:fileId", fileHandler.DeleteFile)
	}

	// Admin-only routes
	adminFiles := api.Group("/files")
	adminFiles.Use(authMiddleware.RequireAuth())
	adminFiles.Use(authMiddleware.RequireRole("admin", "moderator"))
	{
		adminFiles.GET("/banned", fileHandler.GetBannedHashes)
		adminFiles.GET("/stats", fileHandler.GetFileStats)
		adminFiles.POST("/purge", fileHandler.PurgeFiles)
	}

	return router
}
