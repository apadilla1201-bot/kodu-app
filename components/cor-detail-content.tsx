'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/use-i18n';
import { uploadFileToStorage, downloadStorageFile } from '@/lib/upload-client';
import {
  ArrowLeft, Download, FileText, CheckCircle2, Clock, XCircle,
  Loader2, Hash, Calendar, Building2, User, DollarSign,
  Pencil, Save, X, Plus, Trash2, Upload, File, RefreshCw,
} from 'lucide-react';

interface CORDetail {
  id: string;
  corNumber: string;
  sequence: number;
  date: string;
  approvalDate: string | null;
  description: string;
  subcontractor: string | null;
  status: string;
  csiCode: string | null;
  subtotal: number;
  overheadProfit: number;
  generalLiability: number;
  salesTax: number;
  totalAmount: number;
  reasonForChange: string | null;
  reasonsParticular: string | null;
  marketAnalysisNotes: string | null;
  pdfCloudPath: string | null;
  subPdfCloudPath: string | null;
  notes: string | null;
  project: {
    id: string;
    projectNumber: string;
    projectName: string;
    client: string;
    location: string | null;
  };
  lineItems: any[];
  marketComparisons: any[];
}

interface EditLineItem {
  id?: string;
  description: string;
  productCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  isMaterial: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; icon: any }> = {
  Pending: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', icon: Clock },
  Approved: { bg: 'bg-[#2E7D32]/10', text: 'text-[#2E7D32]', icon: CheckCircle2 },
  Rejected: { bg: 'bg-red-50', text: 'text-[#92400E]', icon: XCircle },
};

function fmt(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CORDetailContent({ cor }: { cor: CORDetail }) {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  const sc = statusConfig?.[cor?.status ?? 'Pending'] ?? statusConfig.Pending;
  const StatusIcon = sc?.icon ?? Clock;
  const supplierTotal = (cor?.subtotal ?? 0) + (cor?.salesTax ?? 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editDesc, setEditDesc] = useState(cor?.description ?? '');
  const [editSub, setEditSub] = useState(cor?.subcontractor ?? '');
  const [editDate, setEditDate] = useState(cor?.date ? new Date(cor.date).toISOString().split('T')[0] : '');
  const [editApprovalDate, setEditApprovalDate] = useState(cor?.approvalDate ? new Date(cor.approvalDate).toISOString().split('T')[0] : '');
  const [editCsi, setEditCsi] = useState(cor?.csiCode ?? '');
  const [editNotes, setEditNotes] = useState(cor?.notes ?? '');
  const [editReason, setEditReason] = useState(cor?.reasonForChange ?? '');
  const [editRazones, setEditRazones] = useState(cor?.reasonsParticular ?? '');
  const [editMarketNotes, setEditMarketNotes] = useState(cor?.marketAnalysisNotes ?? '');
  const [editDirectTotal, setEditDirectTotal] = useState(cor?.totalAmount ?? 0);
  const [editLineItems, setEditLineItems] = useState<EditLineItem[]>(
    (cor?.lineItems ?? []).map((li: any) => ({
      id: li?.id,
      description: li?.description ?? '',
      productCode: li?.productCode ?? '',
      quantity: li?.quantity ?? 1,
      unit: li?.unit ?? 'EA',
      unitPrice: li?.unitPrice ?? 0,
      total: li?.total ?? 0,
      isMaterial: li?.isMaterial !== false,
    }))
  );

  // Sub PDF state
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfRemoved, setPdfRemoved] = useState(false);
  const [pdfExtracted, setPdfExtracted] = useState(false);

  const startEdit = () => {
    setEditDesc(cor?.description ?? '');
    setEditSub(cor?.subcontractor ?? '');
    setEditDate(cor?.date ? new Date(cor.date).toISOString().split('T')[0] : '');
    setEditApprovalDate(cor?.approvalDate ? new Date(cor.approvalDate).toISOString().split('T')[0] : '');
    setEditCsi(cor?.csiCode ?? '');
    setEditNotes(cor?.notes ?? '');
    setEditReason(cor?.reasonForChange ?? '');
    setEditRazones(cor?.reasonsParticular ?? '');
    setEditMarketNotes(cor?.marketAnalysisNotes ?? '');
    setEditDirectTotal(cor?.totalAmount ?? 0);
    setEditLineItems(
      (cor?.lineItems ?? []).map((li: any) => ({
        id: li?.id,
        description: li?.description ?? '',
        productCode: li?.productCode ?? '',
        quantity: li?.quantity ?? 1,
        unit: li?.unit ?? 'EA',
        unitPrice: li?.unitPrice ?? 0,
        total: li?.total ?? 0,
        isMaterial: li?.isMaterial !== false,
      }))
    );
    setNewPdfFile(null);
    setPdfRemoved(false);
    setPdfExtracted(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setNewPdfFile(null);
    setPdfRemoved(false);
    setPdfExtracted(false);
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    setEditLineItems(prev => {
      const items = [...prev];
      const item = { ...items[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        item.total = Number(item.quantity) * Number(item.unitPrice);
      }
      items[index] = item;
      return items;
    });
  };

  const addLineItem = () => {
    setEditLineItems(prev => [...prev, {
      description: '', productCode: '', quantity: 1, unit: 'EA', unitPrice: 0, total: 0, isMaterial: true,
    }]);
  };

  const removeLineItem = (index: number) => {
    setEditLineItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle PDF selection + IMMEDIATE extraction
  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error(t('cor.pdfOnlyError'));
      return;
    }
    setNewPdfFile(file);
    setPdfRemoved(false);
    setPdfExtracted(false);

    // Extract data from the new PDF immediately
    setExtracting(true);
    toast.info(t('cor.extractingPdf'), { duration: 10000, id: 'extracting' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/extract-pdf', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Extraction failed');
      const data = await res.json();
      const parsed = data?.parsed;

      if (parsed) {
        // Update description if extracted
        if (parsed.description) setEditDesc(String(parsed.description));
        // Update subcontractor
        if (parsed.subcontractor) {
          const sub = parsed.subcontractor;
          setEditSub(typeof sub === 'string' ? sub : (sub?.name ?? sub?.company ?? String(sub)));
        }
        // Replace line items with extracted ones
        const extractedItems: EditLineItem[] = (parsed.lineItems ?? []).map((li: any) => {
          const qty = Number(li?.quantity) || 1;
          let unitPrice = Number(li?.unitPrice) || 0;
          let total = Number(li?.total) || 0;
          // Derive missing values
          if (total > 0 && unitPrice === 0 && qty > 0) unitPrice = total / qty;
          if (unitPrice > 0 && total === 0) total = unitPrice * qty;
          return {
            description: String(li?.description ?? ''),
            productCode: String(li?.productCode ?? ''),
            quantity: qty,
            unit: String(li?.unit ?? 'EA'),
            unitPrice,
            total,
            isMaterial: li?.isMaterial !== false,
          };
        });

        if (extractedItems.length > 0) {
          setEditLineItems(extractedItems);
          setPdfExtracted(true);
          toast.dismiss('extracting');
          toast.success(t('cor.pdfProcessed', { count: extractedItems.length }), { duration: 5000 });
        } else {
          toast.dismiss('extracting');
          toast.warning(t('cor.pdfNoLineItems'), { duration: 5000 });
        }
      } else {
        toast.dismiss('extracting');
        toast.warning(t('cor.pdfExtractFailed'), { duration: 5000 });
      }
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      toast.dismiss('extracting');
      toast.error(t('cor.pdfProcessError', { message: err?.message ?? '' }));
    } finally {
      setExtracting(false);
    }
  };

  const removePdf = () => {
    setNewPdfFile(null);
    setPdfRemoved(true);
    setPdfExtracted(false);
    // Reset line items back to original if we extracted from a new PDF
    setEditLineItems(
      (cor?.lineItems ?? []).map((li: any) => ({
        id: li?.id,
        description: li?.description ?? '',
        productCode: li?.productCode ?? '',
        quantity: li?.quantity ?? 1,
        unit: li?.unit ?? 'EA',
        unitPrice: li?.unitPrice ?? 0,
        total: li?.total ?? 0,
        isMaterial: li?.isMaterial !== false,
      }))
    );
    toast.info(t('cor.pdfRemoved'));
  };

  const uploadNewPdf = async (): Promise<{ path: string; isPublic: boolean } | null> => {
    if (!newPdfFile) return null;
    setUploadingPdf(true);
    try {
      const uploaded = await uploadFileToStorage(newPdfFile);
      return { path: uploaded.cloud_storage_path, isPublic: uploaded.isPublic };
    } catch (err: any) {
      console.error('PDF upload error:', err);
      toast.error(t('cor.pdfUploadError', { message: err?.message ?? '' }));
      return null;
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleViewSubPdf = async () => {
    const pdfPath = cor?.subPdfCloudPath;
    if (!pdfPath) return;
    try {
      await downloadStorageFile(pdfPath, `Sub_PDF_${cor?.corNumber ?? 'unknown'}.pdf`);
    } catch {
      toast.error(t('cor.pdfDownloadError'));
    }
  };

  const handleSave = async () => {
    if (!editDesc.trim()) { toast.error(t('cor.descriptionRequired')); return; }
    setSaving(true);
    try {
      // Upload new PDF if selected
      let pdfUpdate: any = {};
      if (newPdfFile) {
        const result = await uploadNewPdf();
        if (result) {
          pdfUpdate = { subPdfCloudPath: result.path, subPdfIsPublic: result.isPublic };
        } else { setSaving(false); return; }
      } else if (pdfRemoved) {
        pdfUpdate = { subPdfCloudPath: null, subPdfIsPublic: false };
      }

      const payload: any = {
        description: editDesc,
        subcontractor: editSub || null,
        date: editDate || undefined,
        approvalDate: editApprovalDate || null,
        csiCode: editCsi || null,
        notes: editNotes || null,
        reasonForChange: editReason || null,
        reasonsParticular: editRazones || null,
        marketAnalysisNotes: editMarketNotes || null,
        ...pdfUpdate,
      };

      if (editLineItems.length > 0) {
        payload.lineItems = editLineItems.map(li => ({
          description: li.description,
          productCode: li.productCode || null,
          quantity: Number(li.quantity) || 1,
          unit: li.unit || 'EA',
          unitPrice: Number(li.unitPrice) || 0,
          total: Number(li.total) || 0,
          isMaterial: li.isMaterial,
        }));
      } else {
        payload.directTotalAmount = Number(editDirectTotal) || 0;
      }

      const res = await fetch(`/api/cors/${cor?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to save');
      }
      toast.success(t('cor.updateSuccess'));
      setEditing(false);
      setNewPdfFile(null);
      setPdfRemoved(false);
      setPdfExtracted(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? t('cor.updateError'));
    } finally { setSaving(false); }
  };

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/api/generate-pdf/${cor?.id}`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'PDF generation failed');
      }
      const blob = await res.blob();
      // Safari-compatible: convert blob to data URL for reliable download
      const reader = new FileReader();
      reader.onloadend = () => {
        const a = document.createElement('a');
        a.href = reader.result as string;
        a.download = `COR_${(cor?.corNumber ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 2000);
      };
      reader.readAsDataURL(blob);
      toast.success(t('cor.pdfGenerated'));
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error(err?.message || t('cor.pdfGenerateError'));
    } finally { setGeneratingPdf(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/cors/${cor?.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success(t('cor.statusUpdated', { status: newStatus }));
      router.refresh();
    } catch { toast.error(t('cor.statusUpdateError')); }
    finally { setUpdatingStatus(false); }
  };

  // Calculate edit totals
  const editMaterialTotal = editLineItems.filter(li => li.isMaterial).reduce((s, li) => s + Number(li.total || 0), 0);
  const editNonMaterialTotal = editLineItems.filter(li => !li.isMaterial).reduce((s, li) => s + Number(li.total || 0), 0);
  const editSubtotal = editMaterialTotal + editNonMaterialTotal;
  const editSalesTax = editMaterialTotal * 0.07;
  const editSupplierTotal = editSubtotal + editSalesTax;
  const editOP = editSupplierTotal * 0.06;
  const editGL = editSupplierTotal * 0.015;
  const editTotal = editLineItems.length > 0 ? editSupplierTotal + editOP + editGL : Number(editDirectTotal) || 0;

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 text-sm';

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      <Link href={`/dashboard/projects/${cor?.project?.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#C9A96E]">
        <ArrowLeft className="w-4 h-4" /> Back to {cor?.project?.projectName}
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-display font-bold tracking-tight">COR {cor?.corNumber}</h1>
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${sc?.bg} ${sc?.text}`}>
                <StatusIcon className="w-3 h-3" />
                {cor?.status}
              </div>
            </div>
            {editing ? (
              <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={inputClass + ' mt-1'} placeholder="Descripci\u00f3n" />
            ) : (
              <p className="text-sm text-muted-foreground">{cor?.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
              {editing ? (
                <>
                  <div className="flex items-center gap-1"><span className="text-[10px] font-medium text-muted-foreground">Fecha:</span><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputClass + ' w-40'} /></div>
                  <div className="flex items-center gap-1"><span className="text-[10px] font-medium text-muted-foreground">Aprobado:</span><input type="date" value={editApprovalDate} onChange={(e) => setEditApprovalDate(e.target.value)} className={inputClass + ' w-40'} /></div>
                  <input type="text" value={editSub} onChange={(e) => setEditSub(e.target.value)} placeholder="Subcontratista" className={inputClass + ' w-48'} />
                  <input type="text" value={editCsi} onChange={(e) => setEditCsi(e.target.value)} placeholder="Código CSI" className={inputClass + ' w-32'} />
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {cor?.date ? new Date(cor.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '\u2014'}</span>
                  {cor?.approvalDate && <span className="flex items-center gap-1 text-[#2E7D32]"><CheckCircle2 className="w-3 h-3" /> Aprobado: {new Date(cor.approvalDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
                  {cor?.subcontractor && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {cor?.subcontractor}</span>}
                  {cor?.csiCode && <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {cor.csiCode}</span>}
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {editing ? (
              <>
                <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm font-medium flex items-center gap-2">
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || uploadingPdf || extracting}
                  className="bg-[#2E7D32] hover:bg-[#256d29] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </>
            ) : (
              <>
                <button onClick={startEdit} className="border border-[#C9A96E] text-[#C9A96E] hover:bg-[#C9A96E]/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  <Pencil className="w-4 h-4" /> Editar
                </button>
                <select value={cor?.status ?? 'Pending'} onChange={(e: any) => handleStatusChange(e?.target?.value ?? 'Pending')} disabled={updatingStatus} className="text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 bg-card">
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <button onClick={handleGeneratePdf} disabled={generatingPdf} className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                  {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Generate PDF
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Subcontractor PDF Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><File className="w-4 h-4 text-[#C9A96E]" /> PDF del Subcontratista</h2>
        {editing ? (
          <div className="space-y-3">
            {/* Extracting indicator */}
            {extracting && (
              <div className="flex items-center gap-3 bg-[#C9A96E]/10 border border-[#C9A96E]/30 rounded-lg px-4 py-3 animate-pulse">
                <Loader2 className="w-5 h-5 text-[#C9A96E] animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#C9A96E]">Procesando PDF...</p>
                  <p className="text-xs text-muted-foreground">Extrayendo datos, line items y montos del nuevo PDF para recalcular el COR</p>
                </div>
              </div>
            )}

            {/* PDF extracted success */}
            {pdfExtracted && !extracting && (
              <div className="flex items-center gap-3 bg-[#2E7D32]/10 border border-[#2E7D32]/30 rounded-lg px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-[#2E7D32] flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#2E7D32]">PDF procesado \u2014 datos extra\u00eddos y COR recalculado</p>
                  <p className="text-xs text-muted-foreground">{editLineItems.length} line item(s) extra\u00eddos del nuevo PDF. Revisa los datos abajo antes de guardar.</p>
                </div>
                <RefreshCw className="w-4 h-4 text-[#2E7D32]" />
              </div>
            )}

            {/* Current PDF info (old one, before replacement) */}
            {cor?.subPdfCloudPath && !pdfRemoved && !newPdfFile && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-700">PDF actual adjunto</p>
                  <p className="text-xs text-muted-foreground">Se eliminar\u00e1 autom\u00e1ticamente al subir uno nuevo</p>
                </div>
                <button onClick={removePdf} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Quitar
                </button>
              </div>
            )}

            {/* PDF removed indicator */}
            {pdfRemoved && !newPdfFile && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-600">PDF ser\u00e1 eliminado al guardar</p>
                <button onClick={() => { setPdfRemoved(false); }} className="ml-auto px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                  Deshacer
                </button>
              </div>
            )}

            {/* New file selected info */}
            {newPdfFile && !extracting && (
              <div className="flex items-center gap-3 bg-[#C9A96E]/5 border border-[#C9A96E]/20 rounded-lg px-4 py-3">
                <Upload className="w-5 h-5 text-[#C9A96E] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#C9A96E]">Nuevo PDF: {newPdfFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(newPdfFile.size / 1024 / 1024).toFixed(1)} MB {pdfExtracted ? '\u2014 Datos ya extra\u00eddos' : ''}</p>
                </div>
                <button onClick={() => { setNewPdfFile(null); setPdfExtracted(false); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Upload button */}
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handlePdfFileSelect} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
              className="px-4 py-3 rounded-lg border-2 border-dashed border-[#C9A96E]/40 hover:border-[#C9A96E] text-sm font-medium text-[#C9A96E] hover:bg-[#C9A96E]/5 transition-all flex items-center gap-2 w-full justify-center disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {newPdfFile ? 'Cambiar PDF (se re-extraer\u00e1n los datos)' : cor?.subPdfCloudPath && !pdfRemoved ? 'Reemplazar PDF (elimina el anterior y recalcula)' : 'Subir PDF del Subcontratista'}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Al subir un nuevo PDF, el sistema extrae autom\u00e1ticamente los datos, reemplaza los line items y recalcula el monto total del COR.
            </p>
          </div>
        ) : (
          cor?.subPdfCloudPath ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#2E7D32]/5 border border-[#2E7D32]/20 rounded-lg px-4 py-3 flex-1">
                <FileText className="w-5 h-5 text-[#2E7D32]" />
                <span className="text-sm font-medium text-[#2E7D32]">PDF del subcontratista adjunto</span>
              </div>
              <button onClick={handleViewSubPdf} className="px-4 py-2.5 rounded-lg bg-[#0F1B33] hover:bg-[#1a2a4a] text-white text-sm font-medium flex items-center gap-2 transition-colors">
                <Download className="w-4 h-4" /> Descargar
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No hay PDF del subcontratista adjunto. Haz clic en Editar para agregar uno.</p>
          )
        )}
      </motion.div>

      {/* Line Items */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A96E]" /> Line Items
            {editing && pdfExtracted && <span className="text-xs bg-[#2E7D32]/10 text-[#2E7D32] px-2 py-0.5 rounded-full">Actualizados del nuevo PDF</span>}
          </h2>
          {editing && (
            <button onClick={addLineItem} className="text-xs text-[#C9A96E] hover:underline flex items-center gap-1 font-medium">
              <Plus className="w-3.5 h-3.5" /> Agregar Line Item
            </button>
          )}
        </div>

        {(editing ? editLineItems.length > 0 : (cor?.lineItems ?? []).length > 0) ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#C9A96E]/10">
                  <th className="text-left px-3 py-2 text-xs w-8">#</th>
                  {editing && <th className="text-left px-3 py-2 text-xs w-20">Code</th>}
                  <th className="text-left px-3 py-2 text-xs">Description</th>
                  <th className="text-right px-3 py-2 text-xs w-16">Qty</th>
                  <th className="text-center px-3 py-2 text-xs w-16">Unit</th>
                  <th className="text-right px-3 py-2 text-xs w-24">Unit Price</th>
                  <th className="text-right px-3 py-2 text-xs w-24">Total</th>
                  {editing && <th className="text-center px-3 py-2 text-xs w-16">Mat?</th>}
                  {editing && <th className="px-3 py-2 text-xs w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {editing ? (
                  editLineItems.map((li, i) => (
                    <tr key={i} className="group">
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-1 py-1.5"><input type="text" value={li.productCode} onChange={(e) => updateLineItem(i, 'productCode', e.target.value)} className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono" placeholder="Code" /></td>
                      <td className="px-1 py-1.5"><input type="text" value={li.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} className="w-full px-2 py-1 text-xs border border-border rounded bg-background" placeholder="Description" /></td>
                      <td className="px-1 py-1.5"><input type="number" value={li.quantity} onChange={(e) => updateLineItem(i, 'quantity', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 text-xs border border-border rounded bg-background text-right font-mono" step="any" /></td>
                      <td className="px-1 py-1.5">
                        <select value={li.unit} onChange={(e) => updateLineItem(i, 'unit', e.target.value)} className="w-full px-1 py-1 text-xs border border-border rounded bg-background text-center">
                          <option value="EA">EA</option><option value="LS">LS</option><option value="SF">SF</option><option value="LF">LF</option><option value="CY">CY</option><option value="HR">HR</option><option value="GAL">GAL</option>
                        </select>
                      </td>
                      <td className="px-1 py-1.5"><input type="number" value={li.unitPrice} onChange={(e) => updateLineItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 text-xs border border-border rounded bg-background text-right font-mono" step="any" /></td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono font-medium text-[#C9A96E]">{fmt(li.total)}</td>
                      <td className="px-1 py-1.5 text-center"><input type="checkbox" checked={li.isMaterial} onChange={(e) => updateLineItem(i, 'isMaterial', e.target.checked)} className="accent-[#C9A96E]" /></td>
                      <td className="px-1 py-1.5 text-center"><button onClick={() => removeLineItem(i)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))
                ) : (
                  (cor?.lineItems ?? []).map((li: any, i: number) => (
                    <tr key={li?.id ?? i}>
                      <td className="px-3 py-2 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 text-xs">{li?.description}</td>
                      <td className="px-3 py-2 text-xs text-right font-mono">{li?.quantity}</td>
                      <td className="px-3 py-2 text-xs text-center font-mono">{li?.unit}</td>
                      <td className="px-3 py-2 text-xs text-right font-mono">{fmt(li?.unitPrice ?? 0)}</td>
                      <td className="px-3 py-2 text-xs text-right font-mono font-medium">{fmt(li?.total ?? 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          editing ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-3">Este COR no tiene line items. Sube un PDF del subcontratista para extraerlos autom\u00e1ticamente, o edita el monto total directamente.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic py-2">No hay line items detallados para este COR.</p>
          )
        )}
      </motion.div>

      {/* Cost Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#0F1B33] text-white rounded-lg p-6">
        <h2 className="text-sm font-semibold mb-4 text-[#C9A96E] flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Cost Summary
          {editing && pdfExtracted && <span className="text-xs bg-[#2E7D32] text-white px-2 py-0.5 rounded-full">Recalculado del nuevo PDF</span>}
          {editing && !pdfExtracted && <span className="text-xs text-white/60">{editLineItems.length > 0 ? '(auto-calculado de line items)' : '(edici\u00f3n directa)'}</span>}
        </h2>
        <div className="space-y-2 max-w-md">
          {editing ? (
            editLineItems.length > 0 ? (
              <>
                <div className="flex justify-between text-sm"><span className="text-gray-300">Subtotal</span><span className="font-mono">{fmt(editSubtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-300">Florida Sales Tax @ 7%</span><span className="font-mono">{fmt(editSalesTax)}</span></div>
                <div className="flex justify-between text-sm border-t border-white/20 pt-2"><span>Supplier Total</span><span className="font-mono">{fmt(editSupplierTotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-300">PDG Margin @ 6%</span><span className="font-mono">{fmt(editOP)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-300">Insurance @ 1.5%</span><span className="font-mono">{fmt(editGL)}</span></div>
                <div className="flex justify-between text-lg border-t border-[#C9A96E] pt-3 mt-3">
                  <span className="font-bold text-[#C9A96E]">TOTAL \u2014 COR {cor?.corNumber}</span>
                  <span className="font-mono font-bold text-[#C9A96E]">{fmt(editTotal)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-xs text-gray-400 mb-1.5">Monto Total del COR</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C9A96E] font-bold">$</span>
                    <input type="number" value={editDirectTotal} onChange={(e) => setEditDirectTotal(parseFloat(e.target.value) || 0)} step="any" className="w-full pl-8 pr-4 py-3 rounded-lg border border-[#C9A96E]/30 bg-white/5 text-white text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50" />
                  </div>
                </div>
                <div className="flex justify-between text-lg border-t border-[#C9A96E] pt-3 mt-3">
                  <span className="font-bold text-[#C9A96E]">TOTAL \u2014 COR {cor?.corNumber}</span>
                  <span className="font-mono font-bold text-[#C9A96E]">{fmt(editTotal)}</span>
                </div>
              </>
            )
          ) : (
            <>
              <div className="flex justify-between text-sm"><span className="text-gray-300">Subtotal</span><span className="font-mono">{fmt(cor?.subtotal ?? 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-300">Florida Sales Tax @ 7%</span><span className="font-mono">{fmt(cor?.salesTax ?? 0)}</span></div>
              <div className="flex justify-between text-sm border-t border-white/20 pt-2"><span>Supplier Total</span><span className="font-mono">{fmt(supplierTotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-300">PDG Margin @ 6%</span><span className="font-mono">{fmt(cor?.overheadProfit ?? 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-300">Insurance @ 1.5%</span><span className="font-mono">{fmt(cor?.generalLiability ?? 0)}</span></div>
              <div className="flex justify-between text-lg border-t border-[#C9A96E] pt-3 mt-3">
                <span className="font-bold text-[#C9A96E]">TOTAL \u2014 COR {cor?.corNumber}</span>
                <span className="font-mono font-bold text-[#C9A96E]">{fmt(cor?.totalAmount ?? 0)}</span>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Market Comparisons */}
      {(cor?.marketComparisons ?? [])?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold mb-4">Market Price Analysis</h2>
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
                {(cor?.marketComparisons ?? []).map((mc: any, i: number) => (
                  <tr key={mc?.id ?? i}>
                    <td className="px-3 py-2 text-xs">{mc?.itemDescription}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono">{fmt(mc?.subQuote ?? 0)}</td>
                    <td className="px-3 py-2 text-xs text-right font-mono">{fmt(mc?.marketAverage ?? 0)}</td>
                    <td className={`px-3 py-2 text-xs text-right font-mono ${(mc?.variancePercent ?? 0) > 10 ? 'text-red-600' : (mc?.variancePercent ?? 0) < -5 ? 'text-[#2E7D32]' : ''}`}>
                      {(mc?.variancePercent ?? 0) > 0 ? '+' : ''}{(mc?.variancePercent ?? 0)?.toFixed?.(1)}%
                    </td>
                    <td className="px-3 py-2 text-xs">{mc?.assessment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editing ? (
            <textarea value={editMarketNotes} onChange={(e) => setEditMarketNotes(e.target.value)} rows={3} placeholder="Notas de an\u00e1lisis de mercado..." className={inputClass + ' mt-3'} />
          ) : (
            cor?.marketAnalysisNotes && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                <strong>Notes:</strong> {cor?.marketAnalysisNotes}
              </div>
            )
          )}
        </motion.div>
      )}

      {/* Justification */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-sm font-semibold mb-4">Justificaci\u00f3n</h2>
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Reason for Change</label>
              <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={4} placeholder="Raz\u00f3n del cambio..." className={inputClass + ' resize-y'} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Razones Particulares</label>
              <textarea value={editRazones} onChange={(e) => setEditRazones(e.target.value)} rows={3} placeholder="Razones particulares..." className={inputClass + ' resize-y'} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notas</label>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Notas adicionales..." className={inputClass + ' resize-y'} />
            </div>
          </div>
        ) : (
          <>
            {cor?.reasonForChange && <div className="mb-4"><h3 className="text-xs font-medium text-muted-foreground mb-1">Reason for Change</h3><p className="text-sm whitespace-pre-wrap">{cor.reasonForChange}</p></div>}
            {cor?.reasonsParticular && <div className="mb-4"><h3 className="text-xs font-medium text-muted-foreground mb-1">Razones Particulares</h3><p className="text-sm whitespace-pre-wrap">{cor.reasonsParticular}</p></div>}
            {cor?.notes && <div><h3 className="text-xs font-medium text-muted-foreground mb-1">Notas</h3><p className="text-sm whitespace-pre-wrap">{cor.notes}</p></div>}
            {!cor?.reasonForChange && !cor?.reasonsParticular && !cor?.notes && <p className="text-sm text-muted-foreground italic">Sin justificaci\u00f3n. Haz clic en Editar para agregar una.</p>}
          </>
        )}
      </motion.div>

      {/* Bottom save bar when editing */}
      {editing && (
        <div className="sticky bottom-4 bg-card border border-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Editando COR {cor?.corNumber} \u2014 <span className="font-semibold text-[#C9A96E]">{fmt(editTotal)}</span>
            {newPdfFile && <span className="ml-2 text-[#2E7D32]">\ud83d\udcc4 {newPdfFile.name}</span>}
            {pdfExtracted && <span className="ml-1 text-[#2E7D32] text-xs">(datos extra\u00eddos)</span>}
            {pdfRemoved && !newPdfFile && <span className="ml-2 text-red-400">\ud83d\uddd1\ufe0f PDF eliminado</span>}
          </p>
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm font-medium">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={saving || uploadingPdf || extracting}
              className="bg-[#2E7D32] hover:bg-[#256d29] text-white px-6 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}