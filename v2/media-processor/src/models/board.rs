use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Board {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Category {
    Japanese,
    Interests,
    Creative,
    Other,
    Misc,
    Adult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeratorBoard {
    pub user_id: Uuid,
    pub board_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}
