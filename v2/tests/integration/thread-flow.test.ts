import { createClient, registerUser, randomString } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

describe('Thread Flow Integration', () => {
  let token: string;
  let boardId: string;
  let threadId: string;

  beforeAll(async () => {
    const user = await registerUser(`user_${randomString()}`, 'TestPass123!');
    token = user.token;
  });

  it('should create a board', async () => {
    const client = createClient(token);
    const res = await client.post('/boards', {
      slug: `test-${randomString()}`,
      title: 'Integration Test Board',
      description: 'Board for integration testing',
      nsfw: false,
    });

    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('id');
    expect(res.data.title).toBe('Integration Test Board');
    boardId = res.data.id;
  });

  it('should create a thread with an image', async () => {
    const client = createClient(token);

    // Create a minimal PNG for upload
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const tmpFile = path.join('/tmp', `test_${randomString()}.png`);
    fs.writeFileSync(tmpFile, pngBuffer);

    const form = new FormData();
    form.append('subject', 'Test Thread Subject');
    form.append('message', 'This is the opening post of our test thread.');
    form.append('file', fs.createReadStream(tmpFile), {
      filename: 'test-image.png',
      contentType: 'image/png',
    });

    const res = await client.post(`/boards/${boardId}/threads`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('id');
    expect(res.data.subject).toBe('Test Thread Subject');
    threadId = res.data.id;

    fs.unlinkSync(tmpFile);
  });

  it('should verify thread appears in board listing', async () => {
    const client = createClient(token);
    const res = await client.get(`/boards/${boardId}/threads`);

    expect(res.status).toBe(200);
    expect(res.data.threads).toBeInstanceOf(Array);

    const found = res.data.threads.find((t: { id: string }) => t.id === threadId);
    expect(found).toBeDefined();
    expect(found.subject).toBe('Test Thread Subject');
  });

  it('should create a reply in the thread', async () => {
    const client = createClient(token);
    const res = await client.post(`/threads/${threadId}/posts`, {
      message: 'This is a reply to the test thread.',
    });

    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('id');
    expect(res.data.message).toContain('reply to the test thread');
  });

  it('should verify reply appears in thread', async () => {
    const client = createClient(token);
    const res = await client.get(`/threads/${threadId}`);

    expect(res.status).toBe(200);
    expect(res.data.posts).toBeInstanceOf(Array);
    expect(res.data.posts.length).toBeGreaterThanOrEqual(2); // OP + reply

    const reply = res.data.posts.find(
      (p: { message: string }) => p.message.includes('reply to the test thread')
    );
    expect(reply).toBeDefined();
  });
});
