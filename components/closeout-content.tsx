'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import {
  ClipboardCheck, Plus, Send, CheckCircle2, Trash2, Loader2, Upload,
  Download, ExternalLink, Pencil, X, FileText,
} from 'lucide-react';

type ProjectOption = { id: string; projectNumber: string; projectName: string };

type CloseoutItem = {
  id: string;
  projectId: string;
  sortOrder: number;
  category: string;
  deliverable: string;
  responsible: string | null;
  status: string;
  dateReceived: string | null;
  fileUrl: string | null;
  fileName: string | null;
  requestedTo: string | null;
  notes: string | null;
};

const STATUSES = ['Pending', 'Requested', 'Received', 'Verified'];

const emptyForm = { category: '', deliverable: '', responsible: '', notes: '' };

export function CloseoutContent({ projects, initialProjectId }: { projects: ProjectOption[]; initialProjectId?: string }) {
  const { t } = useI18n();
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? '');
  const [items, setItems] = useState<CloseoutItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]';

  const load = async (pid: string) => {
    if (!pid) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/closeout-items?projectId=${pid}`, { credentials: 'include' });
      if (res.status === 503) {
        toast.error(t('closeout.migrationPending'));
        setItems([]);
        return;
      }
      if (!res.ok) throw new Error('load');
      setItems(await res.json());
    } catch {
      toast.error(t('closeout.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);

  const stats = useMemo(() => {
    const verified = items.filter((i) => i.status === 'Verified').length;
    const received = items.filter((i) => i.status === 'Received').length;
    const requested = items.filter((i) => i.status === 'Requested').length;
    const pct = items.length ? Math.round((verified / items.length) * 100) : 0;
    return { total: items.length, verified, received, requested, pending: items.length - verified - received - requested, pct };
  }, [items]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, category: categories[0] ?? '' });
    setDialogOpen(true);
  };

  const openEdit = (it: CloseoutItem) => {
    setEditingId(it.id);
    setForm({
      category: it.category,
      deliverable: it.deliverable,
      responsible: it.responsible ?? '',
      notes: it.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.category.trim() || !form.deliverable.trim()) {
      toast.error(t('closeout.formRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        projectId,
        category: form.category,
        deliverable: form.deliverable,
        responsible: form.responsible || null,
        notes: form.notes || null,
      };
      const res = editingId
        ? await fetch(`/api/closeout-items/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch('/api/closeout-items', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      toast.success(editingId ? t('closeout.saved') : t('closeout.created'));
      setDialogOpen(false);
      await load(projectId);
    } catch (e: any) {
      toast.error(e?.message || t('closeout.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (it: CloseoutItem, status: string) => {
    setBusyId(it.id);
    try {
      const res = await fetch(`/api/closeout-items/${it.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(status === 'Verified' ? t('closeout.verifiedToast') : t('closeout.saved'));
      await load(projectId);
    } catch {
      toast.error(t('closeout.saveError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSend = async (it: CloseoutItem) => {
    const email = window.prompt(t('closeout.emailPrompt'), it.requestedTo ?? '')?.trim() ?? '';
    if (!email) return;
    setBusyId(it.id);
    try {
      const res = await fetch(`/api/closeout-items/${it.id}/send-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error);
      toast.success(t('closeout.sentTo', { email }));
      await load(projectId);
    } catch (e: any) {
      toast.error(e?.message || t('closeout.sendError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleUpload = async (it: CloseoutItem, file: File) => {
    setBusyId(it.id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileName', file.name);
      fd.append('contentType', file.type || 'application/octet-stream');
      const res = await fetch(`/api/closeout-items/${it.id}/file`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      toast.success(t('closeout.uploaded'));
      await load(projectId);
    } catch (e: any) {
      toast.error(e?.message || t('closeout.uploadError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (it: CloseoutItem) => {
    if (!window.confirm(t('closeout.deleteConfirm'))) return;
    setBusyId(it.id);
    try {
      const res = await fetch(`/api/closeout-items/${it.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(t('closeout.deleted'));
      await load(projectId);
    } catch {
      toast.error(t('closeout.deleteError'));
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      Pending: 'bg-amber-100 text-amber-800 border-amber-300',
      Requested: 'bg-blue-100 text-blue-800 border-blue-300',
      Received: 'bg-purple-100 text-purple-800 border-purple-300',
      Verified: 'bg-green-100 text-green-800 border-green-300',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${styles[s] ?? styles.Pending}`}>
        {s === 'Verified' && <CheckCircle2 className="w-3 h-3" />}
        {t(`closeout.status${s}`)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#C9A96E]" /> {t('closeout.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('closeout.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {projectId && items.length > 0 && (
            <a href={`/api/closeout-items/pdf?projectId=${projectId}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#0F1B33] text-[#0F1B33] text-sm font-semibold hover:bg-muted transition-colors">
              <Download className="w-4 h-4" /> {t('closeout.reportPdf')}
            </a>
          )}
          <button onClick={openCreate} disabled={!projectId}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0F1B33] text-white text-sm font-semibold hover:bg-[#1B365D] transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> {t('closeout.newItem')}
          </button>
        </div>
      </div>

      {/* Selector de proyecto */}
      <div className="flex items-center gap-3">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass + ' max-w-xs'}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: t('closeout.statsTotal'), value: stats.total, color: 'text-[#0F1B33]' },
          { label: t('closeout.statsPending'), value: stats.pending, color: 'text-amber-600' },
          { label: t('closeout.statsRequested'), value: stats.requested, color: 'text-blue-600' },
          { label: t('closeout.statsReceived'), value: stats.received, color: 'text-purple-600' },
          { label: `${t('closeout.statsVerified')} (${stats.pct}%)`, value: stats.verified, color: 'text-green-600' },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-card rounded-lg p-4 shadow-[var(--shadow-sm)] border border-border min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Grupos por categoría */}
      {loading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin inline-block text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-10 text-center">
          <ClipboardCheck className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-medium text-foreground">{t('closeout.noItems')}</p>
          <p className="text-sm text-muted-foreground">{t('closeout.noItemsDesc')}</p>
        </div>
      ) : (
        categories.map((cat) => {
          const inCat = items.filter((i) => i.category === cat);
          const doneCat = inCat.filter((i) => i.status === 'Verified' || i.status === 'Received').length;
          return (
            <div key={cat} className="bg-card rounded-lg shadow-[var(--shadow-sm)] border border-border overflow-hidden">
              <div className="bg-[#0F1B33] text-white px-5 py-3 flex items-center justify-between">
                <h2 className="font-display font-bold text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#C9A96E]" /> {cat}
                </h2>
                <span className="text-xs text-white/60">{doneCat}/{inCat.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {inCat.map((it) => (
                      <tr key={it.id} className={`border-t border-border hover:bg-muted/40 ${it.status === 'Verified' ? 'opacity-70' : ''}`}>
                        <td className="px-5 py-3 max-w-[380px]">
                          <p className="font-medium">{it.deliverable}</p>
                          {it.notes && <p className="text-xs text-muted-foreground truncate" title={it.notes}>{it.notes}</p>}
                          {it.requestedTo && it.status === 'Requested' && (
                            <p className="text-xs text-blue-600">✉ {it.requestedTo}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-sm max-w-[180px] truncate">{it.responsible || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-sm">
                          {it.dateReceived ? new Date(it.dateReceived).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">{statusBadge(it.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {busyId === it.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <button onClick={() => handleSend(it)} title={t('closeout.requestDoc')}
                                  className="p-1.5 rounded hover:bg-muted text-[#C9A96E]">
                                  <Send className="w-4 h-4" />
                                </button>
                                {it.fileUrl ? (
                                  <a href={it.fileUrl} target="_blank" rel="noopener noreferrer" title={t('closeout.viewDoc')}
                                    className="p-1.5 rounded hover:bg-muted text-purple-700">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                ) : (
                                  <label title={t('closeout.uploadDoc')} className="p-1.5 rounded hover:bg-muted text-purple-700 cursor-pointer">
                                    <Upload className="w-4 h-4" />
                                    <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" className="hidden"
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(it, f); e.target.value = ''; }} />
                                  </label>
                                )}
                                {it.status === 'Received' && (
                                  <button onClick={() => handleStatus(it, 'Verified')} title={t('closeout.markVerified')}
                                    className="p-1.5 rounded hover:bg-muted text-green-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button onClick={() => openEdit(it)} title={t('closeout.editItem')}
                                  className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(it)} title={t('common.delete')}
                                  className="p-1.5 rounded hover:bg-muted text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {/* Diálogo crear/editar */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl shadow-xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#0F1B33] rounded-t-xl">
              <h2 className="text-white font-bold flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#C9A96E]" />
                {editingId ? t('closeout.editItem') : t('closeout.newItem')}
              </h2>
              <button onClick={() => setDialogOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('closeout.formCategory')} *</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}
                  list="closeout-categories" placeholder={t('closeout.formCategoryPlaceholder')} />
                <datalist id="closeout-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('closeout.formDeliverable')} *</label>
                <input value={form.deliverable} onChange={(e) => setForm({ ...form, deliverable: e.target.value })} className={inputClass}
                  placeholder={t('closeout.formDeliverablePlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('closeout.formResponsible')}</label>
                <input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('closeout.formNotes')}</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass + ' min-h-[60px]'} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#C9A96E] text-[#0F1B33] text-sm font-bold hover:bg-[#D4A843] disabled:opacity-60">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? t('common.save') : t('closeout.create')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
