'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Upload, FileText, Calculator, AlignLeft,
  Eye, Plus, Trash2, Loader2, CheckCircle2, X, Download, Search,
} from 'lucide-react';

interface ProjectOption {
  id: string;
  projectNumber: string;
  projectName: string;
  client: string;
  location: string | null;
  nextSequence: number;
}

interface LineItem {
  id: string;
  description: string;
  productCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  isMaterial: boolean;
}

interface MarketComp {
  itemDescription: string;
  subQuote: number;
  marketAverage: number;
  variancePercent: number;
  assessment: string;
  source: string;
}

const steps = [
  { label: 'Upload PDF', icon: Upload },
  { label: 'COR Info', icon: FileText },
  { label: 'Cost Analysis', icon: Calculator },
  { label: 'Justification', icon: AlignLeft },
  { label: 'Review', icon: Eye },
];

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export function CORWizard({ projects, initialProjectId }: { projects: ProjectOption[]; initialProjectId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [analyzingMarket, setAnalyzingMarket] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Step 1: PDF Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');

  // Step 2: COR Info
  const [projectId, setProjectId] = useState(initialProjectId || (projects?.[0]?.id ?? ''));
  const [description, setDescription] = useState('');
  const [subcontractor, setSubcontractor] = useState('');
  const [csiCode, setCsiCode] = useState('');
  const [corDate, setCorDate] = useState(new Date().toISOString().split('T')[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', productCode: '', quantity: 1, unit: 'EA', unitPrice: 0, total: 0, isMaterial: true },
  ]);

  // Step 3: Cost Analysis
  const [materialSubtotal, setMaterialSubtotal] = useState(0);
  const [laborSubtotal, setLaborSubtotal] = useState(0);
  const [marketComps, setMarketComps] = useState<MarketComp[]>([]);
  const [marketNotes, setMarketNotes] = useState('');

  // Step 4: Justification
  const [reasonForChange, setReasonForChange] = useState('');
  const [reasonsParticular, setReasonsParticular] = useState('');

  const selectedProject = useMemo(() => {
    return (projects ?? []).find((p: any) => p?.id === projectId) ?? projects?.[0];
  }, [projects, projectId]);

  const corNumber = useMemo(() => {
    const pNum = selectedProject?.projectNumber ?? '000';
    const seq = selectedProject?.nextSequence ?? 1;
    return `${pNum}-${String(seq).padStart(3, '0')}`;
  }, [selectedProject]);

  const subtotal = useMemo(() => {
    return (lineItems ?? []).reduce((s: number, li: any) => s + (li?.total ?? 0), 0);
  }, [lineItems]);

  const materialTotal = useMemo(() => {
    return (lineItems ?? []).filter((li: any) => li?.isMaterial).reduce((s: number, li: any) => s + (li?.total ?? 0), 0);
  }, [lineItems]);

  const salesTax = useMemo(() => materialTotal * 0.07, [materialTotal]);
  const supplierTotal = useMemo(() => subtotal + salesTax, [subtotal, salesTax]);
  const overheadProfit = useMemo(() => supplierTotal * 0.06, [supplierTotal]);
  const generalLiability = useMemo(() => supplierTotal * 0.015, [supplierTotal]);
  const totalAmount = useMemo(() => supplierTotal + overheadProfit + generalLiability, [supplierTotal, overheadProfit, generalLiability]);

  const updateLineItem = (id: string, field: string, value: any) => {
    setLineItems((prev: any) => (prev ?? []).map((li: any) => {
      if (li?.id !== id) return li;
      const updated = { ...(li ?? {}), [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = (parseFloat(String(updated?.quantity ?? 0)) || 0) * (parseFloat(String(updated?.unitPrice ?? 0)) || 0);
      }
      return updated;
    }));
  };

  const addLineItem = () => {
    setLineItems((prev: any) => [...(prev ?? []), { id: generateId(), description: '', productCode: '', quantity: 1, unit: 'EA', unitPrice: 0, total: 0, isMaterial: true }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev: any) => (prev ?? []).filter((li: any) => li?.id !== id));
  };

  // Upload and extract PDF
  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/extract-pdf', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Extraction failed');
      const data = await res.json();
      setExtractedText(data?.text ?? '');

      // Auto-populate fields from extracted data
      if (data?.parsed) {
        const parsed = data.parsed;
        if (parsed?.description) setDescription(typeof parsed.description === 'string' ? parsed.description : String(parsed.description ?? ''));
        if (parsed?.subcontractor) {
          const sub = parsed.subcontractor;
          setSubcontractor(typeof sub === 'string' ? sub : (sub?.name ?? sub?.company ?? String(sub ?? '')));
        }
        if (parsed?.lineItems && (parsed.lineItems ?? [])?.length > 0) {
          setLineItems((parsed.lineItems ?? []).map((li: any) => {
            const qty = parseFloat(String(li?.quantity ?? 1)) || 1;
            let price = parseFloat(String(li?.unitPrice ?? 0)) || 0;
            let total = parseFloat(String(li?.total ?? 0)) || 0;
            // If unitPrice is 0 but total exists, derive unitPrice
            if (price === 0 && total > 0 && qty > 0) price = total / qty;
            // If total is 0 but unitPrice exists, derive total
            if (total === 0 && price > 0) total = price * qty;
            return {
              id: generateId(),
              description: li?.description ?? '',
              productCode: li?.productCode ?? '',
              quantity: qty,
              unit: li?.unit ?? 'EA',
              unitPrice: price,
              total,
              isMaterial: li?.isMaterial !== false,
            };
          }));
        }
      }
      toast.success('PDF extracted successfully');
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      toast.error('Failed to extract PDF. You can manually enter the data.');
    } finally {
      setExtracting(false);
    }
  };

  // Market Analysis
  const runMarketAnalysis = async () => {
    if ((lineItems ?? [])?.length === 0) {
      toast.error('Add line items first');
      return;
    }
    setAnalyzingMarket(true);
    try {
      const res = await fetch('/api/market-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: (lineItems ?? []).map((li: any) => ({
            description: li?.description ?? '',
            unitPrice: li?.unitPrice ?? 0,
            quantity: li?.quantity ?? 1,
            total: li?.total ?? 0,
          })),
          location: selectedProject?.location ?? 'Miami, FL',
        }),
      });

      const reader = res?.body?.getReader?.();
      const decoder = new TextDecoder();
      let partialRead = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          partialRead += decoder.decode(value, { stream: true });
          const lines = partialRead.split('\n');
          partialRead = lines?.pop?.() ?? '';
          for (const line of lines) {
            if (line?.startsWith?.('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed?.status === 'completed' && parsed?.result) {
                  setMarketComps(parsed.result?.comparisons ?? []);
                  setMarketNotes(parsed.result?.notes ?? '');
                }
              } catch (e: any) { /* skip */ }
            }
          }
        }
      }
      toast.success('Market analysis complete');
    } catch (err: any) {
      console.error('Market analysis error:', err);
      toast.error('Market analysis failed. You can add notes manually.');
    } finally {
      setAnalyzingMarket(false);
    }
  };

  // Submit COR
  const handleSubmit = async () => {
    if (!projectId) { toast.error('Select a project'); return; }
    if (!description?.trim?.()) { toast.error('Description is required'); return; }
    if ((lineItems ?? [])?.length === 0) { toast.error('Add at least one line item'); return; }

    setGenerating(true);
    try {
      // 1. Upload sub PDF if exists
      let subPdfCloudPath = '';
      let subPdfIsPublic = false;
      if (selectedFile) {
        const presignRes = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: selectedFile.name, contentType: selectedFile.type, isPublic: false }),
        });
        const presignData = await presignRes.json();
        if (presignData?.uploadUrl) {
          const uploadHeaders: Record<string, string> = { 'Content-Type': selectedFile.type };
          const signedHeaders = new URL(presignData.uploadUrl)?.searchParams?.get?.('X-Amz-SignedHeaders') ?? '';
          if (signedHeaders?.includes?.('content-disposition')) {
            uploadHeaders['Content-Disposition'] = 'attachment';
          }
          await fetch(presignData.uploadUrl, { method: 'PUT', headers: uploadHeaders, body: selectedFile });
          subPdfCloudPath = presignData?.cloud_storage_path ?? '';
        }
      }

      // 2. Create COR
      const corRes = await fetch('/api/cors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          description,
          subcontractor,
          csiCode,
          date: corDate,
          lineItems: (lineItems ?? []).map((li: any) => ({
            description: li?.description ?? '',
            productCode: li?.productCode ?? '',
            quantity: li?.quantity ?? 0,
            unit: li?.unit ?? 'EA',
            unitPrice: li?.unitPrice ?? 0,
            total: li?.total ?? 0,
            isMaterial: li?.isMaterial ?? true,
          })),
          marketComparisons: marketComps,
          marketAnalysisNotes: marketNotes,
          reasonForChange,
          reasonsParticular,
          subPdfCloudPath,
          subPdfIsPublic,
        }),
      });

      if (!corRes.ok) {
        const err = await corRes.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Failed to create COR');
      }
      const corData = await corRes.json();
      toast.success(`COR ${corData?.corNumber ?? ''} created successfully!`);
      router.replace(`/dashboard/cors/${corData?.id}`);
    } catch (err: any) {
      console.error('Submit COR error:', err);
      toast.error(err?.message ?? 'Failed to create change order');
    } finally {
      setGenerating(false);
    }
  };

  const canProceed = () => {
    if (step === 1 && (!description?.trim?.() || (lineItems ?? [])?.length === 0)) return false;
    return true;
  };

  return (
    <div className="max-w-[1000px] mx-auto">
      <Link href="/dashboard/cors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#C9A96E] mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Change Orders
      </Link>

      <h1 className="text-2xl font-display font-bold tracking-tight mb-1">New Change Order</h1>
      <p className="text-sm text-muted-foreground mb-6">COR <span className="font-mono text-[#C9A96E]">{corNumber}</span></p>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((s: any, i: number) => {
          const Icon = s?.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={i}
              onClick={() => { if (i <= step) setStep(i); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive ? 'bg-[#C9A96E] text-white' : isDone ? 'bg-[#C9A96E]/10 text-[#C9A96E]' : 'bg-muted text-muted-foreground'
              }`}
            >
              {isDone ? <CheckCircle2 className="w-4 h-4" /> : Icon && <Icon className="w-4 h-4" />}
              {s?.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* STEP 0: Upload PDF */}
          {step === 0 && (
            <div className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)] space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">Upload Subcontractor PDF</h2>
                <p className="text-sm text-muted-foreground">Upload the subcontractor&apos;s quote or proposal. The system will extract data automatically.</p>
              </div>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  selectedFile ? 'border-[#C9A96E] bg-[#C9A96E]/5' : 'border-border hover:border-[#C9A96E]/50'
                }`}
                onDragOver={(e: any) => e.preventDefault()}
                onDrop={(e: any) => { e.preventDefault(); const f = e?.dataTransfer?.files?.[0]; if (f) handleFileUpload(f); }}
              >
                {extracting ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-[#C9A96E] animate-spin" />
                    <p className="text-sm text-muted-foreground">Extracting text from PDF...</p>
                  </div>
                ) : selectedFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="w-10 h-10 text-[#C9A96E]" />
                    <p className="font-medium text-sm">{selectedFile?.name ?? 'file.pdf'}</p>
                    <p className="text-xs text-muted-foreground">{((selectedFile?.size ?? 0) / 1024).toFixed(1)} KB</p>
                    <button onClick={() => { setSelectedFile(null); setExtractedText(''); }} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-10 h-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Drag & drop a PDF here, or</p>
                    <label className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors">
                      Browse Files
                      <input type="file" accept=".pdf" className="hidden" onChange={(e: any) => { const f = e?.target?.files?.[0]; if (f) handleFileUpload(f); }} />
                    </label>
                  </div>
                )}
              </div>
              {extractedText && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Extracted Content Preview</h3>
                  <div className="bg-muted rounded-lg p-4 text-xs font-mono max-h-[200px] overflow-auto whitespace-pre-wrap">
                    {extractedText?.substring?.(0, 2000) ?? ''}
                    {(extractedText?.length ?? 0) > 2000 && '\n... (truncated)'}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">* This step is optional. You can skip and enter data manually.</p>
            </div>
          )}

          {/* STEP 1: COR Info */}
          {step === 1 && (
            <div className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)] space-y-6">
              <h2 className="text-lg font-semibold">Change Order Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project <span className="text-red-500">*</span></label>
                  <select
                    value={projectId}
                    onChange={(e: any) => setProjectId(e?.target?.value ?? '')}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50"
                  >
                    {(projects ?? []).map((p: any) => (
                      <option key={p?.id} value={p?.id}>{p?.projectName} (#{p?.projectNumber})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">COR Number</label>
                  <input type="text" value={corNumber} readOnly className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm font-mono cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input type="date" value={corDate} onChange={(e: any) => setCorDate(e?.target?.value ?? '')} className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CSI Code</label>
                  <input type="text" value={csiCode} onChange={(e: any) => setCsiCode(e?.target?.value ?? '')} placeholder="e.g., 32 31 00" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description <span className="text-red-500">*</span></label>
                  <input type="text" value={description} onChange={(e: any) => setDescription(e?.target?.value ?? '')} placeholder="Brief description of the change" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Subcontractor / Supplier</label>
                  <input type="text" value={subcontractor} onChange={(e: any) => setSubcontractor(e?.target?.value ?? '')} placeholder="Subcontractor or supplier name" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Line Items</h3>
                  <button onClick={addLineItem} className="text-xs bg-[#C9A96E]/10 text-[#C9A96E] px-3 py-1.5 rounded-lg hover:bg-[#C9A96E]/20 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {(lineItems ?? []).map((li: any, idx: number) => (
                    <div key={li?.id ?? idx} className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Item #{idx + 1}</span>
                        {(lineItems ?? [])?.length > 1 && (
                          <button onClick={() => removeLineItem(li?.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div className="md:col-span-3">
                          <input type="text" value={li?.description ?? ''} onChange={(e: any) => updateLineItem(li?.id, 'description', e?.target?.value ?? '')} placeholder="Description" className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A96E]/50" />
                        </div>
                        <div>
                          <input type="text" value={li?.productCode ?? ''} onChange={(e: any) => updateLineItem(li?.id, 'productCode', e?.target?.value ?? '')} placeholder="Code" className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A96E]/50" />
                        </div>
                        <div>
                          <input type="number" value={li?.quantity ?? 1} onChange={(e: any) => updateLineItem(li?.id, 'quantity', parseFloat(e?.target?.value ?? '1') || 1)} placeholder="Qty" step="0.01" className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A96E]/50" />
                        </div>
                        <div>
                          <input type="text" value={li?.unit ?? 'EA'} onChange={(e: any) => updateLineItem(li?.id, 'unit', e?.target?.value ?? 'EA')} placeholder="Unit" className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A96E]/50" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Unit Price</label>
                          <input type="number" value={li?.unitPrice ?? 0} onChange={(e: any) => updateLineItem(li?.id, 'unitPrice', parseFloat(e?.target?.value ?? '0') || 0)} step="0.01" className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A96E]/50" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Total</label>
                          <input type="text" value={`$${(li?.total ?? 0).toFixed(2)}`} readOnly className="w-full px-3 py-2 bg-muted border border-border rounded text-sm font-mono cursor-not-allowed" />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={li?.isMaterial ?? true} onChange={(e: any) => updateLineItem(li?.id, 'isMaterial', e?.target?.checked ?? true)} className="rounded border-border" />
                            Material (taxable)
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-right">
                  <span className="text-sm text-muted-foreground">Subtotal: </span>
                  <span className="font-mono font-bold text-lg">${subtotal?.toFixed?.(2) ?? '0.00'}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Cost Analysis */}
          {step === 2 && (
            <div className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)] space-y-6">
              <h2 className="text-lg font-semibold">Cost Analysis & Market Comparison</h2>

              {/* Cost Summary */}
              <div className="bg-muted/50 rounded-lg p-5">
                <h3 className="text-sm font-semibold mb-4">Cost Summary</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Material Subtotal', value: materialTotal },
                    { label: `Florida Sales Tax @ 7.00%`, value: salesTax },
                    { label: 'Supplier Total', value: supplierTotal, bold: true },
                    { label: 'PDG Margin @ 6%', value: overheadProfit },
                    { label: 'Insurance @ 1.5%', value: generalLiability },
                  ].map((row: any, i: number) => (
                    <div key={i} className={`flex justify-between py-1.5 ${row?.bold ? 'border-t border-border pt-3 font-semibold' : ''}`}>
                      <span className="text-sm">{row?.label}</span>
                      <span className="font-mono text-sm">${(row?.value ?? 0)?.toFixed?.(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 border-t-2 border-[#C9A96E]">
                    <span className="font-bold text-[#0F1B33]">TOTAL — COR {corNumber}</span>
                    <span className="font-mono font-bold text-lg text-[#0F1B33]">${totalAmount?.toFixed?.(2) ?? '0.00'}</span>
                  </div>
                </div>
              </div>

              {/* Market Comparison */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Market Price Analysis (Miami, FL)</h3>
                  <button
                    onClick={runMarketAnalysis}
                    disabled={analyzingMarket}
                    className="text-xs bg-[#1B2A4A] text-white px-4 py-2 rounded-lg hover:bg-[#0F1B33] flex items-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {analyzingMarket ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    {analyzingMarket ? 'Analyzing...' : 'Run Analysis'}
                  </button>
                </div>
                {(marketComps ?? [])?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#C9A96E]/10">
                          <th className="text-left px-3 py-2 text-xs">Item</th>
                          <th className="text-right px-3 py-2 text-xs">Sub Quote</th>
                          <th className="text-right px-3 py-2 text-xs">Market Avg</th>
                          <th className="text-right px-3 py-2 text-xs">Variance</th>
                          <th className="text-left px-3 py-2 text-xs">Assessment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(marketComps ?? []).map((mc: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-xs max-w-[200px] truncate">{mc?.itemDescription}</td>
                            <td className="px-3 py-2 text-xs text-right font-mono">${(mc?.subQuote ?? 0)?.toFixed?.(2)}</td>
                            <td className="px-3 py-2 text-xs text-right font-mono">${(mc?.marketAverage ?? 0)?.toFixed?.(2)}</td>
                            <td className={`px-3 py-2 text-xs text-right font-mono ${(mc?.variancePercent ?? 0) > 10 ? 'text-red-600' : (mc?.variancePercent ?? 0) < -5 ? 'text-[#2E7D32]' : ''}`}>
                              {(mc?.variancePercent ?? 0) > 0 ? '+' : ''}{(mc?.variancePercent ?? 0)?.toFixed?.(1)}%
                            </td>
                            <td className="px-3 py-2 text-xs">{mc?.assessment}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-8 text-center">
                    <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click &quot;Run Analysis&quot; to search market prices for comparison</p>
                    <p className="text-xs text-muted-foreground mt-1">Uses RSMeans data and Miami construction market references</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Market Analysis Notes</label>
                <textarea
                  value={marketNotes}
                  onChange={(e: any) => setMarketNotes(e?.target?.value ?? '')}
                  rows={3}
                  placeholder="Additional notes about market analysis..."
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Justification */}
          {step === 3 && (
            <div className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)] space-y-6">
              <h2 className="text-lg font-semibold">Change Order Justification</h2>
              <div>
                <label className="block text-sm font-medium mb-1">Reason for Change</label>
                <p className="text-xs text-muted-foreground mb-2">Detailed explanation of why this change order is needed</p>
                <textarea
                  value={reasonForChange}
                  onChange={(e: any) => setReasonForChange(e?.target?.value ?? '')}
                  rows={6}
                  placeholder="Describe the reason for this change, including basis for procurement and price justification, supplier selection rationale, and compliance with specifications..."
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Razones Particulares</label>
                <p className="text-xs text-muted-foreground mb-2">This content will appear on Page 1 of the generated PDF</p>
                <textarea
                  value={reasonsParticular}
                  onChange={(e: any) => setReasonsParticular(e?.target?.value ?? '')}
                  rows={6}
                  placeholder="Ingrese las razones particulares del cambio..."
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)]">
                <h2 className="text-lg font-semibold mb-4">Review Change Order</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">COR Number:</span> <span className="font-mono font-medium">{corNumber}</span></div>
                  <div><span className="text-muted-foreground">Project:</span> <span className="font-medium">{selectedProject?.projectName}</span></div>
                  <div><span className="text-muted-foreground">Date:</span> <span>{corDate}</span></div>
                  <div><span className="text-muted-foreground">Subcontractor:</span> <span>{subcontractor || '—'}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <span>{description}</span></div>
                </div>
              </div>

              {/* Line Items Summary */}
              <div className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)]">
                <h3 className="text-sm font-semibold mb-3">Line Items ({(lineItems ?? [])?.length})</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#C9A96E]/10">
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Unit Price</th>
                      <th className="text-right px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(lineItems ?? []).map((li: any, i: number) => (
                      <tr key={li?.id ?? i}>
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2 max-w-[300px] truncate">{li?.description}</td>
                        <td className="px-3 py-2 text-right font-mono">{li?.quantity} {li?.unit}</td>
                        <td className="px-3 py-2 text-right font-mono">${(li?.unitPrice ?? 0)?.toFixed?.(2)}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium">${(li?.total ?? 0)?.toFixed?.(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cost Summary */}
              <div className="bg-[#0F1B33] text-white rounded-lg p-6">
                <h3 className="text-sm font-semibold mb-4 text-[#C9A96E]">Cost Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-300">Material Subtotal</span><span className="font-mono">${materialTotal?.toFixed?.(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-300">Sales Tax @ 7%</span><span className="font-mono">${salesTax?.toFixed?.(2)}</span></div>
                  <div className="flex justify-between text-sm border-t border-white/20 pt-2"><span>Supplier Total</span><span className="font-mono">${supplierTotal?.toFixed?.(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-300">PDG Margin @ 6%</span><span className="font-mono">${overheadProfit?.toFixed?.(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-300">Insurance @ 1.5%</span><span className="font-mono">${generalLiability?.toFixed?.(2)}</span></div>
                  <div className="flex justify-between text-lg border-t border-[#C9A96E] pt-3 mt-3">
                    <span className="font-bold text-[#C9A96E]">TOTAL — COR {corNumber}</span>
                    <span className="font-mono font-bold text-[#C9A96E]">${totalAmount?.toFixed?.(2)}</span>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={generating}
                  className="bg-[#2E7D32] hover:bg-[#256929] text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><FileText className="w-4 h-4" /> Create COR & Generate PDF</>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          <button
            onClick={() => setStep(Math.min(4, step + 1))}
            className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
