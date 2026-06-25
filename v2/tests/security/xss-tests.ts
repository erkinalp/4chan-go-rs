import { createClient, registerUser, randomString } from '../integration/helpers';

describe('XSS Prevention Tests', () => {
  let token: string;
  let boardId: string;
  let threadId: string;

  const XSS_PAYLOADS = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    '"><script>document.cookie</script>',
    "javascript:alert('xss')",
    '<svg onload=alert(1)>',
    '<body onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '{{constructor.constructor("alert(1)")()}}',
    '<math><mi xlink:href="javascript:alert(1)">click</mi></math>',
    '<details open ontoggle=alert(1)>',
    "';alert(String.fromCharCode(88,83,83))//",
    '<img src="x" onerror="eval(atob(\'YWxlcnQoMSk=\'))">',
  ];

  beforeAll(async () => {
    const user = await registerUser(`xss_test_${randomString()}`, 'XssTest123!');
    token = user.token;

    const client = createClient(token);
    const boardRes = await client.post('/boards', {
      slug: `xss-${randomString()}`,
      title: 'XSS Test Board',
      description: 'Board for XSS testing',
      nsfw: false,
    });
    boardId = boardRes.data.id;

    const threadRes = await client.post(`/boards/${boardId}/threads`, {
      subject: 'XSS Test Thread',
      message: 'Clean message for XSS testing.',
    });
    threadId = threadRes.data.id;
  });

  describe('Post message XSS', () => {
    XSS_PAYLOADS.forEach((payload, index) => {
      it(`should sanitize XSS payload #${index + 1} in post message`, async () => {
        const client = createClient(token);
        const res = await client.post(`/threads/${threadId}/posts`, {
          message: payload,
        });

        if (res.status === 201) {
          // If accepted, verify the payload is sanitized in the response
          expect(res.data.message).not.toContain('<script');
          expect(res.data.message).not.toContain('onerror=');
          expect(res.data.message).not.toContain('onload=');
          expect(res.data.message).not.toContain('javascript:');
          expect(res.data.message).not.toContain('ontoggle=');
        } else {
          // Rejection (400) is also acceptable
          expect(res.status).toBe(400);
        }
      });
    });
  });

  describe('Thread subject XSS', () => {
    XSS_PAYLOADS.forEach((payload, index) => {
      it(`should sanitize XSS payload #${index + 1} in thread subject`, async () => {
        const client = createClient(token);
        const res = await client.post(`/boards/${boardId}/threads`, {
          subject: payload,
          message: 'Normal message body.',
        });

        if (res.status === 201) {
          expect(res.data.subject).not.toContain('<script');
          expect(res.data.subject).not.toContain('onerror=');
          expect(res.data.subject).not.toContain('onload=');
          expect(res.data.subject).not.toContain('javascript:');
        } else {
          expect(res.status).toBe(400);
        }
      });
    });
  });

  describe('Username XSS', () => {
    XSS_PAYLOADS.slice(0, 5).forEach((payload, index) => {
      it(`should sanitize XSS payload #${index + 1} in username`, async () => {
        const client = createClient();
        const res = await client.post('/auth/register', {
          username: payload,
          password: 'SafePass123!',
          email: `xss${index}_${randomString()}@test.local`,
        });

        if (res.status === 201) {
          expect(res.data.username || '').not.toContain('<script');
          expect(res.data.username || '').not.toContain('onerror=');
        } else {
          // Username with special chars should be rejected
          expect([400, 422]).toContain(res.status);
        }
      });
    });
  });
});
