use actix_web::{HttpResponse, ResponseError};
use derive_more::Display;
use serde_json::json;
use std::error::Error as StdError;

#[derive(Debug, Display)]
pub enum AppError {
    #[display("Bad Request: {_0}")]
    BadRequest(String),

    #[display("Unauthorized: {_0}")]
    Unauthorized(String),

    #[display("Forbidden: {_0}")]
    Forbidden(String),

    #[display("Not Found: {_0}")]
    NotFound(String),

    #[display("Conflict: {_0}")]
    Conflict(String),

    #[display("Too Many Requests: {_0}")]
    TooManyRequests(String),

    #[display("Internal Server Error: {_0}")]
    InternalServerError(String),
}

impl ResponseError for AppError {
    // Without this override, status_code() falls back to
    // INTERNAL_SERVER_ERROR for every variant even though
    // error_response() builds the right status.
    fn status_code(&self) -> actix_web::http::StatusCode {
        match self {
            AppError::BadRequest(_) => actix_web::http::StatusCode::BAD_REQUEST,
            AppError::Unauthorized(_) => actix_web::http::StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => actix_web::http::StatusCode::FORBIDDEN,
            AppError::NotFound(_) => actix_web::http::StatusCode::NOT_FOUND,
            AppError::Conflict(_) => actix_web::http::StatusCode::CONFLICT,
            AppError::TooManyRequests(_) => {
                actix_web::http::StatusCode::TOO_MANY_REQUESTS
            }
            AppError::InternalServerError(_) => {
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }

    fn error_response(&self) -> HttpResponse {
        match self {
            AppError::BadRequest(message) => HttpResponse::BadRequest().json(json!({
                "statusCode": 400,
                "message": "Bad Request",
                "error": message
            })),
            AppError::Unauthorized(message) => HttpResponse::Unauthorized().json(json!({
                "statusCode": 401,
                "message": "Unauthorized",
                "error": message
            })),
            AppError::Forbidden(message) => HttpResponse::Forbidden().json(json!({
                "statusCode": 403,
                "message": "Forbidden",
                "error": message
            })),
            AppError::NotFound(message) => HttpResponse::NotFound().json(json!({
                "statusCode": 404,
                "message": "Not Found",
                "error": message
            })),
            AppError::Conflict(message) => HttpResponse::Conflict().json(json!({
                "statusCode": 409,
                "message": "Conflict",
                "error": message
            })),
            AppError::TooManyRequests(message) => HttpResponse::TooManyRequests().json(json!({
                "statusCode": 429,
                "message": "Too Many Requests",
                "error": message
            })),
            AppError::InternalServerError(message) => {
                HttpResponse::InternalServerError().json(json!({
                    "statusCode": 500,
                    "message": "Internal Server Error",
                    "error": message
                }))
            }
        }
    }
}

impl StdError for AppError {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::body::to_bytes;
    use actix_web::http::StatusCode;

    #[test]
    fn test_status_codes() {
        let cases: Vec<(AppError, StatusCode)> = vec![
            (AppError::BadRequest("x".into()), StatusCode::BAD_REQUEST),
            (AppError::Unauthorized("x".into()), StatusCode::UNAUTHORIZED),
            (AppError::Forbidden("x".into()), StatusCode::FORBIDDEN),
            (AppError::NotFound("x".into()), StatusCode::NOT_FOUND),
            (AppError::Conflict("x".into()), StatusCode::CONFLICT),
            (
                AppError::TooManyRequests("x".into()),
                StatusCode::TOO_MANY_REQUESTS,
            ),
            (
                AppError::InternalServerError("x".into()),
                StatusCode::INTERNAL_SERVER_ERROR,
            ),
        ];
        for (err, want) in cases {
            assert_eq!(err.status_code(), want, "{}", err);
            assert_eq!(err.error_response().status(), want, "{}", err);
        }
    }

    #[test]
    fn test_display_includes_message() {
        let err = AppError::NotFound("file 123".to_string());
        assert_eq!(format!("{}", err), "Not Found: file 123");
        assert!(err.source().is_none());
    }

    #[actix_rt::test]
    async fn test_error_response_json_body() {
        let err = AppError::Forbidden("nope".to_string());
        let resp = err.error_response();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        let bytes = to_bytes(resp.into_body()).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["statusCode"], 403);
        assert_eq!(body["message"], "Forbidden");
        assert_eq!(body["error"], "nope");
    }
}
