package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/auth"
	"github.com/erkinalp/4chan-go-rs/v2/api-core/services/go-service/internal/api/middleware"
)

func main() {
	r := gin.Default()

	gnapClient := auth.NewGNAPClient(
		getEnv("GNAP_SERVER_URL", "http://localhost:8080"),
		getEnv("GNAP_CLIENT_KEY", ""),
		getEnv("GNAP_CLIENT_SECRET", ""),
	)

	protected := r.Group("/api/v1")
	protected.Use(middleware.GNAPAuth(gnapClient))

	protected.GET("/boards", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "boards endpoint"})
	})

	protected.GET("/threads", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "threads endpoint"})
	})

	port := getEnv("PORT", "8080")
	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
