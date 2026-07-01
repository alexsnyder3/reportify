'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { geocodeAddress } from '@/lib/geocode';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function NewJobPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState('');

  const [form, setForm] = useState({
    name: '',
    address: '',
    projectNumber: '',
    latitude: '',
    longitude: '',
    radiusMeters: '200',
    notes: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function autoFillCoords() {
    if (!form.address.trim()) return;
    setGeocoding(true);
    setGeocodeMsg('');
    const result = await geocodeAddress(form.address);
    setGeocoding(false);
    if (result) {
      setForm((f) => ({ ...f, latitude: result.lat, longitude: result.lon }));
      setGeocodeMsg('Coordinates auto-filled from address');
    } else {
      setGeocodeMsg('Address not found — enter coordinates manually');
    }
  }

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/jobs', {
        name: form.name,
        address: form.address || undefined,
        projectNumber: form.projectNumber || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        radiusMeters: parseFloat(form.radiusMeters) || 200,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      router.push('/jobs');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Failed to create job';
      setError(msg);
    },
  });

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/jobs"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold text-gray-900">New Job</h1>
        </div>

        <Card>
          <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
              <Input label="Job Name *" value={form.name} onChange={set('name')} required placeholder="Downtown Office Tower" />

              <div className="space-y-2">
                <Input
                  label="Address"
                  value={form.address}
                  onChange={set('address')}
                  onBlur={autoFillCoords}
                  placeholder="123 Main Street, Vancouver, BC"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={autoFillCoords}
                  loading={geocoding}
                  disabled={!form.address.trim() || geocoding}
                >
                  <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  Auto-detect GPS from address
                </Button>
                {geocodeMsg && (
                  <p className={`text-xs ${geocodeMsg.includes('not found') ? 'text-amber-600' : 'text-green-600'}`}>
                    {geocodeMsg}
                  </p>
                )}
              </div>

              <Input label="Project Number" value={form.projectNumber} onChange={set('projectNumber')} placeholder="25-160" />

              <div className="grid grid-cols-2 gap-4">
                <Input label="Latitude" type="number" step="any" value={form.latitude} onChange={set('latitude')} placeholder="49.2827" />
                <Input label="Longitude" type="number" step="any" value={form.longitude} onChange={set('longitude')} placeholder="-123.1207" />
              </div>

              <Input label="Geofence Radius (meters)" type="number" value={form.radiusMeters} onChange={set('radiusMeters')} placeholder="200" />
              <p className="text-xs text-gray-500">
                When a supervisor records within this radius, the entry will automatically be assigned to this job. 200m is a good default for most sites.
              </p>

              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Any notes about this job..."
                />
              </div>

              {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={create.isPending}>Create Job</Button>
                <Link href="/jobs"><Button variant="secondary">Cancel</Button></Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
