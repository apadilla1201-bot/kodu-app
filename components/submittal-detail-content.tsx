'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileStack, CheckCircle2, RotateCcw } from 'lucide-react';

interface SubmittalData {
  id: string;
  submittalNumber: string;
  title: string;
  description: string | null;
  submittalType: string;
  specSection: string | null;
  subcontractor: string | null;
  priority: string;
  status: string;
  requiredDate: string | null;
  submittedBy: string | null;
  submittedDate: string | null;
  reviewedBy: string | null;
  reviewedDate: string | null;
  notes: string | null;
  ballInCourt?: string | null;
  ballInCourtRole?: string | null;
  assignedTo?: string | null;
  project: {
    id: string;
    projectNumber: string;
    projectName: string;
    client: string;
    location: string | null;
  };
}

const statusStyles: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  'Revise and Resubmit': 'bg-orange-100 text-orange-700',
  Rejected: 'bg-red-100 text-red-700',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function SubmittalDetailContent({ submittal }: { submittal: SubmittalData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const setStatus = async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/submittals/${submittal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, reviewedBy: 'Augusto Padilla' }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      toast({ title: `Estado: ${status}` });
      router.refresh();
    } catch (e: any) {
      toast({ title: e?.message ?? 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/submittals" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Volver a Submittals
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <FileStack className="w-4 h-4" />
            #{submittal.project.projectNumber} — {submittal.project.projectName}
          </div>
          <h1 className="text-2xl font-bold">{submittal.submittalNumber}</h1>
          <p className="text-lg text-muted-foreground mt-1">{submittal.title}</p>
        </div>
        <span className={`self-start px-3 py-1 rounded-full text-sm font-medium ${statusStyles[submittal.status] ?? 'bg-gray-100'}`}>
          {submittal.status}
        </span>
      </div>

      {submittal.ballInCourt && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs uppercase text-amber-700 font-medium">Ball in Court</p>
          <p className="font-semibold text-amber-900">
            {submittal.ballInCourt}
            {submittal.ballInCourtRole ? ` (${submittal.ballInCourtRole})` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          ['Tipo', submittal.submittalType],
          ['Prioridad', submittal.priority],
          ['Sección', submittal.specSection ?? '—'],
          ['Subcontratista', submittal.subcontractor ?? '—'],
          ['Requerido', fmtDate(submittal.requiredDate)],
          ['Enviado por', submittal.submittedBy ?? '—'],
          ['Asignado a', submittal.assignedTo ?? '—'],
          ['Fecha envío', fmtDate(submittal.submittedDate)],
          ['Cliente', submittal.project.client],
        ].map(([label, value]) => (
          <div key={label} className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase">{label}</p>
            <p className="font-medium mt-1">{value}</p>
          </div>
        ))}
      </div>

      {submittal.description && (
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold mb-2">Descripción</h2>
          <p className="text-sm whitespace-pre-wrap">{submittal.description}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {submittal.status === 'Draft' && (
          <button disabled={loading} onClick={() => setStatus('Submitted')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            Marcar como Enviado
          </button>
        )}
        {(submittal.status === 'Submitted' || submittal.status === 'Under Review') && (
          <>
            <button disabled={loading} onClick={() => setStatus('Approved')} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> Aprobar
            </button>
            <button disabled={loading} onClick={() => setStatus('Revise and Resubmit')} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <RotateCcw className="w-4 h-4" /> Reenviar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
