'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  BarChart3, DollarSign, FileQuestion, FileStack, Receipt, TrendingUp, RefreshCw,
} from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

interface Summary {
  totalProjects: number;
  totalContractValue: number;
  totalCOs: number;
  approvedCOAmount: number;
  pendingCOAmount: number;
  totalRFIs: number;
  openRFIs: number;
  totalPayApps: number;
  totalBilled: number;
  totalSubmittals: number;
  openSubmittals: number;
}

interface ProjectRow {
  id: string;
  projectNumber: string;
  projectName: string;
  client: string;
  contractAmount: number;
  totalCOs: number;
  approvedCOs: number;
  pendingCOs: number;
  approvedCOAmount: number;
  openRFIs: number;
  totalPayApps: number;
  totalBilled: number;
  totalSubmittals: number;
  openSubmittals: number;
}

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

function Kpi({ label, value, icon: Icon, sub }: { label: string; value: string; icon: any; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-[#C9A96E]" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export function PortfolioAnalyticsContent() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [corByProject, setCorByProject] = useState<any[]>([]);
  const [activityByProject, setActivityByProject] = useState<any[]>([]);

  // Cash Flow Proyectado
  const [cfProjectId, setCfProjectId] = useState('');
  const [cfEnd, setCfEnd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });
  const [cfPct, setCfPct] = useState('15');
  const [cfData, setCfData] = useState<any>(null);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfDivPcts, setCfDivPcts] = useState<Record<string, string>>({});
  const [cfMode, setCfMode] = useState<'manual' | 'cpm'>('manual');

  const generateCf = async () => {
    if (!cfProjectId) return;
    setCfLoading(true);
    try {
      const res = await fetch(`/api/analytics/projected-cashflow?projectId=${cfProjectId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCfData(data);
      setCfDivPcts({});
      if (data.cpm?.available) {
        setCfMode('cpm');
        if (data.cpm.finishDate) {
          setCfEnd(new Date(data.cpm.finishDate).toISOString().split('T')[0]);
        }
      } else {
        setCfMode('manual');
      }
    } catch {
      setCfData(null);
    } finally {
      setCfLoading(false);
    }
  };

  const cfMonths = useMemo(() => {
    if (!cfEnd) return [] as any[];
    const list: any[] = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth();
    const end = new Date(cfEnd + 'T00:00:00');
    let guard = 0;
    while ((y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) && guard < 120) {
      list.push({
        key: `${y}-${m}`,
        label: new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      });
      m++;
      if (m > 11) { m = 0; y++; }
      guard++;
    }
    return list;
  }, [cfEnd]);

  const cfProjection = useMemo(() => {
    if (!cfData || cfMonths.length === 0) return null;
    let cum = 0;
    const rows = cfMonths.map((mo, i) => {
      let amount = 0;
      for (const d of cfData.divisions ?? []) {
        const p = (parseFloat(cfDivPcts[d.code] ?? cfPct) || 0) / 100;
        if (p <= 0 || d.remaining <= 0) continue;
        const burn = d.remaining * Math.pow(1 - p, i) * p;
        amount += Math.min(burn, d.remaining);
      }
      cum += amount;
      return { ...mo, amount, cum };
    });
    const leftAtEnd = cfData.totals.revised - cfData.totals.executed - cum;
    return { rows, leftAtEnd };
  }, [cfData, cfMonths, cfDivPcts, cfPct]);

  const cfMonthsToFinish = (remaining: number, pctStr: string) => {
    if (remaining <= 1) return '0';
    const p = (parseFloat(pctStr) || 0) / 100;
    if (p <= 0) return '—';
    return String(Math.max(1, Math.ceil(Math.log(1 / remaining) / Math.log(1 - p))));
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/portfolio', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setSummary(data.summary);
      setProjects(data.projects);
      setCorByProject(data.corByProject);
      setActivityByProject(data.activityByProject);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Cargando analytics…
      </div>
    );
  }

  if (!summary) {
    return <p className="text-center py-24 text-muted-foreground">{t('analytics.loadError')}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#C9A96E]" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('analytics.subtitle')}</p>
        </div>
        <button onClick={load} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw className="w-4 h-4" /> {t('analytics.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t('analytics.projects')} value={String(summary.totalProjects)} icon={TrendingUp} />
        <Kpi label={t('analytics.contractValue')} value={fmtMoney(summary.totalContractValue)} icon={DollarSign} />
        <Kpi label={t('analytics.approvedCOs')} value={fmtMoney(summary.approvedCOAmount)} icon={Receipt} sub={`${summary.pendingCOAmount > 0 ? fmtMoney(summary.pendingCOAmount) + ' ' + t('analytics.pendingSuffix') : t('analytics.nonePending')}`} />
        <Kpi label={t('analytics.billed')} value={fmtMoney(summary.totalBilled)} icon={DollarSign} sub={`${summary.totalPayApps} pay apps`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label={t('analytics.openRFIs')} value={String(summary.openRFIs)} icon={FileQuestion} sub={`${summary.totalRFIs} total`} />
        <Kpi label={t('analytics.openSubmittals')} value={String(summary.openSubmittals)} icon={FileStack} sub={`${summary.totalSubmittals} total`} />
        <Kpi label={t('analytics.changeOrders')} value={String(summary.totalCOs)} icon={Receipt} />
      </div>

      {/* ── Cash Flow Proyectado al Final de la Obra ── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#C9A96E]" /> {t('analytics.projectedCF')}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('analytics.cfProject')}</label>
            <select
              value={cfProjectId}
              onChange={(e) => { setCfProjectId(e.target.value); setCfData(null); }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background min-w-[220px]"
            >
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>#{p.projectNumber} — {p.projectName}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('analytics.cfEnd')}</label>
            <input type="date" value={cfEnd} onChange={(e) => setCfEnd(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
          {(!cfData || cfMode === 'manual') && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('analytics.cfMonthlyPct')}</label>
              <input type="number" min="0" max="100" step="any" value={cfPct} onChange={(e) => setCfPct(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-background w-28" />
            </div>
          )}
          <button
            onClick={generateCf}
            disabled={cfLoading || !cfProjectId}
            className="px-4 py-2 bg-[#0F1B33] text-[#C9A96E] rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {cfLoading ? '…' : t('analytics.cfGenerate')}
          </button>
        </div>

        {cfData && (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('analytics.cfBasis')}
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cfMode"
                checked={cfMode === 'cpm'}
                onChange={() => setCfMode('cpm')}
                disabled={!cfData.cpm?.available}
                className="accent-[#C9A96E]"
              />
              <span className={cfData.cpm?.available ? '' : 'text-muted-foreground line-through'}>
                {t('analytics.cfModeCpm')}
              </span>
              {!cfData.cpm?.available && (
                <span className="text-xs text-muted-foreground">({t('analytics.cfNoCpm')})</span>
              )}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cfMode"
                checked={cfMode === 'manual'}
                onChange={() => setCfMode('manual')}
                className="accent-[#C9A96E]"
              />
              <span>{t('analytics.cfModeManual')}</span>
            </label>
          </div>
        )}

        {cfData && !cfData.hasData && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{t('analytics.cfNoData')}</p>
        )}

        {cfData && cfData.hasData && cfProjection && (
          <>
            <p className="text-xs text-muted-foreground">
              {t('analytics.cfSourcePa', { number: cfData.latestPaNumber ?? '—' })}
              {cfMode === 'cpm' && cfData.cpm?.available && (
                <span className="block mt-1 text-[#C9A96E]">
                  {t('analytics.cfCpmSource', {
                    revision: cfData.cpm.revision,
                    costed: cfData.cpm.costedActivities,
                    total: cfData.cpm.totalActivities,
                    amount: fmtMoney(cfData.cpm.remainingCost),
                  })}
                </span>
              )}
            </p>

            {cfMode === 'cpm' && cfData.cpm?.available && cfData.cpm.remainingCost > 0 &&
              Math.abs(cfData.cpm.remainingCost - cfData.totals.remaining) > Math.max(1000, cfData.totals.remaining * 0.02) && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {t('analytics.cfCpmDiff', {
                  cpm: fmtMoney(cfData.cpm.remainingCost),
                  real: fmtMoney(cfData.totals.remaining),
                })}
              </p>
            )}

            {cfMode === 'manual' && (cfProjection.leftAtEnd > 1 ? (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {t('analytics.cfAlertLeft', { amount: fmtMoney(cfProjection.leftAtEnd) })}
              </p>
            ) : (
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">
                {t('analytics.cfAlertOk')}
              </p>
            ))}

            {/* Por division */}
            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('analytics.cfDivisions')}</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0F1B33] text-white text-left">
                    <th className="px-3 py-2 font-semibold">{t('analytics.cfCode')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfBudgeted')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfExecuted')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfRemaining')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfDivPct')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfMonthsToFinish')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(cfData.divisions ?? []).map((d: any) => (
                    <tr key={d.code} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono font-semibold">{d.code}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtMoney(d.revised)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtMoney(d.executed)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{fmtMoney(d.remaining)}</td>
                      <td className="px-3 py-2 text-right">
                        {cfMode === 'manual' ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            placeholder={cfPct}
                            value={cfDivPcts[d.code] ?? ''}
                            onChange={(e) => setCfDivPcts((prev) => ({ ...prev, [d.code]: e.target.value }))}
                            className="w-16 px-1 py-0.5 text-right border border-border rounded bg-background font-mono"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {cfMode === 'manual' ? cfMonthsToFinish(d.remaining, cfDivPcts[d.code] ?? cfPct) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#0F1B33] font-bold bg-muted/40">
                    <td className="px-3 py-2">TOTAL</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(cfData.totals.revised)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(cfData.totals.executed)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtMoney(cfData.totals.remaining)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Movimientos mensuales: CPM o manual */}
            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('analytics.cfMonthly')}</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#0F1B33] text-white text-left">
                    <th className="px-3 py-2 font-semibold">{t('analytics.cfMonth')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfProjMonth')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfProjCum')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfRealToday')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfRealTotal')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('analytics.cfLeft')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(cfMode === 'cpm' && cfData.cpm?.available
                    ? (() => { let c = 0; return cfData.cpm.months.map((m: any) => { c += m.amount; return { ...m, cum: c }; }); })()
                    : cfProjection.rows
                  ).map((r: any) => {
                    const realPlusProj = cfData.totals.executed + r.cum;
                    const left = cfData.totals.revised - realPlusProj;
                    return (
                      <tr key={r.key} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{r.label}</td>
                        <td className="px-3 py-2 text-right font-mono text-[#C9A96E]">{fmtMoney(r.amount)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtMoney(r.cum)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtMoney(cfData.totals.executed)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{fmtMoney(cfData.totals.revised)}</td>
                        <td className={`px-3 py-2 text-right font-mono ${left < 0 ? 'text-red-600' : ''}`}>{fmtMoney(Math.max(0, left))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">{t('analytics.cosPerProject')}</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={corByProject}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="approved" name={t('analytics.approved')} fill="#2E7D32" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" name={t('analytics.pending')} fill="#C9A96E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">{t('analytics.openActivity')}</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activityByProject}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="rfis" name={t('analytics.openRFIs')} fill="#0F1B33" radius={[4, 4, 0, 0]} />
              <Bar dataKey="submittals" name={t('analytics.openSubmittals')} fill="#C9A96E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">{t('analytics.detailPerProject')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">{t('analytics.projectCol')}</th>
                <th className="px-4 py-3 text-right">{t('analytics.contractCol')}</th>
                <th className="px-4 py-3 text-right">COs</th>
                <th className="px-4 py-3 text-right">RFIs</th>
                <th className="px-4 py-3 text-right">Pay Apps</th>
                <th className="px-4 py-3 text-right">{t('analytics.billed')}</th>
                <th className="px-4 py-3 text-right">Submittals</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{p.projectNumber}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium hover:text-[#C9A96E]">
                      {p.projectName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{p.client}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmtMoney(p.contractAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-green-700">{p.approvedCOs}</span>
                    {p.pendingCOs > 0 && <span className="text-amber-600"> / {p.pendingCOs} {t('analytics.pendShort')}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.openRFIs > 0 ? <span className="text-amber-600 font-semibold">{p.openRFIs} {t('analytics.openSuffix')}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{p.totalPayApps}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.totalBilled > 0 ? fmtMoney(p.totalBilled) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {p.openSubmittals > 0 ? <span className="text-blue-600">{p.openSubmittals} {t('analytics.openSuffix')}</span> : p.totalSubmittals || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t('analytics.evHint')}
      </p>
    </div>
  );
}
