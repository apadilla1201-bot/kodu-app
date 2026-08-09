'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useI18n } from '@/hooks/use-i18n';
import { navForRole, ROLE_LABELS } from '@/lib/permissions';
import { GlobalSearch } from '@/components/global-search';
import { AssistantWidget } from '@/components/assistant-widget';
import { NotificationBell } from '@/components/notification-bell';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PlanBadge } from '@/components/plan-badge';
import type { AppLocale } from '@/lib/i18n';
import {
  LayoutDashboard,
  FolderKanban,
  FileQuestion,
  Receipt,
  FileStack,
  BarChart3,
  ClipboardList,
  Camera,
  NotebookPen,
  Users,
  Settings,
  Menu,
  LogOut,
  User,
  FileSpreadsheet,
  Languages,
  Wallet,
  UserPlus,
  Search,
  Inbox,
  BookOpen,
  FileSignature,
  ListChecks,
  ClipboardCheck,
  DraftingCompass,
} from 'lucide-react';

type BadgeMap = Record<string, number>;

// Badges de pendientes por ruta (vienen de /api/nav-badges)
const BADGE_BY_HREF: Record<string, keyof BadgeMap> = {
  '/dashboard/rfis': 'rfis',
  '/dashboard/submittals': 'submittals',
  '/dashboard/pay-apps': 'payApps',
  '/dashboard/lien-waivers': 'waivers',
  '/dashboard/punch-list': 'punch',
  '/dashboard/closeout': 'closeout',
  '/dashboard/approvals': 'cors',
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession() || {};
  // Logo de la compañía: subido por el admin en Settings; null = wordmark
  // koduPM (NUNCA PDG fijo — PDG solo aparece si ES la compañía del usuario).
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [badges, setBadges] = useState<BadgeMap>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/company/profile', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data?.logoUrl) setCompanyLogo(data.logoUrl);
        }
      } catch {
        // sin logo → wordmark koduPM
      }
    })();
  }, []);

  // Contadores de pendientes (al entrar y al cambiar de página)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/nav-badges', { credentials: 'include' });
        if (res.ok && alive) setBadges(await res.json());
      } catch {
        // sin badges no pasa nada
      }
    })();
    return () => { alive = false; };
  }, [pathname]);

  const { t, locale, setLocale } = useI18n();

  // PASO 3: menú filtrado por rol (Super no ve Pay Apps ni Budgets; owner/sub ven solo lo suyo)
  const userRole = (session?.user as any)?.role ?? 'viewer';
  const allowed = navForRole(userRole);

  // Menú agrupado por fase del proyecto (estructura familiar para quien viene de Procore)
  const navGroups: { key: string | null; label: string | null; items: { href: string; label: string; icon: any }[] }[] = [
    {
      key: null,
      label: null,
      items: [
        { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
      ],
    },
    {
      key: 'project',
      label: t('nav.groupProject'),
      items: [
        { href: '/dashboard/projects', label: t('nav.projects'), icon: FolderKanban },
        { href: '/dashboard/directory', label: t('nav.directory'), icon: Users },
        { href: '/dashboard/plans', label: t('nav.plans'), icon: DraftingCompass },
        { href: '/dashboard/daily-logs', label: t('nav.dailyLogs'), icon: NotebookPen },
        { href: '/dashboard/photos', label: t('nav.sitePhotos'), icon: Camera },
      ],
    },
    {
      key: 'controls',
      label: t('nav.groupControls'),
      items: [
        { href: '/dashboard/rfis', label: t('nav.rfiLog'), icon: FileQuestion },
        { href: '/dashboard/submittals', label: t('nav.submittals'), icon: FileStack },
        { href: '/dashboard/buyout', label: t('nav.buyout'), icon: ClipboardList },
      ],
    },
    {
      key: 'cost',
      label: t('nav.groupCost'),
      items: [
        { href: '/dashboard/budgets', label: 'Budgets', icon: Receipt },
        { href: '/dashboard/pay-apps', label: 'Pay Applications', icon: Wallet },
        { href: '/dashboard/lien-waivers', label: t('nav.lienWaivers'), icon: FileSignature },
      ],
    },
    {
      key: 'field',
      label: t('nav.groupField'),
      items: [
        { href: '/dashboard/punch-list', label: t('nav.punchList'), icon: ListChecks },
        { href: '/dashboard/closeout', label: t('nav.closeout'), icon: ClipboardCheck },
      ],
    },
    {
      key: 'admin',
      label: t('nav.groupAdmin'),
      items: [
        { href: '/dashboard/analytics', label: t('nav.analytics'), icon: BarChart3 },
        { href: '/dashboard/approvals', label: t('nav.approvals'), icon: Inbox },
        { href: '/dashboard/import', label: t('nav.importExcel'), icon: FileSpreadsheet },
        { href: '/dashboard/team', label: 'Team', icon: UserPlus },
        { href: '/dashboard/help', label: t('nav.help'), icon: BookOpen },
        { href: '/dashboard/settings', label: t('nav.settings'), icon: Settings },
      ],
    },
  ];

  // Aplicar el filtro de rol a cada grupo y descartar grupos vacíos
  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => allowed.includes(item.href)) }))
    .filter((g) => g.items.length > 0);

  const onLocaleChange = async (value: string) => {
    await setLocale(value as AppLocale);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0F1B33] transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="px-5 py-5 border-b border-white/10">
            <div className="relative w-[180px] h-[60px] mx-auto flex items-center justify-center">
              {companyLogo ? (
                <Image src={companyLogo} alt="Company logo" fill className="object-contain" unoptimized={companyLogo.startsWith('http')} />
              ) : (
                <div className="flex items-baseline select-none" aria-label="koduPM">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#C9A96E] text-[#0F1B33] font-black text-base mr-1.5 translate-y-[3px]">k</span>
                  <span className="text-2xl font-black text-white tracking-tight">kodu</span>
                  <span className="text-2xl font-black text-[#C9A96E] tracking-tight">PM</span>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            {visibleGroups.map((group, gi) => (
              <div key={group.key ?? 'root'} className={gi > 0 ? 'mt-5' : ''}>
                {group.label && (
                  <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40 select-none">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith?.(item.href));
                    const badgeKey = BADGE_BY_HREF[item.href];
                    const badge = badgeKey ? badges[badgeKey] ?? 0 : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors ${
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[#C9A96E]" />
                        )}
                        <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#C9A96E]' : ''}`} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge > 0 && (
                          <span className="text-[11px] font-semibold leading-none px-1.5 py-1 rounded bg-white/10 text-white/75 tabular-nums">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <PlanBadge />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#C9A96E]/20 flex items-center justify-center">
                <User className="w-4 h-4 text-[#C9A96E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{session?.user?.name ?? t('common.user')}</p>
                <p className="text-xs text-gray-400 truncate">{session?.user?.email ?? ''}</p>
                <p className="text-[10px] text-[#C9A96E] truncate">{ROLE_LABELS[userRole] ?? userRole}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('common.signOut')}</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden mr-1 p-1.5 rounded-lg hover:bg-muted"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="flex items-baseline select-none" aria-label="koduPM">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#0F1B33] text-[#C9A96E] font-bold text-sm mr-1.5 translate-y-[3px]">k</span>
              <span className="text-lg font-bold text-[#0F1B33] tracking-tight">kodu</span>
              <span className="text-lg font-bold text-[#C9A96E] tracking-tight">PM</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-[#C9A96E]/60 hover:text-foreground transition-colors"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('search.trigger')}</span>
              <kbd className="px-1 py-0.5 rounded border border-border text-[10px]">Ctrl K</kbd>
            </button>
            <NotificationBell />
            <Languages className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <select
              value={locale}
              onChange={(e) => onLocaleChange(e.target.value)}
              className="text-xs sm:text-sm px-2 py-1 border border-border rounded-lg bg-background"
              aria-label={t('settings.language')}
            >
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <style>{`@keyframes koduFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <Breadcrumbs />
          <div key={pathname ?? 'page'} style={{ animation: 'koduFadeIn 180ms ease-out' }}>
            {children}
          </div>
        </main>
        <GlobalSearch />
        <AssistantWidget />
      </div>
    </div>
  );
}
