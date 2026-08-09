'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Check, ChevronRight, Camera, X, Loader2, Flag } from 'lucide-react';

type ProjectContact = { name: string; email: string; company: string | null; role: string };

export type WalkLabels = {
  tapMic: string; listening: string; heard: string; nextArea: string;
  finishArea: string; itemSaved: string; areaOf: (c: number, t: number) => string;
  itemsInArea: (n: number) => string; noAreas: string; voiceError: string;
  voiceUnsupported: string; selectArea: string; done: string;
  totalCaptured: (n: number) => string; backToList: string; saveError: string;
  saveBtn: string;
};

const PRIORITIES = ['A', 'B', 'C'] as const;
const PRIO_STYLE: Record<string, string> = {
  A: 'bg-red-600 border-red-600',
  B: 'bg-amber-500 border-amber-500',
  C: 'bg-slate-400 border-slate-400',
};

// Web Speech API (gratis, EN/ES, Chrome/Android + Safari iOS)
function getRecognizer(lang: string, onResult: (text: string, final: boolean) => void, onEnd: () => void, onError: () => void): any {
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.onresult = (e: any) => {
    let final = '';
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    onResult(final || interim, Boolean(final));
  };
  rec.onend = onEnd;
  rec.onerror = onError;
  return rec;
}

/**
 * MODO CAMINATA — pantalla completa móvil para el punch walk.
 * Flujo por voz: mic gigante → dicta (área + oficio + descripción de una vez)
 * → revisa → prioridad → guardar → siguiente ítem. "Siguiente área" avanza la ruta.
 */
export function PunchWalkMode({ projectId, initialAreas, trades, contacts, locale, labels, onClose, onChanged }: {
  projectId: string;
  initialAreas: string[];
  trades: string[];
  contacts: ProjectContact[];
  locale: string;
  labels: WalkLabels;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [areaQueue, setAreaQueue] = useState<string[]>(initialAreas.length > 0 ? initialAreas : []);
  const [areaIdx, setAreaIdx] = useState(0);
  const [area, setArea] = useState(initialAreas[0] ?? '');
  const [customArea, setCustomArea] = useState('');
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [trade, setTrade] = useState('');
  const [priority, setPriority] = useState<'A' | 'B' | 'C'>('B');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [areaCount, setAreaCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [voiceMsg, setVoiceMsg] = useState('');
  const [finished, setFinished] = useState(false);
  const recRef = useRef<any>(null);
  const heardRef = useRef<HTMLTextAreaElement>(null);

  const voiceLang = locale === 'es' ? 'es-ES' : 'en-US';
  const currentArea = customArea.trim() || area;
  const totalAreas = Math.max(areaQueue.length, areaIdx + 1);

  const stopListening = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const toggleMic = () => {
    if (listening) { stopListening(); return; }
    setVoiceMsg('');
    const rec = getRecognizer(
      voiceLang,
      (text, isFinal) => {
        if (!isFinal) return; // solo texto confirmado — el interim reescribía y confundía
        setHeard((prev) => (prev ? prev + ' ' : '') + text.trim());
      },
      () => setListening(false),
      () => { setListening(false); setVoiceMsg(labels.voiceError); },
    );
    if (!rec) {
      setVoiceMsg(labels.voiceUnsupported);
      return;
    }
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  const save = async () => {
    if (!heard.trim()) { heardRef.current?.focus(); return; }
    setSaving(true);
    stopListening();
    try {
      const res = await fetch('/api/punch-items', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: heard.trim(),
          area: currentArea || null,
          trade: trade || null,
          priority,
        }),
      });
      if (!res.ok) throw new Error();
      setHeard('');
      setAreaCount((c) => c + 1);
      setTotalCount((c) => c + 1);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
      onChanged();
    } catch {
      setVoiceMsg(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  const nextArea = () => {
    setAreaCount(0);
    setHeard('');
    if (areaIdx + 1 < areaQueue.length) {
      setAreaIdx(areaIdx + 1);
      setArea(areaQueue[areaIdx + 1]);
      setCustomArea('');
    } else {
      // permitir área nueva al final de la ruta
      setAreaIdx(areaIdx + 1);
      setArea('');
      setCustomArea('');
    }
  };

  if (finished) {
    return (
      <div className="fixed inset-0 z-[70] bg-[#0F1B33] flex flex-col items-center justify-center p-6 text-center">
        <Flag className="w-14 h-14 text-[#C9A96E] mb-4" />
        <h2 className="text-2xl font-black text-white mb-2">{labels.done}</h2>
        <p className="text-white/70 text-lg mb-8">{labels.totalCaptured(totalCount)}</p>
        <button onClick={onClose}
          className="w-full max-w-xs py-4 rounded-2xl bg-[#C9A96E] text-[#0F1B33] font-black text-lg">
          {labels.backToList}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-[#0F1B33] flex flex-col">
      {/* Header: área + progreso */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[#C9A96E] text-xs font-bold uppercase tracking-widest">
            {labels.areaOf(Math.min(areaIdx + 1, totalAreas), totalAreas)}
          </p>
          {areaQueue.length > 0 && areaIdx < areaQueue.length ? (
            <h2 className="text-white text-3xl font-black mt-1">{area || labels.selectArea}</h2>
          ) : (
            <input
              value={customArea}
              onChange={(e) => setCustomArea(e.target.value)}
              placeholder={labels.selectArea}
              className="mt-1 bg-transparent text-white text-3xl font-black border-b-2 border-[#C9A96E] focus:outline-none w-full placeholder:text-white/30"
            />
          )}
          <p className="text-white/50 text-sm mt-1">{labels.itemsInArea(areaCount)}</p>
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white p-2"><X className="w-6 h-6" /></button>
      </div>

      {/* Transcripción */}
      <div className="flex-1 px-5 overflow-y-auto">
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">{labels.heard}</p>
        <textarea
          ref={heardRef}
          value={heard}
          onChange={(e) => setHeard(e.target.value)}
          rows={5}
          className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-4 text-white text-xl leading-relaxed focus:outline-none focus:border-[#C9A96E] resize-none placeholder:text-white/25"
          placeholder="…"
        />
        {voiceMsg && <p className="text-red-400 text-sm mt-2 font-medium">{voiceMsg}</p>}

        {/* Oficio + prioridad */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <input
            list="walk-trades"
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            placeholder="Trade / Oficio"
            className="bg-white/5 border-2 border-white/10 rounded-2xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#C9A96E] placeholder:text-white/30"
          />
          <datalist id="walk-trades">{trades.map((tr) => <option key={tr} value={tr} />)}</datalist>
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button key={p} onClick={() => setPriority(p)}
                className={`flex-1 rounded-2xl font-black text-xl border-2 transition-colors text-white ${priority === p ? PRIO_STYLE[p] : 'border-white/15 text-white/40'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MIC gigante + acciones */}
      <div className="px-5 pb-8 pt-4">
        <div className="flex items-center justify-center mb-5">
          <button
            onClick={toggleMic}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              listening ? 'bg-red-600 scale-110' : 'bg-[#C9A96E] hover:bg-[#D4A843]'
            }`}
            aria-label={listening ? labels.listening : labels.tapMic}
          >
            {listening && (
              <span className="absolute inset-0 rounded-full bg-red-600 animate-ping opacity-30" />
            )}
            {listening ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-[#0F1B33]" />}
          </button>
        </div>
        <p className="text-center text-white/50 text-sm mb-5">{listening ? labels.listening : labels.tapMic}</p>

        <div className="flex gap-3">
          <button
            onClick={nextArea}
            className="flex-1 py-4 rounded-2xl border-2 border-white/20 text-white font-bold inline-flex items-center justify-center gap-2"
          >
            {labels.nextArea} <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || !heard.trim()}
            className={`flex-[1.4] py-4 rounded-2xl font-black text-lg inline-flex items-center justify-center gap-2 transition-colors ${
              savedFlash ? 'bg-green-600 text-white' : 'bg-[#C9A96E] text-[#0F1B33] disabled:opacity-40'
            }`}
          >
            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : savedFlash ? labels.itemSaved : <><Check className="w-6 h-6" /> {labels.saveBtn}</>}
          </button>
        </div>

        <button onClick={() => setFinished(true)}
          className="w-full mt-3 py-3 text-white/50 text-sm font-semibold hover:text-white">
          {labels.finishArea}
        </button>
      </div>
    </div>
  );
}
