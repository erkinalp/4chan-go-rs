use crate::handlers::files::{
    check_file_exists, delete_file, get_banned_hashes, get_file_content, get_file_info,
    get_file_stats, get_thumbnail, purge_files, upload_file,
};
use crate::middleware::{jwt_auth, require_role};
use actix_web::{web, Scope};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/files")
            .route("/upload", web::post().to(upload_file))
            .route("/{file_id}", web::get().to(get_file_info))
            .route("/{file_id}/content", web::get().to(get_file_content))
            .route("/{file_id}/thumbnail", web::get().to(get_thumbnail))
            .route("/check", web::post().to(check_file_exists))
            .route("/banned", web::get().to(get_banned_hashes))
            .service(
                web::scope("")
                    .wrap(jwt_auth())
                    .route("/{file_id}", web::delete().to(delete_file))
                    .route("/stats", web::get().to(get_file_stats))
                    .service(
                        web::scope("/admin")
                            .wrap(require_role(vec!["ADMIN".to_string()]))
                            .route("/purge", web::post().to(purge_files)),
                    ),
            ),
    );
}
