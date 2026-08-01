'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/hooks/use-i18n';
import {
  Search, FolderKanban, FileQuestion, Receipt, FileStack, Users, Loader2,
} from 'lucide-react';

type Results = {
  projects: any[];
  rfis: any[];
  cors: any[];
  submittals: any[];
  contacts: any[];
};

const EMPTY: Results = { projects: [], rfis: [], cors: [], submittals: [], contacts: [] };

// Item aplanado para navegación por teclado
type FlatItem = { href: string; key: string };

export function GlobalSearch() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | keyof Results>('all');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Abrir con Ctrl+K / Cmd+K; cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ(''); setResults(EMPTY); setTab('all'); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Búsqueda con debounce
  useEffect(() => {
    if (q.trim().length < 2) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' });
        if (res.ok) setResults(await res.json());
      } catch { /* silencio */ } finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  // Construir grupos visibles según tab + lista plana para teclado
  const groups: { type: keyof Results; label: string; icon: any; items: { item: any; href: string; primary: string; secondary: string; badge?: string }[] }[] = [];

  const push = (
    type: keyof Results, label: string, icon: any,
    arr: any[], map: (x: any) => { href: string; primary: string; secondary: string; badge?: string },
  ) => {
    if (tab !== 'all' && tab !== type) return;
    const items = arr.map((x) => ({ item: x, ...map(x) }));
    if (items.length) groups.push({ type, label, icon, items });
  };

  push('projects', t('search.projects'), FolderKanban, results.projects, (p) => ({
    href: `/dashboard/projects/${p.id}`,
    primary: `${p.projectNumber} · ${p.projectName}`,
    secondary: p.client ?? '',
  }));
  push('rfis', t('search.rfis'), FileQuestion, results.rfis, (r) => ({
    href: `/dashboard/rfis/${r.id}`,
    primary: `RFI ${r.rfiNumber} — ${r.subject}`,
    secondary: r.project ? `${r.project.projectNumber} · ${r.project.projectName}` : '',
    badge: r.status,
  }));
  push('cors', t('search.cors'), Receipt, results.cors, (c) => ({
    href: `/dashboard/cors/${c.id}`,
    primary: `COR ${c.corNumber} — ${c.description}`,
    secondary: c.project ? `${c.project.projectNumber} · ${c.project.projectName}` : '',
    badge: c.status,
  }));
  push('submittals', t('search.submittals'), FileStack, results.submittals, (s) => ({
    href: `/dashboard/submittals/${s.id}`,
    primary: `${s.submittalNumber} — ${s.title}`,
    secondary: s.project ? `${s.project.projectNumber} · ${s.project.projectName}` : '',
    badge: s.status,
  }));
  push('contacts', t('search.contacts'), Users, results.contacts, (c) => ({
    href: '/dashboard/directory',
    primary: c.name,
    secondary: `${c.role}${c.company ? ' · ' + c.company : ''}${c.project ? ' · ' + c.project.projectName : ''}`,
  }));

  const flat: FlatItem[] = groups.flatMap((g) => g.items.map((it) => ({ href: it.href, key: it.href + it.primary })));

  useEffect(() => { setActive(0); }, [q, tab, results]);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const onNavKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); go(flat[active].href); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const TABS: { key: 'all' | keyof Results; label: string }[] = [
    { key: 'all', label: t('search.all') },
    { key: 'projects', label: t('search.projects') },
    { key: 'rfis', label: t('search.rfis') },
    { key: 'cors', label: t('search.cors') },
    { key: 'submittals', label: t('search.submittals') },
    { key: 'contacts', label: t('search.contacts') },
  ];

  let runningIdx = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onKeyDown={onNavKey}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#C9A96E]" /> : <Search className="w-4 h-4 text-muted-foreground" />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 py-3.5 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">ESC</kbd>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                tab === tb.key ? 'bg-[#0F1B33] text-[#C9A96E]' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <p className="mb-2">{t('search.hint')}</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {['PRJ', 'RFI 176', 'COR-0', 'submittal'].map((chip) => (
                  <button key={chip} onClick={() => setQ(chip)} className="px-2 py-0.5 rounded border border-border text-xs hover:bg-muted">{chip}</button>
                ))}
              </div>
            </div>
          ) : groups.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('search.noResults')}</div>
          ) : (
            groups.map((g) => (
              <div key={g.type}>
                <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <g.icon className="w-3.5 h-3.5" /> {g.label}
                </div>
                {g.items.map((it) => {
                  runningIdx += 1;
                  const idx = runningIdx;
                  return (
                    <button
                      key={it.href + it.primary}
                      data-idx={idx}
                      onClick={() => go(it.href)}
                      onMouseEnter={() => setActive(idx)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 ${
                        idx === active ? 'bg-[#C9A96E]/10' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{it.primary}</p>
                        {it.secondary && <p className="text-xs text-muted-foreground truncate">{it.secondary}</p>}
                      </div>
                      {it.badge && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground shrink-0">{it.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
          <span><kbd className="px-1 border border-border rounded">↑↓</kbd> {t('search.navigate')}</span>
          <span><kbd className="px-1 border border-border rounded">↵</kbd> {t('search.open')}</span>
          <span><kbd className="px-1 border border-border rounded">esc</kbd> {t('search.close')}</span>
        </div>
      </div>
    </div>
  );
}
