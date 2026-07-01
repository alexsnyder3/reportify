'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth, useLogout } from '@/lib/hooks/useAuth';
import { Briefcase, Users, FileText, Settings, LogOut, Activity, ChevronDown, Camera } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const navItems = [
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/photos', label: 'Photos', icon: Camera },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function TopNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const visible = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN' || user?.role === 'MANAGER',
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white print:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">

        {/* Logo */}
        <Link href="/jobs" className="flex items-center gap-2.5 shrink-0">
          <Image src="/s2s-logo.png" alt="Site2Site" width={32} height={32} className="rounded-lg" />
          <div className="leading-tight">
            <span className="text-sm font-bold text-gray-900 tracking-tight">Reportify</span>
            <span className="block text-[10px] text-gray-400 font-medium tracking-wider uppercase">by Site2Site</span>
          </div>
        </Link>

        {/* Org name */}
        {user?.organization?.name && (
          <span className="hidden sm:block text-sm text-gray-400 border-l border-gray-200 pl-4">
            {user.organization.name}
          </span>
        )}

        {/* Nav */}
        <nav className="flex items-center gap-1 ml-2">
          {visible.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <span className="hidden sm:block font-medium">{user?.firstName} {user?.lastName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-400">{user?.role}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); logout.mutate(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
