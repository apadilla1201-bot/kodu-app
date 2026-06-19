'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Search, Plus, FileQuestion, Clock, CheckCircle2, AlertTriangle,
  MessageSquare, Filter, ChevronRight,
} from 'lucide-react';

interface RFIItem {
  id: string;
  rfiNumber: string;
  subject: string;
  status: string;
  priority: string;
  submittedBy: string;
  assignedTo: string;
  dateSubmitted: string;
  dateDue: string | null;
  projectName: string;
  projectNumber: string;
  costImpact: string;
  scheduleImpact: string;
}

interface ProjectInfo {
  id: string;
  projectNumber: string;
  projectName: string;
}

const statusConfig: Record<string, { color: string; bg: string; icon: any }> = {
  Open: { color: 'text-blue-700', bg: 'bg-blue-100', icon: FileQuestion },
  'Under Review': { color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
  Answered: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
  Closed: { color: 'text-gray-500', bg: 'bg-gray-100', icon: CheckCircle2 },
};

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Urgent: { color: 'text-red-700', bg: 'bg-red-100' },
  High: { color: 'text-orange-700', bg: 'bg-orange-100' },
  Normal: { color: 'text-blue-700', bg: 'bg-blue-100' },
  Low: { color: 'text-gray-600', bg: 'bg-gray-100' },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function isOverdue(dateDue: string | null, status: string): boolean {
  if (!dateDue || status === 'Answered' || status === 'Closed') return false;
  return new Date(dateDue) < new Date();
}

type SortField = 'rfiNumber' | 'dateSubmitted' | 'dateDue' | 'status' | 'priority' | 'daysOpen';
type SortDir = 'asc' | 'desc';

const priorityOrder: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const statusOrder: Record<string, number> = { Open: 0, 'Under Review': 1, Answered: 2, Closed: 3 };

function daysOpen(dateSubmitted: string): number {
  return Math.floor((Date.now() - new Date(dateSubmitted).getTime()) / 86400000);
}

export function RFIListContent({ rfis, projects }: { rfis: RFIItem[]; projects: ProjectInfo[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('dateSubmitted');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    const list = (rfis ?? []).filter((r: RFIItem) => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        r.rfiNumber?.toLowerCase().includes(q) ||
        r.subject?.toLowerCase().includes(q) ||
        r.assignedTo?.toLowerCase().includes(q) ||
        r.submittedBy?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchesProject = projectFilter === 'All' || r.projectNumber === projectFilter;
      return matchesSearch && matchesStatus && matchesProject;
    });
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'rfiNumber': cmp = (a.rfiNumber ?? '').localeCompare(b.rfiNumber ?? '', undefined, { numeric: true }); break;
        case 'dateSubmitted': cmp = new Date(a.dateSubmitted).getTime() - new Date(b.dateSubmitted).getTime(); break;
        case 'dateDue': {
          const da = a.dateDue ? new Date(a.dateDue).getTime() : Infinity;
          const db = b.dateDue ? new Date(b.dateDue).getTime() : Infinity;
          cmp = da - db; break;
        }
        case 'status': cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9); break;
        case 'priority': cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9); break;
        case 'daysOpen': cmp = daysOpen(a.dateSubmitted) - daysOpen(b.dateSubmitted); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rfis, search, statusFilter, projectFilter, sortField, sortDir]);

  const stats = useMemo(() => {
    const all = rfis ?? [];
    return {
      total: all.length,
      open: all.filter((r: RFIItem) => r.status === 'Open').length,
      underReview: all.filter((r: RFIItem) => r.status === 'Under Review').length,
      answered: all.filter((r: RFIItem) => r.status === 'Answered').length,
      closed: all.filter((r: RFIItem) => r.status === 'Closed').length,
      overdue: all.filter((r: RFIItem) => isOverdue(r.dateDue, r.status)).length,
    };
  }, [rfis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Requests for Information</h1>
          <p className="text-muted-foreground mt-1">Track and manage all project RFIs</p>
        </div>
        <Link
          href="/dashboard/rfis/new"
          className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8944F] text-white px-5 py-2.5 rounded-lg font-semibold transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          New RFI
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'border-[#C9A96E]', textColor: 'text-[#C9A96E]' },
          { label: 'Open', value: stats.open, color: 'border-blue-500', textColor: 'text-blue-600' },
          { label: 'Under Review', value: stats.underReview, color: 'border-amber-500', textColor: 'text-amber-600' },
          { label: 'Answered', value: stats.answered, color: 'border-green-500', textColor: 'text-green-600' },
          { label: 'Closed', value: stats.closed, color: 'border-gray-400', textColor: 'text-gray-500' },
          { label: 'Overdue', value: stats.overdue, color: 'border-red-500', textColor: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className={`bg-card rounded-xl p-4 border-l-4 ${s.color} shadow-sm`}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.textColor}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search RFIs by number, subject, assigned to..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Under Review">Under Review</option>
          <option value="Answered">Answered</option>
          <option value="Closed">Closed</option>
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40"
        >
          <option value="All">All Projects</option>
          {(projects ?? []).map((p: ProjectInfo) => (
            <option key={p.id} value={p.projectNumber}>#{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0F1B33] text-white">
                <th onClick={() => toggleSort('rfiNumber')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-[#1B2A4A] select-none">RFI # {sortField === 'rfiNumber' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="px-4 py-3 text-left font-semibold">Subject</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Project</th>
                <th onClick={() => toggleSort('priority')} className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-[#1B2A4A] select-none">Priority {sortField === 'priority' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => toggleSort('status')} className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-[#1B2A4A] select-none">Status {sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Assigned To</th>
                <th onClick={() => toggleSort('dateDue')} className="px-4 py-3 text-center font-semibold hidden lg:table-cell cursor-pointer hover:bg-[#1B2A4A] select-none">Due Date {sortField === 'dateDue' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => toggleSort('daysOpen')} className="px-4 py-3 text-center font-semibold hidden lg:table-cell cursor-pointer hover:bg-[#1B2A4A] select-none">Days {sortField === 'daysOpen' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                <th className="px-4 py-3 text-center font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <FileQuestion className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No RFIs found</p>
                    <p className="text-sm mt-1">Create a new RFI to get started</p>
                  </td>
                </tr>
              ) : (
                filtered.map((rfi: RFIItem, i: number) => {
                  const sc = statusConfig[rfi.status] ?? statusConfig.Open;
                  const pc = priorityConfig[rfi.priority] ?? priorityConfig.Normal;
                  const overdue = isOverdue(rfi.dateDue, rfi.status);
                  const StatusIcon = sc.icon;

                  return (
                    <motion.tr
                      key={rfi.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/rfis/${rfi.id}`} className="font-mono font-semibold text-[#C9A96E] hover:underline">
                          RFI {rfi.rfiNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/rfis/${rfi.id}`} className="hover:text-[#C9A96E] transition-colors">
                          <span className="line-clamp-1">{rfi.subject}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        #{rfi.projectNumber}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${pc.bg} ${pc.color}`}>
                          {rfi.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {rfi.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {rfi.assignedTo || '—'}
                      </td>
                      <td className={`px-4 py-3 text-center hidden lg:table-cell text-xs font-medium ${overdue ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                        {overdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                        {fmtDate(rfi.dateDue)}
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {(() => {
                          const days = daysOpen(rfi.dateSubmitted);
                          const resolved = rfi.status === 'Answered' || rfi.status === 'Closed';
                          return (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              resolved ? 'bg-green-50 text-green-700' :
                              overdue ? 'bg-red-50 text-red-700' :
                              days > 5 ? 'bg-amber-50 text-amber-700' :
                              'bg-gray-50 text-gray-600'
                            }`}>
                              {days}d
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/dashboard/rfis/${rfi.id}`}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground hover:text-[#C9A96E]" />
                        </Link>
                      </td>
                    </motion.tr>
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
