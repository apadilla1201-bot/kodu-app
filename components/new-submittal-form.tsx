'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import { ArrowLeft, Send, FileStack } from 'lucide-react';
import Link from 'next/link';

interface ProjectData {
  id: string;
  projectNumber: string;
  projectName: string;
  nextSequence: number;
}

const types = ['Shop Drawing', 'Product Data', 'Sample', 'Mock-up', 'Other'];

export function NewSubmittalForm({
  projects,
  initialProjectId,
}: {
  projects: ProjectData[];
  initialProjectId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    projectId: initialProjectId || projects?.[0]?.id || '',
    title: '',
    description: '',
    submittalType: 'Shop Drawing',
    specSection: '',
    subcontractor: '',
    priority: 'Normal',
    requiredDate: '',
    submittedBy: 'Augusto Padilla',
    assignedTo: '',
    assignedToEmail: '',
    assignedToRole: 'Architect',
    reviewerEmail: '',
    subcontractorEmail: '',
    superintendentName: '',
    superintendentEmail: '',
    notes: '',
  });

  const selected = projects.find((p) => p.id === form.projectId);
  const previewNumber = selected
    ? `${selected.projectNumber}-SUB-${String(selected.nextSequence).padStart(3, '0')}`
    : '';

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (asDraft: boolean) => {
    if (!form.projectId || !form.title.trim()) {
      toast({ title: t('submittals.projectTitleRequired'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/submittals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          status: asDraft ? 'Draft' : 'Submitted',
          requiredDate: form.requiredDate || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || t('submittals.createError'));
      }
      const created = await res.json();
      toast({ title: asDraft ? t('submittals.draftSaved') : t('submittals.submittalSubmitted') });
      router.push(`/dashboard/submittals/${created.id}`);
      router.refresh();
    } catch (e: any) {
      toast({ title: e?.message ?? t('common.error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/submittals" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> {t('submittals.backToSubmittals')}
      </Link>

      <div className="flex items-center gap-3">
        <FileStack className="w-8 h-8 text-[#C9A96E]" />
        <div>
          <h1 className="text-2xl font-bold">{t('submittals.newSubmittal')}</h1>
          {previewNumber && <p className="text-sm text-muted-foreground font-mono">{previewNumber}</p>}
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-4 shadow-sm">
        <div>
          <label className="text-sm font-medium">{t('submittals.projectLabel')}</label>
          <select
            value={form.projectId}
            onChange={(e) => update('projectId', e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg bg-background"
          >
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>#{p.projectNumber} — {p.projectName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">{t('submittals.titleLabel')}</label>
          <input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg bg-background"
            placeholder={t('submittals.titlePlaceholder')}
          />
        </div>

        <div>
          <label className="text-sm font-medium">{t('submittals.description')}</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={4}
            className="w-full mt-1 px-3 py-2 border rounded-lg bg-background"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">{t('submittals.type')}</label>
            <select value={form.submittalType} onChange={(e) => update('submittalType', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background">
              {types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.priority')}</label>
            <select value={form.priority} onChange={(e) => update('priority', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background">
              {['Low', 'Normal', 'High', 'Urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.specLabel')}</label>
            <input value={form.specSection} onChange={(e) => update('specSection', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.subcontractor')}</label>
            <input value={form.subcontractor} onChange={(e) => update('subcontractor', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.requiredDate')}</label>
            <input type="date" value={form.requiredDate} onChange={(e) => update('requiredDate', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.submittedBy')}</label>
            <input value={form.submittedBy} onChange={(e) => update('submittedBy', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.assignedToReviewer')}</label>
            <input value={form.assignedTo} onChange={(e) => update('assignedTo', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" placeholder={t('submittals.assignedToPlaceholder')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.assignedToEmail')}</label>
            <input type="email" value={form.assignedToEmail} onChange={(e) => update('assignedToEmail', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.reviewerEmail')}</label>
            <input type="email" value={form.reviewerEmail} onChange={(e) => update('reviewerEmail', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.subcontractorEmail')}</label>
            <input type="email" value={form.subcontractorEmail} onChange={(e) => update('subcontractorEmail', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.superintendentCc')}</label>
            <input value={form.superintendentName} onChange={(e) => update('superintendentName', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" placeholder={t('submittals.namePlaceholder')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.superintendentEmail')}</label>
            <input type="email" value={form.superintendentEmail} onChange={(e) => update('superintendentEmail', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className="px-5 py-2.5 border rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {t('submittals.saveDraft')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A96E] hover:bg-[#B8944F] text-white rounded-lg font-semibold disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {t('submittals.submitSubmittal')}
          </button>
        </div>
      </div>
    </div>
  );
}
