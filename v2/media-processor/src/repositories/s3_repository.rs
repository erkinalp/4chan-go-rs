use aws_sdk_s3::{Client as S3Client, config::Credentials};
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::presigning::PresigningConfig;
use chrono::Utc;
use std::io::Cursor;
use uuid::Uuid;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct S3Repository {
    client: Arc<S3Client>,
    bucket: String,
}

impl S3Repository {
    pub async fn new(
        endpoint: &str,
        region: &str,
        access_key: &str, 
        secret_key: &str,
        bucket: &str
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let region_provider = RegionProviderChain::default_provider();
            
        let credentials_provider = Credentials::new(
            access_key,
            secret_key,
            None, 
            None,
            "static-credentials"
        );
        
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
        
        let bucket_exists = if let Some(bucket_list) = buckets.buckets() {
            bucket_list.iter().any(|bucket| {
                if let Some(name) = bucket.name() {
                    name == self.bucket
                } else {
                    false
                }
            })
        } else {
            false
        };
            
        if !bucket_exists {
            self.client.create_bucket()
                .bucket(&self.bucket)
                .send()
                .await?;
                
            let policy = format!(r#"{{
                "Version": "2012-10-17",
                "Statement": [
                    {{
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": "s3:GetObject",
                        "Resource": "arn:aws:s3:::{}/*"
                    }}
                ]
            }}"#, self.bucket);
            
            self.client.put_bucket_policy()
                .bucket(&self.bucket)
                .policy(policy)
                .send()
                .await?;
        }
        
        Ok(())
    }
    
    pub async fn upload_file(
        &self,
        file_id: &Uuid,
        file_data: &[u8],
        filename: &str,
        content_type: &str
    ) -> Result<(String, String), Box<dyn std::error::Error>> {
        let timestamp = Utc::now().timestamp();
        let unique_filename = format!("{}_{}", timestamp, filename);
        
        let _md5 = md5::compute(file_data);
        
        self.client.put_object()
            .bucket(&self.bucket)
            .key(&unique_filename)
            .body(file_data.to_vec().into())
            .content_type(content_type)
            .metadata("file-id", &file_id.to_string())
            .send()
            .await?;
            
        let file_url = format!("https://{}.s3.amazonaws.com/{}", self.bucket, unique_filename);
        
        let thumbnail_url = file_url.clone();
        
        Ok((file_url, thumbnail_url))
    }
    
    pub async fn delete_file(&self, filename: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.client.delete_object()
            .bucket(&self.bucket)
            .key(filename)
            .send()
            .await?;
            
        let thumbnail_name = format!("thumb_{}", filename);
        let _ = self.client.delete_object()
            .bucket(&self.bucket)
            .key(&thumbnail_name)
            .send()
            .await;
            
        Ok(())
    }
    
    pub async fn get_file(&self, filename: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let response = self.client.get_object()
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
        expiry_secs: u64
    ) -> Result<String, Box<dyn std::error::Error>> {
        let presigning_config = PresigningConfig::builder()
            .expires_in(std::time::Duration::from_secs(expiry_secs))
            .build()?;
            
        let presigned_request = self.client.get_object()
            .bucket(&self.bucket)
            .key(filename)
            .presigned(presigning_config)
            .await?;
            
        Ok(presigned_request.uri().to_string())
    }
}
