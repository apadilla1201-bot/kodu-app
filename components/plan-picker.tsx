'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/hooks/use-i18n';

// ─────────────────────────────────────────────────────────────────────────────
// PlanPicker — selector de plano del Plan Room para RFI / COR / Submittal / Punch.
// value = planSheetId ('' = sin vínculo). onChange recibe (planSheetId, displayText).
// El displayText sirve para rellenar el campo de texto histórico (drawingReference).
// Si el Plan Room no está migrado o no tiene planos, devuelve lista vacía y el
// formulario sigue funcionando con texto libre (no rompe nada).
// ─────────────────────────────────────────────────────────────────────────────

interface PlanOption {
  id: string;
  sheetNumber: string;
  title: string;
  currentRevision: string | null;
  display: string;
}

export function PlanPicker({
  projectId,
  value,
  onChange,
  className,
}: {
  projectId: string;
  value: string;
  onChange: (planSheetId: string, displayText: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState<PlanOption[]>([]);

  useEffect(() => {
    if (!projectId) { setOptions([]); return; }
    let cancelled = false;
    fetch(`/api/plan-sheets/lookup?projectId=${projectId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled && Array.isArray(data)) setOptions(data); })
      .catch(() => { /* Plan Room sin migrar → lista vacía, sin romper el formulario */ });
    return () => { cancelled = true; };
  }, [projectId]);

  const grouped = useMemo(() => options, [options]);

  if (grouped.length === 0) return null; // sin planos cargados → el campo de texto libre sigue solo

  return (
    <select
      value={value}
      onChange={(e) => {
        const opt = grouped.find((o) => o.id === e.target.value);
        onChange(e.target.value, opt?.display ?? '');
      }}
      className={className ?? 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white'}
    >
      <option value="">{t('planPicker.none')}</option>
      {grouped.map((o) => (
        <option key={o.id} value={o.id}>{o.display}</option>
      ))}
    </select>
  );
}
