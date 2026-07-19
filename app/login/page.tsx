'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/hooks/use-i18n';

export default function LoginPage() {
  const { t } = useI18n();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
          setError('Invalid email or password');
        } else {
          router.replace('/dashboard');
        }
      } else {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
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
            setError('Account created. Please login.');
            setIsLogin(true);
          } else {
            router.replace('/dashboard');
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F1B33] relative items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1B33] via-[#1B2A4A] to-[#0F1B33]" />
        <div className="relative z-10 text-center px-12">
          <div className="relative w-[280px] h-[130px] mx-auto mb-8">
            <Image src="/pdg_logo.png" alt="The Project Delivery Group LLC" fill className="object-contain" />
          </div>
          <h1 className="text-3xl font-display font-bold text-[#C9A96E] tracking-tight mb-4">
            Change Order Management
          </h1>
          <p className="text-gray-300 text-lg max-w-md mx-auto">
            Professional COR tracking, generation, and market analysis for construction projects.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-sm mx-auto">
            {[{ label: 'Projects', icon: '📋' }, { label: 'CORs', icon: '📄' }, { label: 'PDFs', icon: '📑' }].map((item: any) => (
              <div key={item?.label} className="bg-white/5 rounded-lg p-4 text-center">
                <span className="text-2xl block mb-1">{item?.icon}</span>
                <span className="text-xs text-gray-400">{item?.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FEFBF5]">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <div className="relative w-[200px] h-[90px]">
              <Image src="/pdg_logo.png" alt="PDG Logo" fill className="object-contain" />
            </div>
          </div>
          <h2 className="text-2xl font-display font-bold text-[#0F1B33] tracking-tight mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-[#1B2A4A]/60 mb-8">
            {isLogin ? 'Sign in to manage your change orders' : 'Register to start managing change orders'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">Full Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A96E]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e: any) => setName(e?.target?.value ?? '')}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C9A96E]/30 rounded-lg text-[#0F1B33] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/50 focus:border-[#C9A96E]"
                    placeholder="Your name"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">Email</label>
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
              <label className="block text-sm font-medium text-[#0F1B33] mb-1.5">Password</label>
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
                  {isLogin ? 'Sign In' : 'Create Account'}
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
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
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
