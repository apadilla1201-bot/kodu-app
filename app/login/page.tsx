'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Mail, Lock, Eye, EyeOff, ArrowRight, FolderKanban, FileText, FileBarChart2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/hooks/use-i18n';

function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  // Los CTAs de la landing llegan a /login?mode=signup → abrir en modo registro.
  const [isLogin, setIsLogin] = useState(searchParams?.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [plan, setPlan] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Logo de la compañía del usuario ya autenticado (si volvió al login con
  // sesión activa). null = fallback al wordmark koduPM (NUNCA PDG fijo).
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/company/profile', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data?.logoUrl) setCompanyLogo(data.logoUrl);
        }
      } catch {
        // sin sesión o sin logo → wordmark koduPM
      }
    })();
  }, []);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });
        if (res?.error) {
          setError(t('auth.invalidCredentials'));
        } else {
          router.replace('/dashboard');
        }
      } else {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, companyName, plan }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? 'Signup failed');
        } else {
          const signInRes = await signIn('credentials', {
            email,
            password,
            redirect: false,
          });
          if (signInRes?.error) {
            setError(t('auth.accountCreatedLogin'));
            setIsLogin(true);
          } else {
            router.replace('/dashboard');
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(t('auth.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F1B33] items-center justify-center">
        <div className="text-center px-12">
          <div className="relative w-[280px] h-[130px] mx-auto mb-8 flex items-center justify-center">
            {companyLogo ? (
              <Image src={companyLogo} alt="Company logo" fill className="object-contain" unoptimized={companyLogo.startsWith('http')} />
            ) : (
              <div className="flex items-baseline select-none" aria-label="koduPM">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#C9A96E] text-[#0F1B33] font-black text-2xl mr-2 translate-y-[6px]">k</span>
                <span className="text-5xl font-black text-white tracking-tight">kodu</span>
                <span className="text-5xl font-black text-[#C9A96E] tracking-tight">PM</span>
              </div>
            )}
          </div>
          <h1 className="text-3xl font-display font-bold text-[#C9A96E] tracking-tight mb-4">
            {t('auth.heroTitle')}
          </h1>
          <p className="text-gray-300 text-lg max-w-md mx-auto">
            {t('auth.heroSubtitle')}
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-sm mx-auto">
            {[{ label: 'Projects', Icon: FolderKanban }, { label: 'CORs', Icon: FileText }, { label: 'Reports', Icon: FileBarChart2 }].map((item) => (
              <div key={item.label} className="bg-white/5 rounded-lg p-4 text-center">
                <item.Icon className="w-6 h-6 mx-auto mb-2 text-[#C9A96E]" />
                <span className="text-xs text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FEFBF5]">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <div className="relative w-[200px] h-[90px] flex items-center justify-center">
              {companyLogo ? (
                <Image src={companyLogo} alt="Company logo" fill className="object-contain" unoptimized={companyLogo.startsWith('http')} />
              ) : (
                <div className="flex items-baseline select-none" aria-label="koduPM">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#0F1B33] text-[#C9A96E] font-black text-lg mr-1.5 translate-y-[4px]">k</span>
                  <span className="text-3xl font-black text-[#0F1B33] tracking-tight">kodu</span>
                  <span className="text-3xl font-black text-[#C9A96E] tracking-tight">PM</span>
                </div>
              )}
            </div>
          </div>
          <h2 className="text-2xl font-display font-bold text-[#0F1B33] tracking-tight mb-2">
            {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h2>
          <p className="text-[#1B2A4A]/60 mb-8">
            {isLogin ? t('auth.signInSubtitle') : t('auth.registerSubtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">{t('auth.fullName')}</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e: any) => setName(e?.target?.value ?? '')}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C9A96E]/30 rounded-lg text-[#0F1B33] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                    placeholder={t('auth.yourName')}
                  />
                </div>
              </div>
            )}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">{t('auth.companyName')}</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e: any) => setCompanyName(e?.target?.value ?? '')}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C9A96E]/30 rounded-lg text-[#0F1B33] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                    placeholder={t('auth.companyPlaceholder')}
                  />
                </div>
              </div>
            )}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">{t('auth.choosePlan')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['starter', 'pro', 'enterprise'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlan(p)}
                      className={`border rounded-lg px-2 py-2.5 text-center transition-all ${
                        plan === p
                          ? 'border-[#C9A96E] bg-[#C9A96E]/10 ring-1 ring-[#C9A96E]/50'
                          : 'border-[#C9A96E]/30 bg-white hover:border-[#C9A96E]/60'
                      }`}
                    >
                      <span className="block text-xs font-bold text-[#0F1B33] uppercase tracking-wide">
                        {t(`plan.${p}` as any)}
                      </span>
                      <span className="block text-[11px] text-[#1B2A4A]/60 mt-0.5">
                        {p === 'enterprise' ? t('auth.planCustom') : t(`auth.planPrice_${p}` as any)}
                      </span>
                    </button>
                  ))}
                </div>
                {plan === 'enterprise' && (
                  <p className="text-xs text-[#1B2A4A]/60 mt-1.5">{t('auth.enterpriseNote')}</p>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e: any) => setEmail(e?.target?.value ?? '')}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C9A96E]/30 rounded-lg text-[#0F1B33] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e: any) => setPassword(e?.target?.value ?? '')}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#C9A96E]/30 rounded-lg text-[#0F1B33] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#C9A96E]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isLogin && (
                <div className="mt-1.5 text-right">
                  <Link href="/forgot-password" className="text-xs text-[#1B2A4A]/60 hover:text-[#C9A96E] transition-colors">
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C9A96E] hover:bg-[#B8975D] text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? t('auth.signIn') : t('auth.createAccount')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-sm text-[#1B2A4A]/60 hover:text-[#C9A96E] transition-colors"
            >
              {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-[#C9A96E]/15 flex items-center justify-center gap-4 text-xs text-[#1B2A4A]/40">
            <Link href="/privacy" className="hover:text-[#C9A96E] transition-colors">Privacy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#C9A96E] transition-colors">Terms</Link>
            <span>·</span>
            <a href="mailto:support@kodupm.com" className="hover:text-[#C9A96E] transition-colors">support@kodupm.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// useSearchParams exige un boundary de Suspense en Next.js 14.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
