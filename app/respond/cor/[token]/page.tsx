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

const STR = {
  en: {
    loading: 'Loading change order…',
    invalidTitle: 'Invalid link',
    pageTitle: 'Change Order Approval',
    secureNote: 'Secure link — you are reviewing only this change order. No account needed.',
    subcontractor: 'Subcontractor',
    reasonForChange: 'Reason for Change',
    description: 'Description',
    qty: 'Qty',
    unitPrice: 'Unit Price',
    total: 'Total',
    subtotal: 'Subtotal',
    salesTax: 'Sales Tax (7%)',
    overheadProfit: 'Overhead & Profit (6%)',
    generalLiability: 'General Liability (1.5%)',
    yourName: 'Your name (to record the decision)',
    namePlaceholder: 'Name',
    approve: 'Approve',
    reject: 'Reject',
    sending: 'Submitting…',
    approvedMsg: 'Change Order Approved',
    rejectedMsg: 'Change Order Rejected',
    by: 'by',
    notified: 'The project team has been notified by email.',
  },
  es: {
    loading: 'Cargando orden de cambio…',
    invalidTitle: 'Enlace no válido',
    pageTitle: 'Aprobación de Orden de Cambio',
    secureNote: 'Enlace seguro — solo estás viendo esta orden de cambio. No necesitas cuenta.',
    subcontractor: 'Subcontratista',
    reasonForChange: 'Razón del cambio',
    description: 'Descripción',
    qty: 'Cant.',
    unitPrice: 'Precio unitario',
    total: 'Total',
    subtotal: 'Subtotal',
    salesTax: 'Impuesto (7%)',
    overheadProfit: 'Overhead & Profit (6%)',
    generalLiability: 'General Liability (1.5%)',
    yourName: 'Tu nombre (para registrar la decisión)',
    namePlaceholder: 'Nombre',
    approve: 'Aprobar',
    reject: 'Rechazar',
    sending: 'Enviando…',
    approvedMsg: 'Orden de Cambio Aprobada',
    rejectedMsg: 'Orden de Cambio Rechazada',
    by: 'por',
    notified: 'El equipo del proyecto fue notificado por correo.',
  },
} as const;

export default function ExternalCorApprovePage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const L = STR[lang];
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

  if (error && !cor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">{L.invalidTitle}</h1>
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
        {langToggle}
        <div className="text-center mb-8">
          <p className="text-3xl font-bold text-white tracking-tight mb-2">koduPM</p>
          <h1 className="text-2xl font-bold text-[#C9A96E]">{L.pageTitle}</h1>
          <p className="text-white/70 mt-1">#{cor.projectNumber} {cor.projectName}</p>
          <p className="text-white/50 text-xs mt-2">{L.secureNote}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground font-mono">{cor.corNumber}</p>
            <h2 className="text-xl font-semibold">{cor.description}</h2>
            {cor.subcontractor && <p className="text-xs text-muted-foreground mt-1">{L.subcontractor}: {cor.subcontractor}</p>}
          </div>

          {cor.reasonForChange && (
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-[#C9A96E]">
              <p className="text-xs uppercase text-muted-foreground mb-1">{L.reasonForChange}</p>
              <p className="text-sm whitespace-pre-wrap">{cor.reasonForChange}</p>
            </div>
          )}

          {cor.lineItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">{L.description}</th>
                    <th className="text-right px-3 py-2 font-medium">{L.qty}</th>
                    <th className="text-right px-3 py-2 font-medium">{L.unitPrice}</th>
                    <th className="text-right px-3 py-2 font-medium">{L.total}</th>
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
            <div className="flex justify-between text-sm text-white/70"><span>{L.subtotal}</span><span>{usd(cor.subtotal)}</span></div>
            <div className="flex justify-between text-sm text-white/70"><span>{L.salesTax}</span><span>{usd(cor.salesTax)}</span></div>
            <div className="flex justify-between text-sm text-white/70"><span>{L.overheadProfit}</span><span>{usd(cor.overheadProfit)}</span></div>
            <div className="flex justify-between text-sm text-white/70"><span>{L.generalLiability}</span><span>{usd(cor.generalLiability)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t border-white/20 pt-2 mt-2">
              <span>{L.total}</span><span className="text-[#C9A96E]">{usd(cor.totalAmount)}</span>
            </div>
          </div>

          {closed ? (
            <div className={`border rounded-lg p-4 ${(decision ?? cor.status) === 'Approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`font-medium ${(decision ?? cor.status) === 'Approved' ? 'text-green-800' : 'text-red-800'}`}>
                {(decision ?? cor.status) === 'Approved' ? L.approvedMsg : L.rejectedMsg}
                {cor.decidedBy ? ` ${L.by} ${cor.decidedBy}` : ''}
              </p>
              {decision && <p className="text-sm mt-1 text-green-700">{L.notified}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">{L.yourName}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={cor.ownerName || L.namePlaceholder}
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
                  {submitting ? L.sending : L.approve}
                </button>
                <button
                  onClick={() => handleDecision('Rejected')}
                  disabled={submitting}
                  className="py-3 bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? L.sending : L.reject}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
