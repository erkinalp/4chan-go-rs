use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Captcha {
    pub id: Uuid,
    pub image_data: String,
    pub solution: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub is_used: bool,
}
