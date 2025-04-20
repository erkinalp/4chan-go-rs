use actix_web::{web, HttpResponse, HttpRequest, Error, error};
use actix_multipart::Multipart;
use chrono::Utc;
use futures::{StreamExt, TryStreamExt};
use serde_json::json;
use uuid::Uuid;
use std::collections::HashMap;
use std::io::Read;
use std::time::Instant;

use crate::config::Config;
use crate::models::{
    File, 
    FileUploadResponse,
    FileCheckRequest,
    FileCheckResponse,
    BannedHashesResponse,
    FileStats,
    FilePurgeRequest,
    FilePurgeResponse
};
use crate::repositories::s3_repository::S3Repository;
use crate::repositories::file_repository::FileRepository;
use crate::error::AppError;

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB

pub async fn upload_file(
    req: HttpRequest,
    mut payload: Multipart,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>,
    config: web::Data<Config>
) -> Result<HttpResponse, Error> {
    let start_time = Instant::now();
    
    let mut file_data: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut is_spoiler = false;
    
    while let Ok(Some(mut field)) = payload.try_next().await {
        let content_disposition = field.content_disposition().ok_or_else(|| {
            error::ErrorBadRequest("Content disposition is missing")
        })?;
        
        let field_name = content_disposition.get_name().ok_or_else(|| {
            error::ErrorBadRequest("Field name is missing")
        })?.to_string();
        
        match field_name.as_str() {
            "file" => {
                filename = content_disposition.get_filename().map(|s| s.to_string());
                
                content_type = field.content_type().map(|ct| ct.to_string());
                
                let mut data = Vec::new();
                while let Some(chunk) = field.next().await {
                    let chunk = chunk?;
                    if data.len() + chunk.len() > MAX_FILE_SIZE {
                        return Err(error::ErrorPayloadTooLarge("File too large").into());
                    }
                    data.extend_from_slice(&chunk);
                }
                
                if data.is_empty() {
                    return Err(error::ErrorBadRequest("Empty file").into());
                }
                
                file_data = Some(data);
            },
            "spoiler" => {
                let mut value = String::new();
                while let Some(chunk) = field.next().await {
                    let chunk = chunk?;
                    value.extend(std::str::from_utf8(&chunk).unwrap_or_default().chars());
                }
                is_spoiler = value.trim().to_lowercase() == "true";
            },
            _ => {
                while let Some(_) = field.next().await {
                }
            }
        }
    }
    
    let file_data = file_data.ok_or_else(|| error::ErrorBadRequest("File is required"))?;
    let filename = filename.ok_or_else(|| error::ErrorBadRequest("Filename is missing"))?;
    
    let content_type = content_type.unwrap_or_else(|| "application/octet-stream".to_string());
    
    let file_id = Uuid::new_v4();
    
    let md5_hash = format!("{:x}", md5::compute(&file_data));
    
    match file_repo.get_file_by_md5_hash(&md5_hash).await {
        Ok(Some(existing_file)) => {
            let response = FileUploadResponse {
                id: existing_file.id,
                file_url: format!("/files/{}/content", existing_file.id),
                thumbnail_url: format!("/files/{}/thumbnail", existing_file.id),
                filename: existing_file.filename,
                filesize: existing_file.filesize,
                width: existing_file.width,
                height: existing_file.height,
                mime_type: existing_file.mime_type,
                md5_hash: existing_file.md5_hash,
                is_spoilered: existing_file.is_spoilered,
                upload_duration: Some(0),
            };
            return Ok(HttpResponse::Ok().json(response));
        },
        Ok(None) => {
        },
        Err(e) => {
            return Err(error::ErrorInternalServerError(format!("Failed to check for duplicate file: {}", e)).into());
        }
    }
    
    
    let (width, height) = (None, None);
    
    let unique_filename = format!("{}_{}", Utc::now().timestamp(), filename);
    let (file_url, thumbnail_url) = match s3_repo.upload_file(&file_id, &file_data, &unique_filename, &content_type).await {
        Ok((file_url, thumb_url)) => (file_url, thumb_url),
        Err(e) => return Err(error::ErrorInternalServerError(format!("Failed to upload file: {}", e)).into()),
    };
    
    let upload_duration = start_time.elapsed().as_millis() as i32;
    
    let file = File {
        id: file_id,
        filename,
        stored_filename: Some(unique_filename.clone()),
        filesize: file_data.len() as i64,
        width,
        height,
        thumbnail_filename: Some(thumbnail_url.clone()),
        mime_type: content_type.clone(),
        md5_hash: md5_hash.clone(),
        sha256_hash: Some("".to_string()), // TODO: Calculate SHA256 hash
        is_spoilered,
        created_at: Utc::now(),
        post_id: None,
    };
    
    if let Err(e) = file_repo.create_file(&file).await {
        return Err(error::ErrorInternalServerError(format!("Failed to save file metadata: {}", e)).into());
    }
    
    let response = FileUploadResponse {
        id: file_id,
        file_url,
        thumbnail_url,
        filename: file.filename,
        filesize: file.filesize,
        width,
        height,
        mime_type: content_type,
        md5_hash,
        is_spoilered,
        upload_duration: Some(upload_duration),
    };
    
    Ok(HttpResponse::Created().json(response))
}

pub async fn get_file_info(
    path: web::Path<String>,
    file_repo: web::Data<FileRepository>,
) -> Result<HttpResponse, Error> {
    let file_id = path.into_inner();
    
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => return Err(error::ErrorBadRequest("Invalid file ID").into()),
    };
    
    match file_repo.get_file_by_id(&file_id).await {
        Ok(Some(file)) => {
            Ok(HttpResponse::Ok().json(file))
        },
        Ok(None) => {
            Err(error::ErrorNotFound("File not found").into())
        },
        Err(e) => {
            Err(error::ErrorInternalServerError(format!("Failed to retrieve file: {}", e)).into())
        }
    }
}

pub async fn delete_file(
    req: HttpRequest,
    path: web::Path<String>,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>,
) -> Result<HttpResponse, Error> {
    let file_id = path.into_inner();
    
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => return Err(error::ErrorBadRequest("Invalid file ID").into()),
    };
    
    let file = match file_repo.get_file_by_id(&file_id).await {
        Ok(Some(file)) => file,
        Ok(None) => return Err(error::ErrorNotFound("File not found").into()),
        Err(e) => return Err(error::ErrorInternalServerError(format!("Failed to retrieve file: {}", e)).into()),
    };
    
    if let Err(e) = s3_repo.delete_file(&file_id, &file.stored_filename).await {
        return Err(error::ErrorInternalServerError(format!("Failed to delete file from storage: {}", e)).into());
    }
    
    match file_repo.delete_file(&file_id).await {
        Ok(true) => Ok(HttpResponse::NoContent().finish()),
        Ok(false) => Err(error::ErrorNotFound("File not found").into()),
        Err(e) => Err(error::ErrorInternalServerError(format!("Failed to delete file from database: {}", e)).into()),
    }
}

pub async fn get_file_content(
    req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>,
) -> Result<HttpResponse, Error> {
    let file_id = path.into_inner();
    
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => return Err(error::ErrorBadRequest("Invalid file ID").into()),
    };
    
    let download = query.get("download")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);
    
    let file = match file_repo.get_file_by_id(&file_id).await {
        Ok(Some(file)) => file,
        Ok(None) => return Err(error::ErrorNotFound("File not found").into()),
        Err(e) => return Err(error::ErrorInternalServerError(format!("Failed to retrieve file: {}", e)).into()),
    };
    
    let file_data = match s3_repo.get_file(&file_id, &file.stored_filename).await {
        Ok(data) => data,
        Err(e) => return Err(error::ErrorInternalServerError(format!("Failed to retrieve file content: {}", e)).into()),
    };
    
    let content_disposition = if download {
        format!("attachment; filename=\"{}\"", file.filename)
    } else {
        format!("inline; filename=\"{}\"", file.filename)
    };
    
    Ok(HttpResponse::Ok()
        .content_type(file.mime_type)
        .header("Content-Disposition", content_disposition)
        .body(file_data))
}

pub async fn get_thumbnail(
    req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>,
) -> Result<HttpResponse, Error> {
    let file_id = path.into_inner();
    
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => return Err(error::ErrorBadRequest("Invalid file ID").into()),
    };
    
    let size = query.get("size")
        .map(|s| s.as_str())
        .unwrap_or("medium");
    
    if !["small", "medium", "large"].contains(&size) {
        return Err(error::ErrorBadRequest("Invalid thumbnail size").into());
    }
    
    let file = match file_repo.get_file_by_id(&file_id).await {
        Ok(Some(file)) => file,
        Ok(None) => return Err(error::ErrorNotFound("File not found").into()),
        Err(e) => return Err(error::ErrorInternalServerError(format!("Failed to retrieve file: {}", e)).into()),
    };
    
    let thumbnail_data = match s3_repo.get_thumbnail(&file_id, &file.thumbnail_filename, size).await {
        Ok(data) => data,
        Err(e) => return Err(error::ErrorInternalServerError(format!("Failed to retrieve thumbnail: {}", e)).into()),
    };
    
    let content_type = if file.thumbnail_filename.ends_with(".png") {
        "image/png"
    } else if file.thumbnail_filename.ends_with(".gif") {
        "image/gif"
    } else if file.thumbnail_filename.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg" // Default
    };
    
    Ok(HttpResponse::Ok()
        .content_type(content_type)
        .body(thumbnail_data))
}

pub async fn check_file_exists(
    req: HttpRequest,
    request: web::Json<FileCheckRequest>,
    file_repo: web::Data<FileRepository>,
) -> Result<HttpResponse, Error> {
    if request.md5_hash.is_empty() {
        return Err(error::ErrorBadRequest("MD5 hash is required").into());
    }
    
    match file_repo.get_file_by_md5_hash(&request.md5_hash).await {
        Ok(Some(file)) => {
            let response = FileCheckResponse {
                exists: true,
                file: Some(file),
            };
            Ok(HttpResponse::Ok().json(response))
        },
        Ok(None) => {
            let response = FileCheckResponse {
                exists: false,
                file: None,
            };
            Ok(HttpResponse::Ok().json(response))
        },
        Err(e) => {
            Err(error::ErrorInternalServerError(format!("Failed to check file existence: {}", e)).into())
        }
    }
}

pub async fn get_banned_hashes(
    req: HttpRequest,
    file_repo: web::Data<FileRepository>,
) -> Result<HttpResponse, Error> {
    match file_repo.get_banned_hashes().await {
        Ok(hashes) => {
            let response = BannedHashesResponse {
                data: hashes,
                updated_at: Utc::now(),
            };
            Ok(HttpResponse::Ok().json(response))
        },
        Err(e) => {
            Err(error::ErrorInternalServerError(format!("Failed to retrieve banned hashes: {}", e)).into())
        }
    }
}

pub async fn get_file_stats(
    req: HttpRequest,
    file_repo: web::Data<FileRepository>,
) -> Result<HttpResponse, Error> {
    match file_repo.get_file_stats().await {
        Ok(stats) => {
            Ok(HttpResponse::Ok().json(stats))
        },
        Err(e) => {
            Err(error::ErrorInternalServerError(format!("Failed to retrieve file statistics: {}", e)).into())
        }
    }
}

pub async fn purge_files(
    req: HttpRequest,
    request: web::Json<FilePurgeRequest>,
) -> Result<HttpResponse, Error> {
    if request.older_than_days < 30 {
        return Err(error::ErrorBadRequest("olderThanDays must be at least 30").into());
    }
    
    let response = FilePurgeResponse {
        task_id: Uuid::new_v4(),
        estimated_files_to_purge: 50000,
        estimated_space_to_free: 268435456, // 256MB
    };
    
    Ok(HttpResponse::Accepted().json(response))
}
