'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type InviteInfo = {
  email: string;
  name?: string | null;
  role: string;
  roleLabel: string;
  companyName: string;
  projectName?: string | null;
};

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token ?? '');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', password: '', confirm: '' });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Invalid invitation');
        return res.json();
      })
      .then((data) => {
        setInfo(data);
        if (data?.name) setForm((f) => ({ ...f, name: data.name }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('La clave debe tener al menos 8 caracteres');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Las claves no coinciden');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: form.password, name: form.name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al crear la cuenta');
      }
      router.push('/login?invited=1');
    } catch (e: any) {
      setError(e?.message ?? 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] text-white">
        <p>Loading invitation…</p>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Invitación no válida</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="min-h-screen bg-[#0F1B33] py-10 px-4 flex items-center">
      <div className="max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <img src="/pdg_logo.png" alt="The Project Delivery Group LLC" className="mx-auto mb-4 h-16 w-auto" />
          <h1 className="text-2xl font-bold text-[#C9A96E]">Kodu PM</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Aceptar invitación</h2>
            <p className="text-sm text-muted-foreground mt-1">{info.email}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-[#C9A96E] text-sm space-y-1">
            <p><strong>Empresa:</strong> {info.companyName}</p>
            {info.projectName && <p><strong>Proyecto:</strong> {info.projectName}</p>}
            <p><strong>Tu rol:</strong> {info.roleLabel}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Tu nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Crea tu clave (mínimo 8 caracteres)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Confirma tu clave</label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#0F1B33] text-[#C9A96E] rounded-lg font-semibold disabled:opacity-50"
            >
              {submitting ? 'Creando cuenta…' : 'Crear cuenta y entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
