'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Trash2, ArrowLeft, PackageOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';

interface Props {
  projectId: string;
  projectName: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface PreviewPA {
  fileName: string;
  applicationNumber: number | null;
  applicationDate: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  lineItemCount: number;
  scheduledValue: number;
  thisCompleted: number;
  previousCompleted: number;
  sheetsFound: { g703: boolean; g702: boolean; settings: boolean };
}

interface ImportResult {
  fileName: string;
  applicationNumber: number;
  status: 'created' | 'skipped';
  lineItems: number;
  reason?: string;
}

type Step = 'upload' | 'preview' | 'importing' | 'results';

function fmt(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

export default function BatchPAImport({ projectId, projectName, onComplete, onCancel }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previews, setPreviews] = useState<PreviewPA[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (valid.length === 0) {
      toast.error(t('import.excelOnly'));
      return;
    }
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const unique = valid.filter(f => !existingNames.has(f.name));
      return [...prev, ...unique];
    });
  }, []);

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handlePreview = async () => {
    if (!files.length) return;
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('action', 'preview');
      files.forEach(f => fd.append('files', f));

      const res = await fetch('/api/pay-apps/import-batch', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Preview failed');
      }
      const data = await res.json();
      setPreviews(data.payApplications || []);
      setStep('preview');
      toast.success(t('import.detectedCount', { count: data.count }));
    } catch (e: any) {
      toast.error(e.message || t('import.previewError'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    try {
      const fd = new FormData();
      fd.append('action', 'import');
      fd.append('projectId', projectId);
      files.forEach(f => fd.append('files', f));

      const res = await fetch('/api/pay-apps/import-batch', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }
      const data = await res.json();
      setResults(data.results || []);
      setStep('results');
      if (data.created > 0) {
        toast.success(t('import.importedCount', { count: data.created }));
      }
      if (data.skipped > 0) {
        toast.warning(t('import.skipped', { count: data.skipped }));
      }
    } catch (e: any) {
      toast.error(e.message || t('import.importError'));
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  // Summary calculations for preview
  const totalLineItems = previews.reduce((s, p) => s + p.lineItemCount, 0);
  const totalScheduled = previews.reduce((s, p) => s + p.scheduledValue, 0);
  const totalThisCompleted = previews.reduce((s, p) => s + p.thisCompleted, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-semibold text-lg">{t('import.batchImport')}</h3>
          <p className="text-sm text-muted-foreground">{projectName}</p>
        </div>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageOpen className="w-5 h-5 text-[#C9A96E]" />
              {t('import.uploadTitle')}
            </CardTitle>
            <CardDescription>
              {t('import.uploadDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${dragOver ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-border hover:border-[#C9A96E]/40'}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium">{t('import.dragFiles')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('import.clickToSelect')}</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t('import.filesSelected', { count: files.length })}</p>
                  <button onClick={() => setFiles([])} className="text-xs text-red-500 hover:underline">{t('import.clearAll')}</button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {files.map((f, i) => (
                    <div key={f.name + i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm truncate max-w-[300px]">{f.name}</span>
                        <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action */}
            {files.length > 0 && (
              <Button
                onClick={handlePreview}
                disabled={previewing}
                className="w-full bg-[#C9A96E] hover:bg-[#B8975D] text-white"
                size="lg"
              >
                {previewing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('import.analyzing', { count: files.length })}</>
                ) : (
                  <>{t('import.analyzePreview')} <ChevronRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: PREVIEW */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('import.previewTitle', { count: previews.length })}
            </CardTitle>
            <CardDescription>
              {t('import.previewDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-mono">{previews.length}</p>
                <p className="text-xs text-muted-foreground">{t('import.payApplications')}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-mono">{totalLineItems}</p>
                <p className="text-xs text-muted-foreground">{t('import.totalLineItemsLabel')}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-mono text-[#C9A96E]">{fmt(totalScheduled)}</p>
                <p className="text-xs text-muted-foreground">{t('import.scheduledValue')}</p>
              </div>
            </div>

            {/* PA table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-semibold text-xs text-muted-foreground">{t('import.colPaNumber')}</th>
                    <th className="text-left py-2 px-2 font-semibold text-xs text-muted-foreground">{t('import.colFile')}</th>
                    <th className="text-left py-2 px-2 font-semibold text-xs text-muted-foreground">{t('import.colPeriod')}</th>
                    <th className="text-right py-2 px-2 font-semibold text-xs text-muted-foreground">{t('import.colLines')}</th>
                    <th className="text-right py-2 px-2 font-semibold text-xs text-muted-foreground">{t('import.colPrevCompleted')}</th>
                    <th className="text-right py-2 px-2 font-semibold text-xs text-muted-foreground">{t('import.colThisPeriod')}</th>
                    <th className="text-center py-2 px-2 font-semibold text-xs text-muted-foreground">{t('import.colSheets')}</th>
                  </tr>
                </thead>
                <tbody>
                  {previews.map((pa, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 font-mono font-semibold">
                        {pa.applicationNumber ? `#${pa.applicationNumber}` : <span className="text-amber-500 text-xs">{t('import.auto')}</span>}
                      </td>
                      <td className="py-2 px-2 truncate max-w-[180px]">{pa.fileName}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">
                        {pa.periodTo ? fmtDate(pa.periodTo) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{pa.lineItemCount}</td>
                      <td className="py-2 px-2 text-right font-mono text-muted-foreground">{fmt(pa.previousCompleted)}</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">{fmt(pa.thisCompleted)}</td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {pa.sheetsFound.g703 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">G703</span>}
                          {pa.sheetsFound.g702 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">G702</span>}
                          {pa.sheetsFound.settings && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">SET</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Warnings */}
            {previews.some(p => !p.applicationNumber) && (
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{t('import.autoAssignWarning')}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" /> {t('import.back')}
              </Button>
              <Button
                onClick={handleImport}
                className="flex-1 bg-[#C9A96E] hover:bg-[#B8975D] text-white"
                size="lg"
              >
                {t('import.importCount', { count: previews.length })}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: IMPORTING */}
      {step === 'importing' && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-[#C9A96E]" />
            <p className="text-lg font-semibold">{t('import.importingTitle')}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('import.creatingRecords', { count: previews.length, total: totalLineItems })}</p>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: RESULTS */}
      {step === 'results' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              {t('import.importComplete')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-mono text-emerald-600">{results.filter(r => r.status === 'created').length}</p>
                <p className="text-xs text-muted-foreground">{t('import.created')}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-mono text-amber-600">{results.filter(r => r.status === 'skipped').length}</p>
                <p className="text-xs text-muted-foreground">{t('import.skippedLabel')}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-mono">{results.reduce((s, r) => s + r.lineItems, 0)}</p>
                <p className="text-xs text-muted-foreground">{t('import.totalLineItemsLabel')}</p>
              </div>
            </div>

            {/* Results table */}
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg ${r.status === 'created' ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : 'bg-amber-50/50 dark:bg-amber-950/10'}`}>
                  <div className="flex items-center gap-2">
                    {r.status === 'created'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <XCircle className="w-4 h-4 text-amber-500" />
                    }
                    <span className="font-mono font-semibold text-sm">PA #{r.applicationNumber}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{r.fileName}</span>
                  </div>
                  <div className="text-sm">
                    {r.status === 'created'
                      ? <span className="text-emerald-600">{t('import.linesCount', { count: r.lineItems })}</span>
                      : <span className="text-amber-600">{r.reason}</span>
                    }
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={onComplete}
              className="w-full bg-[#C9A96E] hover:bg-[#B8975D] text-white"
              size="lg"
            >
              {t('import.doneBackToProject')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
