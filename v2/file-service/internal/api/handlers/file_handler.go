package handlers

import (
	"bytes"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/api/models"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/repository"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/services"
	"github.com/erkinalp/4chan-go-rs/v2/file-service/internal/storage"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/h2non/filetype"
	"github.com/rs/zerolog"
	"github.com/h2non/filetype/matchers"
	"github.com/h2non/filetype/types"
	"golang.org/x/image/webp"
)

type FileHandler struct {
	storage   *storage.MinioClient
	fileRepo  *repository.FileRepository
	queueRepo *repository.QueueRepository
	scanner   services.MalwareScanner
	logger    zerolog.Logger
}

func NewFileHandler(storage *storage.MinioClient, fileRepo *repository.FileRepository, queueRepo *repository.QueueRepository, scanner services.MalwareScanner, logger zerolog.Logger) *FileHandler {
	return &FileHandler{
		storage:   storage,
		fileRepo:  fileRepo,
		queueRepo: queueRepo,
		scanner:   scanner,
		logger:    logger,
	}
}

func (h *FileHandler) Upload(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(16 << 20); err != nil {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "Invalid multipart form",
			Error:      err.Error(),
		})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "File is required",
			Error:      "No file was provided",
		})
		return
	}
	defer file.Close()

	maxSize := int64(10 << 20) // 10MB
	if header.Size > maxSize {
		c.JSON(http.StatusRequestEntityTooLarge, models.Error{
			StatusCode: http.StatusRequestEntityTooLarge,
			Message:    "File too large",
			Error:      fmt.Sprintf("Maximum file size is %d bytes", maxSize),
		})
		return
	}

	fileData, err := readFile(file, header.Size)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to read file",
			Error:      err.Error(),
		})
		return
	}

	kind, err := filetype.Match(fileData)
	if err != nil || kind == filetype.Unknown {
		c.JSON(http.StatusUnsupportedMediaType, models.Error{
			StatusCode: http.StatusUnsupportedMediaType,
			Message:    "Unsupported file type",
			Error:      "File type could not be determined or is not supported",
		})
		return
	}

	if kind.MIME.Type == "application" && (kind == matchers.TypeExe || kind == matchers.TypeElf) {
		c.JSON(http.StatusUnsupportedMediaType, models.Error{
			StatusCode: http.StatusUnsupportedMediaType,
			Message:    "Executable files are not allowed",
			Error:      "Detected executable/binary format",
		})
		return
	}

	if !isAllowedFileType(kind) {
		c.JSON(http.StatusUnsupportedMediaType, models.Error{
			StatusCode: http.StatusUnsupportedMediaType,
			Message:    "Unsupported file type",
			Error:      fmt.Sprintf("File type %s is not allowed", kind.MIME.Value),
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !extMatchesMime(ext, kind.MIME.Value) {
		c.JSON(http.StatusUnsupportedMediaType, models.Error{
			StatusCode: http.StatusUnsupportedMediaType,
			Message:    "File extension does not match content type",
			Error:      fmt.Sprintf("Extension %s does not match MIME %s", ext, kind.MIME.Value),
		})
		return
	}

	if h.scanner != nil {
		clean, reason, scanErr := h.scanner.Scan(c.Request.Context(), fileData)
		if scanErr != nil {
			c.JSON(http.StatusServiceUnavailable, models.Error{
				StatusCode: http.StatusServiceUnavailable,
				Message:    "Malware scanner unavailable",
				Error:      scanErr.Error(),
			})
			return
		}
		if !clean {
			c.JSON(http.StatusUnprocessableEntity, models.Error{
				StatusCode: http.StatusUnprocessableEntity,
				Message:    "Malicious content detected",
				Error:      reason,
			})
			return
		}
	}

	hash := md5.Sum(fileData)
	md5Hash := hex.EncodeToString(hash[:])
	sha := sha256.Sum256(fileData)
	sha256Hash := hex.EncodeToString(sha[:])

	existingFile, err := h.fileRepo.GetFileByMD5Hash(c.Request.Context(), md5Hash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to check for duplicate file",
			Error:      err.Error(),
		})
		return
	}

	if existingFile != nil {
		c.JSON(http.StatusOK, models.FileUploadResponse{
			ID:             existingFile.ID,
			FileURL:        fmt.Sprintf("/files/%s/content", existingFile.ID),
			ThumbnailURL:   fmt.Sprintf("/files/%s/thumbnail", existingFile.ID),
			Filename:       existingFile.Filename,
			Filesize:       existingFile.Filesize,
			Width:          existingFile.Width,
			Height:         existingFile.Height,
			MimeType:       existingFile.MimeType,
			MD5Hash:        existingFile.MD5Hash,
			IsSpoilered:    existingFile.IsSpoilered,
			UploadDuration: 0,
		})
		return
	}

	spoiler := false
	spoilerStr := c.Request.FormValue("spoiler")
	if spoilerStr != "" {
		spoiler, _ = strconv.ParseBool(spoilerStr)
	}

	var width, height int
	if isImage(kind) {
		width, height, err = getImageDimensions(fileData)
		if err != nil {
			fmt.Printf("Failed to get image dimensions: %v\n", err)
		}
	}

	fileID := uuid.New().String()

	timestamp := time.Now().Unix()
	uniqueFileName := fmt.Sprintf("%d_%s%s", timestamp, fileID, ext)

	uploadInfo, err := h.storage.UploadFile(c.Request.Context(), fileData, uniqueFileName, kind.MIME.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to upload file",
			Error:      err.Error(),
		})
		return
	}

	thumbnailURL := uploadInfo.ThumbnailURL

	dbFile := &models.File{
		ID:                fileID,
		Filename:          header.Filename,
		StoredFilename:    uniqueFileName,
		Filesize:          header.Size,
		Width:             width,
		Height:            height,
		ThumbnailFilename: filepath.Base(thumbnailURL),
		MimeType:          kind.MIME.Value,
		MD5Hash:           md5Hash,
		SHA256Hash:        sha256Hash,
		IsSpoilered:       spoiler,
		CreatedAt:         time.Now(),
	}

	if err := h.fileRepo.CreateFile(c.Request.Context(), dbFile); err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to save file metadata",
			Error:      err.Error(),
		})
		return
	}

	// Enqueue file for background processing (e.g. advanced thumbnail generation, analysis)
	// We use a high priority for new uploads
	if err := h.queueRepo.Enqueue(c.Request.Context(), fileID, models.QueueTaskTypeProcessFile, 10); err != nil {
		// Log error but don't fail the request as the file is already uploaded
		h.logger.Error().Err(err).Msg("Failed to enqueue file for processing")
	}

	response := models.FileUploadResponse{
		ID:             fileID,
		FileURL:        uploadInfo.URL,
		ThumbnailURL:   thumbnailURL,
		Filename:       header.Filename,
		Filesize:       header.Size,
		Width:          width,
		Height:         height,
		MimeType:       kind.MIME.Value,
		MD5Hash:        md5Hash,
		IsSpoilered:    spoiler,
		UploadDuration: 0, // In a real app, you would measure this
	}

	c.JSON(http.StatusCreated, response)
}

func (h *FileHandler) GetFile(c *gin.Context) {
	fileID := c.Param("fileId")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "File ID is required",
			Error:      "No file ID provided",
		})
		return
	}

	file, err := h.fileRepo.GetFileByID(c.Request.Context(), fileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to retrieve file",
			Error:      err.Error(),
		})
		return
	}

	if file == nil {
		c.JSON(http.StatusNotFound, models.Error{
			StatusCode: http.StatusNotFound,
			Message:    "File not found",
			Error:      fmt.Sprintf("No file found with ID: %s", fileID),
		})
		return
	}

	c.JSON(http.StatusOK, file)
}

func (h *FileHandler) DeleteFile(c *gin.Context) {
	fileID := c.Param("fileId")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "File ID is required",
			Error:      "No file ID provided",
		})
		return
	}

	file, err := h.fileRepo.GetFileByID(c.Request.Context(), fileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to retrieve file",
			Error:      err.Error(),
		})
		return
	}

	if file == nil {
		c.JSON(http.StatusNotFound, models.Error{
			StatusCode: http.StatusNotFound,
			Message:    "File not found",
			Error:      fmt.Sprintf("No file found with ID: %s", fileID),
		})
		return
	}

	if err := h.storage.DeleteFile(c.Request.Context(), file.StoredFilename); err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to delete file from storage",
			Error:      err.Error(),
		})
		return
	}

	if err := h.fileRepo.DeleteFile(c.Request.Context(), fileID); err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to delete file from database",
			Error:      err.Error(),
		})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *FileHandler) GetFileContent(c *gin.Context) {
	fileID := c.Param("fileId")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "File ID is required",
			Error:      "No file ID provided",
		})
		return
	}

	download := false
	downloadStr := c.Query("download")
	if downloadStr != "" {
		download, _ = strconv.ParseBool(downloadStr)
	}

	file, err := h.fileRepo.GetFileByID(c.Request.Context(), fileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to retrieve file",
			Error:      err.Error(),
		})
		return
	}

	if file == nil {
		c.JSON(http.StatusNotFound, models.Error{
			StatusCode: http.StatusNotFound,
			Message:    "File not found",
			Error:      fmt.Sprintf("No file found with ID: %s", fileID),
		})
		return
	}

	fileContent, err := h.storage.GetFile(c.Request.Context(), file.StoredFilename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to retrieve file content",
			Error:      err.Error(),
		})
		return
	}

	contentDisposition := "inline"
	if download {
		contentDisposition = "attachment"
	}
	c.Header("Content-Disposition", fmt.Sprintf("%s; filename=%s", contentDisposition, file.Filename))
	c.Header("Content-Type", file.MimeType)
	c.Header("Content-Length", fmt.Sprintf("%d", file.Filesize))

	c.Data(http.StatusOK, file.MimeType, fileContent)
}

func (h *FileHandler) GetThumbnail(c *gin.Context) {
	fileID := c.Param("fileId")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "File ID is required",
			Error:      "No file ID provided",
		})
		return
	}

	size := c.DefaultQuery("size", "medium")
	if size != "small" && size != "medium" && size != "large" {
		size = "medium"
	}

	file, err := h.fileRepo.GetFileByID(c.Request.Context(), fileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to retrieve file",
			Error:      err.Error(),
		})
		return
	}

	if file == nil {
		c.JSON(http.StatusNotFound, models.Error{
			StatusCode: http.StatusNotFound,
			Message:    "File not found",
			Error:      fmt.Sprintf("No file found with ID: %s", fileID),
		})
		return
	}

	thumbnailContent, err := h.storage.GetFile(c.Request.Context(), file.ThumbnailFilename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to retrieve thumbnail",
			Error:      err.Error(),
		})
		return
	}

	contentType := "image/jpeg" // Default
	if strings.HasSuffix(file.ThumbnailFilename, ".png") {
		contentType = "image/png"
	} else if strings.HasSuffix(file.ThumbnailFilename, ".gif") {
		contentType = "image/gif"
	} else if strings.HasSuffix(file.ThumbnailFilename, ".webp") {
		contentType = "image/webp"
	}

	c.Header("Content-Type", contentType)
	c.Data(http.StatusOK, contentType, thumbnailContent)
}

func (h *FileHandler) CheckFile(c *gin.Context) {
	var request models.FileCheckRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "Invalid request",
			Error:      err.Error(),
		})
		return
	}

	if request.MD5Hash == "" {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "MD5 hash is required",
			Error:      "No MD5 hash provided",
		})
		return
	}

	file, err := h.fileRepo.GetFileByMD5Hash(c.Request.Context(), request.MD5Hash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to check file existence",
			Error:      err.Error(),
		})
		return
	}

	response := models.FileCheckResponse{
		Exists: file != nil,
		File:   file,
	}

	c.JSON(http.StatusOK, response)
}

func (h *FileHandler) GetBannedHashes(c *gin.Context) {
	bannedHashes, err := h.fileRepo.GetBannedHashes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to retrieve banned hashes",
			Error:      err.Error(),
		})
		return
	}

	response := models.BannedHashesResponse{
		Data:      bannedHashes,
		UpdatedAt: time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

func (h *FileHandler) GetFileStats(c *gin.Context) {
	stats, err := h.fileRepo.GetFileStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Error{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to retrieve file statistics",
			Error:      err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *FileHandler) PurgeFiles(c *gin.Context) {
	var request models.FilePurgeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "Invalid request",
			Error:      err.Error(),
		})
		return
	}

	if request.OlderThanDays < 30 {
		c.JSON(http.StatusBadRequest, models.Error{
			StatusCode: http.StatusBadRequest,
			Message:    "Invalid olderThanDays value",
			Error:      "olderThanDays must be at least 30",
		})
		return
	}

	response := models.FilePurgeResponse{
		TaskID:              uuid.New().String(),
		EstimatedFilesToPurge: 50000,
		EstimatedSpaceToFree:  268435456, // 256MB
	}

	c.JSON(http.StatusAccepted, response)
}

func readFile(file multipart.File, size int64) ([]byte, error) {
	buffer := make([]byte, size)
	_, err := io.ReadFull(file, buffer)
	if err != nil {
		return nil, err
	}
	return buffer, nil
}

func isAllowedFileType(kind types.Type) bool {
	allowedTypes := map[string]bool{
		"image/jpeg":             true,
		"image/png":              true,
		"image/gif":              true,
		"image/webp":             true,
		"video/mp4":              true,
		"video/webm":             true,
		"application/pdf":        true,
		"application/zip":        true,
		"application/x-7z-compressed": true,
	}

	return allowedTypes[kind.MIME.Value]
}

func isImage(kind types.Type) bool {
	return kind.MIME.Type == "image"
}

func getImageDimensions(fileData []byte) (width, height int, err error) {
	reader := bytes.NewReader(fileData)
	
	config, _, err := image.DecodeConfig(reader)
	if err == nil {
		return config.Width, config.Height, nil
	}
	
	reader.Seek(0, 0)
	config, err = webp.DecodeConfig(reader)
	if err == nil {
		return config.Width, config.Height, nil
	}
	
	return 0, 0, fmt.Errorf("failed to decode image dimensions: %w", err)
}
func extMatchesMime(ext string, mime string) bool {
	if ext == "" {
		return false
	}
	switch mime {
	case "image/jpeg":
		return ext == ".jpg" || ext == ".jpeg"
	case "image/png":
		return ext == ".png"
	case "image/gif":
		return ext == ".gif"
	case "image/webp":
		return ext == ".webp"
	case "video/mp4":
		return ext == ".mp4"
	case "video/webm":
		return ext == ".webm"
	case "application/pdf":
		return ext == ".pdf"
	case "application/zip":
		return ext == ".zip"
	case "application/x-7z-compressed":
		return ext == ".7z"
	default:
		return false
	}
}
