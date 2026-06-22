use actix_web::{web, HttpResponse};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/posts")
            .route("", web::get().to(get_posts))
            .route("/{post_id}", web::get().to(get_post))
            .route("", web::post().to(create_post))
            .route("/{post_id}", web::put().to(update_post))
            .route("/{post_id}", web::delete().to(delete_post))
            .route("/{post_id}/report", web::post().to(report_post)),
    );
}

async fn get_posts() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn get_post() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn create_post() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn update_post() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn delete_post() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn report_post() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}
