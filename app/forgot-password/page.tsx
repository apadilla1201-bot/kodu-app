'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '@/hooks/use-i18n';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong');
      } else {
        setSent(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#FEFBF5]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="relative w-[200px] h-[90px]">
            <Image src="/pdg_logo.png" alt="Kodu PM" fill className="object-contain" />
          </div>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-display font-bold text-[#0F1B33] tracking-tight mb-3">
              {t('auth.resetSentTitle')}
            </h2>
            <p className="text-[#1B2A4A]/60 mb-8">
              {t('auth.resetSentDesc', { email })}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-[#C9A96E] hover:text-[#B8975D] font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-display font-bold text-[#0F1B33] tracking-tight mb-2">
              {t('auth.forgotTitle')}
            </h2>
            <p className="text-[#1B2A4A]/60 mb-8">{t('auth.forgotDesc')}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C9A96E]/30 rounded-lg text-[#0F1B33] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                    placeholder="you@company.com"
                    required
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
                    {t('auth.sendResetLink')}
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
    </div>
  );
}
