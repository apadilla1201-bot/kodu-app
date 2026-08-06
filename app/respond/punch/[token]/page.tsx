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

export default function ExternalPunchRespondPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] text-white">
        <p>Loading punch item…</p>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F1B33] p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Invalid link</h1>
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
        <div className="text-center mb-6">
          <div className="inline-flex items-baseline select-none">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#C9A96E] text-[#0F1B33] font-black text-base mr-1.5">k</span>
            <span className="text-2xl font-black text-white tracking-tight">kodu</span>
            <span className="text-2xl font-black text-[#C9A96E] tracking-tight">PM</span>
          </div>
          <p className="text-white/50 text-xs mt-2">Secure link — you are viewing only this punch item. No account needed.</p>
        </div>

        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-[#C9A96E] px-6 py-4">
            <h1 className="text-[#0F1B33] font-bold text-lg">Punch Item #{item.itemNumber}</h1>
            <p className="text-[#0F1B33]/70 text-sm">{item.projectNumber} — {item.projectName}</p>
          </div>

          <div className="p-6 space-y-4">
            {success || closed ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
                <h2 className="text-lg font-bold text-green-700">
                  {closed ? 'This item is completed' : 'Marked ready for review'}
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {closed
                    ? `${item.gcName} verified and closed this item. Thank you.`
                    : `${item.gcName} has been notified and will verify the correction.`}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-foreground">{item.title}</h2>
                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                {item.correctiveAction && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
                    <span className="font-bold text-[#0F1B33]">Required corrective action: </span>
                    {item.correctiveAction}
                  </div>
                )}

                <table className="w-full text-sm">
                  <tbody>
                    {item.location && <tr className="border-b"><td className="py-2 text-muted-foreground w-32">Location</td><td className="py-2">{item.location}</td></tr>}
                    {item.trade && <tr className="border-b"><td className="py-2 text-muted-foreground">Trade</td><td className="py-2">{item.trade}</td></tr>}
                    <tr className="border-b"><td className="py-2 text-muted-foreground">Priority</td><td className="py-2 font-semibold">{item.priority}{item.priority === 'A' ? ' — Life Safety / TCO (urgent)' : item.priority === 'B' ? ' — Functional' : item.priority === 'C' ? ' — Cosmetic' : ''}</td></tr>
                    <tr className="border-b"><td className="py-2 text-muted-foreground">Due date</td><td className="py-2">{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</td></tr>
                    <tr><td className="py-2 text-muted-foreground">Status</td><td className="py-2 font-semibold">{item.status}</td></tr>
                  </tbody>
                </table>

                {item.photoUrl && (
                  <a href={item.photoUrl} target="_blank" rel="noopener noreferrer"
                    className="block text-sm font-semibold text-[#0F1B33] underline">
                    View photo of the issue →
                  </a>
                )}

                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">When the correction is done, mark it ready (photo optional but recommended):</p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-2.5 rounded-md border-2 border-dashed border-[#C9A96E] text-[#0F1B33] text-sm font-semibold hover:bg-amber-50"
                  >
                    {file ? `📷 ${file.name}` : 'Attach correction photo (optional)'}
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
                    {submitting ? 'Sending…' : 'Mark as Ready for Review'}
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
