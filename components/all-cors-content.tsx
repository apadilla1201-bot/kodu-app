'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, FileText, Plus, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface COR {
  id: string;
  corNumber: string;
  date: string;
  description: string;
  subcontractor: string | null;
  status: string;
  totalAmount: number;
}

interface ProjectWithCors {
  id: string;
  projectNumber: string;
  projectName: string;
  changeOrders: COR[];
}

const statusStyles: Record<string, string> = {
  Pending: 'bg-[#FEF3C7] text-[#92400E]',
  Approved: 'bg-[#2E7D32]/10 text-[#2E7D32]',
  Rejected: 'bg-red-50 text-[#92400E]',
};

export function AllCorsContent({ projects }: { projects: ProjectWithCors[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');

  const allCors = useMemo(() => {
    const items: (COR & { projectName: string; projectId: string })[] = [];
    (projects ?? []).forEach((p: any) => {
      (p?.changeOrders ?? []).forEach((co: any) => {
        items.push({ ...(co ?? {}), projectName: p?.projectName ?? '', projectId: p?.id ?? '' });
      });
    });
    return items;
  }, [projects]);

  const filtered = useMemo(() => {
    return allCors.filter((co: any) => {
      const matchSearch = (co?.corNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (co?.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (co?.subcontractor ?? '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || co?.status === statusFilter;
      const matchProject = projectFilter === 'All' || co?.projectId === projectFilter;
      return matchSearch && matchStatus && matchProject;
    });
  }, [allCors, search, statusFilter, projectFilter]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">All Change Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage CORs across all projects</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" value={search}
            onChange={(e: any) => setSearch(e?.target?.value ?? '')}
            placeholder="Search CORs..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e: any) => setProjectFilter(e?.target?.value ?? 'All')}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50"
        >
          <option value="All">All Projects</option>
          {(projects ?? []).map((p: any) => (
            <option key={p?.id} value={p?.id}>{p?.projectName} (#{p?.projectNumber})</option>
          ))}
        </select>
        <div className="flex gap-1 bg-card border border-border rounded-lg p-0.5">
          {['All', 'Pending', 'Approved', 'Rejected'].map((s: string) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-[#C9A96E] text-white' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#C9A96E]/10">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">CO #</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Project</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered?.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />No change orders found
                </td></tr>
              ) : (
                filtered.map((co: any, i: number) => (
                  <motion.tr key={co?.id ?? i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/cors/${co?.id}`} className="font-mono text-[#C9A96E] hover:underline font-medium">{co?.corNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{co?.projectName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${statusStyles?.[co?.status] ?? statusStyles.Pending}`}>{co?.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{co?.date ? new Date(co.date).toLocaleDateString('en-US') : '—'}</td>
                    <td className="px-4 py-3 max-w-[250px] truncate">{co?.description}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">${(co?.totalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
