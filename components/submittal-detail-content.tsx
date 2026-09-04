'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import { ArrowLeft, FileStack, CheckCircle2, RotateCcw, Paperclip, Download, Loader2, FileText, Mail, Send, X } from 'lucide-react';
import { downloadStorageFile, uploadFileToStorage } from '@/lib/upload-client';

interface SubmittalAttachment {
  id: string;
  fileName: string;
  fileType: string | null;
  cloudStoragePath: string;
  isPublic: boolean;
}

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
  attachments?: SubmittalAttachment[];
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
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = submittal.attachments ?? [];

  const setStatus = async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/submittals/${submittal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, reviewedBy: 'Augusto Padilla' }),
      });
      if (!res.ok) throw new Error(t('submittals.updateError'));
      toast({ title: t('submittals.statusUpdated', { status }) });
      router.refresh();
    } catch (e: any) {
      toast({ title: e?.message ?? t('common.error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (att: SubmittalAttachment) => {
    setDownloadingFile(att.id);
    try {
      await downloadStorageFile(att.cloudStoragePath, att.fileName);
    } catch (e: any) {
      toast({ title: e?.message ?? t('common.error'), variant: 'destructive' });
    } finally {
      setDownloadingFile(null);
    }
  };

  // Anexar archivos a un submittal ya existente (PATCH con attachments)
  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newAttachments = [];
      for (const file of files) {
        const uploaded = await uploadFileToStorage(file);
        newAttachments.push({
          fileName: file.name,
          fileType: file.type || null,
          cloudStoragePath: uploaded.cloud_storage_path,
          isPublic: uploaded.isPublic,
        });
      }
      const res = await fetch(`/api/submittals/${submittal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ attachments: newAttachments }),
      });
      if (!res.ok) throw new Error(t('submittals.updateError'));
      toast({ title: t('submittals.attachmentAdded') });
      router.refresh();
    } catch (err: any) {
      toast({ title: err?.message ?? t('common.error'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // Enviar el reporte (portada koduPM + anexos mergeados) como PDF adjunto
  const handleSendReport = async () => {
    const emails = emailTo.split(',').map((e) => e.trim()).filter((e) => e.length > 0);
    if (emails.length === 0) return;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      toast({ title: 'Invalid emails', description: `Check: ${invalid.join(', ')}`, variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/submittals/${submittal.id}/send-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emails, message: emailMsg.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 413) {
        toast({ title: t('submittals.reportTooLarge'), variant: 'destructive' });
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? t('submittals.sendReportError'));
      toast({ title: t('submittals.reportSent', { email: `${data?.sentTo?.length ?? 0} recipient(s)` }) });
      setEmailOpen(false);
      setEmailTo('');
      setEmailMsg('');
    } catch (err: any) {
      toast({ title: err?.message ?? t('submittals.sendReportError'), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const detailFields = [
    [t('submittals.type'), submittal.submittalType],
    [t('submittals.priority'), submittal.priority],
    [t('submittals.section'), submittal.specSection ?? '—'],
    [t('submittals.subcontractor'), submittal.subcontractor ?? '—'],
    [t('submittals.colRequired'), fmtDate(submittal.requiredDate)],
    [t('submittals.submittedBy'), submittal.submittedBy ?? '—'],
    [t('submittals.assignedTo'), submittal.assignedTo ?? '—'],
    [t('submittals.submittedDate'), fmtDate(submittal.submittedDate)],
    [t('submittals.client'), submittal.project.client],
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/submittals" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> {t('submittals.backToSubmittals')}
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
        <div className="flex items-center gap-2 self-start">
          <a
            href={`/api/submittals/${submittal.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#0F1B33] hover:bg-[#1B2A4A] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          >
            <FileText className="w-4 h-4" /> PDF
          </a>
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8955A] text-[#0F1B33] px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          >
            <Mail className="w-4 h-4" /> {t('submittals.sendByEmail')}
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyles[submittal.status] ?? 'bg-gray-100'}`}>
            {submittal.status}
          </span>
        </div>
      </div>

      {submittal.ballInCourt && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs uppercase text-amber-700 font-medium">{t('submittals.ballInCourt')}</p>
          <p className="font-semibold text-amber-900">
            {submittal.ballInCourt}
            {submittal.ballInCourtRole ? ` (${submittal.ballInCourtRole})` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {detailFields.map(([label, value]) => (
          <div key={label} className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase">{label}</p>
            <p className="font-medium mt-1">{value}</p>
          </div>
        ))}
      </div>

      {submittal.description && (
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold mb-2">{t('submittals.description')}</h2>
          <p className="text-sm whitespace-pre-wrap">{submittal.description}</p>
        </div>
      )}

      {/* Anexos: planos y/o cualquier archivo */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-semibold inline-flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-[#C9A96E]" />
            {t('submittals.attachments')}
            <span className="text-sm font-normal text-muted-foreground">({attachments.length})</span>
          </h2>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            {uploading ? t('submittals.uploadingAttachments') : t('submittals.attachFiles')}
          </button>
          <input ref={fileInputRef} type="file" multiple onChange={handleAttach} className="hidden" />
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('submittals.noAttachments')}</p>
        ) : (
          <div className="space-y-1.5">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                <Paperclip className="w-3.5 h-3.5 text-[#C9A96E]" />
                <span className="text-sm flex-1 truncate">{att.fileName}</span>
                <button
                  onClick={() => handleDownload(att)}
                  disabled={downloadingFile === att.id}
                  className="p-1 hover:bg-[#C9A96E]/10 rounded text-[#C9A96E] disabled:opacity-50"
                  title={t('submittals.download')}
                >
                  {downloadingFile === att.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {submittal.status === 'Draft' && (
          <button disabled={loading} onClick={() => setStatus('Submitted')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {t('submittals.markSubmitted')}
          </button>
        )}
        {(submittal.status === 'Submitted' || submittal.status === 'Under Review') && (
          <>
            <button disabled={loading} onClick={() => setStatus('Approved')} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> {t('submittals.approve')}
            </button>
            <button disabled={loading} onClick={() => setStatus('Revise and Resubmit')} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              <RotateCcw className="w-4 h-4" /> {t('submittals.resubmit')}
            </button>
          </>
        )}
      </div>

      {/* Modal: enviar reporte por email (PDF merge con anexos) */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#0F1B33] px-5 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#C9A96E]" /> {t('submittals.sendReportTitle')}
              </h3>
              <button type="button" onClick={() => setEmailOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {t('submittals.recipientEmail')}
                </label>
                <textarea
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  rows={2}
                  placeholder="architect@firm.com, engineer@company.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">Separate multiple emails with commas.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {t('submittals.optionalMessage')}
                </label>
                <textarea
                  value={emailMsg}
                  onChange={(e) => setEmailMsg(e.target.value)}
                  placeholder={t('submittals.messagePlaceholder')}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]"
                />
              </div>
              <p className="text-xs text-slate-500">{t('submittals.sendReportHint')}</p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEmailOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={sending || !emailTo.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0F1B33] text-white hover:bg-[#1B2A4A] disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? t('submittals.sendingReport') : t('submittals.sendNow')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
