use prometheus::{HistogramOpts, HistogramVec, IntCounterVec, IntGauge, Opts, Registry};

/// Custom metrics for media processing operations.
///
/// These are registered on the same Prometheus registry used by the
/// `actix-web-prom` middleware, so they are exported alongside the HTTP
/// request metrics at the `/metrics` endpoint.
#[derive(Clone)]
pub struct MediaMetrics {
    /// Duration of individual processing operations in seconds.
    /// Labels: `operation` (e.g. "upload", "malware_scan", "thumbnail",
    /// "video_thumbnail").
    pub processing_duration: HistogramVec,
    /// Total media items that finished processing.
    /// Labels: `media_type` ("image" | "video" | "other"), `result`
    /// ("success" | "rejected" | "failed").
    pub processed_total: IntCounterVec,
    /// Media processing operations currently in flight (queue depth).
    pub in_flight_operations: IntGauge,
}

impl MediaMetrics {
    pub fn new(registry: &Registry) -> Self {
        let processing_duration = HistogramVec::new(
            HistogramOpts::new(
                "media_processor_processing_duration_seconds",
                "Duration of media processing operations in seconds",
            )
            .buckets(vec![
                0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
            ]),
            &["operation"],
        )
        .expect("failed to create media_processor_processing_duration_seconds");

        let processed_total = IntCounterVec::new(
            Opts::new(
                "media_processor_processed_total",
                "Total number of media items processed",
            ),
            &["media_type", "result"],
        )
        .expect("failed to create media_processor_processed_total");

        let in_flight_operations = IntGauge::new(
            "media_processor_in_flight_operations",
            "Number of media processing operations currently in flight",
        )
        .expect("failed to create media_processor_in_flight_operations");

        registry
            .register(Box::new(processing_duration.clone()))
            .expect("failed to register processing_duration");
        registry
            .register(Box::new(processed_total.clone()))
            .expect("failed to register processed_total");
        registry
            .register(Box::new(in_flight_operations.clone()))
            .expect("failed to register in_flight_operations");

        Self {
            processing_duration,
            processed_total,
            in_flight_operations,
        }
    }

    /// Increment the in-flight gauge; the returned guard decrements it when
    /// dropped, so early returns are handled automatically.
    pub fn track_operation(&self) -> InFlightGuard {
        self.in_flight_operations.inc();
        InFlightGuard {
            gauge: self.in_flight_operations.clone(),
        }
    }

    pub fn observe_operation(&self, operation: &str, elapsed: std::time::Duration) {
        self.processing_duration
            .with_label_values(&[operation])
            .observe(elapsed.as_secs_f64());
    }

    pub fn record_result(&self, media_type: &str, result: &str) {
        self.processed_total
            .with_label_values(&[media_type, result])
            .inc();
    }
}

/// RAII guard that decrements the in-flight operations gauge on drop.
pub struct InFlightGuard {
    gauge: IntGauge,
}

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        self.gauge.dec();
    }
}
