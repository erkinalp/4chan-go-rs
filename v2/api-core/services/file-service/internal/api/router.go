package api

import (
	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/file-service/config"
	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/file-service/internal/api/handlers"
	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/file-service/internal/api/middleware"
	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/file-service/internal/database"
	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/file-service/internal/storage"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	ginSwagger "github.com/swaggo/gin-swagger"
	files "github.com/swaggo/files"
)

// NewRouter creates a new router with all endpoints
func NewRouter(
	cfg *config.Config,
	logger zerolog.Logger,
	db *database.PostgresDB,
	redis *database.RedisClient,
	fileStorage *storage.MinioClient,
) *gin.Engine {
	router := gin.New()

	// Middleware
	router.Use(middleware.RequestLogger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.CORS(cfg.CORS))
	router.Use(middleware.Security())

	// Rate limiter
	if cfg.RateLimit.Enabled {
		router.Use(middleware.RateLimiter(redis, cfg.RateLimit))
	}

	// Create handlers (limit to existing ones)
	fileHandler := handlers.NewFileHandler(fileStorage)

	// Metrics endpoint
	router.GET("/metrics", middleware.Metrics())


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
		files.POST("/upload", middleware.JWTAuth(cfg.JWT), fileHandler.Upload)
	}



	return router
}
