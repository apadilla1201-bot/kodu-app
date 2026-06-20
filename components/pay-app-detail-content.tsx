'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Pencil, Save, X, Loader2, Calendar, Building2,
  DollarSign, FileText, Receipt, Hash, User, Plus, Trash2,
} from 'lucide-react';

function fmt(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyLine = (sortOrder: number): any => ({
  sortOrder,
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

export function PayAppDetailContent({ payApp }: { payApp: any }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfType, setPdfType] = useState<'g702' | 'g703' | 'both'>('g702');

  // Edit state for header fields
  const [editData, setEditData] = useState<any>({});
  const [editLines, setEditLines] = useState<any[]>([]);

  const lines = payApp?.lineItems ?? [];
  const projectId = payApp?.projectId ?? payApp?.project?.id ?? '';

  const startEdit = () => {
    setEditData({
      ownerName: payApp.ownerName ?? '',
      ownerAddress: payApp.ownerAddress ?? '',
      ownerCity: payApp.ownerCity ?? '',
      architectName: payApp.architectName ?? '',
      architectAddress: payApp.architectAddress ?? '',
      architectCity: payApp.architectCity ?? '',
      contractFor: payApp.contractFor ?? '',
      contractForm: payApp.contractForm ?? '',
      applicationDate: payApp.applicationDate?.split('T')[0] ?? '',
      periodFrom: payApp.periodFrom?.split('T')[0] ?? '',
      periodTo: payApp.periodTo?.split('T')[0] ?? '',
      contractDate: payApp.contractDate?.split('T')[0] ?? '',
      opPercent: payApp.opPercent ?? 0.06,
      glPercent: payApp.glPercent ?? 0.015,
      contingencyPercent: payApp.contingencyPercent ?? 0.10,
      retainagePercent: payApp.retainagePercent ?? 0.10,
      constructionSubtotal: payApp.constructionSubtotal ?? 0,
      originalContractSum: payApp.originalContractSum ?? 0,
      glInsuranceAmount: payApp.glInsuranceAmount ?? 0,
      advancePayments: payApp.advancePayments ?? 0,
      advancePaymentsLabel: payApp.advancePaymentsLabel ?? '',
      directPayments: payApp.directPayments ?? 0,
      directPaymentsLabel: payApp.directPaymentsLabel ?? '',
      previousCertificates: payApp.previousCertificates ?? 0,
      contractorPrinted: payApp.contractorPrinted ?? '',
      contractorTitle: payApp.contractorTitle ?? '',
      ownerPrinted: payApp.ownerPrinted ?? '',
      status: payApp.status ?? 'Draft',
    });
    setEditLines(lines.map((li: any) => ({ ...li })));
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const updateLine = (idx: number, field: string, value: any) => {
    setEditLines(prev => {
      const items = [...prev];
      items[idx] = { ...items[idx], [field]: value };
      return items;
    });
  };

  const addLine = (asSection = false) => {
    const newLine = emptyLine(editLines.length + 1);
    newLine.isSection = asSection;
    setEditLines(prev => [...prev, newLine]);
  };

  const removeLine = (idx: number) => {
    setEditLines(prev => {
      const items = prev.filter((_, i) => i !== idx);
      return items.map((li, i) => ({ ...li, sortOrder: i + 1 }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editData,
        applicationDate: editData.applicationDate || undefined,
        periodFrom: editData.periodFrom || undefined,
        periodTo: editData.periodTo || undefined,
        contractDate: editData.contractDate || undefined,
        opPercent: Number(editData.opPercent) || 0,
        glPercent: Number(editData.glPercent) || 0,
        contingencyPercent: Number(editData.contingencyPercent) || 0,
        retainagePercent: Number(editData.retainagePercent) || 0,
        constructionSubtotal: Number(editData.constructionSubtotal) || 0,
        originalContractSum: Number(editData.originalContractSum) || 0,
        glInsuranceAmount: Number(editData.glInsuranceAmount) || 0,
        advancePayments: Number(editData.advancePayments) || 0,
        directPayments: Number(editData.directPayments) || 0,
        previousCertificates: Number(editData.previousCertificates) || 0,
        lineItems: editLines.map((li: any, i: number) => ({
          sortOrder: i + 1,
          itemNumber: li.itemNumber ?? '',
          sectionCode: li.sectionCode ?? '',
          sectionTitle: li.sectionTitle ?? '',
          description: li.description ?? '',
          subVendor: li.subVendor ?? '',
          scheduledValue: Number(li.scheduledValue) || 0,
          budgetRealloc: Number(li.budgetRealloc) || 0,
          previousChanges: Number(li.previousChanges) || 0,
          currentChanges: Number(li.currentChanges) || 0,
          previousCompleted: Number(li.previousCompleted) || 0,
          thisCompleted: Number(li.thisCompleted) || 0,
          retainage: Number(li.retainage) || 0,
          isSection: li.isSection,
          isBelowLine: li.isBelowLine,
          isFee: li.isFee,
        })),
      };

      const res = await fetch(`/api/pay-apps/${payApp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Pay Application guardada correctamente');
      setEditing(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async (type: 'g702' | 'g703' | 'both') => {
    setGeneratingPdf(true);
    setPdfType(type);
    try {
      const res = await fetch(`/api/pay-apps/${payApp.id}/pdf?type=${type}`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'PDF generation failed');
      }
      const blob = await res.blob();
      const label = type === 'both' ? 'G702_G703' : type.toUpperCase();
      const filename = `PayApp_${payApp.project?.projectNumber ?? ''}_PA${payApp.applicationNumber}_${label}.pdf`;
      // Safari-compatible download: append <a> to body, click, then remove
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      // Delay cleanup for Safari to complete the download
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2000);
      toast.success(type === 'both' ? 'PDF completo generado (G702 + G703)' : `${type.toUpperCase()} PDF generado`);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error(err?.message || 'Error al generar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Computed values from line items
  const computedLines = useMemo(() => {
    const items = editing ? editLines : lines;
    return items.filter((li: any) => !li.isSection);
  }, [editing, editLines, lines]);

  const totalScheduled = computedLines.reduce((s: number, li: any) => s + (li.scheduledValue || 0), 0);
  const totalRevised = computedLines.reduce((s: number, li: any) => {
    return s + (li.scheduledValue || 0) + (li.budgetRealloc || 0) + (li.previousChanges || 0) + (li.currentChanges || 0);
  }, 0);
  const totalThisCompleted = computedLines.reduce((s: number, li: any) => s + (li.thisCompleted || 0), 0);
  const totalPrevCompleted = computedLines.reduce((s: number, li: any) => s + (li.previousCompleted || 0), 0);
  const totalCompleted = totalThisCompleted + totalPrevCompleted;
  const totalRetainage = computedLines.reduce((s: number, li: any) => s + (li.retainage || 0), 0);
  const totalBalance = totalRevised - totalCompleted;
  const pctComplete = totalRevised > 0 ? (totalCompleted / totalRevised) : 0;

  const currentData = editing ? editData : payApp;
  const retPct = currentData.retainagePercent ?? 0.10;
  const retainageOnCompleted = totalCompleted * retPct;
  const calcEarnedLessRet = totalCompleted - retainageOnCompleted;
  const calcPaymentDue = calcEarnedLessRet - (Number(currentData.advancePayments) || 0) - (Number(currentData.directPayments) || 0) - (Number(currentData.previousCertificates) || 0);
  // Use G702 fixed values when available (not editing)
  const totalEarnedLessRet = (!editing && (payApp as any).g702TotalEarned) ? (payApp as any).g702TotalEarned : calcEarnedLessRet;
  const currentPaymentDue = (!editing && (payApp as any).g702CurrentPaymentDue) ? (payApp as any).g702CurrentPaymentDue : calcPaymentDue;
  const balanceToFinish = (!editing && (payApp as any).g702BalanceToFinish) ? (payApp as any).g702BalanceToFinish : (totalRevised - calcEarnedLessRet);

  const inputClass = 'w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A96E]/40';
  const displayLines = editing ? editLines : lines;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <Link href={projectId ? `/dashboard/projects/${projectId}` : '/dashboard/projects'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#C9A96E]">
        <ArrowLeft className="w-4 h-4" /> Volver al Proyecto
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-lg shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="bg-[#0F1B33] text-white px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold flex items-center gap-3">
                <Receipt className="w-6 h-6 text-[#C9A96E]" />
                Pay Application #{payApp.applicationNumber}
              </h1>
              <p className="text-sm text-gray-400 mt-1">#{payApp.project?.projectNumber} — {payApp.project?.projectName}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {editing ? (
                <>
                  <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 text-sm font-medium flex items-center gap-2">
                    <X className="w-4 h-4" /> Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving} className="bg-[#2E7D32] hover:bg-[#256d29] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={startEdit} className="border border-[#C9A96E] text-[#C9A96E] hover:bg-[#C9A96E]/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                    <Pencil className="w-4 h-4" /> Editar
                  </button>
                  <button onClick={() => handleGeneratePdf('both')} disabled={generatingPdf} className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                    {generatingPdf && pdfType === 'both' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    PDF Completo (G702 + G703)
                  </button>
                  <button onClick={() => handleGeneratePdf('g702')} disabled={generatingPdf} className="bg-[#0F1B33] border border-[#C9A96E] text-[#C9A96E] hover:bg-[#C9A96E]/10 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                    {generatingPdf && pdfType === 'g702' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Solo G702
                  </button>
                  <button onClick={() => handleGeneratePdf('g703')} disabled={generatingPdf} className="bg-[#0F1B33] border border-[#C9A96E] text-[#C9A96E] hover:bg-[#C9A96E]/10 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                    {generatingPdf && pdfType === 'g703' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Solo G703
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Date Info — always visible */}
        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-medium">Fecha:</span>
            <span>{payApp.applicationDate ? new Date(payApp.applicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-medium">Período:</span>
            <span>{payApp.periodFrom ? new Date(payApp.periodFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
            <span>—</span>
            <span>{payApp.periodTo ? new Date(payApp.periodTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              payApp.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
              payApp.status === 'Submitted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            }`}>{payApp.status}</span>
          </div>
        </div>

        {/* G702 Summary */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#C9A96E]/5 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Contract Sum</p>
            <p className="font-mono font-bold text-lg">{fmt(totalRevised)}</p>
          </div>
          <div className="bg-[#2E7D32]/5 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total Completed</p>
            <p className="font-mono font-bold text-lg text-[#2E7D32]">{fmt(totalCompleted)}</p>
          </div>
          <div className="bg-[#0F1B33]/5 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Current Payment Due</p>
            <p className="font-mono font-bold text-lg text-[#C9A96E]">{fmt(currentPaymentDue)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">% Complete</p>
            <p className="font-mono font-bold text-lg">{(pctComplete * 100).toFixed(1)}%</p>
          </div>
        </div>
      </motion.div>

      {/* G702 Details (edit mode shows input fields) */}
      {editing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)] space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-[#C9A96E]" /> G702 Header Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Owner Name</label>
              <input value={editData.ownerName} onChange={e => setEditData({...editData, ownerName: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Owner Address</label>
              <input value={editData.ownerAddress} onChange={e => setEditData({...editData, ownerAddress: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Owner City</label>
              <input value={editData.ownerCity} onChange={e => setEditData({...editData, ownerCity: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Architect Name</label>
              <input value={editData.architectName} onChange={e => setEditData({...editData, architectName: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Architect Address</label>
              <input value={editData.architectAddress} onChange={e => setEditData({...editData, architectAddress: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Architect City</label>
              <input value={editData.architectCity} onChange={e => setEditData({...editData, architectCity: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Contract For</label>
              <input value={editData.contractFor} onChange={e => setEditData({...editData, contractFor: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha Aplicación</label>
              <input type="date" value={editData.applicationDate} onChange={e => setEditData({...editData, applicationDate: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Período Desde</label>
              <input type="date" value={editData.periodFrom} onChange={e => setEditData({...editData, periodFrom: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Período Hasta</label>
              <input type="date" value={editData.periodTo} onChange={e => setEditData({...editData, periodTo: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Contract Date</label>
              <input type="date" value={editData.contractDate} onChange={e => setEditData({...editData, contractDate: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
              <select value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} className={inputClass}>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
              </select>
            </div>
          </div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Deducciones (G702 Líneas 7a, 7b, 7)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">7a. Advance Payments</label>
              <input type="number" step="any" value={editData.advancePayments} onChange={e => setEditData({...editData, advancePayments: e.target.value})} className={inputClass} />
              <input placeholder="Label (e.g. Invoice 176-10...)" value={editData.advancePaymentsLabel} onChange={e => setEditData({...editData, advancePaymentsLabel: e.target.value})} className={inputClass + ' mt-1'} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">7b. Direct Payments</label>
              <input type="number" step="any" value={editData.directPayments} onChange={e => setEditData({...editData, directPayments: e.target.value})} className={inputClass} />
              <input placeholder="Label (e.g. SHANNON)" value={editData.directPaymentsLabel} onChange={e => setEditData({...editData, directPaymentsLabel: e.target.value})} className={inputClass + ' mt-1'} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">7. Previous Certificates</label>
              <input type="number" step="any" value={editData.previousCertificates} onChange={e => setEditData({...editData, previousCertificates: e.target.value})} className={inputClass} />
            </div>
          </div>
        </motion.div>
      )}

      {/* G703 Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-lg shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="bg-[#0F1B33] text-white px-6 py-3 flex items-center justify-between">
          <h2 className="font-display font-bold text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A96E]" /> AIA G703 — Continuation Sheet
          </h2>
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">{displayLines.filter((l: any) => !l.isSection).length} line items</p>
            {editing && (
              <div className="flex gap-1">
                <button onClick={() => addLine(true)} className="text-xs px-2 py-1 rounded border border-white/20 text-white hover:bg-white/10 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Sección
                </button>
                <button onClick={() => addLine(false)} className="text-xs px-2 py-1 rounded bg-[#C9A96E] text-white hover:bg-[#B8975D] flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Línea
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0F1B33] text-white">
                <th className="px-2 py-2 text-left w-16 font-medium">Item #</th>
                <th className="px-2 py-2 text-left font-medium min-w-[200px]">Descripción</th>
                <th className="px-2 py-2 text-left w-20 font-medium">Sub</th>
                <th className="px-2 py-2 text-right w-20 font-medium">Sched. Value</th>
                <th className="px-2 py-2 text-right w-16 font-medium">Realloc.</th>
                <th className="px-2 py-2 text-right w-16 font-medium">Prev Chg</th>
                <th className="px-2 py-2 text-right w-16 font-medium">Curr Chg</th>
                <th className="px-2 py-2 text-right w-20 font-medium">Revised</th>
                <th className="px-2 py-2 text-right w-20 font-medium">Prev Compl.</th>
                <th className={`px-2 py-2 text-right w-20 font-medium ${editing ? 'bg-[#C9A96E]/20' : ''}`}>{editing ? '✏️ Este Período' : 'Este Período'}</th>
                <th className="px-2 py-2 text-right w-20 font-medium">Total Compl.</th>
                <th className="px-2 py-2 text-right w-12 font-medium">%</th>
                <th className="px-2 py-2 text-right w-20 font-medium">Balance</th>
                <th className="px-2 py-2 text-right w-16 font-medium">Retainage</th>
                {editing && <th className="px-1 py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayLines.map((li: any, idx: number) => {
                const revised = (li.scheduledValue || 0) + (li.budgetRealloc || 0) + (li.previousChanges || 0) + (li.currentChanges || 0);
                const totalCompl = (li.previousCompleted || 0) + (li.thisCompleted || 0);
                const pct = revised > 0 ? totalCompl / revised : 0;
                const balance = revised - totalCompl;

                if (li.isSection) {
                  return (
                    <tr key={idx} className="bg-[#E8EAF0]">
                      <td className="px-2 py-1.5 font-bold text-[#0F1B33]">
                        {editing ? (
                          <input value={editLines[idx]?.itemNumber ?? ''} onChange={e => updateLine(idx, 'itemNumber', e.target.value)} className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-border rounded bg-transparent font-bold font-mono" />
                        ) : li.itemNumber}
                      </td>
                      <td className="px-2 py-1.5 font-bold text-[#0F1B33] uppercase" colSpan={editing ? 12 : 13}>
                        {editing ? (
                          <input value={editLines[idx]?.description ?? ''} onChange={e => { updateLine(idx, 'description', e.target.value); updateLine(idx, 'sectionTitle', e.target.value); }} className="w-full px-1 py-0.5 text-xs border border-transparent hover:border-border rounded bg-transparent font-bold uppercase" />
                        ) : li.description}
                      </td>
                      {editing && (
                        <td className="px-1">
                          <button onClick={() => removeLine(idx)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      )}
                    </tr>
                  );
                }

                const rowBg = idx % 2 === 0 ? 'bg-[#F2F4F7]' : 'bg-white';

                return (
                  <tr key={idx} className={`${rowBg} hover:bg-[#C9A96E]/5 transition-colors`}>
                    <td className="px-2 py-1 font-mono text-[10px]">
                      {editing ? (
                        <input value={editLines[idx]?.itemNumber ?? ''} onChange={e => updateLine(idx, 'itemNumber', e.target.value)} className="w-full px-1 py-0.5 text-[10px] border border-transparent hover:border-border rounded bg-transparent font-mono" />
                      ) : li.itemNumber}
                    </td>
                    <td className="px-2 py-1">
                      {editing ? (
                        <input value={editLines[idx]?.description ?? ''} onChange={e => updateLine(idx, 'description', e.target.value)} className="w-full px-1 py-0.5 text-xs border border-border rounded bg-background" />
                      ) : li.description}
                    </td>
                    <td className="px-2 py-1 text-[10px]">
                      {editing ? (
                        <input value={editLines[idx]?.subVendor ?? ''} onChange={e => updateLine(idx, 'subVendor', e.target.value)} className="w-full px-1 py-0.5 text-[10px] border border-border rounded bg-background" />
                      ) : li.subVendor}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {editing ? (
                        <input type="number" step="any" value={editLines[idx]?.scheduledValue ?? 0} onChange={e => updateLine(idx, 'scheduledValue', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-border rounded bg-background font-mono" />
                      ) : fmt(li.scheduledValue)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {editing ? (
                        <input type="number" step="any" value={editLines[idx]?.budgetRealloc ?? 0} onChange={e => updateLine(idx, 'budgetRealloc', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-border rounded bg-background font-mono" />
                      ) : (li.budgetRealloc || 0) !== 0 ? fmt(li.budgetRealloc) : '—'}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {editing ? (
                        <input type="number" step="any" value={editLines[idx]?.previousChanges ?? 0} onChange={e => updateLine(idx, 'previousChanges', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-border rounded bg-background font-mono" />
                      ) : (li.previousChanges || 0) !== 0 ? fmt(li.previousChanges) : '—'}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {editing ? (
                        <input type="number" step="any" value={editLines[idx]?.currentChanges ?? 0} onChange={e => updateLine(idx, 'currentChanges', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-border rounded bg-background font-mono" />
                      ) : (li.currentChanges || 0) !== 0 ? fmt(li.currentChanges) : '—'}
                    </td>
                    <td className="px-2 py-1 text-right font-mono font-bold">{fmt(revised)}</td>
                    <td className="px-2 py-1 text-right font-mono">{(li.previousCompleted || 0) !== 0 ? fmt(li.previousCompleted) : '—'}</td>
                    <td className={`px-2 py-1 text-right font-mono ${editing ? 'bg-[#FFFACD]' : 'bg-[#FFFFF0]'}`}>
                      {editing ? (
                        <input type="number" step="any" value={editLines[idx]?.thisCompleted ?? 0} onChange={e => updateLine(idx, 'thisCompleted', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-[#C9A96E] rounded bg-[#FFFFF0] font-mono font-bold" />
                      ) : <span className="font-bold text-[#0F1B33]">{(li.thisCompleted || 0) !== 0 ? fmt(li.thisCompleted) : '—'}</span>}
                    </td>
                    <td className="px-2 py-1 text-right font-mono font-bold">{totalCompl !== 0 ? fmt(totalCompl) : '—'}</td>
                    <td className="px-2 py-1 text-right font-mono">{pct > 0 ? `${(pct * 100).toFixed(0)}%` : '—'}</td>
                    <td className="px-2 py-1 text-right font-mono">{fmt(balance)}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      {editing ? (
                        <input type="number" step="any" value={editLines[idx]?.retainage ?? 0} onChange={e => updateLine(idx, 'retainage', parseFloat(e.target.value) || 0)} className="w-full px-1 py-0.5 text-xs text-right border border-border rounded bg-background font-mono" />
                      ) : (li.retainage || 0) !== 0 ? fmt(li.retainage) : '—'}
                    </td>
                    {editing && (
                      <td className="px-1">
                        <button onClick={() => removeLine(idx)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {/* Grand Total Row */}
              <tr className="bg-[#0F1B33] text-white font-bold">
                <td className="px-2 py-2" colSpan={3}>GRAND TOTAL</td>
                <td className="px-2 py-2 text-right font-mono">{fmt(totalScheduled)}</td>
                <td colSpan={3}></td>
                <td className="px-2 py-2 text-right font-mono">{fmt(totalRevised)}</td>
                <td className="px-2 py-2 text-right font-mono">{fmt(totalPrevCompleted)}</td>
                <td className="px-2 py-2 text-right font-mono text-[#C9A96E]">{fmt(totalThisCompleted)}</td>
                <td className="px-2 py-2 text-right font-mono text-[#C9A96E]">{fmt(totalCompleted)}</td>
                <td className="px-2 py-2 text-right font-mono">{(pctComplete * 100).toFixed(1)}%</td>
                <td className="px-2 py-2 text-right font-mono">{fmt(totalBalance)}</td>
                <td className="px-2 py-2 text-right font-mono">{fmt(totalRetainage)}</td>
                {editing && <td></td>}
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Bottom save bar */}
      {editing && (
        <div className="sticky bottom-4 bg-card border border-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Editando PA #{payApp.applicationNumber} — <span className="font-semibold text-[#C9A96E]">{fmt(totalCompleted)}</span> completado de {fmt(totalRevised)}
          </p>
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm font-medium">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="bg-[#2E7D32] hover:bg-[#256d29] text-white px-6 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
