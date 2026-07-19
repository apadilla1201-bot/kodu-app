import { ArrowRight, CheckCircle2, FileText, FolderKanban, HelpCircle } from 'lucide-react'
import { copy, APP_URL, type Lang } from '../i18n'

const demoCors = [
  { n: '169-001', d: 'Asbestos removal in stairwell', s: 'Approved' },
  { n: '169-002', d: 'Remove and dispose of asphalt 30,000 sf', s: 'Approved' },
  { n: '169-003', d: 'Warehouse ceiling removal', s: 'Pending' },
]

export default function Hero({ lang }: { lang: Lang }) {
  const t = copy[lang].hero
  return (
    <section className="bg-[#0F1B33] text-white pt-32 pb-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0F1B33] via-[#1B2A4A] to-[#0F1B33] opacity-90" />
      <div className="max-w-6xl mx-auto px-5 relative grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <span className="inline-block text-xs font-semibold tracking-wide text-[#C9A96E] border border-[#C9A96E]/40 rounded-full px-3 py-1 mb-6">
            {t.badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-6">
            {t.h1a}{' '}
            <span className="text-[#C9A96E]">{t.h1b}</span>
          </h1>
          <p className="text-lg text-white/70 mb-8 max-w-xl">{t.sub}</p>
          <div className="flex flex-wrap gap-4 mb-6">
            <a href={APP_URL} className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-[#0F1B33] font-semibold rounded-full px-7 py-3.5 transition-colors">
              {t.cta1} <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#how" className="inline-flex items-center gap-2 border border-white/25 hover:border-white/60 text-white rounded-full px-7 py-3.5 transition-colors">
              {t.cta2}
            </a>
          </div>
          <p className="text-sm text-white/50">{t.micro}</p>
        </div>

        {/* Dashboard mock */}
        <div className="bg-[#FEFBF5] rounded-2xl shadow-2xl p-6 text-[#0F1B33] rotate-1 hover:rotate-0 transition-transform duration-300">
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { icon: FolderKanban, l: t.card.projects, v: '2' },
              { icon: FileText, l: t.card.cors, v: '75' },
              { icon: HelpCircle, l: t.card.rfis, v: '9' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-[#0F1B33]/5">
                <s.icon className="w-4 h-4 text-[#C9A96E] mb-2" />
                <p className="text-[10px] uppercase tracking-wide text-[#0F1B33]/50">{s.l}</p>
                <p className="text-2xl font-bold">{s.v}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[#0F1B33]/5 mb-3">
            <p className="text-[10px] uppercase tracking-wide text-[#0F1B33]/50 mb-1">{t.card.approved}</p>
            <p className="text-3xl font-bold text-[#2E7D32]">$320,796</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[#0F1B33]/5">
            <p className="text-xs font-semibold mb-3">{t.card.recent}</p>
            {demoCors.map((c) => (
              <div key={c.n} className="flex items-center justify-between py-2 border-t border-[#0F1B33]/5 text-sm">
                <span className="text-[#C9A96E] font-mono text-xs mr-2">{c.n}</span>
                <span className="flex-1 truncate text-[#0F1B33]/70">{c.d}</span>
                <span className={`ml-2 text-[10px] font-semibold rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${c.s === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {c.s === 'Approved' && <CheckCircle2 className="w-3 h-3" />}{c.s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
