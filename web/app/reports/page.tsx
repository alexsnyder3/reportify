'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, statusColors } from '@/lib/utils';
import { FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, Suspense } from 'react';

interface Report {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
  job: { id: string; name: string } | null;
}

const TYPE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Supervisor', value: 'GENERAL_FIELD_REPORT' },
  { label: 'Safety', value: 'SAFETY_REPORT' },
];

function ReportsContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') || undefined;
  const isRegen = searchParams.get('regen') === '1';
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const qc = useQueryClient();

  const deleteReport = useMutation({
    mutationFn: (id: string) => api.delete(`/api/reports/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); setConfirmDelete(null); },
  });

  const { data, isLoading } = useQuery<{ reports: Report[]; total: number; pages?: number }>({
    queryKey: ['reports', page, jobId, typeFilter],
    queryFn: async () => {
      const res = await api.get('/api/reports', {
        params: { page, limit: 20, ...(jobId && { jobId }), ...(typeFilter && { type: typeFilter }) },
      });
      return res.data.data;
    },
    refetchInterval: isRegen ? 5_000 : false,
  });

  return (
    <div className="space-y-6">
      {isRegen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⏳ Reports are being regenerated — they'll appear here in about 30 seconds. This page refreshes automatically.
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {jobId ? 'Filtered by job · ' : ''}{data?.total ?? 0} reports
          </p>
        </div>

        {/* Type filter tabs */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 gap-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setTypeFilter(f.value); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === f.value
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : !data?.reports?.length ? (
        <div className="flex flex-col items-center py-24 text-center">
          <FileText className="mb-3 h-12 w-12 text-gray-200" />
          <p className="font-medium text-gray-700">No reports found</p>
          <p className="text-sm text-gray-400 mt-1">Reports are generated automatically after voice entries are transcribed</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {data.reports.map((report) => (
              <div key={report.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                <Link href={`/reports/${report.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    report.type === 'SAFETY_REPORT' ? 'bg-orange-50' : 'bg-green-50'
                  }`}>
                    <FileText className={`h-4 w-4 ${report.type === 'SAFETY_REPORT' ? 'text-orange-500' : 'text-green-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm truncate">{report.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        report.type === 'SAFETY_REPORT'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {report.type === 'SAFETY_REPORT' ? 'Safety' : 'Supervisor'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {report.user.firstName} {report.user.lastName}
                      {report.job && ` · ${report.job.name}`}
                    </p>
                    <p className="text-xs text-gray-400">{formatDateTime(report.createdAt)}</p>
                  </div>
                </Link>
                <Badge className={statusColors[report.status]}>{report.status}</Badge>
                {confirmDelete === report.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">Delete?</span>
                    <button
                      onClick={() => deleteReport.mutate(report.id)}
                      disabled={deleteReport.isPending}
                      className="rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >Yes</button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="rounded px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >No</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.preventDefault(); setConfirmDelete(report.id); }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
                    title="Delete report"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {(data.pages ?? 1) > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <span className="px-3 py-1.5 text-sm text-gray-500">Page {page} of {data.pages}</span>
              <button onClick={() => setPage((p) => Math.min(data.pages!, p + 1))} disabled={page === data.pages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" /></div>}>
        <ReportsContent />
      </Suspense>
    </AppLayout>
  );
}
