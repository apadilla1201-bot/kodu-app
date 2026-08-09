'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import {
  ListChecks, Plus, Send, CheckCircle2, Trash2, Loader2, Camera,
  Clock, CircleDot, Eye, Pencil, X, Download, AlertTriangle, RotateCcw, Ban,
  PenLine, Zap, UserPlus, MapPin,
} from 'lucide-react';
import { PunchSignoff } from '@/components/punch-signoff';
import { QuickCaptureDialog } from '@/components/punch-quick-capture';
import { PunchPlanBoard } from '@/components/punch-plan-board';

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
  correctiveAction: string | null;
  area: string | null;
  location: string | null;
  trade: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  identifiedBy: string | null;
  backCharge: number | null;
  photoUrl: string | null;
  completionPhotoUrl: string | null;
  externalToken: string | null;
  notes: string | null;
  planSheetId: string | null;
  pinX: number | null;
  pinY: number | null;
  project: { id: string; projectNumber: string; projectName: string };
};

const STATUSES = ['Open', 'In Progress', 'Ready for Review', 'Completed', 'Disputed'];
const PRIORITIES = ['A', 'B', 'C'];

const emptyForm = {
  projectId: '', title: '', description: '', correctiveAction: '', area: '', location: '', trade: '',
  assignedToName: '', assignedToEmail: '', priority: 'B', dueDate: '', identifiedBy: '', notes: '',
  backCharge: '',
};

export function PunchListContent({ projects }: { projects: ProjectOption[] }) {
  const { t } = useI18n();
  const [items, setItems] = useState<PunchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState<string | null>(null);
  const [disputeForm, setDisputeForm] = useState({ backCharge: '', notes: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [responsibleSel, setResponsibleSel] = useState<string>('');
  const [tab, setTab] = useState<'items' | 'plan' | 'signoff'>('items');
  const [quickOpen, setQuickOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkContact, setBulkContact] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

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

  const scoped = useMemo(
    () => (projectFilter ? items.filter((it) => it.projectId === projectFilter) : items),
    [items, projectFilter],
  );

  const areas = useMemo(
    () => [...new Set(scoped.map((it) => it.area).filter(Boolean))].sort() as string[],
    [scoped],
  );

  const filtered = useMemo(
    () =>
      scoped.filter(
        (it) =>
          (!statusFilter || it.status === statusFilter) &&
          (!areaFilter || it.area === areaFilter),
      ),
    [scoped, statusFilter, areaFilter],
  );

  // Dashboard estilo Excel PDG: totales, % cerrado, abiertos por prioridad, por área y por trade
  const stats = useMemo(() => {
    const open = (s: string) => scoped.filter((it) => it.status === s).length;
    const notClosed = scoped.filter((it) => it.status !== 'Completed');
    const closed = open('Completed');
    const pct = scoped.length ? Math.round((closed / scoped.length) * 100) : 0;
    const byArea = areas.map((a) => {
      const inArea = scoped.filter((it) => it.area === a);
      const closedArea = inArea.filter((it) => it.status === 'Completed').length;
      return { area: a, total: inArea.length, open: inArea.length - closedArea, closed: closedArea };
    });
    const byTrade = new Map<string, number>();
    notClosed.forEach((it) => {
      const k = it.trade || t('punch.noTrade');
      byTrade.set(k, (byTrade.get(k) ?? 0) + 1);
    });
    const todayStart = new Date(new Date().toDateString()).getTime();
    const overdueItems = notClosed.filter((it) => it.dueDate && new Date(it.dueDate).getTime() < todayStart);
    const byOverdueSub = new Map<string, number>();
    overdueItems.forEach((it) => {
      const k = it.assignedToName || it.assignedToEmail || t('punch.noTrade');
      byOverdueSub.set(k, (byOverdueSub.get(k) ?? 0) + 1);
    });
    return {
      total: scoped.length,
      open: open('Open'),
      inProgress: open('In Progress'),
      ready: open('Ready for Review'),
      disputed: open('Disputed'),
      closed,
      pct,
      prioA: notClosed.filter((it) => it.priority === 'A').length,
      prioB: notClosed.filter((it) => it.priority === 'B').length,
      prioC: notClosed.filter((it) => it.priority === 'C').length,
      byArea,
      byTrade: [...byTrade.entries()].sort((a, b) => b[1] - a[1]),
      overdue: overdueItems.length,
      byOverdueSub: [...byOverdueSub.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [scoped, areas]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, projectId: projectFilter || (projects[0]?.id ?? ''), area: areaFilter || '' });
    setResponsibleSel('');
    setDialogOpen(true);
  };

  const openEdit = (it: PunchItem) => {
    setEditingId(it.id);
    setForm({
      projectId: it.projectId,
      title: it.title,
      description: it.description ?? '',
      correctiveAction: it.correctiveAction ?? '',
      area: it.area ?? '',
      location: it.location ?? '',
      trade: it.trade ?? '',
      assignedToName: it.assignedToName ?? '',
      assignedToEmail: it.assignedToEmail ?? '',
      priority: it.priority,
      dueDate: it.dueDate ? it.dueDate.split('T')[0] : '',
      identifiedBy: it.identifiedBy ?? '',
      notes: it.notes ?? '',
      backCharge: it.backCharge != null ? String(it.backCharge) : '',
    });
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
        correctiveAction: form.correctiveAction || null,
        area: form.area || null,
        location: form.location || null,
        trade: form.trade || null,
        assignedToName: form.assignedToName || null,
        assignedToEmail: form.assignedToEmail || null,
        priority: form.priority,
        dueDate: form.dueDate || null,
        identifiedBy: form.identifiedBy || null,
        notes: form.notes || null,
        backCharge: form.backCharge === '' ? null : Number(form.backCharge),
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

  const handleStatus = async (it: PunchItem, status: string, extra?: any) => {
    setBusyId(it.id);
    try {
      const res = await fetch(`/api/punch-items/${it.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...extra }),
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

  const handleDispute = async (it: PunchItem) => {
    await handleStatus(it, 'Disputed', {
      backCharge: disputeForm.backCharge === '' ? null : Number(disputeForm.backCharge),
      notes: disputeForm.notes
        ? `${it.notes ? it.notes + ' | ' : ''}${t('punch.disputeNotePrefix')}: ${disputeForm.notes}`
        : it.notes,
    });
    setDisputeOpen(null);
    setDisputeForm({ backCharge: '', notes: '' });
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
      Disputed: 'bg-red-100 text-red-800 border-red-300',
    };
    const key = s.replace(/ /g, '');
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${styles[s] ?? styles.Open}`}>
        {s === 'Completed' && <CheckCircle2 className="w-3 h-3" />}
        {s === 'Disputed' && <Ban className="w-3 h-3" />}
        {t(`punch.status${key}`)}
      </span>
    );
  };

  const priorityBadge = (p: string) => {
    const styles: Record<string, string> = {
      A: 'bg-red-600 text-white',
      B: 'bg-amber-500 text-white',
      C: 'bg-slate-400 text-white',
    };
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${styles[p] ?? styles.B}`} title={t(`punch.priority${p}_desc`)}>
        {p}
      </span>
    );
  };

  const isOverdue = (it: PunchItem) =>
    it.dueDate && it.status !== 'Completed' && new Date(it.dueDate) < new Date(new Date().toDateString());

  const daysOpen = (it: PunchItem) => {
    if (it.status === 'Completed') return 0;
    const base = it.dueDate ? null : null;
    const created = (it as any).createdAt ? new Date((it as any).createdAt).getTime() : null;
    const from = created ?? (it.dueDate ? new Date(it.dueDate).getTime() - 10 * 86400000 : Date.now());
    return Math.max(0, Math.floor((Date.now() - from) / 86400000));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((it) => it.id))));
  };
  const selectedItems = filtered.filter((it) => selected.has(it.id));

  const bulkAssign = async () => {
    if (selectedItems.length === 0) return;
    const proj = projects.find((p) => p.id === (projectFilter || selectedItems[0]?.projectId));
    const c = bulkContact !== '' ? (proj?.contacts ?? [])[Number(bulkContact)] : null;
    if (!c) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/punch-items/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItems.map((it) => it.id), action: 'assign', assignedToName: c.name, assignedToEmail: c.email }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('punch.bulkAssigned', { count: selectedItems.length }));
      setSelected(new Set());
      setBulkOpen(false);
      setBulkContact('');
      await load();
    } catch {
      toast.error(t('punch.bulkError'));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkReopen = async () => {
    if (selectedItems.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/punch-items/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItems.map((it) => it.id), action: 'reopen' }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('punch.saved'));
      setSelected(new Set());
      await load();
    } catch {
      toast.error(t('punch.bulkError'));
    } finally {
      setBulkBusy(false);
    }
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
          <button onClick={() => projectFilter && setQuickOpen(true)}
            title={!projectFilter ? t('punch.tabSignoffHint') : ''}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#C9A96E] text-[#0F1B33] text-sm font-bold hover:bg-[#B8955A] transition-colors ${!projectFilter ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <Zap className="w-4 h-4" /> {t('punch.quickCapture')}
          </button>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0F1B33] text-white text-sm font-semibold hover:bg-[#1B365D] transition-colors">
            <Plus className="w-4 h-4" /> {t('punch.newItem')}
          </button>
        </div>
      </div>

      {/* Pestañas: Ítems / Signoff (solo con proyecto seleccionado) */}
      <div className="flex items-center gap-2 border-b border-border">
        <button onClick={() => setTab('items')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'items' ? 'border-[#C9A96E] text-[#0F1B33]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          <ListChecks className="w-4 h-4" /> {t('punch.tabItems')}
        </button>
        <button onClick={() => projectFilter && setTab('plan')}
          title={!projectFilter ? t('punch.tabSignoffHint') : ''}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'plan' ? 'border-[#C9A96E] text-[#0F1B33]' : 'border-transparent text-muted-foreground hover:text-foreground'} ${!projectFilter ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <MapPin className="w-4 h-4" /> {t('punch.tabPlan')}
        </button>
        <button onClick={() => projectFilter && setTab('signoff')}
          title={!projectFilter ? t('punch.tabSignoffHint') : ''}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === 'signoff' ? 'border-[#C9A96E] text-[#0F1B33]' : 'border-transparent text-muted-foreground hover:text-foreground'} ${!projectFilter ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <PenLine className="w-4 h-4" /> {t('punch.tabSignoff')}
        </button>
      </div>

      {tab === 'signoff' && projectFilter ? (
        <PunchSignoff projectId={projectFilter} />
      ) : tab === 'plan' && projectFilter ? (
        <PunchPlanBoard
          projectId={projectFilter}
          items={scoped}
          onChanged={() => { void load(); }}
          onOpenList={(itemId) => {
            setTab('items');
            setSelected(new Set([itemId]));
          }}
          labels={{
            pickSheet: t('punch.pinPickSheet'),
            noPlans: t('punch.pinNoPlans'),
            noPlansDesc: t('punch.pinNoPlansDesc'),
            noFile: t('punch.pinNoFile'),
            loadError: t('punch.pinLoadError'),
            addPin: t('punch.pinAdd'),
            addPinHint: t('punch.pinAddHint'),
            cancelAdd: t('punch.pinCancelAdd'),
            pinTitle: t('punch.pinNewTitle'),
            pinTitlePlaceholder: t('punch.pinTitlePlaceholder'),
            pinPriority: t('punch.colPriority'),
            pinSave: t('punch.pinSave'),
            pinCancel: t('common.cancel'),
            pinSaved: t('punch.pinSaved'),
            pinError: t('punch.saveError'),
            openItems: t('punch.pinOpenItems'),
            legendOpen: t('punch.statusOpen'),
            legendReady: t('punch.statusReadyforReview'),
            legendDone: t('punch.statusCompleted'),
            backToList: t('punch.pinBackToList'),
          }}
        />
      ) : (
      <>
      {/* Dashboard estilo Excel PDG */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('punch.statsTotal'), value: stats.total, color: 'text-[#0F1B33]' },
          { label: t('punch.statsOpen'), value: stats.open, color: 'text-amber-600' },
          { label: t('punch.statsInProgress'), value: stats.inProgress, color: 'text-blue-600' },
          { label: t('punch.statsReady'), value: stats.ready, color: 'text-purple-600' },
          { label: t('punch.statsDisputed'), value: stats.disputed, color: 'text-red-600' },
          { label: `${t('punch.statsCompleted')} (${stats.pct}%)`, value: stats.closed, color: 'text-green-600' },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-card rounded-lg p-4 shadow-[var(--shadow-sm)] border border-border min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Abiertos por prioridad (A bloquea TCO) */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="bg-card rounded-lg p-4 border border-red-200 shadow-[var(--shadow-sm)]">
            <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {t('punch.priorityA_desc')}
            </p>
            <p className="text-2xl font-black text-red-600 mt-1">{stats.prioA}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-amber-200 shadow-[var(--shadow-sm)]">
            <p className="text-xs font-bold text-amber-600">{t('punch.priorityB_desc')}</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{stats.prioB}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-slate-200 shadow-[var(--shadow-sm)]">
            <p className="text-xs font-bold text-slate-500">{t('punch.priorityC_desc')}</p>
            <p className="text-2xl font-black text-slate-500 mt-1">{stats.prioC}</p>
          </div>
        </div>
      )}

      {/* Progreso por área (signoff se siente) */}
      {stats.byArea.length > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-[var(--shadow-sm)] border border-border">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">{t('punch.progressByArea')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            {stats.byArea.map((a) => {
              const pct = a.total ? Math.round((a.closed / a.total) * 100) : 0;
              return (
                <button key={a.area} onClick={() => setAreaFilter(areaFilter === a.area ? '' : a.area)}
                  className={`flex items-center gap-3 text-left group ${areaFilter === a.area ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}>
                  <span className="text-xs w-52 truncate shrink-0 font-medium">{a.area}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-600' : 'bg-[#C9A96E]'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right shrink-0">{a.closed}/{a.total} · {pct}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Vencidos por responsable (accountability) */}
      {stats.overdue > 0 && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {t('punch.agingBySub')} · {stats.overdue} {t('punch.agingOverdue')}
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.byOverdueSub.map(([name, count]) => (
              <span key={name} className="inline-flex items-center gap-1.5 bg-white border border-red-200 rounded-full px-3 py-1 text-xs font-semibold text-red-700">
                {name} <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-black">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Barra de acciones masivas */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 bg-[#0F1B33] rounded-lg p-3 flex flex-wrap items-center gap-3 shadow-xl">
          <span className="text-white text-sm font-bold">{t('punch.bulkSelected', { count: selected.size })}</span>
          <div className="flex-1" />
          <select value={bulkContact} onChange={(e) => setBulkContact(e.target.value)}
            className="px-3 py-2 rounded-md border border-white/20 bg-white/10 text-white text-sm max-w-xs [&>option]:text-black">
            <option value="">{t('punch.formResponsible')}</option>
            {(projects.find((p) => p.id === (projectFilter || selectedItems[0]?.projectId))?.contacts ?? []).map((c, i) => (
              <option key={i} value={i}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
            ))}
          </select>
          <button onClick={() => void bulkAssign()} disabled={bulkBusy || bulkContact === ''}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#C9A96E] text-[#0F1B33] text-sm font-bold disabled:opacity-40">
            {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} {t('punch.bulkAssign')}
          </button>
          <button onClick={() => void bulkReopen()} disabled={bulkBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/30 text-white text-sm font-semibold disabled:opacity-40">
            <RotateCcw className="w-4 h-4" /> {t('punch.bulkReopen')}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setAreaFilter(''); }} className={inputClass + ' max-w-xs'}>
          <option value="">{t('punch.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className={inputClass + ' max-w-xs'}>
          <option value="">{t('punch.allAreas')}</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
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
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} className="w-4 h-4 accent-[#C9A96E]" />
                </th>
                <th className="px-4 py-3 font-semibold w-14">#</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colItem')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colArea')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colResponsible')}</th>
                <th className="px-4 py-3 font-semibold w-16">{t('punch.colPriority')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colDue')}</th>
                <th className="px-4 py-3 font-semibold w-14" title={t('punch.colOpenDays')}>{t('punch.colOpenDays')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colPhotos')}</th>
                <th className="px-4 py-3 font-semibold">{t('punch.colStatus')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('punch.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline-block" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center">
                  <ListChecks className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-foreground">{t('punch.noItems')}</p>
                  <p className="text-sm text-muted-foreground">{t('punch.noItemsDesc')}</p>
                </td></tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id} className={`border-t border-border hover:bg-muted/40 ${it.status === 'Completed' ? 'opacity-60' : ''} ${it.status === 'Disputed' ? 'bg-red-50/50' : ''} ${selected.has(it.id) ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelect(it.id)} className="w-4 h-4 accent-[#C9A96E]" />
                    </td>
                    <td className="px-4 py-3 font-bold text-[#0F1B33]">PL-{String(it.itemNumber).padStart(3, '0')}</td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <p className="font-medium truncate flex items-center gap-1.5" title={it.title}>
                        {it.planSheetId && <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        {it.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[it.location, it.trade].filter(Boolean).join(' · ')}
                        {it.backCharge ? ` · 💰 $${Number(it.backCharge).toLocaleString('en-US')}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate" title={it.area ?? ''}>{it.area || '—'}</td>
                    <td className="px-4 py-3">
                      {it.assignedToName ? (
                        <>
                          <p className="font-medium text-sm">{it.assignedToName}</p>
                          {it.assignedToEmail && <p className="text-xs text-muted-foreground">{it.assignedToEmail}</p>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">{priorityBadge(it.priority)}</td>
                    <td className={`px-4 py-3 text-sm whitespace-nowrap ${isOverdue(it) ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                      {it.dueDate ? new Date(it.dueDate).toLocaleDateString() : '—'}
                      {isOverdue(it) && <span className="block text-xs">{t('punch.overdue')}</span>}
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold whitespace-nowrap ${it.status !== 'Completed' && daysOpen(it) > 10 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {it.status === 'Completed' ? '—' : t('punch.agingDays', { n: daysOpen(it) })}
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
                            {it.status !== 'Completed' && it.status !== 'Disputed' && (
                              <button onClick={() => { setDisputeOpen(it.id); setDisputeForm({ backCharge: it.backCharge != null ? String(it.backCharge) : '', notes: '' }); }}
                                title={t('punch.markDisputed')}
                                className="p-1.5 rounded hover:bg-muted text-red-600">
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            {(it.status === 'Completed' || it.status === 'Disputed') && (
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

      </>
      )}

      {/* Diálogo DISPUTED / back-charge */}
      {disputeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl shadow-xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-red-700 rounded-t-xl">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Ban className="w-4 h-4" /> {t('punch.disputeTitle')}
              </h2>
              <button onClick={() => setDisputeOpen(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">{t('punch.disputeDesc')}</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.backChargeAmount')}</label>
                <input type="number" step="any" value={disputeForm.backCharge}
                  onChange={(e) => setDisputeForm({ ...disputeForm, backCharge: e.target.value })}
                  className={inputClass} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.disputeNotes')}</label>
                <textarea value={disputeForm.notes}
                  onChange={(e) => setDisputeForm({ ...disputeForm, notes: e.target.value })}
                  className={inputClass + ' min-h-[70px]'} placeholder={t('punch.disputeNotesPlaceholder')} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setDisputeOpen(null)}
                  className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted">
                  {t('common.cancel')}
                </button>
                <button onClick={() => { const it = items.find((x) => x.id === disputeOpen); if (it) handleDispute(it); }}
                  className="px-4 py-2 rounded-md bg-red-700 text-white text-sm font-bold hover:bg-red-800">
                  {t('punch.confirmDispute')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formProject')} *</label>
                  <select value={form.projectId}
                    onChange={(e) => { setForm({ ...form, projectId: e.target.value, area: '', assignedToName: '', assignedToEmail: '' }); setResponsibleSel(''); }}
                    className={inputClass} disabled={Boolean(editingId)}>
                    <option value="">—</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.projectNumber} — {p.projectName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formArea')}</label>
                  <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={inputClass}>
                    <option value="">{t('punch.noArea')}</option>
                    {[...new Set(items.filter((it) => it.projectId === form.projectId).map((it) => it.area).filter(Boolean))].sort().map((a) => (
                      <option key={a as string} value={a as string}>{a as string}</option>
                    ))}
                    {form.area && ![...new Set(items.filter((it) => it.projectId === form.projectId).map((it) => it.area))].includes(form.area) && (
                      <option value={form.area}>{form.area}</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formTitle')} *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass}
                  placeholder={t('punch.formTitlePlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formCorrective')}</label>
                <textarea value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
                  className={inputClass + ' min-h-[60px]'} placeholder={t('punch.formCorrectivePlaceholder')} />
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formPriority')}</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p} — {t(`punch.priority${p}_short`)}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">{t('punch.dueAutoHint')}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formDueDate')}</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.formIdentifiedBy')}</label>
                  <input value={form.identifiedBy} onChange={(e) => setForm({ ...form, identifiedBy: e.target.value })} className={inputClass} />
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

      {quickOpen && projectFilter && (
        <QuickCaptureDialog
          projectId={projectFilter}
          projectNumber={projects.find((p) => p.id === projectFilter)?.projectNumber ?? ''}
          areas={areas}
          trades={[...new Set(scoped.map((it) => it.trade).filter(Boolean))].sort() as string[]}
          contacts={projects.find((p) => p.id === projectFilter)?.contacts ?? []}
          onClose={() => setQuickOpen(false)}
          onSaved={() => { void load(); }}
          labels={{
            stepPhoto: t('punch.qcStepPhoto'),
            stepData: t('punch.qcStepData'),
            takePhoto: t('punch.qcTakePhoto'),
            changePhoto: t('punch.qcChangePhoto'),
            markPhoto: t('punch.qcMarkPhoto'),
            area: t('punch.qcArea'),
            areaPlaceholder: t('punch.qcAreaPlaceholder'),
            location: t('punch.qcLocation'),
            locationPlaceholder: t('punch.qcLocationPlaceholder'),
            trade: t('punch.qcTrade'),
            title: t('punch.qcTitle'),
            titlePlaceholder: t('punch.qcTitlePlaceholder'),
            priority: t('punch.qcPriority'),
            assignNow: t('punch.qcAssignNow'),
            save: t('punch.qcSave'),
            saveAnother: t('punch.qcSaveAnother'),
            saved: (n: number) => t('punch.qcSaved', { n }),
            photoError: t('punch.qcPhotoError'),
            undo: t('punch.qcUndo'),
            clear: t('punch.qcClear'),
            cancel: t('punch.qcCancel'),
            done: t('punch.qcDone'),
          }}
        />
      )}
    </div>
  );
}
