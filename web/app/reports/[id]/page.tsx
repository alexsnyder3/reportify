'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { statusColors } from '@/lib/utils';
import { ArrowLeft, Printer } from 'lucide-react';
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

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => { const res = await api.get(`/api/reports/${id}`); return res.data.data; },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/reports/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report', id] }),
  });

  if (isLoading) return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div></AppLayout>;
  if (!report) return <AppLayout><p className="text-red-600">Report not found</p></AppLayout>;

  const c = report.content as SupervisorReportContent;
  const isSnyderFormat = !!(c.inspectionsToday || c.generalNotes || c.toolboxTalk);

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

        {isSnyderFormat ? (
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
      </div>
    </AppLayout>
  );
}
