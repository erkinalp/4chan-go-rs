
use chrono::{DateTime, Utc};
use std::time::SystemTime;

pub fn system_time_to_datetime(time: SystemTime) -> DateTime<Utc> {
    let duration = time
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs() as i64;
    let nsecs = duration.subsec_nanos() as u32;
    DateTime::from_timestamp(secs, nsecs).unwrap_or_else(|| Utc::now())
}

pub fn get_extension_from_mime(mime: &str) -> &str {
    match mime {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "audio/mpeg" => "mp3",
        "audio/ogg" => "ogg",
        "application/pdf" => "pdf",
        _ => "bin",
    }
}
