use actix_web::{web, HttpResponse};

use crate::repositories::postgres_repository::PostgresRepository;
use crate::repositories::redis_repository::RedisRepository;

/// Versioned health endpoints, mounted under `/{api_prefix}/{api_version}`.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/health")
            .route("", web::get().to(health_check))
            .route("/ready", web::get().to(readiness_check)),
    );
}

/// Root-level probe endpoints. Kubernetes liveness/readiness probes and the
/// docker-compose healthchecks hit these paths directly, without the API
/// prefix.
pub fn configure_probes(cfg: &mut web::ServiceConfig) {
    cfg.route("/health", web::get().to(health_check))
        .route("/live", web::get().to(health_check))
        .route("/ready", web::get().to(readiness_check));
}

/// Liveness: the process is up and serving requests.
async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "ok" }))
}

/// Readiness: dependencies (Postgres, Redis) are reachable.
async fn readiness_check(
    postgres: web::Data<PostgresRepository>,
    redis: web::Data<RedisRepository>,
) -> HttpResponse {
    let database = match sqlx::query("SELECT 1").execute(&postgres.pool).await {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };
    let redis_status = match redis.ping().await {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };

    if database == "connected" && redis_status == "connected" {
        HttpResponse::Ok().json(serde_json::json!({
            "status": "ok",
            "database": database,
            "redis": redis_status,
        }))
    } else {
        HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "status": "unavailable",
            "database": database,
            "redis": redis_status,
        }))
    }
}
