import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const postCreationDuration = new Trend('post_creation_duration');

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '40s', target: 200 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const THREAD_ID = __ENV.THREAD_ID || '1';

export default function () {
  const payload = JSON.stringify({
    message: `Load test post ${Date.now()} - VU ${__VU} iteration ${__ITER}`,
  });

  const res = http.post(`${BASE_URL}/threads/${THREAD_ID}/posts`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  });

  postCreationDuration.add(res.timings.duration);

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'response has post id': (r) => {
      const body = JSON.parse(r.body);
      return body.id !== undefined;
    },
    'response time < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(!success);
  sleep(0.2);
}
