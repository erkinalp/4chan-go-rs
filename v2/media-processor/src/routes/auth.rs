use actix_web::{web, HttpRequest, HttpResponse, Result, Scope};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPClientInstance {
    pub key: GNAPClientKey,
    pub class_id: Option<String>,
    pub display: Option<GNAPDisplay>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPClientKey {
    pub proof: String,
    pub jwk: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPDisplay {
    pub name: String,
    pub uri: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPAccessRight {
    #[serde(rename = "type")]
    pub access_type: String,
    pub actions: Option<Vec<String>>,
    pub locations: Option<Vec<String>>,
    pub datatypes: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPAccessTokenRequest {
    pub access: Vec<GNAPAccessRight>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPUser {
    pub sub_ids: Option<Vec<GNAPSubjectID>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPSubjectID {
    pub subject_type: String,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPInteract {
    pub start: Vec<String>,
    pub finish: Option<GNAPFinish>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPFinish {
    pub method: String,
    pub uri: String,
    pub nonce: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPGrantRequest {
    pub access_token: GNAPAccessTokenRequest,
    pub client: GNAPClientInstance,
    pub user: Option<GNAPUser>,
    pub interact: Option<GNAPInteract>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPAccessToken {
    pub value: String,
    pub label: Option<String>,
    pub manage: Option<String>,
    pub access: Vec<GNAPAccessRight>,
    pub expires_in: Option<u64>,
    pub key: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPGrantResponse {
    #[serde(rename = "continue")]
    pub continue_token: Option<GNAPContinue>,
    pub access_token: Option<GNAPAccessToken>,
    pub interact: Option<GNAPInteractResponse>,
    pub subject: Option<GNAPSubject>,
    pub instance_id: Option<String>,
    pub error: Option<GNAPError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPContinue {
    pub access_token: GNAPContinueToken,
    pub uri: String,
    pub wait: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPContinueToken {
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPInteractResponse {
    pub redirect: Option<String>,
    pub app: Option<String>,
    pub user_code: Option<String>,
    pub user_code_uri: Option<String>,
    pub finish: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPSubject {
    pub sub_ids: Vec<GNAPSubjectID>,
    pub assertions: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GNAPError {
    pub code: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserContext {
    pub sub: String,
    pub email: Option<String>,
    pub role: Option<String>,
    pub permissions: Option<Vec<String>>,
}

pub struct GNAPClient {
    pub server_url: String,
    pub client_key: String,
    pub client_secret: String,
    pub http_client: reqwest::Client,
}

impl GNAPClient {
    pub fn new(server_url: String, client_key: String, client_secret: String) -> Self {
        Self {
            server_url,
            client_key,
            client_secret,
            http_client: reqwest::Client::new(),
        }
    }

    pub async fn request_grant(&self, request: &GNAPGrantRequest) -> Result<GNAPGrantResponse, Box<dyn std::error::Error>> {
        let response = self
            .http_client
            .post(&format!("{}/gnap", self.server_url))
            .header("Authorization", format!("Bearer {}", self.client_key))
            .json(request)
            .send()
            .await?;

        let grant_response: GNAPGrantResponse = response.json().await?;
        Ok(grant_response)
    }

    pub async fn validate_token(&self, token: &str) -> Result<UserContext, Box<dyn std::error::Error>> {
        if token.is_empty() {
            return Err("Empty token".into());
        }

        let response = self
            .http_client
            .post(&format!("{}/gnap/introspect", self.server_url))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;

        if response.status() != 200 {
            return Err(format!("Token validation failed with status: {}", response.status()).into());
        }

        let user_context: UserContext = response.json().await?;
        Ok(user_context)
    }
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/grant", web::post().to(request_grant))
            .route("/continue", web::post().to(continue_grant))
            .route("/introspect", web::post().to(introspect_token))
    );
}

async fn request_grant(req: web::Json<GNAPGrantRequest>) -> HttpResponse {
    let gnap_client = GNAPClient::new(
        std::env::var("GNAP_SERVER_URL").unwrap_or_else(|_| "http://localhost:8080".to_string()),
        std::env::var("GNAP_CLIENT_KEY").unwrap_or_default(),
        std::env::var("GNAP_CLIENT_SECRET").unwrap_or_default(),
    );

    match gnap_client.request_grant(&req).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "grant_request_failed",
            "description": e.to_string()
        })),
    }
}

async fn continue_grant() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "status": "continue grant not implemented" }))
}

async fn introspect_token(req: HttpRequest) -> HttpResponse {
    let auth_header = req.headers().get("Authorization");
    if auth_header.is_none() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "missing_authorization"
        }));
    }

    let auth_str = auth_header.unwrap().to_str().unwrap_or("");
    let token_parts: Vec<&str> = auth_str.split(' ').collect();
    
    if token_parts.len() != 2 || token_parts[0] != "Bearer" {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "invalid_authorization_format"
        }));
    }

    let token = token_parts[1];
    let gnap_client = GNAPClient::new(
        std::env::var("GNAP_SERVER_URL").unwrap_or_else(|_| "http://localhost:8080".to_string()),
        std::env::var("GNAP_CLIENT_KEY").unwrap_or_default(),
        std::env::var("GNAP_CLIENT_SECRET").unwrap_or_default(),
    );

    match gnap_client.validate_token(token).await {
        Ok(user_context) => HttpResponse::Ok().json(user_context),
        Err(_) => HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "invalid_token"
        })),
    }
}
