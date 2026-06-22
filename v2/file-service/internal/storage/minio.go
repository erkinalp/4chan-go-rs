package storage

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"path/filepath"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/config"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinioClient represents a MinIO (S3) client
type MinioClient struct {
	client     *minio.Client
	bucketName string
}

// FileInfo contains information about a stored file
type FileInfo struct {
	FileName     string
	ContentType  string
	Size         int64
	MD5Hash      string
	URL          string
	ThumbnailURL string
}

// ThumbnailInfo contains information about stored thumbnails
type ThumbnailInfo struct {
	SmallPath  string
	MediumPath string
	LargePath  string
	SmallURL   string
	MediumURL  string
	LargeURL   string
}

// NewMinioClient creates a new MinIO client
func NewMinioClient(cfg config.MinioConfig) (*MinioClient, error) {
	// Create MinIO client
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	// Check if bucket exists
	exists, err := client.BucketExists(context.Background(), cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check if bucket exists: %w", err)
	}

	// Create bucket if it doesn't exist
	if !exists {
		if err := client.MakeBucket(context.Background(), cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}

		// Set bucket policy to allow public read access
		policy := `{
			"Version": "2012-10-17",
			"Statement": [
				{
					"Effect": "Allow",
					"Principal": {"AWS": ["*"]},
					"Action": ["s3:GetObject"],
					"Resource": ["arn:aws:s3:::` + cfg.Bucket + `/*"]
				}
			]
		}`

		if err := client.SetBucketPolicy(context.Background(), cfg.Bucket, policy); err != nil {
			return nil, fmt.Errorf("failed to set bucket policy: %w", err)
		}
	}

	return &MinioClient{
		client:     client,
		bucketName: cfg.Bucket,
	}, nil
}

// UploadFile uploads a file to the storage
func (m *MinioClient) UploadFile(ctx context.Context, fileData []byte, fileName, contentType string) (*FileInfo, error) {
	// Generate unique file name
	timestamp := time.Now().Unix()
	uniqueFileName := fmt.Sprintf("%d_%s", timestamp, fileName)
	
	// Calculate MD5 hash
	hash := md5.Sum(fileData)
	md5Hash := hex.EncodeToString(hash[:])
	
	// Upload file
	_, err := m.client.PutObject(
		ctx,
		m.bucketName,
		uniqueFileName,
		bytes.NewReader(fileData),
		int64(len(fileData)),
		minio.PutObjectOptions{
			ContentType: contentType,
			UserMetadata: map[string]string{
				"md5sum": md5Hash,
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}
	
	// Generate URL
	presignedURL, err := m.client.PresignedGetObject(
		ctx,
		m.bucketName,
		uniqueFileName,
		time.Hour*24*7, // URL valid for 7 days
		url.Values{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate URL: %w", err)
	}
	
	// For this example, we'll assume thumbnails have the same URL
	// In a real application, you would generate a separate thumbnail
	
	return &FileInfo{
		FileName:     uniqueFileName,
		ContentType:  contentType,
		Size:         int64(len(fileData)),
		MD5Hash:      md5Hash,
		URL:          presignedURL.String(),
		ThumbnailURL: presignedURL.String(), // In reality, this would be different
	}, nil
}

// UploadThumbnail uploads a thumbnail to storage with proper naming convention
func (m *MinioClient) UploadThumbnail(ctx context.Context, thumbnailData []byte, originalFileName, size string) (string, string, error) {
	thumbnailFileName := fmt.Sprintf("thumb_%s_%s.jpg", size, originalFileName)
	
	_, err := m.client.PutObject(
		ctx,
		m.bucketName,
		thumbnailFileName,
		bytes.NewReader(thumbnailData),
		int64(len(thumbnailData)),
		minio.PutObjectOptions{
			ContentType: "image/jpeg",
			UserMetadata: map[string]string{
				"thumbnail_size": size,
				"original_file":  originalFileName,
			},
		},
	)
	if err != nil {
		return "", "", fmt.Errorf("failed to upload thumbnail: %w", err)
	}

	presignedURL, err := m.client.PresignedGetObject(
		ctx,
		m.bucketName,
		thumbnailFileName,
		time.Hour*24*7,
		url.Values{},
	)
	if err != nil {
		return thumbnailFileName, "", fmt.Errorf("failed to generate thumbnail URL: %w", err)
	}

	return thumbnailFileName, presignedURL.String(), nil
}

// UploadAllThumbnails uploads small, medium, and large thumbnails
func (m *MinioClient) UploadAllThumbnails(ctx context.Context, smallData, mediumData, largeData []byte, originalFileName string) (*ThumbnailInfo, error) {
	info := &ThumbnailInfo{}

	smallPath, smallURL, err := m.UploadThumbnail(ctx, smallData, originalFileName, "small")
	if err != nil {
		return nil, fmt.Errorf("failed to upload small thumbnail: %w", err)
	}
	info.SmallPath = smallPath
	info.SmallURL = smallURL

	mediumPath, mediumURL, err := m.UploadThumbnail(ctx, mediumData, originalFileName, "medium")
	if err != nil {
		return nil, fmt.Errorf("failed to upload medium thumbnail: %w", err)
	}
	info.MediumPath = mediumPath
	info.MediumURL = mediumURL

	largePath, largeURL, err := m.UploadThumbnail(ctx, largeData, originalFileName, "large")
	if err != nil {
		return nil, fmt.Errorf("failed to upload large thumbnail: %w", err)
	}
	info.LargePath = largePath
	info.LargeURL = largeURL

	return info, nil
}

// GetThumbnail retrieves a thumbnail from storage
func (m *MinioClient) GetThumbnail(ctx context.Context, originalFileName, size string) ([]byte, error) {
	thumbnailFileName := fmt.Sprintf("thumb_%s_%s.jpg", size, originalFileName)
	return m.GetFile(ctx, thumbnailFileName)
}

// DeleteThumbnails deletes all thumbnails for a file
func (m *MinioClient) DeleteThumbnails(ctx context.Context, originalFileName string) error {
	sizes := []string{"small", "medium", "large"}
	for _, size := range sizes {
		thumbnailFileName := fmt.Sprintf("thumb_%s_%s.jpg", size, originalFileName)
		_ = m.client.RemoveObject(ctx, m.bucketName, thumbnailFileName, minio.RemoveObjectOptions{})
	}
	return nil
}

// DeleteFile deletes a file from storage
func (m *MinioClient) DeleteFile(ctx context.Context, fileName string) error {
	err := m.client.RemoveObject(ctx, m.bucketName, fileName, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	
	// Also delete thumbnail if it exists
	thumbnailName := "thumb_" + fileName
	_ = m.client.RemoveObject(ctx, m.bucketName, thumbnailName, minio.RemoveObjectOptions{})
	
	return nil
}

// GetFile gets a file from storage
func (m *MinioClient) GetFile(ctx context.Context, fileName string) ([]byte, error) {
	object, err := m.client.GetObject(ctx, m.bucketName, fileName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get file: %w", err)
	}
	defer object.Close()
	
	return io.ReadAll(object)
}

// GetFileURL gets a presigned URL for a file
func (m *MinioClient) GetFileURL(ctx context.Context, fileName string, expiry time.Duration) (string, error) {
	presignedURL, err := m.client.PresignedGetObject(
		ctx,
		m.bucketName,
		fileName,
		expiry,
		url.Values{},
	)
	if err != nil {
		return "", fmt.Errorf("failed to generate URL: %w", err)
	}
	
	return presignedURL.String(), nil
}

// IsImage checks if the file is an image based on its extension
func IsImage(fileName string) bool {
	ext := filepath.Ext(fileName)
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp":
		return true
	default:
		return false
	}
}
