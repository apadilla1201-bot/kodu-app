'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useI18n } from '@/hooks/use-i18n';
import { navForRole, ROLE_LABELS } from '@/lib/permissions';
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
  ChevronRight,
  User,
  FileSpreadsheet,
  Languages,
  Wallet,
  UserPlus,
} from 'lucide-react';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession() || {};
  const { t, locale, setLocale } = useI18n();

  // PASO 3: menú filtrado por rol (Super no ve Pay Apps ni Budgets; owner/sub ven solo lo suyo)
  const userRole = (session?.user as any)?.role ?? 'viewer';
  const allowed = navForRole(userRole);

  const allNavItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/dashboard/projects', label: t('nav.projects'), icon: FolderKanban },
    { href: '/dashboard/rfis', label: t('nav.rfiLog'), icon: FileQuestion },
    { href: '/dashboard/submittals', label: t('nav.submittals'), icon: FileStack },
    { href: '/dashboard/buyout', label: t('nav.buyout'), icon: ClipboardList },
    { href: '/dashboard/pay-apps', label: 'Pay Applications', icon: Wallet },
    { href: '/dashboard/budgets', label: 'Budgets', icon: Receipt },
    { href: '/dashboard/photos', label: t('nav.sitePhotos'), icon: Camera },
    { href: '/dashboard/daily-logs', label: t('nav.dailyLogs'), icon: NotebookPen },
    { href: '/dashboard/directory', label: t('nav.directory'), icon: Users },
    { href: '/dashboard/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { href: '/dashboard/import', label: t('nav.importExcel'), icon: FileSpreadsheet },
    { href: '/dashboard/team', label: 'Team', icon: UserPlus },
    { href: '/dashboard/settings', label: t('nav.settings'), icon: Settings },
  ];

  const navItems = allNavItems.filter((item) => allowed.includes(item.href));

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
          <div className="p-5 border-b border-white/10">
            <div className="relative w-[180px] h-[60px] mx-auto">
              <Image src="/pdg_logo.png" alt="PDG Logo" fill className="object-contain" />
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith?.(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#C9A96E]/20 text-[#C9A96E]'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
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
          {children}
        </main>
      </div>
    </div>
  );
}
