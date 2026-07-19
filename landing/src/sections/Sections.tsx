import { AlertTriangle, FileSpreadsheet, FileText, HelpCircle, Package, ClipboardList, Camera, CalendarRange, BarChart3, ShoppingCart, Receipt, UploadCloud, Search, Settings2, CheckCircle2, Globe, ArrowRight } from 'lucide-react'
import { copy, APP_URL, type Lang } from '../i18n'

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-[#C9A96E] mb-3">{children}</p>
}

export function Problem({ lang }: { lang: Lang }) {
  const t = copy[lang].problem
  return (
    <section className="bg-[#FEFBF5] py-20">
      <div className="max-w-6xl mx-auto px-5">
        <Kicker>{t.kicker}</Kicker>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0F1B33] mb-12 max-w-2xl">{t.h2}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {t.items.map((it, i) => (
            <div key={i} className="bg-white rounded-2xl p-7 border border-[#0F1B33]/5 shadow-sm">
              <AlertTriangle className="w-6 h-6 text-[#C9A96E] mb-4" />
              <h3 className="font-bold text-lg text-[#0F1B33] mb-2">{it.t}</h3>
              <p className="text-[#0F1B33]/60 text-sm leading-relaxed">{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const icons = [FileText, HelpCircle, ClipboardList, ShoppingCart, Receipt, Package, Camera, CalendarRange, BarChart3]

export function Modules({ lang }: { lang: Lang }) {
  const t = copy[lang].modules
  return (
    <section id="modules" className="bg-[#0F1B33] py-20 text-white">
      <div className="max-w-6xl mx-auto px-5">
        <Kicker>{t.kicker}</Kicker>
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.h2}</h2>
        <p className="text-white/60 mb-12 max-w-xl">{t.sub}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.list.map((m, i) => {
            const Icon = icons[i]
            return (
              <div key={i} className="rounded-2xl p-6 bg-white/5 border border-white/10 hover:border-[#C9A96E]/50 hover:bg-white/10 transition-colors">
                <Icon className="w-6 h-6 text-[#C9A96E] mb-4" />
                <h3 className="font-bold mb-2">{m.t}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{m.d}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const stepIcons = [UploadCloud, Search, Settings2, CheckCircle2]

export function ImportFlow({ lang }: { lang: Lang }) {
  const t = copy[lang].import
  return (
    <section id="how" className="bg-[#FEFBF5] py-20">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <Kicker>{t.kicker}</Kicker>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F1B33] mb-5">{t.h2}</h2>
            <p className="text-[#0F1B33]/60 mb-8 leading-relaxed">{t.sub}</p>
            <a href={APP_URL} className="inline-flex items-center gap-2 bg-[#0F1B33] hover:bg-[#1B2A4A] text-white font-semibold rounded-full px-7 py-3.5 transition-colors">
              {copy[lang].hero.cta1} <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="space-y-4">
            {t.steps.map((s, i) => {
              const Icon = stepIcons[i]
              return (
                <div key={i} className="flex gap-4 items-start bg-white rounded-2xl p-5 border border-[#0F1B33]/5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-[#0F1B33] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#C9A96E]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0F1B33]">{i + 1}. {s.t}</p>
                    <p className="text-sm text-[#0F1B33]/60">{s.d}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export function Bilingual({ lang }: { lang: Lang }) {
  const t = copy[lang].bilingual
  return (
    <section className="bg-[#C9A96E] py-16">
      <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-[#0F1B33]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#0F1B33]/70">{t.kicker}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F1B33] mb-4">{t.h2}</h2>
          <p className="text-[#0F1B33]/70 leading-relaxed">{t.sub}</p>
        </div>
        <ul className="space-y-3">
          {t.points.map((p, i) => (
            <li key={i} className="flex items-center gap-3 bg-[#0F1B33] text-white rounded-xl px-5 py-4">
              <CheckCircle2 className="w-5 h-5 text-[#C9A96E] shrink-0" />
              <span className="text-sm font-medium">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function FAQ({ lang }: { lang: Lang }) {
  const t = copy[lang].faq
  return (
    <section id="faq" className="bg-[#FEFBF5] py-20">
      <div className="max-w-3xl mx-auto px-5">
        <Kicker>{t.kicker}</Kicker>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0F1B33] mb-10">{t.h2}</h2>
        <div className="space-y-4">
          {t.items.map((f, i) => (
            <details key={i} className="group bg-white rounded-2xl border border-[#0F1B33]/5 shadow-sm open:border-[#C9A96E]/40">
              <summary className="cursor-pointer list-none flex items-center justify-between p-6 font-semibold text-[#0F1B33]">
                {f.q}
                <FileSpreadsheet className="w-4 h-4 text-[#C9A96E] shrink-0 ml-4 group-open:rotate-45 transition-transform" />
              </summary>
              <p className="px-6 pb-6 text-sm text-[#0F1B33]/60 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCTA({ lang }: { lang: Lang }) {
  const t = copy[lang].final
  return (
    <section className="bg-[#0F1B33] py-20 text-center text-white">
      <div className="max-w-2xl mx-auto px-5">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t.h2}</h2>
        <p className="text-white/60 mb-8">{t.sub}</p>
        <a href={APP_URL} className="inline-flex items-center gap-2 bg-[#C9A96E] hover:bg-[#B8975D] text-[#0F1B33] font-semibold rounded-full px-9 py-4 text-lg transition-colors">
          {t.cta} <ArrowRight className="w-5 h-5" />
        </a>
      </div>
    </section>
  )
}

export function Footer({ lang }: { lang: Lang }) {
  const t = copy[lang].footer
  return (
    <footer className="bg-[#0A1425] text-white/60 py-10">
      <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-white font-bold mb-1">Kodu PM</p>
          <p className="text-sm">{t.tag}</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <a href={APP_URL} className="hover:text-white transition-colors">{t.signin}</a>
          <a href={APP_URL} className="hover:text-white transition-colors">{t.start}</a>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 mt-8 pt-6 border-t border-white/10 text-xs text-white/40">
        © {new Date().getFullYear()} {t.built}
      </div>
    </footer>
  )
}
