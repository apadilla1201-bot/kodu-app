'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, ClipboardList, DollarSign, RefreshCw, Upload, Mail, Search, Save, Loader2, Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BUYOUT_STATUSES } from '@/lib/buyout';

interface ProjectOpt {
  id: string;
  projectNumber: string;
  projectName: string;
}

interface BuyoutItem {
  id: string;
  sortOrder: number;
  lineType: string;
  divisionCode: string | null;
  trade: string;
  status: string;
  proposalAmount: number;
  potentialBuyoutAmount: number;
  contractedValue: number;
  pendingCor: number;
  changeOrders: number;
  totalValueBudget: number;
  cashFlowInvested: number;
  dateSubOnSite: string | null;
  finalOwnerApprovalDate: string | null;
  awardDate: string | null;
  subcontractor: string | null;
  productLeadTimeDays: number | null;
  approvalLeadTimeDays: number | null;
}

interface Summary {
  totalLines: number;
  totalProposal: number;
  totalContracted: number;
  totalBudget: number;
  totalInvested: number;
  totalRemaining: number;
  remainingPct: number;
  delta: number;
  alertCount: number;
  highAlerts: number;
  investedSource?: string;
  latestPayAppNumber?: number | null;
  contractSumToDate?: number | null;
}

interface AlertRow {
  id: string;
  trade: string;
  type: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
};

const statusStyle: Record<string, string> = {
  'Not Started': 'bg-gray-100 text-gray-700',
  'Design Pending': 'bg-purple-100 text-purple-800',
  Bidding: 'bg-blue-100 text-blue-800',
  'Pending Owner Approval': 'bg-amber-100 text-amber-800',
  Awarded: 'bg-teal-100 text-teal-800',
  Contracted: 'bg-green-100 text-green-800',
  'On Site': 'bg-emerald-100 text-emerald-900',
  Complete: 'bg-slate-200 text-slate-700',
};

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${warn ? 'border-red-300' : 'border-border'}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className={`text-xl font-bold mt-1 ${warn ? 'text-red-600' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export function BuyoutContent({ projects, initialProjectId }: { projects: ProjectOpt[]; initialProjectId?: string }) {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BuyoutItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byDivision, setByDivision] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [projectMeta, setProjectMeta] = useState<{ projectNumber: string; projectName: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [emailing, setEmailing] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/buyout?projectId=${projectId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary);
      setByDivision(data.byDivision || []);
      setAlerts(data.alerts || []);
      setProjectMeta(data.project);
    } catch {
      toast({ title: 'Failed to load buyout', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const q = search.toLowerCase();
      const matchQ =
        !q ||
        i.trade.toLowerCase().includes(q) ||
        (i.subcontractor || '').toLowerCase().includes(q) ||
        (i.divisionCode || '').toLowerCase().includes(q);
      const matchS = statusFilter === 'All' || i.status === statusFilter;
      const matchT = typeFilter === 'All' || i.lineType === typeFilter;
      return matchQ && matchS && matchT;
    });
  }, [items, search, statusFilter, typeFilter]);

  const handleImport = async (file: File) => {
    if (!projectId) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('projectId', projectId);
      fd.append('file', file);
      fd.append('replace', 'true');
      const res = await fetch('/api/buyout/import', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      toast({ title: `Imported ${data.imported} buyout lines` });
      await load();
    } catch (e: any) {
      toast({ title: e?.message ?? 'Import failed', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const updateItem = async (id: string, patch: Partial<BuyoutItem>) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/buyout/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
      toast({ title: 'Saved' });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingId('');
    }
  };

  const handleGenerate = async () => {
    if (!projectId) return;
    if (items.length > 0 && !window.confirm('Replace current buyout lines with rows from Budget / Pay App?')) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/buyout/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, replace: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      const src = data.source === 'pay_app' ? `PA #${data.payAppNumber}` : 'Budget';
      toast({
        title: `Generated ${data.imported} lines from ${src}`,
        description: data.cpmRevision ? `CPM ${data.cpmRevision} dates matched on ${data.cpmActivitiesMatched} lines` : undefined,
      });
      await load();
    } catch (e: any) {
      toast({ title: e?.message ?? 'Generate failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const sendAlertsEmail = async () => {
    setEmailing(true);
    try {
      const res = await fetch('/api/buyout/alerts/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Email failed');
      if (data.skipped) {
        toast({ title: 'Email skipped — configure RESEND_API_KEY in Vercel', variant: 'destructive' });
      } else if (!data.sent && data.message) {
        toast({ title: data.message });
      } else {
        toast({ title: `Alert email sent (${data.alerts} items)` });
      }
    } catch (e: any) {
      toast({ title: e?.message ?? 'Email failed', variant: 'destructive' });
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#C9A96E]" /> Buyout / Contract Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Procurement, owner approvals, sub on-site dates, and cash flow — one matrix per project
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.projectNumber} — {p.projectName}
              </option>
            ))}
          </select>
          <button onClick={load} className="px-3 py-2 border border-border rounded-lg text-sm flex items-center gap-1 hover:bg-muted">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !projectId}
            className="px-3 py-2 border border-[#C9A96E] text-[#0F1B33] rounded-lg text-sm font-medium flex items-center gap-1 hover:bg-[#C9A96E]/10 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            From Budget
          </button>
          <label className="px-3 py-2 bg-[#0F1B33] text-[#C9A96E] rounded-lg text-sm font-medium flex items-center gap-1 cursor-pointer hover:opacity-90">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={sendAlertsEmail}
            disabled={emailing || alerts.length === 0}
            className="px-3 py-2 border border-border rounded-lg text-sm flex items-center gap-1 hover:bg-muted disabled:opacity-50"
          >
            {emailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Email Alerts
          </button>
        </div>
      </div>

      {projectMeta && (
        <p className="text-sm text-muted-foreground">
          Project <span className="font-semibold text-foreground">#{projectMeta.projectNumber} {projectMeta.projectName}</span>
          {' · '}{items.length} lines
        </p>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="Proposal" value={fmtMoney(summary.totalProposal)} />
          <Kpi label="Contracted" value={fmtMoney(summary.totalContracted)} />
          <Kpi label="Total Budget" value={fmtMoney(summary.totalBudget)} sub={`Delta ${fmtMoney(summary.delta)}`} />
          <Kpi
            label="Cash Invested"
            value={fmtMoney(summary.totalInvested)}
            sub={
              summary.investedSource
                ? `Executed to date · ${summary.investedSource}`
                : 'Executed to date'
            }
          />
          <Kpi
            label="Remaining"
            value={fmtMoney(summary.totalRemaining)}
            sub={`${(summary.remainingPct * 100).toFixed(0)}% spent${
              summary.contractSumToDate
                ? ` · PA contract ${fmtMoney(summary.contractSumToDate)}`
                : ''
            }`}
          />
          <Kpi label="Alerts" value={String(summary.alertCount)} sub={`${summary.highAlerts} high`} warn={summary.highAlerts > 0} />
        </div>
      )}

      {alerts.length > 0 && (
        <div className="bg-card border border-amber-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Procurement Alerts ({alerts.length})
          </h2>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {alerts.slice(0, 15).map((a, i) => (
              <div key={`${a.id}-${a.type}-${i}`} className="flex items-start gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  a.severity === 'high' ? 'bg-red-100 text-red-700' :
                  a.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                }`}>{a.severity}</span>
                <span className="font-medium truncate max-w-[200px]">{a.trade}</span>
                <span className="text-muted-foreground flex-1">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {byDivision.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#C9A96E]" /> Cash Flow by Division
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byDivision.map((d) => ({
              name: (d.code || d.name || '').replace('DIV ', '#').slice(0, 12),
              Budget: Math.round(d.budget || 0),
              Invested: Math.round(d.invested || 0),
              Remaining: Math.round(d.remaining || 0),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Bar dataKey="Budget" fill="#0F1B33" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Invested" fill="#C9A96E" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Remaining" fill="#94a3b8" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trade, sub, division..."
            className="w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
          {['All', 'Division', 'Trade', 'COR', 'GC', 'Allowance'].map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'All types' : t}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
          <option value="All">All statuses</option>
          {BUYOUT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0F1B33] text-white text-left">
                <th className="px-2 py-2 font-semibold sticky left-0 bg-[#0F1B33] min-w-[180px]">Trade</th>
                <th className="px-2 py-2 font-semibold">Type</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold text-right">Proposal</th>
                <th className="px-2 py-2 font-semibold text-right">Contracted</th>
                <th className="px-2 py-2 font-semibold text-right">COs</th>
                <th className="px-2 py-2 font-semibold text-right">Budget</th>
                <th className="px-2 py-2 font-semibold text-right">Invested</th>
                <th className="px-2 py-2 font-semibold text-right">Remain</th>
                <th className="px-2 py-2 font-semibold">Owner Appr.</th>
                <th className="px-2 py-2 font-semibold">Sub On Site</th>
                <th className="px-2 py-2 font-semibold">Subcontractor</th>
                <th className="px-2 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">
                    No buyout lines yet. Import your Contract Tracking Excel to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const remaining = (item.totalValueBudget || 0) - (item.cashFlowInvested || 0);
                  const isDiv = item.lineType === 'Division';
                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-border hover:bg-muted/40 ${isDiv ? 'bg-[#FEF3C7]/30 font-semibold' : ''}`}
                    >
                      <td className="px-2 py-1.5 sticky left-0 bg-inherit max-w-[220px]">
                        <div className="truncate" title={item.trade}>{item.trade}</div>
                        {item.divisionCode && !isDiv && (
                          <div className="text-[10px] text-muted-foreground">{item.divisionCode}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{item.lineType}</td>
                      <td className="px-2 py-1.5">
                        {isDiv ? '—' : (
                          <select
                            value={item.status}
                            onChange={(e) => updateItem(item.id, { status: e.target.value })}
                            className={`text-[10px] px-1.5 py-0.5 rounded border-0 ${statusStyle[item.status] || 'bg-gray-100'}`}
                          >
                            {BUYOUT_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">{item.proposalAmount ? fmtMoney(item.proposalAmount) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{item.contractedValue ? fmtMoney(item.contractedValue) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{item.changeOrders ? fmtMoney(item.changeOrders) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold">{item.totalValueBudget ? fmtMoney(item.totalValueBudget) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-[#C9A96E]">{item.cashFlowInvested ? fmtMoney(item.cashFlowInvested) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{item.totalValueBudget ? fmtMoney(remaining) : '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(item.finalOwnerApprovalDate)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(item.dateSubOnSite)}</td>
                      <td className="px-2 py-1.5 max-w-[140px] truncate" title={item.subcontractor || ''}>
                        {item.subcontractor || '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        {savingId === item.id && <Save className="w-3 h-3 animate-pulse text-[#C9A96E]" />}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
