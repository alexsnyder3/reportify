'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, statusColors } from '@/lib/utils';
import { Users, Briefcase, FileAudio, FileText, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  stats: {
    totalUsers: number;
    totalJobs: number;
    totalEntries: number;
    unprocessedEntries: number;
    totalReports: number;
    failedEntries: number;
  };
  recentEntries: Array<{
    id: string;
    status: string;
    recordedAt: string;
    user: { firstName: string; lastName: string };
    job: { name: string } | null;
    transcript: { text: string } | null;
  }>;
}

const statCards = [
  { key: 'totalEntries', label: 'Total Entries', icon: FileAudio, color: 'text-blue-600 bg-blue-50' },
  { key: 'totalReports', label: 'Reports Generated', icon: FileText, color: 'text-green-600 bg-green-50' },
  { key: 'totalJobs', label: 'Active Jobs', icon: Briefcase, color: 'text-purple-600 bg-purple-50' },
  { key: 'totalUsers', label: 'Team Members', icon: Users, color: 'text-orange-600 bg-orange-50' },
];

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Overview of your field operations</p>
        </div>

        {/* Alerts */}
        {data && (data.stats.failedEntries > 0 || data.stats.unprocessedEntries > 0) && (
          <div className="space-y-2">
            {data.stats.failedEntries > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-700">
                  <strong>{data.stats.failedEntries}</strong> entries failed to process.{' '}
                  <Link href="/entries?status=FAILED" className="underline">View entries</Link>
                </p>
              </div>
            )}
            {data.stats.unprocessedEntries > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                <Clock className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-700">
                  <strong>{data.stats.unprocessedEntries}</strong> entries are waiting to be processed.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map(({ key, label, icon: Icon, color }) => (
            <Card key={key}>
              <CardContent className="flex items-center gap-4 py-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '—' : data?.stats[key as keyof typeof data.stats] ?? 0}
                  </p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent entries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Field Entries</CardTitle>
              <Link href="/entries" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : !data?.recentEntries?.length ? (
              <p className="py-12 text-center text-sm text-gray-500">No entries yet. Supervisors will record from the mobile app.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.recentEntries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/entries/${entry.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {entry.user.firstName} {entry.user.lastName}
                        </p>
                        {entry.job && (
                          <span className="text-sm text-gray-500">· {entry.job.name}</span>
                        )}
                      </div>
                      {entry.transcript && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{entry.transcript.text}</p>
                      )}
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-1.5">
                      <Badge className={statusColors[entry.status]}>
                        {entry.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-gray-400">{formatDateTime(entry.recordedAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
