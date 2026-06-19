'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, Activity,
  BarChart3, PieChart, AlertTriangle, CheckCircle2, Clock,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Info, Building2,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const OwnerExecutiveDashboard = dynamic(() => import('@/components/owner-executive-dashboard'), { ssr: false });

/* ── Types ─────────────────────────────────────────────────────── */
interface EarnedValuePoint {
  date: string;
  bcws: number;
  bcwp: number;
  acwp: number;
}

interface KPIs {
  bac: number;
  bcws: number;
  bcwp: number;
  acwp: number;
  spi: number;
  cpi: number;
  sv: number;
  cv: number;
  eac: number;
  etc: number;
  vac: number;
  overallPct: number;
  dataDate: string;
}

interface CashflowPoint {
  month: string;
  planned: number;
  billed: number;
  cumPlanned: number;
  cumBilled: number;
}

interface CashflowSummary {
  originalContract: number;
  approvedCOs: number;
  adjustedContract: number;
  totalPlanned: number;
  totalBilled: number;
  remainingToBill: number;
  retainageRate: number;
  retainageHeld: number;
}

/* ── Helpers ───────────────────────────────────────────────────── */
const fmtMoney = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

const fmtMoneyFull = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(mo) - 1]} ${y.slice(2)}`;
};

const fmtDate = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ── Tooltip Formatters ────────────────────────────────────────── */
const EVTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#0F1B33] border border-[#C9A96E]/30 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-[#C9A96E] font-medium mb-2">{fmtDate(label)}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="text-white font-mono font-semibold">{fmtMoneyFull(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const CFTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#0F1B33] border border-[#C9A96E]/30 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-[#C9A96E] font-medium mb-2">{fmtMonth(label)}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="text-white font-mono font-semibold">{fmtMoneyFull(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ── KPI Card ──────────────────────────────────────────────────── */
function KpiCard({ label, value, format = 'money', status, tooltip }: {
  label: string;
  value: number;
  format?: 'money' | 'ratio' | 'percent' | 'money-delta';
  status?: 'good' | 'warn' | 'bad' | 'neutral';
  tooltip?: string;
}) {
  const statusColors = {
    good: 'border-emerald-500/30 bg-emerald-500/5',
    warn: 'border-amber-500/30 bg-amber-500/5',
    bad: 'border-red-500/30 bg-red-500/5',
    neutral: 'border-border bg-card',
  };
  const statusTextColors = {
    good: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
    neutral: 'text-foreground',
  };
  const StatusIcon = status === 'good' ? ArrowUpRight : status === 'bad' ? ArrowDownRight : Minus;

  let display = '';
  if (format === 'money') display = fmtMoneyFull(value);
  else if (format === 'ratio') display = value.toFixed(2);
  else if (format === 'percent') display = `${value.toFixed(1)}%`;
  else if (format === 'money-delta') display = `${value >= 0 ? '+' : ''}${fmtMoneyFull(value)}`;

  return (
    <div className={`rounded-xl border p-4 transition-all ${statusColors[status || 'neutral']}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        {status && status !== 'neutral' && (
          <StatusIcon className={`w-4 h-4 ${statusTextColors[status]}`} />
        )}
      </div>
      <p className={`text-xl font-bold font-mono ${statusTextColors[status || 'neutral']}`}>
        {display}
      </p>
      {tooltip && (
        <p className="text-[10px] text-muted-foreground mt-1">{tooltip}</p>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export default function ProjectAnalytics({ projectId }: { projectId: string }) {
  const [evData, setEvData] = useState<EarnedValuePoint[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [cfData, setCfData] = useState<CashflowPoint[]>([]);
  const [cfSummary, setCfSummary] = useState<CashflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'owner-executive' | 'earned-value' | 'cashflow'>('owner-executive');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, cfRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/earned-value`),
        fetch(`/api/projects/${projectId}/cashflow`),
      ]);
      if (evRes.ok) {
        const ev = await evRes.json();
        setEvData(ev.series || []);
        setKpis(ev.kpis || null);
      }
      if (cfRes.ok) {
        const cf = await cfRes.json();
        setCfData(cf.monthly || []);
        setCfSummary(cf.summary || null);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-[400px] rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const noEVData = !kpis || evData.length === 0;
  const noCFData = cfData.length === 0;

  // Determine status indicators for KPIs
  const spiStatus = !kpis ? 'neutral' : kpis.spi >= 0.95 ? 'good' : kpis.spi >= 0.85 ? 'warn' : 'bad';
  const cpiStatus = !kpis ? 'neutral' : kpis.cpi >= 0.95 ? 'good' : kpis.cpi >= 0.85 ? 'warn' : 'bad';
  const svStatus = !kpis ? 'neutral' : kpis.sv >= 0 ? 'good' : kpis.sv > -(kpis.bac * 0.05) ? 'warn' : 'bad';
  const cvStatus = !kpis ? 'neutral' : kpis.cv >= 0 ? 'good' : kpis.cv > -(kpis.bac * 0.05) ? 'warn' : 'bad';

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#C9A96E]" />
            Project Analytics & Earned Value
          </h2>
          {kpis && (
            <p className="text-xs text-muted-foreground mt-1">
              Data Date: {fmtDate(kpis.dataDate)} · BAC: {fmtMoneyFull(kpis.bac)}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-[#C9A96E]/40 hover:bg-[#C9A96E]/5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── KPI Dashboard ──────────────────────────────────────── */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="SPI" value={kpis.spi} format="ratio" status={spiStatus as any}
            tooltip="Schedule Performance Index. >1 = ahead, <1 = behind" />
          <KpiCard label="CPI" value={kpis.cpi} format="ratio" status={cpiStatus as any}
            tooltip="Cost Performance Index. >1 = under budget, <1 = over budget" />
          <KpiCard label="Schedule Variance" value={kpis.sv} format="money-delta" status={svStatus as any}
            tooltip="BCWP − BCWS. Negative = behind schedule" />
          <KpiCard label="Cost Variance" value={kpis.cv} format="money-delta" status={cvStatus as any}
            tooltip="BCWP − ACWP. Negative = over budget" />
          <KpiCard label="% Complete" value={kpis.overallPct} format="percent" status="neutral"
            tooltip="Weighted % complete based on cost-loaded activities" />
          <KpiCard label="EAC" value={kpis.eac} format="money" status="neutral"
            tooltip="Estimate At Completion = BAC / CPI" />
          <KpiCard label="ETC" value={kpis.etc} format="money" status="neutral"
            tooltip="Estimate To Complete = EAC − ACWP" />
          <KpiCard label="VAC" value={kpis.vac} format="money-delta" status={kpis.vac >= 0 ? 'good' : 'bad'}
            tooltip="Variance At Completion = BAC − EAC" />
        </div>
      )}

      {/* ── Owner Executive Dashboard (standalone section) ── */}
      {activeChart === 'owner-executive' && (
        <OwnerExecutiveDashboard projectId={projectId} />
      )}

      {/* ── Chart Toggle ───────────────────────────────────────── */}
      <div className={`bg-card rounded-xl border border-border shadow-[var(--shadow-sm)] ${activeChart === 'owner-executive' ? 'mt-6' : ''}`}>
        <div className="flex border-b border-border overflow-x-auto">
          {[
            { key: 'owner-executive' as const, label: 'Executive Cashflow', icon: Building2 },
            { key: 'earned-value' as const, label: 'S-Curve / Earned Value', icon: TrendingUp },
            { key: 'cashflow' as const, label: 'Technical Cashflow', icon: DollarSign },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveChart(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                activeChart === key
                  ? 'border-[#C9A96E] text-[#C9A96E] bg-[#C9A96E]/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Earned Value S-Curve ─────────────────────────── */}
          {activeChart === 'earned-value' && (
            noEVData ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Activity className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No Earned Value Data Available</p>
                <p className="text-xs mt-1">Cost-load your schedule activities to generate S-curves</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-0.5 bg-[#C9A96E]" /> <span className="text-muted-foreground">BCWS (Planned Value)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-0.5 bg-[#2E7D32]" /> <span className="text-muted-foreground">BCWP (Earned Value)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-0.5 bg-[#D32F2F]" /> <span className="text-muted-foreground">ACWP (Actual Cost)</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={380}>
                  <AreaChart data={evData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <defs>
                      <linearGradient id="bcwsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C9A96E" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#C9A96E" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="bcwpFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2E7D32" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#2E7D32" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(d) => {
                        const dt = new Date(d + 'T00:00:00');
                        return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                      }}
                      interval={Math.max(Math.floor(evData.length / 12), 1)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => fmtMoney(v)}
                      width={65}
                    />
                    <Tooltip content={<EVTooltip />} />
                    {kpis && (
                      <ReferenceLine
                        x={kpis.dataDate}
                        stroke="#C9A96E"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{ value: 'Data Date', position: 'top', fontSize: 10, fill: '#C9A96E' }}
                      />
                    )}
                    <Area
                      type="monotone" dataKey="bcws" name="BCWS (Planned)"
                      stroke="#C9A96E" strokeWidth={2} fill="url(#bcwsFill)" dot={false}
                    />
                    <Area
                      type="monotone" dataKey="bcwp" name="BCWP (Earned)"
                      stroke="#2E7D32" strokeWidth={2.5} fill="url(#bcwpFill)" dot={false}
                    />
                    <Line
                      type="monotone" dataKey="acwp" name="ACWP (Actual)"
                      stroke="#D32F2F" strokeWidth={2} strokeDasharray="5 3" dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          {/* ── Owner Cashflow ──────────────────────────────────── */}
          {activeChart === 'cashflow' && (
            noCFData ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <DollarSign className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No Cashflow Data Available</p>
                <p className="text-xs mt-1">Add Pay Applications and cost-load your schedule to generate projections</p>
              </div>
            ) : (
              <div>
                {/* Cashflow Summary Cards */}
                {cfSummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <div className="p-3 rounded-lg border border-border bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Original Contract</p>
                      <p className="text-sm font-bold font-mono">{fmtMoneyFull(cfSummary.originalContract)}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Approved COs</p>
                      <p className="text-sm font-bold font-mono text-[#C9A96E]">{fmtMoneyFull(cfSummary.approvedCOs)}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Adjusted Contract</p>
                      <p className="text-sm font-bold font-mono">{fmtMoneyFull(cfSummary.adjustedContract)}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-muted/30">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining to Bill</p>
                      <p className="text-sm font-bold font-mono text-blue-600">{fmtMoneyFull(cfSummary.remainingToBill)}</p>
                    </div>
                  </div>
                )}

                {/* Monthly Bar + Cumulative Line */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-3 rounded-sm bg-[#C9A96E]/60" /> <span className="text-muted-foreground">Planned (monthly)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-3 rounded-sm bg-[#2E7D32]/60" /> <span className="text-muted-foreground">Billed (monthly)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-0.5 bg-[#C9A96E]" /> <span className="text-muted-foreground">Cum. Planned</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-0.5 bg-[#2E7D32]" /> <span className="text-muted-foreground">Cum. Billed</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart data={cfData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={fmtMonth}
                      interval={Math.max(Math.floor(cfData.length / 12), 0)}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => fmtMoney(v)}
                      width={65}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => fmtMoney(v)}
                      width={65}
                    />
                    <Tooltip content={<CFTooltip />} />
                    <Bar yAxisId="left" dataKey="planned" name="Planned" fill="#C9A96E" opacity={0.5} radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="left" dataKey="billed" name="Billed" fill="#2E7D32" opacity={0.6} radius={[3, 3, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumPlanned" name="Cum. Planned"
                      stroke="#C9A96E" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="cumBilled" name="Cum. Billed"
                      stroke="#2E7D32" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Retainage info */}
                {cfSummary && cfSummary.retainageHeld > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        Retainage held: {fmtMoneyFull(cfSummary.retainageHeld)} ({(cfSummary.retainageRate * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Cross-Module Summary Table ────────────────────────── */}
      {kpis && cfSummary && (
        <div className="bg-card rounded-xl border border-border shadow-[var(--shadow-sm)] p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#C9A96E]" />
            Executive Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Metric</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Value</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2.5 px-3 text-muted-foreground">Budget at Completion (BAC)</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">{fmtMoneyFull(kpis.bac)}</td>
                  <td className="py-2.5 px-3"><span className="text-xs text-muted-foreground">Baseline</span></td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-muted-foreground">Adjusted Contract Sum</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">{fmtMoneyFull(cfSummary.adjustedContract)}</td>
                  <td className="py-2.5 px-3">
                    {cfSummary.approvedCOs > 0 && (
                      <span className="text-xs text-[#C9A96E]">+{fmtMoneyFull(cfSummary.approvedCOs)} COs</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-muted-foreground">Estimate at Completion (EAC)</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">{fmtMoneyFull(kpis.eac)}</td>
                  <td className="py-2.5 px-3">
                    {kpis.vac >= 0 ? (
                      <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Under budget</span>
                    ) : (
                      <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Over budget by {fmtMoneyFull(Math.abs(kpis.vac))}</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-muted-foreground">Schedule Performance (SPI)</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">{kpis.spi.toFixed(2)}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs flex items-center gap-1 ${kpis.spi >= 1 ? 'text-emerald-600' : kpis.spi >= 0.9 ? 'text-amber-600' : 'text-red-600'}`}>
                      {kpis.spi >= 1 ? <CheckCircle2 className="w-3 h-3" /> : kpis.spi >= 0.9 ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {kpis.spi >= 1 ? 'On/Ahead schedule' : kpis.spi >= 0.9 ? 'Slightly behind' : 'Behind schedule'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-muted-foreground">Cost Performance (CPI)</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">{kpis.cpi.toFixed(2)}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs flex items-center gap-1 ${kpis.cpi >= 1 ? 'text-emerald-600' : kpis.cpi >= 0.9 ? 'text-amber-600' : 'text-red-600'}`}>
                      {kpis.cpi >= 1 ? <CheckCircle2 className="w-3 h-3" /> : kpis.cpi >= 0.9 ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {kpis.cpi >= 1 ? 'Under budget' : kpis.cpi >= 0.9 ? 'Slightly over' : 'Over budget'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-muted-foreground">Overall Progress</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">{kpis.overallPct.toFixed(1)}%</td>
                  <td className="py-2.5 px-3">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden inline-block align-middle">
                      <div className="h-full bg-[#C9A96E] rounded-full" style={{ width: `${Math.min(kpis.overallPct, 100)}%` }} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state for both */}
      {noEVData && noCFData && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Analytics Data Yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            To generate Earned Value S-curves and cashflow projections, you need:
          </p>
          <ul className="text-sm text-muted-foreground mt-3 space-y-1">
            <li className="flex items-center justify-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#C9A96E]" /> A CPM schedule with cost-loaded activities
            </li>
            <li className="flex items-center justify-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-[#C9A96E]" /> Pay Applications with completed amounts
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}