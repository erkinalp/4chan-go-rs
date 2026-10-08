import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const boardListingDuration = new Trend('board_listing_duration');

export const options = {
  stages: [
    { duration: '10s', target: 500 },
    { duration: '40s', target: 1000 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';

export default function () {
  const res = http.get(`${BASE_URL}/boards`);

  boardListingDuration.add(res.timings.duration);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has boards array': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.boards);
    },
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
  sleep(0.05);
}
