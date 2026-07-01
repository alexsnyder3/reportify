'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { statusColors } from '@/lib/utils';
import { ArrowLeft, Printer, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SupervisorReportContent {
  jobName?: string;
  jobAddress?: string;
  projectNumber?: string;
  submittedBy?: string;
  date?: string;
  weather?: string;
  temperature?: string;
  labourersOnSite?: string;
  equipmentOnSite?: string;
  supervisorsOnSite?: string;
  inspectionsToday?: string;
  generalNotes?: string;
  delaysDueToPoorConditions?: string;
  workerIllnessSymptoms?: string;
  toolboxTalk?: string;
  subtradesOnsite?: string;
  healthSafetyHazards?: string;
  transcript?: string;
  // legacy fields
  projectName?: string;
  supervisor?: string;
  summaryOfWork?: string;
  // safety report fields
  firePreventionControl?: string;
  electricalInstallations?: string;
  guardsOnToolsEquipment?: string;
  laddersWalkwaysRamps?: string;
  scaffoldsWorkPlatforms?: string;
  ppeAdequate?: string;
  cranesHoists?: string;
  heavyEquipment?: string;
  motorVehicles?: string;
  barricadesHandrails?: string;
  materialsHandlingStorage?: string;
  excavationsShoringSloping?: string;
  flammableStorage?: string;
  weldingCutting?: string;
  steelErection?: string;
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function QField({ number, label, value }: { number: string; label: string; value?: string }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Q{number} — {label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || 'N/A'}</p>
    </div>
  );
}

function checklistColor(value?: string) {
  if (value?.toLowerCase().startsWith('no')) return 'text-red-600 font-semibold';
  if (value?.toLowerCase().startsWith('n/a')) return 'text-gray-400';
  return 'text-green-700';
}

function ChecklistItem({ number, label, value }: { number: number; label: string; value?: string }) {
  return (
    <div className="py-3">
      <p className="text-xs font-semibold text-gray-500 mb-1">Question {number}</p>
      <p className="text-sm text-gray-800">{label}</p>
      <p className={`mt-1 text-sm italic ${checklistColor(value)}`}>{value || 'N/A'}</p>
    </div>
  );
}

function PhotoThumbnail({ photoId, analysis }: { photoId: string; analysis?: string }) {
  const { data: url } = useQuery({
    queryKey: ['photo-url', photoId],
    queryFn: async () => { const res = await api.get(`/api/photos/${photoId}/url`); return res.data.data.url as string; },
    staleTime: 4 * 60 * 1000,
  });

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 print:rounded-none">
      {url ? (
        <Image src={url} alt="Site photo" fill className="object-cover" unoptimized />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--accent)]" />
        </div>
      )}
      {analysis && (
        <div className="absolute inset-x-0 bottom-0 hidden bg-black/60 p-2 group-hover:block print:block print:bg-transparent print:p-0 print:relative print:text-gray-600">
          <p className="text-xs text-white line-clamp-3 print:text-gray-700">{analysis}</p>
        </div>
      )}
    </div>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => { const res = await api.get(`/api/reports/${id}`); return res.data.data; },
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/reports/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report', id] }),
  });

  const deleteReport = useMutation({
    mutationFn: () => api.delete(`/api/reports/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); router.push('/reports'); },
  });

  if (isLoading) return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" /></div></AppLayout>;

  if (isError || !report) return (
    <AppLayout>
      <div className="flex flex-col items-center py-24 text-center">
        <p className="text-lg font-semibold text-gray-900 mb-2">Report not found</p>
        <p className="text-sm text-gray-500 mb-6">This report may have been deleted or is still being regenerated.<br />New reports usually take 20–30 seconds to appear.</p>
        <div className="flex gap-3">
          <Link href="/reports"><Button variant="secondary">View All Reports</Button></Link>
          <Link href="/activity"><Button>Go to Activity</Button></Link>
        </div>
      </div>
    </AppLayout>
  );

  const c = report.content as SupervisorReportContent;
  const isSafetyReport = report.type === 'SAFETY_REPORT';

  type EntryPhoto = { photo: { id: string; analysis?: { description: string } } };
  const allPhotos: EntryPhoto[] = (report.entries ?? []).flatMap(
    (re: { entry: { photos?: EntryPhoto[] } }) => re.entry?.photos ?? []
  );
  const isSnyderFormat = !!(c.inspectionsToday || c.generalNotes || c.toolboxTalk);

  const checklistItems: Array<{ number: number; label: string; key: keyof SupervisorReportContent }> = [
    { number: 1, label: 'Fire Prevention and Control Adequate?', key: 'firePreventionControl' },
    { number: 2, label: 'Electrical Installations Adequate?', key: 'electricalInstallations' },
    { number: 3, label: 'Guards on Tools and Equipment Adequate?', key: 'guardsOnToolsEquipment' },
    { number: 4, label: 'Ladders, Walkways, and Ramps Adequate?', key: 'laddersWalkwaysRamps' },
    { number: 5, label: 'Scaffolds, Work Platforms Adequate?', key: 'scaffoldsWorkPlatforms' },
    { number: 6, label: 'PPE Adequate?', key: 'ppeAdequate' },
    { number: 7, label: 'Cranes/Hoists - Inspection and Maintenance Adequate?', key: 'cranesHoists' },
    { number: 8, label: 'Heavy Equipment - Operation and Control Adequate?', key: 'heavyEquipment' },
    { number: 9, label: 'Motor Vehicles - Parking and Control Adequate?', key: 'motorVehicles' },
    { number: 10, label: 'Barricades/Handrails Adequate?', key: 'barricadesHandrails' },
    { number: 11, label: 'Materials Handling/Storage Adequate?', key: 'materialsHandlingStorage' },
    { number: 12, label: 'Excavations, Shoring, and Sloping Adequate?', key: 'excavationsShoringSloping' },
    { number: 13, label: 'Storage of Flammable/Combustible Liquids/Chemicals Adequate?', key: 'flammableStorage' },
    { number: 14, label: 'Welding/Cutting Operations Adequate?', key: 'weldingCutting' },
    { number: 15, label: 'Steel Erection Adequate?', key: 'steelErection' },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/reports"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <h1 className="text-xl font-bold text-gray-900 truncate">{report.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[report.status]}>{report.status}</Badge>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />Print / PDF
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Delete this report?</span>
                <Button size="sm" variant="danger" onClick={() => deleteReport.mutate()} loading={deleteReport.isPending}>Yes, delete</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-gray-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Status actions */}
        <div className="flex gap-2">
          {report.status === 'DRAFT' && (
            <Button size="sm" onClick={() => updateStatus.mutate('REVIEW')}>Mark for Review</Button>
          )}
          {report.status === 'REVIEW' && (
            <Button size="sm" onClick={() => updateStatus.mutate('FINAL')}>Mark as Final</Button>
          )}
          {report.status === 'FINAL' && (
            <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate('ARCHIVED')}>Archive</Button>
          )}
        </div>

        {isSafetyReport ? (
          <>
            {/* Snyder Construction Inspection / Safety Report */}
            <Card>
              <CardHeader>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Snyder Construction</h2>
                  <p className="text-base font-semibold text-gray-600">Inspection Report</p>
                  <p className="text-xs text-gray-400 mt-1">Subject: B Job Operations and Conditions MONTHLY/SAFETY REP</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-0">
                <Field label="Job Name" value={c.jobName} />
                <Field label="Job Address" value={c.jobAddress} />
                <Field label="Project Number" value={c.projectNumber} />
                <Field label="Submitted By" value={c.submittedBy} />
                <Field label="Date" value={c.date} />
                <Field label="Weather" value={c.weather} />
                <Field label="Temperature" value={c.temperature} />
                <Field label="Labourers on Site" value={c.labourersOnSite} />
                <Field label="Supervisors on Site" value={c.supervisorsOnSite} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 divide-gray-100">
                  {checklistItems.map((item) => (
                    <ChecklistItem key={item.number} number={item.number} label={item.label} value={c[item.key] as string | undefined} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : isSnyderFormat ? (
          <>
            {/* Snyder Construction Supervisor's Report */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Snyder Construction</h2>
                    <p className="text-base font-semibold text-gray-600">Supervisor&apos;s Report</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-0">
                <Field label="Job Name" value={c.jobName} />
                <Field label="Job Address" value={c.jobAddress} />
                <Field label="Project Number" value={c.projectNumber} />
                <Field label="Submitted By" value={c.submittedBy} />
                <Field label="Date" value={c.date} />
                <Field label="Weather" value={c.weather} />
                <Field label="Temperature" value={c.temperature} />
                <Field label="Labourers on Site" value={c.labourersOnSite} />
                <Field label="Equipment on Site" value={c.equipmentOnSite} />
                <Field label="Supervisors on Site" value={c.supervisorsOnSite} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-0">
                <QField number="1" label="Inspections Today" value={c.inspectionsToday} />
                <QField number="5" label="General Notes" value={c.generalNotes} />
                <QField number="7" label="Delays Due to Poor Site Conditions?" value={c.delaysDueToPoorConditions} />
                <QField number="8" label="Worker Illness Symptoms?" value={c.workerIllnessSymptoms} />
                <QField number="10" label="Toolbox Talk" value={c.toolboxTalk} />
                <QField number="11" label="Subtrades Onsite" value={c.subtradesOnsite} />
                <QField number="12" label="Health & Safety Specific Hazards Today" value={c.healthSafetyHazards} />
              </CardContent>
            </Card>
          </>
        ) : (
          /* Legacy format fallback */
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold text-gray-900">General Construction Field Report</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
                <span><strong>Project:</strong> {c.projectName}</span>
                <span><strong>Date:</strong> {c.date}</span>
                <span><strong>Supervisor:</strong> {c.supervisor}</span>
                {c.weather && <span><strong>Weather:</strong> {c.weather}</span>}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-gray-700">{c.summaryOfWork}</p>
            </CardContent>
          </Card>
        )}

        {/* Original transcript */}
        {c.transcript && (
          <Card>
            <CardHeader><CardTitle>Original Transcript</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap italic">&ldquo;{c.transcript}&rdquo;</p>
            </CardContent>
          </Card>
        )}

        {/* Site Photos */}
        {allPhotos.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Site Photos ({allPhotos.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {allPhotos.map((ep) => (
                  <PhotoThumbnail key={ep.photo.id} photoId={ep.photo.id} analysis={ep.photo.analysis?.description} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
