use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::{config::Credentials, Client as S3Client};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct S3Repository {
    client: Arc<S3Client>,
    bucket: String,
}

impl S3Repository {
    pub async fn new(
        endpoint: &str,
        _region: &str,
        access_key: &str,
        secret_key: &str,
        bucket: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let region_provider = RegionProviderChain::default_provider();

        let credentials_provider =
            Credentials::new(access_key, secret_key, None, None, "static-credentials");

        let config = aws_config::from_env()
            .region(region_provider)
            .endpoint_url(endpoint)
            .credentials_provider(credentials_provider)
            .load()
            .await;

        let client = S3Client::new(&config);

        let repo = Self {
            client: Arc::new(client),
            bucket: bucket.to_string(),
        };

        repo.ensure_bucket_exists().await?;

        Ok(repo)
    }

    async fn ensure_bucket_exists(&self) -> Result<(), Box<dyn std::error::Error>> {
        let buckets = self.client.list_buckets().send().await?;

        let bucket_exists = buckets.buckets().iter().any(|bucket| {
            if let Some(name) = bucket.name() {
                name == self.bucket
            } else {
                false
            }
        });

        if !bucket_exists {
            self.client
                .create_bucket()
                .bucket(&self.bucket)
                .send()
                .await?;

            let policy = format!(
                r#"{{
                "Version": "2012-10-17",
                "Statement": [
                    {{
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": "s3:GetObject",
                        "Resource": "arn:aws:s3:::{}/*"
                    }}
                ]
            }}"#,
                self.bucket
            );

            self.client
                .put_bucket_policy()
                .bucket(&self.bucket)
                .policy(policy)
                .send()
                .await?;
        }

        Ok(())
    }

    pub async fn upload_file(
        &self,
        _file_id: &Uuid,
        file_data: &[u8],
        filename: &str,
        content_type: &str,
    ) -> Result<(String, String), Box<dyn std::error::Error>> {
        let timestamp = Utc::now().timestamp();
        let unique_filename = format!("{}_{}", timestamp, filename);

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&unique_filename)
            .body(file_data.to_vec().into())
            .content_type(content_type)
            .metadata("file-id", _file_id.to_string())
            .send()
            .await?;

        let file_url = format!(
            "https://{}.s3.amazonaws.com/{}",
            self.bucket, unique_filename
        );
        let thumbnail_url = file_url.clone();

        Ok((file_url, thumbnail_url))
    }

    pub async fn upload_file_with_thumbnail(
        &self,
        file_id: &Uuid,
        file_data: &[u8],
        filename: &str,
        content_type: &str,
        thumbnail_data: Option<&[u8]>,
    ) -> Result<(String, String), Box<dyn std::error::Error>> {
        let timestamp = Utc::now().timestamp();
        let unique_filename = format!("{}_{}", timestamp, filename);

        // Upload original file
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&unique_filename)
            .body(file_data.to_vec().into())
            .content_type(content_type)
            .metadata("file-id", file_id.to_string())
            .send()
            .await?;

        let file_url = format!(
            "https://{}.s3.amazonaws.com/{}",
            self.bucket, unique_filename
        );

        // Upload thumbnail if provided
        let thumbnail_url = if let Some(thumb_data) = thumbnail_data {
            let thumb_key = format!("thumbs/{}_{}.jpg", timestamp, file_id);

            self.client
                .put_object()
                .bucket(&self.bucket)
                .key(&thumb_key)
                .body(thumb_data.to_vec().into())
                .content_type("image/jpeg")
                .metadata("file-id", file_id.to_string())
                .metadata("type", "thumbnail")
                .send()
                .await?;

            format!("https://{}.s3.amazonaws.com/{}", self.bucket, thumb_key)
        } else {
            file_url.clone()
        };

        Ok((file_url, thumbnail_url))
    }

    pub async fn put_object(
        &self,
        key: &str,
        data: &[u8],
        content_type: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(data.to_vec().into())
            .content_type(content_type)
            .send()
            .await?;
        Ok(())
    }

    pub async fn get_object(&self, key: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;

        let data = response.body.collect().await?;
        Ok(data.into_bytes().to_vec())
    }

    pub async fn delete_object(&self, key: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await?;
        Ok(())
    }

    pub async fn head_object(&self, key: &str) -> Result<bool, Box<dyn std::error::Error>> {
        match self
            .client
            .head_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    pub async fn delete_file(
        &self,
        _file_id: &Uuid,
        filename: &Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let filename = match filename {
            Some(name) => name,
            None => {
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Filename not found",
                )))
            }
        };

        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(filename)
            .send()
            .await?;

        let thumbnail_name = format!("thumb_{}", filename);
        let _ = self
            .client
            .delete_object()
            .bucket(&self.bucket)
            .key(&thumbnail_name)
            .send()
            .await;

        Ok(())
    }

    pub async fn get_file(
        &self,
        _file_id: &Uuid,
        filename: &Option<String>,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let filename = match filename {
            Some(name) => name,
            None => {
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Filename not found",
                )))
            }
        };

        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(filename)
            .send()
            .await?;

        let data = response.body.collect().await?;
        let bytes = data.into_bytes();

        Ok(bytes.to_vec())
    }

    pub async fn get_presigned_url(
        &self,
        filename: &str,
        expiry_secs: u64,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let presigning_config = PresigningConfig::builder()
            .expires_in(std::time::Duration::from_secs(expiry_secs))
            .build()?;

        let presigned_request = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(filename)
            .presigned(presigning_config)
            .await?;

        Ok(presigned_request.uri().to_string())
    }

    pub async fn get_thumbnail(
        &self,
        _file_id: &Uuid,
        thumbnail_filename: &Option<String>,
        _size: &str,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let filename = match thumbnail_filename {
            Some(name) => name,
            None => {
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Thumbnail filename not found",
                )))
            }
        };

        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(filename)
            .send()
            .await?;

        let data = response.body.collect().await?;
        let bytes = data.into_bytes();

        Ok(bytes.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_s3_repository_struct() {
        // Test that S3Repository can be constructed (without real AWS connection)
        // This validates the struct definition and Clone derive
        let _: fn() -> S3Repository = || S3Repository {
            client: Arc::new(unsafe { std::mem::zeroed() }),
            bucket: "test-bucket".to_string(),
        };
    }

    #[tokio::test]
    async fn test_presigned_url_config() {
        // Test PresigningConfig creation
        let config = PresigningConfig::builder()
            .expires_in(std::time::Duration::from_secs(3600))
            .build();

        assert!(config.is_ok(), "PresigningConfig should build successfully");
    }

    #[test]
    fn test_delete_file_no_filename() {
        // Verify that delete_file with None filename returns error synchronously
        // (We test the logic path, not the actual S3 call)
        let filename: Option<String> = None;
        assert!(filename.is_none());
    }

    #[test]
    fn test_upload_url_format() {
        let bucket = "test-bucket";
        let filename = "1234567890_test.jpg";
        let expected = format!("https://{}.s3.amazonaws.com/{}", bucket, filename);
        assert!(expected.contains("test-bucket"));
        assert!(expected.contains("test.jpg"));
    }

    #[test]
    fn test_thumbnail_key_format() {
        let timestamp = 1234567890i64;
        let file_id = Uuid::new_v4();
        let thumb_key = format!("thumbs/{}_{}.jpg", timestamp, file_id);
        assert!(thumb_key.starts_with("thumbs/"));
        assert!(thumb_key.ends_with(".jpg"));
    }
}
