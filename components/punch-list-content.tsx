'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import {
  ListChecks, Plus, Send, CheckCircle2, Trash2, Loader2, Camera,
  Clock, CircleDot, Eye, Pencil, X, Download, ExternalLink, RotateCcw,
} from 'lucide-react';

type ProjectContact = { name: string; email: string; company: string | null; role: string };
type ProjectOption = {
  id: string;
  projectNumber: string;
  projectName: string;
  contacts: ProjectContact[];
};

type PunchItem = {
  id: string;
  projectId: string;
  itemNumber: number;
  title: string;
  description: string | null;
  location: string | null;
  trade: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  photoUrl: string | null;
  completionPhotoUrl: string | null;
  externalToken: string | null;
  notes: string | null;
  project: { id: string; projectNumber: string; projectName: string };
};

const STATUSES = ['Open', 'In Progress', 'Ready for Review', 'Completed'];
const PRIORITIES = ['Low', 'Medium', 'High'];

const emptyForm = {
  projectId: '', title: '', description: '', location: '', trade: '',
  assignedToName: '', assignedToEmail: '', priority: 'Medium', dueDate: '', notes: '',
};

export function PunchListContent({ projects }: { projects: ProjectOption[] }) {
  const { t } = useI18n();
  const [items, setItems] = useState<PunchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Responsable: índice del contacto del Directory, o 'manual' para escribirlo a mano
  const [responsibleSel, setResponsibleSel] = useState<string>('manual');

  const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]';

  const load = async () => {
    try {
      const res = await fetch('/api/punch-items', { credentials: 'include' });
      if (res.status === 503) {
        toast.error(t('punch.migrationPending'));
        setItems([]);
        return;
      }
      if (!res.ok) throw new Error('load');
      setItems(await res.json());
    } catch {
      toast.error(t('punch.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('project')) setProjectFilter(q.get('project') ?? '');
    } catch { /* sin query */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (it) =>
          (!projectFilter || it.projectId === projectFilter) &&
          (!statusFilter || it.status === statusFilter),
      ),
    [items, projectFilter, statusFilter],
  );

  const stats = useMemo(() => {
    const scoped = projectFilter ? items.filter((it) => it.projectId === projectFilter) : items;
    return {
      open: scoped.filter((it) => it.status === 'Open').length,
      inProgress: scoped.filter((it) => it.status === 'In Progress').length,
      ready: scoped.filter((it) => it.status === 'Ready for Review').length,
      completed: scoped.filter((it) => it.status === 'Completed').length,
    };
  }, [items, projectFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, projectId: projectFilter || (projects[0]?.id ?? '') });
    setResponsibleSel('');
    setDialogOpen(true);
  };

  const openEdit = (it: PunchItem) => {
    setEditingId(it.id);
    setForm({
      projectId: it.projectId,
      title: it.title,
      description: it.description ?? '',
      location: it.location ?? '',
      trade: it.trade ?? '',
      assignedToName: it.assignedToName ?? '',
      assignedToEmail: it.assignedToEmail ?? '',
      priority: it.priority,
      dueDate: it.dueDate ? it.dueDate.split('T')[0] : '',
      notes: it.notes ?? '',
    });
    // Si el responsable actual coincide con un contacto del Directory, preseleccionarlo
    const proj = projects.find((p) => p.id === it.projectId);
    const idx = (proj?.contacts ?? []).findIndex(
      (c) => c.email.toLowerCase() === (it.assignedToEmail ?? '').toLowerCase() && it.assignedToEmail,
    );
    setResponsibleSel(idx >= 0 ? String(idx) : 'manual');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.projectId || !form.title.trim()) {
      toast.error(t('punch.formRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        projectId: form.projectId,
        title: form.title,
        description: form.description || null,
        location: form.location || null,
        trade: form.trade || null,
        assignedToName: form.assignedToName || null,
        assignedToEmail: form.assignedToEmail || null,
        priority: form.priority,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      };
      const res = editingId
        ? await fetch(`/api/punch-items/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch('/api/punch-items', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      toast.success(editingId ? t('punch.saved') : t('punch.created'));
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('punch.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (it: PunchItem) => {
    let email = it.assignedToEmail ?? '';
    if (!email) {
      email = window.prompt(t('punch.emailPrompt'), '')?.trim() ?? '';
      if (!email) return;
    }
    setBusyId(it.id);
    try {
      const res = await fetch(`/api/punch-items/${it.id}/send-assignment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error);
      toast.success(t('punch.sentTo', { email }));
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('punch.sendError'));
    } finally {
      setBusyId(null);
    }
  };

  const handlePhoto = async (it: PunchItem, file: File, kind: 'issue' | 'completion') => {
    setBusyId(it.id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileName', file.name);
      fd.append('contentType', file.type || 'application/octet-stream');
      fd.append('kind', kind);
      const res = await fetch(`/api/punch-items/${it.id}/photo`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      toast.success(t('punch.photoUploaded'));
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('punch.photoError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (it: PunchItem, status: string) => {
    setBusyId(it.id);
    try {
      const res = await fetch(`/api/punch-items/${it.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(status === 'Completed' ? t('punch.completedToast') : t('punch.saved'));
      await load();
    } catch {
      toast.error(t('punch.saveError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (it: PunchItem) => {
    if (!window.confirm(t('punch.deleteConfirm'))) return;
    setBusyId(it.id);
    try {
      const res = await fetch(`/api/punch-items/${it.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(t('punch.deleted'));
      await load();
    } catch {
      toast.error(t('punch.deleteError'));
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      Open: 'bg-amber-100 text-amber-800 border-amber-300',
      'In Progress': 'bg-blue-100 text-blue-800 border-blue-300',
      'Ready for Review': 'bg-purple-100 text-purple-800 border-purple-300',
      Completed: 'bg-green-100 text-green-800 border-green-300',
    };
    const key = s.replace(/ /g, '');
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${styles[s] ?? styles.Open}`}>
        {s === 'Completed' && <CheckCircle2 className="w-3 h-3" />}
        {t(`punch.status${key}`)}
      </span>
    );
  };

  const priorityBadge = (p: string) => {
    const colors: Record<string, string> = {
      High: 'text-red-600', Medium: 'text-amber-600', Low: 'text-green-600',
    };
    return <span className={`text-xs font-bold ${colors[p] ?? ''}`}>{t(`punch.priority${p}`)}</span>;
  };

  const formProject = projects.find((p) => p.id === form.projectId);
  const formContacts = formProject?.contacts ?? [];

  const onResponsibleChange = (val: string) => {
    setResponsibleSel(val);
    if (val === 'manual') {
      setForm({ ...form, assignedToName: '', assignedToEmail: '' });
    } else if (val !== '') {
      const c = formContacts[Number(val)];
      if (c) setForm({ ...form, assignedToName: c.name, assignedToEmail: c.email });
    }
  };

  const isOverdue = (it: PunchItem) =>
    it.dueDate && it.status !== 'Completed' && new Date(it.dueDate) < new Date(new Date().toDateString());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-[#C9A96E]" /> {t('punch.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('punch.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {projectFilter && (
            <a href={`/api/punch-items/pdf?projectId=${projectFilter}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#0F1B33] text-[#0F1B33] text-sm font-semibold hover:bg-muted transition-colors">
              <Download className="w-4 h-4" /> {t('punch.reportPdf')}
            </a>
          )}
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0F1B33] text-white text-sm font-semibold hover:bg-[#1B365D] transition-colors">
            <Plus className="w-4 h-4" /> {t('punch.newItem')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('punch.statsOpen'), value: stats.open, icon: CircleDot, color: 'text-amber-600' },
          { label: t('punch.statsInProgress'), value: stats.inProgress, icon: Clock, color: 'text-blue-600' },
          { label: t('punch.statsReady'), value: stats.ready, icon: Eye, color: 'text-purple-600' },
          { label: t('punch.statsCompleted'), value: stats.completed, icon: CheckCircle2, color: 'text-green-600' },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg p-4 shadow-[var(--shadow-sm)] border border-border min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              <c.icon className={`w-4 h-4 shrink-0 ${c.color}`} />
              <p className="text-xs text-muted-foreground truncate">{c.label}</p>
            </div>
            <p className="text-xl font-bold mt-1">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={inputClass + ' max-w-xs'}>
          <option value="">{t('punch.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass + ' max-w-[180px]'}>
          <option value="">{t('punch.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`punch.status${s.replace(/ /g, '')}`)}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-lg shadow-[var(--shadow-sm)] border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0F1B33] text-white text-left">
                <th className="px-4 py-3 font-semibold w-12">#</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colItem')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colLocation')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colResponsible')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colPriority')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colDue')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colPhotos')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colStatus')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('punch.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline-block" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center">
                  <ListChecks className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-foreground">{t('punch.noItems')}</p>
                  <p className="text-sm text-muted-foreground">{t('punch.noItemsDesc')}</p>
                </td></tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id} className={`border-t border-border hover:bg-muted/40 ${it.status === 'Completed' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-bold text-[#0F1B33]">{it.itemNumber}</td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <p className="font-medium truncate">{it.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {it.project.projectNumber}{it.trade ? ` · ${it.trade}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{it.location || '—'}</td>
                    <td className="px-4 py-3">
                      {it.assignedToName ? (
                        <>
                          <p className="font-medium text-sm">{it.assignedToName}</p>
                          {it.assignedToEmail && <p className="text-xs text-muted-foreground">{it.assignedToEmail}</p>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">{priorityBadge(it.priority)}</td>
                    <td className={`px-4 py-3 text-sm ${isOverdue(it) ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                      {it.dueDate ? new Date(it.dueDate).toLocaleDateString() : '—'}
                      {isOverdue(it) && <span className="block text-xs">{t('punch.overdue')}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {it.photoUrl ? (
                          <a href={it.photoUrl} target="_blank" rel="noopener noreferrer" title={t('punch.issuePhoto')}
                            className="p-1 rounded hover:bg-muted text-[#0F1B33]">
                            <Camera className="w-4 h-4" />
                          </a>
                        ) : (
                          <label title={t('punch.addIssuePhoto')} className="p-1 rounded hover:bg-muted text-muted-foreground/50 cursor-pointer">
                            <Camera className="w-4 h-4" />
                            <input type="file" accept="image/*" className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(it, f, 'issue'); e.target.value = ''; }} />
                          </label>
                        )}
                        {it.completionPhotoUrl ? (
                          <a href={it.completionPhotoUrl} target="_blank" rel="noopener noreferrer" title={t('punch.completionPhoto')}
                            className="p-1 rounded hover:bg-muted text-green-700">
                            <Camera className="w-4 h-4" />
                          </a>
                        ) : (
                          <label title={t('punch.addCompletionPhoto')} className="p-1 rounded hover:bg-muted text-muted-foreground/50 cursor-pointer">
                            <Camera className="w-4 h-4" />
                            <input type="file" accept="image/*" className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(it, f, 'completion'); e.target.value = ''; }} />
                          </label>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(it.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {busyId === it.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <button onClick={() => handleSend(it)} title={t('punch.assignToSub')}
                              className="p-1.5 rounded hover:bg-muted text-[#C9A96E]">
                              <Send className="w-4 h-4" />
                            </button>
                            {it.status === 'Ready for Review' && (
                              <button onClick={() => handleStatus(it, 'Completed')} title={t('punch.markCompleted')}
                                className="p-1.5 rounded hover:bg-muted text-green-700">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            {it.status === 'Completed' && (
                              <button onClick={() => handleStatus(it, 'Open')} title={t('punch.reopen')}
                                className="p-1.5 rounded hover:bg-muted text-amber-600">
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => openEdit(it)} title={t('punch.editItem')}
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
                <ListChecks className="w-4 h-4 text-[#C9A96E]" />
                {editingId ? t('punch.editItem') : t('punch.newItem')}
              </h2>
              <button onClick={() => setDialogOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formProject')} *</label>
                <select value={form.projectId} onChange={(e) => { setForm({ ...form, projectId: e.target.value, assignedToName: '', assignedToEmail: '' }); setResponsibleSel(''); }} className={inputClass} disabled={Boolean(editingId)}>
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formTitle')} *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass}
                  placeholder={t('punch.formTitlePlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formDescription')}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass + ' min-h-[70px]'} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formLocation')}</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass}
                    placeholder={t('punch.formLocationPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formTrade')}</label>
                  <input value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} className={inputClass}
                    placeholder={t('punch.formTradePlaceholder')} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formAssignedName')}</label>
                <select value={responsibleSel} onChange={(e) => onResponsibleChange(e.target.value)} className={inputClass}>
                  <option value="">{t('punch.responsibleSelect')}</option>
                  {formContacts.map((c, idx) => (
                    <option key={idx} value={String(idx)}>
                      {c.name}{c.company ? ` — ${c.company}` : ''} · {c.role}
                    </option>
                  ))}
                  <option value="manual">{t('punch.responsibleManual')}</option>
                </select>
                {responsibleSel !== '' && responsibleSel !== 'manual' && form.assignedToEmail && (
                  <p className="text-xs text-muted-foreground mt-1">✉ {form.assignedToEmail}</p>
                )}
              </div>
              {responsibleSel === 'manual' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formAssignedName')}</label>
                    <input value={form.assignedToName} onChange={(e) => setForm({ ...form, assignedToName: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formAssignedEmail')}</label>
                    <input type="email" value={form.assignedToEmail} onChange={(e) => setForm({ ...form, assignedToEmail: e.target.value })} className={inputClass} placeholder="sub@company.com" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formPriority')}</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{t(`punch.priority${p}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formDueDate')}</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formNotes')}</label>
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
                  {editingId ? t('common.save') : t('punch.create')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
