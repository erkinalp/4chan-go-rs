import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import encoding from 'k6/encoding';

const errorRate = new Rate('errors');
const uploadDuration = new Trend('file_upload_duration');

export const options = {
  stages: [
    { duration: '10s', target: 25 },
    { duration: '40s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Minimal 1x1 PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export default function () {
  const pngData = encoding.b64decode(PNG_BASE64);

  const res = http.post(
    `${BASE_URL}/files/upload`,
    {
      file: http.file(pngData, `test-${Date.now()}.png`, 'image/png'),
    },
    {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    }
  );

  uploadDuration.add(res.timings.duration);

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'response has file id': (r) => {
      const body = JSON.parse(r.body);
      return body.id !== undefined;
    },
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  sleep(0.5);
}
