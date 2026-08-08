'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X, Loader2, PenLine, Check } from 'lucide-react';
import { PhotoMarkupEditor } from '@/components/photo-markup';

type ProjectContact = { name: string; email: string; company: string | null; role: string };

export type QuickCaptureLabels = {
  stepPhoto: string; stepData: string; takePhoto: string; changePhoto: string;
  markPhoto: string; area: string; areaPlaceholder: string; location: string;
  locationPlaceholder: string; trade: string; title: string; titlePlaceholder: string;
  priority: string; assignNow: string; save: string; saveAnother: string;
  saved: (n: number) => string; photoError: string; undo: string; clear: string;
  cancel: string; done: string;
};

const PRIORITIES = ['A', 'B', 'C'] as const;

/**
 * Captura rápida de punch en obra (móvil, una mano):
 * Foto → área/oficio/descripción → guardar. Diseñada para 10 segundos por ítem.
 */
export function QuickCaptureDialog({ projectId, projectNumber, areas, trades, contacts, labels, onClose, onSaved }: {
  projectId: string;
  projectNumber: string;
  areas: string[];
  trades: string[];
  contacts: ProjectContact[];
  labels: QuickCaptureLabels;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [marking, setMarking] = useState(false);
  const [area, setArea] = useState('');
  const [location, setLocation] = useState('');
  const [trade, setTrade] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'A' | 'B' | 'C'>('B');
  const [contactIdx, setContactIdx] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) { setPhotoUrl(''); return; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const setFile = (f: File | null) => {
    if (!f) return;
    setPhoto(f);
  };

  const resetForAnother = () => {
    setPhoto(null);
    setTitle('');
    setLocation('');
    // área, oficio, prioridad y responsable se conservan — en obra sueles seguir en la misma zona
    setTimeout(() => fileRef.current?.click(), 150);
  };

  const save = async (another: boolean) => {
    if (!title.trim()) {
      setError(labels.titlePlaceholder);
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const contact = contactIdx !== '' ? contacts[Number(contactIdx)] : null;
      const res = await fetch('/api/punch-items', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          area: area.trim() || null,
          location: location.trim() || null,
          trade: trade || null,
          priority,
          assignedToName: contact?.name ?? null,
          assignedToEmail: contact?.email ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'error');

      // La foto no bloquea el guardado: si falla, el ítem ya existe
      if (photo) {
        try {
          const fd = new FormData();
          fd.append('file', photo);
          fd.append('fileName', photo.name);
          fd.append('contentType', photo.type || 'image/jpeg');
          fd.append('kind', 'issue');
          await fetch(`/api/punch-items/${data.id}/photo`, { method: 'POST', credentials: 'include', body: fd });
        } catch { /* el ítem quedó creado sin foto */ }
      }

      onSaved();
      if (another) {
        resetForAnother();
      } else {
        onClose();
      }
    } catch (e: any) {
      setError(e?.message ?? 'error');
    } finally {
      setBusy(false);
    }
  };

  const bigInput = 'w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-base focus:outline-none focus:border-[#C9A96E] bg-white';

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto">
        <div className="bg-[#0F1B33] px-5 py-4 flex items-center justify-between sticky top-0">
          <h3 className="text-white font-bold">{projectNumber}</h3>
          <button onClick={onClose} disabled={busy} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* PASO 1: foto */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{labels.stepPhoto}</p>
            {photoUrl ? (
              <div className="relative">
                <img src={photoUrl} alt="" className="w-full rounded-xl max-h-56 object-cover" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setMarking(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-[#C9A96E] text-[#0F1B33] text-sm font-semibold">
                    <PenLine className="w-4 h-4" /> {labels.markPhoto}
                  </button>
                  <button onClick={() => fileRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-semibold">
                    <Camera className="w-4 h-4" /> {labels.changePhoto}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-[#C9A96E] rounded-xl p-6 text-center hover:bg-amber-50 transition-colors">
                <Camera className="w-9 h-9 text-[#C9A96E] mx-auto mb-1.5" />
                <p className="font-semibold text-[#0F1B33]">{labels.takePhoto}</p>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </div>

          {/* PASO 2: datos */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{labels.stepData}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{labels.area}</label>
                <input list="qc-areas" value={area} onChange={(e) => setArea(e.target.value)} placeholder={labels.areaPlaceholder} className={bigInput} />
                <datalist id="qc-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{labels.location}</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={labels.locationPlaceholder} className={bigInput} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{labels.trade}</label>
              <input list="qc-trades" value={trade} onChange={(e) => setTrade(e.target.value)} className={bigInput} />
              <datalist id="qc-trades">{trades.map((tr) => <option key={tr} value={tr} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{labels.title}</label>
              <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={labels.titlePlaceholder} className={bigInput} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{labels.priority}</label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button key={p} onClick={() => setPriority(p)}
                    className={`flex-1 py-3 rounded-xl font-black text-lg border-2 transition-colors ${priority === p
                      ? p === 'A' ? 'bg-red-600 border-red-600 text-white' : p === 'B' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-400 border-slate-400 text-white'
                      : 'border-slate-200 text-slate-400'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {contacts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{labels.assignNow}</label>
                <select value={contactIdx} onChange={(e) => setContactIdx(e.target.value)} className={bigInput}>
                  <option value="">—</option>
                  {contacts.map((c, i) => (
                    <option key={i} value={i}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <div className="flex gap-3 pb-2">
            <button onClick={() => void save(true)} disabled={busy}
              className="flex-1 py-3.5 rounded-xl border-2 border-[#0F1B33] text-[#0F1B33] font-bold disabled:opacity-50">
              {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : labels.saveAnother}
            </button>
            <button onClick={() => void save(false)} disabled={busy}
              className="flex-1 py-3.5 rounded-xl bg-[#0F1B33] text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> {labels.save}</>}
            </button>
          </div>
        </div>
      </div>

      {marking && photo && (
        <PhotoMarkupEditor
          file={photo}
          onDone={(marked) => { setPhoto(marked); setMarking(false); }}
          onCancel={() => setMarking(false)}
          labels={{ undo: labels.undo, clear: labels.clear, cancel: labels.cancel, done: labels.done }}
        />
      )}
    </div>
  );
}
