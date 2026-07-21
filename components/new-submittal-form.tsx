'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import { ArrowLeft, Send, FileStack, Paperclip, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { uploadFileToStorage } from '@/lib/upload-client';

interface ProjectData {
  id: string;
  projectNumber: string;
  projectName: string;
  nextSequence: number;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  role: string;
}

const types = ['Shop Drawing', 'Product Data', 'Sample', 'Mock-up', 'Other'];

export function NewSubmittalForm({
  projects,
  initialProjectId,
  currentUser,
}: {
  projects: ProjectData[];
  initialProjectId?: string;
  currentUser?: { name: string; email: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    projectId: initialProjectId || projects?.[0]?.id || '',
    title: '',
    description: '',
    submittalType: 'Shop Drawing',
    specSection: '',
    subcontractor: '',
    priority: 'Normal',
    requiredDate: '',
    submittedBy: currentUser?.name || '',
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

  // Directorio del proyecto (mismo patrón que el módulo de RFI):
  // jala contactos y auto-rellena Superintendent y PM.
  useEffect(() => {
    if (!form.projectId) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${form.projectId}/contacts`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const list: Contact[] = data.contacts || [];
        setContacts(list);

        const superC = list.find((c) => c.role === 'Superintendent');
        const pmC = list.find((c) => c.role === 'Project Manager');
        setForm((prev) => ({
          ...prev,
          submittedBy: prev.submittedBy || pmC?.name || currentUser?.name || '',
          superintendentName: prev.superintendentName || superC?.name || '',
          superintendentEmail: prev.superintendentEmail || superC?.email || '',
        }));
      } catch {
        /* ignore */
      }
    })();
  }, [form.projectId, currentUser?.name]);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const pickContact = (
    contactId: string,
    nameField?: string,
    emailField?: string,
    roleField?: string,
  ) => {
    const c = contacts.find((x) => x.id === contactId);
    if (!c) return;
    setForm((prev) => ({
      ...prev,
      ...(nameField ? { [nameField]: c.name } : {}),
      ...(emailField ? { [emailField]: c.email } : {}),
      ...(roleField ? { [roleField]: c.role } : {}),
    }));
  };

  const DirectorySelect = ({
    onPick,
    className = '',
  }: {
    onPick: (contactId: string) => void;
    className?: string;
  }) => {
    if (contacts.length === 0) return null;
    return (
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
          e.target.value = '';
        }}
        className={`mt-1 px-2 py-1.5 border rounded-lg bg-background text-xs text-muted-foreground ${className}`}
      >
        <option value="">{t('submittals.selectFromDirectory')}</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} — {c.role}
          </option>
        ))}
      </select>
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!form.projectId || !form.title.trim()) {
      toast({ title: t('submittals.projectTitleRequired'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // 1) Subir anexos (planos y/o cualquier archivo) al storage
      const attachments = [];
      for (const file of selectedFiles) {
        const uploaded = await uploadFileToStorage(file);
        attachments.push({
          fileName: file.name,
          fileType: file.type || null,
          cloudStoragePath: uploaded.cloud_storage_path,
          isPublic: uploaded.isPublic,
        });
      }

      // 2) Crear el submittal con los anexos ya subidos
      const res = await fetch('/api/submittals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          status: asDraft ? 'Draft' : 'Submitted',
          requiredDate: form.requiredDate || null,
          attachments,
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
          {contacts.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {t('submittals.noDirectoryContacts')}{' '}
              <Link href={`/dashboard/directory?projectId=${form.projectId}`} className="underline text-[#C9A96E]">
                {t('submittals.addToDirectory')}
              </Link>
            </p>
          )}
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

        {/* Anexos: planos y/o cualquier archivo */}
        <div className="border border-dashed rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="text-sm font-medium inline-flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-[#C9A96E]" />
              {t('submittals.attachments')}
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-muted transition-colors"
            >
              {t('submittals.attachFiles')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5 mt-3">
              {selectedFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <Paperclip className="w-3.5 h-3.5 text-[#C9A96E]" />
                  <span className="text-sm flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
            <DirectorySelect
              onPick={(id) => {
                const c = contacts.find((x) => x.id === id);
                setForm((prev) => ({
                  ...prev,
                  subcontractorEmail: c?.email ?? prev.subcontractorEmail,
                  subcontractor: prev.subcontractor || c?.name || prev.subcontractor,
                }));
              }}
            />
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
            <DirectorySelect onPick={(id) => pickContact(id, 'assignedTo', 'assignedToEmail', 'assignedToRole')} />
            <input value={form.assignedTo} onChange={(e) => update('assignedTo', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" placeholder={t('submittals.assignedToPlaceholder')} />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.assignedToEmail')}</label>
            <input type="email" value={form.assignedToEmail} onChange={(e) => update('assignedToEmail', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.reviewerEmail')}</label>
            <DirectorySelect onPick={(id) => pickContact(id, undefined, 'reviewerEmail')} />
            <input type="email" value={form.reviewerEmail} onChange={(e) => update('reviewerEmail', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.subcontractorEmail')}</label>
            <input type="email" value={form.subcontractorEmail} onChange={(e) => update('subcontractorEmail', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">{t('submittals.superintendentCc')}</label>
            <DirectorySelect onPick={(id) => pickContact(id, 'superintendentName', 'superintendentEmail')} />
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
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? t('submittals.uploadingAttachments') : t('submittals.submitSubmittal')}
          </button>
        </div>
      </div>
    </div>
  );
}
