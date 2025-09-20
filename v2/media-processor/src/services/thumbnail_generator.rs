use image::{ImageFormat, DynamicImage, GenericImageView, imageops::FilterType};
use std::io::Cursor;
use anyhow::{Result, Context};

pub struct ThumbnailGenerator {
    pub small_size: (u32, u32),
    pub medium_size: (u32, u32),
    pub large_size: (u32, u32),
}

impl Default for ThumbnailGenerator {
    fn default() -> Self {
        Self {
            small_size: (150, 150),
            medium_size: (300, 300),
            large_size: (500, 500),
        }
    }
}

impl ThumbnailGenerator {
    pub fn new(small: (u32, u32), medium: (u32, u32), large: (u32, u32)) -> Self {
        Self {
            small_size: small,
            medium_size: medium,
            large_size: large,
        }
    }

    pub fn generate_thumbnail(&self, image_data: &[u8], size: &str) -> Result<Vec<u8>> {
        let img = image::load_from_memory(image_data)
            .context("Failed to load image from memory")?;

        let target_size = match size {
            "small" => self.small_size,
            "medium" => self.medium_size,
            "large" => self.large_size,
            _ => self.small_size,
        };

        let thumbnail = self.resize_image(&img, target_size)?;
        
        let mut buffer = Vec::new();
        let mut cursor = Cursor::new(&mut buffer);
        
        thumbnail.write_to(&mut cursor, ImageFormat::Jpeg)
            .context("Failed to write thumbnail to buffer")?;

        Ok(buffer)
    }

    pub fn generate_all_thumbnails(&self, image_data: &[u8]) -> Result<(Vec<u8>, Vec<u8>, Vec<u8>)> {
        let img = image::load_from_memory(image_data)
            .context("Failed to load image from memory")?;

        let small_thumb = self.resize_image(&img, self.small_size)?;
        let medium_thumb = self.resize_image(&img, self.medium_size)?;
        let large_thumb = self.resize_image(&img, self.large_size)?;

        let small_data = self.image_to_bytes(&small_thumb)?;
        let medium_data = self.image_to_bytes(&medium_thumb)?;
        let large_data = self.image_to_bytes(&large_thumb)?;

        Ok((small_data, medium_data, large_data))
    }

    fn resize_image(&self, img: &DynamicImage, target_size: (u32, u32)) -> Result<DynamicImage> {
        let (width, height) = img.dimensions();
        let (target_width, target_height) = target_size;

        // Calculate aspect ratio preserving dimensions
        let aspect_ratio = width as f32 / height as f32;
        let target_aspect_ratio = target_width as f32 / target_height as f32;

        let (new_width, new_height) = if aspect_ratio > target_aspect_ratio {
            // Image is wider than target, fit by width
            let new_width = target_width;
            let new_height = (target_width as f32 / aspect_ratio) as u32;
            (new_width, new_height)
        } else {
            // Image is taller than target, fit by height
            let new_height = target_height;
            let new_width = (target_height as f32 * aspect_ratio) as u32;
            (new_width, new_height)
        };

        // Ensure minimum size of 1x1
        let new_width = new_width.max(1);
        let new_height = new_height.max(1);

        Ok(img.resize(new_width, new_height, FilterType::Lanczos3))
    }

    fn image_to_bytes(&self, img: &DynamicImage) -> Result<Vec<u8>> {
        let mut buffer = Vec::new();
        let mut cursor = Cursor::new(&mut buffer);
        
        img.write_to(&mut cursor, ImageFormat::Jpeg)
            .context("Failed to write image to buffer")?;

        Ok(buffer)
    }

    pub fn is_image_format_supported(&self, mime_type: &str) -> bool {
        matches!(
            mime_type,
            "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/bmp" | "image/tiff"
        )
    }

    pub fn generate_video_thumbnail(&self, _video_data: &[u8]) -> Result<Vec<u8>> {
        // For now, return a placeholder thumbnail for videos
        // In a full implementation, this would use ffmpeg or similar
        let placeholder = image::RgbImage::new(self.small_size.0, self.small_size.1);
        let img = DynamicImage::ImageRgb8(placeholder);
        self.image_to_bytes(&img)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thumbnail_generator_creation() {
        let generator = ThumbnailGenerator::default();
        assert_eq!(generator.small_size, (150, 150));
        assert_eq!(generator.medium_size, (300, 300));
        assert_eq!(generator.large_size, (500, 500));
    }

    #[test]
    fn test_image_format_support() {
        let generator = ThumbnailGenerator::default();
        assert!(generator.is_image_format_supported("image/jpeg"));
        assert!(generator.is_image_format_supported("image/png"));
        assert!(!generator.is_image_format_supported("video/mp4"));
    }
}

