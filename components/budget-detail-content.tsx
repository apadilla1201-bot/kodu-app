'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Wallet, FileText, Building2, DollarSign, Hash,
  Trash2, ChevronDown, ChevronRight, Calendar,
} from 'lucide-react';

function fmtMoney(n: number): string {
  return `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}
function fmtPct(n: number): string { return `${((n ?? 0) * 100).toFixed(1)}%`; }

type TabKey = 'takeoff' | 'gcs' | 'support' | 'exclusions';

export function BudgetDetailContent({ budget }: { budget: any }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('takeoff');
  const [deleting, setDeleting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const lineItems = budget.lineItems ?? [];
  const detailItems = budget.detailItems ?? [];
  const gcItems = detailItems.filter((d: any) => d.sheetName === 'GCs');
  const supportItems = detailItems.filter((d: any) => d.sheetName === 'Project Support');

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = async () => {
    if (!confirm('Delete this budget? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/budgets/${budget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Budget deleted');
      router.push(`/dashboard/projects/${budget.projectId}?tab=budget`);
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'takeoff', label: 'Take Off Sheet', count: lineItems.length },
    { key: 'gcs', label: 'General Conditions', count: gcItems.length },
    { key: 'support', label: 'Project Support', count: supportItems.length },
    { key: 'exclusions', label: 'Exclusions & Qualifications', count: 0 },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <Link href={`/dashboard/projects/${budget.projectId}?tab=budget`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#C9A96E]">
        <ArrowLeft className="w-4 h-4" /> Back to Project
      </Link>

      {/* Header */}
      <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-5 h-5 text-purple-500" />
              <span className="font-mono text-lg font-bold">{budget.version}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${budget.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{budget.status}</span>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Hash className="w-3 h-3" /> {budget.project?.projectNumber} — {budget.project?.projectName}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" /> {fmtDate(budget.budgetDate)}
              {budget.totalACSF ? <> · AC: {budget.totalACSF.toLocaleString()} SF · Rate: ${budget.sfRate?.toFixed(2)}/SF</> : null}
            </p>
          </div>
          <button onClick={handleDelete} disabled={deleting}
            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Financial summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Construction</p>
            <p className="font-mono font-semibold text-sm">{fmtMoney(budget.constructionSubtotal)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Furnishings</p>
            <p className="font-mono font-semibold text-sm">{fmtMoney(budget.furnishingsSubtotal)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Sub Total</p>
            <p className="font-mono font-semibold text-sm">{fmtMoney(budget.subTotalAll)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">O&P ({fmtPct(budget.opPercent)})</p>
            <p className="font-mono font-semibold text-sm">{fmtMoney(budget.opAmount)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">GL Ins. ({fmtPct(budget.glPercent)})</p>
            <p className="font-mono font-semibold text-sm">{fmtMoney(budget.glAmount)}</p>
          </div>
          <div className="bg-[#2E7D32]/5 rounded-lg p-3 ring-1 ring-[#2E7D32]/20">
            <p className="text-xs text-[#2E7D32]">Grand Total</p>
            <p className="font-mono font-bold text-sm text-[#2E7D32]">{fmtMoney(budget.grandTotal)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card rounded-xl p-1 shadow-[var(--shadow-sm)] overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-[#C9A96E] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}>
            {t.label} {t.count > 0 && <span className="ml-1 opacity-70">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Take Off Sheet */}
      {activeTab === 'takeoff' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-card rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0F1B33] text-white sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 w-[100px]">Item No.</th>
                  <th className="text-left px-3 py-2.5">Description</th>
                  <th className="text-left px-3 py-2.5 w-[120px]">Sub / Vendor</th>
                  <th className="text-right px-3 py-2.5 w-[110px]">Scheduled Value</th>
                  <th className="text-right px-3 py-2.5 w-[100px]">Changes</th>
                  <th className="text-right px-3 py-2.5 w-[110px]">Revised Value</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li: any, i: number) => (
                  <tr key={li.id || i} className={`border-t border-border/30 ${
                    li.isSection ? 'bg-[#0F1B33]/5' :
                    li.isSubtotal ? 'bg-[#C9A96E]/5' :
                    li.isFee ? 'bg-purple-50/50' :
                    li.isBelowLine ? 'bg-amber-50/30' :
                    i % 2 === 0 ? '' : 'bg-muted/20'
                  }`}>
                    <td className={`px-3 py-1.5 font-mono ${li.isSection ? 'font-bold text-[#0F1B33]' : ''}`}>
                      {li.itemNumber || (li.isSection ? li.divisionCode : '')}
                    </td>
                    <td className={`px-3 py-1.5 ${li.isSection ? 'font-bold text-[#0F1B33] uppercase text-[11px]' : li.isSubtotal ? 'font-semibold' : ''}`}>
                      {li.description}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{li.subVendor}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {li.scheduledValue ? fmtMoney(li.scheduledValue) : ''}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${li.currentChanges ? 'text-[#C9A96E] font-medium' : ''}`}>
                      {li.currentChanges ? fmtMoney(li.currentChanges) : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium">
                      {li.revisedValue ? fmtMoney(li.revisedValue) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* GCs Tab */}
      {activeTab === 'gcs' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-card rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0F1B33] text-white sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 w-[60px]">Status</th>
                  <th className="text-left px-3 py-2.5 w-[80px]">Code</th>
                  <th className="text-left px-3 py-2.5">Description</th>
                  <th className="text-right px-3 py-2.5 w-[50px]">Qty</th>
                  <th className="text-center px-3 py-2.5 w-[50px]">Unit</th>
                  <th className="text-right px-3 py-2.5 w-[80px]">Lab. Total</th>
                  <th className="text-right px-3 py-2.5 w-[80px]">Mat. Total</th>
                  <th className="text-right px-3 py-2.5 w-[80px]">Eqp. Total</th>
                  <th className="text-right px-3 py-2.5 w-[80px]">Sub. Total</th>
                  <th className="text-right px-3 py-2.5 w-[90px]">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {gcItems.map((di: any, i: number) => (
                  <tr key={di.id || i} className={`border-t border-border/30 ${
                    di.isHeader ? 'bg-[#0F1B33]/5 font-semibold' :
                    di.status === 'excluded' ? 'opacity-40 line-through' :
                    i % 2 === 0 ? '' : 'bg-muted/20'
                  }`}>
                    <td className="px-3 py-1.5">
                      {di.status && <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        di.status === 'excluded' ? 'bg-red-100 text-red-600' :
                        di.status === 'cost of work' ? 'bg-blue-100 text-blue-600' :
                        di.status === 'by owner' ? 'bg-purple-100 text-purple-600' :
                        di.status === 'na' ? 'bg-gray-100 text-gray-500' :
                        'bg-gray-100 text-gray-600'
                      }`}>{di.status}</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{di.itemCode}</td>
                    <td className={`px-3 py-1.5 ${di.isHeader ? 'uppercase text-[#0F1B33]' : ''}`}>{di.description}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.quantity || ''}</td>
                    <td className="px-3 py-1.5 text-center">{di.unit}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.laborTotal ? fmtMoney(di.laborTotal) : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.materialTotal ? fmtMoney(di.materialTotal) : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.equipmentTotal ? fmtMoney(di.equipmentTotal) : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.subTotal ? fmtMoney(di.subTotal) : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium">{di.totalCost ? fmtMoney(di.totalCost) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Project Support Tab */}
      {activeTab === 'support' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-card rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0F1B33] text-white sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 w-[60px]">Status</th>
                  <th className="text-left px-3 py-2.5 w-[80px]">Code</th>
                  <th className="text-left px-3 py-2.5">Description</th>
                  <th className="text-right px-3 py-2.5 w-[50px]">Qty</th>
                  <th className="text-center px-3 py-2.5 w-[50px]">Unit</th>
                  <th className="text-right px-3 py-2.5 w-[80px]">Lab. Total</th>
                  <th className="text-right px-3 py-2.5 w-[80px]">Mat. Total</th>
                  <th className="text-right px-3 py-2.5 w-[80px]">Eqp. Total</th>
                  <th className="text-right px-3 py-2.5 w-[80px]">Sub. Total</th>
                  <th className="text-right px-3 py-2.5 w-[90px]">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {supportItems.map((di: any, i: number) => (
                  <tr key={di.id || i} className={`border-t border-border/30 ${
                    di.isHeader ? 'bg-[#0F1B33]/5 font-semibold' :
                    di.status === 'excluded' ? 'opacity-40 line-through' :
                    i % 2 === 0 ? '' : 'bg-muted/20'
                  }`}>
                    <td className="px-3 py-1.5">
                      {di.status && <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        di.status === 'excluded' ? 'bg-red-100 text-red-600' :
                        di.status === 'cost of work' ? 'bg-blue-100 text-blue-600' :
                        di.status === 'by owner' ? 'bg-purple-100 text-purple-600' :
                        di.status === 'na' ? 'bg-gray-100 text-gray-500' :
                        'bg-gray-100 text-gray-600'
                      }`}>{di.status}</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{di.itemCode}</td>
                    <td className={`px-3 py-1.5 ${di.isHeader ? 'uppercase text-[#0F1B33]' : ''}`}>{di.description}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.quantity || ''}</td>
                    <td className="px-3 py-1.5 text-center">{di.unit}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.laborTotal ? fmtMoney(di.laborTotal) : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.materialTotal ? fmtMoney(di.materialTotal) : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.equipmentTotal ? fmtMoney(di.equipmentTotal) : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{di.subTotal ? fmtMoney(di.subTotal) : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium">{di.totalCost ? fmtMoney(di.totalCost) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Exclusions & Qualifications Tab */}
      {activeTab === 'exclusions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {budget.exclusions && (
            <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-sm)]">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-500" /> Project Exclusions
              </h3>
              <div className="space-y-1.5">
                {budget.exclusions.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">{line}</p>
                ))}
              </div>
            </div>
          )}
          {budget.assumptions && (
            <div className="bg-card rounded-xl p-6 shadow-[var(--shadow-sm)]">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" /> Project Assumptions
              </h3>
              <div className="space-y-1.5">
                {budget.assumptions.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">{line}</p>
                ))}
              </div>
            </div>
          )}
          {!budget.exclusions && !budget.assumptions && (
            <div className="bg-card rounded-xl p-12 text-center shadow-[var(--shadow-sm)]">
              <p className="text-muted-foreground">No exclusions or qualifications recorded.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
