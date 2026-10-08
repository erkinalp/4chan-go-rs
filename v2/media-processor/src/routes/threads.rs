use actix_web::{web, HttpResponse};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/threads")
            .route("", web::get().to(get_threads))
            .route("/{thread_id}", web::get().to(get_thread))
            .route("", web::post().to(create_thread))
            .route("/{thread_id}", web::put().to(update_thread))
            .route("/{thread_id}", web::delete().to(delete_thread)),
    );
}

async fn get_threads() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn get_thread() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn create_thread() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn update_thread() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn delete_thread() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}
