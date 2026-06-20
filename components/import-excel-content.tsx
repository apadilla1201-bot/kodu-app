'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  FolderPlus,
  FolderOpen,
  Eye,
  Download,
  Info,
} from 'lucide-react';

interface Project {
  id: string;
  projectNumber: string;
  projectName: string;
}

interface ExcelRow {
  coNumber: string;
  status: string;
  date: string | null;
  approvalDate: string | null;
  amount: number;
  description: string;
  csi: string | null;
  overheadProfit: number;
  generalLiability: number;
  totalCO: number;
  runningTotal: number | null;
  contract: number | null;
  notes: string | null;
  ref: string | null;
}

interface PreviewData {
  projectInfo: {
    projectNumber: string;
    projectName: string;
    location: string;
    pm: string;
  };
  sheets: string[];
  totalRows: number;
  rows: ExcelRow[];
  summary: {
    pending: number;
    approved: number;
    rejected: number;
    totalAmount: number;
  };
}

export function ImportExcelContent({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1); // 1: upload, 2: preview, 3: project config, 4: result
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Project config
  const [importMode, setImportMode] = useState<'new' | 'existing'>('new');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newProjectNumber, setNewProjectNumber] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newContractAmount, setNewContractAmount] = useState('');
  const [newStartDate, setNewStartDate] = useState('');

  // Result
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
    } else {
      toast({ title: 'Invalid file', description: 'Please upload an Excel file (.xlsx or .xls)', variant: 'destructive' });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }, []);

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'preview');

      const res = await fetch('/api/import-excel', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error ?? 'Preview failed');

      setPreview(data);
      // Pre-fill project info
      if (data?.projectInfo) {
        setNewProjectNumber(data.projectInfo.projectNumber || '');
        setNewProjectName(data.projectInfo.projectName || '');
        setNewLocation(data.projectInfo.location || '');
      }
      setStep(2);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to preview file', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'import');

      if (importMode === 'existing' && selectedProjectId) {
        formData.append('projectId', selectedProjectId);
      } else {
        formData.append('projectNumber', newProjectNumber);
        formData.append('projectName', newProjectName);
        formData.append('client', newClient);
        formData.append('location', newLocation);
        if (newContractAmount) formData.append('contractAmount', newContractAmount);
        if (newStartDate) formData.append('startDate', newStartDate);
      }

      const res = await fetch('/api/import-excel', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error ?? 'Import failed');

      setImportResult(data);
      setStep(4);
      toast({ title: 'Import Complete', description: `${data?.imported ?? 0} CORs imported successfully` });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to import data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val ?? 0);
  };

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1B33]">Import from Excel</h1>
          <p className="text-muted-foreground mt-1">Upload your existing Change Order log to populate the system</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 bg-white rounded-xl p-4 shadow-sm border">
        {[
          { n: 1, label: 'Upload File' },
          { n: 2, label: 'Preview Data' },
          { n: 3, label: 'Configure Project' },
          { n: 4, label: 'Results' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              step >= s.n ? 'bg-[#C9A96E] text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {step > s.n ? <CheckCircle2 className="w-5 h-5" /> : s.n}
            </div>
            <span className={`text-sm font-medium hidden sm:inline ${
              step >= s.n ? 'text-[#0F1B33]' : 'text-gray-400'
            }`}>{s.label}</span>
            {i < 3 && <ArrowRight className="w-4 h-4 text-gray-300 ml-auto" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Upload */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-xl shadow-sm border p-8"
          >
            <div className="max-w-xl mx-auto">
              {/* Info box */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg mb-6">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Supported Format</p>
                  <p>Upload your Change Order Excel log (.xlsx). The system will automatically detect the &quot;CO LOG&quot; sheet and extract all COR entries with their status, amounts, and details.</p>
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[#C9A96E] bg-[#C9A96E]/5'
                    : file
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-[#C9A96E] hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-3">
                    <FileSpreadsheet className="w-16 h-16 text-green-600 mx-auto" />
                    <p className="font-semibold text-[#0F1B33]">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-16 h-16 text-gray-400 mx-auto" />
                    <p className="text-lg font-medium text-[#0F1B33]">Drop your Excel file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                    <p className="text-xs text-gray-400">.xlsx or .xls files accepted</p>
                  </div>
                )}
              </div>

              {/* Action button */}
              {file && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex justify-end">
                  <button
                    onClick={handlePreview}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#C9A96E] text-white rounded-lg font-semibold hover:bg-[#B8985D] transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                    Preview Data
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* STEP 2: Preview */}
        {step === 2 && preview && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <p className="text-sm text-muted-foreground">Total CORs</p>
                <p className="text-2xl font-bold text-[#0F1B33]">{preview.totalRows}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-700">{preview.summary.approved}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-700">{preview.summary.pending}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold text-[#C9A96E]">{formatCurrency(preview.summary.totalAmount)}</p>
              </div>
            </div>

            {/* Detected project info */}
            {preview.projectInfo?.projectNumber && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-semibold text-[#0F1B33] mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#C9A96E]" /> Detected Project Info
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Project #:</span> <span className="font-medium">{preview.projectInfo.projectNumber}</span></div>
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{preview.projectInfo.projectName}</span></div>
                  <div><span className="text-muted-foreground">PM:</span> <span className="font-medium">{preview.projectInfo.pm}</span></div>
                  <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{preview.projectInfo.location}</span></div>
                </div>
              </div>
            )}

            {/* Data table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-[#0F1B33]">Data Preview ({preview.totalRows} records)</h3>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0F1B33] text-white sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">CO #</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">O&P 6%</th>
                      <th className="px-3 py-2 text-right">GL 1.5%</th>
                      <th className="px-3 py-2 text-right">Total CO</th>
                      <th className="px-3 py-2 text-left">Notes / Sub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(preview.rows ?? []).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono font-medium text-[#0F1B33]">{row.coNumber}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.date || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.amount)}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{row.description}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.overheadProfit)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.generalLiability)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(row.totalCO)}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[150px] truncate">{row.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => { setStep(1); setPreview(null); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#C9A96E] text-white rounded-lg font-semibold hover:bg-[#B8985D] transition-colors"
              >
                Configure Import <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Project config */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-xl shadow-sm border p-8"
          >
            <h3 className="text-lg font-semibold text-[#0F1B33] mb-6">Select Destination Project</h3>

            {/* Toggle */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setImportMode('new')}
                className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  importMode === 'new'
                    ? 'border-[#C9A96E] bg-[#C9A96E]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FolderPlus className={`w-6 h-6 ${importMode === 'new' ? 'text-[#C9A96E]' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className="font-semibold text-[#0F1B33]">Create New Project</p>
                  <p className="text-sm text-muted-foreground">Import data into a new project</p>
                </div>
              </button>
              {projects.length > 0 && (
                <button
                  onClick={() => setImportMode('existing')}
                  className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    importMode === 'existing'
                      ? 'border-[#C9A96E] bg-[#C9A96E]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FolderOpen className={`w-6 h-6 ${importMode === 'existing' ? 'text-[#C9A96E]' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <p className="font-semibold text-[#0F1B33]">Existing Project</p>
                    <p className="text-sm text-muted-foreground">Add to an existing project</p>
                  </div>
                </button>
              )}
            </div>

            {importMode === 'new' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Number *</label>
                  <input
                    type="text"
                    value={newProjectNumber}
                    onChange={(e) => setNewProjectNumber(e.target.value)}
                    placeholder="e.g. 169"
                    className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-[#C9A96E] focus:border-[#C9A96E] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Arena Madness Sports"
                    className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-[#C9A96E] focus:border-[#C9A96E] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client / Owner *</label>
                  <input
                    type="text"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    placeholder="Client name"
                    className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-[#C9A96E] focus:border-[#C9A96E] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="e.g. 1089 NW 20th ST, Miami FL 33127"
                    className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-[#C9A96E] focus:border-[#C9A96E] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Amount</label>
                  <input
                    type="number"
                    value={newContractAmount}
                    onChange={(e) => setNewContractAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-[#C9A96E] focus:border-[#C9A96E] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-[#C9A96E] focus:border-[#C9A96E] outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-[#C9A96E] focus:border-[#C9A96E] outline-none"
                >
                  <option value="">-- Select a project --</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.projectNumber} — {p.projectName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Import summary */}
            {preview && (
              <div className="mt-6 p-4 bg-[#FEF3C7] rounded-lg">
                <h4 className="font-semibold text-[#0F1B33] mb-2">Import Summary</h4>
                <p className="text-sm text-[#1B2A4A]">
                  <strong>{preview.totalRows}</strong> Change Orders will be imported
                  ({preview.summary.approved} approved, {preview.summary.pending} pending, {preview.summary.rejected} rejected).
                  Total value: <strong>{formatCurrency(preview.summary.totalAmount)}</strong>.
                  Duplicate COR numbers will be skipped.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleImport}
                disabled={loading || (importMode === 'new' && (!newProjectNumber || !newProjectName || !newClient)) || (importMode === 'existing' && !selectedProjectId)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F1B33] text-white rounded-lg font-semibold hover:bg-[#1B2A4A] transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                Import {preview?.totalRows ?? 0} CORs
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Results */}
        {step === 4 && importResult && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-xl shadow-sm border p-8 text-center"
          >
            <CheckCircle2 className="w-20 h-20 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#0F1B33] mb-2">Import Complete!</h2>
            <p className="text-muted-foreground mb-6">Your Change Order data has been successfully imported.</p>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-green-700">{importResult.imported}</p>
                <p className="text-sm text-green-600">Imported</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-amber-700">{importResult.skipped}</p>
                <p className="text-sm text-amber-600">Skipped</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-blue-700">{importResult.total}</p>
                <p className="text-sm text-blue-600">Total</p>
              </div>
            </div>

            {importResult.errors?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Some errors occurred
                </h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {importResult.errors.map((err: string, i: number) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => router.push(`/dashboard/projects/${importResult.projectId}`)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#C9A96E] text-white rounded-lg font-semibold hover:bg-[#B8985D] transition-colors"
            >
              View Project <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
