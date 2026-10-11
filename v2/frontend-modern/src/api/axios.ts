import axios from 'axios';
import type { AppDispatch, RootState } from '@/store/store';

// The store is injected after creation to break the static
// axios -> store -> authSlice -> axios circular import, which otherwise
// lets the store module evaluate before the auth reducer exists and
// leaves `state.auth` permanently undefined.
let reduxStore: { getState: () => RootState; dispatch: AppDispatch } | null = null;

export const injectStore = (s: { getState: () => RootState; dispatch: AppDispatch }) => {
  reduxStore = s;
};

// Create an Axios instance with custom configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = reduxStore?.getState().auth.token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 (Unauthorized) and we haven't tried to refresh the token yet
    if (error.response?.status === 401 && !originalRequest._retry && reduxStore) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const { refreshToken: currentRefreshToken } = reduxStore.getState().auth;

        if (currentRefreshToken) {
          // Dynamic import keeps this module free of a static authSlice edge.
          const { refreshToken } = await import('@/features/auth/authSlice');
          // Dispatch the refresh token action
          const result = await reduxStore.dispatch(refreshToken(currentRefreshToken)).unwrap();

          // If we successfully got a new token, retry the original request
          originalRequest.headers.Authorization = `Bearer ${result.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // If refreshing fails, log out the user
        const { logout } = await import('@/features/auth/authSlice');
        reduxStore.dispatch(logout());
        return Promise.reject(refreshError);
      }
    }
    
    // For other errors, just pass them through
    return Promise.reject(error);
  }
);

export default api;