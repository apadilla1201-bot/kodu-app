'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/hooks/use-i18n';
import { Bell, FileQuestion, Receipt, FileStack, Loader2 } from 'lucide-react';

type NotifItem = {
  id: string;
  kind: 'rfi_overdue' | 'cor_pending' | 'submittal_review';
  ref: string;
  title: string;
  project: string;
  detail: string | null;
  href: string;
};

// Campana de "items que requieren atención" (derivados en vivo, sin tabla nueva):
// RFIs vencidos, CORs pendientes, Submittals por revisar.
// Se refresca al montar, al abrir el dropdown y cada 60s.
export function NotificationBell() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data?.items) ? data.items : []);
      }
    } catch {
      // silencioso: la campana nunca debe romper la app
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cerrar al hacer clic fuera o presionar ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((v) => {
      if (!v) load(); // refrescar al abrir
      return !v;
    });
  };

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const iconFor = (kind: NotifItem['kind']) => {
    if (kind === 'rfi_overdue') return <FileQuestion className="w-4 h-4 text-red-500 shrink-0" />;
    if (kind === 'cor_pending') return <Receipt className="w-4 h-4 text-[#C9A96E] shrink-0" />;
    return <FileStack className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  const labelFor = (kind: NotifItem['kind']) => {
    if (kind === 'rfi_overdue') return t('notifications.overdueRfi');
    if (kind === 'cor_pending') return t('notifications.pendingCor');
    return t('notifications.submittalReview');
  };

  const formatDetail = (item: NotifItem) => {
    if (!item.detail) return '';
    if (item.kind === 'rfi_overdue') {
      const d = new Date(item.detail);
      if (!isNaN(d.getTime())) {
        return `${t('notifications.due')} ${d.toLocaleDateString()}`;
      }
      return '';
    }
    return item.detail;
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        aria-label={t('notifications.title')}
        title={t('notifications.title')}
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {items.length > 15 ? '15+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold">{t('notifications.title')}</p>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {items.length === 0 && loaded && !loading && (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
              </div>
            )}

            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => go(item.href)}
                className="w-full text-left px-4 py-3 hover:bg-[#C9A96E]/10 transition-colors border-b border-border/50 last:border-0 flex gap-3"
              >
                <div className="pt-0.5">{iconFor(item.kind)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {labelFor(item.kind)}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{item.ref}</span>
                  </div>
                  <p className="text-sm font-medium truncate mt-0.5">{item.title}</p>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{item.project}</p>
                    <p className="text-xs text-muted-foreground shrink-0">{formatDetail(item)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-muted/30">
              <p className="text-[11px] text-muted-foreground text-center">
                {t('notifications.footer')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
