use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub id: Uuid,
    pub post_id: Uuid,
    pub reporter_id: Option<Uuid>,
    pub reason: ReportReason,
    pub details: Option<String>,
    pub is_resolved: bool,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReportReason {
    Spam,
    Harassment,
    IllegalContent,
    PersonalInformation,
    Copyright,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportWithDetails {
    pub id: Uuid,
    pub post_id: Uuid,
    pub reporter_id: Option<Uuid>,
    pub reason: ReportReason,
    pub details: Option<String>,
    pub is_resolved: bool,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub post_content: String,
    pub board_name: String,
    pub thread_id: Uuid,
}
