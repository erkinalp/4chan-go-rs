use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Post {
    pub id: Uuid,
    pub thread_id: Uuid,
    pub user_id: Option<Uuid>,
    pub content: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub tripcode: Option<String>,
    pub is_op: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub ip_hash: String,
    pub file_id: Option<Uuid>,
}
