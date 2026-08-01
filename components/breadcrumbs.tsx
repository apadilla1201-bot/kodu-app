'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/hooks/use-i18n';
import { ChevronRight, Home } from 'lucide-react';

// Breadcrumbs derivados de la URL — sin configuración por página.
// Ej: /dashboard/rfis/abc123 → Dashboard / RFI Log / Detalle
// Los segmentos que parecen IDs (cuid/uuid/numéricos largos) se muestran
// como "Detalle" para no ensuciar la barra con identificadores internos.
export function Breadcrumbs() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (!pathname || pathname === '/dashboard') return null;

  const LABELS: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    projects: t('nav.projects'),
    rfis: t('nav.rfiLog'),
    submittals: t('nav.submittals'),
    buyout: t('nav.buyout'),
    'pay-apps': 'Pay Applications',
    budgets: 'Budgets',
    photos: t('nav.sitePhotos'),
    'daily-logs': t('nav.dailyLogs'),
    directory: t('nav.directory'),
    analytics: t('nav.analytics'),
    import: t('nav.importExcel'),
    team: 'Team',
    settings: t('nav.settings'),
  };

  const looksLikeId = (seg: string) =>
    seg.length > 16 || /^[0-9a-f-]{20,}$/i.test(seg) || /^\d+$/.test(seg);

  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const label = LABELS[seg] ?? (looksLikeId(seg) ? t('breadcrumbs.details') : seg);
    const isId = !(seg in LABELS);
    return { href, label, isLast: i === segments.length - 1, isId };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-4 flex-wrap">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('nav.dashboard')}</span>
      </Link>
      {crumbs.slice(1).map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 opacity-50" />
          {c.isLast || c.isId ? (
            <span className={c.isLast ? 'text-foreground font-medium' : ''}>{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:text-foreground transition-colors">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
