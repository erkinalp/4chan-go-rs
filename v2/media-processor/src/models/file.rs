use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Represents a file in the system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct File {
    /// Unique identifier for the file
    pub id: Uuid,

    /// Original filename provided by the user
    pub filename: String,

    /// Name as stored in the storage system
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stored_filename: Option<String>,

    /// Size of the file in bytes
    pub filesize: i64,

    /// Width in pixels (for images)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<i32>,

    /// Height in pixels (for images)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<i32>,

    /// Filename of the thumbnail
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_filename: Option<String>,

    /// MIME type of the file
    pub mime_type: String,

    /// MD5 hash of the file content
    pub md5_hash: String,

    /// SHA256 hash of the file content
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256_hash: Option<String>,

    /// Whether the file is marked as a spoiler
    pub is_spoilered: bool,

    /// When the file was created
    pub created_at: DateTime<Utc>,

    /// ID of the post this file is attached to
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_id: Option<Uuid>,

    /// URL to access the file
    pub file_url: String,

    /// URL to access the thumbnail
    pub thumbnail_url: String,
}

/// Response after successfully uploading a file
#[derive(Debug, Serialize, Deserialize)]
pub struct FileUploadResponse {
    /// Unique identifier for the file
    pub id: Uuid,

    /// URL to access the file
    pub file_url: String,

    /// URL to access the thumbnail
    pub thumbnail_url: String,

    /// Original filename provided by the user
    pub filename: String,

    /// Size of the file in bytes
    pub filesize: i64,

    /// Width in pixels (for images)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<i32>,

    /// Height in pixels (for images)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<i32>,

    /// MIME type of the file
    pub mime_type: String,

    /// MD5 hash of the file content
    pub md5_hash: String,

    /// Whether the file is marked as a spoiler
    pub is_spoilered: bool,

    /// Time taken to upload in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upload_duration: Option<i32>,
}

/// Request to check if a file exists by its MD5 hash
#[derive(Debug, Deserialize)]
pub struct FileCheckRequest {
    /// MD5 hash to check
    pub md5_hash: String,
}

/// Response to a file check request
#[derive(Debug, Serialize)]
pub struct FileCheckResponse {
    /// Whether a file with this hash exists
    pub exists: bool,

    /// The file details if it exists
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<File>,
}

/// Response containing banned file hashes
#[derive(Debug, Serialize)]
pub struct BannedHashesResponse {
    /// List of banned MD5 hashes
    pub data: Vec<String>,

    /// When the list was last updated
    pub updated_at: DateTime<Utc>,
}

/// Statistics about files in the system
#[derive(Debug, Serialize)]
pub struct FileStats {
    /// Total number of files
    pub total_files: i32,

    /// Total size of all files in bytes
    pub total_size: i64,

    /// Files grouped by MIME type
    pub files_by_type: std::collections::HashMap<String, i32>,

    /// Average file size in bytes
    pub average_file_size: i64,

    /// Number of files uploaded in the last day
    pub files_last_day: i32,

    /// Number of files uploaded in the last week
    pub files_last_week: i32,
}

/// Request to purge old files
#[derive(Debug, Deserialize)]
pub struct FilePurgeRequest {
    /// Purge files older than this many days
    pub older_than_days: i32,

    /// Optional list of MIME types to target
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_types: Option<Vec<String>>,

    /// Optional list of board IDs to exclude
    #[serde(skip_serializing_if = "Option::is_none")]
    pub except_board_ids: Option<Vec<String>>,

    /// Whether to do a dry run (no actual deletion)
    #[serde(default)]
    pub dry_run: bool,
}

/// Response to a file purge request
#[derive(Debug, Serialize)]
pub struct FilePurgeResponse {
    /// ID of the task
    pub task_id: Uuid,

    /// Estimated number of files to be purged
    pub estimated_files_to_purge: i32,

    /// Estimated space to be freed in bytes
    pub estimated_space_to_free: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_file() -> File {
        File {
            id: Uuid::new_v4(),
            filename: "cat.jpg".to_string(),
            stored_filename: None,
            filesize: 1234,
            width: None,
            height: None,
            thumbnail_filename: None,
            mime_type: "image/jpeg".to_string(),
            md5_hash: "d41d8cd98f00b204e9800998ecf8427e".to_string(),
            sha256_hash: None,
            is_spoilered: false,
            created_at: Utc::now(),
            post_id: None,
            file_url: "http://files/f1".to_string(),
            thumbnail_url: "http://files/f1/thumb".to_string(),
        }
    }

    #[test]
    fn file_json_omits_none_fields() {
        let json = serde_json::to_value(&sample_file()).unwrap();
        for key in [
            "stored_filename",
            "width",
            "height",
            "thumbnail_filename",
            "sha256_hash",
            "post_id",
        ] {
            assert!(json.get(key).is_none(), "{key} should be omitted");
        }
        assert_eq!(json["filename"], "cat.jpg");
        assert_eq!(json["filesize"], 1234);
        assert_eq!(json["is_spoilered"], false);
    }

    #[test]
    fn file_json_includes_set_fields() {
        let mut f = sample_file();
        f.stored_filename = Some("s.jpg".to_string());
        f.width = Some(800);
        f.height = Some(600);
        f.post_id = Some(Uuid::nil());
        let json = serde_json::to_value(&f).unwrap();
        assert_eq!(json["stored_filename"], "s.jpg");
        assert_eq!(json["width"], 800);
        assert_eq!(json["post_id"], Uuid::nil().to_string());
    }

    #[test]
    fn file_check_response_omits_file_when_absent() {
        let resp = FileCheckResponse {
            exists: false,
            file: None,
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["exists"], false);
        assert!(json.get("file").is_none());
    }

    #[test]
    fn file_purge_request_defaults_dry_run_false() {
        let req: FilePurgeRequest =
            serde_json::from_str(r#"{"older_than_days": 30}"#).unwrap();
        assert_eq!(req.older_than_days, 30);
        assert!(!req.dry_run);
        assert!(req.mime_types.is_none());
        assert!(req.except_board_ids.is_none());
    }

    #[test]
    fn banned_hashes_response_serializes() {
        let resp = BannedHashesResponse {
            data: vec!["abc".to_string()],
            updated_at: Utc::now(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["data"], serde_json::json!(["abc"]));
        assert!(json.get("updated_at").is_some());
    }

    #[test]
    fn file_stats_serializes() {
        let mut by_type = std::collections::HashMap::new();
        by_type.insert("image/png".to_string(), 7);
        let stats = FileStats {
            total_files: 10,
            total_size: 5000,
            files_by_type: by_type,
            average_file_size: 500,
            files_last_day: 2,
            files_last_week: 9,
        };
        let json = serde_json::to_value(&stats).unwrap();
        assert_eq!(json["total_files"], 10);
        assert_eq!(json["files_by_type"]["image/png"], 7);
    }
}
