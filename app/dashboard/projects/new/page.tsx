'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Building2, Hash, MapPin, DollarSign, Calendar, User } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    projectNumber: '',
    projectName: '',
    client: '',
    location: '',
    contractAmount: '',
    startDate: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev: any) => ({ ...(prev ?? {}), [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(form?.projectNumber ?? '').trim() || !(form?.projectName ?? '').trim() || !(form?.client ?? '').trim()) {
      toast.error('Project Number, Name, and Client are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          contractAmount: parseFloat(form?.contractAmount ?? '0') || 0,
          startDate: form?.startDate ? new Date(form.startDate).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Failed to create project');
      }
      const data = await res.json();
      toast.success('Project created successfully');
      router.replace(`/dashboard/projects/${data?.id}`);
    } catch (err: any) {
      console.error('Create project error:', err);
      toast.error(err?.message ?? 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'projectNumber', label: 'Project Number', icon: Hash, placeholder: '169', required: true },
    { key: 'projectName', label: 'Project Name', icon: Building2, placeholder: 'Arena Madness Sports', required: true },
    { key: 'client', label: 'Client / Owner', icon: User, placeholder: 'Client name', required: true },
    { key: 'location', label: 'Location', icon: MapPin, placeholder: '1089 NW 20th ST, Miami FL 33127' },
    { key: 'contractAmount', label: 'Contract Amount', icon: DollarSign, placeholder: '0.00', type: 'number' },
    { key: 'startDate', label: 'Start Date', icon: Calendar, type: 'date' },
  ];

  return (
    <div className="max-w-[700px] mx-auto">
      <Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-[#C9A96E] mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold tracking-tight mb-1">New Project</h1>
        <p className="text-sm text-muted-foreground mb-6">Create a new construction project to begin tracking change orders</p>

        <form onSubmit={handleSubmit} className="bg-card rounded-lg p-6 shadow-[var(--shadow-sm)] space-y-5">
          {fields.map((f: any) => {
            const Icon = f?.icon;
            return (
              <div key={f?.key}>
                <label className="block text-sm font-medium mb-1.5">
                  {f?.label} {f?.required && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />}
                  <input
                    type={f?.type ?? 'text'}
                    value={(form as any)?.[f?.key] ?? ''}
                    onChange={(e: any) => updateField(f?.key, e?.target?.value ?? '')}
                    placeholder={f?.placeholder ?? ''}
                    required={f?.required ?? false}
                    step={f?.type === 'number' ? '0.01' : undefined}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                  />
                </div>
              </div>
            );
          })}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Link
              href="/dashboard/projects"
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Create Project
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
