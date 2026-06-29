'use client';

import { api, setToken, clearToken } from './api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'SUPERVISOR';
  organization: { id: string; name: string; slug: string };
}

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await api.post('/api/auth/login', { email, password });
  const { token, user } = res.data.data;
  setToken(token);
  return { token, user };
}

export async function logout() {
  clearToken();
}

export async function getMe(): Promise<User> {
  const res = await api.get('/api/auth/me');
  return res.data.data;
}
