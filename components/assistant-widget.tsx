'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

/**
 * components/assistant-widget.tsx — Asistente koduPM.
 *
 * Botón flotante (abajo a la derecha) que abre un panel de chat.
 * Responde dudas de uso del producto vía /api/assistant (manual de usuario + Claude).
 * Bilingüe: responde en el idioma en que el usuario escribe.
 */

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const NAVY = '#0F1B33';
const GOLD = '#C9A96E';

export function AssistantWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const suggestions = [t('assistant.sug1'), t('assistant.sug2'), t('assistant.sug3')];

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.reply === 'string' && data.reply.trim()) {
        setMessages([...next, { role: 'assistant', content: data.reply.trim() }]);
      } else {
        setMessages([...next, { role: 'assistant', content: t('assistant.errorGeneric') }]);
      }
    } catch {
      setMessages([...next, { role: 'assistant', content: t('assistant.errorGeneric') }]);
    } finally {
      setSending(false);
    }
  }

  function renderContent(text: string) {
    // Renderiza saltos de línea; los pasos numerados quedan como líneas normales.
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  }

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('assistant.title')}
          className="fixed bottom-5 right-5 z-[60] w-12 h-12 rounded-full text-white shadow-md hover:shadow-lg transition-shadow flex items-center justify-center"
          style={{ backgroundColor: NAVY }}
        >
          <MessageCircle className="w-5 h-5" style={{ color: GOLD }} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed z-[60] bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-[380px] h-[100dvh] sm:h-[560px] sm:max-h-[78vh] bg-white sm:rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-label={t('assistant.title')}
        >
          {/* Encabezado */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ backgroundColor: NAVY }}>
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-md font-black text-sm"
              style={{ backgroundColor: GOLD, color: NAVY }}
            >
              k
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">{t('assistant.title')}</p>
              <p className="text-[11px] text-white/60 leading-tight">{t('assistant.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('assistant.close')}
              className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensajes */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-slate-600 leading-relaxed">{t('assistant.welcome')}</p>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full text-left text-[13px] px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-[#C9A96E] hover:text-slate-900 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user' ? 'text-white' : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                  style={m.role === 'user' ? { backgroundColor: NAVY } : undefined}
                >
                  {renderContent(m.content)}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-[13px] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: GOLD }} />
                  {t('assistant.thinking')}
                </div>
              </div>
            )}
          </div>

          {/* Entrada */}
          <div className="flex-shrink-0 border-t border-slate-200 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={t('assistant.placeholder')}
                className="flex-1 text-[13px] px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#C9A96E] focus:border-[#C9A96E] text-slate-800 placeholder:text-slate-400"
                maxLength={2000}
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={sending || !input.trim()}
                aria-label={t('assistant.send')}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: NAVY }}
              >
                <Send className="w-4 h-4" style={{ color: GOLD }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
