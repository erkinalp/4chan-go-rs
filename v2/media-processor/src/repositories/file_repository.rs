use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use crate::models::{File, FileStats};
use crate::repositories::postgres_repository::PostgresRepository;

pub struct FileRepository {
    postgres: PostgresRepository,
}

impl FileRepository {
    pub fn new(postgres: PostgresRepository) -> Self {
        Self { postgres }
    }

    pub async fn get_file_by_id(&self, file_id: &Uuid) -> Result<Option<File>> {
        let query = r#"
            SELECT id, filename, stored_filename, filesize, width, height, 
                   thumbnail_filename, mime_type, md5_hash, sha256_hash, 
                   is_spoilered, created_at, post_id
            FROM files
            WHERE id = $1
        "#;

        let result = sqlx::query(query)
            .bind(file_id)
            .map(|row: PgRow| {
                File {
                    id: row.get("id"),
                    filename: row.get("filename"),
                    stored_filename: row.get("stored_filename"),
                    filesize: row.get("filesize"),
                    width: row.get("width"),
                    height: row.get("height"),
                    thumbnail_filename: row.get("thumbnail_filename"),
                    mime_type: row.get("mime_type"),
                    md5_hash: row.get("md5_hash"),
                    sha256_hash: row.get("sha256_hash"),
                    is_spoilered: row.get("is_spoilered"),
                    created_at: row.get("created_at"),
                    post_id: row.get("post_id"),
                }
            })
            .fetch_optional(&self.postgres.pool)
            .await?;

        Ok(result)
    }

    pub async fn get_file_by_md5_hash(&self, md5_hash: &str) -> Result<Option<File>> {
        let query = r#"
            SELECT id, filename, stored_filename, filesize, width, height, 
                   thumbnail_filename, mime_type, md5_hash, sha256_hash, 
                   is_spoilered, created_at, post_id
            FROM files
            WHERE md5_hash = $1
            LIMIT 1
        "#;

        let result = sqlx::query(query)
            .bind(md5_hash)
            .map(|row: PgRow| {
                File {
                    id: row.get("id"),
                    filename: row.get("filename"),
                    stored_filename: row.get("stored_filename"),
                    filesize: row.get("filesize"),
                    width: row.get("width"),
                    height: row.get("height"),
                    thumbnail_filename: row.get("thumbnail_filename"),
                    mime_type: row.get("mime_type"),
                    md5_hash: row.get("md5_hash"),
                    sha256_hash: row.get("sha256_hash"),
                    is_spoilered: row.get("is_spoilered"),
                    created_at: row.get("created_at"),
                    post_id: row.get("post_id"),
                }
            })
            .fetch_optional(&self.postgres.pool)
            .await?;

        Ok(result)
    }

    pub async fn create_file(&self, file: &File) -> Result<()> {
        let query = r#"
            INSERT INTO files (
                id, filename, stored_filename, filesize, width, height, 
                thumbnail_filename, mime_type, md5_hash, sha256_hash, 
                is_spoilered, created_at, post_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
        "#;

        sqlx::query(query)
            .bind(&file.id)
            .bind(&file.filename)
            .bind(&file.stored_filename)
            .bind(file.filesize)
            .bind(file.width)
            .bind(file.height)
            .bind(&file.thumbnail_filename)
            .bind(&file.mime_type)
            .bind(&file.md5_hash)
            .bind(&file.sha256_hash)
            .bind(file.is_spoilered)
            .bind(file.created_at)
            .bind(&file.post_id)
            .execute(&self.postgres.pool)
            .await?;

        Ok(())
    }

    pub async fn delete_file(&self, file_id: &Uuid) -> Result<bool> {
        let query = "DELETE FROM files WHERE id = $1";
        
        let result = sqlx::query(query)
            .bind(file_id)
            .execute(&self.postgres.pool)
            .await?;
        
        Ok(result.rows_affected() > 0)
    }

    pub async fn get_banned_hashes(&self) -> Result<Vec<String>> {
        let query = r#"
            SELECT md5_hash
            FROM banned_files
            WHERE is_active = true
        "#;

        let result = sqlx::query(query)
            .map(|row: PgRow| row.get::<String, _>("md5_hash"))
            .fetch_all(&self.postgres.pool)
            .await?;

        Ok(result)
    }

    pub async fn get_file_stats(&self) -> Result<FileStats> {
        let total_query = r#"
            SELECT COUNT(*), COALESCE(SUM(filesize), 0)
            FROM files
        "#;

        let (total_files, total_size) = sqlx::query_as::<_, (i64, i64)>(total_query)
            .fetch_one(&self.postgres.pool)
            .await?;

        let day_query = r#"
            SELECT COUNT(*)
            FROM files
            WHERE created_at > NOW() - INTERVAL '1 day'
        "#;

        let files_last_day = sqlx::query_scalar::<_, i64>(day_query)
            .fetch_one(&self.postgres.pool)
            .await?;

        let week_query = r#"
            SELECT COUNT(*)
            FROM files
            WHERE created_at > NOW() - INTERVAL '7 days'
        "#;

        let files_last_week = sqlx::query_scalar::<_, i64>(week_query)
            .fetch_one(&self.postgres.pool)
            .await?;

        let type_query = r#"
            SELECT mime_type, COUNT(*)
            FROM files
            GROUP BY mime_type
        "#;

        let type_results = sqlx::query_as::<_, (String, i64)>(type_query)
            .fetch_all(&self.postgres.pool)
            .await?;

        let mut files_by_type = std::collections::HashMap::new();
        for (mime_type, count) in type_results {
            files_by_type.insert(mime_type, count as i32);
        }

        let average_file_size = if total_files > 0 {
            total_size / total_files
        } else {
            0
        };

        Ok(FileStats {
            total_files: total_files as i32,
            total_size,
            average_file_size,
            files_last_day: files_last_day as i32,
            files_last_week: files_last_week as i32,
            files_by_type,
        })
    }
}
