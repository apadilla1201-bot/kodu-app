import { useState } from 'react'
import { HardHat, Menu, X, Globe } from 'lucide-react'
import { copy, APP_URL, type Lang } from '../i18n'

export default function Nav({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = copy[lang].nav
  const [open, setOpen] = useState(false)
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#0F1B33]/95 backdrop-blur border-b border-white/10">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 text-white font-bold text-lg tracking-tight">
          <span className="w-8 h-8 rounded-lg bg-[#C9A96E] flex items-center justify-center">
            <HardHat className="w-5 h-5 text-[#0F1B33]" />
          </span>
          Kodu PM
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/70">
          <a href="#modules" className="hover:text-white transition-colors">{t.modules}</a>
          <a href="#how" className="hover:text-white transition-colors">{t.how}</a>
          <a href="#faq" className="hover:text-white transition-colors">{t.faq}</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="flex items-center gap-1.5 text-xs font-semibold text-white/80 border border-white/20 rounded-full px-3 py-1.5 hover:border-[#C9A96E] hover:text-[#C9A96E] transition-colors"
          >
            <Globe className="w-3.5 h-3.5" /> {lang === 'en' ? 'ES' : 'EN'}
          </button>
          <a href={APP_URL} className="hidden sm:block text-sm text-white/80 hover:text-white transition-colors">{t.signin}</a>
          <a href={APP_URL} className="text-sm font-semibold bg-[#C9A96E] hover:bg-[#B8975D] text-[#0F1B33] rounded-full px-4 py-2 transition-colors">
            {t.cta}
          </a>
          <button className="md:hidden text-white" onClick={() => setOpen(!open)} aria-label="menu">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-[#0F1B33] border-t border-white/10 px-5 py-4 flex flex-col gap-4 text-white/80">
          <a href="#modules" onClick={() => setOpen(false)}>{t.modules}</a>
          <a href="#how" onClick={() => setOpen(false)}>{t.how}</a>
          <a href="#faq" onClick={() => setOpen(false)}>{t.faq}</a>
          <a href={APP_URL}>{t.signin}</a>
        </div>
      )}
    </header>
  )
}
