'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/hooks/useAuth';
import { MapPin, Plus, Pencil, FileText, Mic } from 'lucide-react';
import Link from 'next/link';

interface Job {
  id: string;
  name: string;
  address: string | null;
  projectNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export default function JobsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      const res = await api.get('/api/jobs');
      return res.data.data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/jobs/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="mt-0.5 text-sm text-gray-500">{jobs?.length ?? 0} job sites configured</p>
          </div>
          {canEdit && (
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="h-4 w-4" />
              New Job
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : !jobs?.length ? (
          <div className="flex flex-col items-center py-24 text-center">
            <MapPin className="mb-3 h-12 w-12 text-gray-200" />
            <p className="font-medium text-gray-700">No jobs yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first job to enable GPS auto-detection</p>
            {canEdit && (
              <Link
                href="/jobs/new"
                className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Plus className="h-4 w-4" />Create Job
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`group relative rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${!job.isActive ? 'opacity-60' : ''}`}
              >
                {/* Status dot */}
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      job.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${job.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {job.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {canEdit && (
                    <Link
                      href={`/jobs/${job.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 hover:bg-gray-100"
                    >
                      <Pencil className="h-3.5 w-3.5 text-gray-400" />
                    </Link>
                  )}
                </div>

                {/* Job name */}
                <h3 className="font-bold text-gray-900 leading-tight">{job.name}</h3>
                {job.projectNumber && (
                  <p className="text-xs font-medium text-gray-400 mt-0.5">#{job.projectNumber}</p>
                )}

                {/* Address */}
                {job.address && (
                  <p className="mt-2 text-sm text-gray-500 flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-300" />
                    {job.address}
                  </p>
                )}

                {/* GPS status */}
                <p className="mt-2 text-xs text-gray-400">
                  {job.latitude && job.longitude
                    ? `GPS: ${job.latitude.toFixed(4)}, ${job.longitude.toFixed(4)} · ${job.radiusMeters}m radius`
                    : 'No GPS coordinates set'}
                </p>

                {/* Footer actions */}
                <div className="mt-4 flex items-center gap-3 pt-3 border-t border-gray-100">
                  <Link href={`/activity?jobId=${job.id}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    <Mic className="h-3.5 w-3.5" />Entries
                  </Link>
                  <Link href={`/reports?jobId=${job.id}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    <FileText className="h-3.5 w-3.5" />Reports
                  </Link>
                  {canEdit && (
                    <button
                      onClick={() => toggleActive.mutate({ id: job.id, isActive: !job.isActive })}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {job.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
