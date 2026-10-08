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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appeal_status_serializes_as_variant_name() {
        assert_eq!(serde_json::to_string(&AppealStatus::Pending).unwrap(), "\"Pending\"");
        assert_eq!(serde_json::to_string(&AppealStatus::Approved).unwrap(), "\"Approved\"");
        assert_eq!(serde_json::to_string(&AppealStatus::Rejected).unwrap(), "\"Rejected\"");
    }

    #[test]
    fn appeal_status_roundtrip() {
        for s in [AppealStatus::Pending, AppealStatus::Approved, AppealStatus::Rejected] {
            let json = serde_json::to_string(&s).unwrap();
            let back: AppealStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(serde_json::to_string(&back).unwrap(), json);
        }
    }

    #[test]
    fn appeal_status_rejects_unknown() {
        assert!(serde_json::from_str::<AppealStatus>("\"Escalated\"").is_err());
    }
}
