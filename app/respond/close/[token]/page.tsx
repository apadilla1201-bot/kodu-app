'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type CloseInfo = {
  kind: 'rfi' | 'submittal';
  number: string;
  title: string;
  status: string;
  projectName: string;
  projectNumber: string;
  responseBy?: string | null;
  responseText?: string | null;
  alreadyClosed: boolean;
};

const STR = {
  en: {
    loading: 'Loading…',
    invalidTitle: 'Invalid link',
    closeLabel: 'Close',
    currentStatus: 'Current status',
    responseBy: 'Response',
    alreadyClosed: (k: string) => `${k} already closed`,
    closedOk: (k: string) => `${k} closed successfully ✓`,
    cantReuse: 'This secure link can’t be used again.',
    confirmClose: (k: string) =>
      `Confirm the response is correct and close this ${k}. If you need to reassign it to someone else, do it from koduPM with your account.`,
    closing: 'Closing…',
    closeBtn: (k: string) => `✓ Close ${k}`,
  },
  es: {
    loading: 'Cargando…',
    invalidTitle: 'Enlace no válido',
    closeLabel: 'Cerrar',
    currentStatus: 'Estado actual',
    responseBy: 'Respuesta',
    alreadyClosed: (k: string) => `${k} ya está cerrado`,
    closedOk: (k: string) => `${k} cerrado correctamente ✓`,
    cantReuse: 'Este enlace seguro no se puede usar de nuevo.',
    confirmClose: (k: string) =>
      `Confirma que la respuesta es correcta y cierra este ${k}. Si necesitas reasignarlo a otra persona, hazlo desde koduPM con tu cuenta.`,
    closing: 'Cerrando…',
    closeBtn: (k: string) => `✓ Cerrar ${k}`,
  },
} as const;

export default function CloseItemPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const L = STR[lang];
  const [info, setInfo] = useState<CloseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/close/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Invalid link');
        return res.json();
      })
      .then(setInfo)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleClose = async () => {
    setClosing(true);
    setError('');
    try {
      const res = await fetch(`/api/close/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Error');
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Error');
    } finally {
      setClosing(false);
    }
  };

  const kindLabel = info?.kind === 'submittal' ? 'Submittal' : 'RFI';

  const langToggle = (
    <div className="flex justify-center gap-1 mb-4 text-xs font-semibold">
      {(['en', 'es'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1 rounded-full uppercase tracking-wide ${lang === l ? 'bg-[#C9A96E] text-[#0F1B33]' : 'text-white/60 hover:text-white'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] text-white">
        <p>{L.loading}</p>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">{L.invalidTitle}</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!info) return null;
  const closed = done || info.alreadyClosed;

  return (
    <div className="min-h-screen bg-[#0F1B33] py-10 px-4">
      <div className="max-w-lg mx-auto">
        {langToggle}
        <div className="text-center mb-8">
          <p className="text-3xl font-bold text-white tracking-tight mb-2">koduPM</p>
          <h1 className="text-2xl font-bold text-[#C9A96E]">{L.closeLabel} {kindLabel}</h1>
          <p className="text-white/70 mt-1">#{info.projectNumber} {info.projectName}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground font-mono">{info.number}</p>
            <h2 className="text-xl font-semibold">{info.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{L.currentStatus}: {info.status}</p>
          </div>

          {info.responseText && (
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-green-600">
              <p className="text-xs uppercase text-muted-foreground mb-1">
                {L.responseBy}{info.responseBy ? ` — ${info.responseBy}` : ''}
              </p>
              <p className="text-sm whitespace-pre-wrap">{info.responseText}</p>
            </div>
          )}

          {closed ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="font-medium text-green-800">
                {info.alreadyClosed ? L.alreadyClosed(kindLabel) : L.closedOk(kindLabel)}
              </p>
              <p className="text-xs text-green-700 mt-1">{L.cantReuse}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{L.confirmClose(kindLabel)}</p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={handleClose}
                disabled={closing}
                className="w-full py-3 bg-green-700 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {closing ? L.closing : L.closeBtn(kindLabel)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
