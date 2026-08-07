'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import { uploadFileToStorage, downloadStorageFile } from '@/lib/upload-client';
import {
  FileStack, Upload, Plus, FileText, Loader2, Trash2, Pencil, X, Check,
  ChevronDown, ChevronRight, History, Eye, FolderPlus, Search,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// PLAN ROOM — drawing log con control de revisiones (Original, Permit, Rev A…)
// Solo Admin/Owner/PM suben (canUpload viene del API); todos consultan.
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectOpt { id: string; projectNumber: string; projectName: string }
interface PlanRevision {
  id: string; label: string; revisionDate: string | null;
  fileUrl: string | null; fileName: string | null;
  isCurrent: boolean; uploadedByName: string | null; createdAt: string;
}
interface PlanSheet {
  id: string; planSetId: string | null; sheetNumber: string; title: string;
  discipline: string | null; notes: string | null; revisions: PlanRevision[];
}
interface PlanSet { id: string; name: string; setType: string; issueDate: string | null }

const REV_PRESETS = ['Original', 'Permit', 'Rev A', 'Rev B', 'Rev C', 'Rev D', 'ASI', 'Addendum'];

function parseFileName(fileName: string): { sheetNumber: string; title: string } {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim();
  const m = /^([A-Za-z]{0,3}[-\s]?\d[\w.-]*)\s*[-–_]?\s*(.*)$/.exec(baseName);
  if (m) return { sheetNumber: m[1].replace(/\s+/g, '-').toUpperCase(), title: (m[2] || baseName).trim() || baseName };
  return { sheetNumber: baseName.toUpperCase(), title: baseName };
}

const fmtD = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export function PlanRoomContent({ projects }: { projects: ProjectOpt[] }) {
  const { t } = useI18n();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [sets, setSets] = useState<PlanSet[]>([]);
  const [sheets, setSheets] = useState<PlanSheet[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [historyFor, setHistoryFor] = useState<PlanSheet | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);

  const load = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/plan-sheets?projectId=${pid}`, { credentials: 'include' });
      if (res.status === 503) { setMigrationPending(true); setSets([]); setSheets([]); return; }
      if (!res.ok) throw new Error(t('plans.loadError'));
      const data = await res.json();
      setMigrationPending(false);
      setSets(data.sets ?? []);
      setSheets(data.sheets ?? []);
      setCanUpload(Boolean(data.canUpload));
    } catch (e: any) {
      toast.error(e?.message ?? t('plans.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(projectId); }, [projectId, load]);

  // Agrupar: por disciplina → planos
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sheets.filter((s) => {
      if (onlyCurrent && !s.revisions.some((r) => r.isCurrent && r.fileUrl)) return false;
      if (!q) return true;
      return s.sheetNumber.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || (s.discipline ?? '').toLowerCase().includes(q);
    });
  }, [sheets, search, onlyCurrent]);

  const byDiscipline = useMemo(() => {
    const map = new Map<string, PlanSheet[]>();
    for (const s of filtered) {
      const key = s.discipline ?? t('plans.noDiscipline');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, t]);

  const stats = useMemo(() => ({
    total: sheets.length,
    withFile: sheets.filter((s) => s.revisions.some((r) => r.isCurrent && r.fileUrl)).length,
    revisions: sheets.reduce((acc, s) => acc + s.revisions.length, 0),
    sets: sets.length,
  }), [sheets, sets]);

  const currentRev = (s: PlanSheet) => s.revisions.find((r) => r.isCurrent) ?? s.revisions[0];

  const deleteSheet = async (s: PlanSheet) => {
    if (!confirm(t('plans.deleteConfirm', { sheet: s.sheetNumber }))) return;
    try {
      const res = await fetch(`/api/plan-sheets/${s.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(t('plans.deleteError'));
      toast.success(t('plans.deleted'));
      void load(projectId);
    } catch (e: any) { toast.error(e?.message ?? t('plans.deleteError')); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileStack className="w-6 h-6 text-[#C9A96E]" /> {t('plans.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('plans.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {projectId && (
            <a
              href={`/api/plan-sheets/log-pdf?projectId=${projectId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-[#0F1B33] text-[#0F1B33] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-slate-50"
            >
              <FileText className="w-4 h-4" /> {t('plans.drawingLogPdf')}
            </a>
          )}
          {canUpload && (
            <>
              <button onClick={() => setSetOpen(true)} className="inline-flex items-center gap-2 border border-[#C9A96E] text-[#8A6D3B] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-amber-50">
                <FolderPlus className="w-4 h-4" /> {t('plans.newSet')}
              </button>
              <button onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-2 bg-[#0F1B33] hover:bg-[#1B2A4A] text-white px-4 py-2 rounded-lg font-semibold text-sm">
                <Upload className="w-4 h-4" /> {t('plans.uploadPlans')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selector de proyecto + stats */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[260px]"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>#{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
        <div className="flex gap-3 flex-wrap">
          {[
            [t('plans.statsSheets'), stats.total],
            [t('plans.statsWithFile'), stats.withFile],
            [t('plans.statsRevisions'), stats.revisions],
            [t('plans.statsSets'), stats.sets],
          ].map(([label, val]) => (
            <div key={String(label)} className="bg-white border rounded-xl px-4 py-2">
              <p className="text-[10px] uppercase text-slate-500">{label}</p>
              <p className="text-lg font-bold text-[#0F1B33]">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {migrationPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {t('plans.migrationPending')}
        </div>
      )}

      {/* Búsqueda + filtro */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('plans.searchPlaceholder')}
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={onlyCurrent} onChange={(e) => setOnlyCurrent(e.target.checked)} className="rounded" />
          {t('plans.onlyWithCurrentFile')}
        </label>
      </div>

      {/* Árbol por disciplina */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center">
          <FileStack className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700">{t('plans.noPlans')}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('plans.noPlansDesc')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {byDiscipline.map(([disc, discSheets]) => {
            const isCollapsed = collapsed[disc];
            return (
              <div key={disc} className="bg-white border rounded-2xl overflow-hidden">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [disc]: !c[disc] }))}
                  className="w-full flex items-center justify-between px-5 py-3 bg-[#0F1B33] text-white"
                >
                  <span className="font-semibold flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {disc}
                  </span>
                  <span className="text-xs text-white/70">{discSheets.length} {t('plans.sheetsCount')}</span>
                </button>
                {!isCollapsed && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-slate-500 border-b">
                        <th className="px-5 py-2 w-28">{t('plans.colSheet')}</th>
                        <th className="px-3 py-2">{t('plans.colTitle')}</th>
                        <th className="px-3 py-2 w-36">{t('plans.colSet')}</th>
                        <th className="px-3 py-2 w-40">{t('plans.colCurrentRev')}</th>
                        <th className="px-3 py-2 w-28">{t('plans.colDate')}</th>
                        <th className="px-3 py-2 w-36 text-right">{t('plans.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discSheets.map((s) => {
                        const cur = currentRev(s);
                        const setName = sets.find((x) => x.id === s.planSetId)?.name ?? '—';
                        return (
                          <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-5 py-2.5 font-bold text-[#0F1B33]">{s.sheetNumber}</td>
                            <td className="px-3 py-2.5">{s.title}</td>
                            <td className="px-3 py-2.5 text-slate-500 text-xs">{setName}</td>
                            <td className="px-3 py-2.5">
                              {cur ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">{cur.label}</span>
                                  {!cur.fileUrl && <span className="text-[10px] text-amber-600">({t('plans.noFile')})</span>}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 text-xs">{fmtD(cur?.revisionDate ?? null)}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                {cur?.fileUrl && (
                                  <button
                                    title={t('plans.viewPlan')}
                                    onClick={() => void downloadStorageFile(cur.fileUrl!, cur.fileName ?? `${s.sheetNumber}.pdf`).catch(() => toast.error(t('plans.downloadError')))}
                                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
                                <button title={t('plans.history')} onClick={() => setHistoryFor(s)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">
                                  <History className="w-4 h-4" />
                                </button>
                                {canUpload && (
                                  <button title={t('plans.delete')} onClick={() => void deleteSheet(s)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {historyFor && (
        <HistoryDialog
          sheet={historyFor}
          canUpload={canUpload}
          onClose={() => setHistoryFor(null)}
          onChanged={() => { setHistoryFor(null); void load(projectId); }}
        />
      )}
      {uploadOpen && (
        <UploadDialog
          projectId={projectId}
          sets={sets}
          existingSheets={sheets}
          onClose={() => setUploadOpen(false)}
          onDone={() => { setUploadOpen(false); void load(projectId); }}
        />
      )}
      {setOpen && (
        <SetDialog
          projectId={projectId}
          onClose={() => setSetOpen(false)}
          onDone={() => { setSetOpen(false); void load(projectId); }}
        />
      )}
    </div>
  );
}

// ─── Modal: historial de revisiones de un plano ─────────────────────────────
function HistoryDialog({ sheet, canUpload, onClose, onChanged }: {
  sheet: PlanSheet; canUpload: boolean; onClose: () => void; onChanged: () => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [revDate, setRevDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [setCurrent, setSetCurrent] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addRevision = async () => {
    if (!label.trim()) { toast.error(t('plans.labelRequired')); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('label', label.trim());
      if (revDate) fd.append('revisionDate', revDate);
      fd.append('setCurrent', setCurrent ? '1' : '0');
      if (file) fd.append('file', file);
      const res = await fetch(`/api/plan-sheets/${sheet.id}/revisions`, { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? t('plans.saveError'));
      toast.success(t('plans.revisionAdded'));
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? t('plans.saveError')); }
    finally { setBusy(false); }
  };

  const markCurrent = async (revisionId: string) => {
    try {
      const res = await fetch(`/api/plan-sheets/${sheet.id}/revisions`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId }),
      });
      if (!res.ok) throw new Error(t('plans.saveError'));
      toast.success(t('plans.currentUpdated'));
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? t('plans.saveError')); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#0F1B33] px-5 py-4 flex items-center justify-between sticky top-0">
          <h3 className="text-white font-bold">{sheet.sheetNumber} — {sheet.title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-slate-500 border-b">
                <th className="py-2 pr-2">{t('plans.colRev')}</th>
                <th className="py-2 pr-2">{t('plans.colDate')}</th>
                <th className="py-2 pr-2">{t('plans.colFile')}</th>
                <th className="py-2 pr-2">{t('plans.colUploadedBy')}</th>
                <th className="py-2 text-right">{t('plans.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.revisions.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    {r.isCurrent
                      ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">{r.label}</span>
                      : <span className="text-slate-600">{r.label}</span>}
                  </td>
                  <td className="py-2 pr-2 text-xs text-slate-500">{fmtD(r.revisionDate)}</td>
                  <td className="py-2 pr-2 text-xs">
                    {r.fileUrl ? (
                      <button
                        onClick={() => void downloadStorageFile(r.fileUrl!, r.fileName ?? 'plan.pdf').catch(() => toast.error(t('plans.downloadError')))}
                        className="text-[#0F1B33] underline underline-offset-2"
                      >
                        {r.fileName ?? 'PDF'}
                      </button>
                    ) : <span className="text-amber-600">{t('plans.noFile')}</span>}
                  </td>
                  <td className="py-2 pr-2 text-xs text-slate-500">{r.uploadedByName ?? '—'}</td>
                  <td className="py-2 text-right">
                    {canUpload && !r.isCurrent && (
                      <button onClick={() => void markCurrent(r.id)} className="text-xs font-semibold text-[#8A6D3B] hover:underline">
                        {t('plans.makeCurrent')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canUpload && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-semibold text-sm text-[#0F1B33]">{t('plans.addRevision')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('plans.colRev')} *</label>
                  <input list="rev-presets" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rev A" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  <datalist id="rev-presets">{REV_PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('plans.colDate')}</label>
                  <input type="date" value={revDate} onChange={(e) => setRevDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('plans.colFile')}</label>
                  <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={setCurrent} onChange={(e) => setSetCurrent(e.target.checked)} className="rounded" />
                {t('plans.setAsCurrent')}
              </label>
              <div className="flex justify-end">
                <button onClick={() => void addRevision()} disabled={busy || !label.trim()} className="inline-flex items-center gap-2 bg-[#0F1B33] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t('plans.addRevisionBtn')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal: subida múltiple de planos ───────────────────────────────────────
interface UploadRow {
  file: File; sheetNumber: string; title: string; label: string;
  status: 'pending' | 'uploading' | 'done' | 'error'; note?: string;
}

function UploadDialog({ projectId, sets, existingSheets, onClose, onDone }: {
  projectId: string; sets: PlanSet[]; existingSheets: PlanSheet[]; onClose: () => void; onDone: () => void;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [planSetId, setPlanSetId] = useState('');
  const [busy, setBusy] = useState(false);

  const addFiles = (files: File[]) => {
    const newRows: UploadRow[] = files.map((file) => {
      const parsed = parseFileName(file.name);
      const exists = existingSheets.some((s) => s.sheetNumber === parsed.sheetNumber);
      return {
        file,
        sheetNumber: parsed.sheetNumber,
        title: parsed.title,
        label: exists ? '' : 'Original',
        status: 'pending',
        note: exists ? t('plans.willAddRevision') : undefined,
      };
    });
    setRows((r) => [...r, ...newRows]);
  };

  const submit = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const items: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'uploading' } : r)));
        try {
          const uploaded = await uploadFileToStorage(row.file);
          items.push({
            fileName: row.file.name,
            fileUrl: uploaded.cloud_storage_path,
            fileIsPublic: (uploaded as any).isPublic ?? true,
            sheetNumber: row.sheetNumber,
            title: row.title,
            label: row.label.trim() || 'Original',
          });
          setRows((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'done' } : r)));
        } catch {
          setRows((rs) => rs.map((r, j) => (j === i ? { ...r, status: 'error' } : r)));
        }
      }
      if (items.length > 0) {
        const res = await fetch('/api/plan-sheets/bulk', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, planSetId: planSetId || null, items }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? t('plans.saveError'));
        }
      }
      toast.success(t('plans.uploadDone', { count: items.length }));
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? t('plans.saveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#0F1B33] px-5 py-4 flex items-center justify-between sticky top-0">
          <h3 className="text-white font-bold flex items-center gap-2"><Upload className="w-4 h-4 text-[#C9A96E]" /> {t('plans.uploadTitle')}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('plans.assignToSet')}</label>
              <select value={planSetId} onChange={(e) => setPlanSetId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">{t('plans.noSet')}</option>
                {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex-1" />
            <label className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#0F1B33] px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer hover:bg-[#B8955A]">
              <Plus className="w-4 h-4" /> {t('plans.pickFiles')}
              <input
                type="file"
                multiple
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
              />
            </label>
          </div>

          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-500 border-b">
                  <th className="py-2 pr-2">{t('plans.colFile')}</th>
                  <th className="py-2 pr-2 w-28">{t('plans.colSheet')}</th>
                  <th className="py-2 pr-2">{t('plans.colTitle')}</th>
                  <th className="py-2 pr-2 w-28">{t('plans.colRev')}</th>
                  <th className="py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 text-xs text-slate-500 max-w-[180px] truncate">
                      {row.file.name}
                      {row.status === 'uploading' && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
                      {row.status === 'done' && <Check className="w-3 h-3 text-green-600 inline ml-1" />}
                      {row.note && <p className="text-[10px] text-amber-600">{row.note}</p>}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input value={row.sheetNumber} onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, sheetNumber: e.target.value.toUpperCase() } : r)))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-bold" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input value={row.title} onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input list="rev-presets" value={row.label} onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} placeholder="Original" className="w-full border border-slate-200 rounded px-2 py-1 text-xs" />
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="text-xs text-slate-500">{t('plans.uploadHint')}</p>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>
            <button onClick={() => void submit()} disabled={busy || rows.length === 0} className="inline-flex items-center gap-2 bg-[#0F1B33] text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {busy ? t('plans.uploading') : t('plans.uploadBtn', { count: rows.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: nuevo paquete de planos ─────────────────────────────────────────
function SetDialog({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [setType, setSetType] = useState('Original');
  const [issueDate, setIssueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/plan-sets', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name: name.trim(), setType, issueDate: issueDate || undefined }),
      });
      if (!res.ok) throw new Error(t('plans.saveError'));
      toast.success(t('plans.setCreated'));
      onDone();
    } catch (e: any) { toast.error(e?.message ?? t('plans.saveError')); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#0F1B33] px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2"><FolderPlus className="w-4 h-4 text-[#C9A96E]" /> {t('plans.newSet')}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('plans.setName')} *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('plans.setNamePlaceholder')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('plans.setType')}</label>
              <select value={setType} onChange={(e) => setSetType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                {['Original', 'Permit', 'Addendum', 'ASI', 'Revision', 'Other'].map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('plans.setIssueDate')}</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>
            <button onClick={() => void submit()} disabled={busy || !name.trim()} className="inline-flex items-center gap-2 bg-[#0F1B33] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t('plans.createSetBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
