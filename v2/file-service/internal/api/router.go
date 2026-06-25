package api

import (
	"net/http"

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
	files "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// NewRouter creates the file-service router with all routes wired
func NewRouter(
	cfg *config.Config,
	logger zerolog.Logger,
	db *database.PostgresDB,
	_ *database.RedisClient,
	fileStorage *storage.MinioClient,
) *gin.Engine {
	router := gin.New()

	// Global middleware
	router.Use(gin.Recovery())
	router.Use(middleware.PrometheusMiddleware())
	router.GET("/metrics", middleware.Metrics())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "file-service",
		})
	})

	// Initialize dependencies
	fileRepo := repository.NewFileRepository(db)
	queueRepo := repository.NewQueueRepository(db)
	malwareScanner := services.NewClamAVScanner(cfg.MalwareScanner)
	fileHandler := handlers.NewFileHandler(fileStorage, fileRepo, queueRepo, malwareScanner, logger)

	// JWT auth middleware
	jwtMiddleware := auth.JWTAuthMiddleware(cfg.JWT)

	// API routes
	apiPrefix := cfg.Server.APIPrefix + "/" + cfg.Server.APIVersion
	api := router.Group(apiPrefix)

	// Swagger documentation (non-production only)
	if cfg.Environment != "production" {
		api.GET("/swagger/*any", ginSwagger.WrapHandler(files.Handler))
	}

	// Public file routes (no auth required)
	filesGroup := api.Group("/files")
	{
		filesGroup.GET("/:fileId", fileHandler.GetFile)
		filesGroup.GET("/:fileId/download", fileHandler.GetFileContent)
		filesGroup.GET("/:fileId/thumbnail", fileHandler.GetThumbnail)
		filesGroup.POST("/check", fileHandler.CheckFile)
		filesGroup.GET("/banned", fileHandler.GetBannedHashes)
	}

	// Protected file routes (auth required)
	protectedFiles := api.Group("/files")
	protectedFiles.Use(jwtMiddleware)
	{
		protectedFiles.POST("", fileHandler.Upload)
		protectedFiles.DELETE("/:fileId", fileHandler.DeleteFile)
		protectedFiles.GET("/stats", fileHandler.GetFileStats)
		protectedFiles.POST("/purge", fileHandler.PurgeFiles)
	}

	// Post-scoped file listing (public)
	api.GET("/posts/:postId/files", fileHandler.ListByPost)

	return router
}
