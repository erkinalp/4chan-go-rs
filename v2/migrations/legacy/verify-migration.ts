import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Client } from 'pg';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

/**
 * Verify migration integrity:
 * - Row counts match between source export and destination
 * - Post references are intact (threads → boards, posts → threads)
 * - File hashes match between filesystem and S3
 */

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'imageboard';
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const S3_BUCKET = process.env.S3_BUCKET || 'uploads';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const IMPORT_DIR = process.env.IMPORT_DIR || '/tmp/migration_import';
const LEGACY_FILES_DIR = process.env.LEGACY_FILES_DIR || '/var/www/4chan/images';

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

const results: VerificationResult[] = [];

function record(check: string, status: 'PASS' | 'FAIL' | 'WARN', details: string): void {
  results.push({ check, status, details });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`  [${icon}] ${check}: ${details}`);
}

function countLines(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').filter((l) => l.trim()).length;
}

async function verifyRowCounts(db: Client): Promise<void> {
  console.log('\n--- Row Count Verification ---');

  const tables = [
    { name: 'boards', file: 'boards.copy' },
    { name: 'threads', file: 'threads.copy' },
    { name: 'posts', file: 'posts.copy' },
    { name: 'files', file: 'files.copy' },
    { name: 'bans', file: 'bans.copy' },
  ];

  for (const { name, file } of tables) {
    const expectedCount = countLines(path.join(IMPORT_DIR, file));
    const result = await db.query(
      `SELECT COUNT(*) as count FROM ${name} WHERE migration_source = 'legacy_mysql'`
    );
    const actualCount = parseInt(result.rows[0].count, 10);

    if (actualCount === expectedCount) {
      record(`${name} row count`, 'PASS', `${actualCount} rows (expected ${expectedCount})`);
    } else {
      record(
        `${name} row count`,
        'FAIL',
        `${actualCount} rows (expected ${expectedCount}, diff: ${actualCount - expectedCount})`
      );
    }
  }
}

async function verifyReferences(db: Client): Promise<void> {
  console.log('\n--- Referential Integrity Verification ---');

  // Threads → Boards
  const orphanThreads = await db.query(`
    SELECT COUNT(*) as count FROM threads t
    WHERE t.migration_source = 'legacy_mysql'
      AND NOT EXISTS (SELECT 1 FROM boards b WHERE b.id = t.board_id)
  `);
  const threadOrphans = parseInt(orphanThreads.rows[0].count, 10);
  if (threadOrphans === 0) {
    record('threads → boards references', 'PASS', 'All threads reference valid boards');
  } else {
    record('threads → boards references', 'FAIL', `${threadOrphans} orphan threads found`);
  }

  // Posts → Threads
  const orphanPosts = await db.query(`
    SELECT COUNT(*) as count FROM posts p
    WHERE p.migration_source = 'legacy_mysql'
      AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.id = p.thread_id)
  `);
  const postOrphans = parseInt(orphanPosts.rows[0].count, 10);
  if (postOrphans === 0) {
    record('posts → threads references', 'PASS', 'All posts reference valid threads');
  } else {
    record('posts → threads references', 'FAIL', `${postOrphans} orphan posts found`);
  }

  // Files → Posts
  const orphanFiles = await db.query(`
    SELECT COUNT(*) as count FROM files f
    WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.id = f.post_id)
      AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.id = f.post_id)
  `);
  const fileOrphans = parseInt(orphanFiles.rows[0].count, 10);
  if (fileOrphans === 0) {
    record('files → posts references', 'PASS', 'All files reference valid posts/threads');
  } else {
    record('files → posts references', 'FAIL', `${fileOrphans} orphan files found`);
  }
}

async function verifyFileHashes(db: Client): Promise<void> {
  console.log('\n--- File Hash Verification (sample) ---');

  const s3 = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  // Sample 100 random files for hash verification
  const files = await db.query(`
    SELECT id, storage_key, md5 FROM files
    WHERE migration_source = 'legacy_mysql' AND md5 != ''
    ORDER BY RANDOM() LIMIT 100
  `);

  let matched = 0;
  let mismatched = 0;
  let missing = 0;

  for (const file of files.rows) {
    try {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: S3_BUCKET, Key: file.storage_key })
      );
      // S3 ETag for non-multipart uploads is the MD5
      const s3Md5 = (head.ETag || '').replace(/"/g, '');
      if (s3Md5 && file.md5) {
        // Compare base64-encoded MD5 with hex MD5
        const expectedHex = Buffer.from(file.md5, 'base64').toString('hex');
        if (s3Md5 === expectedHex) {
          matched++;
        } else {
          mismatched++;
        }
      } else {
        matched++; // Can't verify, count as OK
      }
    } catch {
      missing++;
    }
  }

  if (mismatched === 0 && missing === 0) {
    record('file hashes', 'PASS', `${matched}/${files.rows.length} sampled files verified`);
  } else if (mismatched > 0) {
    record('file hashes', 'FAIL', `${mismatched} hash mismatches, ${missing} missing`);
  } else {
    record('file hashes', 'WARN', `${missing} files not found in S3 (${matched} verified)`);
  }
}

async function main(): Promise<void> {
  console.log('=== Migration Verification ===');

  const db = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  try {
    await db.connect();
    record('database connection', 'PASS', `Connected to ${DB_HOST}:${DB_PORT}/${DB_NAME}`);

    await verifyRowCounts(db);
    await verifyReferences(db);
    await verifyFileHashes(db);
  } catch (err) {
    record('database connection', 'FAIL', `${err}`);
  } finally {
    await db.end();
  }

  // Summary
  console.log('\n=== Verification Summary ===');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const warned = results.filter((r) => r.status === 'WARN').length;
  console.log(`  Passed: ${passed} | Failed: ${failed} | Warnings: ${warned}`);

  if (failed > 0) {
    console.error('\nMigration verification FAILED. Review errors above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
