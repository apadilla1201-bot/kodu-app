'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import type { AppLocale } from '@/lib/i18n';
import { ROLE_LABELS, canInvite, isFullAccess } from '@/lib/permissions';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Save, User, Languages, Users, ArrowRight, Crown, Building2, Upload, Trash2 } from 'lucide-react';

export function SettingsContent() {
  const { data: session, update } = useSession();
  const { toast } = useToast();
  const { t, locale, setLocale } = useI18n();
  const userRole = (session?.user as any)?.role ?? 'viewer';
  const canManageTeam = canInvite(userRole);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'pm',
    password: '',
    locale: 'en' as AppLocale,
  });
  const [plan, setPlan] = useState<string>('starter');
  const [companyName, setCompanyName] = useState<string>('');
  // Logo de la compañía (solo admin/owner puede cambiarlo)
  const canManageCompany = isFullAccess(userRole);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
    // Plan actual de la compañía (para la tarjeta Plan & Billing)
    (async () => {
      try {
        const res = await fetch('/api/company/plan', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setPlan((data?.plan ?? 'starter').toLowerCase());
          setCompanyName(data?.companyName ?? '');
        }
      } catch {
        // silencioso: la tarjeta muestra "starter" por defecto
      }
    })();
    // Logo actual de la compañía
    (async () => {
      try {
        const res = await fetch('/api/company/profile', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCompanyLogo(data?.logoUrl ?? null);
        }
      } catch {
        // silencioso
      }
    })();
  }, [toast, t]);

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/company/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed');
      setCompanyLogo(data.logoUrl);
      toast({ title: t('settings.logoSaved') });
      // Refrescar para que el sidebar/login tomen el nuevo logo
      window.location.reload();
    } catch (e: any) {
      toast({ title: e?.message ?? t('settings.logoFailed'), variant: 'destructive' });
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      const res = await fetch('/api/company/logo', { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setCompanyLogo(null);
      toast({ title: t('settings.logoRemoved') });
      window.location.reload();
    } catch (e: any) {
      toast({ title: t('settings.logoFailed'), variant: 'destructive' });
    } finally {
      setLogoBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      // SEGURIDAD (Sprint 0): el rol YA NO se envía en el guardado.
      // El rol lo asigna un admin desde Team, no el propio usuario.
      const body: Record<string, string> = {
        name: form.name,
        email: form.email,
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
        {/* Rol: SOLO LECTURA. Se asigna desde Team, no editable aquí (seguridad). */}
        <div>
          <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1.5">{t('settings.role')}</label>
          <div className="w-full px-3 py-2 border border-border rounded-lg bg-muted/40 text-sm">
            {(ROLE_LABELS as any)[form.role] ?? form.role}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{t('settings.roleManagedByAdmin')}</p>
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

      {/* Plan & Billing: plan actual + ruta de upgrade (Stripe llega en una fase posterior) */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-[#C9A96E]" />
            <h2 className="text-sm font-semibold">{t('plan.title')}</h2>
          </div>
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
            plan === 'enterprise'
              ? 'bg-[#C9A96E] text-[#0F1B33] border-[#C9A96E]'
              : plan === 'pro'
                ? 'bg-[#C9A96E]/20 text-[#C9A96E] border-[#C9A96E]/40'
                : 'bg-muted text-muted-foreground border-border'
          }`}>
            {t(`plan.${plan}` as any)}
          </span>
        </div>
        {companyName && (
          <p className="text-xs text-muted-foreground">{companyName}</p>
        )}
        <p className="text-sm text-muted-foreground">{t(`plan.${plan}Desc` as any)}</p>
        {plan !== 'enterprise' && (
          <a
            href="mailto:info@kodupm.com?subject=koduPM%20plan%20upgrade"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#C9A96E] hover:underline"
          >
            {t('plan.upgradeCta')} <ArrowRight className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Marca de la compañía: logo propio (solo admin/owner). Sin logo = wordmark koduPM. */}
      {canManageCompany && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#C9A96E]" />
            <h2 className="text-sm font-semibold">{t('settings.companyLogo')}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.companyLogoHint')}</p>
          <div className="flex items-center gap-4">
            <div className="w-28 h-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden relative">
              {companyLogo ? (
                <Image src={companyLogo} alt="Company logo" fill className="object-contain p-1" unoptimized={companyLogo.startsWith('http')} />
              ) : (
                <div className="flex items-baseline select-none" aria-label="koduPM">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#0F1B33] text-[#C9A96E] font-bold text-[10px] mr-0.5 translate-y-[2px]">k</span>
                  <span className="text-sm font-bold text-[#0F1B33]">kodu</span>
                  <span className="text-sm font-bold text-[#C9A96E]">PM</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoBusy}
                className="flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {logoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {companyLogo ? t('settings.logoReplace') : t('settings.logoUpload')}
              </button>
              {companyLogo && (
                <button
                  onClick={removeLogo}
                  disabled={logoBusy}
                  className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-500 hover:border-red-300 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('settings.logoRemove')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gestión de equipo: solo visible para quien puede invitar (admin/PM) */}
      {canManageTeam && (
        <Link
          href="/dashboard/team"
          className="flex items-center gap-3 bg-card border border-border rounded-xl p-5 hover:border-[#C9A96E]/60 hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#0F1B33] text-[#C9A96E] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t('team.manageFromSettings')}</p>
            <p className="text-xs text-muted-foreground">{t('team.manageFromSettingsHint')}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#C9A96E] group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      )}
    </div>
  );
}
