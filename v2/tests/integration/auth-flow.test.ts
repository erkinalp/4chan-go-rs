import { createClient, randomString } from './helpers';

describe('Auth Flow Integration', () => {
  const username = `auth_user_${randomString()}`;
  const password = 'SecurePass456!';
  let token: string;
  let refreshToken: string;
  let userId: string;

  it('should register a new user', async () => {
    const client = createClient();
    const res = await client.post('/auth/register', {
      username,
      password,
      email: `${username}@test.local`,
    });

    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('token');
    expect(res.data).toHaveProperty('refreshToken');
    expect(res.data).toHaveProperty('userId');

    token = res.data.token;
    refreshToken = res.data.refreshToken;
    userId = res.data.userId;
  });

  it('should login with registered credentials', async () => {
    const client = createClient();
    const res = await client.post('/auth/login', { username, password });

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('token');
    expect(res.data).toHaveProperty('refreshToken');

    token = res.data.token;
    refreshToken = res.data.refreshToken;
  });

  it('should access a protected endpoint with valid JWT', async () => {
    const client = createClient(token);
    const res = await client.get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.data.username).toBe(username);
    expect(res.data.id).toBe(userId);
  });

  it('should reject access without JWT', async () => {
    const client = createClient();
    const res = await client.get('/auth/me');

    expect(res.status).toBe(401);
  });

  it('should refresh the token', async () => {
    const client = createClient();
    const res = await client.post('/auth/refresh', { refreshToken });

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('token');
    expect(res.data.token).not.toBe(token);

    token = res.data.token;
  });

  it('should access protected endpoint with refreshed token', async () => {
    const client = createClient(token);
    const res = await client.get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.data.username).toBe(username);
  });

  it('should logout successfully', async () => {
    const client = createClient(token);
    const res = await client.post('/auth/logout');

    expect(res.status).toBe(200);
  });

  it('should reject access after logout', async () => {
    const client = createClient(token);
    const res = await client.get('/auth/me');

    // Token should be invalidated after logout
    expect([401, 403]).toContain(res.status);
  });
});
