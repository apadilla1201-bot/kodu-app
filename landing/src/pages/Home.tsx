import { useEffect, useState } from 'react'
import Nav from '../sections/Nav'
import Hero from '../sections/Hero'
import { Problem, Modules, ImportFlow, Bilingual, FAQ, FinalCTA, Footer } from '../sections/Sections'
import type { Lang } from '../i18n'

export default function Home() {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('kodu-lang') as Lang | null
    if (saved === 'en' || saved === 'es') setLang(saved)
    else if (navigator.language?.toLowerCase().startsWith('es')) setLang('es')
  }, [])

  const change = (l: Lang) => {
    setLang(l)
    localStorage.setItem('kodu-lang', l)
    document.documentElement.lang = l
  }

  return (
    <div className="antialiased">
      <Nav lang={lang} setLang={change} />
      <Hero lang={lang} />
      <Problem lang={lang} />
      <Modules lang={lang} />
      <ImportFlow lang={lang} />
      <Bilingual lang={lang} />
      <FAQ lang={lang} />
      <FinalCTA lang={lang} />
      <Footer lang={lang} />
    </div>
  )
}
