'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, statusColors } from '@/lib/utils';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';

interface ReportContent {
  projectName: string;
  date: string;
  supervisor: string;
  weather?: string;
  summaryOfWork: string;
  labour: string[];
  subcontractors: string[];
  equipment: string[];
  materialsDelivered: string[];
  delays: string[];
  safetyObservations: string[];
  qualityIssues: string[];
  deficiencies: string[];
  photosReferenced: string[];
  actionItems: string[];
  tomorrowsWork: string;
  possibleChangeOrderItems: string[];
  transcript: string;
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
            {item}
          </li>
        ))}
      </ul>
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

  const content = report.content as ReportContent;

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
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

        {/* Report body */}
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-900">General Construction Field Report</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
                <span><strong>Project:</strong> {content.projectName}</span>
                <span><strong>Date:</strong> {content.date}</span>
                <span><strong>Supervisor:</strong> {content.supervisor}</span>
                {content.weather && <span><strong>Weather:</strong> {content.weather}</span>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Summary of Work</h3>
              <p className="text-sm leading-relaxed text-gray-700">{content.summaryOfWork}</p>
            </div>
            <Section title="Labour" items={content.labour} />
            <Section title="Subcontractors" items={content.subcontractors} />
            <Section title="Equipment" items={content.equipment} />
            <Section title="Materials Delivered" items={content.materialsDelivered} />
            <Section title="Delays" items={content.delays} />
            <Section title="Safety Observations" items={content.safetyObservations} />
            <Section title="Quality Issues" items={content.qualityIssues} />
            <Section title="Deficiencies" items={content.deficiencies} />
            <Section title="Photos Referenced" items={content.photosReferenced} />
            <Section title="Action Items" items={content.actionItems} />
            {content.tomorrowsWork && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Tomorrow's Planned Work</h3>
                <p className="text-sm text-gray-700">{content.tomorrowsWork}</p>
              </div>
            )}
            <Section title="Possible Change Order Items" items={content.possibleChangeOrderItems} />
          </CardContent>
        </Card>

        {/* Original transcript */}
        {content.transcript && (
          <Card>
            <CardHeader><CardTitle>Original Transcript</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap italic">&ldquo;{content.transcript}&rdquo;</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
