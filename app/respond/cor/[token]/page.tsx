'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type CorPublic = {
  corNumber: string;
  description: string;
  reasonForChange?: string | null;
  subcontractor?: string | null;
  status: string;
  subtotal: number;
  salesTax: number;
  overheadProfit: number;
  generalLiability: number;
  totalAmount: number;
  projectName: string;
  projectNumber: string;
  ownerName?: string | null;
  lineItems: { description: string; quantity: number; unit: string; unitPrice: number; total: number }[];
  alreadyDecided: boolean;
  decidedBy?: string | null;
};

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function ExternalCorApprovePage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [cor, setCor] = useState<CorPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<'Approved' | 'Rejected' | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/cors/public/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Invalid link');
        return res.json();
      })
      .then(setCor)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDecision = async (d: 'Approved' | 'Rejected') => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/cors/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: d, decidedBy: name || cor?.ownerName || 'External Approver' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al enviar');
      }
      setDecision(d);
    } catch (e: any) {
      setError(e?.message ?? 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] text-white">
        <p>Loading change order…</p>
      </div>
    );
  }

  if (error && !cor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Enlace no válido</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!cor) return null;
  const closed = cor.alreadyDecided || decision !== null;

  return (
    <div className="min-h-screen bg-[#0F1B33] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img src="/pdg_logo.png" alt="The Project Delivery Group LLC" className="mx-auto mb-4 h-16 w-auto" />
          <h1 className="text-2xl font-bold text-[#C9A96E]">Kodu PM — Change Order Approval</h1>
          <p className="text-white/70 mt-1">#{cor.projectNumber} {cor.projectName}</p>
          <p className="text-white/50 text-xs mt-2">
            Secure link — you are reviewing only this change order. No account needed.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground font-mono">{cor.corNumber}</p>
            <h2 className="text-xl font-semibold">{cor.description}</h2>
            {cor.subcontractor && <p className="text-xs text-muted-foreground mt-1">Subcontractor: {cor.subcontractor}</p>}
          </div>

          {cor.reasonForChange && (
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-[#C9A96E]">
              <p className="text-xs uppercase text-muted-foreground mb-1">Reason for Change</p>
              <p className="text-sm whitespace-pre-wrap">{cor.reasonForChange}</p>
            </div>
          )}

          {cor.lineItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                    <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cor.lineItems.map((li, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{li.description}</td>
                      <td className="px-3 py-2 text-right">{li.quantity} {li.unit}</td>
                      <td className="px-3 py-2 text-right">{usd(li.unitPrice)}</td>
                      <td className="px-3 py-2 text-right">{usd(li.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-[#0F1B33] text-white rounded-lg p-4 space-y-1">
            <div className="flex justify-between text-sm text-white/70"><span>Subtotal</span><span>{usd(cor.subtotal)}</span></div>
            <div className="flex justify-between text-sm text-white/70"><span>Sales Tax (7%)</span><span>{usd(cor.salesTax)}</span></div>
            <div className="flex justify-between text-sm text-white/70"><span>Overhead & Profit (6%)</span><span>{usd(cor.overheadProfit)}</span></div>
            <div className="flex justify-between text-sm text-white/70"><span>General Liability (1.5%)</span><span>{usd(cor.generalLiability)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t border-white/20 pt-2 mt-2">
              <span>Total</span><span className="text-[#C9A96E]">{usd(cor.totalAmount)}</span>
            </div>
          </div>

          {closed ? (
            <div className={`border rounded-lg p-4 ${(decision ?? cor.status) === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`font-medium ${(decision ?? cor.status) === 'Approved' ? 'text-green-800' : 'text-red-800'}`}>
                Change Order {(decision ?? cor.status)}
                {cor.decidedBy ? ` by ${cor.decidedBy}` : ''}
              </p>
              {decision && <p className="text-sm mt-1 text-green-700">El equipo del proyecto fue notificado por correo.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Tu nombre (para registrar la decisión)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={cor.ownerName || 'Nombre'}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleDecision('Approved')}
                  disabled={submitting}
                  className="py-3 bg-green-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Enviando…' : 'Approve'}
                </button>
                <button
                  onClick={() => handleDecision('Rejected')}
                  disabled={submitting}
                  className="py-3 bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Enviando…' : 'Reject'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
