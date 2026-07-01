'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatDateTime } from '@/lib/utils';
import { Camera } from 'lucide-react';

interface Photo {
  id: string;
  url: string | null;
  takenAt: string;
  status: string;
  user: { firstName: string; lastName: string };
  job: { id: string; name: string } | null;
  analysis: { description: string; tags: string[]; safetyFlags: string[] } | null;
}

function PhotoCard({ photo }: { photo: Photo }) {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <>
      <div
        onClick={() => photo.url && setEnlarged(true)}
        className={`group relative overflow-hidden rounded-xl bg-gray-100 aspect-square ${photo.url ? 'cursor-pointer' : ''}`}
      >
        {photo.url ? (
          <Image src={photo.url} alt="Site photo" fill className="object-cover transition-transform group-hover:scale-105" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--accent)]" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
        <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform bg-black/70 p-2">
          <p className="text-xs text-white font-medium truncate">
            {photo.user.firstName} {photo.user.lastName}
          </p>
          {photo.job && <p className="text-xs text-gray-300 truncate">{photo.job.name}</p>}
          <p className="text-[10px] text-gray-400">{formatDateTime(photo.takenAt)}</p>
          {photo.analysis && (
            <p className="text-xs text-gray-200 mt-1 line-clamp-2">{photo.analysis.description}</p>
          )}
        </div>

        {/* Safety flag badge */}
        {photo.analysis?.safetyFlags && photo.analysis.safetyFlags.length > 0 && (
          <div className="absolute top-2 right-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            ⚠ Safety
          </div>
        )}

        {/* Status dot */}
        {photo.status !== 'ANALYZED' && (
          <div className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
            {photo.status === 'PROCESSING' ? 'Analyzing…' : photo.status === 'FAILED' ? 'Failed' : 'Queued'}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {enlarged && photo.url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setEnlarged(false)}
        >
          <div className="relative max-h-full max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={photo.url} alt="Site photo" className="max-h-[80vh] w-full object-contain rounded-xl" />
            <div className="mt-3 text-white">
              <p className="font-semibold">{photo.user.firstName} {photo.user.lastName} · {photo.job?.name ?? 'Unassigned'}</p>
              <p className="text-sm text-gray-400">{formatDateTime(photo.takenAt)}</p>
              {photo.analysis?.description && (
                <p className="mt-2 text-sm text-gray-300">{photo.analysis.description}</p>
              )}
              {photo.analysis?.tags && photo.analysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {photo.analysis.tags.map((t) => (
                    <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setEnlarged(false)} className="absolute top-2 right-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white hover:bg-black/80">✕ Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function PhotosPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ photos: Photo[]; total: number; pages: number }>({
    queryKey: ['photos', page],
    queryFn: async () => {
      const res = await api.get('/api/photos', { params: { page, limit: 40 } });
      return res.data.data;
    },
    refetchInterval: 15_000,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Photos</h1>
          <p className="mt-0.5 text-sm text-gray-500">{data?.total ?? 0} photos from the field</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : !data?.photos?.length ? (
          <div className="flex flex-col items-center py-24 text-center">
            <Camera className="mb-3 h-12 w-12 text-gray-200" />
            <p className="font-medium text-gray-700">No photos yet</p>
            <p className="text-sm text-gray-400 mt-1">Photos taken in the Android app will appear here</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {data.photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} />
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
    </AppLayout>
  );
}
