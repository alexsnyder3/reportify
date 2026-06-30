'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, statusColors } from '@/lib/utils';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Report {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
  job: { name: string } | null;
}

export default function ReportsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ reports: Report[]; total: number; pages?: number }>({
    queryKey: ['reports', page],
    queryFn: async () => {
      const res = await api.get('/api/reports', { params: { page, limit: 20 } });
      return res.data.data;
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">AI-generated construction field reports · {data?.total ?? 0} total</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
        ) : !data?.reports?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <FileText className="mb-3 h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-900">No reports yet</p>
              <p className="text-sm text-gray-500">Reports are automatically generated after voice entries are transcribed</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.reports.map((report) => (
              <Link key={report.id} href={`/reports/${report.id}`}>
                <Card className="hover:border-blue-300 transition-colors">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50">
                      <FileText className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{report.title}</p>
                        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                          {report.type === 'SAFETY_REPORT' ? 'Safety' : 'Supervisor'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {report.user.firstName} {report.user.lastName}
                        {report.job && ` · ${report.job.name}`}
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTime(report.createdAt)}</p>
                    </div>
                    <Badge className={statusColors[report.status]}>{report.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
