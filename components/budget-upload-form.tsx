'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Loader2, FileSpreadsheet, Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Project { id: string; projectNumber: string; projectName: string; }

export function BudgetUploadForm({ projects, initialProjectId }: { projects: Project[]; initialProjectId?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(initialProjectId ? 2 : 1);
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    initialProjectId ? projects.find(p => p.id === initialProjectId) || null : null
  );
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [version, setVersion] = useState('1.0');
  const [saving, setSaving] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/budgets/import-excel', { method: 'POST', body: formData });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Import failed'); }
      const data = await res.json();
      setParsedData(data);
      if (data.summary?.projectTitle) {
        const verMatch = data.summary.projectTitle.match(/v[\d.]+/i);
        if (verMatch) setVersion(verMatch[0]);
      }
      setStep(3);
      toast.success(`Parsed ${data.lineItems?.length || 0} line items`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse Excel');
    } finally { setImporting(false); }
  };

  const handleSave = async () => {
    if (!selectedProject || !parsedData) return;
    setSaving(true);
    try {
      const body = {
        projectId: selectedProject.id,
        version,
        budgetDate: parsedData.summary?.budgetDate ? new Date(parsedData.summary.budgetDate).toISOString() : new Date().toISOString(),
        totalACSF: parsedData.summary?.totalACSF || null,
        sfRate: parsedData.summary?.sfRate || null,
        constructionSubtotal: parsedData.summary?.constructionSubtotal || 0,
        furnishingsSubtotal: parsedData.summary?.furnishingsSubtotal || 0,
        subTotalAll: parsedData.summary?.subTotalAll || 0,
        opPercent: parsedData.summary?.opPercent || 0.08,
        glPercent: parsedData.summary?.glPercent || 0.02,
        contingencyPercent: parsedData.summary?.contingencyPercent || 0.10,
        opAmount: parsedData.summary?.opAmount || 0,
        glAmount: parsedData.summary?.glAmount || 0,
        contingencyAmount: parsedData.summary?.contingencyAmount || 0,
        grandTotal: parsedData.summary?.grandTotal || 0,
        exclusions: parsedData.exclusions || '',
        assumptions: parsedData.assumptions || '',
        lineItems: parsedData.lineItems || [],
        detailItems: parsedData.detailItems || [],
      };
      const res = await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      const budget = await res.json();
      toast.success('Budget saved successfully!');
      router.push(`/dashboard/budgets/${budget.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save budget');
    } finally { setSaving(false); }
  };

  const lineItems = parsedData?.lineItems || [];
  const detailItems = parsedData?.detailItems || [];
  const summary = parsedData?.summary || {};
  const regularItems = lineItems.filter((l: any) => !l.isSection && !l.isSubtotal && !l.isFee && !l.isBelowLine);
  const fmtMoney = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <Link href={selectedProject ? `/dashboard/projects/${selectedProject.id}?tab=budget` : '/dashboard/projects'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#C9A96E]">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h2 className="text-2xl font-bold">Upload Budget</h2>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {['Select Project', 'Upload Excel', 'Review & Save'].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step > i + 1 ? 'bg-[#2E7D32] text-white' : step === i + 1 ? 'bg-[#C9A96E] text-white' : 'bg-muted text-muted-foreground'
            }`}>{step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}</div>
            <span className={step === i + 1 ? 'font-medium' : 'text-muted-foreground'}>{s}</span>
            {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Project */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl p-6 shadow-[var(--shadow-sm)] space-y-3">
          <h3 className="font-semibold">Select Project</h3>
          <div className="grid gap-2 max-h-[400px] overflow-y-auto">
            {projects.map(p => (
              <button key={p.id} onClick={() => { setSelectedProject(p); setStep(2); }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-[#C9A96E]/40 hover:bg-muted/30 text-left transition-all">
                <span className="font-mono text-xs text-[#C9A96E]">{p.projectNumber}</span>
                <span className="text-sm font-medium">{p.projectName}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Step 2: Upload Excel */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl p-6 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-mono text-xs text-[#C9A96E]">{selectedProject?.projectNumber}</span>
            <span className="font-semibold">{selectedProject?.projectName}</span>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="w-full border-2 border-dashed border-border rounded-xl p-12 hover:border-[#C9A96E]/50 transition-colors flex flex-col items-center gap-3">
            {importing ? (
              <><Loader2 className="w-10 h-10 animate-spin text-[#C9A96E]" /><span className="text-sm text-muted-foreground">Parsing budget...</span></>
            ) : (
              <><FileSpreadsheet className="w-10 h-10 text-muted-foreground/50" />
              <span className="text-sm font-medium">Click to upload Budget Excel</span>
              <span className="text-xs text-muted-foreground">Supports: Summary, Take Off Sheet, GCs, Project Support, Exclusions</span></>
            )}
          </button>
        </motion.div>
      )}

      {/* Step 3: Review & Save */}
      {step === 3 && parsedData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Version input */}
          <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground">Version</label>
                <input value={version} onChange={e => setVersion(e.target.value)}
                  className="block mt-1 w-32 px-3 py-1.5 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><p className="text-xs text-muted-foreground">Sub Total</p><p className="font-mono font-semibold text-sm">{fmtMoney(summary.subTotalAll)}</p></div>
                <div><p className="text-xs text-muted-foreground">O&P ({((summary.opPercent || 0) * 100).toFixed(0)}%)</p><p className="font-mono font-semibold text-sm">{fmtMoney(summary.opAmount)}</p></div>
                <div><p className="text-xs text-muted-foreground">GL Insurance ({((summary.glPercent || 0) * 100).toFixed(0)}%)</p><p className="font-mono font-semibold text-sm">{fmtMoney(summary.glAmount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-mono font-semibold text-sm text-[#2E7D32]">{fmtMoney(summary.grandTotal)}</p></div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl p-4 shadow-[var(--shadow-sm)] text-center">
              <p className="text-2xl font-bold font-mono">{regularItems.length}</p>
              <p className="text-xs text-muted-foreground">Line Items</p>
            </div>
            <div className="bg-card rounded-xl p-4 shadow-[var(--shadow-sm)] text-center">
              <p className="text-2xl font-bold font-mono">{lineItems.filter((l: any) => l.isSection).length}</p>
              <p className="text-xs text-muted-foreground">Sections</p>
            </div>
            <div className="bg-card rounded-xl p-4 shadow-[var(--shadow-sm)] text-center">
              <p className="text-2xl font-bold font-mono">{detailItems.filter((d: any) => d.sheetName === 'GCs').length}</p>
              <p className="text-xs text-muted-foreground">GC Items</p>
            </div>
            <div className="bg-card rounded-xl p-4 shadow-[var(--shadow-sm)] text-center">
              <p className="text-2xl font-bold font-mono">{detailItems.filter((d: any) => d.sheetName === 'Project Support').length}</p>
              <p className="text-xs text-muted-foreground">Support Items</p>
            </div>
          </div>

          {/* Take Off Sheet preview */}
          <div className="bg-card rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="px-5 py-3 bg-[#0F1B33] text-white text-sm font-semibold">Take Off Sheet Preview</div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Item No.</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-left px-3 py-2">Sub/Vendor</th>
                    <th className="text-right px-3 py-2">Scheduled Value</th>
                    <th className="text-right px-3 py-2">Changes</th>
                    <th className="text-right px-3 py-2">Revised Value</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.slice(0, 80).map((li: any, i: number) => (
                    <tr key={i} className={`border-t border-border/50 ${
                      li.isSection ? 'bg-[#0F1B33]/5 font-semibold' :
                      li.isSubtotal ? 'bg-[#C9A96E]/5 font-medium' :
                      li.isFee ? 'bg-purple-50' :
                      li.isBelowLine ? 'bg-amber-50/50' : ''
                    }`}>
                      <td className="px-3 py-1.5 font-mono">{li.itemNumber || (li.isSection ? li.divisionCode : '')}</td>
                      <td className="px-3 py-1.5">{li.description}</td>
                      <td className="px-3 py-1.5">{li.subVendor}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{li.scheduledValue ? fmtMoney(li.scheduledValue) : ''}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{li.currentChanges ? fmtMoney(li.currentChanges) : ''}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{li.revisedValue ? fmtMoney(li.revisedValue) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lineItems.length > 80 && <p className="text-xs text-center py-2 text-muted-foreground">... and {lineItems.length - 80} more items</p>}
            </div>
          </div>

          {/* Exclusions preview */}
          {parsedData.exclusions && (
            <div className="bg-card rounded-xl p-5 shadow-[var(--shadow-sm)]">
              <h4 className="font-semibold text-sm mb-2">Exclusions & Qualifications</h4>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto">{parsedData.exclusions}</pre>
            </div>
          )}

          {/* Save button */}
          <div className="flex gap-3">
            <button onClick={() => { setStep(2); setParsedData(null); }} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">Re-upload</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-[#C9A96E] hover:bg-[#B8975D] text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Budget</>}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
