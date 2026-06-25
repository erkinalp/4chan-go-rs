use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    error::ErrorUnauthorized,
    Error, HttpMessage,
};
use futures::future::{ok, LocalBoxFuture, Ready};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::rc::Rc;
use uuid::Uuid;

// Define middleware for JWT authentication
pub fn jwt_auth() -> JwtAuth {
    JwtAuth
}

// Define middleware for role-based authorization
pub fn require_role(roles: Vec<String>) -> RequireRole {
    RequireRole { roles }
}

// JWT Claims structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    pub sub: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub exp: i64,
    #[serde(default)]
    pub iat: i64,
    #[serde(default)]
    pub iss: String,
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
            // Propagate request ID
            let request_id = req
                .headers()
                .get("X-Request-Id")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_string())
                .unwrap_or_else(|| Uuid::new_v4().to_string());

            req.extensions_mut().insert(RequestId(request_id));

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

            if token.is_empty() {
                return Err(ErrorUnauthorized("Invalid token"));
            }

            // Get JWT secret from app config
            let config = req.app_data::<actix_web::web::Data<crate::config::Config>>();
            let secret = config
                .map(|c| c.jwt.secret.clone())
                .unwrap_or_else(|| "default_secret".to_string());

            // Validate and decode the JWT token
            let token_data = decode::<JwtClaims>(
                token,
                &DecodingKey::from_secret(secret.as_bytes()),
                &Validation::new(Algorithm::HS256),
            );

            match token_data {
                Ok(data) => {
                    let claims = data.claims;
                    req.extensions_mut().insert(UserInfo {
                        user_id: claims.sub.clone(),
                        role: claims.role.clone(),
                        email: claims.email.clone(),
                    });
                    service.call(req).await
                }
                Err(_) => Err(ErrorUnauthorized("Invalid or expired token")),
            }
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

// User information extracted from JWT
#[derive(Clone, Debug)]
pub struct UserInfo {
    pub user_id: String,
    pub role: String,
    pub email: String,
}

// Request ID for tracing
#[derive(Clone, Debug)]
pub struct RequestId(pub String);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_claims_deserialization() {
        let json = r#"{"sub":"user-123","email":"test@example.com","role":"ADMIN","exp":9999999999,"iat":1000000000,"iss":"4chan-v2"}"#;
        let claims: JwtClaims = serde_json::from_str(json).unwrap();
        assert_eq!(claims.sub, "user-123");
        assert_eq!(claims.email, "test@example.com");
        assert_eq!(claims.role, "ADMIN");
        assert_eq!(claims.exp, 9999999999);
    }

    #[test]
    fn test_jwt_claims_defaults() {
        let json = r#"{"sub":"user-456"}"#;
        let claims: JwtClaims = serde_json::from_str(json).unwrap();
        assert_eq!(claims.sub, "user-456");
        assert_eq!(claims.email, "");
        assert_eq!(claims.role, "");
        assert_eq!(claims.exp, 0);
    }

    #[test]
    fn test_user_info_clone() {
        let info = UserInfo {
            user_id: "user-123".to_string(),
            role: "ADMIN".to_string(),
            email: "test@example.com".to_string(),
        };
        let cloned = info.clone();
        assert_eq!(cloned.user_id, "user-123");
        assert_eq!(cloned.role, "ADMIN");
    }

    #[test]
    fn test_request_id_generation() {
        let id = RequestId(Uuid::new_v4().to_string());
        assert!(!id.0.is_empty());
        // Verify it's a valid UUID
        assert!(Uuid::parse_str(&id.0).is_ok());
    }

    #[test]
    fn test_require_role_creation() {
        let middleware = require_role(vec!["ADMIN".to_string(), "MODERATOR".to_string()]);
        assert_eq!(middleware.roles.len(), 2);
        assert!(middleware.roles.contains(&"ADMIN".to_string()));
        assert!(middleware.roles.contains(&"MODERATOR".to_string()));
    }
}
