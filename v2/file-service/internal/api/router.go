package api

import (
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
	ginSwagger "github.com/swaggo/gin-swagger"
	swaggerFiles "github.com/swaggo/files"
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

	// Initialize GNAP client for authentication using proper GNAP config
	// Falls back to JWT config if GNAP config is not set (for backwards compatibility)
	gnapServerURL := cfg.GNAP.ServerURL
	gnapClientKey := cfg.GNAP.ClientKey
	gnapClientSecret := cfg.GNAP.ClientSecret
	if gnapServerURL == "" {
		gnapServerURL = cfg.JWT.Issuer
	}
	if gnapClientKey == "" {
		gnapClientKey = cfg.JWT.SecretKey
	}
	if gnapClientSecret == "" {
		gnapClientSecret = cfg.JWT.RefreshSecret
	}
	gnapClient := auth.NewGNAPClient(
		gnapServerURL,
		gnapClientKey,
		gnapClientSecret,
	)

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
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Initialize repositories and services
	fileRepo := repository.NewFileRepository(db)
	queueRepo := repository.NewQueueRepository(db)
	malwareScanner := services.NewClamAVScanner(cfg.MalwareScanner)
	fileHandler := handlers.NewFileHandler(fileStorage, fileRepo, queueRepo, malwareScanner, mediaProcessor, logger)

	// API routes
	apiPrefix := cfg.Server.APIPrefix + "/" + cfg.Server.APIVersion
	api := router.Group(apiPrefix)

	// Swagger documentation (no auth in non-production)
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
		publicFiles.GET("/:fileId/thumbnail", fileHandler.GetThumbnail)
	}

	// Protected file routes (require authentication)
	protectedFiles := api.Group("/files")
	protectedFiles.Use(authMiddleware.RequireAuth())
	protectedFiles.Use(rateLimiter.RateLimitMiddleware())
	{
		protectedFiles.POST("/upload", fileHandler.Upload)
		protectedFiles.DELETE("/:fileId", fileHandler.DeleteFile)
	}

	// File check endpoint (optional auth for rate limiting)
	api.POST("/files/check", authMiddleware.OptionalAuth(), rateLimiter.RateLimitMiddleware(), fileHandler.CheckFile)

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
