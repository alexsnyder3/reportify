'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatDuration, statusColors } from '@/lib/utils';
import { Mic } from 'lucide-react';
import Link from 'next/link';
import { useState, Suspense } from 'react';

interface Entry {
  id: string;
  status: string;
  durationSeconds: number | null;
  recordedAt: string;
  latitude: number | null;
  longitude: number | null;
  user: { id: string; firstName: string; lastName: string; email: string };
  job: { id: string; name: string } | null;
  transcript: { text: string } | null;
  photos: Array<{ photo: { id: string } }>;
}

const statusDot: Record<string, string> = {
  UPLOADED: 'bg-blue-400',
  PROCESSING: 'bg-yellow-400',
  TRANSCRIBED: 'bg-purple-400',
  REPORT_GENERATED: 'bg-green-400',
  FAILED: 'bg-red-400',
};

function ActivityContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') || undefined;
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ entries: Entry[]; total: number; pages: number }>({
    queryKey: ['entries', page, jobId],
    queryFn: async () => {
      const res = await api.get('/api/entries', {
        params: { page, limit: 20, ...(jobId && { jobId }) },
      });
      return res.data.data;
    },
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {jobId ? 'Filtered by job · ' : ''}{data?.total ?? 0} voice recordings from the field
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : !data?.entries?.length ? (
        <div className="flex flex-col items-center py-24 text-center">
          <Mic className="mb-3 h-12 w-12 text-gray-200" />
          <p className="font-medium text-gray-700">No activity yet</p>
          <p className="text-sm text-gray-400 mt-1">Entries will appear here once supervisors start recording</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {data.entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/entries/${entry.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDot[entry.status] ?? 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">
                      {entry.user.firstName} {entry.user.lastName}
                    </span>
                    {entry.job ? (
                      <span className="text-sm text-gray-500">· {entry.job.name}</span>
                    ) : (
                      <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-medium">Unassigned</span>
                    )}
                  </div>
                  {entry.transcript ? (
                    <p className="mt-0.5 text-sm text-gray-500 truncate">{entry.transcript.text}</p>
                  ) : (
                    <p className="mt-0.5 text-sm text-gray-300 italic">Awaiting transcription…</p>
                  )}
                  <div className="mt-1 flex gap-3 text-xs text-gray-400">
                    <span>{formatDateTime(entry.recordedAt)}</span>
                    {entry.durationSeconds && <span>· {formatDuration(entry.durationSeconds)}</span>}
                    {entry.photos.length > 0 && <span>· {entry.photos.length} photo{entry.photos.length !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <Badge className={statusColors[entry.status]}>{entry.status.replace(/_/g, ' ')}</Badge>
              </Link>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <span className="px-3 py-1.5 text-sm text-gray-500">Page {page} of {data.pages}</span>
              <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" /></div>}>
        <ActivityContent />
      </Suspense>
    </AppLayout>
  );
}
