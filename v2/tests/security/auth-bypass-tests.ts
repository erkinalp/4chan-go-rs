import { createClient, registerUser, randomString } from '../integration/helpers';

describe('Authentication Bypass Prevention Tests', () => {
  let validToken: string;
  const PROTECTED_ENDPOINTS = [
    { method: 'GET' as const, path: '/auth/me' },
    { method: 'POST' as const, path: '/boards' },
    { method: 'POST' as const, path: '/reports' },
    { method: 'GET' as const, path: '/mod/reports' },
    { method: 'POST' as const, path: '/mod/bans' },
    { method: 'GET' as const, path: '/mod/log' },
  ];

  beforeAll(async () => {
    const user = await registerUser(`auth_bypass_${randomString()}`, 'BypassTest123!');
    validToken = user.token;
  });

  describe('Access without JWT', () => {
    PROTECTED_ENDPOINTS.forEach(({ method, path }) => {
      it(`should reject ${method} ${path} without token`, async () => {
        const client = createClient();
        let res;
        if (method === 'GET') {
          res = await client.get(path);
        } else {
          res = await client.post(path, {});
        }

        expect(res.status).toBe(401);
        expect(res.data).toHaveProperty('message');
      });
    });
  });

  describe('Access with expired JWT', () => {
    // A JWT that has expired (exp in the past)
    const EXPIRED_TOKEN =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QiLCJleHAiOjE2MDAwMDAwMDB9.' +
      'invalid_signature_placeholder';

    PROTECTED_ENDPOINTS.forEach(({ method, path }) => {
      it(`should reject ${method} ${path} with expired token`, async () => {
        const client = createClient(EXPIRED_TOKEN);
        let res;
        if (method === 'GET') {
          res = await client.get(path);
        } else {
          res = await client.post(path, {});
        }

        expect([401, 403]).toContain(res.status);
      });
    });
  });

  describe('Access with malformed JWT', () => {
    const MALFORMED_TOKENS = [
      'not-a-jwt',
      'Bearer invalid',
      'eyJhbGciOiJIUzI1NiJ9.malformed',
      '',
      'null',
      'undefined',
      '{"alg":"none"}.' + Buffer.from('{"sub":"admin","role":"admin"}').toString('base64') + '.',
    ];

    MALFORMED_TOKENS.forEach((token, index) => {
      it(`should reject malformed token variant #${index + 1}`, async () => {
        const client = createClient(token);
        const res = await client.get('/auth/me');

        expect([400, 401, 403]).toContain(res.status);
      });
    });
  });

  describe('Access with wrong role', () => {
    it('should reject regular user accessing mod endpoints', async () => {
      const user = await registerUser(`norole_${randomString()}`, 'NoRole123!');
      const client = createClient(user.token);

      const modEndpoints = [
        { method: 'GET', path: '/mod/reports' },
        { method: 'POST', path: '/mod/bans' },
        { method: 'GET', path: '/mod/log' },
      ];

      for (const { method, path } of modEndpoints) {
        let res;
        if (method === 'GET') {
          res = await client.get(path);
        } else {
          res = await client.post(path, {
            userId: 'some-id',
            reason: 'test',
            duration: 3600,
          });
        }

        expect([401, 403]).toContain(res.status);
      }
    });
  });

  describe('JWT algorithm confusion', () => {
    it('should reject tokens with alg:none', async () => {
      // alg:none attack - header says no signature needed
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
        'base64url'
      );
      const payload = Buffer.from(
        JSON.stringify({ sub: '1', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })
      ).toString('base64url');
      const fakeToken = `${header}.${payload}.`;

      const client = createClient(fakeToken);
      const res = await client.get('/auth/me');

      expect([401, 403]).toContain(res.status);
    });
  });
});
