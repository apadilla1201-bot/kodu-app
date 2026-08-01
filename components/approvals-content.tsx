'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/hooks/use-i18n';
import {
  Receipt, FileQuestion, FileStack, Loader2, Inbox, RefreshCw,
} from 'lucide-react';

type ApprovalItem = {
  id: string;
  ref: string;
  title: string;
  subtitle: string;
  amount?: number;
  priority?: string;
  date: string | null;
  projectId: string;
  project: string;
  href: string;
};

type Data = {
  cors: ApprovalItem[];
  rfis: ApprovalItem[];
  submittals: ApprovalItem[];
  counts: { cors: number; rfis: number; submittals: number; total: number };
  pendingCorAmount: number;
};

const EMPTY: Data = {
  cors: [], rfis: [], submittals: [],
  counts: { cors: 0, rfis: 0, submittals: 0, total: 0 },
  pendingCorAmount: 0,
};

type Tab = 'all' | 'cors' | 'rfis' | 'submittals';

const money = (n: number) =>
  `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Approval Inbox — todo lo que espera una decisión, cruzando todos los proyectos.
export function ApprovalsContent() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/approvals', { cache: 'no-store' });
      if (res.ok) setData({ ...EMPTY, ...(await res.json()) });
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const daysSince = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
    return days === 0 ? t('approvals.today') : t('approvals.daysAgo', { n: days });
  };

  const dueLabel = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${t('approvals.due')} ${d.toLocaleDateString()}`;
  };

  const cards = [
    {
      key: 'cors' as Tab,
      icon: Receipt,
      iconClass: 'text-[#C9A96E]',
      label: t('approvals.pendingCors'),
      big: String(data.counts.cors),
      sub: `${money(data.pendingCorAmount)} ${t('approvals.waitingApproval')}`,
    },
    {
      key: 'rfis' as Tab,
      icon: FileQuestion,
      iconClass: 'text-red-500',
      label: t('approvals.overdueRfis'),
      big: String(data.counts.rfis),
      sub: t('approvals.pastDueDate'),
    },
    {
      key: 'submittals' as Tab,
      icon: FileStack,
      iconClass: 'text-blue-500',
      label: t('approvals.submittalsToReview'),
      big: String(data.counts.submittals),
      sub: t('approvals.waitingReview'),
    },
  ];

  const groups: { key: Tab; title: string; icon: any; iconClass: string; items: ApprovalItem[]; render: (it: ApprovalItem) => string }[] = [
    {
      key: 'cors', title: t('approvals.pendingCors'), icon: Receipt, iconClass: 'text-[#C9A96E]',
      items: data.cors,
      render: (it) => [money(it.amount ?? 0), daysSince(it.date)].filter(Boolean).join(' · '),
    },
    {
      key: 'rfis', title: t('approvals.overdueRfis'), icon: FileQuestion, iconClass: 'text-red-500',
      items: data.rfis,
      render: (it) => [it.priority, dueLabel(it.date)].filter(Boolean).join(' · '),
    },
    {
      key: 'submittals', title: t('approvals.submittalsToReview'), icon: FileStack, iconClass: 'text-blue-500',
      items: data.submittals,
      render: (it) => [it.subtitle, dueLabel(it.date)].filter(Boolean).join(' · '),
    },
  ];

  const visible = groups.filter((g) => tab === 'all' || g.key === tab);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: t('search.all'), count: data.counts.total },
    { key: 'cors', label: 'CORs', count: data.counts.cors },
    { key: 'rfis', label: 'RFIs', count: data.counts.rfis },
    { key: 'submittals', label: 'Submittals', count: data.counts.submittals },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('approvals.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('approvals.subtitle')}</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:border-[#C9A96E]/60 hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('approvals.refresh')}
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
              className="bg-card border border-border rounded-xl p-5 text-left hover:border-[#C9A96E]/60 transition-colors min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${c.iconClass}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  {c.label}
                </p>
              </div>
              <p className="text-3xl font-bold">{c.big}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{c.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === tb.key
                ? 'border-[#C9A96E] text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tb.label}
            <span className="ml-1.5 text-xs text-muted-foreground">({tb.count})</span>
          </button>
        ))}
      </div>

      {/* Listas */}
      {loading && data.counts.total === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.counts.total === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">{t('approvals.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('approvals.emptyHint')}</p>
        </div>
      ) : (
        visible.map((g) => {
          if (g.items.length === 0) return null;
          const Icon = g.icon;
          return (
            <div key={g.key} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Icon className={`w-4 h-4 ${g.iconClass}`} />
                <p className="text-sm font-semibold">{g.title}</p>
                <span className="text-xs text-muted-foreground">({g.items.length})</span>
              </div>
              <div>
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => router.push(it.href)}
                    className="w-full text-left px-4 py-3 hover:bg-[#C9A96E]/10 transition-colors border-b border-border/50 last:border-0 flex items-center gap-3"
                  >
                    <span className="text-xs font-mono font-bold text-[#0F1B33] bg-[#C9A96E]/15 px-2 py-1 rounded shrink-0">
                      {it.ref}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{it.project}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 max-w-[40%] truncate text-right">
                      {g.render(it)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
