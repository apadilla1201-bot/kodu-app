'use client';

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

interface ProjectOpt {
  id: string;
  projectNumber: string;
  projectName: string;
}

interface Props {
  /** Si se fija, no se muestra el selector de proyecto (contexto de proyecto) */
  fixedProjectId?: string;
  /** Lista para el selector (contexto portafolio) */
  projects?: ProjectOpt[];
}

export function ProjectedCashflowSection({ fixedProjectId, projects }: Props) {
  const { t } = useI18n();
  const [selProjectId, setSelProjectId] = useState('');
  const projectId = fixedProjectId || selProjectId;

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
    if (!projectId) return;
    setCfLoading(true);
    try {
      const res = await fetch(`/api/analytics/projected-cashflow?projectId=${projectId}`, { credentials: 'include' });
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

  const cpmAgeDays =
    cfData?.cpm?.dataDate != null
      ? Math.floor((Date.now() - new Date(cfData.cpm.dataDate).getTime()) / 86400000)
      : null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[#C9A96E]" /> {t('analytics.projectedCF')}
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        {!fixedProjectId && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('analytics.cfProject')}</label>
            <select
              value={selProjectId}
              onChange={(e) => { setSelProjectId(e.target.value); setCfData(null); }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background min-w-[220px]"
            >
              <option value="">—</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>#{p.projectNumber} — {p.projectName}</option>
              ))}
            </select>
          </div>
        )}
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
          disabled={cfLoading || !projectId}
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
              name={`cfMode-${projectId ?? 'x'}`}
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
              name={`cfMode-${projectId ?? 'x'}`}
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

          {cfMode === 'cpm' && cfData.cpm?.available && cpmAgeDays !== null &&
            (cpmAgeDays > 14 ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {t('analytics.cfCpmStale', {
                  revision: cfData.cpm.revision,
                  days: cpmAgeDays,
                  date: new Date(cfData.cpm.dataDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                })}
              </p>
            ) : (
              <p className="text-xs text-green-700">
                {t('analytics.cfCpmFresh', { days: cpmAgeDays })}
              </p>
            ))}

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
  );
}
