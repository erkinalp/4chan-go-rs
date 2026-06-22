import { createClient, registerUser, randomString } from '../integration/helpers';

describe('Rate Limiting Tests', () => {
  let token: string;

  beforeAll(async () => {
    const user = await registerUser(`ratelimit_${randomString()}`, 'RateLimit123!');
    token = user.token;
  });

  it('should enforce rate limiting on login attempts', async () => {
    const client = createClient();
    let rateLimited = false;

    // Attempt many rapid login requests
    for (let i = 0; i < 50; i++) {
      const res = await client.post('/auth/login', {
        username: `nonexistent_user_${i}`,
        password: 'wrongpass',
      });

      if (res.status === 429) {
        rateLimited = true;
        expect(res.headers).toHaveProperty('retry-after');
        break;
      }
    }

    expect(rateLimited).toBe(true);
  });

  it('should enforce rate limiting on post creation', async () => {
    const client = createClient(token);
    let rateLimited = false;

    // Create a board and thread first
    const boardRes = await client.post('/boards', {
      slug: `rl-test-${randomString()}`,
      title: 'Rate Limit Board',
      description: 'Testing rate limits',
      nsfw: false,
    });
    const boardId = boardRes.data.id;

    const threadRes = await client.post(`/boards/${boardId}/threads`, {
      subject: 'Rate Limit Thread',
      message: 'Testing post rate limit.',
    });
    const threadId = threadRes.data.id;

    // Rapidly create posts
    for (let i = 0; i < 100; i++) {
      const res = await client.post(`/threads/${threadId}/posts`, {
        message: `Rapid post ${i}`,
      });

      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }

    expect(rateLimited).toBe(true);
  });

  it('should enforce rate limiting on file uploads', async () => {
    const client = createClient(token);
    let rateLimited = false;

    for (let i = 0; i < 30; i++) {
      const res = await client.post('/files/upload', {});

      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }

    expect(rateLimited).toBe(true);
  });

  it('should enforce rate limiting on registration', async () => {
    const client = createClient();
    let rateLimited = false;

    for (let i = 0; i < 20; i++) {
      const res = await client.post('/auth/register', {
        username: `spam_user_${randomString()}`,
        password: 'SpamPass123!',
        email: `spam_${randomString()}@test.local`,
      });

      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }

    expect(rateLimited).toBe(true);
  });

  it('should include rate limit headers in responses', async () => {
    const client = createClient(token);
    const res = await client.get('/boards');

    // Standard rate limit headers
    const hasRateLimitHeaders =
      res.headers['x-ratelimit-limit'] !== undefined ||
      res.headers['x-ratelimit-remaining'] !== undefined ||
      res.headers['ratelimit-limit'] !== undefined;

    expect(hasRateLimitHeaders).toBe(true);
  });
});
