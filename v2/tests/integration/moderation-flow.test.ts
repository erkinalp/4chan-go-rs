import { createClient, registerUser, randomString } from './helpers';

describe('Moderation Flow Integration', () => {
  let userToken: string;
  let modToken: string;
  let targetUserId: string;
  let boardId: string;
  let threadId: string;
  let postId: string;
  let reportId: string;

  beforeAll(async () => {
    // Register a regular user
    const user = await registerUser(`regular_${randomString()}`, 'UserPass123!');
    userToken = user.token;
    targetUserId = user.userId;

    // Register a moderator (assumes mod role assignment via separate endpoint)
    const mod = await registerUser(`mod_${randomString()}`, 'ModPass123!');
    modToken = mod.token;

    // Create test content
    const client = createClient(userToken);
    const boardRes = await client.post('/boards', {
      slug: `mod-test-${randomString()}`,
      title: 'Moderation Test Board',
      description: 'Board for moderation testing',
      nsfw: false,
    });
    boardId = boardRes.data.id;

    const threadRes = await client.post(`/boards/${boardId}/threads`, {
      subject: 'Thread to moderate',
      message: 'This post will be reported.',
    });
    threadId = threadRes.data.id;

    const postRes = await client.post(`/threads/${threadId}/posts`, {
      message: 'Offensive content that should be reported.',
    });
    postId = postRes.data.id;
  });

  it('should report a post', async () => {
    const client = createClient(userToken);
    const res = await client.post('/reports', {
      postId,
      threadId,
      reason: 'spam',
      description: 'This post contains spam content.',
    });

    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('id');
    reportId = res.data.id;
  });

  it('should allow moderator to review reports', async () => {
    const client = createClient(modToken);
    const res = await client.get('/mod/reports');

    expect(res.status).toBe(200);
    expect(res.data.reports).toBeInstanceOf(Array);

    const found = res.data.reports.find((r: { id: string }) => r.id === reportId);
    expect(found).toBeDefined();
    expect(found.reason).toBe('spam');
    expect(found.postId).toBe(postId);
  });

  it('should allow moderator to ban a user', async () => {
    const client = createClient(modToken);
    const res = await client.post('/mod/bans', {
      userId: targetUserId,
      reason: 'Spam violations',
      duration: 3600, // 1 hour in seconds
      boardId,
    });

    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('id');
    expect(res.data.userId).toBe(targetUserId);
  });

  it('should verify ban is active', async () => {
    const client = createClient(userToken);
    // Banned user trying to post should be rejected
    const res = await client.post(`/threads/${threadId}/posts`, {
      message: 'Attempting to post while banned.',
    });

    expect(res.status).toBe(403);
    expect(res.data.message).toMatch(/banned/i);
  });

  it('should allow moderator to unban a user', async () => {
    const client = createClient(modToken);
    const res = await client.delete(`/mod/bans/${targetUserId}`, {
      data: { boardId },
    });

    expect(res.status).toBe(200);
  });

  it('should verify user can post after unban', async () => {
    const client = createClient(userToken);
    const res = await client.post(`/threads/${threadId}/posts`, {
      message: 'Posting again after unban.',
    });

    expect(res.status).toBe(201);
    expect(res.data.message).toContain('after unban');
  });
});
