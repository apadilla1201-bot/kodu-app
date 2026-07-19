'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '@/hooks/use-i18n';

function ResetPasswordForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError(t('auth.passwordTooShort')); return; }
    if (password !== confirm) { setError(t('auth.passwordsNoMatch')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? t('auth.invalidLinkDesc'));
      } else {
        setDone(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <div className="relative w-[200px] h-[90px]">
          <Image src="/pdg_logo.png" alt="Kodu PM" fill className="object-contain" />
        </div>
      </div>

      {done ? (
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-display font-bold text-[#0F1B33] tracking-tight mb-3">
            {t('auth.resetDoneTitle')}
          </h2>
          <p className="text-[#1B2A4A]/60 mb-8">{t('auth.resetDoneDesc')}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-white font-medium py-2.5 px-8 rounded-lg transition-all"
          >
            {t('auth.goToLogin')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : !token ? (
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-5">
            <XCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-2xl font-display font-bold text-[#0F1B33] tracking-tight mb-3">
            {t('auth.invalidLinkTitle')}
          </h2>
          <p className="text-[#1B2A4A]/60 mb-8">{t('auth.invalidLinkDesc')}</p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-white font-medium py-2.5 px-8 rounded-lg transition-all"
          >
            {t('auth.requestNewLink')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-display font-bold text-[#0F1B33] tracking-tight mb-2">
            {t('auth.resetTitle')}
          </h2>
          <p className="text-[#1B2A4A]/60 mb-8">{t('auth.resetDesc')}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">{t('auth.newPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#C9A96E]/30 rounded-lg text-[#0F1B33] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                  placeholder={t('auth.passwordMinHint')}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#C9A96E]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C9A96E]/30 rounded-lg text-[#0F1B33] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                  placeholder={t('auth.passwordMinHint')}
                  required
                  minLength={8}
                />
              </div>
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
                  {t('auth.resetPassword')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-[#1B2A4A]/60 hover:text-[#C9A96E] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {t('auth.backToLogin')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#FEFBF5]">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
