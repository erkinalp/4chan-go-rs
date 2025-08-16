use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error::ErrorUnauthorized,
    Error, HttpMessage, HttpResponse,
};
use futures::future::{ok, LocalBoxFuture, Ready};
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::task::{Context, Poll};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use redis::AsyncCommands;

// Define middleware for JWT authentication
pub fn jwt_auth() -> JwtAuth {
    JwtAuth::default()
}

// Define middleware for role-based authorization
pub fn require_role(roles: Vec<String>) -> RequireRole {
    RequireRole { roles }
}

#[derive(Default)]
pub struct JwtAuth;

impl<S, B> Transform<S, ServiceRequest> for JwtAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = JwtAuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(JwtAuthMiddleware {
            service: Rc::new(service),
        })
    }
}

pub struct JwtAuthMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for JwtAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = Rc::clone(&self.service);

        Box::pin(async move {
            // Extract JWT token from Authorization header
            let auth_header = req
                .headers()
                .get("Authorization")
                .map(|h| h.to_str().unwrap_or_default())
                .unwrap_or_default();

            // Verify token format
            if !auth_header.starts_with("Bearer ") {
                return Err(ErrorUnauthorized("No valid authorization token provided"));
            }

            // Extract the token part
            let token = &auth_header[7..];

            // In a real implementation, validate the token here
            // For this example, we'll just accept any non-empty token
            if token.is_empty() {
                return Err(ErrorUnauthorized("Invalid token"));
            }

            // Decode JWT and extract claims
            match decode_jwt_token(&token) {
                Ok(claims) => {
                    req.extensions_mut().insert(UserInfo {
                        user_id: claims.sub,
                        role: claims.role,
                        created_at: DateTime::from_timestamp(claims.created_at, 0).unwrap_or_else(Utc::now),
                    });
                }
                Err(_) => {
                    return Box::pin(async move {
                        Ok(req.into_response(
                            HttpResponse::Unauthorized()
                                .json(serde_json::json!({
                                    "error": "Unauthorized",
                                    "message": "Invalid JWT token"
                                }))
                                .into_body(),
                        ))
                    });
                }
            }

            // Call the next service
            service.call(req).await
        })
    }
}

// Role-based authorization middleware
pub struct RequireRole {
    roles: Vec<String>,
}

impl<S, B> Transform<S, ServiceRequest> for RequireRole
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RequireRoleMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(RequireRoleMiddleware {
            service: Rc::new(service),
            roles: self.roles.clone(),
        })
    }
}

pub struct RequireRoleMiddleware<S> {
    service: Rc<S>,
    roles: Vec<String>,
}

impl<S, B> Service<ServiceRequest> for RequireRoleMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = Rc::clone(&self.service);
        let roles = self.roles.clone();

        Box::pin(async move {
            // Get user info from extensions (added by JWT middleware)
            let user_info = req
                .extensions()
                .get::<UserInfo>()
                .cloned()
                .ok_or_else(|| ErrorUnauthorized("Authentication required"))?;

            // Check if user has the required role
            if !roles.contains(&user_info.role) {
                return Err(ErrorUnauthorized("Insufficient permissions"));
            }

            // Continue with the request
            service.call(req).await
        })
    }
}

fn decode_jwt_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default_secret".to_string());
    let key = DecodingKey::from_secret(secret.as_ref());
    let validation = Validation::new(Algorithm::HS256);
    
    let token_data = decode::<Claims>(token, &key, &validation)?;
    Ok(token_data.claims)
}

pub struct UserRateLimiter;

impl<S, B> Transform<S, ServiceRequest> for UserRateLimiter
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = UserRateLimiterMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(UserRateLimiterMiddleware {
            service: Rc::new(service),
        })
    }
}

pub struct UserRateLimiterMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for UserRateLimiterMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = std::pin::Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();

        Box::pin(async move {
            let user_info = req.extensions().get::<UserInfo>().cloned();
            
            if let Some(user_info) = user_info {
                if let Err(response) = check_user_rate_limit(&user_info).await {
                    return Ok(req.into_response(response.into_body()));
                }
            } else {
                if let Err(response) = check_ip_rate_limit(&req).await {
                    return Ok(req.into_response(response.into_body()));
                }
            }

            let res = service.call(req).await?;
            Ok(res)
        })
    }
}

async fn check_user_rate_limit(user_info: &UserInfo) -> Result<(), HttpResponse> {
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".to_string());
    let client = redis::Client::open(redis_url).map_err(|_| {
        HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Internal server error"
        }))
    })?;

    let mut conn = client.get_async_connection().await.map_err(|_| {
        HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Internal server error"
        }))
    })?;

    let current_time = Utc::now();
    let window_seconds = 60;
    let max_requests = 20;

    let block_key = format!("rate_limit:block:user:{}", user_info.user_id);
    
    let blocked: bool = conn.exists(&block_key).await.unwrap_or(false);
    if blocked {
        let _: () = conn.expire(&block_key, window_seconds).await.unwrap_or(());
        return Err(HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Rate limit exceeded",
            "message": "User blocked due to rate limit violation - block extended for full window",
            "retry_after": window_seconds
        })));
    }

    let window_start = calculate_user_window_start(current_time, user_info.created_at, window_seconds);
    let count_key = format!("rate_limit:count:user:{}:{}", user_info.user_id, window_start.timestamp());

    let current_count: i32 = conn.get(&count_key).await.unwrap_or(0);
    let new_count = current_count + 1;

    if new_count > max_requests {
        let _: () = conn.setex(&block_key, window_seconds, "blocked").await.unwrap_or(());
        return Err(HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Rate limit exceeded",
            "message": "Request limit exceeded, user blocked for full window",
            "limit": max_requests,
            "window": window_seconds,
            "current_count": new_count
        })));
    }

    let window_end = window_start + chrono::Duration::seconds(window_seconds as i64);
    let ttl = (window_end - current_time).num_seconds() as usize;
    let _: () = conn.setex(&count_key, ttl, new_count).await.unwrap_or(());

    Ok(())
}

async fn check_ip_rate_limit(req: &ServiceRequest) -> Result<(), HttpResponse> {
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379".to_string());
    let client = redis::Client::open(redis_url).map_err(|_| {
        HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Internal server error"
        }))
    })?;

    let mut conn = client.get_async_connection().await.map_err(|_| {
        HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Internal server error"
        }))
    })?;

    let ip = req.connection_info().realip_remote_addr().unwrap_or("unknown").to_string();
    let current_time = Utc::now();
    let window_seconds = 60;
    let max_requests = 50;

    let block_key = format!("rate_limit:block:ip:{}", ip);
    
    let blocked: bool = conn.exists(&block_key).await.unwrap_or(false);
    if blocked {
        let _: () = conn.expire(&block_key, window_seconds).await.unwrap_or(());
        return Err(HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Rate limit exceeded",
            "message": "IP blocked due to rate limit violation - block extended for full window",
            "retry_after": window_seconds
        })));
    }

    let window_start = current_time.timestamp() / window_seconds * window_seconds;
    let count_key = format!("rate_limit:count:ip:{}:{}", ip, window_start);

    let current_count: i32 = conn.get(&count_key).await.unwrap_or(0);
    let new_count = current_count + 1;

    if new_count > max_requests {
        let _: () = conn.setex(&block_key, window_seconds, "blocked").await.unwrap_or(());
        return Err(HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Rate limit exceeded",
            "message": "Request limit exceeded, IP blocked for full window",
            "limit": max_requests,
            "window": window_seconds,
            "current_count": new_count
        })));
    }

    let window_end_timestamp = window_start + window_seconds;
    let ttl = (window_end_timestamp - current_time.timestamp()) as usize;
    let _: () = conn.setex(&count_key, ttl, new_count).await.unwrap_or(());

    Ok(())
}

fn calculate_user_window_start(current_time: DateTime<Utc>, created_at: DateTime<Utc>, window_seconds: i64) -> DateTime<Utc> {
    let time_since_creation = current_time - created_at;
    let windows_since_creation = time_since_creation.num_seconds() / window_seconds;
    created_at + chrono::Duration::seconds(windows_since_creation * window_seconds)
}

// User information extracted from JWT
#[derive(Clone)]
pub struct UserInfo {
    pub user_id: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub created_at: i64,
    pub exp: usize,
    pub iat: usize,
}
