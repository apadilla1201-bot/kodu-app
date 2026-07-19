'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

export interface LegalSection {
  heading: string;
  body: string[];
}

interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

interface Props {
  en: LegalDoc;
  es: LegalDoc;
}

/** Shared renderer for Privacy / Terms — follows the user's active locale */
export default function LegalPage({ en, es }: Props) {
  const { locale } = useI18n();
  const doc = locale === 'es' ? es : en;

  return (
    <div className="min-h-screen bg-[#FEFBF5] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-[#1B2A4A]/60 hover:text-[#C9A96E] mb-8">
          <ArrowLeft className="w-4 h-4" /> Kodu PM
        </Link>
        <h1 className="text-3xl font-display font-bold text-[#0F1B33] tracking-tight mb-1">{doc.title}</h1>
        <p className="text-sm text-[#1B2A4A]/50 mb-8">{doc.updated}</p>
        <p className="text-[#1B2A4A]/80 leading-relaxed mb-8">{doc.intro}</p>
        <div className="space-y-8">
          {doc.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-[#0F1B33] mb-2">{s.heading}</h2>
              {s.body.map((p, j) => (
                <p key={j} className="text-[#1B2A4A]/75 leading-relaxed mb-2 text-[15px]">{p}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
