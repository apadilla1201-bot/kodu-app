'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FolderKanban, Lock, KeyRound, ChevronRight, MapPin, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/hooks/use-i18n';

export type HomeProject = {
  id: string;
  projectNumber: string;
  projectName: string;
  client: string;
  location: string | null;
  locked: boolean;      // requiere clave para este usuario
  hasKey: boolean;      // el proyecto tiene clave configurada (informativo)
};

/**
 * HOME = SOLO PROYECTOS (regla del cliente, v22).
 * Nada de métricas ni módulos aquí: eliges un proyecto (con su clave si la
 * tiene) y DENTRO aparecen sus módulos.
 */
export function HomeProjectsContent({ projects, canCreate }: { projects: HomeProject[]; canCreate: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [unlocking, setUnlocking] = useState<HomeProject | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openProject = async (p: HomeProject) => {
    if (!p.locked) {
      router.push(`/dashboard/projects/${p.id}`);
      return;
    }
    setUnlocking(p);
    setKey('');
    setError('');
  };

  const submitKey = async () => {
    if (!unlocking) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${unlocking.id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.noKey ? t('home.noKeyConfigured') : t('home.wrongKey'));
        return;
      }
      setUnlocking(null);
      router.push(`/dashboard/projects/${unlocking.id}`);
    } catch {
      setError(t('home.wrongKey'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{t('home.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('home.subtitle')}</p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/projects/new"
            className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> {t('dashboard.newProject')}
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <FolderKanban className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium">{t('home.empty')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('home.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => void openProject(p)}
              className="w-full text-left bg-card border border-border rounded-xl px-5 py-4 hover:border-[#C9A96E]/50 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#0F1B33] flex items-center justify-center flex-shrink-0">
                  {p.locked
                    ? <Lock className="w-5 h-5 text-[#C9A96E]" />
                    : <FolderKanban className="w-5 h-5 text-[#C9A96E]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground group-hover:text-[#C9A96E] transition-colors truncate">
                    <span className="font-mono text-[#C9A96E] mr-2">#{p.projectNumber}</span>
                    {p.projectName}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {p.client}
                    {p.location ? (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <MapPin className="w-3 h-3" /> {p.location}
                      </span>
                    ) : null}
                  </p>
                </div>
                {p.locked && (
                  <span className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> {t('home.keyRequired')}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-[#C9A96E] transition-colors flex-shrink-0" />
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Diálogo de clave */}
      {unlocking && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={() => !busy && setUnlocking(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-xl bg-[#0F1B33] flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6 text-[#C9A96E]" />
            </div>
            <h3 className="font-bold text-lg">{unlocking.projectName}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">{t('home.keyPrompt')}</p>
            <input
              autoFocus
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submitKey(); }}
              placeholder={t('home.keyPlaceholder')}
              className="w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-sm focus:outline-none focus:border-[#C9A96E]"
            />
            {error && <p className="text-sm text-red-600 font-medium mt-2">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setUnlocking(null)}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => void submitKey()}
                disabled={busy || !key.trim()}
                className="flex-1 py-2.5 rounded-lg bg-[#0F1B33] text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('home.unlock')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
