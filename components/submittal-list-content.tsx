'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useI18n } from '@/hooks/use-i18n';
import { Search, Plus, FileStack, ChevronRight } from 'lucide-react';

interface SubmittalItem {
  id: string;
  submittalNumber: string;
  title: string;
  status: string;
  priority: string;
  submittalType: string;
  subcontractor: string | null;
  requiredDate: string | null;
  projectName: string;
  projectNumber: string;
}

interface ProjectInfo {
  id: string;
  projectNumber: string;
  projectName: string;
}

const statusStyles: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  'Revise and Resubmit': 'bg-orange-100 text-orange-700',
  Rejected: 'bg-red-100 text-red-700',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export function SubmittalListContent({
  submittals,
  projects,
}: {
  submittals: SubmittalItem[];
  projects: ProjectInfo[];
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');

  const filtered = useMemo(() => {
    return (submittals ?? []).filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        s.submittalNumber.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        (s.subcontractor ?? '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || s.status === statusFilter;
      const matchProject = projectFilter === 'All' || s.projectNumber === projectFilter;
      return matchSearch && matchStatus && matchProject;
    });
  }, [submittals, search, statusFilter, projectFilter]);

  const stats = useMemo(() => {
    const all = submittals ?? [];
    return {
      total: all.length,
      draft: all.filter((s) => s.status === 'Draft').length,
      review: all.filter((s) => s.status === 'Under Review' || s.status === 'Submitted').length,
      approved: all.filter((s) => s.status === 'Approved').length,
      resubmit: all.filter((s) => s.status === 'Revise and Resubmit').length,
      overdue: all.filter((s) => {
        if (!s.requiredDate || s.status === 'Approved') return false;
        return new Date(s.requiredDate) < new Date();
      }).length,
    };
  }, [submittals]);

  const tableHeaders = [
    t('submittals.colNumber'),
    t('submittals.colTitle'),
    t('submittals.colType'),
    t('submittals.colPriority'),
    t('submittals.colStatus'),
    t('submittals.colRequired'),
    '',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('submittals.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('submittals.subtitle')}
          </p>
        </div>
        <Link
          href="/dashboard/submittals/new"
          className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8944F] text-white px-5 py-2.5 rounded-lg font-semibold transition-colors shadow-md"
        >
          <Plus className="w-4 h-4" />
          {t('submittals.newSubmittal')}
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('submittals.statTotal'), value: stats.total, border: 'border-[#C9A96E]' },
          { label: t('submittals.statDraft'), value: stats.draft, border: 'border-gray-400' },
          { label: t('submittals.inReview'), value: stats.review, border: 'border-amber-500' },
          { label: t('submittals.statApproved'), value: stats.approved, border: 'border-green-500' },
          { label: t('submittals.resubmit'), value: stats.resubmit, border: 'border-orange-500' },
          { label: t('submittals.statOverdue'), value: stats.overdue, border: 'border-red-500' },
        ].map((c) => (
          <div key={c.label} className={`bg-card border-l-4 ${c.border} rounded-lg p-4 shadow-sm`}>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('submittals.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg bg-background text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border rounded-lg bg-background text-sm"
        >
          <option value="All">{t('submittals.allStatuses')}</option>
          {['Draft', 'Submitted', 'Under Review', 'Approved', 'Revise and Resubmit', 'Rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2.5 border rounded-lg bg-background text-sm"
        >
          <option value="All">{t('submittals.allProjects')}</option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.projectNumber}>#{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {tableHeaders.map((h) => (
                <th key={h || 'actions'} className="text-left px-4 py-3 font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <FileStack className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  {t('submittals.empty')}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{s.submittalNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground">#{s.projectNumber} — {s.projectName}</div>
                  </td>
                  <td className="px-4 py-3">{s.submittalType}</td>
                  <td className="px-4 py-3">{s.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[s.status] ?? 'bg-gray-100'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{fmtDate(s.requiredDate)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/submittals/${s.id}`} className="text-[#C9A96E] hover:underline inline-flex items-center gap-1">
                      {t('submittals.view')} <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
