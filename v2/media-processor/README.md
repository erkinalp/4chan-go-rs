# Media Processor

Advanced service for multimedia file processing implemented in Rust, specialized in forensic image analysis, prohibited content detection, and high-performance processing.

## Features

- Forensic analysis of images and multimedia files
- Advanced detection of prohibited content using ML
- Metadata extraction and integrity verification
- High-performance concurrent processing
- gRPC interface for efficient communication between services
- REST endpoints for integration with other systems

## Project Structure

```
media-processor/
├── src/
│   ├── main.rs             # Entry point
│   ├── config.rs           # Service configuration
│   ├── error.rs            # Centralized error handling
│   ├── handlers/           # Request handlers
│   │   ├── mod.rs          # Handlers module
│   │   └── files.rs        # File handler
│   ├── middleware/         # Middleware
│   │   └── mod.rs          # Middleware module
│   ├── models/             # Data models
│   │   ├── mod.rs          # Models module
│   │   ├── file.rs         # File model
│   │   └── user.rs         # User model
│   ├── repositories/       # Data access
│   │   ├── mod.rs          # Repositories module
│   │   ├── postgres_repository.rs  # PostgreSQL repository
│   │   └── s3_repository.rs        # S3 repository
│   └── routes/             # Route definitions
│       ├── mod.rs          # Routes module
│       └── files.rs        # File routes
└── Cargo.toml              # Dependencies and configuration
```

## Technologies

- Rust 1.70+
- Actix Web (web framework)
- Tokio (asynchronous runtime)
- PostgreSQL (metadata)
- S3/MinIO (storage)
- Redis (cache)
- tonic (gRPC)
- Tensorflow/ONNX Runtime (ML models)

## Development

```bash
# Environment setup
cp .env.example .env

# Development
cargo run

# Tests
cargo test

# Optimized build
cargo build --release
```

## API

The service exposes two interfaces:

### REST API
- `POST /analyze` - Analyze a file
- `GET /results/:id` - Get analysis results
- `GET /health` - Service status

### gRPC
- `AnalyzeFile` - File analysis
- `GetAnalysisResult` - Get results
- `BatchAnalyze` - Batch analysis

## Security

- Robust input validation
- Comprehensive analysis against known exploits
- Process isolation for potentially malicious content analysis
- Resource limitation and timeouts
- Complete operation auditing
