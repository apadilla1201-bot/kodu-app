'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  FileText,
  FileQuestion,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

interface ProjectSummary {
  id: string;
  projectNumber: string;
  projectName: string;
  client: string;
  location: string | null;
  contractAmount: number;
  totalCORs: number;
  approved: number;
  pending: number;
  rejected: number;
  totalApprovedAmount: number;
  totalPendingAmount: number;
  totalRFIs: number;
  openRFIs: number;
  overdueRFIs: number;
  totalPayApps: number;
}

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const target = value ?? 0;
    const duration = 1000;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplay(Math.floor(target * progress));
      if (progress < 1) requestAnimationFrame(animate);
      else setDisplay(target);
    };
    requestAnimationFrame(animate);
  }, [value]);

  const formatted = prefix === '$'
    ? `$${(display ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `${display ?? 0}`;

  return <span ref={ref} className="font-mono">{formatted}</span>;
}

export function DashboardContent({ projects }: { projects: ProjectSummary[] }) {
  const { t } = useI18n();
  const safeProjects = projects ?? [];
  const totalCORs = safeProjects.reduce((s: number, p: any) => s + (p?.totalCORs ?? 0), 0);
  const totalApproved = safeProjects.reduce((s: number, p: any) => s + (p?.totalApprovedAmount ?? 0), 0);
  const totalPending = safeProjects.reduce((s: number, p: any) => s + (p?.totalPendingAmount ?? 0), 0);
  const totalPendingCount = safeProjects.reduce((s: number, p: any) => s + (p?.pending ?? 0), 0);

  const totalRFIs = safeProjects.reduce((s: number, p: any) => s + (p?.totalRFIs ?? 0), 0);
  const openRFIs = safeProjects.reduce((s: number, p: any) => s + (p?.openRFIs ?? 0), 0);
  const overdueRFIs = safeProjects.reduce((s: number, p: any) => s + (p?.overdueRFIs ?? 0), 0);
  const totalPayApps = safeProjects.reduce((s: number, p: any) => s + (p?.totalPayApps ?? 0), 0);

  const stats = [
    { label: t('dashboard.totalProjects'), value: safeProjects?.length ?? 0, icon: FolderKanban, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/10' },
    { label: t('dashboard.totalCORs'), value: totalCORs, icon: FileText, color: 'text-[#1B2A4A]', bg: 'bg-[#1B2A4A]/10' },
    { label: t('dashboard.approvedValue'), value: totalApproved, icon: CheckCircle2, color: 'text-[#2E7D32]', bg: 'bg-[#2E7D32]/10', prefix: '$' },
    { label: t('dashboard.openRFIs'), value: openRFIs, icon: FileQuestion, color: 'text-blue-600', bg: 'bg-blue-100', overdue: overdueRFIs },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('dashboard.newProject')}
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(stats ?? []).map((stat: any, i: number) => {
          const Icon = stat?.icon;
          return (
            <motion.div
              key={stat?.label ?? i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-lg p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg ${stat?.bg ?? ''} flex items-center justify-center`}>
                  {Icon && <Icon className={`w-5 h-5 ${stat?.color ?? ''}`} />}
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat?.label}</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                <AnimatedNumber value={stat?.value ?? 0} prefix={stat?.prefix ?? ''} />
              </div>
              {(stat?.overdue ?? 0) > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  {t('dashboard.overdueNote', { count: stat.overdue })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Projects List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold text-foreground">{t('dashboard.projects')}</h2>
          <Link href="/dashboard/projects" className="text-sm text-[#C9A96E] hover:underline flex items-center gap-1">
            {t('dashboard.viewAll')} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {safeProjects?.length === 0 ? (
          <div className="bg-card rounded-lg p-12 text-center shadow-[var(--shadow-sm)]">
            <FolderKanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">{t('dashboard.emptyTitle')}</p>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('dashboard.newProject')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {safeProjects.map((project: any, i: number) => (
              <motion.div
                key={project?.id ?? i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
              >
                <Link href={`/dashboard/projects/${project?.id}`}>
                  <div className="bg-card rounded-lg p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all group cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-[#C9A96E] transition-colors">
                          {project?.projectName ?? 'Untitled'}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono">#{project?.projectNumber ?? ''}</p>
                      </div>
                      <div className="flex gap-1.5">
                      <span className="text-xs bg-[#C9A96E]/10 text-[#C9A96E] px-2 py-1 rounded font-medium">
                        {project?.totalCORs ?? 0} CORs
                      </span>
                      {(project?.totalRFIs ?? 0) > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                          {project.totalRFIs} RFIs
                        </span>
                      )}
                      {(project?.overdueRFIs ?? 0) > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-semibold flex items-center gap-1" title={t('dashboard.overdueRfiTitle')}>
                          <AlertTriangle className="w-3 h-3" />
                          {project.overdueRFIs} {t('dashboard.overdue')}
                        </span>
                      )}
                      {(project?.totalPayApps ?? 0) > 0 && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">
                          {project.totalPayApps} PAs
                        </span>
                      )}
                    </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{project?.client ?? ''}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-[#2E7D32]" title={t('dashboard.approvedCorTitle')}>
                        <CheckCircle2 className="w-3 h-3" /> {project?.approved ?? 0} {t('dashboard.approvedLabel')}
                      </span>
                      <span className="flex items-center gap-1 text-[#92400E]" title={t('dashboard.pendingCorTitle')}>
                        <Clock className="w-3 h-3" /> {project?.pending ?? 0} {t('dashboard.pendingLabel')}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground ml-auto" title={t('dashboard.approvedValueTitle')}>
                        <DollarSign className="w-3 h-3" />
                        {(project?.totalApprovedAmount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
