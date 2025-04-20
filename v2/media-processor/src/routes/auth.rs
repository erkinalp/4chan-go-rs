use actix_web::{web, HttpResponse, Scope};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/login", web::post().to(login))
            .route("/register", web::post().to(register))
            .route("/refresh", web::post().to(refresh_token))
            .route("/logout", web::post().to(logout))
    );
}

async fn login() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn register() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn refresh_token() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn logout() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}
