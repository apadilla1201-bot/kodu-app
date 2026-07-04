'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';

interface ProjectOpt {
  id: string;
  projectNumber: string;
  projectName: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string | null;
  phone: string | null;
}

const DEFAULT_ROLES = [
  'Project Manager',
  'Superintendent',
  'Architect',
  'Subcontractor',
  'Owner',
  'Designer',
  'Engineer',
  'Consultant',
];

export function ProjectDirectoryContent({
  projects,
  initialProjectId,
}: {
  projects: ProjectOpt[];
  initialProjectId?: string;
}) {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || '');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'Architect',
    company: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/contacts`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setContacts(data.contacts || []);
      if (data.roles?.length) setRoles(data.roles);
    } catch {
      toast({ title: 'Failed to load directory', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { load(); }, [load]);

  const addContact = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: 'Contact added' });
      setForm({ name: '', email: '', role: form.role, company: '', phone: '' });
      await load();
    } catch (e: any) {
      toast({ title: e?.message ?? 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeContact = async (id: string) => {
    if (!confirm('Remove this contact from the project directory?')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/contacts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Contact removed' });
      await load();
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-[#C9A96E]" /> Project Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Team contacts for RFIs and Submittals — PM, Super, Architect, Subs, Owner
          </p>
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.projectNumber} — {p.projectName}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Add contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
          <input
            type="email"
            placeholder="Email *"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
          >
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <input
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
          <button
            onClick={addContact}
            disabled={saving}
            className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0F1B33] text-white text-left text-xs uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No contacts yet. Add your PM, Superintendent, Architect (AOR), and Subs.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded bg-[#FEF3C7] text-[#92400E]">{c.role}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.company || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeContact(c.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
