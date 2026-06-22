package middleware

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latencies in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint"},
	)

	// File upload metrics
	fileUploadsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "file_uploads_total",
			Help: "Total number of file upload attempts",
		},
		[]string{"status", "mime_type"},
	)

	fileUploadDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "file_upload_duration_seconds",
			Help:    "File upload processing time in seconds",
			Buckets: []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"status"},
	)

	fileUploadSize = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "file_upload_size_bytes",
			Help:    "Size of uploaded files in bytes",
			Buckets: []float64{1024, 10240, 102400, 1048576, 5242880, 10485760}, // 1KB, 10KB, 100KB, 1MB, 5MB, 10MB
		},
		[]string{"mime_type"},
	)

	// Storage operation metrics
	storageOperationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "storage_operations_total",
			Help: "Total number of storage operations",
		},
		[]string{"operation", "status"},
	)

	storageOperationDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "storage_operation_duration_seconds",
			Help:    "Storage operation duration in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5},
		},
		[]string{"operation"},
	)

	// Banned file check metrics
	bannedFileChecksTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "banned_file_checks_total",
			Help: "Total number of banned file hash checks",
		},
		[]string{"result"}, // "allowed", "banned", "error"
	)

	// Malware scan metrics
	malwareScansTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "malware_scans_total",
			Help: "Total number of malware scans performed",
		},
		[]string{"result"}, // "clean", "infected", "error"
	)

	// File deduplication metrics
	fileDeduplicationsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "file_deduplications_total",
			Help: "Total number of files deduplicated (already existed)",
		},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
	prometheus.MustRegister(fileUploadsTotal)
	prometheus.MustRegister(fileUploadDuration)
	prometheus.MustRegister(fileUploadSize)
	prometheus.MustRegister(storageOperationsTotal)
	prometheus.MustRegister(storageOperationDuration)
	prometheus.MustRegister(bannedFileChecksTotal)
	prometheus.MustRegister(malwareScansTotal)
	prometheus.MustRegister(fileDeduplicationsTotal)
}

func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := prometheus.NewTimer(httpRequestDuration.WithLabelValues(c.Request.Method, c.FullPath()))
		
		c.Next()
		
		start.ObserveDuration()
		
		status := c.Writer.Status()
		httpRequestsTotal.WithLabelValues(c.Request.Method, c.FullPath(), strconv.Itoa(status)).Inc()
	}
}

func Metrics() gin.HandlerFunc {
	return gin.WrapH(promhttp.Handler())
}

// RecordFileUpload records metrics for a file upload attempt
func RecordFileUpload(status, mimeType string, fileSize int64, durationSeconds float64) {
	fileUploadsTotal.WithLabelValues(status, mimeType).Inc()
	fileUploadDuration.WithLabelValues(status).Observe(durationSeconds)
	if fileSize > 0 {
		fileUploadSize.WithLabelValues(mimeType).Observe(float64(fileSize))
	}
}

// RecordStorageOperation records metrics for a storage operation
func RecordStorageOperation(operation, status string) {
	storageOperationsTotal.WithLabelValues(operation, status).Inc()
}

// RecordStorageOperationWithDuration records metrics for a storage operation with duration
func RecordStorageOperationWithDuration(operation string, durationSeconds float64) {
	storageOperationDuration.WithLabelValues(operation).Observe(durationSeconds)
}

// RecordBannedFileCheck records the result of a banned file hash check
func RecordBannedFileCheck(result string) {
	bannedFileChecksTotal.WithLabelValues(result).Inc()
}

// RecordMalwareScan records the result of a malware scan
func RecordMalwareScan(result string) {
	malwareScansTotal.WithLabelValues(result).Inc()
}

// RecordFileDeduplication records when a file was deduplicated
func RecordFileDeduplication() {
	fileDeduplicationsTotal.Inc()
}
