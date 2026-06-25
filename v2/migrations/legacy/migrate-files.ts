import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

/**
 * Migrate files from legacy filesystem storage to MinIO/S3 buckets.
 *
 * Reads the transformed file metadata and copies each file from the
 * legacy filesystem path to the appropriate S3 bucket with the new key.
 */

interface FileEntry {
  id: string;
  post_id: string;
  board_id: string;
  storage_key: string;
  thumbnail_key: string;
  original_filename: string;
  extension: string;
  file_size: number;
  md5: string;
}

const LEGACY_FILES_DIR = process.env.LEGACY_FILES_DIR || '/var/www/4chan/images';
const LEGACY_THUMBS_DIR = process.env.LEGACY_THUMBS_DIR || '/var/www/4chan/thumbs';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const S3_BUCKET = process.env.S3_BUCKET || 'uploads';
const S3_THUMB_BUCKET = process.env.S3_THUMB_BUCKET || 'thumbnails';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const IMPORT_DIR = process.env.IMPORT_DIR || '/tmp/migration_import';
const CONCURRENCY = parseInt(process.env.MIGRATION_CONCURRENCY || '10', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

interface MigrationStats {
  total: number;
  uploaded: number;
  skipped: number;
  errors: number;
  bytesTransferred: number;
}

function parseFilesMetadata(): FileEntry[] {
  const filePath = path.join(IMPORT_DIR, 'files.copy');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Files metadata not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const fields = line.split('\t');
      return {
        id: fields[0],
        post_id: fields[1],
        board_id: fields[2],
        storage_key: fields[3],
        thumbnail_key: fields[4],
        original_filename: fields[5],
        extension: fields[6],
        file_size: parseInt(fields[7], 10),
        md5: fields[8],
      };
    });
}

function getMimeType(extension: string): string {
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
}

function computeFileMD5(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('base64');
}

async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(
  localPath: string,
  bucket: string,
  key: string,
  contentType: string
): Promise<boolean> {
  if (!fs.existsSync(localPath)) {
    return false;
  }

  if (await objectExists(bucket, key)) {
    return false; // Skip, already exists
  }

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would upload: ${localPath} → s3://${bucket}/${key}`);
    return true;
  }

  const body = fs.readFileSync(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return true;
}

async function processEntry(entry: FileEntry, stats: MigrationStats): Promise<void> {
  const ext = entry.extension;
  const storedName = entry.storage_key.split('/').pop() || '';
  const legacyFilePath = path.join(LEGACY_FILES_DIR, storedName);
  const legacyThumbPath = path.join(
    LEGACY_THUMBS_DIR,
    storedName.replace(ext, 's.jpg')
  );

  try {
    // Upload original file
    const contentType = getMimeType(ext);
    const uploaded = await uploadFile(legacyFilePath, S3_BUCKET, entry.storage_key, contentType);

    if (uploaded) {
      stats.uploaded++;
      stats.bytesTransferred += entry.file_size;
    } else if (!fs.existsSync(legacyFilePath)) {
      stats.errors++;
    } else {
      stats.skipped++;
    }

    // Upload thumbnail
    if (fs.existsSync(legacyThumbPath)) {
      await uploadFile(legacyThumbPath, S3_THUMB_BUCKET, entry.thumbnail_key, 'image/jpeg');
    }
  } catch (err) {
    stats.errors++;
    console.error(`  Error processing ${entry.id}: ${err}`);
  }
}

async function processBatch(
  entries: FileEntry[],
  stats: MigrationStats,
  concurrency: number
): Promise<void> {
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    await Promise.all(batch.map((entry) => processEntry(entry, stats)));

    if ((i + concurrency) % 100 === 0 || i + concurrency >= entries.length) {
      const pct = Math.min(100, Math.round(((i + concurrency) / entries.length) * 100));
      console.log(
        `  Progress: ${pct}% (${stats.uploaded} uploaded, ${stats.skipped} skipped, ${stats.errors} errors)`
      );
    }
  }
}

async function main(): Promise<void> {
  console.log('=== File Migration: Filesystem → S3/MinIO ===');
  console.log(`Legacy files:  ${LEGACY_FILES_DIR}`);
  console.log(`Legacy thumbs: ${LEGACY_THUMBS_DIR}`);
  console.log(`S3 endpoint:   ${S3_ENDPOINT}`);
  console.log(`Buckets:       ${S3_BUCKET}, ${S3_THUMB_BUCKET}`);
  console.log(`Concurrency:   ${CONCURRENCY}`);
  console.log(`Dry run:       ${DRY_RUN}`);
  console.log('');

  const entries = parseFilesMetadata();
  console.log(`Found ${entries.length} files to migrate.`);

  const stats: MigrationStats = {
    total: entries.length,
    uploaded: 0,
    skipped: 0,
    errors: 0,
    bytesTransferred: 0,
  };

  await processBatch(entries, stats, CONCURRENCY);

  console.log('\n=== Migration Summary ===');
  console.log(`  Total files:    ${stats.total}`);
  console.log(`  Uploaded:       ${stats.uploaded}`);
  console.log(`  Skipped:        ${stats.skipped}`);
  console.log(`  Errors:         ${stats.errors}`);
  console.log(`  Bytes:          ${(stats.bytesTransferred / 1024 / 1024).toFixed(2)} MB`);

  if (stats.errors > 0) {
    console.error(`\nWarning: ${stats.errors} files failed to migrate.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('File migration failed:', err);
  process.exit(1);
});
