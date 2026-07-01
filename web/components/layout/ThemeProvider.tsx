'use client';

import { useEffect } from 'react';

export const ACCENT_COLORS = [
  { name: 'S2S Brown', value: '#8B6F47' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Slate', value: '#475569' },
];

export const DEFAULT_ACCENT = '#8B6F47';
export const STORAGE_KEY = 'reportify_accent';

export function getAccentColor(): string {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT;
}

export function setAccentColor(color: string) {
  localStorage.setItem(STORAGE_KEY, color);
  document.documentElement.style.setProperty('--accent', color);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const color = getAccentColor();
    document.documentElement.style.setProperty('--accent', color);
  }, []);

  return <>{children}</>;
}
