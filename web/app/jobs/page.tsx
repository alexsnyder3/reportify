'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/hooks/useAuth';
import { MapPin, Plus, Pencil, ToggleLeft } from 'lucide-react';
import Link from 'next/link';

interface Job {
  id: string;
  name: string;
  address: string | null;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="mt-1 text-sm text-gray-500">Manage construction jobs and GPS geofences</p>
          </div>
          {canEdit && (
            <Link href="/jobs/new">
              <Button><Plus className="mr-2 h-4 w-4" />New Job</Button>
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : !jobs?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <MapPin className="mb-3 h-12 w-12 text-gray-300" />
              <p className="font-medium text-gray-900">No jobs yet</p>
              <p className="text-sm text-gray-500">Create your first job to enable GPS detection</p>
              {canEdit && (
                <Link href="/jobs/new" className="mt-4">
                  <Button><Plus className="mr-2 h-4 w-4" />Create Job</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <Card key={job.id} className={!job.isActive ? 'opacity-60' : ''}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <MapPin className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{job.name}</p>
                      <Badge variant={job.isActive ? 'success' : 'secondary'}>
                        {job.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {job.address && <p className="text-sm text-gray-500 truncate">{job.address}</p>}
                    <p className="text-xs text-gray-400">
                      Geofence: {job.radiusMeters}m radius
                      {job.latitude && job.longitude
                        ? ` · GPS: ${job.latitude.toFixed(4)}, ${job.longitude.toFixed(4)}`
                        : ' · No GPS set'}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Link href={`/jobs/${job.id}`}>
                        <Button variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive.mutate({ id: job.id, isActive: !job.isActive })}
                      >
                        <ToggleLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
