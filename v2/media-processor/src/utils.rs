use chrono::{DateTime, Utc};

pub fn format_timestamp(dt: DateTime<Utc>) -> String {
    dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

pub fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_filename_keeps_safe_chars() {
        assert_eq!(sanitize_filename("photo-1_final.JPG"), "photo-1_final.JPG");
    }

    #[test]
    fn sanitize_filename_strips_path_separators() {
        assert_eq!(sanitize_filename("../etc/passwd"), ".._etc_passwd");
        assert_eq!(sanitize_filename("a/b\\c"), "a_b_c");
    }

    #[test]
    fn sanitize_filename_replaces_spaces_and_symbols() {
        assert_eq!(sanitize_filename("my file (1).png"), "my_file__1_.png");
    }

    #[test]
    fn sanitize_filename_unicode_alphanumeric_kept() {
        // is_alphanumeric() accepts Unicode letters/digits — e.g. accented chars stay.
        assert_eq!(sanitize_filename("café.png"), "café.png");
    }

    #[test]
    fn sanitize_filename_empty() {
        assert_eq!(sanitize_filename(""), "");
    }

    #[test]
    fn format_timestamp_rfc3339_millis() {
        let dt = DateTime::parse_from_rfc3339("2026-01-02T03:04:05.678Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(format_timestamp(dt), "2026-01-02T03:04:05.678Z");
    }

    #[test]
    fn format_timestamp_pads_to_millis() {
        let dt = DateTime::parse_from_rfc3339("2026-01-02T03:04:05Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(format_timestamp(dt), "2026-01-02T03:04:05.000Z");
    }
}
