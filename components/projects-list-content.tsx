'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus, Search, FolderKanban, CheckCircle2, Clock,
  XCircle, DollarSign, MapPin, Calendar, ArrowRight, Pencil, Trash2,
} from 'lucide-react';

interface Project {
  id: string;
  projectNumber: string;
  projectName: string;
  client: string;
  location: string | null;
  contractAmount: number;
  startDate: string | null;
  totalCORs: number;
  approved: number;
  pending: number;
  rejected: number;
  totalApprovedAmount: number;
}

export function ProjectsListContent({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Project[]>(projects ?? []);
  const [deleting, setDeleting] = useState<string | null>(null);
  const safe = items ?? [];
  const filtered = safe.filter((p: any) =>
    (p?.projectName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p?.projectNumber ?? '').includes(search) ||
    (p?.client ?? '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(e: React.MouseEvent, p: Project) {
    e.preventDefault();
    e.stopPropagation();
    const label = p?.projectName ?? 'this project';
    if (!window.confirm(`Delete "${label}" and ALL its data (CORs, RFIs, pay apps)?\n\nThis cannot be undone.`)) return;
    setDeleting(p.id);
    try {
      const res = await fetch(`/api/projects/${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.code ? `${data?.error} (${data.code})` : data?.error ?? 'Failed to delete project');
      }
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to delete project');
    } finally {
      setDeleting(null);
    }
  }

  function handleEdit(e: React.MouseEvent, p: Project) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/dashboard/projects/${p.id}/edit`);
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your construction projects</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e: any) => setSearch(e?.target?.value ?? '')}
          placeholder="Search projects by name, number, or client..."
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50"
        />
      </div>

      {filtered?.length === 0 ? (
        <div className="bg-card rounded-lg p-12 text-center shadow-[var(--shadow-sm)]">
          <FolderKanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">{search ? 'No projects match your search' : 'No projects yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any, i: number) => (
            <motion.div
              key={p?.id ?? i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/dashboard/projects/${p?.id}`}>
                <div className="bg-card rounded-lg p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all group cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-mono text-[#C9A96E] font-medium">#{p?.projectNumber}</span>
                      <h3 className="font-semibold text-foreground group-hover:text-[#C9A96E] transition-colors mt-0.5">
                        {p?.projectName ?? 'Untitled'}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEdit(e, p)}
                        title="Edit project"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-[#C9A96E] hover:bg-muted transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, p)}
                        disabled={deleting === p.id}
                        title="Delete project"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#C9A96E] transition-colors" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{p?.client}</p>
                  {p?.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                      <MapPin className="w-3 h-3" /> {p?.location}
                    </p>
                  )}
                  <div className="border-t border-border pt-3 mt-3 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-[#2E7D32]"><CheckCircle2 className="w-3 h-3" /> {p?.approved ?? 0}</span>
                    <span className="flex items-center gap-1 text-[#92400E]"><Clock className="w-3 h-3" /> {p?.pending ?? 0}</span>
                    <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> {p?.rejected ?? 0}</span>
                    <span className="ml-auto font-mono text-muted-foreground">
                      ${(p?.totalApprovedAmount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
