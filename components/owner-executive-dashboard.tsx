'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  DollarSign, TrendingUp, Calendar, Shield, AlertTriangle,
  ArrowRight, RefreshCw, Zap, Building2, FileText, Clock,
  CheckCircle2, Target, Layers, Download, Loader2,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────── */
interface SeriesPoint {
  month: string;
  outOfPocket: number;
  cumOutOfPocket: number;
  origProjection: number;
  cumOrigProjection: number;
  currentProjection?: number;
  cumCurrentProjection?: number;
  accelProjection?: number;
  cumAccelProjection?: number;
}

interface Summary {
  contractAmount: number;
  approvedCOs: number;
  adjustedContract: number;
  totalBudgetCPM: number;
  totalOutOfPocket: number;
  grossBilled: number;
  retainageHeld: number;
  retainageRate: number;
  remainingBudget: number;
  pctDisbursed: number;
  payAppCount: number;
  firstPADate: string;
  origFinishDate: string | null;
  currentFinishDate: string | null;
  hasModifiedCPM: boolean;
  originalRevision: string | null;
  currentRevision: string | null;
  dataDate: string | null;
  accelTargetDate: string | null;
}

/* ── Formatters ───────────────────────────────────────────────── */
const fmtK = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};
const fmtFull = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(mo) - 1]} '${y.slice(2)}`;
};
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ── Custom Tooltip ───────────────────────────────────────────── */
const ExecTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#0F1B33] border border-[#C9A96E]/40 rounded-lg p-3 shadow-2xl min-w-[200px]">
      <p className="text-[11px] text-[#C9A96E] font-semibold mb-2 uppercase tracking-wider">{fmtMonth(label)}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-[11px] py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-400">{entry.name}</span>
          </div>
          <span className="text-white font-mono font-bold">{fmtFull(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Main Component ───────────────────────────────────────────── */
export default function OwnerExecutiveDashboard({ projectId }: { projectId: string }) {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [accelDate, setAccelDate] = useState('');
  const [showAccel, setShowAccel] = useState(false);
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async (accel?: string) => {
    setLoading(true);
    try {
      const qs = accel ? `?accelDate=${accel}` : '';
      const res = await fetch(`/api/projects/${projectId}/owner-executive${qs}`);
      if (res.ok) {
        const data = await res.json();
        setSeries(data.series || []);
        setSummary(data.summary || null);
        setMessage(data.message || '');
        if (data.summary?.accelTargetDate) {
          setShowAccel(true);
        }
      }
    } catch (err) {
      console.error('Owner executive fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAccelerate = () => {
    if (accelDate) fetchData(accelDate);
  };

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/owner-executive/pdf`, { method: 'POST' });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const a = document.createElement('a');
        a.href = reader.result as string;
        a.download = `Owner_Executive_Cashflow.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('PDF download error:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
        <div className="h-[420px] rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (message || !summary) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Executive Cashflow</h3>
        <p className="text-muted-foreground text-sm">{message || 'No data available'}</p>
      </div>
    );
  }

  // Variance between actual OOP and original projection
  const latestCumOOP = series.filter(s => s.cumOutOfPocket > 0).pop()?.cumOutOfPocket || 0;
  const latestCumOrig = series.filter(s => s.cumOrigProjection > 0).pop()?.cumOrigProjection || 0;
  const variance = latestCumOOP - (latestCumOrig > 0 ? (() => {
    // Find the projection value at the same month as the last OOP
    const lastOOPMonth = series.filter(s => s.outOfPocket > 0).pop()?.month;
    if (!lastOOPMonth) return 0;
    const match = series.find(s => s.month === lastOOPMonth);
    return match?.cumOrigProjection || 0;
  })() : 0);
  const variancePct = latestCumOOP > 0 ? ((variance / latestCumOOP) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── Header Bar ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0F1B33] to-[#1B2A4A] rounded-xl p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-[#C9A96E]" />
              <h2 className="text-base font-bold tracking-wide">OWNER EXECUTIVE CASHFLOW</h2>
            </div>
            <p className="text-xs text-gray-400">
              Real Out-of-Pocket Analysis · {summary.payAppCount} Pay Application{summary.payAppCount !== 1 ? 's' : ''} · Since {fmtDate(summary.firstPADate)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {summary.dataDate && (
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase">Data Date</p>
                <p className="text-xs font-mono text-[#C9A96E]">{fmtDate(summary.dataDate)}</p>
              </div>
            )}
            <button
              onClick={handleDownloadPDF}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A96E]/30 bg-[#C9A96E]/10 hover:bg-[#C9A96E]/20 text-[#C9A96E] text-xs font-medium transition-all disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {generating ? 'Generating...' : 'PDF'}
            </button>
            <button
              onClick={() => fetchData()}
              className="p-2 rounded-lg border border-white/10 hover:border-[#C9A96E]/40 hover:bg-white/5 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Top KPI Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Out-of-Pocket */}
        <div className="bg-card rounded-xl border border-border p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#C9A96E]/5 rounded-bl-[60px]" />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-4 h-4 text-[#C9A96E]" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Out-of-Pocket</span>
            </div>
            <p className="text-2xl font-black font-mono text-foreground">{fmtFull(summary.totalOutOfPocket)}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-[#C9A96E] rounded-full transition-all" style={{ width: `${Math.min(summary.pctDisbursed, 100)}%` }} />
              </div>
              <span className="text-[10px] font-mono font-bold text-[#C9A96E]">{summary.pctDisbursed}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">of {fmtFull(summary.totalBudgetCPM)} CPM budget</p>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="bg-card rounded-xl border border-border p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-bl-[60px]" />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Remaining to Fund</span>
            </div>
            <p className="text-2xl font-black font-mono text-foreground">{fmtFull(summary.remainingBudget)}</p>
            <p className="text-[10px] text-muted-foreground mt-2">Gross billed: {fmtFull(summary.grossBilled)}</p>
            <p className="text-[10px] text-muted-foreground">Net payment (after retainage): {fmtFull(summary.totalOutOfPocket)}</p>
          </div>
        </div>

        {/* Retainage Held */}
        <div className="bg-card rounded-xl border border-border p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-bl-[60px]" />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Retainage Held</span>
            </div>
            <p className="text-2xl font-black font-mono text-foreground">{fmtFull(summary.retainageHeld)}</p>
            <p className="text-[10px] text-muted-foreground mt-2">{(summary.retainageRate * 100).toFixed(0)}% of gross · Released at substantial completion</p>
          </div>
        </div>

        {/* Contract + COs */}
        <div className="bg-card rounded-xl border border-border p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-bl-[60px]" />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Adjusted Contract</span>
            </div>
            <p className="text-2xl font-black font-mono text-foreground">{fmtFull(summary.adjustedContract)}</p>
            <div className="text-[10px] text-muted-foreground mt-2 space-y-0.5">
              <p>Original: {fmtFull(summary.contractAmount)}</p>
              {summary.approvedCOs > 0 && (
                <p className="text-[#C9A96E]">+ {fmtFull(summary.approvedCOs)} approved COs</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CPM Timeline Comparison ────────────────────────────── */}
      {(summary.origFinishDate || summary.currentFinishDate) && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#C9A96E]" />
            Schedule Timeline
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Original */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#C9A96E]" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Original CPM ({summary.originalRevision})</p>
                <p className="text-sm font-bold font-mono">{fmtDate(summary.origFinishDate)}</p>
              </div>
            </div>
            {/* Current (if modified) */}
            {summary.hasModifiedCPM && summary.currentFinishDate && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Current CPM ({summary.currentRevision})</p>
                    <p className="text-sm font-bold font-mono">{fmtDate(summary.currentFinishDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    new Date(summary.currentFinishDate!) <= new Date(summary.origFinishDate!)
                      ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}>
                    <Clock className={`w-5 h-5 ${
                      new Date(summary.currentFinishDate!) <= new Date(summary.origFinishDate!)
                        ? 'text-emerald-500' : 'text-red-500'
                    }`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Delta</p>
                    <p className={`text-sm font-bold font-mono ${
                      new Date(summary.currentFinishDate!) <= new Date(summary.origFinishDate!)
                        ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {(() => {
                        const diff = Math.round((new Date(summary.currentFinishDate!).getTime() - new Date(summary.origFinishDate!).getTime()) / 86400000);
                        return diff > 0 ? `+${diff} days (delayed)` : diff < 0 ? `${diff} days (ahead)` : 'On schedule';
                      })()}
                    </p>
                  </div>
                </div>
              </>
            )}
            {!summary.hasModifiedCPM && (
              <div className="flex items-center gap-3 col-span-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="text-xs text-muted-foreground">No CPM modifications — baseline projection is current</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Acceleration Scenario Input ────────────────────────── */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          Acceleration Scenario (What-If)
        </h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase block mb-1">Target Completion Date</label>
            <input
              type="date"
              value={accelDate}
              onChange={(e) => setAccelDate(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:border-[#C9A96E] focus:ring-1 focus:ring-[#C9A96E]/20 outline-none"
            />
          </div>
          <button
            onClick={handleAccelerate}
            disabled={!accelDate}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            <Zap className="w-3.5 h-3.5" /> Run Acceleration
          </button>
          {showAccel && (
            <button
              onClick={() => { setShowAccel(false); setAccelDate(''); fetchData(); }}
              className="px-3 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:border-[#C9A96E]/40 transition-all"
            >
              Clear Scenario
            </button>
          )}
        </div>
        {showAccel && summary.accelTargetDate && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
            <div className="flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-amber-700 dark:text-amber-400">
                <p className="font-semibold">Acceleration to {fmtDate(summary.accelTargetDate)}</p>
                <p className="mt-0.5">The orange curve shows projected monthly disbursements if all remaining work is compressed to finish by the target date. Monthly out-of-pocket will increase significantly.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Chart: Cumulative S-Curves ────────────────────── */}
      <div className="bg-card rounded-xl border border-border shadow-[var(--shadow-sm)] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-[#C9A96E]" />
          Cumulative Out-of-Pocket vs. CPM Projections
        </h3>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className="w-3 h-3 rounded-full bg-[#0F1B33] border-2 border-[#0F1B33]" />
            <span className="text-muted-foreground font-medium">Real Out-of-Pocket</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className="w-6 h-0.5 bg-[#C9A96E]" style={{ borderTop: '2px dashed #C9A96E' }} />
            <span className="text-muted-foreground font-medium">Original CPM Projection ({summary.originalRevision})</span>
          </div>
          {summary.hasModifiedCPM && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <div className="w-6 h-0.5 bg-blue-500" />
              <span className="text-muted-foreground font-medium">Current CPM ({summary.currentRevision})</span>
            </div>
          )}
          {showAccel && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <div className="w-6 h-0.5 bg-amber-500" style={{ borderTop: '2px dashed #f59e0b' }} />
              <span className="text-muted-foreground font-medium">Acceleration Scenario</span>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={series} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="oopGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F1B33" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0F1B33" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="origGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A96E" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#C9A96E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={fmtMonth}
              interval={Math.max(Math.floor(series.length / 14), 0)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={fmtK}
              width={60}
            />
            <Tooltip content={<ExecTooltip />} />

            {/* Original CPM Projection */}
            <Area
              type="monotone" dataKey="cumOrigProjection" name={`Original CPM (${summary.originalRevision})`}
              stroke="#C9A96E" strokeWidth={2} strokeDasharray="6 3" fill="url(#origGrad)" dot={false}
            />

            {/* Current CPM Projection (if modified) */}
            {summary.hasModifiedCPM && (
              <Line
                type="monotone" dataKey="cumCurrentProjection" name={`Current CPM (${summary.currentRevision})`}
                stroke="#3B82F6" strokeWidth={2} dot={false}
              />
            )}

            {/* Acceleration Scenario */}
            {showAccel && (
              <Line
                type="monotone" dataKey="cumAccelProjection" name="Acceleration"
                stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 2" dot={false}
              />
            )}

            {/* Real Out-of-Pocket (on top) */}
            <Area
              type="monotone" dataKey="cumOutOfPocket" name="Real Out-of-Pocket"
              stroke="#0F1B33" strokeWidth={3} fill="url(#oopGrad)" dot={false}
            />

            {/* Data Date reference */}
            {summary.dataDate && (
              <ReferenceLine
                x={summary.dataDate.slice(0, 7)}
                stroke="#C9A96E"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Monthly Breakdown Bars ─────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border shadow-[var(--shadow-sm)] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-[#C9A96E]" />
          Monthly Disbursement Detail
        </h3>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className="w-3 h-3 rounded-sm bg-[#0F1B33]" />
            <span className="text-muted-foreground">Actual Out-of-Pocket</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <div className="w-3 h-3 rounded-sm bg-[#C9A96E]/50" />
            <span className="text-muted-foreground">CPM Projected</span>
          </div>
          {showAccel && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <div className="w-3 h-3 rounded-sm bg-amber-500/50" />
              <span className="text-muted-foreground">Acceleration</span>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={series} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={fmtMonth}
              interval={Math.max(Math.floor(series.length / 14), 0)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={fmtK}
              width={60}
            />
            <Tooltip content={<ExecTooltip />} />
            <Bar dataKey="origProjection" name="CPM Projected" fill="#C9A96E" opacity={0.4} radius={[3, 3, 0, 0]} />
            <Bar dataKey="outOfPocket" name="Out-of-Pocket" fill="#0F1B33" opacity={0.85} radius={[3, 3, 0, 0]} />
            {showAccel && (
              <Bar dataKey="accelProjection" name="Acceleration" fill="#F59E0B" opacity={0.4} radius={[3, 3, 0, 0]} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Analyst Notes ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0F1B33] to-[#1B2A4A] rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-[#C9A96E]" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#C9A96E]">Analyst Notes</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-gray-300">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <ArrowRight className="w-3 h-3 text-[#C9A96E] mt-0.5 flex-shrink-0" />
              <p>
                <span className="text-white font-semibold">Out-of-Pocket</span> reflects net payments to GC after {(summary.retainageRate * 100).toFixed(0)}% retainage deduction.
                Total gross billed: {fmtFull(summary.grossBilled)} · Net disbursed: {fmtFull(summary.totalOutOfPocket)}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <ArrowRight className="w-3 h-3 text-[#C9A96E] mt-0.5 flex-shrink-0" />
              <p>
                <span className="text-white font-semibold">CPM Projection</span> distributes the ${fmtFull(summary.totalBudgetCPM)} cost-loaded budget across
                the schedule timeline, starting from the first pay period ({fmtDate(summary.firstPADate)}).
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {summary.hasModifiedCPM ? (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <p>
                  <span className="text-white font-semibold">CPM Modified</span>: Schedule was revised from {summary.originalRevision} to {summary.currentRevision}.
                  Compare the gold dashed line (original) vs. blue line (current) to see the shift in projected cash needs.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p>
                  <span className="text-white font-semibold">No CPM Revision</span>: The baseline schedule ({summary.originalRevision}) remains unchanged.
                  Projected completion: {fmtDate(summary.origFinishDate)}.
                </p>
              </div>
            )}
            {showAccel && (
              <div className="flex items-start gap-2">
                <Zap className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <p>
                  <span className="text-white font-semibold">Acceleration</span>: Compressing remaining work to {fmtDate(summary.accelTargetDate)} will concentrate
                  disbursements into fewer months, increasing monthly cash requirements.
                </p>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Shield className="w-3 h-3 text-[#C9A96E] mt-0.5 flex-shrink-0" />
              <p>
                <span className="text-white font-semibold">{fmtFull(summary.retainageHeld)}</span> in retainage will be released at substantial completion,
                representing a deferred cash obligation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
