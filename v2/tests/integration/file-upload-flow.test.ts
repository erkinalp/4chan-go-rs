import { createClient, registerUser, randomString } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

describe('File Upload Flow Integration', () => {
  let token: string;
  let fileId: string;
  let thumbnailUrl: string;

  beforeAll(async () => {
    const user = await registerUser(`upload_${randomString()}`, 'UploadPass123!');
    token = user.token;
  });

  it('should upload a file', async () => {
    const client = createClient(token);

    // Create a minimal valid PNG (1x1 pixel, red)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BHwAI/AL+hc2rNAAAAABJRU5ErkJggg==',
      'base64'
    );
    const tmpFile = path.join('/tmp', `upload_test_${randomString()}.png`);
    fs.writeFileSync(tmpFile, pngBuffer);

    const form = new FormData();
    form.append('file', fs.createReadStream(tmpFile), {
      filename: 'test-upload.png',
      contentType: 'image/png',
    });

    const res = await client.post('/files/upload', form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('id');
    expect(res.data).toHaveProperty('filename');
    expect(res.data).toHaveProperty('mimeType');
    expect(res.data).toHaveProperty('size');
    expect(res.data.mimeType).toBe('image/png');

    fileId = res.data.id;
    fs.unlinkSync(tmpFile);
  });

  it('should verify file metadata', async () => {
    const client = createClient(token);
    const res = await client.get(`/files/${fileId}`);

    expect(res.status).toBe(200);
    expect(res.data.id).toBe(fileId);
    expect(res.data.mimeType).toBe('image/png');
    expect(res.data.size).toBeGreaterThan(0);
    expect(res.data).toHaveProperty('md5');
    expect(res.data).toHaveProperty('sha256');
    expect(res.data).toHaveProperty('uploadedAt');
  });

  it('should verify thumbnail was generated', async () => {
    const client = createClient(token);
    const res = await client.get(`/files/${fileId}`);

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('thumbnailUrl');
    expect(res.data.thumbnailUrl).toBeTruthy();
    thumbnailUrl = res.data.thumbnailUrl;
  });

  it('should download the original file', async () => {
    const client = createClient(token);
    const res = await client.get(`/files/${fileId}/download`, {
      responseType: 'arraybuffer',
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.data.byteLength).toBeGreaterThan(0);
  });

  it('should download the thumbnail', async () => {
    const client = createClient();
    // Thumbnails are typically public
    const res = await client.get(thumbnailUrl, {
      responseType: 'arraybuffer',
    });

    expect(res.status).toBe(200);
    expect(res.data.byteLength).toBeGreaterThan(0);
  });
});
