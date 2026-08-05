'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type WaiverPublic = {
  subcontractor: string;
  typeLabel: string;
  amount: number;
  throughDate: string | null;
  status: string;
  fileName: string | null;
  projectName: string;
  projectNumber: string;
  owner: string;
  gcName: string;
  alreadyUploaded: boolean;
};

export default function ExternalWaiverRespondPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [waiver, setWaiver] = useState<WaiverPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/lien-waivers/public/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Invalid link');
        return res.json();
      })
      .then(setWaiver)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileName', file.name);
      fd.append('contentType', file.type || 'application/octet-stream');
      const res = await fetch(`/api/lien-waivers/public/${token}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed');
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] text-white">
        <p>Loading waiver…</p>
      </div>
    );
  }

  if (error && !waiver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Invalid link</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!waiver) return null;

  return (
    <div className="min-h-screen bg-[#0F1B33] py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-baseline select-none">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#C9A96E] text-[#0F1B33] font-black text-base mr-1.5">k</span>
            <span className="text-2xl font-black text-white tracking-tight">kodu</span>
            <span className="text-2xl font-black text-[#C9A96E] tracking-tight">PM</span>
          </div>
          <p className="text-white/50 text-xs mt-2">Secure link — you are reviewing only this lien waiver. No account needed.</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-[#C9A96E] px-6 py-4">
            <h1 className="text-[#0F1B33] font-bold text-lg">Lien Waiver Request</h1>
            <p className="text-[#0F1B33]/70 text-sm">{waiver.projectNumber} — {waiver.projectName}</p>
          </div>

          <div className="p-6 space-y-4">
            {success ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
                <h2 className="text-lg font-bold text-green-700">Signed waiver received</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Thank you — {waiver.gcName} has been notified. You can close this page.
                </p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b"><td className="py-2 text-muted-foreground w-40">Subcontractor</td><td className="py-2 font-semibold">{waiver.subcontractor}</td></tr>
                    <tr className="border-b"><td className="py-2 text-muted-foreground">Type</td><td className="py-2 font-semibold">{waiver.typeLabel}</td></tr>
                    <tr className="border-b"><td className="py-2 text-muted-foreground">Amount</td><td className="py-2 font-semibold">{waiver.amount > 0 ? `$${waiver.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td></tr>
                    <tr className="border-b"><td className="py-2 text-muted-foreground">Through date</td><td className="py-2">{waiver.throughDate ? new Date(waiver.throughDate).toLocaleDateString() : '—'}</td></tr>
                    <tr className="border-b"><td className="py-2 text-muted-foreground">General Contractor</td><td className="py-2">{waiver.gcName}</td></tr>
                    <tr><td className="py-2 text-muted-foreground">Owner</td><td className="py-2">{waiver.owner}</td></tr>
                  </tbody>
                </table>

                {waiver.alreadyUploaded && (
                  <div className="bg-purple-50 border border-purple-200 rounded-md p-3 text-sm text-purple-800">
                    A signed file was already uploaded{waiver.fileName ? ` (${waiver.fileName})` : ''}. Uploading again will replace it.
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
                  Steps: 1) Ask {waiver.gcName} for the waiver form (or use your own standard form) ·
                  2) Sign it · 3) Upload the signed PDF or photo below.
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-3 rounded-md bg-[#0F1B33] text-white font-bold hover:bg-[#1B365D] disabled:opacity-60"
                >
                  {uploading ? 'Uploading…' : 'Upload signed waiver (PDF or photo)'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">koduPM — Construction Project Management</p>
      </div>
    </div>
  );
}
