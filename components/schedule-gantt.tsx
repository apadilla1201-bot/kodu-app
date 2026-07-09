'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import {
  Search, Filter, Download, Printer, ChevronDown, ChevronRight,
  Star, Clock, CheckCircle2, AlertTriangle, CalendarDays,
  Loader2, Save, RotateCcw, Plus,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────── */
interface Activity {
  id: string;
  sortOrder: number;
  activityId: string;
  activityName: string;
  activityType: string;
  originalDuration: number;
  remainingDuration: number;
  percentComplete: number;
  startDate: string | null;
  finishDate: string | null;
  status: string;
  isCritical: boolean;
  isMilestone: boolean;
  notes: string | null;
  wbsCode: string;
  resourceName: string;
  costLoaded: number;
  floatDays: number;
}

interface ScheduleData {
  id: string;
  revision: string;
  dataDate: string;
  projectStart: string | null;
  projectFinish: string | null;
  tcoDate: string | null;
  notes: string | null;
  status: string;
  activities: Activity[];
  project?: { projectName: string; projectNumber: string; id: string };
}

interface ApprovedCOR {
  id: string; corNumber: string; description: string; subcontractor: string | null;
  date: string; approvalDate: string | null; totalAmount: number;
}

interface Props {
  schedule: ScheduleData;
  projectId: string;
  approvedCORs?: ApprovedCOR[];
}

/* ── Helpers ───────────────────────────────────────────────────── */
const WW = 22; // pixels per week column (matches original CPM)
const ROW_H = 22;

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

function diffDays(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86400000;
}

function fmtShort(d: Date | string | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function fmtDate(d: Date | string | null) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtISO(d: Date) {
  return d.toISOString().split('T')[0];
}

function getMonday(d: Date) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/* ── Component ─────────────────────────────────────────────────── */
export default function ScheduleGantt({ schedule, projectId, approvedCORs = [] }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'crit' | 'pend' | 'ip' | 'done'>('all');
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ idx: number; field: string } | null>(null);
  const [activities, setActivities] = useState<Activity[]>(schedule.activities);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute timeline range
  const { weeks, months, ganttStart, ganttEnd, totalWidth, dataDateX } = useMemo(() => {
    const tasks = activities.filter(a => a.startDate && ['task', 'milestone'].includes(a.activityType));
    if (tasks.length === 0) return { weeks: [], months: [], ganttStart: new Date(), ganttEnd: new Date(), totalWidth: 0, dataDateX: 0 };

    const starts = tasks.map(a => new Date(a.startDate!).getTime());
    const ends = tasks.map(a => new Date(a.finishDate || a.startDate!).getTime());
    const minDate = addDays(getMonday(new Date(Math.min(...starts))), -7);
    const maxDate = addDays(new Date(Math.max(...ends)), 14);
    const ganttEnd2 = getMonday(maxDate);

    const wks: Date[] = [];
    let d = new Date(minDate);
    while (d <= ganttEnd2) {
      wks.push(new Date(d));
      d = addDays(d, 7);
    }

    // Build month headers
    const monthMap: { label: string; span: number }[] = [];
    let lastKey = '';
    for (const w of wks) {
      const key = `${w.getFullYear()}-${w.getMonth()}`;
      if (key === lastKey) {
        monthMap[monthMap.length - 1].span++;
      } else {
        monthMap.push({
          label: w.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          span: 1,
        });
        lastKey = key;
      }
    }

    const tw = wks.length * WW;
    const totalDays = diffDays(minDate, ganttEnd2);
    const dd = new Date(schedule.dataDate);
    const ddX = totalDays > 0 ? (diffDays(minDate, dd) / totalDays) * tw : 0;

    return { weeks: wks, months: monthMap, ganttStart: minDate, ganttEnd: ganttEnd2, totalWidth: tw, dataDateX: ddX };
  }, [activities, schedule.dataDate]);

  // Map group indices to their children for collapsing
  const groupChildren = useMemo(() => {
    const map = new Map<number, number[]>();
    let currentGroup = -1;
    activities.forEach((a, i) => {
      if (a.activityType.startsWith('group_')) {
        currentGroup = i;
        map.set(i, []);
      } else if (currentGroup >= 0) {
        map.get(currentGroup)?.push(i);
      }
    });
    return map;
  }, [activities]);

  // Filter & search
  const visibleRows = useMemo(() => {
    const collapsed = new Set<number>();
    collapsedGroups.forEach(gi => {
      groupChildren.get(gi)?.forEach(ci => collapsed.add(ci));
    });

    return activities.map((a, i) => {
      if (collapsed.has(i)) return null;

      // Filter
      if (filter !== 'all') {
        if (a.activityType.startsWith('group_')) {
          // Show group if any child matches
          const children = groupChildren.get(i) || [];
          const anyMatch = children.some(ci => {
            const c = activities[ci];
            if (filter === 'crit') return c.isCritical;
            return c.status === filter;
          });
          if (!anyMatch && children.length > 0) return null;
        } else {
          if (filter === 'crit' && !a.isCritical) return null;
          if (filter === 'pend' && a.status !== 'pend') return null;
          if (filter === 'ip' && a.status !== 'ip') return null;
          if (filter === 'done' && a.status !== 'done') return null;
        }
      }

      // Search
      if (search) {
        const q = search.toLowerCase();
        if (a.activityType.startsWith('group_')) {
          const children = groupChildren.get(i) || [];
          const anyMatch = children.some(ci => {
            const c = activities[ci];
            return c.activityName.toLowerCase().includes(q) || c.activityId.toLowerCase().includes(q) || (c.notes || '').toLowerCase().includes(q);
          });
          if (!anyMatch && !a.activityName.toLowerCase().includes(q)) return null;
        } else {
          if (!a.activityName.toLowerCase().includes(q) && !a.activityId.toLowerCase().includes(q) && !(a.notes || '').toLowerCase().includes(q)) return null;
        }
      }

      return { activity: a, index: i };
    }).filter(Boolean) as { activity: Activity; index: number }[];
  }, [activities, filter, search, collapsedGroups, groupChildren]);

  // Stats
  const stats = useMemo(() => {
    const tasks = activities.filter(a => a.activityType === 'task' || a.activityType === 'milestone');
    const total = tasks.length;
    const done = tasks.filter(a => a.status === 'done').length;
    const ip = tasks.filter(a => a.status === 'ip').length;
    const critical = tasks.filter(a => a.isCritical).length;
    const pctTotal = total > 0 ? Math.round((tasks.reduce((s, a) => s + a.percentComplete, 0) / total)) : 0;
    const dd = new Date(schedule.dataDate);
    const tco = schedule.tcoDate ? new Date(schedule.tcoDate) : null;
    const daysToTCO = tco ? Math.max(0, Math.round(diffDays(dd, tco))) : null;
    return { total, done, ip, critical, pctTotal, daysToTCO };
  }, [activities, schedule.dataDate, schedule.tcoDate]);

  // Bar computation
  const getBar = useCallback((a: Activity) => {
    if (!a.startDate || !weeks.length) return null;
    const totalDays = diffDays(ganttStart, ganttEnd);
    if (totalDays <= 0) return null;

    const start = new Date(a.startDate);
    const end = new Date(a.finishDate || a.startDate);
    const x = (diffDays(ganttStart, start) / totalDays) * totalWidth;
    const w = Math.max(3, (diffDays(ganttStart, end) / totalDays) * totalWidth - x);

    if (a.isMilestone || a.originalDuration === 0) {
      return { type: 'milestone' as const, x: x + w / 2, color: a.isCritical ? '#FF0000' : '#4472C4' };
    }

    let color = '#C9A96E'; // gold remaining
    if (a.status === 'done') color = '#4472C4'; // blue done
    else if (a.isCritical) color = '#FF0000'; // red critical

    // Progress portion
    const pctW = w * (a.percentComplete / 100);

    return { type: 'bar' as const, x, w, color, pctW, done: a.status === 'done' };
  }, [weeks, ganttStart, ganttEnd, totalWidth]);

  // Inline edit handlers
  const handleCellClick = (idx: number, field: string) => {
    if (activities[idx].activityType.startsWith('group_')) return;
    setEditingCell({ idx, field });
  };

  const handleCellChange = (idx: number, field: string, value: any) => {
    setActivities(prev => {
      const updated = [...prev];
      const a = { ...updated[idx] };
      if (field === 'percentComplete') {
        a.percentComplete = Math.min(100, Math.max(0, parseFloat(value) || 0));
        a.remainingDuration = Math.round(a.originalDuration * (1 - a.percentComplete / 100));
        if (a.percentComplete === 100) a.status = 'done';
        else if (a.percentComplete > 0) a.status = 'ip';
      } else if (field === 'startDate' || field === 'finishDate') {
        (a as any)[field] = value ? new Date(value + 'T12:00:00').toISOString() : null;
        // Recalc duration if both dates set
        if (a.startDate && a.finishDate) {
          const dur = Math.max(0, Math.round(diffDays(new Date(a.startDate), new Date(a.finishDate))));
          a.originalDuration = dur;
          a.remainingDuration = Math.round(dur * (1 - a.percentComplete / 100));
        }
      } else if (field === 'status') {
        a.status = value;
        if (value === 'done') { a.percentComplete = 100; a.remainingDuration = 0; }
        else if (value === 'ip' && a.percentComplete === 0) a.percentComplete = 5;
        else if (value === 'pend') { a.percentComplete = 0; a.remainingDuration = a.originalDuration; }
      } else if (field === 'originalDuration') {
        a.originalDuration = parseInt(value) || 0;
        a.remainingDuration = Math.round(a.originalDuration * (1 - a.percentComplete / 100));
        // Recalc finish date
        if (a.startDate) {
          a.finishDate = addDays(new Date(a.startDate), a.originalDuration).toISOString();
        }
      } else {
        (a as any)[field] = value;
      }
      updated[idx] = a;
      return updated;
    });
    setHasChanges(true);
    setEditingCell(null);
  };

  const handleStatusChange = (idx: number, value: string) => {
    handleCellChange(idx, 'status', value);
  };

  // Save all changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities }),
      });
      if (!res.ok) throw new Error('Save failed');
      setHasChanges(false);
      toast.success(t('schedules.saved'));
    } catch {
      toast.error(t('schedules.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setActivities(schedule.activities);
    setHasChanges(false);
    toast.info(t('schedules.changesReverted'));
  };

  const toggleGroup = (idx: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Print → PDF with date range
  const [printing, setPrinting] = useState(false);
  const [pdfDateFrom, setPdfDateFrom] = useState('');
  const [pdfDateTo, setPdfDateTo] = useState('');
  const [showDateRange, setShowDateRange] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const body: any = { filter };
      if (pdfDateFrom) body.dateFrom = pdfDateFrom;
      if (pdfDateTo) body.dateTo = pdfDateTo;
      const res = await fetch(`/api/schedules/${schedule.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('PDF failed');
      const blob = await res.blob();
      const fname = `CPM_${schedule.project?.projectNumber || ''}_${schedule.revision}.pdf`;
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
      toast.success(t('schedules.laPdfDownloaded'));
    } catch {
      toast.error(t('schedules.laPdfError'));
    } finally {
      setPrinting(false);
    }
  };

  // Export Excel
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!schedule.id) return;
    setExporting(true);
    try {
      const body: any = { filter };
      if (pdfDateFrom) body.dateFrom = pdfDateFrom;
      if (pdfDateTo) body.dateTo = pdfDateTo;
      const res = await fetch(`/api/schedules/${schedule.id}/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Excel export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CPM_${schedule.project?.projectNumber || ''}_${schedule.revision}.xlsx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      toast.success(t('schedules.excelDownloaded'));
    } catch {
      toast.error(t('schedules.excelExportError'));
    } finally {
      setExporting(false);
    }
  };

  // Row class based on type
  const getRowClass = (a: Activity, idx: number) => {
    if (a.activityType === 'group_main') return 'bg-[#0F1B33] text-white font-bold text-[11px]';
    if (a.activityType === 'group_sub') return 'bg-[#C9A96E]/15 font-bold text-[10px]';
    if (a.activityType === 'group_warn') return 'bg-[#C55A11] text-white font-bold text-[10px]';
    if (a.activityType === 'group_crit') return 'bg-[#C00000] text-white font-bold text-[10px]';
    if (a.status === 'done') return idx % 2 === 0 ? 'bg-[#f0f7e6]' : 'bg-[#e8f1dc]';
    return idx % 2 === 0 ? 'bg-white' : 'bg-[#F7F7F5]';
  };

  const statusClass = (st: string) => {
    if (st === 'done') return 'text-[#2E5E0E] font-bold';
    if (st === 'ip') return 'text-[#0C447C] font-bold';
    return 'text-gray-500';
  };

  // Filters
  const filters: { key: typeof filter; label: string; icon?: any }[] = [
    { key: 'all', label: t('schedules.filterAll') },
    { key: 'crit', label: t('schedules.filterCritical') },
    { key: 'pend', label: t('schedules.filterPending') },
    { key: 'ip', label: t('schedules.filterInProgress') },
    { key: 'done', label: t('schedules.filterCompleted') },
  ];

  return (
    <div className="w-full schedule-gantt-wrapper">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .schedule-gantt-wrapper .print\:hidden { display: none !important; }
          .schedule-gantt-wrapper { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .schedule-gantt-wrapper table { font-size: 7px !important; }
          .schedule-gantt-wrapper th, .schedule-gantt-wrapper td { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body > *:not(.schedule-gantt-wrapper) { display: none !important; }
          nav, header, footer, aside, [class*="sidebar"], [class*="shell"], [class*="dashboard"] { display: none !important; }
        }
      `}</style>
      {/* Toolbar */}
      <div className="bg-[#0F1B33] px-3 py-2 flex items-center gap-2 flex-wrap border-b-2 border-[#C9A96E] print:hidden rounded-t-lg">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 border rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              filter === f.key
                ? 'bg-[#C9A96E] text-[#0F1B33] border-[#C9A96E]'
                : 'bg-transparent text-white border-white/30 hover:bg-[#C9A96E]/20'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="w-px h-5 bg-white/20" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
          <input
            type="text"
            placeholder={t('schedules.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-2 py-1.5 bg-white/10 border border-white/30 rounded text-white text-[10px] w-40 outline-none placeholder:text-white/50"
          />
        </div>
        <div className="w-px h-5 bg-white/20" />
        <button onClick={handleExport} disabled={exporting} className="px-2 py-1.5 border border-white/30 rounded text-white text-[10px] font-bold hover:bg-[#C9A96E] hover:text-[#0F1B33] hover:border-[#C9A96E] transition-colors disabled:opacity-50 flex items-center gap-1">
          {exporting ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('schedules.exporting')}</> : `📊 ${t('schedules.exportExcel')}`}
        </button>
        <button
          onClick={() => setShowDateRange(v => !v)}
          className={`px-2 py-1.5 border rounded text-[10px] font-bold transition-colors flex items-center gap-1 ${
            showDateRange || pdfDateFrom || pdfDateTo
              ? 'bg-[#C9A96E] text-[#0F1B33] border-[#C9A96E]'
              : 'border-white/30 text-white hover:bg-[#C9A96E]/20'
          }`}
        >
          <CalendarDays className="w-3 h-3" /> {t('schedules.dateRange')}
        </button>
        {showDateRange && (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={pdfDateFrom}
              onChange={e => setPdfDateFrom(e.target.value)}
              className="px-1.5 py-1 bg-white/10 border border-white/30 rounded text-white text-[10px] outline-none [color-scheme:dark]"
              placeholder={t('common.from')}
            />
            <span className="text-white/50 text-[10px]">—</span>
            <input
              type="date"
              value={pdfDateTo}
              onChange={e => setPdfDateTo(e.target.value)}
              className="px-1.5 py-1 bg-white/10 border border-white/30 rounded text-white text-[10px] outline-none [color-scheme:dark]"
              placeholder={t('common.to')}
            />
            {(pdfDateFrom || pdfDateTo) && (
              <button
                onClick={() => { setPdfDateFrom(''); setPdfDateTo(''); }}
                className="px-1.5 py-1 text-red-400 hover:text-red-300 text-[10px] font-bold"
                title={t('schedules.clearDates')}
              >
                ✕
              </button>
            )}
          </div>
        )}
        <button onClick={handlePrint} disabled={printing} className="px-2 py-1.5 border border-white/30 rounded text-white text-[10px] font-bold hover:bg-[#C9A96E] hover:text-[#0F1B33] hover:border-[#C9A96E] transition-colors disabled:opacity-50 flex items-center gap-1">
          {printing ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('schedules.generatingPdf')}</> : `🖨 ${t('schedules.printPdf')}`}
        </button>

        {/* Add Approved CORs button */}
        {approvedCORs.length > 0 && (
          <button
            onClick={() => {
              const existingIds = new Set(activities.map(a => a.activityId));
              const newCORs = approvedCORs.filter(cor => !existingIds.has(`COR-${cor.corNumber}`));
              if (newCORs.length === 0) {
                toast.info(t('schedules.allCorsAlreadyAdded'));
                return;
              }
              const maxSort = activities.reduce((m, a) => Math.max(m, a.sortOrder), 0);
              const newActivities: Activity[] = newCORs.map((cor, i) => {
                const startDt = cor.approvalDate || cor.date || new Date().toISOString();
                const start = new Date(startDt);
                const finish = new Date(start);
                finish.setDate(finish.getDate() + 30); // default 30 day duration
                return {
                  id: `temp-cor-${cor.id}`,
                  sortOrder: maxSort + i + 1,
                  activityId: `COR-${cor.corNumber}`,
                  activityName: `CO ${cor.corNumber} – ${cor.description?.substring(0, 60) || 'Change Order'}`,
                  activityType: 'task',
                  originalDuration: 30,
                  remainingDuration: 30,
                  percentComplete: 0,
                  startDate: start.toISOString(),
                  finishDate: finish.toISOString(),
                  actualStart: null,
                  actualFinish: null,
                  status: 'pend',
                  isCritical: false,
                  isMilestone: false,
                  notes: `COR $${(cor.totalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}${cor.subcontractor ? ' – ' + cor.subcontractor : ''}`,
                  wbsCode: 'COR',
                  predecessors: null,
                  successors: null,
                  calendarDays: false,
                  floatDays: 0,
                  costLoaded: cor.totalAmount ?? 0,
                  resourceName: cor.subcontractor || '',
                  isLookAhead: false,
                  parentActivityId: null,
                };
              });
              setActivities(prev => [...prev, ...newActivities]);
              setHasChanges(true);
              toast.success(t('schedules.corsAdded', { count: newCORs.length }));
            }}
            className="px-2 py-1.5 border border-[#2E7D32]/60 rounded text-[#4CAF50] text-[10px] font-bold hover:bg-[#2E7D32]/20 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> {t('schedules.addCors', { count: approvedCORs.filter(c => !activities.some(a => a.activityId === `COR-${c.corNumber}`)).length })}
          </button>
        )}

        {hasChanges && (
          <>
            <div className="w-px h-5 bg-white/20" />
            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-[#C9A96E] text-[#0F1B33] border border-[#C9A96E] rounded text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} {t('common.save')}
            </button>
            <button onClick={handleReset} className="px-2 py-1.5 border border-red-400/40 rounded text-red-300 text-[10px] font-bold hover:bg-red-500/20">
              <RotateCcw className="w-3 h-3" />
            </button>
          </>
        )}

        {/* Stats */}
        <div className="ml-auto text-white/70 text-[10px] font-medium flex items-center gap-3 flex-wrap">
          <span>{t('schedules.dataDateLabel')} <b className="text-[#C9A96E]">{fmtDate(schedule.dataDate)}</b></span>
          {schedule.tcoDate && <span>{t('schedules.tcoLabel')} <b className="text-[#C9A96E]">{fmtDate(schedule.tcoDate)}</b></span>}
          <span>{t('schedules.progressLabel')} <b className="text-[#C9A96E]">{stats.pctTotal}%</b></span>
          <span>{t('schedules.critical')}: <b className="text-[#C9A96E]">{stats.critical}</b></span>
          {stats.daysToTCO !== null && <span>{t('schedules.daysToTco')} <b className="text-[#C9A96E]">{stats.daysToTCO}</b></span>}
        </div>
      </div>

      {/* Table */}
      <div ref={scrollRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        <table className="border-collapse text-[9px] w-max min-w-full">
          <thead className="sticky top-0 z-20">
            {/* Month row */}
            <tr>
              <th className="bg-[#D9D9D9] font-bold text-center h-4 text-[8px] sticky left-0 z-30 w-[38px] min-w-[38px]">{t('schedules.colId')}</th>
              <th className="bg-[#D9D9D9] font-bold text-center h-4 text-[8px] sticky left-[38px] z-30 w-[240px] min-w-[240px]">{t('schedules.activityName')}</th>
              <th className="bg-[#D9D9D9] font-bold text-center h-4 text-[7px] leading-[1.1] w-[28px] min-w-[28px]">Orig<br/>Dur</th>
              <th className="bg-[#D9D9D9] font-bold text-center h-4 text-[7px] leading-[1.1] w-[28px] min-w-[28px]">Rem<br/>Dur</th>
              <th className="bg-[#D9D9D9] font-bold text-center h-4 text-[7px] leading-[1.1] w-[34px] min-w-[34px]">Dur%<br/>Comp</th>
              <th className="bg-[#D9D9D9] font-bold text-center h-4 text-[7px] w-[54px] min-w-[54px]">{t('schedules.colStart')}</th>
              <th className="bg-[#D9D9D9] font-bold text-center h-4 text-[7px] w-[54px] min-w-[54px]">{t('schedules.colFinish')}</th>
              <th className="bg-[#D9D9D9] font-bold text-center h-4 text-[7px] w-[52px] min-w-[52px]">{t('schedules.colStatus')}</th>
              {months.map((m, i) => (
                <th key={i} colSpan={m.span} className="bg-[#404040] text-white font-bold text-center h-4 text-[8px] border-r border-white/15" style={{ minWidth: m.span * WW }}>
                  {m.label}
                </th>
              ))}
            </tr>
            {/* Week row */}
            <tr>
              <th className="bg-[#595959] h-3 sticky left-0 z-30" />
              <th className="bg-[#595959] h-3 sticky left-[38px] z-30" />
              <th className="bg-[#595959] h-3" />
              <th className="bg-[#595959] h-3" />
              <th className="bg-[#595959] h-3" />
              <th className="bg-[#595959] h-3" />
              <th className="bg-[#595959] h-3" />
              <th className="bg-[#595959] h-3" />
              {weeks.map((w, i) => {
                const isDataDate = Math.abs(diffDays(w, new Date(schedule.dataDate))) < 4;
                return (
                  <th key={i} className={`text-white text-center h-3 text-[7px] border-r border-white/10 ${isDataDate ? 'bg-[#B8973A]/35' : 'bg-[#595959]'}`} style={{ minWidth: WW }}>
                    {fmtShort(w)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ activity: a, index: idx }) => {
              const isGroup = a.activityType.startsWith('group_');
              const bar = isGroup ? null : getBar(a);
              const isCollapsed = collapsedGroups.has(idx);

              return (
                <tr key={idx} className={`${getRowClass(a, idx)} hover:bg-yellow-50/60 transition-colors`} style={{ height: ROW_H }}>
                  {/* ID */}
                  <td className={`border border-gray-200 text-center text-[7.5px] text-[#1F4E79] px-0.5 sticky left-0 z-10 w-[38px] min-w-[38px] ${isGroup ? getRowClass(a, idx) : idx % 2 === 0 ? (a.status === 'done' ? 'bg-[#f0f7e6]' : 'bg-white') : (a.status === 'done' ? 'bg-[#e8f1dc]' : 'bg-[#F7F7F5]')}`}>
                    {isGroup ? (
                      <button onClick={() => toggleGroup(idx)} className="flex items-center gap-0.5 w-full justify-center">
                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    ) : a.activityId}
                  </td>
                  {/* Name */}
                  <td className={`border border-gray-200 px-1 text-[8px] whitespace-nowrap overflow-hidden text-ellipsis sticky left-[38px] z-10 w-[240px] min-w-[240px] ${isGroup ? getRowClass(a, idx) : idx % 2 === 0 ? (a.status === 'done' ? 'bg-[#f0f7e6]' : 'bg-white') : (a.status === 'done' ? 'bg-[#e8f1dc]' : 'bg-[#F7F7F5]')}`}
                    style={{ maxWidth: 240 }}
                    title={a.notes ? `${a.activityName} — ${a.notes}` : a.activityName}
                  >
                    {isGroup ? (
                      <span className="font-bold">{a.activityName}</span>
                    ) : (
                      <span className={a.isCritical ? 'font-bold' : ''}>{a.activityName}</span>
                    )}
                  </td>
                  {/* Orig Dur */}
                  <td className="border border-gray-200 text-center text-[7.5px]">
                    {isGroup ? '' : (
                      <span
                        className="cursor-pointer hover:bg-yellow-100 px-1 rounded"
                        onClick={() => handleCellClick(idx, 'originalDuration')}
                      >
                        {editingCell?.idx === idx && editingCell?.field === 'originalDuration' ? (
                          <input
                            type="number"
                            defaultValue={a.originalDuration}
                            className="w-8 border border-[#B8973A] px-0.5 text-[8px] rounded text-center bg-yellow-50 outline-none"
                            autoFocus
                            onBlur={e => handleCellChange(idx, 'originalDuration', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCellChange(idx, 'originalDuration', (e.target as HTMLInputElement).value)}
                          />
                        ) : a.originalDuration}
                      </span>
                    )}
                  </td>
                  {/* Rem Dur */}
                  <td className="border border-gray-200 text-center text-[7.5px]">
                    {isGroup ? '' : a.remainingDuration}
                  </td>
                  {/* % Complete */}
                  <td className="border border-gray-200 text-center text-[7.5px]">
                    {isGroup ? '' : (
                      <span
                        className="cursor-pointer hover:bg-yellow-100 px-1 rounded"
                        onClick={() => handleCellClick(idx, 'percentComplete')}
                      >
                        {editingCell?.idx === idx && editingCell?.field === 'percentComplete' ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={a.percentComplete}
                            className="w-10 border border-[#B8973A] px-0.5 text-[8px] rounded text-center bg-yellow-50 outline-none"
                            autoFocus
                            onBlur={e => handleCellChange(idx, 'percentComplete', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCellChange(idx, 'percentComplete', (e.target as HTMLInputElement).value)}
                          />
                        ) : `${a.percentComplete}%`}
                      </span>
                    )}
                  </td>
                  {/* Start */}
                  <td className="border border-gray-200 text-center text-[7px] px-0.5">
                    {isGroup ? '' : (
                      <span
                        className="cursor-pointer hover:bg-yellow-100 px-0.5 rounded"
                        onClick={() => handleCellClick(idx, 'startDate')}
                      >
                        {editingCell?.idx === idx && editingCell?.field === 'startDate' ? (
                          <input
                            type="date"
                            defaultValue={a.startDate ? a.startDate.split('T')[0] : ''}
                            className="w-[80px] border border-[#B8973A] px-0.5 text-[7px] rounded bg-yellow-50 outline-none"
                            autoFocus
                            onBlur={e => handleCellChange(idx, 'startDate', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCellChange(idx, 'startDate', (e.target as HTMLInputElement).value)}
                          />
                        ) : fmtShort(a.startDate)}
                      </span>
                    )}
                  </td>
                  {/* Finish */}
                  <td className="border border-gray-200 text-center text-[7px] px-0.5">
                    {isGroup ? '' : (
                      <span
                        className="cursor-pointer hover:bg-yellow-100 px-0.5 rounded"
                        onClick={() => handleCellClick(idx, 'finishDate')}
                      >
                        {editingCell?.idx === idx && editingCell?.field === 'finishDate' ? (
                          <input
                            type="date"
                            defaultValue={a.finishDate ? a.finishDate.split('T')[0] : ''}
                            className="w-[80px] border border-[#B8973A] px-0.5 text-[7px] rounded bg-yellow-50 outline-none"
                            autoFocus
                            onBlur={e => handleCellChange(idx, 'finishDate', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCellChange(idx, 'finishDate', (e.target as HTMLInputElement).value)}
                          />
                        ) : fmtShort(a.finishDate)}
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="border border-gray-200 text-center text-[7.5px] px-0.5">
                    {isGroup ? '' : (
                      <select
                        value={a.status}
                        onChange={e => handleStatusChange(idx, e.target.value)}
                        className={`border-none bg-transparent text-[8px] font-bold w-full text-center cursor-pointer outline-none ${statusClass(a.status)}`}
                      >
                        <option value="pend">{t('schedules.statusPend')}</option>
                        <option value="ip">{t('schedules.statusInProg')}</option>
                        <option value="done">{t('schedules.statusDone')}</option>
                      </select>
                    )}
                  </td>
                  {/* Gantt bars */}
                  <td colSpan={weeks.length} className="border-0 p-0 overflow-hidden">
                    {isGroup ? (
                      <div className={`h-full w-full ${getRowClass(a, idx)}`} style={{ minWidth: totalWidth }} />
                    ) : (
                      <svg width={totalWidth} height={ROW_H - 1} style={{ display: 'block', minWidth: totalWidth }}>
                        {/* Data date line */}
                        <line x1={dataDateX} y1={0} x2={dataDateX} y2={ROW_H} stroke="#B8973A" strokeWidth={1.5} strokeDasharray="3,2" />
                        {/* Bar */}
                        {bar?.type === 'milestone' && (
                          <polygon
                            points={`${bar.x},4 ${bar.x + 5},${ROW_H / 2} ${bar.x},${ROW_H - 4} ${bar.x - 5},${ROW_H / 2}`}
                            fill={bar.color}
                          />
                        )}
                        {bar?.type === 'bar' && (
                          <>
                            {/* Full bar */}
                            <rect x={bar.x} y={5} width={bar.w} height={ROW_H - 11} fill={bar.color} rx={1} />
                            <rect x={bar.x} y={5} width={bar.w} height={ROW_H - 11} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={0.5} rx={1} />
                            {/* Progress fill for partial */}
                            {!bar.done && bar.pctW > 0 && (
                              <rect x={bar.x} y={5} width={bar.pctW} height={ROW_H - 11} fill="#4472C4" rx={1} opacity={0.7} />
                            )}
                          </>
                        )}
                      </svg>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer / Legend */}
      <div className="flex items-center justify-between px-3 py-2 border-t-2 border-[#595959] bg-white text-[8px] print:text-[7px] flex-wrap gap-2 rounded-b-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1"><span className="inline-block w-3.5 h-2 bg-[#4472C4] border border-gray-400" /> {t('schedules.legendActual')}</div>
          <div className="flex items-center gap-1"><span className="inline-block w-3.5 h-2 bg-[#C9A96E] border border-gray-400" /> {t('schedules.legendRemaining')}</div>
          <div className="flex items-center gap-1"><span className="inline-block w-3.5 h-2 bg-[#FF0000] border border-gray-400" /> {t('schedules.criticalRemaining')}</div>
          <div className="flex items-center gap-1">◆ {t('schedules.legendMilestone')}</div>
          <div className="flex items-center gap-1"><span className="inline-block w-4 border-t-[1.5px] border-dashed border-[#B8973A]" /> {t('schedules.legendDataDate')}</div>
          <div className="text-[#C55A11] font-bold">{t('schedules.clickToEdit')}</div>
        </div>
        <div className="text-center flex-1">
          <div className="text-xs font-bold">{schedule.project?.projectName || 'Ritz Carlton PH2201 — Slovin Residence'} | {t('schedules.interactiveCpm')}</div>
          <div className="text-[9px] font-bold">{schedule.revision} | {schedule.notes || ''}</div>
        </div>
        <div className="text-right min-w-[120px] leading-relaxed">
          {schedule.projectFinish && <div>{t('schedules.projectFinish')}: {fmtDate(schedule.projectFinish)}</div>}
          <div>{t('schedules.dataDateLabel')} {fmtDate(schedule.dataDate)}</div>
          {schedule.tcoDate && <div>{t('schedules.tcoLabel')} {fmtDate(schedule.tcoDate)}</div>}
          <div>{t('schedules.preparedBy')}</div>
        </div>
      </div>
    </div>
  );
}
