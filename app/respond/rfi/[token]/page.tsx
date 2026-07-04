'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type RfiPublic = {
  rfiNumber: string;
  subject: string;
  question: string;
  status: string;
  projectName: string;
  projectNumber: string;
  assignedTo?: string;
  dueDate?: string;
  alreadyAnswered: boolean;
  responseText?: string | null;
};

export default function ExternalRfiRespondPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [rfi, setRfi] = useState<RfiPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ responseText: '', responseBy: '', costImpact: 'TBD', scheduleImpact: 'TBD' });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/rfis/public/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Link inválido');
        return res.json();
      })
      .then(setRfi)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.responseText.trim()) {
      setError('La respuesta es requerida');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/rfis/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al enviar');
      }
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] text-white">
        <p>Cargando RFI…</p>
      </div>
    );
  }

  if (error && !rfi) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Enlace no válido</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!rfi) return null;

  return (
    <div className="min-h-screen bg-[#0F1B33] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#C9A96E]">Kodu PM — RFI Response</h1>
          <p className="text-white/70 mt-1">#{rfi.projectNumber} {rfi.projectName}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground font-mono">{rfi.rfiNumber}</p>
            <h2 className="text-xl font-semibold">{rfi.subject}</h2>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-[#C9A96E]">
            <p className="text-xs uppercase text-muted-foreground mb-1">Question</p>
            <p className="text-sm whitespace-pre-wrap">{rfi.question}</p>
          </div>

          {rfi.alreadyAnswered || success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-medium text-green-800">Respuesta registrada</p>
              {rfi.responseText && (
                <p className="text-sm mt-2 whitespace-pre-wrap">{rfi.responseText}</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tu nombre</label>
                <input
                  value={form.responseBy}
                  onChange={(e) => setForm((f) => ({ ...f, responseBy: e.target.value }))}
                  placeholder={rfi.assignedTo || 'Nombre'}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Respuesta *</label>
                <textarea
                  value={form.responseText}
                  onChange={(e) => setForm((f) => ({ ...f, responseText: e.target.value }))}
                  rows={6}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Cost Impact</label>
                  <input
                    value={form.costImpact}
                    onChange={(e) => setForm((f) => ({ ...f, costImpact: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Schedule Impact</label>
                  <input
                    value={form.scheduleImpact}
                    onChange={(e) => setForm((f) => ({ ...f, scheduleImpact: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#0F1B33] text-[#C9A96E] rounded-lg font-semibold disabled:opacity-50"
              >
                {submitting ? 'Enviando…' : 'Enviar respuesta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
