'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardCheck, Loader2, Upload, Eye } from 'lucide-react';

interface PublicInfo {
  id: string;
  category: string;
  deliverable: string;
  responsible: string | null;
  status: string;
  fileName: string | null;
  alreadyUploaded: boolean;
  projectName: string;
  projectNumber: string | null;
  gcName: string;
}

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,image/*';
const MAX_MB = 25;

const STR = {
  en: {
    brandSub: 'Closeout Document Request',
    notAvailable: 'Link not available',
    notAvailableMsg: 'This document request link is invalid or has expired.',
    title: 'Closeout Document Requested',
    received: 'Document received!',
    receivedMsg: 'Thank you. The GC team has been notified.',
    category: 'Category:',
    deliverable: 'Deliverable:',
    responsible: 'Responsible:',
    alreadyMsg: (f: string | null) => `A document (${f || 'file'}) was already received. Uploading a new one will replace it.`,
    uploading: 'Uploading...',
    selectDoc: 'Click to select the document',
    formats: (mb: number) => `PDF, Word, Excel or image · max ${mb}MB`,
    tooLarge: (mb: number) => `File too large (max ${mb}MB)`,
    failed: 'Upload failed',
    secureNote: 'Secure link — no account needed. Do not share this link.',
    powered: 'Powered by',
  },
  es: {
    brandSub: 'Solicitud de Documento de Cierre',
    notAvailable: 'Enlace no disponible',
    notAvailableMsg: 'Este enlace de solicitud de documento no es válido o expiró.',
    title: 'Documento de Cierre Solicitado',
    received: '¡Documento recibido!',
    receivedMsg: 'Gracias. El equipo del GC fue notificado.',
    category: 'Categoría:',
    deliverable: 'Entregable:',
    responsible: 'Responsable:',
    alreadyMsg: (f: string | null) => `Ya se recibió un documento (${f || 'archivo'}). Si subes uno nuevo, lo reemplazará.`,
    uploading: 'Subiendo...',
    selectDoc: 'Haz clic para seleccionar el documento',
    formats: (mb: number) => `PDF, Word, Excel o imagen · máx. ${mb}MB`,
    tooLarge: (mb: number) => `Archivo muy grande (máx. ${mb}MB)`,
    failed: 'Error al subir',
    secureNote: 'Enlace seguro — no necesitas cuenta. No compartas este enlace.',
    powered: 'Desarrollado por',
  },
} as const;

export default function CloseoutRespondPage() {
  const params = useParams();
  const token = params.token as string;
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const L = STR[lang];
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/closeout-items/public/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() => setNotFound(true));
  }, [token]);

  const upload = async (file: File) => {
    if (uploading) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(L.tooLarge(MAX_MB));
      return;
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/closeout-items/public/${token}`, { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || L.failed);
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : L.failed);
    } finally {
      setUploading(false);
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

  const brandHeader = (
    <div className="text-center mb-6">
      <p className="text-2xl font-bold text-white tracking-tight">koduPM</p>
      <p className="text-xs text-[#C9A96E] uppercase tracking-[0.25em] mt-1">{L.brandSub}</p>
    </div>
  );

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0F1B33] flex items-center justify-center p-4">
        <div className="max-w-md w-full">{langToggle}{brandHeader}
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
            <h1 className="text-xl font-bold text-slate-900 mb-2">{L.notAvailable}</h1>
            <p className="text-slate-600 text-sm">{L.notAvailableMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-[#0F1B33] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1B33] py-8 px-4">
      <div className="max-w-lg mx-auto">
        {langToggle}
        {brandHeader}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-[#C9A96E] px-6 py-4">
            <h1 className="text-lg font-bold text-[#0F1B33]">{L.title}</h1>
            <p className="text-sm text-[#0F1B33]/80">{info.projectName}{info.projectNumber ? ` · #${info.projectNumber}` : ''} · {info.gcName}</p>
          </div>
          <div className="p-6 space-y-5">
            {done ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">{L.received}</h2>
                <p className="text-slate-600 text-sm">{L.receivedMsg}</p>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">{L.category}</span><span className="font-medium text-slate-900">{info.category}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500 shrink-0">{L.deliverable}</span><span className="font-medium text-slate-900 text-right">{info.deliverable}</span></div>
                  {info.responsible && (
                    <div className="flex justify-between"><span className="text-slate-500">{L.responsible}</span><span className="font-medium text-slate-900">{info.responsible}</span></div>
                  )}
                </div>

                {info.alreadyUploaded && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800">
                    {L.alreadyMsg(info.fileName)}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void upload(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors border-slate-300 hover:border-[#C9A96E] hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-3" />
                  ) : (
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  )}
                  <p className="font-medium text-slate-900">{uploading ? L.uploading : L.selectDoc}</p>
                  <p className="text-xs text-slate-500 mt-1">{L.formats(MAX_MB)}</p>
                </button>
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              </>
            )}
          </div>
          <div className="border-t border-slate-100 px-6 py-3 flex items-center gap-2 text-xs text-slate-400">
            <Eye className="w-3.5 h-3.5" />
            {L.secureNote}
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">{L.powered} <span className="font-semibold text-slate-300">koduPM</span> — Construction Project Management</p>
      </div>
    </div>
  );
}
