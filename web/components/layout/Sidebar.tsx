'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth, useLogout } from '@/lib/hooks/useAuth';
import {
  LayoutDashboard, Briefcase, Users, FileAudio, Image, FileText,
  Settings, LogOut, HardHat,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/entries', label: 'Field Entries', icon: FileAudio },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/users', label: 'Users', icon: Users, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const logout = useLogout();

  const visible = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN' || user?.role === 'MANAGER',
  );

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-gray-900">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <HardHat className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Reportify</p>
          <p className="text-xs text-gray-400">{user?.organization?.name}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-700 p-4">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium text-white">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-gray-400">{user?.role}</p>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
