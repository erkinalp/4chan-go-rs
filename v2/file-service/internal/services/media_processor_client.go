package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

type MediaProcessorClient struct {
	baseURL    string
	httpClient *http.Client
}

type ThumbnailRequest struct {
	FileID   string `json:"file_id"`
	Size     string `json:"size"`
	MimeType string `json:"mime_type"`
}

type ThumbnailResponse struct {
	Success       bool   `json:"success"`
	ThumbnailURL  string `json:"thumbnail_url"`
	ThumbnailPath string `json:"thumbnail_path"`
	Width         int    `json:"width"`
	Height        int    `json:"height"`
	Error         string `json:"error,omitempty"`
}

type AllThumbnailsResponse struct {
	Success bool              `json:"success"`
	Small   *ThumbnailInfo    `json:"small"`
	Medium  *ThumbnailInfo    `json:"medium"`
	Large   *ThumbnailInfo    `json:"large"`
	Error   string            `json:"error,omitempty"`
}

type ThumbnailInfo struct {
	URL    string `json:"url"`
	Path   string `json:"path"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

var (
	thumbnailRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "media_processor_thumbnail_request_duration_seconds",
			Help:    "Duration of thumbnail generation requests to media-processor",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"size", "status"},
	)
	thumbnailRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "media_processor_thumbnail_requests_total",
			Help: "Total number of thumbnail generation requests",
		},
		[]string{"size", "status"},
	)
)

func init() {
	prometheus.MustRegister(thumbnailRequestDuration)
	prometheus.MustRegister(thumbnailRequestsTotal)
}

func NewMediaProcessorClient(baseURL string) *MediaProcessorClient {
	return &MediaProcessorClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (c *MediaProcessorClient) GenerateThumbnail(ctx context.Context, fileData []byte, fileName, mimeType, size string) (*ThumbnailResponse, error) {
	start := time.Now()
	status := "success"
	defer func() {
		thumbnailRequestDuration.WithLabelValues(size, status).Observe(time.Since(start).Seconds())
		thumbnailRequestsTotal.WithLabelValues(size, status).Inc()
	}()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(part, bytes.NewReader(fileData)); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to copy file data: %w", err)
	}

	if err := writer.WriteField("mime_type", mimeType); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to write mime_type field: %w", err)
	}

	if err := writer.WriteField("size", size); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to write size field: %w", err)
	}

	if err := writer.Close(); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/thumbnails/generate", body)
	if err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		status = "error"
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("media-processor returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var thumbnailResp ThumbnailResponse
	if err := json.NewDecoder(resp.Body).Decode(&thumbnailResp); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if !thumbnailResp.Success {
		status = "error"
		return nil, fmt.Errorf("thumbnail generation failed: %s", thumbnailResp.Error)
	}

	return &thumbnailResp, nil
}

func (c *MediaProcessorClient) GenerateAllThumbnails(ctx context.Context, fileData []byte, fileName, mimeType string) (*AllThumbnailsResponse, error) {
	start := time.Now()
	status := "success"
	defer func() {
		thumbnailRequestDuration.WithLabelValues("all", status).Observe(time.Since(start).Seconds())
		thumbnailRequestsTotal.WithLabelValues("all", status).Inc()
	}()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err := io.Copy(part, bytes.NewReader(fileData)); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to copy file data: %w", err)
	}

	if err := writer.WriteField("mime_type", mimeType); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to write mime_type field: %w", err)
	}

	if err := writer.Close(); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/thumbnails/generate-all", body)
	if err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		status = "error"
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("media-processor returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var allThumbsResp AllThumbnailsResponse
	if err := json.NewDecoder(resp.Body).Decode(&allThumbsResp); err != nil {
		status = "error"
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if !allThumbsResp.Success {
		status = "error"
		return nil, fmt.Errorf("thumbnail generation failed: %s", allThumbsResp.Error)
	}

	return &allThumbsResp, nil
}

func (c *MediaProcessorClient) IsImageSupported(mimeType string) bool {
	supportedTypes := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"image/webp": true,
		"image/bmp":  true,
		"image/tiff": true,
	}
	return supportedTypes[mimeType]
}

func (c *MediaProcessorClient) IsVideoSupported(mimeType string) bool {
	supportedTypes := map[string]bool{
		"video/mp4":  true,
		"video/webm": true,
	}
	return supportedTypes[mimeType]
}
