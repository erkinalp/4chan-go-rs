use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordFilter {
    pub id: Uuid,
    pub pattern: String,
    pub replacement: String,
    pub is_regex: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub created_by: Uuid,
}
