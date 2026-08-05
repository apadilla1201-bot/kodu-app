use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/hooks/use-i18n';
import { FileSignature, CheckCircle2, Clock, Loader2, Plus } from 'lucide-react';

type WaiverLite = {
  id: string;
  subcontractor: string;
  waiverType: string;
  amount: number;
  status: string;
};

export function PayAppWaivers({ payAppId, projectId }: { payAppId: string; projectId: string }) {
  const { t } = useI18n();
  const [waivers, setWaivers] = useState<WaiverLite[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/lien-waivers?projectId=${projectId}&payAppId=${payAppId}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('load');
        return res.json();
      })
      .then(setWaivers)
      .catch(() => setFailed(true));
  }, [payAppId, projectId]);

  // Si la migración no ha corrido o falla, no mostramos nada (no rompemos la Pay App)
  if (failed) return null;

  const link = `/dashboard/lien-waivers?create=1&project=${projectId}&payApp=${payAppId}`;
  const done = (waivers ?? []).filter((w) => w.status === 'Approved' || w.status === 'Received').length;
  const total = (waivers ?? []).length;

  return (
    <div className="bg-card rounded-lg shadow-[var(--shadow-sm)] border border-border overflow-hidden">
      <div className="bg-[#0F1B33] text-white px-6 py-3 flex items-center justify-between">
        <h2 className="font-display font-bold text-sm flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-[#C9A96E]" /> {t('lienWaivers.checklistTitle')}
        </h2>
        {waivers && total > 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${done === total ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
            {t('lienWaivers.checklistReceivedOf', { done, total })}
          </span>
        )}
      </div>
      <div className="p-4">
        {waivers === null ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
        ) : total === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('lienWaivers.checklistEmpty')}</p>
            <Link href={link} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C9A96E] hover:text-[#D4A843]">
              <Plus className="w-4 h-4" /> {t('lienWaivers.newWaiver')}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {waivers.map((w) => {
              const ok = w.status === 'Approved' || w.status === 'Received';
              return (
                <li key={w.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {ok
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      : <Clock className="w-4 h-4 text-amber-500 shrink-0" />}
                    <span className="text-sm font-medium truncate">{w.subcontractor}</span>
                    <span className="text-xs text-muted-foreground truncate">{t(`lienWaivers.type_${w.waiverType}`)}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {w.amount > 0 && (
                      <span className="text-sm font-semibold">
                        ${w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className={`text-xs font-semibold ${ok ? 'text-green-700' : 'text-amber-600'}`}>
                      {t(`lienWaivers.status${w.status}`)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {waivers !== null && total > 0 && (
          <div className="pt-3 mt-1 border-t border-border flex justify-end">
            <Link href={`/dashboard/lien-waivers?project=${projectId}`} className="text-xs font-semibold text-[#0F1B33] hover:text-[#1B365D]">
              {t('lienWaivers.manageWaivers')} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
