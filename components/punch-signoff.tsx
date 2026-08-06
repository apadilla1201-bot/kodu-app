'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import { PenLine, CheckCircle2, Lock, Loader2, X, Unlock } from 'lucide-react';

type Signoff = {
  id: string;
  area: string;
  superName: string | null;
  pmName: string | null;
  ownerRepName: string | null;
  signedByName: string | null;
  signedAt: string;
  remarks: string | null;
};

type Progress = Record<string, { total: number; closed: number }>;

export function PunchSignoff({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [progress, setProgress] = useState<Progress>({});
  const [loading, setLoading] = useState(true);
  const [signingArea, setSigningArea] = useState<string | null>(null);
  const [form, setForm] = useState({ superName: '', pmName: '', ownerRepName: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]';

  const load = async () => {
    try {
      const res = await fetch(`/api/punch-signoffs?projectId=${projectId}`, { credentials: 'include' });
      if (res.status === 503) return; // migración pendiente — no mostramos nada
      if (!res.ok) throw new Error('load');
      const data = await res.json();
      setSignoffs(data.signoffs ?? []);
      setProgress(data.progress ?? {});
    } catch {
      toast.error(t('punch.signoffLoadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleSign = async () => {
    if (!signingArea) return;
    setSaving(true);
    try {
      const res = await fetch('/api/punch-signoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, area: signingArea, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === 'area_not_complete') {
          throw new Error(t('punch.signoffNotComplete', { count: data.openItems ?? 0 }));
        }
        throw new Error(data?.error || 'error');
      }
      toast.success(t('punch.signoffDone'));
      setSigningArea(null);
      setForm({ superName: '', pmName: '', ownerRepName: '', remarks: '' });
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('punch.signoffError'));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async (area: string) => {
    if (!window.confirm(t('punch.signoffUnlockConfirm'))) return;
    try {
      const res = await fetch('/api/punch-signoffs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, area }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('punch.signoffUnlocked'));
      await load();
    } catch {
      toast.error(t('punch.signoffError'));
    }
  };

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline-block text-muted-foreground" /></div>;
  }

  const areas = Object.keys(progress).sort();
  if (areas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{t('punch.signoffNoAreas')}</p>;
  }

  const signedAreas = new Set(signoffs.map((s) => s.area));
  const signedCount = areas.filter((a) => signedAreas.has(a)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('punch.signoffDesc')}</p>
        <span className="text-sm font-bold text-[#0F1B33]">
          {signedCount}/{areas.length} {t('punch.signoffAreasSigned')}
        </span>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0F1B33] text-white text-left">
              <th className="px-4 py-3 font-semibold">{t('punch.colArea')}</th>
              <th className="px-4 py-3 font-semibold">{t('punch.signoffProgress')}</th>
              <th className="px-4 py-3 font-semibold">{t('punch.signoffSignatures')}</th>
              <th className="px-4 py-3 font-semibold text-right">{t('punch.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => {
              const p = progress[a];
              const pct = p.total ? Math.round((p.closed / p.total) * 100) : 0;
              const so = signoffs.find((s) => s.area === a);
              return (
                <tr key={a} className={`border-t border-border ${so ? 'bg-green-50/50' : ''}`}>
                  <td className="px-4 py-3 font-medium max-w-[260px] truncate" title={a}>{a}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-28 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-600' : 'bg-[#C9A96E]'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.closed}/{p.total} · {pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {so ? (
                      <div className="text-xs space-y-0.5">
                        {so.superName && <p><span className="text-muted-foreground">Super:</span> <b>{so.superName}</b></p>}
                        {so.pmName && <p><span className="text-muted-foreground">PM:</span> <b>{so.pmName}</b></p>}
                        {so.ownerRepName && <p><span className="text-muted-foreground">Owner's Rep:</span> <b>{so.ownerRepName}</b></p>}
                        <p className="text-muted-foreground">
                          {new Date(so.signedAt).toLocaleDateString()}{so.signedByName ? ` · ${so.signedByName}` : ''}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {so ? (
                      <button onClick={() => handleUnlock(a)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-50">
                        <Unlock className="w-3.5 h-3.5" /> {t('punch.signoffUnlock')}
                      </button>
                    ) : pct === 100 ? (
                      <button onClick={() => { setSigningArea(a); setForm({ superName: '', pmName: '', ownerRepName: '', remarks: '' }); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-700 text-white text-xs font-bold hover:bg-green-800">
                        <PenLine className="w-3.5 h-3.5" /> {t('punch.signoffSign')}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                        <Lock className="w-3.5 h-3.5" /> {t('punch.signoffLocked')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Diálogo firmar */}
      {signingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-xl shadow-xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-green-700 rounded-t-xl">
              <h2 className="text-white font-bold flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4" /> {t('punch.signoffDialogTitle')}
              </h2>
              <button onClick={() => setSigningArea(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-[#0F1B33] bg-green-50 border border-green-200 rounded-md p-3">
                {signingArea}
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.signoffSuper')}</label>
                <input value={form.superName} onChange={(e) => setForm({ ...form, superName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.signoffPM')}</label>
                <input value={form.pmName} onChange={(e) => setForm({ ...form, pmName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.signoffOwnerRep')}</label>
                <input value={form.ownerRepName} onChange={(e) => setForm({ ...form, ownerRepName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{t('punch.signoffRemarks')}</label>
                <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={inputClass + ' min-h-[60px]'} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setSigningArea(null)}
                  className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSign} disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-700 text-white text-sm font-bold hover:bg-green-800 disabled:opacity-60">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('punch.signoffConfirm')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
