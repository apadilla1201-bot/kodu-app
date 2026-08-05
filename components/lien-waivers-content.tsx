'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import {
  FileSignature, Plus, Download, Send, CheckCircle2, Trash2, Loader2,
  FileCheck2, Clock, MailCheck, Upload, Pencil, X, ExternalLink,
} from 'lucide-react';

type ProjectOption = {
  id: string;
  projectNumber: string;
  projectName: string;
  payApplications: { id: string; applicationNumber: number; periodTo: string | null }[];
};

type Waiver = {
  id: string;
  projectId: string;
  subcontractor: string;
  subEmail: string | null;
  waiverType: string;
  amount: number;
  throughDate: string | null;
  status: string;
  fileUrl: string | null;
  fileName: string | null;
  externalToken: string | null;
  notes: string | null;
  project: { id: string; projectNumber: string; projectName: string };
  payApplication: { id: string; applicationNumber: number; periodTo: string | null } | null;
};

const TYPE_KEYS = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'];
const STATUSES = ['Pending', 'Sent', 'Received', 'Approved'];

function fmt(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm = {
  projectId: '', payApplicationId: '', subcontractor: '', subEmail: '',
  waiverType: 'conditional_progress', amount: '', throughDate: '', notes: '',
};

export function LienWaiversContent({ projects }: { projects: ProjectOption[] }) {
  const { t } = useI18n();
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]';

  const load = async () => {
    try {
      const res = await fetch('/api/lien-waivers', { credentials: 'include' });
      if (res.status === 503) {
        toast.error(t('lienWaivers.migrationPending'));
        setWaivers([]);
        return;
      }
      if (!res.ok) throw new Error('load');
      setWaivers(await res.json());
    } catch {
      toast.error(t('lienWaivers.createError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Prefill desde la tarjeta de Pay App: /dashboard/lien-waivers?create=1&project=ID&payApp=ID
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('create') === '1') {
        const proj = q.get('project') ?? '';
        setForm({ ...emptyForm, projectId: proj, payApplicationId: q.get('payApp') ?? '' });
        setDialogOpen(true);
      }
      if (q.get('project')) setProjectFilter(q.get('project') ?? '');
    } catch { /* sin query */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => (projectFilter ? waivers.filter((w) => w.projectId === projectFilter) : waivers),
    [waivers, projectFilter],
  );

  const stats = useMemo(() => {
    const by = (s: string) => filtered.filter((w) => w.status === s);
    return {
      pending: by('Pending').length + by('Sent').length,
      sent: by('Sent').length,
      received: by('Received').length,
      approved: by('Approved').length,
      pendingAmount: filtered.filter((w) => w.status !== 'Approved').reduce((a, w) => a + (w.amount || 0), 0),
    };
  }, [filtered]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, projectId: projectFilter || (projects[0]?.id ?? '') });
    setDialogOpen(true);
  };

  const openEdit = (w: Waiver) => {
    setEditingId(w.id);
    setForm({
      projectId: w.projectId,
      payApplicationId: w.payApplication?.id ?? '',
      subcontractor: w.subcontractor,
      subEmail: w.subEmail ?? '',
      waiverType: w.waiverType,
      amount: w.amount ? String(w.amount) : '',
      throughDate: w.throughDate ? w.throughDate.split('T')[0] : '',
      notes: w.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.projectId || !form.subcontractor.trim()) {
      toast.error(t('lienWaivers.formRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        projectId: form.projectId,
        payApplicationId: form.payApplicationId || null,
        subcontractor: form.subcontractor,
        subEmail: form.subEmail || null,
        waiverType: form.waiverType,
        amount: Number(form.amount) || 0,
        throughDate: form.throughDate || null,
        notes: form.notes || null,
      };
      const res = editingId
        ? await fetch(`/api/lien-waivers/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch('/api/lien-waivers', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      toast.success(editingId ? t('lienWaivers.saved') : t('lienWaivers.created'));
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('lienWaivers.createError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (w: Waiver) => {
    let email = w.subEmail ?? '';
    if (!email) {
      email = window.prompt(t('lienWaivers.emailPrompt'), '')?.trim() ?? '';
      if (!email) return;
    }
    setBusyId(w.id);
    try {
      const res = await fetch(`/api/lien-waivers/${w.id}/send-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error);
      toast.success(t('lienWaivers.sentTo', { email }));
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('lienWaivers.sendError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleGcUpload = async (w: Waiver, file: File) => {
    if (!w.externalToken) return;
    setBusyId(w.id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileName', file.name);
      fd.append('contentType', file.type || 'application/octet-stream');
      const res = await fetch(`/api/lien-waivers/public/${w.externalToken}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      toast.success(t('lienWaivers.uploaded'));
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('lienWaivers.uploadError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (w: Waiver) => {
    setBusyId(w.id);
    try {
      const res = await fetch(`/api/lien-waivers/${w.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Approved' }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('lienWaivers.approved'));
      await load();
    } catch {
      toast.error(t('lienWaivers.saveError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (w: Waiver) => {
    if (!window.confirm(t('lienWaivers.deleteConfirm'))) return;
    setBusyId(w.id);
    try {
      const res = await fetch(`/api/lien-waivers/${w.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(t('lienWaivers.deleted'));
      await load();
    } catch {
      toast.error(t('lienWaivers.deleteError'));
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      Pending: 'bg-amber-100 text-amber-800 border-amber-300',
      Sent: 'bg-blue-100 text-blue-800 border-blue-300',
      Received: 'bg-purple-100 text-purple-800 border-purple-300',
      Approved: 'bg-green-100 text-green-800 border-green-300',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[s] ?? styles.Pending}`}>
        {s === 'Approved' && <CheckCircle2 className="w-3 h-3" />}
        {t(`lienWaivers.status${s}`)}
      </span>
    );
  };

  const formProject = projects.find((p) => p.id === form.projectId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-[#C9A96E]" /> {t('lienWaivers.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('lienWaivers.subtitle')}</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0F1B33] text-white text-sm font-semibold hover:bg-[#1B365D] transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('lienWaivers.newWaiver')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('lienWaivers.statsPending'), value: stats.pending, icon: Clock, color: 'text-amber-600' },
          { label: t('lienWaivers.statsReceived'), value: stats.received, icon: FileCheck2, color: 'text-purple-600' },
          { label: t('lienWaivers.statsApproved'), value: stats.approved, icon: CheckCircle2, color: 'text-green-600' },
          { label: t('lienWaivers.pendingAmount'), value: fmt(stats.pendingAmount), icon: MailCheck, color: 'text-[#0F1B33]' },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg p-4 shadow-[var(--shadow-sm)] border border-border min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              <c.icon className={`w-4 h-4 shrink-0 ${c.color}`} />
              <p className="text-xs text-muted-foreground truncate">{c.label}</p>
            </div>
            <p className="text-xl font-bold mt-1 truncate">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filtro por proyecto */}
      <div className="flex items-center gap-3">
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={inputClass + ' max-w-xs'}>
          <option value="">{t('lienWaivers.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-lg shadow-[var(--shadow-sm)] border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0F1B33] text-white text-left">
                <th className="px-4 py-3 font-semibold">{t('lienWaivers.colSubcontractor')}</th>
                <th className="px-4 py-3 font-semibold">{t('lienWaivers.colProject')}</th>
                <th className="px-4 py-3 font-semibold">{t('lienWaivers.colType')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('lienWaivers.colAmount')}</th>
                <th className="px-4 py-3 font-semibold">{t('lienWaivers.colThrough')}</th>
                <th className="px-4 py-3 font-semibold">{t('lienWaivers.colPayApp')}</th>
                <th className="px-4 py-3 font-semibold">{t('lienWaivers.colStatus')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('lienWaivers.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline-block" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center">
                  <FileSignature className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-foreground">{t('lienWaivers.noWaivers')}</p>
                  <p className="text-sm text-muted-foreground">{t('lienWaivers.noWaiversDesc')}</p>
                </td></tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{w.subcontractor}</p>
                      {w.subEmail && <p className="text-xs text-muted-foreground">{w.subEmail}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{w.project.projectNumber}</td>
                    <td className="px-4 py-3">{t(`lienWaivers.type_${w.waiverType}`)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{w.amount > 0 ? fmt(w.amount) : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {w.throughDate ? new Date(w.throughDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {w.payApplication ? `PA #${w.payApplication.applicationNumber}` : '—'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(w.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {busyId === w.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <a href={`/api/lien-waivers/${w.id}/pdf`} target="_blank" rel="noopener noreferrer"
                              title={t('lienWaivers.downloadForm')}
                              className="p-1.5 rounded hover:bg-muted text-[#0F1B33]">
                              <Download className="w-4 h-4" />
                            </a>
                            <button onClick={() => handleSend(w)} title={t('lienWaivers.sendRequest')}
                              className="p-1.5 rounded hover:bg-muted text-[#C9A96E]">
                              <Send className="w-4 h-4" />
                            </button>
                            {w.fileUrl ? (
                              <a href={w.fileUrl} target="_blank" rel="noopener noreferrer" title={t('lienWaivers.viewSigned')}
                                className="p-1.5 rounded hover:bg-muted text-purple-700">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              <label title={t('lienWaivers.uploadSigned')} className="p-1.5 rounded hover:bg-muted text-purple-700 cursor-pointer">
                                <Upload className="w-4 h-4" />
                                <input type="file" accept=".pdf,image/*" className="hidden"
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleGcUpload(w, f); e.target.value = ''; }} />
                              </label>
                            )}
                            {w.status === 'Received' && (
                              <button onClick={() => handleApprove(w)} title={t('lienWaivers.markApproved')}
                                className="p-1.5 rounded hover:bg-muted text-green-700">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => openEdit(w)} title={t('lienWaivers.editWaiver')}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(w)} title={t('common.delete')}
                              className="p-1.5 rounded hover:bg-muted text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diálogo crear/editar */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#0F1B33] rounded-t-xl">
              <h2 className="text-white font-bold flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-[#C9A96E]" />
                {editingId ? t('lienWaivers.editWaiver') : t('lienWaivers.newWaiver')}
              </h2>
              <button onClick={() => setDialogOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('lienWaivers.formProject')} *</label>
                <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, payApplicationId: '' })} className={inputClass} disabled={Boolean(editingId)}>
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('lienWaivers.formPayApp')}</label>
                <select value={form.payApplicationId} onChange={(e) => setForm({ ...form, payApplicationId: e.target.value })} className={inputClass}>
                  <option value="">{t('lienWaivers.noPayApp')}</option>
                  {(formProject?.payApplications ?? []).map((pa) => (
                    <option key={pa.id} value={pa.id}>PA #{pa.applicationNumber}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('lienWaivers.formSub')} *</label>
                <input value={form.subcontractor} onChange={(e) => setForm({ ...form, subcontractor: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('lienWaivers.formSubEmail')}</label>
                <input type="email" value={form.subEmail} onChange={(e) => setForm({ ...form, subEmail: e.target.value })} className={inputClass} placeholder="sub@company.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('lienWaivers.formType')}</label>
                  <select value={form.waiverType} onChange={(e) => setForm({ ...form, waiverType: e.target.value })} className={inputClass}>
                    {TYPE_KEYS.map((k) => (
                      <option key={k} value={k}>{t(`lienWaivers.type_${k}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('lienWaivers.formAmount')}</label>
                  <input type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('lienWaivers.formThrough')}</label>
                <input type="date" value={form.throughDate} onChange={(e) => setForm({ ...form, throughDate: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('lienWaivers.formNotes')}</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass + ' min-h-[70px]'} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#C9A96E] text-[#0F1B33] text-sm font-bold hover:bg-[#D4A843] disabled:opacity-60">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? t('common.save') : t('lienWaivers.create')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
