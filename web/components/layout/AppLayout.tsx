'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { TopNav } from './TopNav';
import { ThemeProvider } from './ThemeProvider';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <main className="mx-auto max-w-7xl px-6 py-8 print:px-0 print:py-0">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
