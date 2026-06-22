import { createClient, registerUser, randomString } from '../integration/helpers';

describe('SQL Injection Prevention Tests', () => {
  let token: string;
  let boardId: string;

  const SQL_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE posts; --",
    "1; SELECT * FROM users --",
    "' UNION SELECT username, password FROM users --",
    "admin'--",
    "1' OR '1'='1' /*",
    "'; INSERT INTO users (username, password) VALUES ('hacker', 'pass'); --",
    "1; UPDATE users SET role='admin' WHERE username='test'; --",
    "' OR 1=1; --",
    "'); DELETE FROM threads WHERE ('1'='1",
    "1 AND (SELECT COUNT(*) FROM users) > 0",
    "' AND SLEEP(5) --",
    "' OR BENCHMARK(10000000, SHA1('test')) --",
    "\\x27 OR 1=1 --",
  ];

  beforeAll(async () => {
    const user = await registerUser(`sqli_test_${randomString()}`, 'SqliTest123!');
    token = user.token;

    const client = createClient(token);
    const boardRes = await client.post('/boards', {
      slug: `sqli-${randomString()}`,
      title: 'SQL Injection Test Board',
      description: 'Board for SQLi testing',
      nsfw: false,
    });
    boardId = boardRes.data.id;
  });

  describe('Search endpoint SQL injection', () => {
    SQL_PAYLOADS.forEach((payload, index) => {
      it(`should reject SQL injection payload #${index + 1} in search`, async () => {
        const client = createClient(token);
        const res = await client.get('/boards', {
          params: { search: payload },
        });

        // Should not cause server error (500 would indicate unparameterized query)
        expect(res.status).not.toBe(500);
        expect([200, 400]).toContain(res.status);
      });
    });
  });

  describe('Board name SQL injection', () => {
    SQL_PAYLOADS.forEach((payload, index) => {
      it(`should handle SQL injection payload #${index + 1} in board slug`, async () => {
        const client = createClient(token);
        const res = await client.get(`/boards/${encodeURIComponent(payload)}`);

        // Should return 404 or 400, never 500
        expect(res.status).not.toBe(500);
        expect([400, 404]).toContain(res.status);
      });
    });
  });

  describe('Thread/Post ID SQL injection', () => {
    SQL_PAYLOADS.forEach((payload, index) => {
      it(`should handle SQL injection payload #${index + 1} in thread ID`, async () => {
        const client = createClient(token);
        const res = await client.get(`/threads/${encodeURIComponent(payload)}`);

        expect(res.status).not.toBe(500);
        expect([400, 404]).toContain(res.status);
      });
    });
  });

  describe('Login SQL injection', () => {
    SQL_PAYLOADS.slice(0, 5).forEach((payload, index) => {
      it(`should reject SQL injection payload #${index + 1} in login`, async () => {
        const client = createClient();
        const res = await client.post('/auth/login', {
          username: payload,
          password: payload,
        });

        // Should not authenticate and should not cause server error
        expect(res.status).not.toBe(500);
        expect(res.status).not.toBe(200);
        expect([400, 401]).toContain(res.status);
      });
    });
  });
});
