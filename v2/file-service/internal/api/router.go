package api

import (
	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/api/handlers"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/api/middleware"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/database"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/repository"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/services"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/storage"
	"github.com/gin-gonic/gin"
	ginSwagger "github.com/swaggo/gin-swagger"
	files "github.com/swaggo/files"
)

// NewRouter creates a minimal router for the file-service
func NewRouter(
	cfg *config.Config,
	_ interface{},
	db *database.PostgresDB,
	_ *database.RedisClient,
	fileStorage *storage.MinioClient,
) *gin.Engine {
	router := gin.New()

	// Metrics endpoint and middleware (only ones implemented locally)
	router.Use(middleware.PrometheusMiddleware())
	router.GET("/metrics", middleware.Metrics())

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	fileRepo := repository.NewFileRepository(db)
	malwareScanner := services.NewClamAVScanner(cfg.MalwareScanner)
	fileHandler := handlers.NewFileHandler(fileStorage, fileRepo, malwareScanner)

	// API routes
	apiPrefix := cfg.Server.APIPrefix + "/" + cfg.Server.APIVersion
	api := router.Group(apiPrefix)

	// Swagger documentation
	if cfg.Environment != "production" {
		api.GET("/swagger/*any", ginSwagger.WrapHandler(files.Handler))
	}

	// File routes
	files := api.Group("/files")
	{
		files.POST("/upload", fileHandler.Upload)
		files.GET("/:fileId", fileHandler.GetFile)
		files.GET("/:fileId/content", fileHandler.GetFileContent)
		files.GET("/:fileId/thumbnail", fileHandler.GetThumbnail)
	}
	api.POST("/files/check", fileHandler.CheckFile)
	api.GET("/files/banned", fileHandler.GetBannedHashes)
	api.GET("/files/stats", fileHandler.GetFileStats)
	api.POST("/files/purge", fileHandler.PurgeFiles)

	return router
}
