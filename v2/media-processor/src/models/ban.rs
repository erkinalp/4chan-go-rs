use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ban {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub ip_hash: String,
    pub reason: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub created_by: Uuid,
    pub appeal_status: Option<AppealStatus>,
    pub appeal_text: Option<String>,
    pub appeal_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppealStatus {
    Pending,
    Approved,
    Rejected,
}
