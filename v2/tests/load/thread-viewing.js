import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const threadViewDuration = new Trend('thread_view_duration');

export const options = {
  stages: [
    { duration: '10s', target: 250 },
    { duration: '40s', target: 500 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';
const THREAD_ID = __ENV.THREAD_ID || '1';

export default function () {
  const res = http.get(`${BASE_URL}/threads/${THREAD_ID}`);

  threadViewDuration.add(res.timings.duration);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has posts': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.posts);
    },
    'response has thread subject': (r) => {
      const body = JSON.parse(r.body);
      return body.subject !== undefined;
    },
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
  sleep(0.1);
}
