'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  FileQuestion, Upload, X, Paperclip, ArrowLeft, Send, AlertTriangle, Mic, Sparkles, Loader2, FileText,
} from 'lucide-react';
import { uploadFileToStorage, downloadBlobFile, fetchRfiPdf } from '@/lib/upload-client';

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

const disciplines = [
  'Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing',
  'Fire Protection', 'Civil', 'Landscape', 'Interior Design', 'General',
];

const roles = [
  'Project Manager', 'Superintendent', 'Owner', 'Architect', 'Engineer',
  'Subcontractor', 'Inspector', 'Consultant',
];

export function NewRFIForm({
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
  const [submitting, setSubmitting] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fieldNote, setFieldNote] = useState('');
  const [drafting, setDrafting] = useState(false);

  const [form, setForm] = useState({
    projectId: initialProjectId || (projects?.[0]?.id ?? ''),
    subject: '',
    question: '',
    discipline: '',
    drawingReference: '',
    specReference: '',
    priority: 'Normal',
    submittedBy: currentUser?.name || '',
    submittedByEmail: currentUser?.email || '',
    submittedByRole: 'Project Manager',
    assignedTo: '',
    assignedToEmail: '',
    assignedToRole: '',
    superintendentName: '',
    superintendentEmail: '',
    requestingSubName: '',
    requestingSubEmail: '',
    daysToRespond: '7',
    costImpact: 'TBD',
    scheduleImpact: 'TBD',
    notes: '',
  });

  const selectedProject = projects.find((p) => p.id === form.projectId);
  const nextNum = selectedProject
    ? `${selectedProject.projectNumber}-${String(selectedProject.nextSequence).padStart(3, '0')}`
    : '';

  useEffect(() => {
    if (!form.projectId) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${form.projectId}/contacts`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const list: Contact[] = data.contacts || [];
        setContacts(list);

        // Auto-fill Super if empty
        const superC = list.find((c) => c.role === 'Superintendent');
        const pmC = list.find((c) => c.role === 'Project Manager');
        setForm((prev) => ({
          ...prev,
          submittedBy: prev.submittedBy || pmC?.name || currentUser?.name || '',
          submittedByEmail: prev.submittedByEmail || pmC?.email || currentUser?.email || '',
          superintendentName: prev.superintendentName || superC?.name || '',
          superintendentEmail: prev.superintendentEmail || superC?.email || '',
        }));
      } catch {
        /* ignore */
      }
    })();
  }, [form.projectId, currentUser?.name, currentUser?.email]);

  useEffect(() => {
    const stored = sessionStorage.getItem('kodu_rfi_draft_note');
    if (stored) {
      setFieldNote(stored);
      sessionStorage.removeItem('kodu_rfi_draft_note');
    }
  }, []);

  const generateDraft = async (noteOverride?: string) => {
    const note = (noteOverride ?? fieldNote).trim();
    if (!note) {
      toast({ title: 'Type or dictate a field note first', variant: 'destructive' });
      return;
    }
    if (!form.projectId) {
      toast({ title: 'Select a project first', variant: 'destructive' });
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch('/api/rfis/draft-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note, projectId: form.projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const d = data.draft;
      setForm((prev) => ({
        ...prev,
        subject: d.subject || prev.subject,
        question: d.question || prev.question,
        discipline: d.discipline || prev.discipline,
        priority: d.priority || prev.priority,
        drawingReference: d.drawingReference || prev.drawingReference,
        specReference: d.specReference || prev.specReference,
      }));
      toast({ title: 'RFI draft generated — review and submit' });
    } catch (e: any) {
      toast({ title: e?.message ?? 'Failed to generate draft', variant: 'destructive' });
    } finally {
      setDrafting(false);
    }
  };

  const startFieldVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: 'Voice input is not available in this browser', variant: 'destructive' });
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.onresult = (ev: any) => {
      const text = ev.results[0][0].transcript;
      setFieldNote((prev) => (prev ? `${prev}\n${text}` : text));
    };
    rec.start();
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const pickContact = (
    contactId: string,
    nameField: string,
    emailField: string,
    roleField?: string
  ) => {
    const c = contacts.find((x) => x.id === contactId);
    if (!c) return;
    setForm((prev) => ({
      ...prev,
      [nameField]: c.name,
      [emailField]: c.email,
      ...(roleField ? { [roleField]: c.role } : {}),
    }));
  };

  const contactsByRole = (role: string) =>
    contacts.filter((c) => c.role === role || (role === 'Architect' && c.role === 'Engineer'));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File) => {
    const uploaded = await uploadFileToStorage(file);
    return {
      fileName: file.name,
      fileType: file.type,
      cloudStoragePath: uploaded.cloud_storage_path,
      isPublic: uploaded.isPublic,
      attachmentType: 'question',
    };
  };

  const handlePreviewPdf = async () => {
    if (!form.projectId || !form.subject.trim() || !form.question.trim()) {
      toast({ title: 'Enter project, subject, and question to preview', variant: 'destructive' });
      return;
    }
    setPreviewingPdf(true);
    try {
      const uploadedAttachments = [];
      for (const file of selectedFiles) {
        const att = await uploadFile(file);
        uploadedAttachments.push(att);
      }

      const res = await fetch('/api/rfis/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          daysToRespond: parseInt(form.daysToRespond) || 7,
          rfiNumberPreview: nextNum || undefined,
          attachments: uploadedAttachments,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to generate PDF preview');
      }
      const blob = await res.blob();
      downloadBlobFile(blob, `RFI_PREVIEW_${nextNum || 'draft'}.pdf`, true);
      toast({ title: 'PDF preview opened in a new tab' });
    } catch (e: any) {
      toast({ title: e?.message ?? 'Failed to generate PDF preview', variant: 'destructive' });
    } finally {
      setPreviewingPdf(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.projectId || !form.subject || !form.question) {
      toast({ title: 'Missing fields', description: 'Project, subject and question are required', variant: 'destructive' });
      return;
    }
    if (!form.assignedTo) {
      toast({ title: 'Missing field', description: 'Please specify who this RFI is assigned to', variant: 'destructive' });
      return;
    }
    if (!form.assignedToEmail) {
      toast({ title: 'Missing field', description: 'Assignee email is required so the RFI can be sent', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // Upload attachments
      const attachments = [];
      for (const file of selectedFiles) {
        const att = await uploadFile(file);
        attachments.push(att);
      }

      const res = await fetch('/api/rfis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, daysToRespond: parseInt(form.daysToRespond) || 7, attachments }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Failed to create RFI (${res.status})`);
      }

      const rfi = await res.json();
      toast({ title: 'RFI created', description: `RFI ${rfi?.rfiNumber ?? ''} submitted — generating PDF…` });

      try {
        const pdfBlob = await fetchRfiPdf(rfi.id);
        const fname = `RFI_${rfi.rfiNumber}_${(form.subject || '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.pdf`;
        downloadBlobFile(pdfBlob, fname);
        toast({ title: 'RFI PDF downloaded' });
      } catch (pdfErr: any) {
        toast({
          title: 'RFI saved — PDF pending',
          description: pdfErr?.message ?? 'You can download it from the RFI detail page',
          variant: 'destructive',
        });
      }

      router.push(`/dashboard/rfis/${rfi?.id ?? ''}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to create RFI', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New RFI</h1>
          {nextNum && <p className="text-sm text-[#C9A96E] font-mono font-semibold">RFI {nextNum}</p>}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl shadow-sm border border-border overflow-hidden"
      >
        {/* Gold top bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#C9A96E] to-[#B8944F]" />

        <div className="p-6 space-y-6">
          {/* Field note → AI draft */}
          <div className="rounded-lg border border-[#C9A96E]/30 bg-[#C9A96E]/5 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C9A96E] flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Field note → RFI draft
            </p>
            <textarea
              value={fieldNote}
              onChange={(e) => setFieldNote(e.target.value)}
              rows={3}
              placeholder="Dictate or paste what happened in the field (e.g. conflict duct vs beam grid C4, need engineer response)..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => generateDraft()}
                disabled={drafting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F1B33] text-[#C9A96E] rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate draft
              </button>
              <button type="button" onClick={startFieldVoice} className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm">
                <Mic className="w-4 h-4" /> Dictate
              </button>
            </div>
          </div>

          {/* Project Select */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Project *</label>
            <select
              value={form.projectId}
              onChange={(e) => update('projectId', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
            >
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>#{p.projectNumber} — {p.projectName}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Subject *</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => update('subject', e.target.value)}
              placeholder="Brief description of the RFI"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
            />
          </div>

          {/* Question */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Question / Details *</label>
            <textarea
              value={form.question}
              onChange={(e) => update('question', e.target.value)}
              rows={5}
              placeholder="Provide full details of the information you are requesting..."
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 resize-y"
            />
          </div>

          {/* Two-column fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Discipline</label>
              <select
                value={form.discipline}
                onChange={(e) => update('discipline', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              >
                <option value="">Select Discipline</option>
                {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => update('priority', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Drawing Reference</label>
              <input
                type="text"
                value={form.drawingReference}
                onChange={(e) => update('drawingReference', e.target.value)}
                placeholder="e.g., A-201, S-100"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Spec Reference</label>
              <input
                type="text"
                value={form.specReference}
                onChange={(e) => update('specReference', e.target.value)}
                placeholder="e.g., Section 08 11 00"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* People */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 lg:col-span-3 text-xs text-muted-foreground">
              Distribution: <strong>To</strong> = Assignee (must respond). <strong>CC</strong> = you (PM), Superintendent, Requesting Sub.
              {contacts.length === 0 && (
                <span className="block mt-1 text-amber-700">
                  No directory contacts yet —{' '}
                  <Link href={`/dashboard/directory?projectId=${form.projectId}`} className="underline text-[#C9A96E]">
                    add them in Project Directory
                  </Link>
                  , or type names/emails below.
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">PM / Submitted By</label>
              <input
                type="text"
                value={form.submittedBy}
                onChange={(e) => update('submittedBy', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">PM Email</label>
              <input
                type="email"
                value={form.submittedByEmail}
                onChange={(e) => update('submittedByEmail', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">PM Role</label>
              <select
                value={form.submittedByRole}
                onChange={(e) => update('submittedByRole', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              >
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assignee (Ball in Court) *</label>
              {contacts.length > 0 && (
                <select
                  className="w-full mb-1.5 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) pickContact(e.target.value, 'assignedTo', 'assignedToEmail', 'assignedToRole');
                  }}
                >
                  <option value="">Pick from directory…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.role}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={form.assignedTo}
                onChange={(e) => update('assignedTo', e.target.value)}
                placeholder="Who must respond"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assignee Email *</label>
              <input
                type="email"
                value={form.assignedToEmail}
                onChange={(e) => update('assignedToEmail', e.target.value)}
                placeholder="architect@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assignee Role</label>
              <select
                value={form.assignedToRole}
                onChange={(e) => update('assignedToRole', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              >
                <option value="">Select Role</option>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Superintendent (CC)</label>
              {contactsByRole('Superintendent').length > 0 && (
                <select
                  className="w-full mb-1.5 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) pickContact(e.target.value, 'superintendentName', 'superintendentEmail');
                  }}
                >
                  <option value="">Pick superintendent…</option>
                  {contactsByRole('Superintendent').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={form.superintendentName}
                onChange={(e) => update('superintendentName', e.target.value)}
                placeholder="Name"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Superintendent Email</label>
              <input
                type="email"
                value={form.superintendentEmail}
                onChange={(e) => update('superintendentEmail', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background"
              />
            </div>
            <div className="hidden lg:block" />

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Requesting Subcontractor (CC)</label>
              {contactsByRole('Subcontractor').length > 0 && (
                <select
                  className="w-full mb-1.5 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) pickContact(e.target.value, 'requestingSubName', 'requestingSubEmail');
                  }}
                >
                  <option value="">Pick subcontractor…</option>
                  {contactsByRole('Subcontractor').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={form.requestingSubName}
                onChange={(e) => update('requestingSubName', e.target.value)}
                placeholder="Sub who requested this RFI"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Subcontractor Email</label>
              <input
                type="email"
                value={form.requestingSubEmail}
                onChange={(e) => update('requestingSubEmail', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background"
              />
            </div>
          </div>

          {/* Response Time & Impact */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Days to Respond</label>
              <input
                type="number"
                value={form.daysToRespond}
                onChange={(e) => update('daysToRespond', e.target.value)}
                min="1"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cost Impact</label>
              <select
                value={form.costImpact}
                onChange={(e) => update('costImpact', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              >
                <option value="TBD">TBD</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Schedule Impact</label>
              <select
                value={form.scheduleImpact}
                onChange={(e) => update('scheduleImpact', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              >
                <option value="TBD">TBD</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
              placeholder="Any additional context or notes..."
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 resize-y"
            />
          </div>

          {/* Subcontractor appendix — merged at end of PDF (like COR) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Subcontractor Attachment (PDF)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Sub quote, drawing, or supporting document — appended at the <strong>end</strong> of the RFI PDF, same as CORs.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-[#C9A96E]/40 transition-colors">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-medium transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload Sub PDF
                  <input type="file" multiple onChange={handleFileSelect} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                </label>
                <span className="text-xs text-muted-foreground">PDF recommended · images also supported</span>
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                      <Paperclip className="w-3.5 h-3.5 text-[#C9A96E]" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => removeFile(i)} className="p-1 hover:bg-red-100 rounded">
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePreviewPdf}
              disabled={previewingPdf || submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#0F1B33] text-[#0F1B33] hover:bg-[#0F1B33]/5 font-semibold transition-colors disabled:opacity-50"
            >
              {previewingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {previewingPdf ? 'Generating…' : 'Preview PDF'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || previewingPdf}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#C9A96E] hover:bg-[#B8944F] text-white font-semibold transition-colors disabled:opacity-50 shadow-md"
            >
              {submitting ? (
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? 'Submitting...' : 'Submit RFI'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
