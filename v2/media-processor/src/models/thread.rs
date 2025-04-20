use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thread {
    pub id: Uuid,
    pub board_id: Uuid,
    pub title: Option<String>,
    pub is_locked: bool,
    pub is_sticky: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadWithStats {
    pub id: Uuid,
    pub board_id: Uuid,
    pub title: Option<String>,
    pub is_locked: bool,
    pub is_sticky: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub post_count: i32,
    pub last_post_at: Option<DateTime<Utc>>,
}
