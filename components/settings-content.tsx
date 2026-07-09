'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import type { AppLocale } from '@/lib/i18n';
import { Loader2, Save, User, Languages } from 'lucide-react';

export function SettingsContent() {
  const { data: session, update } = useSession();
  const { toast } = useToast();
  const { t, locale, setLocale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'pm',
    password: '',
    locale: 'en' as AppLocale,
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
          locale: data.locale === 'es' ? 'es' : 'en',
        });
      } catch {
        toast({ title: t('settings.loadFailed'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast, t]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        name: form.name,
        email: form.email,
        role: form.role,
        locale: form.locale,
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

      await setLocale(form.locale);

      await update?.({
        ...session,
        user: {
          ...session?.user,
          name: data.name,
          email: data.email,
          locale: data.locale,
        },
      });

      setForm((f) => ({ ...f, password: '' }));
      toast({ title: t('settings.profileSaved') });
    } catch (e: any) {
      toast({ title: e?.message ?? t('settings.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6 text-[#C9A96E]" /> {t('settings.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5" /> {t('settings.language')}
          </label>
          <p className="text-xs text-muted-foreground mb-2">{t('settings.languageHint')}</p>
          <select
            value={form.locale}
            onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value as AppLocale }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
          >
            <option value="en">{t('settings.english')}</option>
            <option value="es">{t('settings.spanish')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">{t('settings.fullName')}</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            placeholder="Augusto Padilla"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">{t('settings.email')}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">{t('settings.role')}</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
          >
            <option value="pm">{t('settings.roles.pm')}</option>
            <option value="owner">{t('settings.roles.owner')}</option>
            <option value="estimator">{t('settings.roles.estimator')}</option>
            <option value="viewer">{t('settings.roles.viewer')}</option>
            <option value="user">{t('settings.roles.user')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">
            {t('settings.newPassword')}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            placeholder={t('settings.passwordPlaceholder')}
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-[#C9A96E] hover:bg-[#B8975D] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('settings.saveProfile')}
        </button>
      </div>
    </div>
  );
}
