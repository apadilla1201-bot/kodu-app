'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type SubmittalPublic = {
  submittalNumber: string;
  title: string;
  description?: string | null;
  submittalType?: string;
  specSection?: string | null;
  status: string;
  projectName: string;
  projectNumber: string;
  assignedTo?: string | null;
  requiredDate?: string | null;
  alreadyAnswered: boolean;
  responseText?: string | null;
};

export default function ExternalSubmittalRespondPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [sub, setSub] = useState<SubmittalPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ responseText: '', responseBy: '' });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/submittals/public/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Invalid link');
        return res.json();
      })
      .then(setSub)
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
      const res = await fetch(`/api/submittals/public/${token}`, {
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
        <p>Loading submittal…</p>
      </div>
    );
  }

  if (error && !sub) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Enlace no válido</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!sub) return null;

  return (
    <div className="min-h-screen bg-[#0F1B33] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img src="/pdg_logo.png" alt="The Project Delivery Group LLC" className="mx-auto mb-4 h-16 w-auto" />
          <h1 className="text-2xl font-bold text-[#C9A96E]">Kodu PM — Submittal Response</h1>
          <p className="text-white/70 mt-1">#{sub.projectNumber} {sub.projectName}</p>
          <p className="text-white/50 text-xs mt-2">
            Secure link — you are viewing only this submittal. No account needed.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground font-mono">{sub.submittalNumber}</p>
            <h2 className="text-xl font-semibold">{sub.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {sub.submittalType}{sub.specSection ? ` · Spec ${sub.specSection}` : ''}
              {sub.requiredDate ? ` · Required by ${new Date(sub.requiredDate).toLocaleDateString('en-US')}` : ''}
            </p>
          </div>

          {sub.description && (
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-[#C9A96E]">
              <p className="text-xs uppercase text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap">{sub.description}</p>
            </div>
          )}

          {sub.alreadyAnswered || success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-medium text-green-800">Respuesta registrada</p>
              {sub.responseText && <p className="text-sm mt-2 whitespace-pre-wrap">{sub.responseText}</p>}
              {success && <p className="text-sm mt-2 text-green-700">El equipo del proyecto fue notificado por correo.</p>}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tu nombre</label>
                <input
                  value={form.responseBy}
                  onChange={(e) => setForm((f) => ({ ...f, responseBy: e.target.value }))}
                  placeholder={sub.assignedTo || 'Nombre'}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Respuesta / comentarios *</label>
                <textarea
                  value={form.responseText}
                  onChange={(e) => setForm((f) => ({ ...f, responseText: e.target.value }))}
                  rows={6}
                  required
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
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
