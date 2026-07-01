'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { geocodeAddress } from '@/lib/geocode';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, MapPin, FileText, Upload, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface JobDoc {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  createdAt: string;
}

function DocumentsCard({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const { data } = useQuery<{ documents: JobDoc[]; context: string | null }>({
    queryKey: ['job-docs', jobId],
    queryFn: async () => { const res = await api.get(`/api/job-documents/${jobId}`); return res.data.data; },
    refetchInterval: (q) => q.state.data?.documents.some((d) => d.status === 'PROCESSING') ? 4000 : false,
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: string) => api.delete(`/api/job-documents/${jobId}/${docId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job-docs', jobId] }),
  });

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    setUploadMsg('');
    try {
      const form = new FormData();
      arr.forEach((f) => form.append('files', f));
      await api.post(`/api/job-documents/${jobId}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['job-docs', jobId] });
      setUploadMsg(`${arr.length} file${arr.length > 1 ? 's' : ''} uploaded — AI is analyzing...`);
    } catch {
      setUploadMsg('Upload failed — check file type (PDF, PNG, JPG only)');
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer.files);
  }, [jobId]);

  function formatBytes(b: number | null) {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Documents</CardTitle>
        <p className="text-sm text-gray-500">Upload drawings, specs, or plans. AI will read them and use them as context when generating reports for this job.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-gray-300 hover:border-gray-400'}`}
        >
          <Upload className="mb-2 h-8 w-8 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">Drop files here or click to browse</p>
          <p className="mt-1 text-xs text-gray-400">PDF, PNG, JPG up to 50 MB each</p>
          <input
            type="file"
            multiple
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            disabled={uploading}
          />
          {uploading && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-[var(--accent)]">
              <Loader2 className="h-4 w-4 animate-spin" />Uploading...
            </div>
          )}
        </div>

        {uploadMsg && (
          <p className={`text-sm ${uploadMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>{uploadMsg}</p>
        )}

        {/* Document list */}
        {data?.documents && data.documents.length > 0 && (
          <div className="space-y-2">
            {data.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 group">
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                  <p className="text-xs text-gray-400">{formatBytes(doc.fileSizeBytes)}</p>
                </div>
                {doc.status === 'PROCESSING' && <div className="flex items-center gap-1 text-xs text-amber-600"><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing...</div>}
                {doc.status === 'READY' && <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />}
                {doc.status === 'FAILED' && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                <button onClick={() => deleteDoc.mutate(doc.id)} className="opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI context preview */}
        {data?.context && (
          <details className="rounded-lg border border-green-200 bg-green-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-green-800">
              ✓ AI context ready — {data.documents.filter((d) => d.status === 'READY').length} document{data.documents.filter((d) => d.status === 'READY').length !== 1 ? 's' : ''} analyzed
            </summary>
            <div className="px-4 pb-4">
              <p className="text-xs text-green-700 whitespace-pre-wrap line-clamp-6">{data.context}</p>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default function EditJobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState('');
  const [form, setForm] = useState({ name: '', address: '', projectNumber: '', latitude: '', longitude: '', radiusMeters: '200', notes: '', isActive: true });

  const { data: job } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => { const res = await api.get(`/api/jobs/${id}`); return res.data.data; },
  });

  useEffect(() => {
    if (job) {
      setForm({
        name: job.name || '',
        address: job.address || '',
        projectNumber: job.projectNumber || '',
        latitude: job.latitude?.toString() || '',
        longitude: job.longitude?.toString() || '',
        radiusMeters: job.radiusMeters?.toString() || '200',
        notes: job.notes || '',
        isActive: job.isActive,
      });
    }
  }, [job]);

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

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/api/jobs/${id}`, {
        name: form.name,
        address: form.address || undefined,
        projectNumber: form.projectNumber || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        radiusMeters: parseFloat(form.radiusMeters) || 200,
        notes: form.notes || undefined,
        isActive: form.isActive,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); router.push('/jobs'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed to update job';
      setError(msg);
    },
  });

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/jobs"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit Job</h1>
        </div>
        <DocumentsCard jobId={id} />

        <Card>
          <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-4">
              <Input label="Job Name *" value={form.name} onChange={set('name')} required />

              <div className="space-y-2">
                <Input label="Address" value={form.address} onChange={set('address')} onBlur={autoFillCoords} />
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
                <Input label="Latitude" type="number" step="any" value={form.latitude} onChange={set('latitude')} />
                <Input label="Longitude" type="number" step="any" value={form.longitude} onChange={set('longitude')} />
              </div>
              <Input label="Geofence Radius (meters)" type="number" value={form.radiusMeters} onChange={set('radiusMeters')} />
              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" rows={3} value={form.notes} onChange={set('notes')} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Active (enables GPS auto-detection)
              </label>
              {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={update.isPending}>Save Changes</Button>
                <Link href="/jobs"><Button variant="secondary">Cancel</Button></Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
