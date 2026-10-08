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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_reason_serializes_as_variant_name() {
        assert_eq!(serde_json::to_string(&ReportReason::Spam).unwrap(), "\"Spam\"");
        assert_eq!(
            serde_json::to_string(&ReportReason::IllegalContent).unwrap(),
            "\"IllegalContent\""
        );
        assert_eq!(serde_json::to_string(&ReportReason::Other).unwrap(), "\"Other\"");
    }

    #[test]
    fn report_reason_rejects_unknown() {
        assert!(serde_json::from_str::<ReportReason>("\"Meh\"").is_err());
    }

    #[test]
    fn report_roundtrip() {
        let r = Report {
            id: Uuid::new_v4(),
            post_id: Uuid::new_v4(),
            reporter_id: None,
            reason: ReportReason::Copyright,
            details: Some("dmca".to_string()),
            is_resolved: false,
            resolved_by: None,
            resolved_at: None,
            created_at: Utc::now(),
        };
        let json = serde_json::to_string(&r).unwrap();
        let back: Report = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, r.id);
        assert_eq!(back.post_id, r.post_id);
        assert_eq!(back.details.as_deref(), Some("dmca"));
    }
}
