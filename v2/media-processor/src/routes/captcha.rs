use actix_web::{web, HttpResponse, Scope};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/captcha")
            .route("", web::get().to(get_captcha))
            .route("/verify", web::post().to(verify_captcha))
    );
}

async fn get_captcha() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn verify_captcha() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}
