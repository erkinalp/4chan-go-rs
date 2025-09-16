use actix_web::{web, HttpResponse, Error, error};
use actix_multipart::{Field, Multipart};
use actix_web::http::header::ContentDisposition;
use chrono::Utc;
use futures::{StreamExt, TryStreamExt};
use image::{GenericImageView, ImageFormat};
use std::collections::HashMap;
use std::time::Instant;
use uuid::Uuid;
use std::path::Path;
use sha2::{Digest, Sha256};
use crate::config::Config;
use crate::models::file::{
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
use crate::utils;
use crate::services::malware_scanner::ClamAVScanner;
use crate::services::ThumbnailGenerator;
fn ext_matches_mime(ext: &str, mime: &str) -> bool {
    match mime {
        "image/jpeg" => matches!(ext, ".jpg" | ".jpeg"),
        "image/png" => ext == ".png",
        "image/gif" => ext == ".gif",
        "image/webp" => ext == ".webp",
        "video/mp4" => ext == ".mp4",
        "video/webm" => ext == ".webm",
        "application/pdf" => ext == ".pdf",
        "application/zip" => ext == ".zip",
        "application/x-7z-compressed" => ext == ".7z",
        _ => false,
    }
}
fn is_allowed_mime(mime: &str) -> bool {
    matches!(
        mime,
        "image/jpeg" | "image/png" | "image/gif" | "image/webp" |
        "video/mp4" | "video/webm" | "application/pdf" |
        "application/zip" | "application/x-7z-compressed"
    )
}
fn looks_executable(mime: &str) -> bool {
    mime.starts_with("application/x-executable")
        || mime == "application/x-dosexec"
        || mime == "application/x-mach-binary"
        || mime == "application/x-sharedlib"
}



pub async fn upload_file(
    multipart: Multipart,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>,
    config: web::Data<Config>,
    scanner: web::Data<ClamAVScanner>,
    thumbnail_gen: web::Data<ThumbnailGenerator>
) -> Result<HttpResponse, Error> {
    let start_time = Instant::now();
    let mut file_data = Vec::new();
    let mut filename = String::new();
    let mut content_type = String::new();
    let mut is_spoiler = false;
    
    let mut multipart = multipart;
    
    while let Some(item) = multipart.next().await {
        let mut field = item?;
        
        let content_disposition = field.content_disposition().clone();
        
        let field_name = content_disposition.get_name()
            .ok_or_else(|| error::ErrorBadRequest("Field name is missing"))?;
        
        match field_name {
            "file" => {
                filename = content_disposition.get_filename()
                    .ok_or_else(|| error::ErrorBadRequest("Filename is missing"))?
                    .to_string();
                
                content_type = field.content_type().map_or(
                    "application/octet-stream".to_string(),
                    |ct| ct.to_string()
                );
                
                while let Some(chunk) = field.next().await {
                    let data = chunk?;
                    file_data.extend_from_slice(&data);
                }
            },
            "is_spoiler" => {
                let mut value = String::new();
                while let Some(chunk) = field.next().await {
                    let data = chunk?;
                    value.extend(std::str::from_utf8(&data).unwrap_or_default().chars());
                }
                is_spoiler = value == "true";
            },
            _ => {
                while let Some(_) = field.next().await {}
            }
        }
    }
    
    if file_data.is_empty() {
        return Err(error::ErrorBadRequest("No file data provided"));
    }

    if !is_allowed_mime(&content_type) {
        return Err(error::ErrorBadRequest("Unsupported file type"));
    }

    let ext = Path::new(&filename)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| format!(".{}", s.to_lowercase()))
        .unwrap_or_default();

    if !ext_matches_mime(&ext, &content_type) {
        return Err(error::ErrorBadRequest("File extension does not match MIME"));
    }

    if looks_executable(&content_type) {
        return Err(error::ErrorBadRequest("Executable files are not allowed"));
    }

    let sha256_hash = {
        let mut hasher = Sha256::new();
        hasher.update(&file_data);
        format!("{:x}", hasher.finalize())
    };

    if scanner.get_ref().scan_bytes(&file_data).await.map_err(|e| error::ErrorInternalServerError(format!("Scanner error: {}", e)))? {
        return Err(error::ErrorBadRequest("Malicious content detected"));
    }

    if file_data.len() > config.files.max_size as usize {
        return Err(error::ErrorBadRequest(format!(
            "File too large. Maximum size is {} bytes",
            config.files.max_size
        )));
    }
    
    let md5_hash = format!("{:x}", md5::compute(&file_data));
    
    if file_repo.get_ref().is_hash_banned(&md5_hash).await.map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))? {
        return Err(error::ErrorBadRequest("This file has been banned"));
    }
    
    if let Some(existing_file) = file_repo.get_ref().get_file_by_md5_hash(&md5_hash).await.map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))? {
        let upload_duration = start_time.elapsed().as_millis() as i32;
        
        let response = FileUploadResponse {
            id: existing_file.id,
            file_url: existing_file.file_url,
            thumbnail_url: existing_file.thumbnail_url,
            filename: existing_file.filename,
            filesize: existing_file.filesize,
            width: existing_file.width,
            height: existing_file.height,
            mime_type: existing_file.mime_type,
            md5_hash: existing_file.md5_hash,
            is_spoilered: existing_file.is_spoilered,
            upload_duration: Some(upload_duration),
        };
        
        return Ok(HttpResponse::Ok().json(response));
    }
    
    let (width, height) = if content_type.starts_with("image/") {
        match image::load_from_memory(&file_data) {
            Ok(img) => {
                let dimensions = img.dimensions();
                (Some(dimensions.0 as i32), Some(dimensions.1 as i32))
            },
            Err(_) => (None, None)
        }
    } else {
        (None, None)
    };
    
    let file_id = uuid::Uuid::new_v4();
    
    // Generate thumbnails for images
    let thumbnail_data = if content_type.starts_with("image/") && thumbnail_gen.is_image_format_supported(&content_type) {
        match thumbnail_gen.generate_thumbnail(&file_data, "small") {
            Ok(thumb_data) => Some(thumb_data),
            Err(e) => {
                log::warn!("Failed to generate thumbnail: {}", e);
                None
            }
        }
    } else if content_type.starts_with("video/") {
        match thumbnail_gen.generate_video_thumbnail(&file_data) {
            Ok(thumb_data) => Some(thumb_data),
            Err(e) => {
                log::warn!("Failed to generate video thumbnail: {}", e);
                None
            }
        }
    } else {
        None
    };
    
    let (file_url, thumbnail_url) = s3_repo.get_ref().upload_file_with_thumbnail(
        &file_id,
        &file_data,
        &filename,
        &content_type,
        thumbnail_data.as_deref()
    ).await.map_err(|e| error::ErrorInternalServerError(format!("S3 error: {}", e)))?;
    
    let file = File {
        id: file_id,
        filename,
        stored_filename: Some(file_url.clone()),
        filesize: file_data.len() as i64,
        width,
        height,
        thumbnail_filename: Some(thumbnail_url.clone()),
        mime_type: content_type.clone(),
        md5_hash: md5_hash.clone(),
        sha256_hash: Some(sha256_hash.clone()),
        is_spoilered: is_spoiler,
        created_at: Utc::now(),
        post_id: None,
        file_url: file_url.clone(),
        thumbnail_url: thumbnail_url.clone(),
    };
    
    if let Err(e) = file_repo.get_ref().create_file(&file).await {
        let _ = s3_repo.get_ref().delete_file(&file_id, &Some(file_url)).await;
        return Err(error::ErrorInternalServerError(format!("Failed to save file metadata: {}", e)));
    }
    
    let upload_duration = start_time.elapsed().as_millis() as i32;
    
    let response = FileUploadResponse {
        id: file.id,
        file_url,
        thumbnail_url,
        filename: file.filename,
        filesize: file.filesize,
        width: file.width,
        height: file.height,
        mime_type: file.mime_type,
        md5_hash,
        is_spoilered: is_spoiler,
        upload_duration: Some(upload_duration),
    };
    
    Ok(HttpResponse::Ok().json(response))
}

pub async fn get_file_info(
    path: web::Path<String>,
    file_repo: web::Data<FileRepository>
) -> Result<HttpResponse, Error> {
    let file_id = uuid::Uuid::parse_str(&path.into_inner())
        .map_err(|_| error::ErrorBadRequest("Invalid file ID"))?;
    
    let file = file_repo.get_ref().get_file_by_id(&file_id).await
        .map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?
        .ok_or_else(|| error::ErrorNotFound("File not found"))?;
    
    Ok(HttpResponse::Ok().json(file))
}

pub async fn delete_file(
    path: web::Path<String>,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>
) -> Result<HttpResponse, Error> {
    let file_id = uuid::Uuid::parse_str(&path.into_inner())
        .map_err(|_| error::ErrorBadRequest("Invalid file ID"))?;
    
    let file = file_repo.get_ref().get_file_by_id(&file_id).await
        .map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?
        .ok_or_else(|| error::ErrorNotFound("File not found"))?;
    
    s3_repo.get_ref().delete_file(&file_id, &file.stored_filename).await
        .map_err(|e| error::ErrorInternalServerError(format!("S3 error: {}", e)))?;
    
    file_repo.get_ref().delete_file(&file_id).await
        .map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?;
    
    Ok(HttpResponse::NoContent().finish())
}

pub async fn get_file_content(
    path: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>
) -> Result<HttpResponse, Error> {
    let file_id = uuid::Uuid::parse_str(&path.into_inner())
        .map_err(|_| error::ErrorBadRequest("Invalid file ID"))?;
    
    let file = file_repo.get_ref().get_file_by_id(&file_id).await
        .map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?
        .ok_or_else(|| error::ErrorNotFound("File not found"))?;
    
    let download = query.get("download").map_or(false, |v| v == "true");
    
    if download {
        let url = s3_repo.get_ref().get_presigned_url(
            &file.stored_filename.as_ref().unwrap_or(&String::new()),
            3600 // 1 hour
        ).await.map_err(|e| error::ErrorInternalServerError(format!("S3 error: {}", e)))?;
        
        return Ok(HttpResponse::TemporaryRedirect()
            .append_header(("Location", url))
            .finish());
    } else {
        let data = s3_repo.get_ref().get_file(&file_id, &file.stored_filename).await
            .map_err(|e| error::ErrorInternalServerError(format!("S3 error: {}", e)))?;
        
        let mut response = HttpResponse::Ok();
        response.content_type(file.mime_type.clone());
        
        Ok(response.body(data))
    }
}

pub async fn get_thumbnail(
    path: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>,
    thumbnail_gen: web::Data<ThumbnailGenerator>
) -> Result<HttpResponse, Error> {
    let file_id = uuid::Uuid::parse_str(&path.into_inner())
        .map_err(|_| error::ErrorBadRequest("Invalid file ID"))?;
    
    let file = file_repo.get_ref().get_file_by_id(&file_id).await
        .map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?
        .ok_or_else(|| error::ErrorNotFound("File not found"))?;
    
    let size = query.get("size").unwrap_or(&"small".to_string()).to_string();
    
    // Try to get existing thumbnail first
    match s3_repo.get_ref().get_thumbnail(&file_id, &file.thumbnail_filename, &size).await {
        Ok(data) => {
            let mut response = HttpResponse::Ok();
            let thumbnail_type = if file.mime_type.starts_with("image/") {
                "image/jpeg".to_string()
            } else {
                "image/jpeg".to_string()
            };
            response.content_type(thumbnail_type);
            Ok(response.body(data))
        },
        Err(_) => {
            // Generate thumbnail on-demand if it doesn't exist
            if file.mime_type.starts_with("image/") && thumbnail_gen.is_image_format_supported(&file.mime_type) {
                // Get original file data
                let original_data = s3_repo.get_ref().get_file(&file_id, &file.stored_filename).await
                    .map_err(|e| error::ErrorInternalServerError(format!("S3 error: {}", e)))?;
                
                // Generate thumbnail
                let thumbnail_data = thumbnail_gen.generate_thumbnail(&original_data, &size)
                    .map_err(|e| error::ErrorInternalServerError(format!("Thumbnail generation error: {}", e)))?;
                
                let mut response = HttpResponse::Ok();
                response.content_type("image/jpeg");
                Ok(response.body(thumbnail_data))
            } else {
                Err(error::ErrorNotFound("Thumbnail not available for this file type"))
            }
        }
    }
}

pub async fn check_file_exists(
    request: web::Json<FileCheckRequest>,
    file_repo: web::Data<FileRepository>
) -> Result<HttpResponse, Error> {
    let md5_hash = &request.md5_hash;
    
    let file = file_repo.get_ref().get_file_by_md5_hash(md5_hash).await
        .map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?;
    
    let response = FileCheckResponse {
        exists: file.is_some(),
        file,
    };
    
    Ok(HttpResponse::Ok().json(response))
}

pub async fn get_banned_hashes(
    file_repo: web::Data<FileRepository>
) -> Result<HttpResponse, Error> {
    let hashes = file_repo.get_ref().get_banned_hashes().await
        .map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?;
    
    let response = BannedHashesResponse {
        data: hashes,
        updated_at: Utc::now(),
    };
    
    Ok(HttpResponse::Ok().json(response))
}

pub async fn get_file_stats(
    file_repo: web::Data<FileRepository>
) -> Result<HttpResponse, Error> {
    let stats = file_repo.get_ref().get_file_stats().await
        .map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?;
    
    Ok(HttpResponse::Ok().json(stats))
}

pub async fn purge_files(
    request: web::Json<FilePurgeRequest>,
    s3_repo: web::Data<S3Repository>,
    file_repo: web::Data<FileRepository>
) -> Result<HttpResponse, Error> {
    let task_id = uuid::Uuid::new_v4();
    
    let except_board_ids = if let Some(board_ids) = request.except_board_ids.as_ref() {
        let uuid_board_ids: Result<Vec<Uuid>, _> = board_ids.iter()
            .map(|id| Uuid::parse_str(id))
            .collect();
        
        match uuid_board_ids {
            Ok(ids) => Some(ids),
            Err(e) => return Err(error::ErrorBadRequest(format!("Invalid board ID: {}", e)))
        }
    } else {
        None
    };
    
    let (estimated_files, estimated_size) = file_repo.get_ref().estimate_purge(
        request.older_than_days,
        request.mime_types.as_ref(),
        except_board_ids.as_ref()
    ).await.map_err(|e| error::ErrorInternalServerError(format!("Database error: {}", e)))?;
    
    if !request.dry_run {
        let older_than_days = request.older_than_days;
        let mime_types = request.mime_types.clone();
        let except_board_ids_clone = except_board_ids.clone();
        let s3_repo_clone = s3_repo.clone();
        let file_repo_clone = file_repo.clone();
        
        tokio::spawn(async move {
            let _ = file_repo_clone.get_ref().purge_files(
                older_than_days,
                mime_types.as_ref(),
                except_board_ids_clone.as_ref(),
                Some(s3_repo_clone.get_ref())
            ).await;
        });
    }
    
    let response = FilePurgeResponse {
        task_id,
        estimated_files_to_purge: estimated_files,
        estimated_space_to_free: estimated_size,
    };
    
    Ok(HttpResponse::Ok().json(response))
}
