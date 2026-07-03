'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  BarChart3, DollarSign, FileQuestion, FileStack, Receipt, TrendingUp, RefreshCw,
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [corByProject, setCorByProject] = useState<any[]>([]);
  const [activityByProject, setActivityByProject] = useState<any[]>([]);

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
    return <p className="text-center py-24 text-muted-foreground">No se pudieron cargar los datos.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#C9A96E]" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Resumen de todos los proyectos activos</p>
        </div>
        <button onClick={load} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Proyectos" value={String(summary.totalProjects)} icon={TrendingUp} />
        <Kpi label="Valor contrato" value={fmtMoney(summary.totalContractValue)} icon={DollarSign} />
        <Kpi label="COs aprobados" value={fmtMoney(summary.approvedCOAmount)} icon={Receipt} sub={`${summary.pendingCOAmount > 0 ? fmtMoney(summary.pendingCOAmount) + ' pendientes' : 'Sin pendientes'}`} />
        <Kpi label="Facturado" value={fmtMoney(summary.totalBilled)} icon={DollarSign} sub={`${summary.totalPayApps} pay apps`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="RFIs abiertos" value={String(summary.openRFIs)} icon={FileQuestion} sub={`${summary.totalRFIs} total`} />
        <Kpi label="Submittals abiertos" value={String(summary.openSubmittals)} icon={FileStack} sub={`${summary.totalSubmittals} total`} />
        <Kpi label="Change Orders" value={String(summary.totalCOs)} icon={Receipt} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Change Orders por proyecto</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={corByProject}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="approved" name="Aprobados" fill="#2E7D32" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" name="Pendientes" fill="#C9A96E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Actividad abierta por proyecto</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activityByProject}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="rfis" name="RFIs abiertos" fill="#0F1B33" radius={[4, 4, 0, 0]} />
              <Bar dataKey="submittals" name="Submittals abiertos" fill="#C9A96E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Detalle por proyecto</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Proyecto</th>
                <th className="px-4 py-3 text-right">Contrato</th>
                <th className="px-4 py-3 text-right">COs</th>
                <th className="px-4 py-3 text-right">RFIs</th>
                <th className="px-4 py-3 text-right">Pay Apps</th>
                <th className="px-4 py-3 text-right">Facturado</th>
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
                    {p.pendingCOs > 0 && <span className="text-amber-600"> / {p.pendingCOs} pend.</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.openRFIs > 0 ? <span className="text-amber-600 font-semibold">{p.openRFIs} abiertos</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{p.totalPayApps}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.totalBilled > 0 ? fmtMoney(p.totalBilled) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {p.openSubmittals > 0 ? <span className="text-blue-600">{p.openSubmittals} abiertos</span> : p.totalSubmittals || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Para earned value y cashflow detallado, abre el tab Analytics dentro de cada proyecto.
      </p>
    </div>
  );
}
