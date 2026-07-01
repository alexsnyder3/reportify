'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ACCENT_COLORS, DEFAULT_ACCENT, STORAGE_KEY, setAccentColor } from '@/components/layout/ThemeProvider';
import { useAuth } from '@/lib/hooks/useAuth';
import { Check } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSelected(saved);
  }, []);

  function applyColor(value: string) {
    setSelected(value);
    setAccentColor(value);
  }

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-0.5 text-sm text-gray-500">Customize your Reportify workspace</p>
        </div>

        {/* Accent color */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Accent Color</h2>
            <p className="text-sm text-gray-500 mt-0.5">Sets the color used for navigation, buttons, and highlights across the app.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => applyColor(color.value)}
                className="group flex flex-col items-center gap-1.5"
              >
                <div
                  className="relative h-9 w-9 rounded-full border-2 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: color.value,
                    borderColor: selected === color.value ? color.value : 'transparent',
                    boxShadow: selected === color.value ? `0 0 0 3px ${color.value}33` : undefined,
                  }}
                >
                  {selected === color.value && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
                  )}
                </div>
                <span className="text-xs text-gray-500">{color.name}</span>
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">Preview: <span className="font-semibold" style={{ color: selected }}>{ACCENT_COLORS.find(c => c.value === selected)?.name ?? 'Custom'}</span> is active</p>
          </div>
        </section>

        {/* Account info */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Account</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900">{user?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Role</span>
              <span className="font-medium text-gray-900">{user?.role}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Organization</span>
              <span className="font-medium text-gray-900">{user?.organization?.name}</span>
            </div>
          </div>
        </section>

        {/* Branding */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Reportify</p>
              <p className="text-xs text-gray-400">by Site2Site · Field Reporting Platform</p>
            </div>
            <p className="text-xs text-gray-300">v1.0</p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
