'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User } from 'lucide-react';

export function SettingsContent() {
  const { data: session, update } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'pm',
    password: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/profile', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setForm({
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'pm',
          password: '',
        });
      } catch {
        toast({ title: 'Failed to load profile', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        name: form.name,
        email: form.email,
        role: form.role,
      };
      if (form.password) body.password = form.password;

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      await update?.({
        ...session,
        user: {
          ...session?.user,
          name: data.name,
          email: data.email,
        },
      });

      setForm((f) => ({ ...f, password: '' }));
      toast({ title: 'Profile saved. Sign out and back in if the sidebar name does not update.' });
    } catch (e: any) {
      toast({ title: e?.message ?? 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6 text-[#C9A96E]" /> My Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your PM identity used on RFIs, emails, and the dashboard
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">Full name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            placeholder="Augusto Padilla"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">Email (login)</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
          >
            <option value="pm">Project Manager</option>
            <option value="owner">Owner</option>
            <option value="estimator">Estimator</option>
            <option value="viewer">Viewer</option>
            <option value="user">User</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">
            New password (optional)
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            placeholder="Leave blank to keep current"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save profile
        </button>
      </div>
    </div>
  );
}
