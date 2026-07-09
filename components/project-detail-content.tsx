'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import {
  ArrowLeft, Plus, Search, FileText, CheckCircle2, Clock, XCircle,
  DollarSign, Download, Building2, MapPin, Hash,
  FileQuestion, Receipt, LayoutDashboard, AlertTriangle, MessageSquare,
  Calendar, ChevronRight, Wallet, CalendarDays, BarChart3, Upload, ArrowUpDown, Trash2, Loader2, FileBarChart, FileStack,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const ScheduleManager = dynamic(() => import('@/components/schedule-manager'), { ssr: false });
const ProjectAnalytics = dynamic(() => import('@/components/project-analytics'), { ssr: false });
const BatchPAImport = dynamic(() => import('@/components/batch-pa-import'), { ssr: false });

/* ── Types ───────────────────────────────────────────────────────── */

interface ChangeOrder {
  id: string; corNumber: string; sequence: number; date: string;
  approvalDate: string | null;
  description: string; subcontractor: string | null; status: string;
  subtotal: number; overheadProfit: number; generalLiability: number;
  salesTax: number; totalAmount: number; csiCode: string | null;
  notes: string | null; lineItems: any[];
}

interface RFIItem {
  id: string; rfiNumber: string; subject: string; status: string;
  priority: string; submittedBy: string; assignedTo: string;
  dateSubmitted: string; dateDue: string | null;
  costImpact: string; scheduleImpact: string;
}

interface SubmittalItem {
  id: string; submittalNumber: string; title: string; status: string;
  priority: string; submittalType: string; subcontractor: string | null;
  requiredDate: string | null; submittedDate: string | null;
}

interface PayApp {
  id: string; applicationNumber: number; applicationDate: string;
  periodFrom: string; periodTo: string; status: string; lineItems: any[];
}

interface BudgetSummary {
  id: string; version: string; budgetDate: string; status: string;
  subTotalAll: number; opAmount: number; glAmount: number;
  contingencyAmount: number; grandTotal: number;
  _count: { lineItems: number; detailItems: number };
}

interface ScheduleActivity {
  id: string; sortOrder: number; activityId: string; activityName: string;
  activityType: string; originalDuration: number; remainingDuration: number;
  percentComplete: number; startDate: string | null; finishDate: string | null;
  status: string; isCritical: boolean; isMilestone: boolean;
  notes: string | null; wbsCode: string; resourceName: string;
  costLoaded: number; floatDays: number;
  isLookAhead?: boolean; parentActivityId?: string | null;
}

interface ScheduleSummary {
  id: string; revision: string; dataDate: string;
  projectStart: string | null; projectFinish: string | null;
  tcoDate: string | null; notes: string | null; status: string;
  activities: ScheduleActivity[];
  createdAt?: string | null;
}

interface ProjectDetail {
  id: string; projectNumber: string; projectName: string;
  client: string; location: string | null; contractAmount: number;
  startDate: string | null; changeOrders: ChangeOrder[];
  rfis: RFIItem[]; submittals: SubmittalItem[]; payApplications: PayApp[];
  budgets: BudgetSummary[];
  schedules: ScheduleSummary[];
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const corStatusColors: Record<string, { bg: string; text: string }> = {
  Pending: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]' },
  Approved: { bg: 'bg-[#2E7D32]/10', text: 'text-[#2E7D32]' },
  Rejected: { bg: 'bg-red-50', text: 'text-[#92400E]' },
};

const rfiStatusConfig: Record<string, { color: string; bg: string }> = {
  Open: { color: 'text-blue-700', bg: 'bg-blue-100' },
  'Under Review': { color: 'text-amber-700', bg: 'bg-amber-100' },
  Answered: { color: 'text-green-700', bg: 'bg-green-100' },
  Closed: { color: 'text-gray-500', bg: 'bg-gray-100' },
};

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Urgent: { color: 'text-red-700', bg: 'bg-red-100' },
  High: { color: 'text-orange-700', bg: 'bg-orange-100' },
  Normal: { color: 'text-blue-700', bg: 'bg-blue-100' },
  Low: { color: 'text-gray-600', bg: 'bg-gray-100' },
};

const paStatusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-[#FEF3C7] text-[#92400E]',
  Approved: 'bg-[#2E7D32]/10 text-[#2E7D32]',
};

const submittalStatusConfig: Record<string, { color: string; bg: string }> = {
  Draft: { color: 'text-gray-700', bg: 'bg-gray-100' },
  Submitted: { color: 'text-blue-700', bg: 'bg-blue-100' },
  'Under Review': { color: 'text-amber-700', bg: 'bg-amber-100' },
  Approved: { color: 'text-green-700', bg: 'bg-green-100' },
  'Revise and Resubmit': { color: 'text-orange-700', bg: 'bg-orange-100' },
  Rejected: { color: 'text-red-700', bg: 'bg-red-100' },
};

function fmtMoney(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}
function fmtDateShort(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Tab config ──────────────────────────────────────────────────── */

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'budget', label: 'Budget', icon: Wallet },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'cors', label: 'Change Orders', icon: FileText },
  { key: 'rfis', label: 'RFIs', icon: FileQuestion },
  { key: 'submittals', label: 'Submittals', icon: FileStack },
  { key: 'pay-apps', label: 'Pay Applications', icon: Receipt },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

/* ── Main Component ──────────────────────────────────────────────── */

export function ProjectDetailContent({ project, initialTab }: { project: ProjectDetail; initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [updatingId, setUpdatingId] = useState('');
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [reordering, setReordering] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const handleDeleteAllPAs = async () => {
    if (!confirm(t('project.deleteAllPaConfirm', { count: payApps.length }))) return;
    if (!confirm(t('project.deleteAllPaConfirm2'))) return;
    setReordering(true);
    try {
      const res = await fetch('/api/pay-apps/delete-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success(t('payApps.deletedCount', { count: data.deleted }));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || t('payApps.deleteError'));
    } finally {
      setReordering(false);
    }
  };

  // ── Owner Equity Report PDF ─────────────────────
  const [generatingReport, setGeneratingReport] = useState(false);
  const handleOwnerReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/owner-executive/pdf`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const fname = `Owner_Equity_Report_${project.projectNumber}.pdf`;
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
      toast.success(t('project.reportGenerated'));
    } catch {
      toast.error(t('project.reportError'));
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDeleteLastPA = async () => {
    const lastPA = [...payApps].sort((a: any, b: any) => b.applicationNumber - a.applicationNumber)[0];
    if (!lastPA) return;
    if (!confirm(t('project.deleteLastPaConfirm', { number: lastPA.applicationNumber }))) return;
    setReordering(true);
    try {
      const res = await fetch('/api/pay-apps/delete-last', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success(data.message || t('payApps.deleteLastSuccess', { number: lastPA.applicationNumber }));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || t('payApps.deleteError'));
    } finally {
      setReordering(false);
    }
  };

  const handleReorderPAs = async () => {
    if (!confirm(t('project.renumberConfirm'))) return;
    setReordering(true);
    try {
      const res = await fetch('/api/pay-apps/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reorder');
      if (data.changes?.length > 0) {
        toast.success(t('payApps.renumberSuccess', { count: data.changes.length }));
        router.refresh();
      } else {
        toast.info(data.message || t('project.alreadyInOrder'));
      }
    } catch (err: any) {
      toast.error(err.message || t('payApps.renumberError'));
    } finally {
      setReordering(false);
    }
  };

  const cors = project?.changeOrders ?? [];
  const rfis = project?.rfis ?? [];
  const submittals = project?.submittals ?? [];
  const payApps = project?.payApplications ?? [];
  const budgets = project?.budgets ?? [];
  const schedules = project?.schedules ?? [];
  const activeSchedule = schedules.find(s => s.status === 'Active') ?? schedules[0] ?? null;

  const totalApproved = cors.filter(c => c.status === 'Approved').reduce((s, c) => s + (c.totalAmount ?? 0), 0);

  const updateCORStatus = async (coId: string, newStatus: string) => {
    setUpdatingId(coId);
    try {
      const res = await fetch(`/api/cors/${coId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('project.statusUpdated', { status: newStatus }));
      router.refresh();
    } catch { toast.error(t('project.statusUpdateFailed')); }
    finally { setUpdatingId(''); }
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/export`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `COR_Log_${project.projectNumber}.csv`;
      a.click();
      toast.success(t('project.logExported'));
    } catch { toast.error(t('project.exportFailed')); }
  };

  // COR stats
  const corStats = [
    { label: 'Total', value: cors.length, color: 'text-[#1B2A4A]' },
    { label: 'Approved', value: cors.filter(c => c.status === 'Approved').length, color: 'text-[#2E7D32]' },
    { label: 'Pending', value: cors.filter(c => c.status === 'Pending').length, color: 'text-[#92400E]' },
    { label: 'Rejected', value: cors.filter(c => c.status === 'Rejected').length, color: 'text-red-600' },
  ];

  // COR running totals
  const runningTotals = useMemo(() => {
    let total = 0;
    return cors.filter(c => c.status === 'Approved').map(c => {
      total += c.totalAmount ?? 0;
      return { id: c.id, rt: total };
    });
  }, [cors]);
  const getRT = (id: string) => runningTotals.find(r => r.id === id)?.rt ?? null;

  // Filtered CORs
  const filteredCors = useMemo(() => {
    return cors.filter(co => {
      const q = search.toLowerCase();
      const matchSearch = !search || co.corNumber.toLowerCase().includes(q) ||
        co.description.toLowerCase().includes(q) || (co.subcontractor ?? '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || co.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [cors, search, statusFilter]);

  // Filtered RFIs
  const filteredRfis = useMemo(() => {
    return rfis.filter(rfi => {
      const q = search.toLowerCase();
      const matchSearch = !search || rfi.rfiNumber.toLowerCase().includes(q) ||
        rfi.subject.toLowerCase().includes(q) || rfi.assignedTo.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || rfi.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rfis, search, statusFilter]);

  const filteredSubmittals = useMemo(() => {
    return submittals.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch = !search || s.submittalNumber.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) || (s.subcontractor ?? '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [submittals, search, statusFilter]);

  // Pay App helpers
  const calcPATotal = (lineItems: any[]) => (lineItems ?? []).filter((li: any) => !li.isSection)
    .reduce((s: number, li: any) => s + (li.scheduledValue || 0) + (li.budgetRealloc || 0) + (li.previousChanges || 0) + (li.currentChanges || 0), 0);
  const calcPACompleted = (lineItems: any[]) => (lineItems ?? []).filter((li: any) => !li.isSection)
    .reduce((s: number, li: any) => s + (li.previousCompleted || 0) + (li.thisCompleted || 0), 0);

  // Reset search/filter when tab changes
  const switchTab = (tab: string) => {
    setActiveTab(tab);
    setSearch('');
    setStatusFilter('All');
  };

  return (
    <div className="max-w-[1300px] mx-auto space-y-5">
      <Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#C9A96E]">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      {/* ── Project Header ──────────────────────────────── */}
      <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Hash className="w-4 h-4 text-[#C9A96E]" />
              <span className="font-mono text-sm text-[#C9A96E]">{project.projectNumber}</span>
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight">{project.projectName}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {project.client}</span>
              {project.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {project.location}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Contract Amount</p>
            <p className="text-lg font-mono font-bold text-foreground">{fmtMoney(project.contractAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">Approved CORs</p>
            <p className="text-sm font-mono text-[#2E7D32]">{fmtMoney(totalApproved)}</p>
          </div>
        </div>

        {/* Summary badges */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/40">
            <FileText className="w-5 h-5 text-[#C9A96E]" />
            <div>
              <p className="text-lg font-bold font-mono">{cors.length}</p>
              <p className="text-xs text-muted-foreground">Change Orders</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/40">
            <FileQuestion className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-lg font-bold font-mono">{rfis.length}</p>
              <p className="text-xs text-muted-foreground">RFIs</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/40">
            <Receipt className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-lg font-bold font-mono">{payApps.length}</p>
              <p className="text-xs text-muted-foreground">Pay Applications</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ──────────────────────────────── */}
      <div className="flex items-center gap-1 bg-card rounded-xl p-1 shadow-[var(--shadow-sm)] overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          let count = 0;
          if (tab.key === 'cors') count = cors.length;
          if (tab.key === 'rfis') count = rfis.length;
          if (tab.key === 'submittals') count = submittals.length;
          if (tab.key === 'pay-apps') count = payApps.length;
          if (tab.key === 'schedule') count = activeSchedule ? activeSchedule.activities.length : 0;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#0F1B33] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ──────────────────────────────────── */}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        /* Budget overview card in the grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* COR Summary */}
          <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-[#C9A96E]" /> Change Orders</h3>
              <button onClick={() => switchTab('cors')} className="text-xs text-[#C9A96E] hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {corStats.map((s, i) => (
                <div key={i} className="text-center">
                  <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">Total Approved: <span className="font-mono font-semibold text-[#2E7D32]">{fmtMoney(totalApproved)}</span></div>
            {cors.length > 0 && (
              <div className="mt-3 space-y-1">
                {cors.slice(0, 5).map(co => (
                  <Link key={co.id} href={`/dashboard/cors/${co.id}`} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                    <span className="font-mono text-[#C9A96E] text-xs">{co.corNumber}</span>
                    <span className="truncate mx-2 flex-1 text-xs text-muted-foreground">{co.description}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${corStatusColors[co.status]?.bg ?? ''} ${corStatusColors[co.status]?.text ?? ''}`}>{co.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* RFI Summary */}
          <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><FileQuestion className="w-4 h-4 text-blue-500" /> RFIs</h3>
              <button onClick={() => switchTab('rfis')} className="text-xs text-[#C9A96E] hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center"><p className="text-xl font-bold font-mono">{rfis.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
              <div className="text-center"><p className="text-xl font-bold font-mono text-blue-600">{rfis.filter(r => r.status === 'Open').length}</p><p className="text-xs text-muted-foreground">Open</p></div>
              <div className="text-center"><p className="text-xl font-bold font-mono text-amber-600">{rfis.filter(r => r.status === 'Under Review').length}</p><p className="text-xs text-muted-foreground">Under Review</p></div>
              <div className="text-center"><p className="text-xl font-bold font-mono text-green-600">{rfis.filter(r => r.status === 'Answered' || r.status === 'Closed').length}</p><p className="text-xs text-muted-foreground">Answered</p></div>
            </div>
            {rfis.length > 0 && (
              <div className="mt-3 space-y-1">
                {rfis.slice(0, 5).map(rfi => (
                  <Link key={rfi.id} href={`/dashboard/rfis/${rfi.id}`} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                    <span className="font-mono text-blue-500 text-xs">{rfi.rfiNumber}</span>
                    <span className="truncate mx-2 flex-1 text-xs text-muted-foreground">{rfi.subject}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${rfiStatusConfig[rfi.status]?.bg ?? 'bg-gray-100'} ${rfiStatusConfig[rfi.status]?.color ?? ''}`}>{rfi.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Submittals Summary */}
          <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><FileStack className="w-4 h-4 text-[#C9A96E]" /> Submittals</h3>
              <button onClick={() => switchTab('submittals')} className="text-xs text-[#C9A96E] hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center"><p className="text-xl font-bold font-mono">{submittals.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
              <div className="text-center"><p className="text-xl font-bold font-mono text-blue-600">{submittals.filter(s => s.status === 'Submitted').length}</p><p className="text-xs text-muted-foreground">Submitted</p></div>
              <div className="text-center"><p className="text-xl font-bold font-mono text-amber-600">{submittals.filter(s => s.status === 'Under Review').length}</p><p className="text-xs text-muted-foreground">In Review</p></div>
              <div className="text-center"><p className="text-xl font-bold font-mono text-green-600">{submittals.filter(s => s.status === 'Approved').length}</p><p className="text-xs text-muted-foreground">Approved</p></div>
            </div>
            {submittals.length > 0 ? (
              <div className="mt-3 space-y-1">
                {submittals.slice(0, 5).map((s) => (
                  <Link key={s.id} href={`/dashboard/submittals/${s.id}`} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                    <span className="font-mono text-[#C9A96E] text-xs">{s.submittalNumber}</span>
                    <span className="truncate mx-2 flex-1 text-xs text-muted-foreground">{s.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${submittalStatusConfig[s.status]?.bg ?? 'bg-gray-100'} ${submittalStatusConfig[s.status]?.color ?? ''}`}>{s.status}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link href={`/dashboard/submittals/new?projectId=${project.id}`} className="text-sm text-[#C9A96E] hover:underline">+ Crear primer submittal</Link>
            )}
          </div>

          {/* Budget Summary */}
          <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-purple-500" /> Budget</h3>
              <button onClick={() => switchTab('budget')} className="text-xs text-[#C9A96E] hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
            </div>
            {budgets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No budget uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {budgets.slice(0, 3).map(b => (
                  <Link key={b.id} href={`/dashboard/budgets/${b.id}`} className="block p-3 rounded-lg border border-border hover:border-[#C9A96E]/40 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-semibold text-sm">{b.version}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(b.budgetDate)}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">Grand Total: <span className="font-semibold text-foreground">{fmtMoney(b.grandTotal)}</span></div>
                    <div className="text-xs text-muted-foreground mt-0.5">{b._count.lineItems} items · {b._count.detailItems} detail items</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Summary */}
          <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#C9A96E]" /> CPM Schedule</h3>
              <button onClick={() => switchTab('schedule')} className="text-xs text-[#C9A96E] hover:underline flex items-center gap-1">View Gantt <ChevronRight className="w-3 h-3" /></button>
            </div>
            {activeSchedule ? (() => {
              const acts = activeSchedule.activities;
              const tasks = acts.filter(a => a.activityType === 'task' || a.activityType === 'milestone');
              const critCount = tasks.filter(a => a.isCritical).length;
              const doneCount = tasks.filter(a => a.status === 'done').length;
              const ipCount = tasks.filter(a => a.status === 'ip').length;
              const avgPct = tasks.length > 0 ? Math.round(tasks.reduce((s, a) => s + a.percentComplete, 0) / tasks.length) : 0;
              return (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="text-center"><p className="text-xl font-bold font-mono">{tasks.length}</p><p className="text-xs text-muted-foreground">Activities</p></div>
                    <div className="text-center"><p className="text-xl font-bold font-mono text-red-600">{critCount}</p><p className="text-xs text-muted-foreground">Critical</p></div>
                    <div className="text-center"><p className="text-xl font-bold font-mono text-blue-600">{ipCount}</p><p className="text-xs text-muted-foreground">In Progress</p></div>
                    <div className="text-center"><p className="text-xl font-bold font-mono text-green-600">{doneCount}</p><p className="text-xs text-muted-foreground">Complete</p></div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#0F1B33] rounded-full transition-all" style={{ width: `${avgPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Rev. {activeSchedule.revision} · {avgPct}% avg progress</span>
                    {activeSchedule.tcoDate && <span>TCO: {fmtDateShort(activeSchedule.tcoDate)}</span>}
                  </div>
                </>
              );
            })() : <p className="text-sm text-muted-foreground">No schedule imported yet.</p>}
          </div>

          {/* Pay App Summary */}
          <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-emerald-500" /> Pay Applications</h3>
              <button onClick={() => switchTab('pay-apps')} className="text-xs text-[#C9A96E] hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
            </div>
            {payApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pay applications yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {payApps.map(pa => {
                  const total = calcPATotal(pa.lineItems);
                  const completed = calcPACompleted(pa.lineItems);
                  const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
                  return (
                    <Link key={pa.id} href={`/dashboard/pay-apps/${pa.id}`} className="block p-3 rounded-lg border border-border hover:border-[#C9A96E]/40 hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-semibold text-sm">PA #{pa.applicationNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paStatusColors[pa.status] ?? paStatusColors.Draft}`}>{pa.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">{fmtDateShort(pa.periodFrom)} — {fmtDateShort(pa.periodTo)}</div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#C9A96E] rounded-full" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                      </div>
                      <div className="flex justify-between mt-1 text-xs"><span className="text-muted-foreground">{pct}% complete</span><span className="font-mono">{fmtMoney(completed)}</span></div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {schedules.length > 0 ? (
            <ScheduleManager schedules={schedules} projectId={project.id} approvedCORs={cors.filter(c => c.status === 'Approved')} />
          ) : (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Schedule Yet</h3>
              <p className="text-muted-foreground text-sm">Import a CPM schedule to see the Gantt chart here.</p>
            </div>
          )}
        </div>
      )}

      {/* CHANGE ORDERS TAB */}
      {activeTab === 'cors' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search CORs..."
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50" />
            </div>
            <div className="flex gap-1 bg-card border border-border rounded-lg p-0.5">
              {['All', 'Pending', 'Approved', 'Rejected'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? 'bg-[#C9A96E] text-white' : 'text-muted-foreground hover:text-foreground'}`}>{s}</button>
              ))}
            </div>
            <button onClick={handleExportExcel} className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Export
            </button>
            <Link href={`/dashboard/cors/new?projectId=${project.id}`}
              className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" /> New COR
            </Link>
          </div>

          <div className="bg-card rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#C9A96E]/10">
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">CO #</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Description</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Sub / Notes</th>
                    <th className="text-right px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Amount</th>
                    <th className="text-right px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">O&P 6%</th>
                    <th className="text-right px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">GL 1.5%</th>
                    <th className="text-right px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Total CO</th>
                    <th className="text-right px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Running</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCors.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />No change orders found
                    </td></tr>
                  ) : (
                    filteredCors.map((co, i) => {
                      const sc = corStatusColors[co.status] ?? corStatusColors.Pending;
                      const rt = getRT(co.id);
                      return (
                        <motion.tr key={co.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-muted/50">
                          <td className="px-4 py-3"><Link href={`/dashboard/cors/${co.id}`} className="font-mono text-[#C9A96E] hover:underline font-medium">{co.corNumber}</Link></td>
                          <td className="px-4 py-3">
                            <select value={co.status} onChange={e => updateCORStatus(co.id, e.target.value)} disabled={updatingId === co.id}
                              className={`${sc.bg} ${sc.text} text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer focus:ring-1 focus:ring-[#C9A96E]`}>
                              <option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(co.date)}</td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={co.description}>{co.description}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{co.subcontractor || co.notes || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{fmtMoney(co.subtotal)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{fmtMoney(co.overheadProfit)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{fmtMoney(co.generalLiability)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{fmtMoney(co.totalAmount)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[#2E7D32]">{rt !== null ? fmtMoney(rt) : '—'}</td>
                          <td className="px-4 py-3"><Link href={`/dashboard/cors/${co.id}`} className="text-[#C9A96E] hover:text-[#B8975D]"><FileText className="w-4 h-4" /></Link></td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RFIs TAB */}
      {activeTab === 'rfis' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search RFIs..."
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50" />
            </div>
            <div className="flex gap-1 bg-card border border-border rounded-lg p-0.5">
              {['All', 'Open', 'Under Review', 'Answered', 'Closed'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? 'bg-[#C9A96E] text-white' : 'text-muted-foreground hover:text-foreground'}`}>{s}</button>
              ))}
            </div>
            <Link href={`/dashboard/rfis/new?projectId=${project.id}`}
              className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" /> New RFI
            </Link>
          </div>

          <div className="bg-card rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">RFI #</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Priority</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Subject</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Submitted</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Assigned To</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Due</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Impact</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRfis.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <FileQuestion className="w-8 h-8 mx-auto mb-2 opacity-30" />No RFIs found
                    </td></tr>
                  ) : (
                    filteredRfis.map((rfi, i) => {
                      const sc = rfiStatusConfig[rfi.status] ?? rfiStatusConfig.Open;
                      const pc = priorityConfig[rfi.priority] ?? priorityConfig.Normal;
                      const overdue = rfi.dateDue && rfi.status !== 'Answered' && rfi.status !== 'Closed' && new Date(rfi.dateDue) < new Date();
                      return (
                        <motion.tr key={rfi.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className={`hover:bg-muted/50 ${overdue ? 'bg-red-50/50' : ''}`}>
                          <td className="px-4 py-3"><Link href={`/dashboard/rfis/${rfi.id}`} className="font-mono text-blue-500 hover:underline font-medium">{rfi.rfiNumber}</Link></td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded font-medium ${sc.bg} ${sc.color}`}>{rfi.status}</span></td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded font-medium ${pc.bg} ${pc.color}`}>{rfi.priority}</span></td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={rfi.subject}>{rfi.subject}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(rfi.dateSubmitted)}</td>
                          <td className="px-4 py-3 text-xs">{rfi.assignedTo || '—'}</td>
                          <td className="px-4 py-3 text-xs">
                            {rfi.dateDue ? (<span className={overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>{fmtDate(rfi.dateDue)} {overdue && '⚠'}</span>) : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {(rfi.costImpact !== 'None' || rfi.scheduleImpact !== 'None') ? (
                              <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {rfi.costImpact !== 'None' ? '$' : ''}{rfi.scheduleImpact !== 'None' ? ' ⏱' : ''}</span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3"><Link href={`/dashboard/rfis/${rfi.id}`} className="text-[#C9A96E] hover:text-[#B8975D]"><ChevronRight className="w-4 h-4" /></Link></td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBMITTALS TAB */}
      {activeTab === 'submittals' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search submittals..."
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50" />
            </div>
            <div className="flex gap-1 bg-card border border-border rounded-lg p-0.5 flex-wrap">
              {['All', 'Draft', 'Submitted', 'Under Review', 'Approved', 'Revise and Resubmit', 'Rejected'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? 'bg-[#C9A96E] text-white' : 'text-muted-foreground hover:text-foreground'}`}>{s}</button>
              ))}
            </div>
            <Link href={`/dashboard/submittals/new?projectId=${project.id}`}
              className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Submittal
            </Link>
          </div>

          <div className="bg-card rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FEF3C7]/40">
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Submittal #</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Subcontractor</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#0F1B33] text-xs uppercase tracking-wider">Required</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSubmittals.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <FileStack className="w-8 h-8 mx-auto mb-2 opacity-30" />No submittals found
                    </td></tr>
                  ) : (
                    filteredSubmittals.map((s, i) => {
                      const sc = submittalStatusConfig[s.status] ?? submittalStatusConfig.Draft;
                      return (
                        <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-muted/50">
                          <td className="px-4 py-3"><Link href={`/dashboard/submittals/${s.id}`} className="font-mono text-[#C9A96E] hover:underline font-medium">{s.submittalNumber}</Link></td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded font-medium ${sc.bg} ${sc.color}`}>{s.status}</span></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{s.submittalType}</td>
                          <td className="px-4 py-3 max-w-[220px] truncate" title={s.title}>{s.title}</td>
                          <td className="px-4 py-3 text-xs">{s.subcontractor || '—'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.requiredDate)}</td>
                          <td className="px-4 py-3"><Link href={`/dashboard/submittals/${s.id}`} className="text-[#C9A96E] hover:text-[#B8975D]"><ChevronRight className="w-4 h-4" /></Link></td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BUDGET TAB */}
      {activeTab === 'budget' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold text-lg">Budget</h3>
            <Link href={`/dashboard/budgets/new?projectId=${project.id}`}
              className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" /> Upload Budget
            </Link>
          </div>

          {budgets.length === 0 ? (
            <div className="bg-card rounded-xl p-12 text-center shadow-[var(--shadow-sm)]">
              <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No budget uploaded yet.</p>
              <Link href={`/dashboard/budgets/new?projectId=${project.id}`} className="inline-flex items-center gap-2 mt-4 text-[#C9A96E] hover:underline text-sm">
                <Plus className="w-4 h-4" /> Upload First Budget
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {budgets.map(b => (
                <Link key={b.id} href={`/dashboard/budgets/${b.id}`}
                  className="block bg-card rounded-xl p-5 shadow-[var(--shadow-sm)] border border-border hover:border-[#C9A96E]/40 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-purple-500" />
                      <span className="text-lg font-mono font-bold">{b.version}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${b.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{b.status}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(b.budgetDate)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><p className="text-xs text-muted-foreground">Sub Total</p><p className="font-mono font-semibold text-sm">{fmtMoney(b.subTotalAll)}</p></div>
                    <div><p className="text-xs text-muted-foreground">O&P</p><p className="font-mono font-semibold text-sm">{fmtMoney(b.opAmount)}</p></div>
                    <div><p className="text-xs text-muted-foreground">GL Insurance</p><p className="font-mono font-semibold text-sm">{fmtMoney(b.glAmount)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-mono font-semibold text-sm text-[#2E7D32]">{fmtMoney(b.grandTotal)}</p></div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{b._count.lineItems} line items · {b._count.detailItems} detail items</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAY APPLICATIONS TAB */}
      {activeTab === 'pay-apps' && showBatchImport ? (
        <BatchPAImport
          projectId={project.id}
          projectName={`#${project.projectNumber} — ${project.projectName}`}
          onComplete={() => { setShowBatchImport(false); router.refresh(); }}
          onCancel={() => setShowBatchImport(false)}
        />
      ) : activeTab === 'pay-apps' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold text-lg">Pay Applications</h3>
            <div className="flex gap-2 flex-wrap">
              {payApps.length > 0 && (
                <button
                  onClick={handleOwnerReport}
                  disabled={generatingReport}
                  className="bg-gradient-to-r from-[#0F1B33] to-[#1B2A4A] text-white hover:from-[#0a1225] hover:to-[#15213a] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-60 shadow-sm"
                >
                  {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart className="w-4 h-4 text-[#C9A96E]" />}
                  {generatingReport ? 'Generando Reporte...' : 'Owner Equity Report'}
                </button>
              )}
              <button
                onClick={() => setShowBatchImport(true)}
                className="border border-[#C9A96E]/40 text-[#C9A96E] hover:bg-[#C9A96E]/10 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" /> Batch Import
              </button>
              {payApps.length > 1 && (
                <button
                  onClick={handleReorderPAs}
                  disabled={reordering}
                  className="border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <ArrowUpDown className="w-4 h-4" /> {reordering ? 'Procesando...' : 'Reordenar por Fecha'}
                </button>
              )}
              {payApps.length > 0 && (
                <button
                  onClick={handleDeleteLastPA}
                  disabled={reordering}
                  className="border border-amber-300 dark:border-amber-800 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Borrar Última
                </button>
              )}
              {payApps.length > 0 && (
                <button
                  onClick={handleDeleteAllPAs}
                  disabled={reordering}
                  className="border border-red-300 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Borrar Todas
                </button>
              )}
              <Link href={`/dashboard/pay-apps/new?projectId=${project.id}`}
                className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Pay App
              </Link>
            </div>
          </div>

          {payApps.length === 0 ? (
            <div className="bg-card rounded-xl p-12 text-center shadow-[var(--shadow-sm)]">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No pay applications yet.</p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button onClick={() => setShowBatchImport(true)} className="inline-flex items-center gap-2 text-[#C9A96E] hover:underline text-sm">
                  <Upload className="w-4 h-4" /> Batch Import (Onboarding)
                </button>
                <span className="text-muted-foreground">o</span>
                <Link href={`/dashboard/pay-apps/new?projectId=${project.id}`} className="inline-flex items-center gap-2 text-[#C9A96E] hover:underline text-sm">
                  <Plus className="w-4 h-4" /> Create First Pay Application
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...payApps].sort((a, b) => a.applicationNumber - b.applicationNumber).map(pa => {
                const total = calcPATotal(pa.lineItems);
                const completed = calcPACompleted(pa.lineItems);
                const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
                return (
                  <Link key={pa.id} href={`/dashboard/pay-apps/${pa.id}`}
                    className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)] border border-border hover:border-[#C9A96E]/40 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-mono font-bold">PA #{pa.applicationNumber}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${paStatusColors[pa.status] ?? paStatusColors.Draft}`}>{pa.status}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Calendar className="w-3 h-3" /> {fmtDateShort(pa.periodFrom)} — {fmtDateShort(pa.periodTo)}
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-gradient-to-r from-[#C9A96E] to-[#B8975D] rounded-full transition-all" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{pct}% complete</span>
                      <span className="font-mono font-medium">{fmtMoney(completed)} / {fmtMoney(total)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <ProjectAnalytics projectId={project.id} />
      )}
    </div>
  );
}
