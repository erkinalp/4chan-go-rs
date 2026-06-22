import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

export function createClient(token?: string): AxiosInstance {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return axios.create({
    baseURL: API_BASE_URL,
    headers,
    validateStatus: () => true,
  });
}

export async function registerUser(
  username: string,
  password: string
): Promise<{ token: string; refreshToken: string; userId: string }> {
  const client = createClient();
  const res = await client.post('/auth/register', {
    username,
    password,
    email: `${username}@test.local`,
  });
  if (res.status !== 201) {
    throw new Error(`Registration failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ token: string; refreshToken: string; userId: string }> {
  const client = createClient();
  const res = await client.post('/auth/login', { username, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export function randomString(length = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}
