'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatDuration, statusColors } from '@/lib/utils';
import { FileAudio, Mic } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

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

export default function EntriesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ entries: Entry[]; total: number; pages: number }>({
    queryKey: ['entries', page],
    queryFn: async () => {
      const res = await api.get('/api/entries', { params: { page, limit: 20 } });
      return res.data.data;
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Entries</h1>
          <p className="mt-1 text-sm text-gray-500">
            Voice recordings uploaded from the field · {data?.total ?? 0} total
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : !data?.entries?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Mic className="mb-3 h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-900">No entries yet</p>
              <p className="text-sm text-gray-500">Entries will appear here once supervisors start recording in the field</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {data.entries.map((entry) => (
                <Link key={entry.id} href={`/entries/${entry.id}`}>
                  <Card className="hover:border-blue-300 transition-colors">
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                        <FileAudio className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-gray-900">
                            {entry.user.firstName} {entry.user.lastName}
                          </span>
                          {entry.job && (
                            <span className="text-sm text-gray-500">· {entry.job.name}</span>
                          )}
                          {!entry.job && (
                            <Badge variant="warning">Unassigned</Badge>
                          )}
                        </div>
                        {entry.transcript ? (
                          <p className="mt-0.5 text-sm text-gray-600 truncate">{entry.transcript.text}</p>
                        ) : (
                          <p className="mt-0.5 text-sm text-gray-400 italic">Not yet transcribed</p>
                        )}
                        <div className="mt-1 flex gap-3 text-xs text-gray-400">
                          <span>{formatDateTime(entry.recordedAt)}</span>
                          {entry.durationSeconds && <span>· {formatDuration(entry.durationSeconds)}</span>}
                          {entry.photos.length > 0 && <span>· {entry.photos.length} photo{entry.photos.length !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <Badge className={statusColors[entry.status]}>{entry.status.replace(/_/g, ' ')}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex justify-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm rounded border disabled:opacity-40">Previous</button>
                <span className="px-3 py-1.5 text-sm text-gray-600">Page {page} of {data.pages}</span>
                <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages} className="px-3 py-1.5 text-sm rounded border disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
