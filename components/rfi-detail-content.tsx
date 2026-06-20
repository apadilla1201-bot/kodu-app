'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, FileQuestion, Clock, CheckCircle2, AlertTriangle, Send,
  Paperclip, Upload, X, Download, MessageSquare, CalendarDays, User,
  Building2, MapPin, FileText,
} from 'lucide-react';


interface Attachment {
  id: string;
  fileName: string;
  fileType: string | null;
  cloudStoragePath: string;
  isPublic: boolean;
  attachmentType: string;
}

interface RFIData {
  id: string;
  rfiNumber: string;
  subject: string;
  question: string;
  discipline: string | null;
  drawingReference: string | null;
  specReference: string | null;
  priority: string;
  status: string;
  submittedBy: string;
  submittedByRole: string | null;
  assignedTo: string;
  assignedToRole: string | null;
  dateSubmitted: string;
  dateDue: string | null;
  daysToRespond: number;
  responseText: string | null;
  responseBy: string | null;
  responseDate: string | null;
  costImpact: string;
  scheduleImpact: string;
  scheduleImpactDays: number | null;
  notes: string | null;
  attachments: Attachment[];
  project: {
    id: string;
    projectNumber: string;
    projectName: string;
    client: string;
    location: string | null;
  };
}

const statusConfig: Record<string, { color: string; bg: string; border: string }> = {
  Open: { color: 'text-blue-700', bg: 'bg-blue-500', border: 'border-blue-500' },
  'Under Review': { color: 'text-amber-700', bg: 'bg-amber-500', border: 'border-amber-500' },
  Answered: { color: 'text-green-700', bg: 'bg-green-500', border: 'border-green-500' },
  Closed: { color: 'text-gray-500', bg: 'bg-gray-400', border: 'border-gray-400' },
};

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Urgent: { color: 'text-red-700', bg: 'bg-red-100' },
  High: { color: 'text-orange-700', bg: 'bg-orange-100' },
  Normal: { color: 'text-blue-700', bg: 'bg-blue-100' },
  Low: { color: 'text-gray-600', bg: 'bg-gray-100' },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function isOverdue(dateDue: string | null, status: string): boolean {
  if (!dateDue || status === 'Answered' || status === 'Closed') return false;
  return new Date(dateDue) < new Date();
}

function daysRemaining(dateDue: string | null, status: string): string {
  if (!dateDue || status === 'Answered' || status === 'Closed') return '';
  const diff = Math.ceil((new Date(dateDue).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff === 0) return 'Due today';
  return `${diff} days remaining`;
}

export function RFIDetailContent({ rfi }: { rfi: RFIData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [statusLoading, setStatusLoading] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [responseBy, setResponseBy] = useState('Augusto Padilla');
  const [responseCostImpact, setResponseCostImpact] = useState(rfi?.costImpact ?? 'TBD');
  const [responseScheduleImpact, setResponseScheduleImpact] = useState(rfi?.scheduleImpact ?? 'TBD');
  const [responseFiles, setResponseFiles] = useState<File[]>([]);
  const [respondLoading, setRespondLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleGeneratePdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/rfis/${rfi.id}/pdf`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const fname = `RFI_${rfi.rfiNumber}_${(rfi.subject ?? '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.pdf`;
      const reader = new FileReader();
      reader.onloadend = () => {
        const a = document.createElement('a');
        a.href = reader.result as string;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
      toast({ title: 'PDF Generated', description: 'RFI PDF downloaded successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  const sc = statusConfig[rfi?.status ?? 'Open'] ?? statusConfig.Open;
  const pc = priorityConfig[rfi?.priority ?? 'Normal'] ?? priorityConfig.Normal;
  const overdue = isOverdue(rfi?.dateDue, rfi?.status);
  const remaining = daysRemaining(rfi?.dateDue, rfi?.status);

  const questionAttachments = (rfi?.attachments ?? []).filter((a) => a.attachmentType === 'question');
  const responseAttachments = (rfi?.attachments ?? []).filter((a) => a.attachmentType === 'response');

  const updateStatus = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/rfis/${rfi.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast({ title: 'Status Updated', description: `RFI is now ${newStatus}` });
      router.refresh();
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDownload = async (att: Attachment) => {
    setDownloadingFile(att.id);
    try {
      const res = await fetch(`/api/upload/presigned?download=true&path=${encodeURIComponent(att.cloudStoragePath)}`);
      const data = await res.json();
      const url = data?.url ?? data?.downloadUrl ?? '';
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = att.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to download file', variant: 'destructive' });
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) {
      toast({ title: 'Missing response', description: 'Please enter a response', variant: 'destructive' });
      return;
    }
    setRespondLoading(true);
    try {
      const attachments = [];
      for (const file of responseFiles) {
        const presignRes = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: false }),
        });
        const presignData = await presignRes.json();
        const uploadHeaders: Record<string, string> = { 'Content-Type': file.type };
        const url = presignData.uploadUrl ?? '';
        if (url.includes('content-disposition')) {
          uploadHeaders['Content-Disposition'] = 'attachment';
        }
        await fetch(url, { method: 'PUT', headers: uploadHeaders, body: file });
        attachments.push({
          fileName: file.name,
          fileType: file.type,
          cloudStoragePath: presignData.cloud_storage_path ?? '',
          isPublic: false,
        });
      }

      const res = await fetch(`/api/rfis/${rfi.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseText,
          responseBy,
          costImpact: responseCostImpact,
          scheduleImpact: responseScheduleImpact,
          attachments,
        }),
      });
      if (!res.ok) throw new Error('Failed to respond');
      toast({ title: 'Response Submitted', description: 'RFI has been answered' });
      router.refresh();
      setShowResponse(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to submit response', variant: 'destructive' });
    } finally {
      setRespondLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/rfis')} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">RFI {rfi?.rfiNumber ?? ''}</h1>
            <p className="text-sm text-muted-foreground">{rfi?.project?.projectName ?? ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePdf}
            disabled={pdfLoading}
            className="inline-flex items-center gap-2 bg-[#0F1B33] hover:bg-[#1B2A4A] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {pdfLoading ? 'Generando...' : 'Descargar PDF'}
          </button>
          <select
            value={rfi?.status ?? 'Open'}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={statusLoading}
            className={`px-4 py-2 rounded-lg border-2 ${sc.border} bg-card text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 disabled:opacity-50`}
          >
            <option value="Open">Open</option>
            <option value="Under Review">Under Review</option>
            <option value="Answered">Answered</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Status bar */}
      <div className={`${sc.bg} rounded-lg px-4 py-2.5 flex items-center justify-between`}>
        <span className="text-white font-semibold text-sm tracking-wide">STATUS: {(rfi?.status ?? 'Open').toUpperCase()}</span>
        {overdue && (
          <span className="inline-flex items-center gap-1 text-white font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            OVERDUE
          </span>
        )}
        {remaining && !overdue && (
          <span className="text-white/80 text-sm">{remaining}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Question Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl shadow-sm border border-border overflow-hidden"
          >
            <div className="bg-[#0F1B33] px-5 py-3 flex items-center gap-2">
              <FileQuestion className="w-4 h-4 text-[#C9A96E]" />
              <span className="text-white font-semibold text-sm">REQUEST FOR INFORMATION</span>
            </div>
            <div className="p-5 space-y-4">
              <h2 className="text-lg font-bold text-foreground">{rfi?.subject ?? ''}</h2>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">{rfi?.question ?? ''}</p>
              </div>

              {/* Question Attachments */}
              {questionAttachments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Attachments</p>
                  <div className="space-y-1.5">
                    {questionAttachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                        <Paperclip className="w-3.5 h-3.5 text-[#C9A96E]" />
                        <span className="text-sm flex-1 truncate">{att.fileName}</span>
                        <button
                          onClick={() => handleDownload(att)}
                          disabled={downloadingFile === att.id}
                          className="p-1 hover:bg-[#C9A96E]/10 rounded text-[#C9A96E]"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Response Section */}
          {rfi?.responseText ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-xl shadow-sm border border-green-200 overflow-hidden"
            >
              <div className="bg-green-600 px-5 py-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-white" />
                <span className="text-white font-semibold text-sm">RESPONSE</span>
                <span className="ml-auto text-white/80 text-xs">{fmtDate(rfi.responseDate)}</span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-sm text-muted-foreground">Responded by: <span className="font-semibold text-foreground">{rfi.responseBy ?? 'N/A'}</span></p>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{rfi.responseText}</p>
                </div>
                {responseAttachments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Response Attachments</p>
                    <div className="space-y-1.5">
                      {responseAttachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                          <Paperclip className="w-3.5 h-3.5 text-green-600" />
                          <span className="text-sm flex-1 truncate">{att.fileName}</span>
                          <button
                            onClick={() => handleDownload(att)}
                            disabled={downloadingFile === att.id}
                            className="p-1 hover:bg-green-100 rounded text-green-600"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div>
              {!showResponse ? (
                <button
                  onClick={() => setShowResponse(true)}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-[#C9A96E]/40 hover:border-[#C9A96E] hover:bg-[#C9A96E]/5 transition-all flex items-center justify-center gap-2 text-[#C9A96E] font-semibold"
                >
                  <MessageSquare className="w-5 h-5" />
                  Add Response
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card rounded-xl shadow-sm border border-border overflow-hidden"
                >
                  <div className="bg-[#C9A96E] px-5 py-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-white" />
                    <span className="text-white font-semibold text-sm">ADD RESPONSE</span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Response By</label>
                      <input
                        type="text"
                        value={responseBy}
                        onChange={(e) => setResponseBy(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Response *</label>
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        rows={5}
                        placeholder="Enter the response to this RFI..."
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 resize-y"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cost Impact</label>
                        <select
                          value={responseCostImpact}
                          onChange={(e) => setResponseCostImpact(e.target.value)}
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
                          value={responseScheduleImpact}
                          onChange={(e) => setResponseScheduleImpact(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
                        >
                          <option value="TBD">TBD</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                    </div>
                    {/* Response Attachments */}
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Attachments</label>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-medium transition-colors">
                        <Upload className="w-4 h-4" />
                        Add Files
                        <input
                          type="file"
                          multiple
                          onChange={(e) => setResponseFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                          className="hidden"
                        />
                      </label>
                      {responseFiles.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {responseFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                              <Paperclip className="w-3.5 h-3.5 text-[#C9A96E]" />
                              <span className="text-sm flex-1 truncate">{file.name}</span>
                              <button onClick={() => setResponseFiles((prev) => prev.filter((_, j) => j !== i))} className="p-1 hover:bg-red-100 rounded">
                                <X className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-3 pt-3 border-t border-border">
                      <button onClick={() => setShowResponse(false)} className="px-5 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium">
                        Cancel
                      </button>
                      <button
                        onClick={handleRespond}
                        disabled={respondLoading}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50"
                      >
                        {respondLoading ? (
                          <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {respondLoading ? 'Submitting...' : 'Submit Response'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info Card */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-5 space-y-4">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">Details</h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-[#C9A96E] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Project</p>
                  <p className="font-semibold">#{rfi?.project?.projectNumber} — {rfi?.project?.projectName}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#C9A96E] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">{rfi?.project?.location || '\u2014'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-[#C9A96E] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="font-medium">{rfi?.project?.client || '\u2014'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${pc.bg} ${pc.color}`}>{rfi?.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discipline</span>
                <span className="font-medium">{rfi?.discipline || '\u2014'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Drawing Ref</span>
                <span className="font-mono text-xs">{rfi?.drawingReference || '\u2014'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Spec Ref</span>
                <span className="font-mono text-xs">{rfi?.specReference || '\u2014'}</span>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted By</span>
                <span className="font-medium">{rfi?.submittedBy}</span>
              </div>
              {rfi?.submittedByRole && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-xs">{rfi.submittedByRole}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-semibold text-[#C9A96E]">{rfi?.assignedTo || '\u2014'}</span>
              </div>
              {rfi?.assignedToRole && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-xs">{rfi.assignedToRole}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date Submitted</span>
                <span className="font-medium">{fmtDateShort(rfi?.dateSubmitted)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className={`font-medium ${overdue ? 'text-red-600 font-bold' : ''}`}>
                  {overdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  {fmtDateShort(rfi?.dateDue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days to Respond</span>
                <span className="font-medium">{rfi?.daysToRespond}</span>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost Impact</span>
                <span className={`font-semibold ${rfi?.costImpact === 'Yes' ? 'text-red-600' : rfi?.costImpact === 'No' ? 'text-green-600' : 'text-amber-600'}`}>
                  {rfi?.costImpact}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Schedule Impact</span>
                <span className={`font-semibold ${rfi?.scheduleImpact === 'Yes' ? 'text-red-600' : rfi?.scheduleImpact === 'No' ? 'text-green-600' : 'text-amber-600'}`}>
                  {rfi?.scheduleImpact}
                </span>
              </div>
            </div>

            {rfi?.notes && (
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{rfi.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}