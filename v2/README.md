# Modernization Project v2

This directory contains the modernized version of the application, implementing a modern architecture based on microservices and micro-frontends.

## Project Structure

- **api-core** - Central API core implemented with TypeScript/NestJS
  - API Gateway and service orchestration
  - Authentication and authorization management
  - Implementation of core business logic

- **file-service** - File management service implemented in Go
  - Secure file validation
  - Image transformation and optimization
  - Efficient storage in S3/MinIO

- **media-processor** - Advanced media processor implemented in Rust
  - Forensic image analysis
  - High-performance processing
  - Prohibited content detection

- **frontend-legacy** - Traditional React implementation of the frontend
  - Support for classic themes
  - Responsive interface
  - Reusable React components

- **frontend-modern** - Advanced implementation with modern architecture
  - State management with Redux Toolkit
  - Integration with Web Components
  - Advanced performance optimization

- **microfrontends** - Complete implementation of micro-frontends
  - shell - Main application that orchestrates the micro-frontends
  - board-viewer - Board and thread visualization
  - catalog-viewer - Catalog view
  - post-creator - Post creation
  - auth - Authentication management
  - media-viewer - Media visualization
  - moderation - Moderation tools

- **api-specs** - API definitions in OpenAPI/Swagger format
  - Complete endpoint documentation
  - Specifications for client generation

- **docs** - Technical documentation
  - Architecture and design
  - Security models

- **infrastructure** - Infrastructure configuration
  - Docker and Kubernetes
  - CI/CD
  - Automation scripts

## Main Technologies

- Backend: TypeScript (NestJS), Go, Rust
- Frontend: React, TypeScript, Web Components
- Storage: PostgreSQL, Redis, S3/MinIO
- Infrastructure: Docker, Kubernetes

## Development

Each component has its own README with specific instructions for development, testing, and deployment.

```bash
# To run the complete stack in development
cd infrastructure
docker compose up -d
```
