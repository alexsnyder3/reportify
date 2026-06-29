import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function roleLabel(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export const statusColors: Record<string, string> = {
  UPLOADED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  TRANSCRIBED: 'bg-purple-100 text-purple-800',
  REPORT_GENERATED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  DRAFT: 'bg-gray-100 text-gray-800',
  REVIEW: 'bg-yellow-100 text-yellow-800',
  FINAL: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};
