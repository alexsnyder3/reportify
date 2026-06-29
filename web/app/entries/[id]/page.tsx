'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatDuration, statusColors } from '@/lib/utils';
import { ArrowLeft, MapPin, Clock, User, Mic } from 'lucide-react';
import Link from 'next/link';

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [reassigning, setReassigning] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ['entry', id],
    queryFn: async () => { const res = await api.get(`/api/entries/${id}`); return res.data.data; },
  });

  const { data: jobs } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['jobs'],
    queryFn: async () => { const res = await api.get('/api/jobs'); return res.data.data; },
  });

  const reassign = useMutation({
    mutationFn: (jobId: string | null) => api.patch(`/api/entries/${id}/job`, { jobId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entry', id] }); setReassigning(false); },
  });

  if (isLoading) {
    return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div></AppLayout>;
  }
  if (!entry) return <AppLayout><p className="text-red-600">Entry not found</p></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/entries"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold text-gray-900">Field Entry</h1>
          <Badge className={statusColors[entry.status]}>{entry.status.replace(/_/g, ' ')}</Badge>
        </div>

        {/* Meta */}
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-5 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Supervisor</p>
                <p className="text-sm font-medium">{entry.user.firstName} {entry.user.lastName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Recorded</p>
                <p className="text-sm font-medium">{formatDateTime(entry.recordedAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-sm font-medium">{formatDuration(entry.durationSeconds)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">GPS</p>
                <p className="text-sm font-medium">
                  {entry.latitude ? `${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)}` : 'Not available'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job assignment */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Job Assignment</CardTitle>
              <Button variant="secondary" size="sm" onClick={() => setReassigning(!reassigning)}>
                {reassigning ? 'Cancel' : 'Reassign'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!reassigning ? (
              entry.job ? (
                <div>
                  <p className="font-medium text-gray-900">{entry.job.name}</p>
                  {entry.jobConfidence != null && (
                    <p className="text-xs text-gray-500">
                      Auto-detected · {Math.round(entry.jobConfidence * 100)}% confidence
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Unassigned — no job detected at this location</p>
              )
            ) : (
              <div className="flex gap-3">
                <select
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  defaultValue={entry.jobId || ''}
                  onChange={(e) => reassign.mutate(e.target.value || null)}
                >
                  <option value="">— Unassigned —</option>
                  {jobs?.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audio player */}
        {entry.audioUrl && (
          <Card>
            <CardHeader><CardTitle>Audio Recording</CardTitle></CardHeader>
            <CardContent>
              <audio controls src={entry.audioUrl} className="w-full" />
            </CardContent>
          </Card>
        )}

        {/* Transcript */}
        {entry.transcript && (
          <Card>
            <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{entry.transcript.text}</p>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {entry.photos?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Photos ({entry.photos.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {entry.photos.map((ep: { photo: { id: string; fileKey: string; analysis?: { description: string } } }) => (
                  <div key={ep.photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">Photo</div>
                    {ep.photo.analysis && (
                      <div className="absolute inset-x-0 bottom-0 hidden bg-black/60 p-2 group-hover:block">
                        <p className="text-xs text-white line-clamp-2">{ep.photo.analysis.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reports */}
        {entry.reports?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Generated Reports</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {entry.reports.map((re: { report: { id: string; title: string; status: string; createdAt: string } }) => (
                <Link key={re.report.id} href={`/reports/${re.report.id}`} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">{re.report.title}</p>
                  <Badge className={statusColors[re.report.status]}>{re.report.status}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
