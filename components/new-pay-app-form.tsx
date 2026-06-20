'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Loader2, Copy, FileText, FileSpreadsheet, Upload, Pencil, Check,
  AlertCircle, ChevronRight, Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ProjectOption {
  id: string;
  projectNumber: string;
  projectName: string;
  nextAppNumber: number;
  lastPayAppId: string | null;
}

interface Props {
  projects: ProjectOption[];
  initialProjectId: string;
}

type InputMethod = 'select' | 'excel' | 'pdf' | 'manual' | 'clone';
type Step = 'project' | 'method' | 'import' | 'review';

function fmt(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyLine = (): any => ({
  sortOrder: 0,
  itemNumber: '',
  description: '',
  subVendor: '',
  scheduledValue: 0,
  budgetRealloc: 0,
  previousChanges: 0,
  currentChanges: 0,
  previousCompleted: 0,
  thisCompleted: 0,
  retainage: 0,
  isSection: false,
  isBelowLine: false,
  isFee: false,
  sectionCode: '',
  sectionTitle: '',
});

export default function NewPayAppForm({ projects, initialProjectId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>('project');
  const [projectId, setProjectId] = useState(initialProjectId || '');
  const [method, setMethod] = useState<InputMethod>('select');

  // Import state
  const [importing, setImporting] = useState(false);
  const [importedHeader, setImportedHeader] = useState<any>(null);
  const [importedLines, setImportedLines] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState('');

  // PDF import state
  const [g702File, setG702File] = useState<File | null>(null);
  const [g703File, setG703File] = useState<File | null>(null);
  const [g702Parsed, setG702Parsed] = useState(false);
  const [g703Parsed, setG703Parsed] = useState(false);

  // Review editing
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [editHeader, setEditHeader] = useState<any>({});

  const selectedProject = projects.find(p => p.id === projectId);
  const appNumber = selectedProject?.nextAppNumber ?? 1;

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [applicationDate, setApplicationDate] = useState(today.toISOString().split('T')[0]);
  const [periodFrom, setPeriodFrom] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [periodTo, setPeriodTo] = useState(lastOfMonth.toISOString().split('T')[0]);

  /* ── Excel Import ── */
  const handleExcelImport = async (file: File) => {
    setImporting(true);
    setImportSummary('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/pay-apps/import-excel', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }
      const data = await res.json();
      const hdr = data.headerData ?? {};
      if (Object.keys(hdr).length > 0) {
        setImportedHeader(hdr);
        setEditHeader(hdr);
      }
      if (data.lineItems?.length > 0) setImportedLines(data.lineItems);

      if (hdr.applicationDate) { try { setApplicationDate(new Date(hdr.applicationDate).toISOString().split('T')[0]); } catch {} }
      if (hdr.periodFrom) { try { setPeriodFrom(new Date(hdr.periodFrom).toISOString().split('T')[0]); } catch {} }
      if (hdr.periodTo) { try { setPeriodTo(new Date(hdr.periodTo).toISOString().split('T')[0]); } catch {} }

      const sheets = data.sheetsFound;
      const parts = [];
      if (sheets?.g703) parts.push('G703');
      if (sheets?.g702) parts.push('G702');
      if (sheets?.settings) parts.push('Settings');
      setImportSummary(`Sheets encontrados: ${parts.join(', ')} — ${data.lineItems?.length ?? 0} líneas extraídas`);
      setStep('review');
      toast.success(`Excel importado: ${data.lineItems?.length ?? 0} líneas`);
    } catch (e: any) {
      toast.error(e.message || 'Error al importar Excel');
    } finally {
      setImporting(false);
    }
  };

  /* ── PDF Import ── */
  const handlePdfImport = async (file: File, type: 'g702' | 'g703') => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      const res = await fetch('/api/pay-apps/import-pdf', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'PDF import failed');
      }
      const data = await res.json();

      if (type === 'g702' && data.headerData) {
        const merged = { ...(importedHeader || {}), ...data.headerData };
        setImportedHeader(merged);
        setEditHeader(merged);
        setG702Parsed(true);
        if (data.headerData.applicationDate) { try { setApplicationDate(new Date(data.headerData.applicationDate).toISOString().split('T')[0]); } catch {} }
        if (data.headerData.periodFrom) { try { setPeriodFrom(new Date(data.headerData.periodFrom).toISOString().split('T')[0]); } catch {} }
        if (data.headerData.periodTo) { try { setPeriodTo(new Date(data.headerData.periodTo).toISOString().split('T')[0]); } catch {} }
        toast.success('G702 header data extraído');
      }

      if (type === 'g703' && data.lineItems?.length > 0) {
        setImportedLines(data.lineItems);
        setG703Parsed(true);
        toast.success(`G703: ${data.lineItems.length} líneas extraídas`);
      }

      if ((type === 'g702' && g703Parsed) || (type === 'g703' && g702Parsed) || (type === 'g703' && !g702File)) {
        setStep('review');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al procesar PDF');
    } finally {
      setImporting(false);
    }
  };

  /* ── Clone from Previous ── */
  const handleClone = async () => {
    if (!selectedProject?.lastPayAppId) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/pay-apps/${selectedProject.lastPayAppId}`);
      if (!res.ok) throw new Error('Failed to fetch previous PA');
      const prevPA = await res.json();

      const header: any = {};
      const fields = ['ownerName', 'ownerAddress', 'ownerCity', 'architectName', 'architectAddress', 'architectCity',
        'contractDate', 'contractFor', 'contractForm', 'opPercent', 'glPercent', 'contingencyPercent',
        'retainagePercent', 'retainageContPercent', 'constructionSubtotal', 'originalContractSum',
        'glInsuranceAmount', 'contractorPrinted', 'contractorTitle'];
      fields.forEach(f => { if (prevPA[f] != null) header[f] = prevPA[f]; });
      setImportedHeader(header);
      setEditHeader(header);

      const lines = (prevPA.lineItems ?? []).map((li: any) => {
        const totalCompleted = (li.previousCompleted ?? 0) + (li.thisCompleted ?? 0);
        return {
          sortOrder: li.sortOrder,
          itemNumber: li.itemNumber ?? '',
          description: li.description ?? '',
          subVendor: li.subVendor ?? '',
          scheduledValue: li.scheduledValue ?? 0,
          budgetRealloc: li.budgetRealloc ?? 0,
          previousChanges: (li.previousChanges ?? 0) + (li.currentChanges ?? 0),
          currentChanges: 0,
          previousCompleted: totalCompleted,
          thisCompleted: 0,
          retainage: li.retainage ?? 0,
          isSection: li.isSection ?? false,
          isBelowLine: li.isBelowLine ?? false,
          isFee: li.isFee ?? false,
          sectionCode: li.sectionCode ?? '',
          sectionTitle: li.sectionTitle ?? '',
        };
      });
      setImportedLines(lines);
      setImportSummary(`Clonado de PA #${appNumber - 1}: ${lines.length} líneas trasladadas`);
      setStep('review');
      toast.success(`Clonadas ${lines.length} líneas de PA #${appNumber - 1}`);
    } catch (e: any) {
      toast.error(e.message || 'Error al clonar');
    } finally {
      setImporting(false);
    }
  };

  /* ── Line Item Operations in Review ── */
  const updateLine = (idx: number, field: string, value: any) => {
    setImportedLines(prev => {
      const items = [...prev];
      items[idx] = { ...items[idx], [field]: value };
      return items;
    });
  };

  const addLine = (asSection = false) => {
    const newLine = emptyLine();
    newLine.isSection = asSection;
    newLine.sortOrder = importedLines.length + 1;
    setImportedLines(prev => [...prev, newLine]);
  };

  const removeLine = (idx: number) => {
    setImportedLines(prev => {
      const items = prev.filter((_, i) => i !== idx);
      return items.map((li, i) => ({ ...li, sortOrder: i + 1 }));
    });
  };

  /* ── Create PA ── */
  const handleCreate = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const headerToSend = { ...(editHeader || importedHeader || {}) };
      // Remove non-model fields
      delete headerToSend.applicationNumber_;
      delete headerToSend.netChangeByOrders;
      delete headerToSend.projectName;
      delete headerToSend.projectNumber;
      delete headerToSend.gcCompany;
      delete headerToSend.opAmount;
      delete headerToSend.contingencyAmount;

      const body: any = {
        projectId,
        applicationNumber: headerToSend.applicationNumber || appNumber,
        applicationDate,
        periodFrom,
        periodTo,
        ...headerToSend,
        lineItems: importedLines.map((li, i) => ({ ...li, sortOrder: i + 1 })),
      };
      if (body.contractDate && typeof body.contractDate === 'string' && !body.contractDate.includes('T')) {
        try { body.contractDate = new Date(body.contractDate).toISOString(); } catch {}
      }

      const res = await fetch('/api/pay-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create');
      }
      const created = await res.json();
      toast.success('Pay Application creada correctamente');
      router.push(`/dashboard/pay-apps/${created.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Error al crear Pay Application');
    } finally {
      setSaving(false);
    }
  };

  /* ── Stats ── */
  const nonSectionLines = importedLines.filter(l => !l.isSection);
  const totalScheduled = nonSectionLines.reduce((s, l) => s + (l.scheduledValue || 0), 0);
  const totalCompleted = nonSectionLines.reduce((s, l) => s + (l.previousCompleted || 0) + (l.thisCompleted || 0), 0);
  const sectionCount = importedLines.filter(l => l.isSection).length;
  const feeCount = importedLines.filter(l => l.isFee).length;

  const backUrl = projectId ? `/dashboard/projects/${projectId}` : '/dashboard/projects';

  const inputClass = 'w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A96E]/40';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href={backUrl} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
          <ArrowLeft className="w-4 h-4" /> Volver al Proyecto
        </Link>
      </div>

      {/* ── STEP 1: Select Project ── */}
      {step === 'project' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-[#C9A96E]" /> Nueva Pay Application</CardTitle>
            <CardDescription>Paso 1: Seleccione el proyecto y período de facturación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Proyecto *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Seleccione un proyecto" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>#{p.projectNumber} — {p.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {projectId && (
              <>
                <div className="space-y-2">
                  <Label>Número de Aplicación</Label>
                  <Input value={`PA #${appNumber}`} disabled className="bg-muted" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha de Aplicación</Label>
                    <Input type="date" value={applicationDate} onChange={e => setApplicationDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Período Desde</Label>
                    <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Período Hasta</Label>
                    <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} />
                  </div>
                </div>
                <Button onClick={() => setStep('method')} className="w-full bg-[#C9A96E] hover:bg-[#B8975D] text-white" size="lg">
                  Continuar <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: Select Input Method ── */}
      {step === 'method' && (
        <Card>
          <CardHeader>
            <CardTitle>¿Cómo desea ingresar los datos?</CardTitle>
            <CardDescription>
              PA #{appNumber} para #{selectedProject?.projectNumber} — {selectedProject?.projectName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Excel Import */}
            <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-[#C9A96E] cursor-pointer transition-all group">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-green-700" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Importar desde Excel</p>
                <p className="text-xs text-muted-foreground">Workbook con hojas G702, G703 y PROJECT SETTINGS</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setMethod('excel'); handleExcelImport(f); }
                }}
              />
              {importing && method === 'excel' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 text-muted-foreground group-hover:text-[#C9A96E]" />}
            </label>

            {/* PDF Import */}
            <button
              onClick={() => { setMethod('pdf'); setStep('import'); }}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-[#C9A96E] cursor-pointer transition-all w-full text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-700" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Importar desde PDF</p>
                <p className="text-xs text-muted-foreground">PDFs separados de G702 y G703 — extracción con AI</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[#C9A96E]" />
            </button>

            {/* Manual */}
            <button
              onClick={() => {
                setMethod('manual');
                setImportedLines([]);
                setImportedHeader({});
                setEditHeader({});
                setImportSummary('');
                setStep('review');
              }}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-[#C9A96E] cursor-pointer transition-all w-full text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Pencil className="w-6 h-6 text-blue-700" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Entrada Manual</p>
                <p className="text-xs text-muted-foreground">Crear PA vacía y agregar líneas manualmente</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[#C9A96E]" />
            </button>

            {/* Clone from Previous */}
            {selectedProject?.lastPayAppId && (
              <button
                onClick={() => { setMethod('clone'); handleClone(); }}
                disabled={importing}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-[#C9A96E] cursor-pointer transition-all w-full text-left group disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-[#C9A96E]/10 flex items-center justify-center">
                  <Copy className="w-6 h-6 text-[#C9A96E]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Roll Forward de PA #{appNumber - 1}</p>
                  <p className="text-xs text-muted-foreground">Clonar PA anterior y actualizar montos completados</p>
                </div>
                {importing && method === 'clone' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[#C9A96E]" />}
              </button>
            )}

            <button onClick={() => setStep('project')} className="text-sm text-muted-foreground hover:text-foreground mt-2">
              ← Volver a selección de proyecto
            </button>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2b: PDF Upload ── */}
      {step === 'import' && method === 'pdf' && (
        <Card>
          <CardHeader>
            <CardTitle>Subir Archivos PDF</CardTitle>
            <CardDescription>Suba los PDFs de G702 y/o G703. La AI extraerá los datos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* G703 Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                G703 — Continuation Sheet (Schedule of Values)
                {g703Parsed && <Check className="w-4 h-4 text-green-600" />}
              </Label>
              <label className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border hover:border-[#C9A96E] cursor-pointer transition-all">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {g703File ? g703File.name : 'Click para seleccionar G703 PDF'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setG703File(f); handlePdfImport(f, 'g703'); }
                  }}
                />
                {importing && g703File && !g703Parsed ? <Loader2 className="w-4 h-4 animate-spin ml-auto" /> : null}
              </label>
              {g703Parsed && <p className="text-xs text-green-600">{importedLines.length} líneas extraídas</p>}
            </div>

            {/* G702 Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                G702 — Application for Payment (opcional)
                {g702Parsed && <Check className="w-4 h-4 text-green-600" />}
              </Label>
              <label className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border hover:border-[#C9A96E] cursor-pointer transition-all">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {g702File ? g702File.name : 'Click para seleccionar G702 PDF (opcional)'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setG702File(f); handlePdfImport(f, 'g702'); }
                  }}
                />
                {importing && g702File && !g702Parsed ? <Loader2 className="w-4 h-4 animate-spin ml-auto" /> : null}
              </label>
              {g702Parsed && <p className="text-xs text-green-600">Header data extraído</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('method')} className="text-sm text-muted-foreground hover:text-foreground">
                ← Atrás
              </button>
              {(g703Parsed || g702Parsed) && (
                <Button onClick={() => setStep('review')} className="ml-auto bg-[#C9A96E] hover:bg-[#B8975D] text-white">
                  Continuar a Revisión <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 3: Review & Create ── */}
      {step === 'review' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" /> Revisar y Crear
              </CardTitle>
              <CardDescription>
                PA #{appNumber} para #{selectedProject?.projectNumber} — {selectedProject?.projectName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Import Summary */}
              {importSummary && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                  {importSummary}
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Fecha Aplicación</Label>
                  <Input type="date" value={applicationDate} onChange={e => setApplicationDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Período Desde</Label>
                  <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Período Hasta</Label>
                  <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} />
                </div>
              </div>

              {/* G702 Header - collapsible */}
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setHeaderExpanded(!headerExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#C9A96E]" /> Datos G702 (Header)
                    {editHeader && Object.keys(editHeader).length > 0 && (
                      <span className="text-xs text-muted-foreground font-normal">— {Object.keys(editHeader).length} campos</span>
                    )}
                  </span>
                  {headerExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {headerExpanded && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div><Label className="text-xs">Owner Name</Label>
                        <input value={editHeader.ownerName ?? ''} onChange={e => setEditHeader({...editHeader, ownerName: e.target.value})} className={inputClass} /></div>
                      <div><Label className="text-xs">Owner Address</Label>
                        <input value={editHeader.ownerAddress ?? ''} onChange={e => setEditHeader({...editHeader, ownerAddress: e.target.value})} className={inputClass} /></div>
                      <div><Label className="text-xs">Owner City</Label>
                        <input value={editHeader.ownerCity ?? ''} onChange={e => setEditHeader({...editHeader, ownerCity: e.target.value})} className={inputClass} /></div>
                      <div><Label className="text-xs">Architect Name</Label>
                        <input value={editHeader.architectName ?? ''} onChange={e => setEditHeader({...editHeader, architectName: e.target.value})} className={inputClass} /></div>
                      <div><Label className="text-xs">Contract For</Label>
                        <input value={editHeader.contractFor ?? ''} onChange={e => setEditHeader({...editHeader, contractFor: e.target.value})} className={inputClass} /></div>
                      <div><Label className="text-xs">Contract Date</Label>
                        <input type="date" value={(editHeader.contractDate ?? '').split('T')[0]} onChange={e => setEditHeader({...editHeader, contractDate: e.target.value})} className={inputClass} /></div>
                    </div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Porcentajes y Montos</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><Label className="text-xs">O&P %</Label>
                        <input type="number" step="any" value={editHeader.opPercent ?? ''} onChange={e => setEditHeader({...editHeader, opPercent: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                      <div><Label className="text-xs">GL %</Label>
                        <input type="number" step="any" value={editHeader.glPercent ?? ''} onChange={e => setEditHeader({...editHeader, glPercent: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                      <div><Label className="text-xs">Contingency %</Label>
                        <input type="number" step="any" value={editHeader.contingencyPercent ?? ''} onChange={e => setEditHeader({...editHeader, contingencyPercent: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                      <div><Label className="text-xs">Retainage %</Label>
                        <input type="number" step="any" value={editHeader.retainagePercent ?? ''} onChange={e => setEditHeader({...editHeader, retainagePercent: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div><Label className="text-xs">Original Contract Sum</Label>
                        <input type="number" step="any" value={editHeader.originalContractSum ?? ''} onChange={e => setEditHeader({...editHeader, originalContractSum: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                      <div><Label className="text-xs">Construction Subtotal</Label>
                        <input type="number" step="any" value={editHeader.constructionSubtotal ?? ''} onChange={e => setEditHeader({...editHeader, constructionSubtotal: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                      <div><Label className="text-xs">GL Insurance Amount</Label>
                        <input type="number" step="any" value={editHeader.glInsuranceAmount ?? ''} onChange={e => setEditHeader({...editHeader, glInsuranceAmount: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* G703 Line Items - Full editable table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">G703 — Líneas ({importedLines.length})</CardTitle>
                <div className="flex gap-2">
                  <button
                    onClick={() => addLine(true)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#0F1B33] text-[#0F1B33] hover:bg-[#0F1B33]/5 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Sección
                  </button>
                  <button
                    onClick={() => addLine(false)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#C9A96E] text-white hover:bg-[#B8975D] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Línea
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {importedLines.length > 0 ? (
                <div className="overflow-x-auto">
                  {/* Stats bar */}
                  <div className="px-4 pb-3 grid grid-cols-4 gap-3 text-xs">
                    <div className="p-2 rounded bg-muted text-center">
                      <p className="text-lg font-bold font-mono">{nonSectionLines.length}</p>
                      <p className="text-muted-foreground">Items</p>
                    </div>
                    <div className="p-2 rounded bg-muted text-center">
                      <p className="text-lg font-bold font-mono">{sectionCount}</p>
                      <p className="text-muted-foreground">Secciones</p>
                    </div>
                    <div className="p-2 rounded bg-muted text-center">
                      <p className="text-lg font-bold font-mono">{feeCount}</p>
                      <p className="text-muted-foreground">Fee Lines</p>
                    </div>
                    <div className="p-2 rounded bg-muted text-center">
                      <p className="text-sm font-bold font-mono">${totalScheduled.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                      <p className="text-muted-foreground">Valor Total</p>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#0F1B33] text-white z-10">
                      <tr>
                        <th className="px-2 py-2 text-left w-8"></th>
                        <th className="px-2 py-2 text-left w-20 font-medium">Item #</th>
                        <th className="px-2 py-2 text-left font-medium min-w-[180px]">Descripción</th>
                        <th className="px-2 py-2 text-left w-16 font-medium">Sub</th>
                        <th className="px-2 py-2 text-right w-24 font-medium">Valor Prog.</th>
                        <th className="px-2 py-2 text-right w-20 font-medium">Prev. Compl.</th>
                        <th className="px-2 py-2 text-right w-20 font-medium bg-[#C9A96E]/20">Este Período</th>
                        <th className="px-2 py-2 text-right w-16 font-medium">Retainage</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {importedLines.map((li, idx) => {
                        if (li.isSection) {
                          return (
                            <tr key={idx} className="bg-[#E8EAF0]">
                              <td className="px-1"></td>
                              <td className="px-2 py-1">
                                <input value={li.itemNumber} onChange={e => updateLine(idx, 'itemNumber', e.target.value)} className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-border rounded bg-transparent font-bold font-mono" />
                              </td>
                              <td className="px-2 py-1" colSpan={6}>
                                <input value={li.description} onChange={e => { updateLine(idx, 'description', e.target.value); updateLine(idx, 'sectionTitle', e.target.value); }} className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-border rounded bg-transparent font-bold uppercase" />
                              </td>
                              <td className="px-1">
                                <button onClick={() => removeLine(idx)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          );
                        }
                        const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]';
                        return (
                          <tr key={idx} className={`${rowBg} hover:bg-[#C9A96E]/5`}>
                            <td className="px-1 text-center text-muted-foreground">
                              <span className="text-[10px]">{idx + 1}</span>
                            </td>
                            <td className="px-2 py-1">
                              <input value={li.itemNumber} onChange={e => updateLine(idx, 'itemNumber', e.target.value)} className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-border rounded bg-transparent font-mono" />
                            </td>
                            <td className="px-2 py-1">
                              <input value={li.description} onChange={e => updateLine(idx, 'description', e.target.value)} className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-border rounded bg-transparent" />
                            </td>
                            <td className="px-2 py-1">
                              <input value={li.subVendor ?? ''} onChange={e => updateLine(idx, 'subVendor', e.target.value)} className="w-full px-1 py-0.5 text-[10px] border border-transparent hover:border-border rounded bg-transparent" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" step="any" value={li.scheduledValue || ''} onChange={e => updateLine(idx, 'scheduledValue', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-transparent hover:border-border rounded bg-transparent font-mono" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" step="any" value={li.previousCompleted || ''} onChange={e => updateLine(idx, 'previousCompleted', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-transparent hover:border-border rounded bg-transparent font-mono" />
                            </td>
                            <td className="px-2 py-1 bg-[#FFFFF0]">
                              <input type="number" step="any" value={li.thisCompleted || ''} onChange={e => updateLine(idx, 'thisCompleted', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-[#C9A96E]/30 rounded bg-[#FFFFF0] font-mono font-bold" />
                            </td>
                            <td className="px-2 py-1">
                              <input type="number" step="any" value={li.retainage || ''} onChange={e => updateLine(idx, 'retainage', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-transparent hover:border-border rounded bg-transparent font-mono" />
                            </td>
                            <td className="px-1">
                              <button onClick={() => removeLine(idx)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Pencil className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground mb-3">PA vacía — agregue líneas usando los botones de arriba.</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => addLine(true)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-[#C9A96E] flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Agregar Sección
                    </button>
                    <button onClick={() => addLine(false)} className="text-xs px-3 py-1.5 rounded-lg bg-[#C9A96E] text-white hover:bg-[#B8975D] flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Agregar Línea
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action bar */}
          <div className="sticky bottom-4 bg-card border border-border rounded-xl p-4 shadow-lg flex items-center justify-between">
            <button onClick={() => setStep('method')} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
            <div className="text-xs text-muted-foreground">
              {nonSectionLines.length} líneas · {fmt(totalScheduled)} valor total
            </div>
            <Button onClick={handleCreate} disabled={saving} className="bg-[#2E7D32] hover:bg-[#256d29] text-white" size="lg">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creando...</> : <><FileText className="w-4 h-4 mr-2" /> Crear PA #{appNumber}</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
