'use client';

import { useState } from 'react';
import { useI18n } from '@/hooks/use-i18n';
import { HELP_GUIDES } from '@/lib/help-content';
import {
  BookOpen, ChevronDown, LayoutDashboard, FolderKanban, FileQuestion,
  FileStack, ClipboardList, Wallet, Receipt, Camera, NotebookPen, Users,
  BarChart3, Inbox, FileSpreadsheet, UserPlus, Settings, Search,
} from 'lucide-react';

const ICONS: Record<string, any> = {
  LayoutDashboard, FolderKanban, FileQuestion, FileStack, ClipboardList,
  Wallet, Receipt, Camera, NotebookPen, Users, BarChart3, Inbox,
  FileSpreadsheet, UserPlus, Settings, Search,
};

// Manual del usuario — guías por módulo, bilingüe, sin ayuda externa.
export function HelpContent() {
  const { t, locale } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#C9A96E]" />
          {t('help.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('help.subtitle')}</p>
      </div>

      <div className="bg-[#0F1B33] text-white rounded-xl p-4 flex items-start gap-3">
        <Search className="w-5 h-5 text-[#C9A96E] shrink-0 mt-0.5" />
        <p className="text-sm text-gray-300">{t('help.tip')}</p>
      </div>

      <div className="space-y-2">
        {HELP_GUIDES.map((g) => {
          const Icon = ICONS[g.icon] ?? BookOpen;
          const lang = locale === 'es' ? g.es : g.en;
          const isOpen = openId === g.id;
          return (
            <div key={g.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : g.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#C9A96E]/10 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#0F1B33] text-[#C9A96E] flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{lang.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{lang.summary}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                  g.roles === 'management'
                    ? 'bg-[#C9A96E]/15 text-[#a8843a]'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {t(`help.roles_${g.roles}`)}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-border/60 space-y-4">
                  {lang.sections.map((sec, i) => (
                    <div key={i}>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#a8843a] mb-1.5 mt-2">
                        {sec.heading}
                      </p>
                      <ol className="list-decimal list-outside ml-4 space-y-1">
                        {sec.steps.map((step, j) => (
                          <li key={j} className="text-sm text-foreground/90 leading-relaxed">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 text-center">
        <p className="text-sm text-muted-foreground">
          {t('help.stillStuck')}{' '}
          <a href="mailto:support@kodupm.com" className="text-[#C9A96E] font-medium hover:underline">
            support@kodupm.com
          </a>
        </p>
      </div>
    </div>
  );
}
