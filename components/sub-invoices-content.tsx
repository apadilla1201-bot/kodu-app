'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import {
  FileText, Plus, Send, Trash2, Loader2, Stamp, Upload, X, ExternalLink,
  CheckCircle2, Clock, MailCheck,
} from 'lucide-react';

type ProjectOption = { id: string; projectNumber: string; projectName: string };
type CostCode = { code: string; label: string };

type SubInvoice = {
  id: string;
  projectId: string;
  subcontractor: string;
  invoiceNumber: string | null;
  description: string | null;
  grossAmount: number;
  retainagePercent: number;
  netAmount: number;
  costCode: string | null;
  costCodeLabel: string | null;
  fileUrl: string | null;
  fileName: string | null;
  stampedFileUrl: string | null;
  stampedFileName: string | null;
  status: string;
  sentToEmail: string | null;
  sentAt: string | null;
  project: { projectNumber: string; projectName: string };
};

function fmt(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm = {
  projectId: '', subcontractor: '', invoiceNumber: '', description: '',
  grossAmount: '', retainagePercent: '5', netAmount: '', costCode: '', notes: '',
};

export function SubInvoicesContent({ projects, costCodes, initialProjectId }: { projects: ProjectOption[]; costCodes: CostCode[]; initialProjectId?: string }) {
  const { t } = useI18n();
  const [invoices, setInvoices] = useState<SubInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState(initialProjectId ?? '');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState<SubInvoice | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendNote, setSendNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]';

  const load = async () => {
    try {
      const res = await fetch('/api/sub-invoices', { credentials: 'include' });
      if (!res.ok) throw new Error('load');
      setInvoices(await res.json());
    } catch {
      toast.error(t('subInvoices.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // recalcular neto cuando cambian bruto o retainage (si el PM no lo editó a mano)
  useEffect(() => {
    const gross = parseFloat(form.grossAmount);
    const ret = parseFloat(form.retainagePercent);
    if (!isNaN(gross) && !isNaN(ret)) {
      const net = Math.round(gross * (1 - ret / 100) * 100) / 100;
      setForm((f: any) => ({ ...f, netAmount: net.toFixed(2) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.grossAmount, form.retainagePercent]);

  const visible = projectFilter ? invoices.filter((i) => i.projectId === projectFilter) : invoices;

  const statusMeta = (s: string) => {
    if (s === 'Sent') return { label: t('subInvoices.statusSent'), cls: 'bg-emerald-100 text-emerald-700', Icon: MailCheck };
    if (s === 'Stamped') return { label: t('subInvoices.statusStamped'), cls: 'bg-blue-100 text-blue-700', Icon: Stamp };
    return { label: t('subInvoices.statusPending'), cls: 'bg-amber-100 text-amber-700', Icon: Clock };
  };

  const openNew = () => {
    setForm({ ...emptyForm, projectId: projectFilter || projects[0]?.id || '' });
    setFile(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.projectId || !form.subcontractor.trim()) {
      toast.error(t('subInvoices.requiredFields'));
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('projectId', form.projectId);
      fd.append('subcontractor', form.subcontractor.trim());
      fd.append('invoiceNumber', form.invoiceNumber ?? '');
      fd.append('description', form.description ?? '');
      fd.append('grossAmount', form.grossAmount || '0');
      fd.append('retainagePercent', String((parseFloat(form.retainagePercent) || 0) / 100));
      fd.append('netAmount', form.netAmount || '');
      fd.append('costCode', form.costCode ?? '');
      fd.append('notes', form.notes ?? '');
      if (file) {
        fd.append('file', file);
        fd.append('fileName', file.name);
        fd.append('contentType', file.type || 'application/pdf');
      }
      const res = await fetch('/api/sub-invoices', { method: 'POST', credentials: 'include', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'save');
      }
      toast.success(t('subInvoices.saved'));
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message === 'File too large (max 25 MB)' ? t('subInvoices.tooLarge') : t('subInvoices.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const stamp = async (inv: SubInvoice) => {
    if (!inv.fileUrl) { toast.error(t('subInvoices.needPdf')); return; }
    if (!inv.costCode) { toast.error(t('subInvoices.needCostCode')); return; }
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/sub-invoices/${inv.id}/stamp`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'stamp');
      }
      toast.success(t('subInvoices.stamped'));
      await load();
    } catch {
      toast.error(t('subInvoices.stampError'));
    } finally {
      setBusyId(null);
    }
  };

  const sendToAccounting = async () => {
    if (!sendOpen) return;
    if (!sendTo.trim()) { toast.error(t('subInvoices.needEmail')); return; }
    setBusyId(sendOpen.id);
    try {
      const res = await fetch(`/api/sub-invoices/${sendOpen.id}/send-accounting`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: sendTo.trim(), note: sendNote.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'send');
      }
      toast.success(t('subInvoices.sent'));
      setSendOpen(null);
      setSendTo('');
      setSendNote('');
      await load();
    } catch {
      toast.error(t('subInvoices.sendError'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (inv: SubInvoice) => {
    if (!confirm(t('subInvoices.confirmDelete'))) return;
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/sub-invoices/${inv.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('delete');
      toast.success(t('subInvoices.deleted'));
      await load();
    } catch {
      toast.error(t('subInvoices.deleteError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">{t('subInvoices.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subInvoices.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="px-3 py-2 rounded-md border border-border bg-background text-sm">
            <option value="">{t('subInvoices.allProjects')}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>)}
          </select>
          <button onClick={openNew} className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> {t('subInvoices.new')}
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="bg-card rounded-lg p-12 text-center shadow-sm border border-border">
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A96E] mx-auto" />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card rounded-lg p-12 text-center shadow-sm border border-border">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">{t('subInvoices.empty')}</p>
          <button onClick={openNew} className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-md text-sm font-medium">
            <Plus className="w-4 h-4" /> {t('subInvoices.new')}
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">{t('subInvoices.colSub')}</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">{t('subInvoices.colProject')}</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">{t('subInvoices.colGross')}</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">{t('subInvoices.colNet')}</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">{t('subInvoices.colCostCode')}</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">{t('subInvoices.colStatus')}</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">{t('subInvoices.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((inv) => {
                  const meta = statusMeta(inv.status);
                  return (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{inv.subcontractor}</p>
                        {inv.invoiceNumber && <p className="text-xs text-muted-foreground font-mono">#{inv.invoiceNumber}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.project?.projectNumber}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(inv.grossAmount)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#2E7D32]">{fmt(inv.netAmount)}</td>
                      <td className="px-4 py-3">
                        {inv.costCode ? (
                          <span className="text-xs font-mono bg-[#C9A96E]/10 text-[#a8843a] px-2 py-1 rounded" title={inv.costCodeLabel ?? ''}>
                            {inv.costCode}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('subInvoices.noCostCode')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${meta.cls}`}>
                          <meta.Icon className="w-3 h-3" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.stampedFileUrl ? (
                            <a href={`/api/sub-invoices/${inv.id}/file?which=stamped`} target="_blank" rel="noreferrer"
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title={t('subInvoices.viewStamped')}>
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          ) : inv.fileUrl ? (
                            <a href={`/api/sub-invoices/${inv.id}/file?which=original`} target="_blank" rel="noreferrer"
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title={t('subInvoices.viewOriginal')}>
                              <FileText className="w-4 h-4" />
                            </a>
                          ) : null}
                          {inv.status !== 'Sent' && (
                            <button onClick={() => void stamp(inv)} disabled={busyId === inv.id}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-[#C9A96E] disabled:opacity-40" title={t('subInvoices.stampAction')}>
                              {busyId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stamp className="w-4 h-4" />}
                            </button>
                          )}
                          <button onClick={() => { setSendOpen(inv); setSendTo(inv.sentToEmail ?? ''); }} disabled={busyId === inv.id}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600 disabled:opacity-40" title={t('subInvoices.sendAction')}>
                            <Send className="w-4 h-4" />
                          </button>
                          <button onClick={() => void remove(inv)} disabled={busyId === inv.id}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600 disabled:opacity-40" title={t('common.delete')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog nuevo invoice */}
      {dialogOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setDialogOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white">
              <h2 className="text-lg font-display font-semibold text-foreground">{t('subInvoices.newTitle')}</h2>
              <button onClick={() => setDialogOpen(false)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldProject')} *</label>
                <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className={inputClass}>
                  <option value="">{t('subInvoices.selectProject')}</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldSub')} *</label>
                <input value={form.subcontractor} onChange={(e) => setForm({ ...form, subcontractor: e.target.value })} className={inputClass} placeholder="Kitsuco, LLC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldInvoiceNo')}</label>
                  <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} className={inputClass} placeholder="PA-3" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldGross')} *</label>
                  <input type="number" step="0.01" value={form.grossAmount} onChange={(e) => setForm({ ...form, grossAmount: e.target.value })} className={inputClass} placeholder="2950.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldRetainage')}</label>
                  <input type="number" step="0.5" value={form.retainagePercent} onChange={(e) => setForm({ ...form, retainagePercent: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldNet')}</label>
                  <input type="number" step="0.01" value={form.netAmount} onChange={(e) => setForm({ ...form, netAmount: e.target.value })} className={`${inputClass} font-semibold text-[#2E7D32]`} />
                  <p className="text-[11px] text-muted-foreground mt-1">{t('subInvoices.netHelp')}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldCostCode')}</label>
                <select value={form.costCode} onChange={(e) => setForm({ ...form, costCode: e.target.value })} className={inputClass}>
                  <option value="">{t('subInvoices.selectCostCode')}</option>
                  {costCodes.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldDescription')}</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder={t('subInvoices.descriptionPh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldPdf')}</label>
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-[#C9A96E] transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{file ? file.name : t('subInvoices.pdfDrop')}</p>
                </div>
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground">{t('common.cancel')}</button>
              <button onClick={() => void save()} disabled={saving}
                className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog enviar a contabilidad */}
      {sendOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setSendOpen(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-display font-semibold text-foreground">{t('subInvoices.sendTitle')}</h2>
              <button onClick={() => setSendOpen(null)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <p className="font-medium text-foreground">{sendOpen.subcontractor}</p>
                <p className="text-muted-foreground">{sendOpen.project?.projectName} ({sendOpen.project?.projectNumber})</p>
                <p className="mt-1"><span className="text-muted-foreground">{t('subInvoices.colNet')}:</span> <span className="font-semibold text-[#2E7D32]">{fmt(sendOpen.netAmount)}</span>
                  {sendOpen.costCode && <span className="ml-2 font-mono text-xs bg-[#C9A96E]/10 text-[#a8843a] px-1.5 py-0.5 rounded">{sendOpen.costCode}</span>}
                </p>
                {!sendOpen.stampedFileUrl && (
                  <p className="mt-2 text-xs text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3" /> {t('subInvoices.sendWithoutStamp')}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldAccountingEmail')} *</label>
                <input type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} className={inputClass} placeholder="accounting@company.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('subInvoices.fieldNote')}</label>
                <textarea value={sendNote} onChange={(e) => setSendNote(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder={t('subInvoices.notePh')} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
              <button onClick={() => setSendOpen(null)} className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground">{t('common.cancel')}</button>
              <button onClick={() => void sendToAccounting()} disabled={busyId === sendOpen.id}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {busyId === sendOpen.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {t('subInvoices.sendConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
