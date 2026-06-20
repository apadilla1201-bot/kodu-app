'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  FileQuestion, Upload, X, Paperclip, ArrowLeft, Send, AlertTriangle,
} from 'lucide-react';

interface ProjectData {
  id: string;
  projectNumber: string;
  projectName: string;
  nextSequence: number;
}

const disciplines = [
  'Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing',
  'Fire Protection', 'Civil', 'Landscape', 'Interior Design', 'General',
];

const roles = [
  'Project Manager', 'Superintendent', 'Owner', 'Architect', 'Engineer',
  'Subcontractor', 'Inspector', 'Consultant',
];

export function NewRFIForm({ projects, initialProjectId }: { projects: ProjectData[]; initialProjectId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [form, setForm] = useState({
    projectId: initialProjectId || (projects?.[0]?.id ?? ''),
    subject: '',
    question: '',
    discipline: '',
    drawingReference: '',
    specReference: '',
    priority: 'Normal',
    submittedBy: 'Augusto Padilla',
    submittedByRole: 'Project Manager',
    assignedTo: '',
    assignedToRole: '',
    daysToRespond: '7',
    costImpact: 'TBD',
    scheduleImpact: 'TBD',
    notes: '',
  });

  const selectedProject = projects.find((p) => p.id === form.projectId);
  const nextNum = selectedProject
    ? `${selectedProject.projectNumber}-${String(selectedProject.nextSequence).padStart(3, '0')}`
    : '';

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File) => {
    const presignRes = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }),
    });
    const presignData = await presignRes.json();
    if (!presignRes.ok) throw new Error('Failed to get upload URL');

    const uploadHeaders: Record<string, string> = { 'Content-Type': file.type };
    const url = presignData.uploadUrl ?? '';
    if (url.includes('content-disposition')) {
      uploadHeaders['Content-Disposition'] = 'attachment';
    }
    await fetch(url, { method: 'PUT', headers: uploadHeaders, body: file });

    return {
      fileName: file.name,
      fileType: file.type,
      cloudStoragePath: presignData.cloud_storage_path ?? '',
      isPublic: false,
      attachmentType: 'question',
    };
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
        body: JSON.stringify({ ...form, daysToRespond: parseInt(form.daysToRespond) || 7, attachments }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create RFI');
      }

      const rfi = await res.json();
      toast({ title: 'RFI Created', description: `RFI ${rfi?.rfiNumber ?? ''} has been submitted` });
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
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Submitted By</label>
              <input
                type="text"
                value={form.submittedBy}
                onChange={(e) => update('submittedBy', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Submitted By Role</label>
              <select
                value={form.submittedByRole}
                onChange={(e) => update('submittedByRole', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              >
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assigned To *</label>
              <input
                type="text"
                value={form.assignedTo}
                onChange={(e) => update('assignedTo', e.target.value)}
                placeholder="Name of the person who must respond"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assigned To Role</label>
              <select
                value={form.assignedToRole}
                onChange={(e) => update('assignedToRole', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
              >
                <option value="">Select Role</option>
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
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

          {/* Attachments */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Attachments</label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-[#C9A96E]/40 transition-colors">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-medium transition-colors">
                  <Upload className="w-4 h-4" />
                  Choose Files
                  <input type="file" multiple onChange={handleFileSelect} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.dwg,.doc,.docx,.xlsx" />
                </label>
                <span className="text-xs text-muted-foreground">PDF, images, drawings, documents</span>
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
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
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
