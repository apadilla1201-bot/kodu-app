'use client';

import { useState } from 'react';
import { FolderKanban, ChevronRight, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

export type GateProject = {
  id: string;
  projectNumber: string;
  projectName: string;
};

/**
 * PORTERO DE PROYECTO — antes de entrar a un módulo (RFIs, CORs, Submittals…)
 * se elige el proyecto. Lista simple sobria: número + nombre + conteo opcional.
 * Sin proyecto seleccionado, el módulo no se renderiza → nunca se mezclan
 * documentos de proyectos distintos.
 */
export function ProjectGate({ projects, counts, children }: {
  projects: GateProject[];
  counts?: Record<string, number>;
  children: (project: GateProject, clearSelection: () => void) => React.ReactNode;
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState('');

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const clear = () => setSelectedId('');

  if (selected) {
    return <>{children(selected, clear)}</>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderKanban className="w-6 h-6 text-[#C9A96E]" />
          {t('gate.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('gate.subtitle')}</p>
      </div>

      {projects.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-14 text-center">
          <p className="font-medium">{t('gate.empty')}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/60">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#C9A96E]/5 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">
                  {p.projectNumber}
                </p>
                <p className="text-sm text-muted-foreground truncate">{p.projectName}</p>
              </div>
              {counts && counts[p.id] != null && (
                <span className="text-xs font-mono font-bold text-[#C9A96E] tabular-nowrap">
                  {counts[p.id]}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-[#C9A96E] transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Cabecera para usar DENTRO del módulo una vez elegido el proyecto:
 * muestra qué proyecto estás viendo + botón para cambiar.
 */
export function ProjectGateBar({ project, onChange }: {
  project: GateProject;
  onChange: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 bg-[#0F1B33] rounded-xl px-4 py-3 mb-5">
      <button
        onClick={onChange}
        className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t('gate.change')}
      </button>
      <div className="h-4 w-px bg-white/20" />
      <p className="text-sm text-white truncate">
        <span className="font-bold text-[#C9A96E]">{project.projectNumber}</span>
        <span className="text-white/70"> — {project.projectName}</span>
      </p>
    </div>
  );
}
