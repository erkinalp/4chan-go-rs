# File Service

File management service implemented in Go, specialized in secure validation, transformation, and efficient storage of files.

## Features

- Comprehensive file validation to detect malicious content
- Image transformation and optimization (resizing, compression)
- Thumbnail and preview generation
- Efficient storage in S3/MinIO 
- Integration with the media-processor service for advanced analysis
- High performance and low latency

## Project Structure

```
file-service/
├── config/
│   └── config.go        # Service configuration
├── internal/
│   ├── api/             # HTTP API
│   │   ├── handlers/    # Request handlers
│   │   ├── models/      # Data models for the API
│   │   └── router.go    # Route definitions
│   ├── database/        # Database connections
│   │   ├── postgres.go  # PostgreSQL client
│   │   └── redis.go     # Redis client
│   ├── models/          # Domain models
│   ├── storage/         # File storage
│   │   └── minio.go     # S3/MinIO client
│   └── utils/           # Utilities
├── main.go              # Entry point
└── go.mod               # Dependencies
```

## Technologies

- Go 1.20+
- PostgreSQL (file metadata)
- Redis (cache)
- S3/MinIO (file storage)
- Fiber (web framework)
- GORM (ORM)

## Development

```bash
# Environment setup
cp .env.example .env

# Start service in development mode
go run main.go

# Run tests
go test ./...

# Build for production
go build -o file-service
```

## API

The service exposes a REST API with the following main endpoints:

- `POST /files` - Upload a new file
- `GET /files/:id` - Get a file by ID
- `GET /files/:id/thumbnail` - Get thumbnail of a file
- `DELETE /files/:id` - Delete a file

## Service Integration

- Communicates with `media-processor` for advanced content analysis
- Exposes metrics for monitoring in Prometheus
- Uses distributed tracing with OpenTelemetry
