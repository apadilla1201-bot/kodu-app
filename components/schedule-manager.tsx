'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import {
  CalendarDays, GitCompare, Clock, Plus, ChevronDown, ChevronRight,
  Loader2, FileSpreadsheet, Download, Upload, ArrowLeftRight,
  Check, X, AlertTriangle, ArrowRight, Minus,
} from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

const ScheduleGantt = dynamic(() => import('@/components/schedule-gantt'), { ssr: false });

/* ── Types ───────────────────────────────────────────────────────── */
interface Activity {
  id: string; sortOrder: number; activityId: string; activityName: string;
  activityType: string; originalDuration: number; remainingDuration: number;
  percentComplete: number; startDate: string | null; finishDate: string | null;
  status: string; isCritical: boolean; isMilestone: boolean;
  notes: string | null; wbsCode: string; resourceName: string;
  costLoaded: number; floatDays: number;
  isLookAhead?: boolean; parentActivityId?: string | null;
}

interface ScheduleData {
  id: string; revision: string; dataDate: string;
  projectStart: string | null; projectFinish: string | null;
  tcoDate: string | null; notes: string | null; status: string;
  activities: Activity[];
  createdAt?: string | null;
}

interface ApprovedCOR {
  id: string; corNumber: string; description: string; subcontractor: string | null;
  date: string; approvalDate: string | null; totalAmount: number;
}

interface Props {
  schedules: ScheduleData[];
  projectId: string;
  approvedCORs?: ApprovedCOR[];
}

interface DiffItem {
  activityId: string; activityName: string;
  changeType: 'added' | 'deleted' | 'modified';
  changes: { field: string; from: any; to: any }[];
  base: any | null; compare: any | null;
}

interface LookAheadActivity {
  id: string; activityId: string; activityName: string;
  originalDuration: number; remainingDuration: number;
  percentComplete: number; startDate: string | null; finishDate: string | null;
  status: string; isCritical: boolean; isMilestone?: boolean;
  notes: string | null; resourceName: string; costLoaded?: number;
  parentActivityId?: string | null;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dt.getDate()}-${months[dt.getMonth()]}-${dt.getFullYear().toString().slice(-2)}`;
}

function fmtShort(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : `${dt.getMonth()+1}/${dt.getDate()}`;
}

/* ── Component ────────────────────────────────────────────────── */
export default function ScheduleManager({ schedules, projectId, approvedCORs = [] }: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<'gantt' | 'versions' | 'compare' | 'lookahead'>('gantt');
  const [allSchedules, setAllSchedules] = useState<ScheduleData[]>(schedules);
  const activeSchedule = useMemo(() => allSchedules.find(s => s.status === 'Active') ?? allSchedules[0] ?? null, [allSchedules]);

  // Comparison state
  const [baseId, setBaseId] = useState('');
  const [compareId, setCompareId] = useState('');
  const [comparing, setComparing] = useState(false);
  const [diffResult, setDiffResult] = useState<{ base: any; compare: any; summary: any; diffs: DiffItem[] } | null>(null);

  // Clone state
  const [cloning, setCloning] = useState(false);
  const [cloneRevision, setCloneRevision] = useState('');

  // Look-ahead state
  const [laLoading, setLaLoading] = useState(false);
  const [laData, setLaData] = useState<{ activities: LookAheadActivity[]; detailActivities: LookAheadActivity[]; windowStart: string; windowEnd: string } | null>(null);
  const [laStartDate, setLaStartDate] = useState('');
  const [laImporting, setLaImporting] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);

  // Sub-tabs styling
  const subTabs = [
    { key: 'gantt', label: t('schedules.ganttChart'), icon: CalendarDays },
    { key: 'lookahead', label: t('schedules.twoWeekLookahead'), icon: Clock },
    { key: 'compare', label: t('schedules.fragnetCompareTab'), icon: GitCompare },
    { key: 'versions', label: t('schedules.versionHistory'), icon: FileSpreadsheet },
  ] as const;

  // ── Compare ────────────────────────────────────────
  const runComparison = async () => {
    if (!baseId || !compareId) { toast.error(t('schedules.selectTwoVersions')); return; }
    setComparing(true);
    setDiffResult(null);
    try {
      const res = await fetch('/api/schedules/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseId, compareId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDiffResult(data);
    } catch { toast.error(t('schedules.compareError')); }
    finally { setComparing(false); }
  };

  // ── Clone ─────────────────────────────────────────
  const handleClone = async (sourceId: string) => {
    if (!cloneRevision.trim()) { toast.error(t('schedules.revisionNameRequired')); return; }
    setCloning(true);
    try {
      const res = await fetch(`/api/schedules/${sourceId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: cloneRevision, dataDate: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('schedules.revisionCreated', { name: cloneRevision }));
      setCloneRevision('');
      // Refresh schedules
      const listRes = await fetch(`/api/schedules?projectId=${projectId}`);
      if (listRes.ok) {
        const list = await listRes.json();
        // Need to fetch full data with activities for each
        window.location.reload();
      }
    } catch { toast.error(t('schedules.cloneError')); }
    finally { setCloning(false); }
  };

  // ── Look-Ahead ────────────────────────────────────
  const loadLookAhead = async () => {
    if (!activeSchedule) return;
    setLaLoading(true);
    try {
      const qp = laStartDate ? `?startDate=${encodeURIComponent(laStartDate)}` : '';
      const res = await fetch(`/api/schedules/${activeSchedule.id}/lookahead${qp}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLaData(data);
    } catch { toast.error(t('schedules.laLoadError')); }
    finally { setLaLoading(false); }
  };

  useEffect(() => {
    if (view === 'lookahead' && !laData) loadLookAhead();
  }, [view, laData]);

  // ── Look-Ahead Excel Export ────────────────────────
  const exportLookAheadExcel = () => {
    if (!laData) return;
    const allActs = [...laData.activities, ...laData.detailActivities];
    // CSV export (Excel-compatible)
    const headers = ['Activity ID','Activity Name','Orig Dur','Rem Dur','% Complete','Start','Finish','Status','Critical','Resource','Notes','Parent Activity ID','Is Look-Ahead Detail'];
    const rows = allActs.map(a => [
      a.activityId,
      `"${(a.activityName || '').replace(/"/g, '""')}"`,
      a.originalDuration,
      a.remainingDuration,
      a.percentComplete,
      a.startDate ? new Date(a.startDate).toISOString().split('T')[0] : '',
      a.finishDate ? new Date(a.finishDate).toISOString().split('T')[0] : '',
      a.status,
      a.isCritical ? 'Y' : 'N',
      `"${(a.resourceName || '').replace(/"/g, '""')}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
      a.parentActivityId || '',
      a.parentActivityId ? 'Y' : 'N',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LookAhead_2wk_${fmtDate(laData.windowStart).replace(/[^\w]/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('schedules.laExcelExported'));
  };

  // ── Look-Ahead Excel Import ────────────────────────
  const handleLAImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSchedule) return;
    setLaImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('No data');

      // Parse CSV
      const parseLine = (line: string) => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
          else current += ch;
        }
        result.push(current.trim());
        return result;
      };

      const header = parseLine(lines[0]).map(h => h.toLowerCase());
      const idIdx = header.findIndex(h => h.includes('activity id'));
      const nameIdx = header.findIndex(h => h.includes('activity name'));
      const odIdx = header.findIndex(h => h.includes('orig'));
      const rdIdx = header.findIndex(h => h.includes('rem'));
      const pcIdx = header.findIndex(h => h.includes('% comp') || h.includes('complete'));
      const sIdx = header.findIndex(h => h === 'start');
      const fIdx = header.findIndex(h => h === 'finish');
      const stIdx = header.findIndex(h => h === 'status');
      const critIdx = header.findIndex(h => h.includes('critical'));
      const resIdx = header.findIndex(h => h.includes('resource'));
      const notesIdx = header.findIndex(h => h.includes('notes'));
      const parentIdx = header.findIndex(h => h.includes('parent'));
      const isLAIdx = header.findIndex(h => h.includes('look-ahead') || h.includes('lookahead'));

      // Only import rows marked as look-ahead details (or new rows not in CPM)
      const existingIds = new Set((laData?.activities || []).map(a => a.activityId));
      const importActivities: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        const actId = cols[idIdx] || '';
        const isLA = isLAIdx >= 0 ? cols[isLAIdx]?.toUpperCase() === 'Y' : !existingIds.has(actId);

        if (isLA || !existingIds.has(actId)) {
          importActivities.push({
            activityId: actId || `LA-${i}`,
            activityName: cols[nameIdx] || '',
            originalDuration: parseInt(cols[odIdx]) || 0,
            remainingDuration: parseInt(cols[rdIdx]) || 0,
            percentComplete: parseFloat(cols[pcIdx]) || 0,
            startDate: cols[sIdx] || null,
            finishDate: cols[fIdx] || null,
            status: cols[stIdx] || 'pend',
            isCritical: critIdx >= 0 ? cols[critIdx]?.toUpperCase() === 'Y' : false,
            notes: cols[notesIdx] || null,
            resourceName: cols[resIdx] || '',
            parentActivityId: cols[parentIdx] || null,
          });
        }
      }

      if (importActivities.length === 0) {
        toast.info(t('schedules.laNoNewActivities'));
        setLaImporting(false);
        return;
      }

      const res = await fetch(`/api/schedules/${activeSchedule.id}/lookahead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: importActivities }),
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      toast.success(t('schedules.laImportedCount', { count: result.imported }));
      await loadLookAhead(); // Refresh
    } catch (err) {
      toast.error(t('schedules.laCsvImportError'));
    } finally {
      setLaImporting(false);
      e.target.value = '';
    }
  };

  // ── Look-Ahead PDF ─────────────────────────────────
  const [laPdfLoading, setLaPdfLoading] = useState<'executive' | 'technical' | null>(null);

  const downloadLookAheadPdf = async (type: 'executive' | 'technical') => {
    if (!activeSchedule) return;
    setLaPdfLoading(type);
    try {
      const res = await fetch(`/api/schedules/${activeSchedule.id}/lookahead/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          ...(laStartDate ? { startDate: laStartDate } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const fname = match?.[1] || `LookAhead_${type}_${activeSchedule.revision}.pdf`;
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
      toast.success(
        type === 'executive'
          ? t('schedules.laExecutivePdfDownloaded')
          : t('schedules.laTechnicalPdfDownloaded')
      );
    } catch {
      toast.error(t('schedules.laPdfError'));
    } finally {
      setLaPdfLoading(null);
    }
  };

  // ── Excel CPM Import ────────────────────────────────────────
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('projectId', projectId);
      fd.append('action', 'import');
      const res = await fetch('/api/schedules/import-excel', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error' }));
        throw new Error(err.error || 'Import failed');
      }
      const data = await res.json();
      toast.success(data.message || 'CPM importado exitosamente');
      // Reload page to refresh schedule list
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || t('schedules.cpmImportError'));
    } finally {
      setExcelImporting(false);
      e.target.value = '';
    }
  };

  if (!activeSchedule && allSchedules.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">{t('schedules.noScheduleYet')}</h3>
        <p className="text-muted-foreground text-sm">{t('schedules.noScheduleHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = view === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setView(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#0F1B33] text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── GANTT VIEW ── */}
      {view === 'gantt' && activeSchedule && (
        <ScheduleGantt schedule={activeSchedule} projectId={projectId} approvedCORs={approvedCORs} />
      )}

      {/* ── VERSION HISTORY ── */}
      {view === 'versions' && (
        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#C9A96E]" /> {t('schedules.versionHistoryTitle')}
            </h3>
          </div>

          {/* Import Excel section */}
          <div className="p-4 bg-gradient-to-r from-[#0F1B33]/5 to-[#C9A96E]/10 border-b border-border">
            <p className="text-xs font-semibold text-[#0F1B33] mb-2 flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-[#C9A96E]" /> {t('schedules.importCpmExcel')}
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">{t('schedules.uploadHint')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="px-3 py-1.5 bg-[#C9A96E] text-white rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer hover:bg-[#B8975D] transition-colors">
                <Upload className="w-3 h-3" /> {t('schedules.selectExcel')}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelImport}
                  className="hidden"
                />
              </label>
              {excelImporting && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t('schedules.importing')}
                </span>
              )}
            </div>
          </div>

          {/* Clone section */}
          {activeSchedule && (
            <div className="p-4 bg-[#C9A96E]/10 border-b border-border">
              <p className="text-xs text-muted-foreground mb-2">{t('schedules.cloneHint', { revision: activeSchedule.revision })}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={t('schedules.revisionPlaceholder')}
                  value={cloneRevision}
                  onChange={e => setCloneRevision(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm w-40 outline-none focus:border-[#C9A96E]"
                />
                <button
                  onClick={() => handleClone(activeSchedule.id)}
                  disabled={cloning || !cloneRevision.trim()}
                  className="px-3 py-1.5 bg-[#0F1B33] text-white rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-50 hover:bg-[#0a1225]"
                >
                  {cloning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  {t('schedules.createRevision')}
                </button>
              </div>
            </div>
          )}

          {/* Version list */}
          <div className="divide-y divide-border">
            {allSchedules.map(s => {
              const tasks = s.activities.filter(a => !a.activityType.startsWith('group_') && !('isLookAhead' in a && (a as any).isLookAhead));
              const critCount = tasks.filter(a => a.isCritical).length;
              const doneCount = tasks.filter(a => a.status === 'done').length;
              const avgPct = tasks.length > 0 ? Math.round(tasks.reduce((sum, a) => sum + a.percentComplete, 0) / tasks.length) : 0;
              return (
                <div key={s.id} className={`p-4 flex items-center justify-between ${s.status === 'Active' ? 'bg-[#C9A96E]/20' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${s.status === 'Active' ? 'bg-[#0F1B33]' : 'bg-gray-300'}`} />
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {s.revision}
                        {s.status === 'Active' && <span className="text-[10px] bg-[#0F1B33] text-white px-1.5 py-0.5 rounded">{t('schedules.active')}</span>}
                        {s.status === 'Superseded' && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{t('schedules.superseded')}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('schedules.dataDateSummary', {
                          date: fmtDate(s.dataDate),
                          tasks: tasks.length,
                          critical: critCount,
                          done: doneCount,
                          progress: avgPct,
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {s.tcoDate && <span className="text-muted-foreground">TCO: {fmtDate(s.tcoDate)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── COMPARE / FRAGNET ── */}
      {view === 'compare' && (
        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <GitCompare className="w-4 h-4 text-[#C9A96E]" /> {t('schedules.fragnetCompare')}
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('schedules.cpmBase')}</label>
                <select
                  value={baseId}
                  onChange={e => setBaseId(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm min-w-[180px] outline-none"
                >
                  <option value="">{t('schedules.select')}</option>
                  {allSchedules.map(s => (
                    <option key={s.id} value={s.id}>{s.revision} — {fmtDate(s.dataDate)}</option>
                  ))}
                </select>
              </div>
              <ArrowLeftRight className="w-4 h-4 text-muted-foreground mt-4" />
              <div>
                <label className="text-xs text-muted-foreground block mb-1">{t('schedules.cpmCompare')}</label>
                <select
                  value={compareId}
                  onChange={e => setCompareId(e.target.value)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm min-w-[180px] outline-none"
                >
                  <option value="">{t('schedules.select')}</option>
                  {allSchedules.map(s => (
                    <option key={s.id} value={s.id}>{s.revision} — {fmtDate(s.dataDate)}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={runComparison}
                disabled={comparing || !baseId || !compareId || baseId === compareId}
                className="mt-4 px-4 py-1.5 bg-[#0F1B33] text-white rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-50 hover:bg-[#0a1225]"
              >
                {comparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitCompare className="w-3 h-3" />}
                {t('schedules.compare')}
              </button>
            </div>
          </div>

          {/* Diff results */}
          {diffResult && (
            <div>
              {/* Summary bar */}
              <div className="flex items-center gap-4 px-4 py-3 bg-[#F7F7F5] border-b border-border text-xs">
                <span className="font-semibold">{diffResult.base.revision} vs {diffResult.compare.revision}</span>
                <span className="flex items-center gap-1 text-green-700"><Plus className="w-3 h-3" /> {t('schedules.addedCount', { count: diffResult.summary.added })}</span>
                <span className="flex items-center gap-1 text-red-600"><Minus className="w-3 h-3" /> {t('schedules.deletedCount', { count: diffResult.summary.deleted })}</span>
                <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> {t('schedules.modifiedCount', { count: diffResult.summary.modified })}</span>
                <span className="text-muted-foreground">{t('schedules.unchangedCount', { count: diffResult.summary.unchanged })}</span>
              </div>

              {/* Diff table */}
              {diffResult.diffs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#D9D9D9] text-[10px]">
                        <th className="px-2 py-1.5 text-left font-bold">{t('schedules.colId')}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{t('schedules.colActivity')}</th>
                        <th className="px-2 py-1.5 text-center font-bold">{t('schedules.colType')}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{t('schedules.colChanges')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffResult.diffs.map((d, i) => (
                        <tr
                          key={i}
                          className={`border-b border-border/50 ${
                            d.changeType === 'added' ? 'bg-green-50' :
                            d.changeType === 'deleted' ? 'bg-red-50' :
                            'bg-amber-50/50'
                          }`}
                        >
                          <td className="px-2 py-1.5 font-mono text-[#1F4E79]">{d.activityId}</td>
                          <td className={`px-2 py-1.5 ${d.changeType === 'deleted' ? 'line-through text-red-500' : ''}`}>
                            {d.activityName}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {d.changeType === 'added' && <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{t('schedules.changeAdded')}</span>}
                            {d.changeType === 'deleted' && <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{t('schedules.changeDeleted')}</span>}
                            {d.changeType === 'modified' && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{t('schedules.changeModified')}</span>}
                          </td>
                          <td className="px-2 py-1.5">
                            {d.changeType === 'added' && d.compare && (
                              <span className="text-green-700">
                                Start: {fmtShort(d.compare.startDate)} → {t('schedules.fieldFinish')}: {fmtShort(d.compare.finishDate)} ({d.compare.originalDuration}d)
                              </span>
                            )}
                            {d.changeType === 'deleted' && d.base && (
                              <span className="text-red-500">
                                {t('schedules.wasLabel')} {fmtShort(d.base.startDate)} – {fmtShort(d.base.finishDate)} ({d.base.originalDuration}d, {d.base.percentComplete}%)
                              </span>
                            )}
                            {d.changeType === 'modified' && (
                              <div className="flex flex-wrap gap-2">
                                {d.changes.map((c, ci) => {
                                  const label = c.field === 'startDate' ? t('schedules.fieldStart') :
                                    c.field === 'finishDate' ? t('schedules.fieldFinish') :
                                    c.field === 'originalDuration' ? t('schedules.fieldDur') :
                                    c.field === 'percentComplete' ? '%' :
                                    c.field === 'status' ? t('schedules.fieldStatus') :
                                    c.field === 'isCritical' ? t('schedules.fieldCritical') :
                                    c.field === 'activityName' ? t('schedules.fieldName') : c.field;
                                  const from = c.field.includes('Date') ? fmtShort(c.from) : String(c.from);
                                  const to = c.field.includes('Date') ? fmtShort(c.to) : String(c.to);
                                  return (
                                    <span key={ci} className="bg-white border border-amber-200 rounded px-1 py-0.5 text-[10px]">
                                      <b>{label}:</b> <span className="text-red-500">{from}</span> <ArrowRight className="w-2.5 h-2.5 inline" /> <span className="text-green-700">{to}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">{t('schedules.noDiffs')}</div>
              )}
            </div>
          )}

          {!diffResult && !comparing && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {t('schedules.selectTwoToCompare')}
            </div>
          )}
        </div>
      )}

      {/* ── LOOK-AHEAD 2 WEEKS ── */}
      {view === 'lookahead' && (
        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C9A96E]" /> {t('schedules.twoWeekLookahead')}
              {laData && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  {fmtDate(laData.windowStart)} — {fmtDate(laData.windowEnd)}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="w-3 h-3" /> {t('schedules.weekStart')}
                <input
                  type="date"
                  value={laStartDate}
                  onChange={(e) => {
                    setLaStartDate(e.target.value);
                    setLaData(null);
                  }}
                  className="px-2 py-1 border border-border rounded-md text-xs bg-background"
                />
                {laStartDate && (
                  <button
                    onClick={() => { setLaStartDate(''); setLaData(null); }}
                    className="text-muted-foreground hover:text-foreground"
                    title={t('schedules.useDataDate')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </label>
              <button onClick={exportLookAheadExcel} disabled={!laData} className="px-3 py-1.5 border border-border rounded-md text-xs font-medium flex items-center gap-1 hover:bg-muted/60 disabled:opacity-50">
                <Download className="w-3 h-3" /> {t('schedules.exportExcel')}
              </button>
              <label className="px-3 py-1.5 border border-border rounded-md text-xs font-medium flex items-center gap-1 hover:bg-muted/60 cursor-pointer">
                <Upload className="w-3 h-3" /> {t('schedules.importExcelBtn')}
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleLAImport} className="hidden" />
              </label>
              <button
                onClick={() => downloadLookAheadPdf('executive')}
                disabled={!!laPdfLoading || !laData}
                className="px-3 py-1.5 bg-[#0F1B33] text-white rounded-md text-xs font-medium flex items-center gap-1 hover:bg-[#0a1225] disabled:opacity-50"
              >
                {laPdfLoading === 'executive' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {t('schedules.exportExecutivePdf')}
              </button>
              <button
                onClick={() => downloadLookAheadPdf('technical')}
                disabled={!!laPdfLoading || !laData}
                className="px-3 py-1.5 border border-[#C9A96E] text-[#0F1B33] rounded-md text-xs font-medium flex items-center gap-1 hover:bg-[#faf8f4] disabled:opacity-50"
              >
                {laPdfLoading === 'technical' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {t('schedules.exportTechnicalPdf')}
              </button>
              <button onClick={loadLookAhead} disabled={laLoading} className="px-2 py-1.5 border border-border rounded-md text-xs hover:bg-muted/60">
                {laLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : '↻'}
              </button>
            </div>
          </div>

          {laLoading ? (
            <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#C9A96E]" /></div>
          ) : laData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0F1B33] text-white text-[10px]">
                    <th className="px-2 py-2 text-left font-bold">{t('schedules.colId')}</th>
                    <th className="px-2 py-2 text-left font-bold w-[240px]">{t('schedules.activityName')}</th>
                    <th className="px-2 py-2 text-center font-bold">{t('schedules.colDur')}</th>
                    <th className="px-2 py-2 text-center font-bold">{t('schedules.colRem')}</th>
                    <th className="px-2 py-2 text-center font-bold">{t('schedules.colPct')}</th>
                    <th className="px-2 py-2 text-center font-bold">{t('schedules.colStart')}</th>
                    <th className="px-2 py-2 text-center font-bold">{t('schedules.colFinish')}</th>
                    <th className="px-2 py-2 text-center font-bold">{t('schedules.colStatus')}</th>
                    <th className="px-2 py-2 text-center font-bold">★</th>
                    <th className="px-2 py-2 text-left font-bold">{t('schedules.colResource')}</th>
                    <th className="px-2 py-2 text-left font-bold">{t('schedules.colNotes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {laData.activities.map((a, i) => (
                    <tr key={a.id} className={`border-b border-border/30 ${
                      a.isCritical ? 'bg-red-50 font-semibold' : i % 2 === 0 ? 'bg-white' : 'bg-[#F7F7F5]'
                    }`}>
                      <td className="px-2 py-1.5 font-mono text-[#1F4E79]">{a.activityId}</td>
                      <td className="px-2 py-1.5 max-w-[240px] truncate" title={a.activityName}>{a.activityName}</td>
                      <td className="px-2 py-1.5 text-center">{a.originalDuration}</td>
                      <td className="px-2 py-1.5 text-center">{a.remainingDuration}</td>
                      <td className="px-2 py-1.5 text-center">{a.percentComplete}%</td>
                      <td className="px-2 py-1.5 text-center">{fmtShort(a.startDate)}</td>
                      <td className="px-2 py-1.5 text-center">{fmtShort(a.finishDate)}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          a.status === 'done' ? 'bg-green-100 text-green-800' :
                          a.status === 'ip' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>{a.status === 'done' ? t('schedules.statusDone') : a.status === 'ip' ? t('schedules.statusIp') : t('schedules.statusPend')}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center">{a.isCritical ? '★' : ''}</td>
                      <td className="px-2 py-1.5 text-[10px] truncate max-w-[120px]" title={a.resourceName}>{a.resourceName}</td>
                      <td className="px-2 py-1.5 text-[10px] truncate max-w-[150px]" title={a.notes || ''}>{a.notes || ''}</td>
                    </tr>
                  ))}
                  {/* Detail activities (from import) */}
                  {laData.detailActivities.length > 0 && (
                    <>
                      <tr className="bg-[#1B2A4A] text-white">
                        <td colSpan={11} className="px-2 py-1.5 font-bold text-[10px]">{t('schedules.laDetailActivities')}</td>
                      </tr>
                      {laData.detailActivities.map((a, i) => (
                        <tr key={a.id} className={`border-b border-border/30 bg-amber-50/50 ${i % 2 === 0 ? '' : 'bg-amber-50'}`}>
                          <td className="px-2 py-1.5 font-mono text-[#C9A96E]">{a.activityId}</td>
                          <td className="px-2 py-1.5 max-w-[240px] truncate" title={a.activityName}>
                            {a.parentActivityId && <span className="text-[10px] text-muted-foreground mr-1">└</span>}
                            {a.activityName}
                          </td>
                          <td className="px-2 py-1.5 text-center">{a.originalDuration}</td>
                          <td className="px-2 py-1.5 text-center">{a.remainingDuration}</td>
                          <td className="px-2 py-1.5 text-center">{a.percentComplete}%</td>
                          <td className="px-2 py-1.5 text-center">{fmtShort(a.startDate)}</td>
                          <td className="px-2 py-1.5 text-center">{fmtShort(a.finishDate)}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {a.status === 'done' ? t('schedules.statusDone') : a.status === 'ip' ? t('schedules.statusIp') : t('schedules.statusPend')}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-center">{a.isCritical ? '★' : ''}</td>
                          <td className="px-2 py-1.5 text-[10px]">{a.resourceName}</td>
                          <td className="px-2 py-1.5 text-[10px]">{a.notes || ''}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
              {laData.activities.length === 0 && laData.detailActivities.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">{t('schedules.noActivitiesInWindow')}</div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
