'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Receipt, Plus, Calendar, DollarSign, ChevronRight, Search, Building2 } from 'lucide-react';

function fmt(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcTotal(lineItems: any[]) {
  return (lineItems ?? []).filter(li => !li.isSection).reduce((s: number, li: any) => {
    const revised = (li.scheduledValue || 0) + (li.budgetRealloc || 0) + (li.previousChanges || 0) + (li.currentChanges || 0);
    return s + revised;
  }, 0);
}

function calcCompleted(lineItems: any[]) {
  return (lineItems ?? []).filter(li => !li.isSection).reduce((s: number, li: any) => {
    return s + (li.previousCompleted || 0) + (li.thisCompleted || 0);
  }, 0);
}

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-[#FEF3C7] text-[#92400E]',
  Approved: 'bg-[#2E7D32]/10 text-[#2E7D32]',
};

export function PayAppListContent({ projects }: { projects: any[] }) {
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const filtered = projects.filter(p => {
    if (selectedProject !== 'all' && p.id !== selectedProject) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.projectName?.toLowerCase().includes(q) || p.projectNumber?.toLowerCase().includes(q);
    }
    return true;
  });

  const allPAs = filtered.flatMap(p =>
    (p.payApplications ?? []).map((pa: any) => ({ ...pa, project: p }))
  );

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Pay Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">AIA G702 & G703 — Contractor's Application for Payment</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar proyecto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
          />
        </div>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
        >
          <option value="all">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>#{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
      </div>

      {/* Pay Apps by Project */}
      {filtered.map(project => (
        <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="bg-[#0F1B33] text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#C9A96E]" />
                #{project.projectNumber} — {project.projectName}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{project.client} · {project.payApplications?.length ?? 0} Pay App(s)</p>
            </div>
            <Link
              href={`/dashboard/pay-apps/new?projectId=${project.id}`}
              className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Pay App
            </Link>
          </div>

          {(project.payApplications ?? []).length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-2 text-[#C9A96E]/30" />
              <p className="text-sm">No hay pay applications para este proyecto.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(project.payApplications ?? []).map((pa: any) => {
                const totalContract = calcTotal(pa.lineItems);
                const totalCompleted = calcCompleted(pa.lineItems);
                const pctComplete = totalContract > 0 ? (totalCompleted / totalContract * 100) : 0;
                const sc = statusColors[pa.status] ?? statusColors.Draft;
                return (
                  <Link key={pa.id} href={`/dashboard/pay-apps/${pa.id}`} className="flex items-center px-6 py-4 hover:bg-muted/30 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-display font-bold text-lg">PA #{pa.applicationNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc}`}>{pa.status}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(pa.applicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>Period: {new Date(pa.periodFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(pa.periodTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="text-right mr-4">
                      <p className="font-mono font-bold text-[#C9A96E]">{fmt(totalCompleted)}</p>
                      <p className="text-xs text-muted-foreground">de {fmt(totalContract)} ({pctComplete.toFixed(1)}%)</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[#C9A96E] transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      ))}

      {filtered.length === 0 && (
        <div className="bg-card rounded-lg p-12 text-center">
          <Receipt className="w-12 h-12 mx-auto mb-3 text-[#C9A96E]/30" />
          <p className="text-muted-foreground">No hay proyectos con pay applications.</p>
        </div>
      )}
    </div>
  );
}
