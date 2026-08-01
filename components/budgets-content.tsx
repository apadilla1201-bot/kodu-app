'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/hooks/use-i18n';
import { Receipt, Plus, Loader2, FolderOpen } from 'lucide-react';

type Budget = {
  id: string;
  version: string;
  budgetDate: string;
  grandTotal: number;
  subTotalAll: number;
  project?: { projectName: string; projectNumber: string } | null;
  _count?: { lineItems: number; detailItems: number };
};

const money = (n: number) =>
  `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Lista de Budgets (cross-project). La API GET /api/budgets ya existía —
// faltaba esta página (el menú apuntaba a una ruta sin página = 404).
export function BudgetsContent() {
  const { t } = useI18n();
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/budgets', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setBudgets(Array.isArray(data) ? data : []);
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#C9A96E]" />
            {t('budgets.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('budgets.subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/budgets/new')}
          className="flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('budgets.newBudget')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">{t('budgets.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('budgets.emptyHint')}</p>
          <button
            onClick={() => router.push('/dashboard/budgets/new')}
            className="mt-4 inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('budgets.newBudget')}
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_120px_140px_140px_110px] gap-3 px-4 py-3 border-b border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>{t('budgets.colProject')}</span>
            <span>{t('budgets.colVersion')}</span>
            <span>{t('budgets.colDate')}</span>
            <span className="text-right">{t('budgets.colGrandTotal')}</span>
            <span className="text-right">{t('budgets.colItems')}</span>
          </div>
          {budgets.map((b) => (
            <button
              key={b.id}
              onClick={() => router.push(`/dashboard/budgets/${b.id}`)}
              className="w-full text-left px-4 py-3.5 hover:bg-[#C9A96E]/10 transition-colors border-b border-border/50 last:border-0 grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_140px_110px] gap-1 sm:gap-3 items-center"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {b.project ? `${b.project.projectNumber} — ${b.project.projectName}` : '—'}
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">v{b.version}</span>
              <span className="text-xs text-muted-foreground">
                {b.budgetDate ? new Date(b.budgetDate).toLocaleDateString() : '—'}
              </span>
              <span className="text-sm font-mono font-bold text-[#C9A96E] sm:text-right">
                {money(b.grandTotal ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground sm:text-right">
                {b._count?.lineItems ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
