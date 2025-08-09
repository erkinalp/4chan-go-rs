package api

import (
	"github.com/4chan/v2/backend_go/config"
	"github.com/4chan/v2/backend_go/internal/api/handlers"
	"github.com/4chan/v2/backend_go/internal/api/middleware"
	"github.com/4chan/v2/backend_go/internal/database"
	"github.com/4chan/v2/backend_go/internal/repository"
	"github.com/4chan/v2/backend_go/internal/services"
	"github.com/4chan/v2/backend_go/internal/storage"
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
