'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
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
  Upload,
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
  const { t, locale } = useI18n();
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
  const [reportPhotos, setReportPhotos] = useState<PhotoOpt[]>([]);
  const [selectedReportPhotoIds, setSelectedReportPhotoIds] = useState<string[]>([]);
  const [wordContext, setWordContext] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiPreview, setAiPreview] = useState<{
    overview: string;
    milestones: { title: string; bullets: string[] }[];
    openItems: { num: number; item: string; deadline: string; responsible: string; priority: string }[];
    actionItems: { num: number; action: string; responsible: string; targetDate: string }[];
  } | null>(null);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [reportMode, setReportMode] = useState<'dailyLogs' | 'pmReport'>('dailyLogs');
  const [uploadedDocText, setUploadedDocText] = useState('');
  const [extractingDoc, setExtractingDoc] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);
  const [pdfExtracted, setPdfExtracted] = useState<{
    logDate?: string;
    authorName?: string;
    weather?: string | null;
    temperature?: string | null;
    workPerformed?: string | null;
    crewNotes?: string | null;
    deliveries?: string | null;
    delays?: string | null;
    equipment?: string | null;
    inspections?: string | null;
    safetyNotes?: string | null;
    hoursWorked?: string | null;
  } | null>(null);

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
      toast({ title: t('errors.loadDailyLog'), variant: 'destructive' });
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
        title: status === 'Submitted' ? t('dailyLogs.logSubmitted') : status === 'Approved' ? t('dailyLogs.logApproved') : t('dailyLogs.draftSaved'),
      });
      await loadDay();
      await loadHistory();
    } catch (e: any) {
      toast({ title: e?.message ?? t('common.error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startVoice = (targetField: 'workPerformed' | 'delays') => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: t('errors.voiceUnavailable'), variant: 'destructive' });
      return;
    }
    const rec = new SR();
    rec.lang = locale === 'es' ? 'es-US' : 'en-US';
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
      toast({ title: t('errors.writeDelaysOrWork'), variant: 'destructive' });
      return;
    }
    sessionStorage.setItem('kodu_rfi_draft_note', note);
    router.push(`/dashboard/rfis/new?projectId=${projectId}&fromDailyLog=1`);
  };

  const handlePdfImport = async (file: File) => {
    if (!projectId) return;
    setImportingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/projects/${projectId}/daily-logs/import-pdf`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      const extracted = data.extracted;
      setPdfExtracted(extracted);

      if (extracted.logDate) setLogDate(extracted.logDate);
      setForm((f) => ({
        weather: extracted.weather ?? f.weather,
        temperature: extracted.temperature ?? f.temperature,
        workPerformed: extracted.workPerformed ?? f.workPerformed,
        crewNotes: extracted.crewNotes ?? f.crewNotes,
        deliveries: extracted.deliveries ?? f.deliveries,
        delays: extracted.delays ?? f.delays,
      }));

      toast({ title: t('dailyLogs.pdfImported') || 'Daily report imported — review and save' });
    } catch (e: any) {
      toast({ title: (t('dailyLogs.pdfImportFailed') || 'PDF import failed'), variant: 'destructive' });
    } finally {
      setImportingPdf(false);
    }
  };

  const loadReportPhotos = async () => {
    if (!projectId) return;
    try {
      const url = reportMode === 'pmReport'
        ? `/api/projects/${projectId}/photos`
        : `/api/projects/${projectId}/photos?from=${reportFrom}&to=${reportTo}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const photos = data.photos || [];
        setReportPhotos(photos);
        setSelectedReportPhotoIds(photos.map((p: PhotoOpt) => p.id));
      }
    } catch {
      /* ignore */
    }
  };

  const toggleReportPhoto = (id: string) => {
    setSelectedReportPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const analyzeWithAi = async () => {
    if (!projectId) return;
    setAiAnalyzing(true);
    try {
      const payload: any = {
        mode: reportMode,
        from: reportFrom,
        to: reportTo,
        wordContext: wordContext.trim(),
      };
      if (reportMode === 'pmReport') {
        payload.documentText = uploadedDocText.trim();
        payload.photoDescriptions = selectedReportPhotoIds.map((id) => {
          const p = reportPhotos.find((ph) => ph.id === id);
          return p ? `${p.caption || p.tag || 'Photo'} (${p.imageUrl})` : '';
        }).filter(Boolean);
      }
      const res = await fetch(`/api/projects/${projectId}/field-report/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'AI analysis failed');
      }
      const data = await res.json();
      setAiPreview(data);
      setShowAiPreview(true);
    } catch (e: any) {
      toast({ title: e?.message ?? 'AI analysis failed', variant: 'destructive' });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const downloadAiFieldReport = async () => {
    if (!projectId || !aiPreview) return;
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/field-report/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: reportMode,
          from: reportFrom,
          to: reportTo,
          overview: reportOverview.trim() || aiPreview.overview,
          tcoTarget: reportTcoTarget.trim(),
          photoIds: selectedReportPhotoIds,
          aiGenerated: {
            overview: aiPreview.overview,
            milestones: aiPreview.milestones,
            openItems: aiPreview.openItems,
            actionItems: aiPreview.actionItems,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || t('dailyLogs.pdfFailed'));
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
      toast({ title: t('errors.pdfReady') });
      setShowAiPreview(false);
    } catch (e: any) {
      toast({ title: e?.message ?? t('errors.generatePdf'), variant: 'destructive' });
    } finally {
      setGeneratingReport(false);
    }
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
        throw new Error(data?.error || t('dailyLogs.pdfFailed'));
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
      toast({ title: t('errors.pdfReady') });
    } catch (e: any) {
      toast({ title: e?.message ?? t('errors.generatePdf'), variant: 'destructive' });
    } finally {
      setGeneratingReport(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <>
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#C9A96E]" /> {t('dailyLogs.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('dailyLogs.subtitle')}
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
              {t('dailyLogs.weeklyReport')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">
              {t('dailyLogs.weeklyReportHint')}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('dailyLogs.from')}</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="block mt-0.5 px-2 py-1.5 border rounded-lg bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">{t('dailyLogs.to')}</label>
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
              {t('dailyLogs.lastWeek')}
            </button>
            <button
              type="button"
              disabled={generatingReport || !projectId}
              onClick={downloadOwnerFieldReport}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#0F1B33] text-[#0F1B33] rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generatingReport ? t('dailyLogs.generating') : t('dailyLogs.generatePdf')}
            </button>
            <button
              type="button"
              disabled={aiAnalyzing || !projectId}
              onClick={() => { loadReportPhotos(); setShowPhotoModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F1B33] text-[#C9A96E] rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {aiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {t('dailyLogs.aiExecutiveReport')}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReportOptionsOpen((o) => !o)}
          className="mt-3 text-xs text-[#0F1B33] font-medium underline-offset-2 hover:underline"
        >
          {reportOptionsOpen ? t('dailyLogs.ritzOptionsHide') : t('dailyLogs.ritzOptionsShow')}
        </button>
        {reportOptionsOpen && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">
                {t('dailyLogs.executiveNarrative')}
              </label>
              <textarea
                value={reportOverview}
                onChange={(e) => setReportOverview(e.target.value)}
                rows={3}
                placeholder={t('dailyLogs.executivePlaceholder')}
                className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm resize-y"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">
                {t('dailyLogs.milestoneWeek')}
              </label>
              <input
                type="text"
                value={reportTcoTarget}
                onChange={(e) => setReportTcoTarget(e.target.value)}
                placeholder={t('dailyLogs.milestonePlaceholder')}
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
          <div className="lg:col-span-2 space-y-4">
            {/* Import from Field Report PDF */}
            <div className="bg-gradient-to-br from-[#0F1B33]/5 to-[#2E7D32]/10 border border-[#2E7D32]/25 rounded-xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#2E7D32]" />
                    {t('dailyLogs.importFromPdf') || 'Import from Field Report PDF'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('dailyLogs.importFromPdfHint') || 'Upload a daily report PDF (Fieldwire, Procore, etc.) and AI will convert it to a Kodu Daily Log.'}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F1B33] text-[#C9A96E] rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {importingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importingPdf ? (t('dailyLogs.importingPdf') || 'Analyzing...') : (t('dailyLogs.selectPdf') || 'Select PDF')}
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePdfImport(file);
                      e.target.value = '';
                    }}
                    disabled={importingPdf}
                    className="hidden"
                  />
                </label>
              </div>
              {pdfExtracted && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs font-medium text-green-800">
                    {t('dailyLogs.pdfExtracted') || 'Extracted from PDF:'} {pdfExtracted.authorName ? `— ${pdfExtracted.authorName}` : ''} {pdfExtracted.logDate ? `(${pdfExtracted.logDate})` : ''}
                  </p>
                  <p className="text-[10px] text-green-600 mt-1">
                    {t('dailyLogs.reviewAndSave') || 'Review the fields below and click Save Draft or Send to PM.'}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-card border rounded-xl p-5 space-y-4 shadow-sm">
              <p className="font-medium text-sm text-muted-foreground">
                {selectedProject ? `#${selectedProject.projectNumber} — ${selectedProject.projectName}` : ''}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">{t('dailyLogs.weather')}</label>
                  <select value={form.weather} onChange={(e) => update('weather', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm">
                    <option value="">—</option>
                    {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">{t('dailyLogs.temperature')}</label>
                  <input value={form.temperature} onChange={(e) => update('temperature', e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm" placeholder="85" />
                </div>
              </div>

              {(['workPerformed', 'crewNotes', 'deliveries', 'delays'] as const).map((field) => {
                const fieldLabels: Record<typeof field, string> = {
                  workPerformed: t('dailyLogs.workPerformed'),
                  crewNotes: t('dailyLogs.crewNotes'),
                  deliveries: t('dailyLogs.deliveries'),
                  delays: t('dailyLogs.delays'),
                };
                return (
                <div key={field}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">{fieldLabels[field]}</label>
                    {(field === 'workPerformed' || field === 'delays') && (
                      <button
                        type="button"
                        onClick={() => startVoice(field)}
                        disabled={listening}
                        className="text-xs inline-flex items-center gap-1 text-[#C9A96E] hover:underline disabled:opacity-50"
                      >
                        {listening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        {t('dailyLogs.voice')}
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
              );})}

              {form.delays.trim() && (
                <button
                  type="button"
                  onClick={draftRfiFromDelays}
                  className="inline-flex items-center gap-2 text-sm text-[#0F1B33] font-medium hover:underline"
                >
                  <FileQuestion className="w-4 h-4" /> {t('dailyLogs.draftRfi')}
                </button>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" disabled={saving} onClick={() => save('Draft')} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50">
                  <Save className="w-4 h-4" /> {t('dailyLogs.saveDraft')}
                </button>
                <button type="button" disabled={saving} onClick={() => save('Submitted')} className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A96E] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t('dailyLogs.sendToPm')}
                </button>
                {log?.status === 'Submitted' && (
                  <button type="button" disabled={saving} onClick={() => save('Approved')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {t('dailyLogs.approve')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4" /> {t('dailyLogs.photosOfDay')}
                </h2>
                <Link href={`/dashboard/photos?projectId=${projectId}`} className="text-xs text-[#C9A96E] hover:underline">
                  + {t('dailyLogs.upload')}
                </Link>
              </div>
              {dayPhotos.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('dailyLogs.noPhotosForDate')}</p>
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
                {t('dailyLogs.tapToInclude', { count: selectedPhotoIds.length })}
              </p>
            </div>

            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <h2 className="font-semibold text-sm mb-3">{t('dailyLogs.recentHistory')}</h2>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {history.length === 0 && <li className="text-xs text-muted-foreground">{t('dailyLogs.noLogsYet')}</li>}
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

    {/* Photo Selection Modal */}
    {showPhotoModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6">
          <h3 className="text-lg font-semibold mb-4">{t('dailyLogs.selectPhotosForReport')}</h3>

          {/* Mode Toggle */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setReportMode('dailyLogs')}
              className={`px-3 py-1.5 text-xs rounded-lg border ${reportMode === 'dailyLogs' ? 'bg-[#0F1B33] text-[#C9A96E] border-[#0F1B33]' : 'hover:bg-muted'}`}
            >
              {t('dailyLogs.modeDailyLogs')}
            </button>
            <button
              type="button"
              onClick={() => { setReportMode('pmReport'); loadReportPhotos(); }}
              className={`px-3 py-1.5 text-xs rounded-lg border ${reportMode === 'pmReport' ? 'bg-[#0F1B33] text-[#C9A96E] border-[#0F1B33]' : 'hover:bg-muted'}`}
            >
              {t('dailyLogs.modePmReport')}
            </button>
          </div>

          {reportMode === 'pmReport' && (
            <div className="mb-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">{t('dailyLogs.uploadPmReport')}</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setExtractingDoc(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      const res = await fetch(`/api/projects/${projectId}/field-report/extract-document`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setUploadedDocText(data.text || '');
                        toast({ title: t('dailyLogs.docExtracted') });
                      } else {
                        throw new Error(data.error || 'Extraction failed');
                      }
                    } catch (e: any) {
                      toast({ title: e?.message ?? t('dailyLogs.docExtractFailed'), variant: 'destructive' });
                    } finally {
                      setExtractingDoc(false);
                    }
                  }}
                  className="mt-1 block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#0F1B33] file:text-[#C9A96E]"
                />
                {extractingDoc && <p className="text-xs text-muted-foreground mt-1">{t('dailyLogs.extractingDoc')}</p>}
                {uploadedDocText && <p className="text-xs text-green-600 mt-1">{t('dailyLogs.docReady')}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">{t('dailyLogs.wordContext')}</label>
                <textarea
                  value={wordContext}
                  onChange={(e) => setWordContext(e.target.value)}
                  rows={2}
                  placeholder={t('dailyLogs.wordContextPlaceholder')}
                  className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm resize-y"
                />
              </div>
            </div>
          )}

          {reportMode === 'dailyLogs' && (
            <div className="mb-4">
              <label className="text-xs font-medium text-muted-foreground uppercase">{t('dailyLogs.wordContext')}</label>
              <textarea
                value={wordContext}
                onChange={(e) => setWordContext(e.target.value)}
                rows={3}
                placeholder={t('dailyLogs.wordContextPlaceholder')}
                className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm resize-y"
              />
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">{selectedReportPhotoIds.length} of {reportPhotos.length} selected</p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedReportPhotoIds(reportPhotos.map((p) => p.id))} className="text-xs px-2 py-1 border rounded hover:bg-muted">{t('dailyLogs.selectAll')}</button>
              <button onClick={() => setSelectedReportPhotoIds([])} className="text-xs px-2 py-1 border rounded hover:bg-muted">{t('common.clear')}</button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {reportPhotos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleReportPhoto(p.id)}
                className={`relative aspect-square rounded overflow-hidden border-2 ${
                  selectedReportPhotoIds.includes(p.id) ? 'border-[#C9A96E]' : 'border-transparent'
                }`}
              >
                <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                {selectedReportPhotoIds.includes(p.id) && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-[#C9A96E] rounded-full flex items-center justify-center text-white text-xs">✓</div>
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowPhotoModal(false)} className="px-4 py-2 border rounded-lg text-sm">{t('common.cancel')}</button>
            <button
              onClick={() => { setShowPhotoModal(false); analyzeWithAi(); }}
              disabled={aiAnalyzing}
              className="px-4 py-2 bg-[#0F1B33] text-[#C9A96E] rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {aiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
              {t('dailyLogs.analyzeWithAi')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* AI Preview Modal */}
    {showAiPreview && aiPreview && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6">
          <h3 className="text-lg font-semibold mb-4">{t('dailyLogs.aiPreviewTitle')}</h3>
          <div className="space-y-4 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-[#0F1B33] border-b border-[#C9A96E] pb-1 mb-2">Overview</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiPreview.overview}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#0F1B33] border-b border-[#C9A96E] pb-1 mb-2">Milestones ({aiPreview.milestones.length})</h4>
              <div className="space-y-2">
                {aiPreview.milestones.map((m, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{m.title}</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {m.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#0F1B33] border-b border-[#C9A96E] pb-1 mb-2">Open Items ({aiPreview.openItems.length})</h4>
              <div className="space-y-1">
                {aiPreview.openItems.map((item) => (
                  <div key={item.num} className="text-sm flex gap-2">
                    <span className="font-mono text-xs text-muted-foreground">#{item.num}</span>
                    <span>{item.item}</span>
                    <span className={`text-xs px-1.5 rounded ${item.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : item.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{item.priority}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#0F1B33] border-b border-[#C9A96E] pb-1 mb-2">Action Items ({aiPreview.actionItems.length})</h4>
              <div className="space-y-1">
                {aiPreview.actionItems.map((item) => (
                  <div key={item.num} className="text-sm flex gap-2">
                    <span className="font-mono text-xs text-muted-foreground">#{item.num}</span>
                    <span>{item.action}</span>
                    <span className="text-xs text-muted-foreground">→ {item.targetDate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAiPreview(false)} className="px-4 py-2 border rounded-lg text-sm">{t('common.cancel')}</button>
            <button
              onClick={downloadAiFieldReport}
              disabled={generatingReport}
              className="px-4 py-2 bg-[#0F1B33] text-[#C9A96E] rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Download className="w-4 h-4 inline mr-1" />}
              {t('dailyLogs.downloadPdf')}
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}
