'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/hooks/use-i18n';
import { Crown } from 'lucide-react';

// Badge del plan actual en el sidebar. Clic → Settings (tarjeta Plan & Billing).
// No rompe nada si la API falla: simplemente no se muestra.
export function PlanBadge() {
  const { t } = useI18n();
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/company/plan', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setPlan((data?.plan ?? 'starter').toLowerCase());
        }
      } catch {
        // silencioso
      }
    })();
  }, []);

  if (!plan) return null;

  const label = t(`plan.${plan}` as any) || plan;
  const styles: Record<string, string> = {
    starter: 'bg-white/10 text-gray-300 border-white/20',
    pro: 'bg-[#C9A96E]/20 text-[#C9A96E] border-[#C9A96E]/40',
    enterprise: 'bg-[#C9A96E] text-[#0F1B33] border-[#C9A96E]',
  };

  return (
    <Link
      href="/dashboard/settings"
      className={`flex items-center justify-center gap-1.5 mb-3 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80 ${
        styles[plan] ?? styles.starter
      }`}
      title={t('plan.manage')}
    >
      <Crown className="w-3 h-3" />
      {label}
    </Link>
  );
}
