'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { canInvite, isFullAccess, ROLE_LABELS } from '@/lib/permissions';
import { useI18n } from '@/hooks/use-i18n';

type Project = { id: string; projectName: string; projectNumber: string };
type TeamUser = { id: string; name: string | null; email: string; role: string; createdAt: string };
type Member = { id: string; role: string; user: TeamUser; project: { id: string; projectName: string; projectNumber: string } | null };
type Invite = { id: string; email: string; name: string | null; role: string; createdAt: string; project: { id: string; projectName: string } | null };

const INVITABLE_ROLES = ['admin', 'pm', 'superintendent', 'owner', 'subcontractor', 'viewer'];

export default function TeamPage() {
  const { data: session, status: sessionStatus } = useSession() || {};
  const { t } = useI18n();
  const sessionRole = (session?.user as any)?.role ?? '';
  const userRole = sessionRole || 'viewer';
  const allowedToInvite = canInvite(userRole);

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [roleBusy, setRoleBusy] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'subcontractor', projectId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [teamRes, projRes] = await Promise.all([fetch('/api/team/invite'), fetch('/api/projects')]);
      if (teamRes.ok) {
        const data = await teamRes.json();
        setUsers(data.users ?? []);
        setMembers(data.members ?? []);
        setInvites(data.invites ?? []);
      }
      if (projRes.ok) {
        setProjects(await projRes.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const needsProject = form.role === 'owner' || form.role === 'subcontractor';
  const sessionReady = sessionStatus !== 'loading';
  const canChangeRoles = sessionReady && isFullAccess(userRole);
  const roleMissing = sessionReady && !sessionRole;
  const myId = (session?.user as any)?.id ?? '';

  const changeRole = async (userId: string, newRole: string) => {
    setRoleBusy(userId);
    setMessage(null);
    try {
      const res = await fetch('/api/team/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('team.roleUpdateError'));
      setMessage({ ok: true, text: t('team.roleUpdated') });
      load();
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message ?? 'Error' });
    } finally {
      setRoleBusy('');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsProject && !form.projectId) {
      setMessage({ ok: false, text: t('team.requiresProject') });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name || undefined,
          role: form.role,
          projectId: form.projectId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t('team.inviteError'));
      setMessage({
        ok: true,
        text: data?.invited
          ? t('team.inviteSent').replace('{email}', form.email)
          : t('team.memberAdded').replace('{email}', form.email),
      });
      setForm({ email: '', name: '', role: 'subcontractor', projectId: '' });
      load();
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message ?? 'Error' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground">{t('team.loading')}</div>;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('team.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('team.subtitle')}
        </p>
      </div>

      {/* Formulario de invitación */}
      <div className="border rounded-xl p-5 bg-card">
        <h2 className="font-semibold mb-3">{t('team.inviteTitle')}</h2>
        {allowedToInvite ? (
          <form onSubmit={handleInvite} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">{t('team.email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg bg-background"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('team.name')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('team.role')}</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg bg-background"
              >
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {form.role === 'superintendent' && t('team.hintSuperintendent')}
                {form.role === 'owner' && t('team.hintOwner')}
                {form.role === 'subcontractor' && t('team.hintSubcontractor')}
                {(form.role === 'admin' || form.role === 'pm') && t('team.hintFull')}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">
                {t('team.project')} {needsProject ? '*' : t('team.optional')}
              </label>
              <select
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg bg-background"
                required={needsProject}
              >
                <option value="">{t('team.selectPlaceholder')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectNumber} · {p.projectName}</option>
                ))}
              </select>
            </div>
            {message && (
              <p className={`sm:col-span-2 text-sm ${message.ok ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2.5 bg-[#0F1B33] text-[#C9A96E] rounded-lg font-semibold disabled:opacity-50"
              >
                {sending ? t('team.sending') : t('team.sendInvite')}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('team.onlyAdminPm')}
          </p>
        )}
      </div>

      {/* Invitaciones pendientes */}
      {invites.length > 0 && (
        <div className="border rounded-xl p-5 bg-card">
          <h2 className="font-semibold mb-3">{t('team.pendingInvites')} ({invites.length})</h2>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 text-sm border border-amber-200 bg-amber-50 rounded-lg px-4 py-2.5">
                <span className="flex-1 font-medium">{inv.name ?? inv.email} <span className="text-muted-foreground font-normal">· {inv.email}</span></span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#0F1B33] text-[#C9A96E]">{ROLE_LABELS[inv.role] ?? inv.role}</span>
                {inv.project && <span className="text-xs text-muted-foreground">{inv.project.projectName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Miembros */}
      <div className="border rounded-xl p-5 bg-card">
        <h2 className="font-semibold mb-3">{t('team.members')} ({users.length})</h2>
        {roleMissing && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            {t('team.sessionRoleMissing')}
          </p>
        )}
        <div className="divide-y">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-[#0F1B33] text-[#C9A96E] flex items-center justify-center text-xs font-bold">
                {(u.name ?? u.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.name ?? '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              {canChangeRoles && u.id !== myId ? (
                <select
                  value={u.role}
                  disabled={roleBusy === u.id}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background font-medium disabled:opacity-50"
                >
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-[#0F1B33] text-[#C9A96E]">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Membresías por proyecto */}
      {members.length > 0 && (
        <div className="border rounded-xl p-5 bg-card">
          <h2 className="font-semibold mb-3">{t('team.projectAccess')}</h2>
          <div className="space-y-2 text-sm">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border rounded-lg px-4 py-2.5">
                <span className="flex-1">{m.user.name ?? m.user.email}</span>
                <span className="text-xs px-2 py-0.5 rounded-full border">{ROLE_LABELS[m.role] ?? m.role}</span>
                <span className="text-xs text-muted-foreground">{m.project ? m.project.projectName : t('team.wholeCompany')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
