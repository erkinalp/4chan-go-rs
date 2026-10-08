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
