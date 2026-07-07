'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  CalendarDays,
  Camera,
  ClipboardList,
  Download,
  FileQuestion,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Save,
  Send,
} from 'lucide-react';
import {
  WEATHER_OPTIONS,
  dateKey,
  formatLogDate,
  weekRangeEnding,
} from '@/lib/daily-log';

interface ProjectOpt {
  id: string;
  projectNumber: string;
  projectName: string;
}

interface PhotoOpt {
  id: string;
  imageUrl: string;
  caption: string | null;
  tag: string;
  dailyLogId: string | null;
}

interface DailyLogRow {
  id: string;
  logDate: string;
  authorName: string;
  weather: string | null;
  temperature: string | null;
  workPerformed: string | null;
  crewNotes: string | null;
  deliveries: string | null;
  delays: string | null;
  status: string;
  photos?: PhotoOpt[];
  _count?: { photos: number };
}

export function DailyLogsContent({
  projects,
  initialProjectId,
  currentUser,
}: {
  projects: ProjectOpt[];
  initialProjectId?: string;
  currentUser?: { name: string; email: string };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || '');
  const [logDate, setLogDate] = useState(dateKey(new Date()));
  const [log, setLog] = useState<DailyLogRow | null>(null);
  const [history, setHistory] = useState<DailyLogRow[]>([]);
  const [dayPhotos, setDayPhotos] = useState<PhotoOpt[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => weekRangeEnding().from);
  const [reportTo, setReportTo] = useState(() => weekRangeEnding().to);
  const [reportOverview, setReportOverview] = useState('');
  const [reportTcoTarget, setReportTcoTarget] = useState('');
  const [reportOptionsOpen, setReportOptionsOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const [form, setForm] = useState({
    weather: '',
    temperature: '',
    workPerformed: '',
    crewNotes: '',
    deliveries: '',
    delays: '',
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const loadHistory = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/daily-logs`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setHistory(data.logs || []);
    }
  }, [projectId]);

  const loadDay = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [logRes, photoRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/daily-logs?date=${logDate}`, { credentials: 'include' }),
        fetch(`/api/projects/${projectId}/photos?from=${logDate}&to=${logDate}`, { credentials: 'include' }),
      ]);

      const logData = logRes.ok ? await logRes.json() : { log: null };
      const photoData = photoRes.ok ? await photoRes.json() : { photos: [] };

      const existing = logData.log as DailyLogRow | null;
      setLog(existing);
      setDayPhotos(photoData.photos || []);

      if (existing) {
        setForm({
          weather: existing.weather ?? '',
          temperature: existing.temperature ?? '',
          workPerformed: existing.workPerformed ?? '',
          crewNotes: existing.crewNotes ?? '',
          deliveries: existing.deliveries ?? '',
          delays: existing.delays ?? '',
        });
        setSelectedPhotoIds((existing.photos || []).map((p) => p.id));
      } else {
        setForm({
          weather: '',
          temperature: '',
          workPerformed: '',
          crewNotes: '',
          deliveries: '',
          delays: '',
        });
        setSelectedPhotoIds([]);
      }
    } catch {
      toast({ title: 'Error al cargar daily log', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [projectId, logDate, toast]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { loadDay(); }, [loadDay]);

  const togglePhoto = (id: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async (status: 'Draft' | 'Submitted' | 'Approved') => {
    if (!projectId) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        logDate,
        authorName: currentUser?.name || 'Superintendent',
        status,
        photoIds: selectedPhotoIds,
      };

      let res: Response;
      if (log?.id) {
        res = await fetch(`/api/projects/${projectId}/daily-logs/${log.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/projects/${projectId}/daily-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      toast({
        title: status === 'Submitted' ? 'Daily log enviado' : status === 'Approved' ? 'Daily log aprobado' : 'Borrador guardado',
      });
      await loadDay();
      await loadHistory();
    } catch (e: any) {
      toast({ title: e?.message ?? 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startVoice = (targetField: 'workPerformed' | 'delays') => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: 'Voz no disponible en este navegador', variant: 'destructive' });
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (ev: any) => {
      const text = ev.results[0][0].transcript;
      update(targetField, form[targetField] ? `${form[targetField]}\n${text}` : text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const draftRfiFromDelays = () => {
    const note = form.delays || form.workPerformed;
    if (!note.trim()) {
      toast({ title: 'Escribe algo en Delays o Work performed', variant: 'destructive' });
      return;
    }
    sessionStorage.setItem('kodu_rfi_draft_note', note);
    router.push(`/dashboard/rfis/new?projectId=${projectId}&fromDailyLog=1`);
  };

  const downloadOwnerFieldReport = async () => {
    if (!projectId) return;
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/field-report/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          from: reportFrom,
          to: reportTo,
          ...(reportOverview.trim() ? { overview: reportOverview.trim() } : {}),
          ...(reportTcoTarget.trim() ? { tcoTarget: reportTcoTarget.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'No se pudo generar el PDF');
      }
      const blob = await res.blob();
      const proj = projects.find((p) => p.id === projectId);
      const fname = `REPORT_${proj?.projectNumber ?? 'project'}_${reportTo}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'PDF generado — listo para enviar al owner' });
    } catch (e: any) {
      toast({ title: e?.message ?? 'Error al generar PDF', variant: 'destructive' });
    } finally {
      setGeneratingReport(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#C9A96E]" /> Daily Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reporte diario de obra — conectado a Site Photos
          </p>
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-background text-sm min-w-[220px]"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>#{p.projectNumber} — {p.projectName}</option>
          ))}
        </select>
      </div>

      {/* Owner field report PDF */}
      <div className="bg-gradient-to-br from-[#0F1B33]/5 to-[#C9A96E]/10 border border-[#C9A96E]/25 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C9A96E]" />
              Reporte semanal para Owner (PDF)
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">
              Formato Ritz / PDG: Overview, Field Status, Photography, Milestones, Open Items y Action Items — auto desde daily logs, fotos y RFIs.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Desde</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="block mt-0.5 px-2 py-1.5 border rounded-lg bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Hasta</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="block mt-0.5 px-2 py-1.5 border rounded-lg bg-background text-sm"
              />
            </div>
            <button
              type="button"
              disabled={generatingReport || !projectId}
              onClick={() => {
                const w = weekRangeEnding();
                setReportFrom(w.from);
                setReportTo(w.to);
              }}
              className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted"
            >
              Última semana
            </button>
            <button
              type="button"
              disabled={generatingReport || !projectId}
              onClick={downloadOwnerFieldReport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F1B33] text-[#C9A96E] rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generatingReport ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReportOptionsOpen((o) => !o)}
          className="mt-3 text-xs text-[#0F1B33] font-medium underline-offset-2 hover:underline"
        >
          {reportOptionsOpen ? 'Ocultar opciones Ritz' : 'Opciones Ritz (Overview, TCO)'}
        </button>
        {reportOptionsOpen && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">
                1. Project Overview (opcional — si vacío, se arma desde los daily logs)
              </label>
              <textarea
                value={reportOverview}
                onChange={(e) => setReportOverview(e.target.value)}
                rows={3}
                placeholder="Narrativa ejecutiva para el owner, estilo Ritz…"
                className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm resize-y"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">
                TCO Target (opcional)
              </label>
              <input
                type="text"
                value={reportTcoTarget}
                onChange={(e) => setReportTcoTarget(e.target.value)}
                placeholder="ej. Last week of October 2026 · Zero float"
                className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background"
          />
        </label>
        {log && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            log.status === 'Approved' ? 'bg-green-100 text-green-800'
              : log.status === 'Submitted' ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {log.status}
          </span>
        )}
        <p className="text-sm text-muted-foreground">{formatLogDate(logDate)}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border rounded-xl p-5 space-y-4 shadow-sm">
            <p className="font-medium text-sm text-muted-foreground">
              {selectedProject ? `#${selectedProject.projectNumber} — ${selectedProject.projectName}` : ''}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Weather</label>
                <select value={form.weather} onChange={(e) => update('weather', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm">
                  <option value="">—</option>
                  {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Temp (°F)</label>
                <input value={form.temperature} onChange={(e) => update('temperature', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" placeholder="85" />
              </div>
            </div>

            {(['workPerformed', 'crewNotes', 'deliveries', 'delays'] as const).map((field) => (
              <div key={field}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                  {(field === 'workPerformed' || field === 'delays') && (
                    <button
                      type="button"
                      onClick={() => startVoice(field)}
                      disabled={listening}
                      className="text-xs inline-flex items-center gap-1 text-[#C9A96E] hover:underline disabled:opacity-50"
                    >
                      {listening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      Voz
                    </button>
                  )}
                </div>
                <textarea
                  value={form[field]}
                  onChange={(e) => update(field, e.target.value)}
                  rows={field === 'workPerformed' ? 4 : 2}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                />
              </div>
            ))}

            {form.delays.trim() && (
              <button
                type="button"
                onClick={draftRfiFromDelays}
                className="inline-flex items-center gap-2 text-sm text-[#0F1B33] font-medium hover:underline"
              >
                <FileQuestion className="w-4 h-4" /> Crear borrador RFI desde delays
              </button>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" disabled={saving} onClick={() => save('Draft')} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50">
                <Save className="w-4 h-4" /> Guardar borrador
              </button>
              <button type="button" disabled={saving} onClick={() => save('Submitted')} className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A96E] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar al PM
              </button>
              {log?.status === 'Submitted' && (
                <button type="button" disabled={saving} onClick={() => save('Approved')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  Aprobar
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Fotos del día
                </h2>
                <Link href={`/dashboard/photos?projectId=${projectId}`} className="text-xs text-[#C9A96E] hover:underline">
                  + Subir
                </Link>
              </div>
              {dayPhotos.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay fotos para esta fecha. Sube en Site Photos.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {dayPhotos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePhoto(p.id)}
                      className={`relative aspect-square rounded overflow-hidden border-2 ${
                        selectedPhotoIds.includes(p.id) ? 'border-[#C9A96E]' : 'border-transparent'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">
                Toca para incluir en el daily log ({selectedPhotoIds.length} seleccionadas)
              </p>
            </div>

            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <h2 className="font-semibold text-sm mb-3">Historial reciente</h2>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {history.length === 0 && <li className="text-xs text-muted-foreground">Sin logs aún</li>}
                {history.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setLogDate(dateKey(h.logDate))}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted ${
                        dateKey(h.logDate) === logDate ? 'bg-muted font-medium' : ''
                      }`}
                    >
                      {formatLogDate(h.logDate)}
                      <span className="ml-2 text-muted-foreground">{h.status} · {h._count?.photos ?? 0} fotos</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
