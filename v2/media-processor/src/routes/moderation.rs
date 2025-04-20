use actix_web::{web, HttpResponse, Scope};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/moderation")
            .route("/reports", web::get().to(get_reports))
            .route("/reports/{report_id}", web::get().to(get_report))
            .route("/reports/{report_id}/resolve", web::post().to(resolve_report))
            .route("/bans", web::get().to(get_bans))
            .route("/bans", web::post().to(create_ban))
            .route("/bans/{ban_id}", web::delete().to(remove_ban))
            .route("/wordfilters", web::get().to(get_wordfilters))
            .route("/wordfilters", web::post().to(create_wordfilter))
            .route("/wordfilters/{filter_id}", web::delete().to(remove_wordfilter))
    );
}

async fn get_reports() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn get_report() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn resolve_report() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn get_bans() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn create_ban() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn remove_ban() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn get_wordfilters() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn create_wordfilter() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}

async fn remove_wordfilter() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "not implemented" }))
}
