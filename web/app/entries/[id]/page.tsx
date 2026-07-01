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
import { ArrowLeft, MapPin, Clock, User, Mic, RefreshCw, FileText } from 'lucide-react';
import Link from 'next/link';

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [reassigning, setReassigning] = useState(false);
  const [regenMsg, setRegenMsg] = useState('');

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

  const regenerate = useMutation({
    mutationFn: () => api.post(`/api/entries/${id}/regenerate`),
    onSuccess: () => {
      setRegenMsg('Reports regenerating — refresh in ~30 seconds');
      qc.invalidateQueries({ queryKey: ['entry', id] });
    },
    onError: () => setRegenMsg('Failed to queue regeneration'),
  });

  if (isLoading) {
    return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" /></div></AppLayout>;
  }
  if (!entry) return <AppLayout><p className="text-red-600">Entry not found</p></AppLayout>;

  const hasTranscript = !!entry.transcript;

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/activity"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-xl font-bold text-gray-900">Field Entry</h1>
          <Badge className={statusColors[entry.status]}>{entry.status.replace(/_/g, ' ')}</Badge>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: User, label: 'Supervisor', value: `${entry.user.firstName} ${entry.user.lastName}` },
            { icon: Clock, label: 'Recorded', value: formatDateTime(entry.recordedAt) },
            { icon: Mic, label: 'Duration', value: formatDuration(entry.durationSeconds) },
            { icon: MapPin, label: 'GPS', value: entry.latitude ? `${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)}` : 'Not available' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Job assignment */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Job Assignment</h2>
            <div className="flex gap-2">
              {hasTranscript && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => regenerate.mutate()}
                  loading={regenerate.isPending}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Regenerate Reports
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setReassigning(!reassigning)}>
                {reassigning ? 'Cancel' : 'Reassign'}
              </Button>
            </div>
          </div>

          {!reassigning ? (
            entry.job ? (
              <div>
                <p className="font-medium text-gray-900">{entry.job.name}</p>
                {entry.jobConfidence != null && (
                  <p className="text-xs text-gray-400 mt-0.5">Auto-detected · {Math.round(entry.jobConfidence * 100)}% confidence</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-amber-600">Unassigned — reassign to a job then regenerate reports</p>
            )
          ) : (
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              defaultValue={entry.jobId || ''}
              onChange={(e) => reassign.mutate(e.target.value || null)}
            >
              <option value="">— Unassigned —</option>
              {jobs?.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          )}

          {regenMsg && (
            <p className="mt-2 text-xs text-green-600">{regenMsg}</p>
          )}
        </div>

        {/* Transcript */}
        {entry.transcript && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Transcript</h2>
            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{entry.transcript.text}</p>
          </div>
        )}

        {/* Audio */}
        {entry.audioUrl && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Audio Recording</h2>
            <audio controls src={entry.audioUrl} className="w-full" />
          </div>
        )}

        {/* Reports */}
        {entry.reports?.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Generated Reports</h2>
            <div className="space-y-2">
              {entry.reports.map((re: { report: { id: string; title: string; status: string; type: string } }) => (
                <Link
                  key={re.report.id}
                  href={`/reports/${re.report.id}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <FileText className={`h-4 w-4 shrink-0 ${re.report.type === 'SAFETY_REPORT' ? 'text-orange-500' : 'text-green-600'}`} />
                  <span className="flex-1 text-sm font-medium text-gray-900">{re.report.title}</span>
                  <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${re.report.type === 'SAFETY_REPORT' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {re.report.type === 'SAFETY_REPORT' ? 'Safety' : 'Supervisor'}
                  </span>
                  <Badge className={statusColors[re.report.status]}>{re.report.status}</Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {entry.photos?.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Photos ({entry.photos.length})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {entry.photos.map((ep: { photo: { id: string; analysis?: { description: string } } }) => (
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
          </div>
        )}
      </div>
    </AppLayout>
  );
}
