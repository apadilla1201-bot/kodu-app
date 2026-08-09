'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Plus, X, Check, FileText } from 'lucide-react';
import { getStorageDownloadUrl } from '@/lib/upload-client';

export type BoardItem = {
  id: string;
  itemNumber: number;
  title: string;
  status: string;
  priority: string;
  planSheetId: string | null;
  pinX: number | null;
  pinY: number | null;
  dueDate: string | null;
  assignedToName: string | null;
};

type SheetOpt = {
  id: string; sheetNumber: string; title: string; display: string;
  fileUrl: string | null; fileIsPublic: boolean;
};

export type BoardLabels = {
  pickSheet: string; noPlans: string; noPlansDesc: string; noFile: string;
  loadError: string; addPin: string; addPinHint: string; cancelAdd: string;
  pinTitle: string; pinTitlePlaceholder: string; pinPriority: string;
  pinSave: string; pinCancel: string; pinSaved: string; pinError: string;
  openItems: string; legendOpen: string; legendReady: string; legendDone: string;
  backToList: string;
};

const PRIORITIES = ['A', 'B', 'C'] as const;

function pinColor(status: string): string {
  if (status === 'Completed') return '#16a34a';
  if (status === 'Ready for Review') return '#9333ea';
  return '#dc2626';
}

/**
 * Tablero de chinchetas sobre el plano:
 * - Renderiza la página 1 del PDF vigente del plano (pdf.js).
 * - Pins de los ítems vinculados (rojo abierto, morado listo, verde completado).
 * - Modo "Añadir pin": clic en el plano → mini-form → ítem nuevo con planSheetId+pinX+pinY.
 */
export function PunchPlanBoard({ projectId, items, labels, onChanged, onOpenList }: {
  projectId: string;
  items: BoardItem[];
  labels: BoardLabels;
  onChanged: () => void;
  onOpenList: (itemId: string) => void;
}) {
  const [sheets, setSheets] = useState<SheetOpt[]>([]);
  const [sheetsLoaded, setSheetsLoaded] = useState(false);
  const [sheetId, setSheetId] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPriority, setDraftPriority] = useState<'A' | 'B' | 'C'>('B');
  const [saving, setSaving] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Cargar planos del proyecto (Plan Room)
  useEffect(() => {
    let alive = true;
    fetch(`/api/plan-sheets/lookup?projectId=${projectId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setSheets(list);
        setSheetsLoaded(true);
        const firstWithFile = list.find((s: SheetOpt) => s.fileUrl) ?? list[0];
        if (firstWithFile) setSheetId((prev) => prev || firstWithFile.id);
      })
      .catch(() => { if (alive) setSheetsLoaded(true); });
    return () => { alive = false; };
  }, [projectId]);

  const sheet = sheets.find((s) => s.id === sheetId) ?? null;

  // Render del PDF (página 1) cuando cambia el plano
  useEffect(() => {
    let alive = true;
    setPageSize(null);
    setDraft(null);
    setAddMode(false);
    setActivePin(null);
    if (!sheet?.fileUrl) return;
    (async () => {
      setPdfLoading(true);
      setPdfError('');
      try {
        const url = await getStorageDownloadUrl(sheet.fileUrl!);
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
        (pdfjs as any).GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjs as any).version}/pdf.worker.min.js`;
        const doc = await (pdfjs as any).getDocument({ url }).promise;
        const page = await doc.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const maxW = Math.min(1400, wrapRef.current?.clientWidth ?? 1000);
        const scale = maxW / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || !alive) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        if (alive) setPageSize({ w: viewport.width, h: viewport.height });
      } catch (e: any) {
        console.error('plan board pdf:', e);
        if (alive) setPdfError(labels.loadError);
      } finally {
        if (alive) setPdfLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.fileUrl]);

  const pins = items.filter((it) => it.planSheetId === sheetId && it.pinX != null && it.pinY != null);

  const onPlanClick = (e: React.MouseEvent) => {
    if (!addMode || !pageSize) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDraft({
      x: Math.min(0.99, Math.max(0.01, (e.clientX - rect.left) / rect.width)),
      y: Math.min(0.99, Math.max(0.01, (e.clientY - rect.top) / rect.height)),
    });
    setDraftTitle('');
    setDraftPriority('B');
  };

  const savePin = async () => {
    if (!draft || !draftTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/punch-items', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: draftTitle.trim(),
          priority: draftPriority,
          planSheetId: sheetId,
          pinX: draft.x,
          pinY: draft.y,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      setDraft(null);
      setAddMode(false);
      onChanged();
    } catch (e: any) {
      alert(e?.message ?? labels.pinError);
    } finally {
      setSaving(false);
    }
  };

  if (sheetsLoaded && sheets.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-10 text-center">
        <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="font-medium text-foreground">{labels.noPlans}</p>
        <p className="text-sm text-muted-foreground">{labels.noPlansDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select value={sheetId} onChange={(e) => setSheetId(e.target.value)}
          className="px-3 py-2 rounded-md border border-border bg-background text-sm max-w-md">
          {sheets.map((s) => <option key={s.id} value={s.id}>{s.display}</option>)}
        </select>
        {sheet && !sheet.fileUrl && <span className="text-xs text-amber-600 font-semibold">{labels.noFile}</span>}
        <div className="flex-1" />
        {sheet?.fileUrl && pageSize && !addMode && (
          <button onClick={() => setAddMode(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-bold hover:bg-red-700">
            <Plus className="w-4 h-4" /> {labels.addPin}
          </button>
        )}
        {addMode && (
          <button onClick={() => { setAddMode(false); setDraft(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-red-300 text-red-600 text-sm font-bold">
            <X className="w-4 h-4" /> {labels.cancelAdd}
          </button>
        )}
      </div>

      {addMode && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm font-semibold text-red-700 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> {labels.addPinHint}
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground">
        <span>{labels.openItems}: {pins.filter((p) => p.status !== 'Completed').length}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#dc2626' }} /> {labels.legendOpen}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#9333ea' }} /> {labels.legendReady}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#16a34a' }} /> {labels.legendDone}</span>
      </div>

      <div ref={wrapRef} className="relative bg-slate-100 rounded-lg border border-border overflow-auto">
        {pdfLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {pdfError && <p className="text-center py-16 text-sm text-red-600 font-medium">{pdfError}</p>}

        <div className="relative inline-block" onClick={onPlanClick} style={{ cursor: addMode ? 'crosshair' : 'default' }}>
          <canvas ref={canvasRef} className="block max-w-none" />

          {/* Pins existentes */}
          {pageSize && pins.map((it) => (
            <button
              key={it.id}
              onClick={(e) => { e.stopPropagation(); setActivePin(activePin === it.id ? null : it.id); }}
              className="absolute -translate-x-1/2 -translate-y-full transition-transform hover:scale-110 z-10"
              style={{ left: `${(it.pinX ?? 0) * 100}%`, top: `${(it.pinY ?? 0) * 100}%` }}
              title={`PL-${String(it.itemNumber).padStart(3, '0')} — ${it.title}`}
            >
              <span
                className="flex items-center justify-center w-7 h-7 rounded-full rounded-bl-none text-white text-[11px] font-black shadow-lg border-2 border-white"
                style={{ background: pinColor(it.status), transform: 'rotate(-45deg)' }}
              >
                <span style={{ transform: 'rotate(45deg)' }}>{it.itemNumber}</span>
              </span>
            </button>
          ))}

          {/* Pin borrador */}
          {pageSize && draft && (
            <div className="absolute -translate-x-1/2 -translate-y-full z-20" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}>
              <span className="flex items-center justify-center w-8 h-8 rounded-full rounded-bl-none bg-red-600 text-white shadow-xl border-2 border-white animate-bounce" style={{ transform: 'rotate(-45deg)' }}>
                <MapPin className="w-4 h-4" style={{ transform: 'rotate(45deg)' }} />
              </span>
            </div>
          )}

          {/* Popover ítem existente */}
          {pageSize && activePin && (() => {
            const it = pins.find((p) => p.id === activePin);
            if (!it) return null;
            return (
              <div
                className="absolute z-30 bg-white rounded-xl shadow-2xl border border-border p-4 w-72"
                style={{ left: `min(${((it.pinX ?? 0) * 100)}%, calc(100% - 300px))`, top: `${(it.pinY ?? 0) * 100 + 2}%` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm text-[#0F1B33]">PL-{String(it.itemNumber).padStart(3, '0')} — {it.title}</p>
                  <button onClick={() => setActivePin(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <p><span className="font-semibold">{labels.pinPriority}:</span> {it.priority} · {it.status}</p>
                  {it.assignedToName && <p>{it.assignedToName}</p>}
                  {it.dueDate && <p>{new Date(it.dueDate).toLocaleDateString()}</p>}
                </div>
                <button onClick={() => onOpenList(it.id)}
                  className="mt-3 w-full py-2 rounded-lg bg-[#0F1B33] text-white text-xs font-bold">
                  {labels.backToList}
                </button>
              </div>
            );
          })()}

          {/* Mini-form del pin nuevo */}
          {pageSize && draft && (
            <div
              className="absolute z-30 bg-white rounded-xl shadow-2xl border border-border p-4 w-80"
              style={{ left: `min(${draft.x * 100}%, calc(100% - 330px))`, top: `min(${draft.y * 100 + 3}%, calc(100% - 190px))` }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">{labels.pinTitle}</p>
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder={labels.pinTitlePlaceholder}
                className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 text-sm focus:outline-none focus:border-[#C9A96E]"
                onKeyDown={(e) => { if (e.key === 'Enter') void savePin(); }}
              />
              <div className="flex gap-2 mt-3">
                {PRIORITIES.map((p) => (
                  <button key={p} onClick={() => setDraftPriority(p)}
                    className={`flex-1 py-2 rounded-lg font-black border-2 ${draftPriority === p
                      ? p === 'A' ? 'bg-red-600 border-red-600 text-white' : p === 'B' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-400 border-slate-400 text-white'
                      : 'border-slate-200 text-slate-400'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setDraft(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  {labels.pinCancel}
                </button>
                <button onClick={() => void savePin()} disabled={saving || !draftTitle.trim()}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {labels.pinSave}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
