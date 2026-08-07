'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type PunchPublic = {
  itemNumber: number;
  title: string;
  description: string | null;
  location: string | null;
  trade: string | null;
  priority: string;
  correctiveAction: string | null;
  status: string;
  dueDate: string | null;
  photoUrl: string | null;
  assignedToName: string | null;
  projectName: string;
  projectNumber: string;
  gcName: string;
};

const STR = {
  en: {
    loading: 'Loading punch item…',
    invalidTitle: 'Invalid link',
    secureNote: 'Secure link — you are viewing only this punch item. No account needed.',
    punchItem: 'Punch Item',
    completed: 'This item is completed',
    readyMarked: 'Marked ready for review',
    closedMsg: (gc: string) => `${gc} verified and closed this item. Thank you.`,
    notifiedMsg: (gc: string) => `${gc} has been notified and will verify the correction.`,
    corrective: 'Required corrective action:',
    location: 'Location',
    trade: 'Trade',
    priority: 'Priority',
    priorityA: ' — Life Safety / TCO (urgent)',
    priorityB: ' — Functional',
    priorityC: ' — Cosmetic',
    dueDate: 'Due date',
    status: 'Status',
    viewPhoto: 'View photo of the issue →',
    instructions: 'When the correction is done, mark it ready (photo optional but recommended):',
    attachPhoto: 'Attach correction photo (optional)',
    sending: 'Sending…',
    markReady: 'Mark as Ready for Review',
    failed: 'Failed',
  },
  es: {
    loading: 'Cargando ítem de punch…',
    invalidTitle: 'Enlace no válido',
    secureNote: 'Enlace seguro — solo estás viendo este ítem. No necesitas cuenta.',
    punchItem: 'Ítem de Punch',
    completed: 'Este ítem está completado',
    readyMarked: 'Marcado listo para revisión',
    closedMsg: (gc: string) => `${gc} verificó y cerró este ítem. Gracias.`,
    notifiedMsg: (gc: string) => `${gc} fue notificado y verificará la corrección.`,
    corrective: 'Acción correctiva requerida:',
    location: 'Ubicación',
    trade: 'Oficio',
    priority: 'Prioridad',
    priorityA: ' — Seguridad / TCO (urgente)',
    priorityB: ' — Funcional',
    priorityC: ' — Cosmética',
    dueDate: 'Fecha límite',
    status: 'Estado',
    viewPhoto: 'Ver foto del problema →',
    instructions: 'Cuando termines la corrección, márcala como lista (foto opcional pero recomendada):',
    attachPhoto: 'Adjuntar foto de la corrección (opcional)',
    sending: 'Enviando…',
    markReady: 'Marcar como Listo para Revisión',
    failed: 'Error',
  },
} as const;

export default function ExternalPunchRespondPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const L = STR[lang];
  const [item, setItem] = useState<PunchPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/punch-items/public/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Invalid link');
        return res.json();
      })
      .then(setItem)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleReady = async () => {
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      if (file) {
        fd.append('file', file);
        fd.append('fileName', file.name);
        fd.append('contentType', file.type || 'application/octet-stream');
      }
      const res = await fetch(`/api/punch-items/public/${token}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || L.failed);
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? L.failed);
    } finally {
      setSubmitting(false);
    }
  };

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

  if (error && !item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">{L.invalidTitle}</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const closed = item.status === 'Completed';

  return (
    <div className="min-h-screen bg-[#0F1B33] py-10 px-4">
      <div className="max-w-xl mx-auto">
        {langToggle}
        <div className="text-center mb-6">
          <div className="inline-flex items-baseline select-none">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#C9A96E] text-[#0F1B33] font-black text-base mr-1.5">k</span>
            <span className="text-2xl font-black text-white tracking-tight">kodu</span>
            <span className="text-2xl font-black text-[#C9A96E] tracking-tight">PM</span>
          </div>
          <p className="text-white/50 text-xs mt-2">{L.secureNote}</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-[#C9A96E] px-6 py-4">
            <h1 className="text-[#0F1B33] font-bold text-lg">{L.punchItem} #{item.itemNumber}</h1>
            <p className="text-[#0F1B33]/70 text-sm">{item.projectNumber} — {item.projectName}</p>
          </div>

          <div className="p-6 space-y-4">
            {success || closed ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
                <h2 className="text-lg font-bold text-green-700">
                  {closed ? L.completed : L.readyMarked}
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {closed ? L.closedMsg(item.gcName) : L.notifiedMsg(item.gcName)}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-foreground">{item.title}</h2>
                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                {item.correctiveAction && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
                    <span className="font-bold text-[#0F1B33]">{L.corrective} </span>
                    {item.correctiveAction}
                  </div>
                )}

                <table className="w-full text-sm">
                  <tbody>
                    {item.location && <tr className="border-b"><td className="py-2 text-muted-foreground w-32">{L.location}</td><td className="py-2">{item.location}</td></tr>}
                    {item.trade && <tr className="border-b"><td className="py-2 text-muted-foreground">{L.trade}</td><td className="py-2">{item.trade}</td></tr>}
                    <tr className="border-b"><td className="py-2 text-muted-foreground">{L.priority}</td><td className="py-2 font-semibold">{item.priority}{item.priority === 'A' ? L.priorityA : item.priority === 'B' ? L.priorityB : item.priority === 'C' ? L.priorityC : ''}</td></tr>
                    <tr className="border-b"><td className="py-2 text-muted-foreground">{L.dueDate}</td><td className="py-2">{item.dueDate ? new Date(item.dueDate).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US') : '—'}</td></tr>
                    <tr><td className="py-2 text-muted-foreground">{L.status}</td><td className="py-2 font-semibold">{item.status}</td></tr>
                  </tbody>
                </table>

                {item.photoUrl && (
                  <a href={item.photoUrl} target="_blank" rel="noopener noreferrer"
                    className="block text-sm font-semibold text-[#0F1B33] underline">
                    {L.viewPhoto}
                  </a>
                )}

                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">{L.instructions}</p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-2.5 rounded-md border-2 border-dashed border-[#C9A96E] text-[#0F1B33] text-sm font-semibold hover:bg-amber-50"
                  >
                    {file ? `📷 ${file.name}` : L.attachPhoto}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    onClick={handleReady}
                    disabled={submitting}
                    className="w-full py-3 rounded-md bg-[#0F1B33] text-white font-bold hover:bg-[#1B365D] disabled:opacity-60"
                  >
                    {submitting ? L.sending : L.markReady}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">koduPM — Construction Project Management</p>
      </div>
    </div>
  );
}
