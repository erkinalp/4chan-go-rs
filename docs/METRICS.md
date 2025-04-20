# Metrics Implementation

This document describes the metrics implementation in the 4chan-go-rs project.

## Overview

Both the Go and Rust microservices expose metrics endpoints that can be scraped by Prometheus. The metrics follow the RED (Rate, Errors, Duration) methodology for monitoring service health.

## Rust Implementation (media-processor)

The Rust implementation uses the `actix-web-prom` library (version 0.9.0) to expose metrics. This is a wrapper around the `prometheus` crate that provides integration with Actix Web.

### Key Components

- **PrometheusMetricsBuilder**: Used to create and configure the metrics middleware
- **Metrics Endpoint**: Exposed at `/metrics` by default
- **Collected Metrics**:
  - HTTP request count
  - HTTP request duration
  - HTTP request errors
  - System metrics (CPU, memory, etc.)

### Usage

The metrics middleware is added to the Actix Web application in `main.rs`:

```rust
use actix_web_prom::PrometheusMetricsBuilder;
use prometheus::Registry;

// Create a registry and metrics builder
let registry = Registry::new();
let prometheus = PrometheusMetricsBuilder::new("api")
    .endpoint("/metrics")
    .registry(registry)
    .build()
    .unwrap();

// Add the prometheus middleware to the app
App::new()
    .wrap(prometheus.clone())
    // ... other middleware and routes
```

## Go Implementation (file-service)

The Go implementation uses the `github.com/prometheus/client_golang` library to expose metrics.

### Key Components

- **PrometheusMiddleware**: Custom middleware that collects HTTP metrics
- **Metrics Endpoint**: Exposed at `/metrics`
- **Collected Metrics**:
  - HTTP request count by method, endpoint, and status
  - HTTP request duration by method and endpoint

### Usage

The metrics middleware is added to the Gin router in `router.go`:

```go
// Add the prometheus middleware to the router
router.Use(middleware.PrometheusMiddleware())

// Expose the metrics endpoint
router.GET("/metrics", middleware.Metrics())
```

## Monitoring Setup

The metrics exposed by both services can be scraped by Prometheus and visualized in Grafana. The Prometheus configuration is defined in the `infrastructure/prometheus` directory.

## Best Practices

1. **Consistent Naming**: Use consistent metric names across all services
2. **Appropriate Labels**: Add labels that provide useful context without causing cardinality explosion
3. **Documentation**: Document all custom metrics
4. **Alerting**: Set up alerts for critical metrics
5. **Dashboard**: Create Grafana dashboards for visualizing metrics
