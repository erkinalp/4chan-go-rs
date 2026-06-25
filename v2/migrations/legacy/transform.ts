import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/**
 * Transform MySQL export CSVs to PostgreSQL-compatible format.
 *
 * Maps legacy 4chan MySQL schema to the v2 PostgreSQL schema:
 * - Board configs → boards table
 * - Thread/post IDs → UUID-based references
 * - File references → S3/MinIO object keys
 * - Timestamps → ISO 8601 format
 */

interface Board {
  id: string;
  slug: string;
  title: string;
  description: string;
  is_sfw: boolean;
  max_filesize: number;
  max_pages: number;
  threads_per_page: number;
  bump_limit: number;
  image_limit: number;
  post_cooldown: number;
  created_at: string;
  updated_at: string;
}

interface Thread {
  id: string;
  board_id: string;
  subject: string;
  message: string;
  author_name: string;
  tripcode: string;
  sticky: boolean;
  closed: boolean;
  archived: boolean;
  last_bumped_at: string;
  reply_count: number;
  image_count: number;
  unique_ips: number;
  created_at: string;
}

interface Post {
  id: string;
  thread_id: string;
  board_id: string;
  message: string;
  author_name: string;
  tripcode: string;
  capcode: string;
  country: string;
  country_name: string;
  created_at: string;
}

interface FileRecord {
  id: string;
  post_id: string;
  board_id: string;
  stored_filename: string;
  original_filename: string;
  extension: string;
  file_size: number;
  md5: string;
  width: number;
  height: number;
  thumb_width: number;
  thumb_height: number;
  spoiler: boolean;
  deleted: boolean;
}

interface Ban {
  id: string;
  board_id: string;
  ip: string;
  banned_name: string;
  reason: string;
  banned_by: string;
  duration_seconds: number;
  is_global: boolean;
  created_at: string;
  expires_at: string;
}

const INPUT_DIR = process.env.INPUT_DIR || '/tmp/migration_export';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/migration_import';

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function escapePgCopy(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function boolToStr(val: string | boolean): string {
  if (typeof val === 'boolean') return val ? 't' : 'f';
  return val === '1' || val === 'true' ? 't' : 'f';
}

function generateUUID(legacyId: string, namespace: string): string {
  // Deterministic UUID generation based on legacy ID for reproducibility
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(`${namespace}:${legacyId}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

async function processFile(
  inputFile: string,
  outputFile: string,
  transformer: (fields: string[]) => string | null
): Promise<number> {
  const inputPath = path.join(INPUT_DIR, inputFile);
  const outputPath = path.join(OUTPUT_DIR, outputFile);

  if (!fs.existsSync(inputPath)) {
    console.warn(`Input file not found: ${inputPath}`);
    return 0;
  }

  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  const rl = readline.createInterface({ input });

  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    const transformed = transformer(fields);
    if (transformed) {
      output.write(transformed + '\n');
      count++;
    }
  }

  output.end();
  return count;
}

async function transformBoards(): Promise<number> {
  return processFile('boards.csv', 'boards.copy', (fields) => {
    const uuid = generateUUID(fields[0], 'board');
    return [
      uuid,
      escapePgCopy(fields[1]), // slug
      escapePgCopy(fields[2]), // title
      escapePgCopy(fields[3] || ''), // description
      boolToStr(fields[4]), // is_sfw
      fields[5] || '4194304', // max_filesize
      fields[6] || '10', // max_pages
      fields[7] || '15', // threads_per_page
      fields[8] || '300', // bump_limit
      fields[9] || '150', // image_limit
      fields[10] || '30', // post_cooldown
      fields[11] || new Date().toISOString(), // created_at
      fields[12] || new Date().toISOString(), // updated_at
    ].join('\t');
  });
}

async function transformThreads(): Promise<number> {
  return processFile('threads.csv', 'threads.copy', (fields) => {
    const uuid = generateUUID(fields[0], 'thread');
    const boardUuid = generateUUID(fields[1], 'board');
    return [
      uuid,
      boardUuid,
      escapePgCopy(fields[2] || ''), // subject
      escapePgCopy(fields[3] || ''), // message
      escapePgCopy(fields[4] || 'Anonymous'), // author_name
      escapePgCopy(fields[5] || ''), // tripcode
      boolToStr(fields[6]), // sticky
      boolToStr(fields[7]), // closed
      boolToStr(fields[8]), // archived
      fields[9] || '\\N', // last_bumped_at
      fields[10] || '0', // reply_count
      fields[11] || '0', // image_count
      fields[12] || '0', // unique_ips
      fields[13] || new Date().toISOString(), // created_at
    ].join('\t');
  });
}

async function transformPosts(): Promise<number> {
  return processFile('posts.csv', 'posts.copy', (fields) => {
    const uuid = generateUUID(fields[0], 'post');
    const threadUuid = generateUUID(fields[1], 'thread');
    const boardUuid = generateUUID(fields[2], 'board');
    return [
      uuid,
      threadUuid,
      boardUuid,
      escapePgCopy(fields[3] || ''), // message
      escapePgCopy(fields[4] || 'Anonymous'), // author_name
      escapePgCopy(fields[5] || ''), // tripcode
      escapePgCopy(fields[6] || ''), // capcode
      escapePgCopy(fields[7] || ''), // country
      escapePgCopy(fields[8] || ''), // country_name
      fields[9] || new Date().toISOString(), // created_at
    ].join('\t');
  });
}

async function transformFiles(): Promise<number> {
  return processFile('files.csv', 'files.copy', (fields) => {
    const uuid = generateUUID(fields[0], 'file');
    const postUuid = generateUUID(fields[1], 'post');
    const boardUuid = generateUUID(fields[2], 'board');
    const storedFilename = fields[3];
    const ext = fields[5];
    // Map to S3 key: boards/<board_slug>/<stored_filename><ext>
    const s3Key = `legacy/${boardUuid}/${storedFilename}${ext}`;
    const thumbnailKey = `legacy/${boardUuid}/thumbs/${storedFilename}s.jpg`;

    return [
      uuid,
      postUuid,
      boardUuid,
      escapePgCopy(s3Key), // storage_key
      escapePgCopy(thumbnailKey), // thumbnail_key
      escapePgCopy(fields[4] || 'unnamed'), // original_filename
      escapePgCopy(ext), // extension
      fields[6] || '0', // file_size
      escapePgCopy(fields[7] || ''), // md5
      fields[8] || '0', // width
      fields[9] || '0', // height
      fields[10] || '0', // thumb_width
      fields[11] || '0', // thumb_height
      boolToStr(fields[12]), // spoiler
      boolToStr(fields[13]), // deleted
    ].join('\t');
  });
}

async function transformBans(): Promise<number> {
  return processFile('bans.csv', 'bans.copy', (fields) => {
    const uuid = generateUUID(fields[0], 'ban');
    const boardUuid = fields[1] ? generateUUID(fields[1], 'board') : '\\N';
    return [
      uuid,
      boardUuid,
      escapePgCopy(fields[2] || ''), // ip_hash (will be hashed during import)
      escapePgCopy(fields[3] || ''), // banned_name
      escapePgCopy(fields[4] || ''), // reason
      escapePgCopy(fields[5] || 'system'), // banned_by
      fields[6] || '0', // duration_seconds
      boolToStr(fields[7]), // is_global
      fields[8] || new Date().toISOString(), // created_at
      fields[9] || '\\N', // expires_at
    ].join('\t');
  });
}

async function main(): Promise<void> {
  console.log('=== Legacy MySQL → PostgreSQL Transform ===');
  console.log(`Input:  ${INPUT_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('');

  ensureOutputDir();

  const results = await Promise.all([
    transformBoards(),
    transformThreads(),
    transformPosts(),
    transformFiles(),
    transformBans(),
  ]);

  const labels = ['Boards', 'Threads', 'Posts', 'Files', 'Bans'];
  labels.forEach((label, i) => {
    console.log(`  ${label}: ${results[i]} rows transformed`);
  });

  console.log('\nTransformation complete.');
  console.log(`Output files ready for PostgreSQL COPY in: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Transform failed:', err);
  process.exit(1);
});
