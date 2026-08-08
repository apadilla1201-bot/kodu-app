'use client';

import { useEffect, useRef, useState } from 'react';
import { Undo2, Trash2, Check, X } from 'lucide-react';

type Stroke = { color: string; width: number; points: { x: number; y: number }[] };

/**
 * Marcado de foto con el dedo/mouse: círculos y flechas estilo obra.
 * Dibuja sobre la imagen y exporta un JPEG listo para subir.
 */
export function PhotoMarkupEditor({ file, onDone, onCancel, labels }: {
  file: File;
  onDone: (marked: File) => void;
  onCancel: () => void;
  labels: { undo: string; clear: string; cancel: string; done: string };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = 900;
      const scale = Math.min(1, maxW / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      redraw();
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const redraw = (extra?: Stroke | null) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const st of [...strokes, ...(extra ? [extra] : [])]) {
      if (st.points.length < 2) continue;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (const p of st.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = { color: '#FF3B30', width: Math.max(4, canvasRef.current!.width / 180), points: [pos(e)] };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current.points.push(pos(e));
    redraw(drawing.current);
  };
  const onUp = () => {
    if (!drawing.current) return;
    if (drawing.current.points.length > 1) {
      setStrokes((st) => {
        const next = [...st, drawing.current!];
        setTimeout(() => redraw(), 0);
        return next;
      });
    }
    drawing.current = null;
    redraw();
  };

  const undo = () => {
    setStrokes((st) => {
      const next = st.slice(0, -1);
      setTimeout(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const s2 of next) {
          if (s2.points.length < 2) continue;
          ctx.strokeStyle = s2.color;
          ctx.lineWidth = s2.width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s2.points[0].x, s2.points[0].y);
          for (const p of s2.points.slice(1)) ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }, 0);
      return next;
    });
  };

  const exportFile = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const name = file.name.replace(/\.[^.]+$/, '') + '-marked.jpg';
      onDone(new File([blob], name, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col items-center justify-center p-3">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-3xl">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0F1B33]">
          <div className="flex gap-2">
            <button onClick={undo} disabled={strokes.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold disabled:opacity-40">
              <Undo2 className="w-3.5 h-3.5" /> {labels.undo}
            </button>
            <button onClick={() => { setStrokes([]); setTimeout(() => redraw(), 0); }} disabled={strokes.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" /> {labels.clear}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/70 hover:text-white text-xs font-semibold">
              <X className="w-3.5 h-3.5" /> {labels.cancel}
            </button>
            <button onClick={exportFile} disabled={!ready}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#C9A96E] text-[#0F1B33] text-xs font-bold disabled:opacity-40">
              <Check className="w-3.5 h-3.5" /> {labels.done}
            </button>
          </div>
        </div>
        <div className="max-h-[75vh] overflow-auto bg-slate-900 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="touch-none max-w-full h-auto cursor-crosshair"
          />
        </div>
      </div>
    </div>
  );
}
