import axios from 'axios';
import Cookies from 'js-cookie';

const TOKEN_KEY = 'reportify_token';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = Cookies.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove(TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export function setToken(token: string) {
  Cookies.set(TOKEN_KEY, token, { expires: 7, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
}

export function clearToken() {
  Cookies.remove(TOKEN_KEY);
}

export function getToken() {
  return Cookies.get(TOKEN_KEY);
}
