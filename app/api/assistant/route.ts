export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { askClaude } from '@/lib/ai';
import { HELP_GUIDES } from '@/lib/help-content';

/**
 * app/api/assistant/route.ts — Asistente koduPM (chat de ayuda dentro de la app).
 *
 * Responde dudas de USO del producto usando el manual del usuario (HELP_GUIDES)
 * como fuente de verdad. No inventa funciones: si algo no está en el manual,
 * lo dice y sugiere dónde mirar.
 *
 * POST body: { messages: { role: 'user'|'assistant', content: string }[], locale?: 'en'|'es' }
 * Respuesta: { reply: string }
 */

// Notas compactas de módulos que aún no tienen guía en el manual
// (punch list, closeout, plan room). Fuente: funciones reales ya en producción.
const EXTRA_MODULE_NOTES = `
PUNCH LIST (EN):
- Open a project → Punch List. Capture items with title, location/area, trade, priority (A = before substantial completion, B = 15 days, C = 30 days), and responsible party.
- Quick Capture (mobile, gold lightning button): camera photo, optional on-photo markup (draw with finger), big priority buttons, "Save & new" keeps area/trade for rapid repeats.
- Walk Mode (mobile, red button): voice-first. Tap the big mic, speak the item in English or Spanish, review the text, pick priority, Save. Guided area route walks you area by area. Works on Chrome/Android and Safari iPhone over HTTPS.
- Plan view tab: items appear as pins on the plan sheet (red = open, purple = ready for review, green = completed). Tap the plan to drop a new pin.
- Bulk actions: check several items to assign them to a responsible party or reopen them at once.
- Aging: the "Days" column turns red after 10 days open; a strip shows overdue items grouped by responsible party.
- Reports: with a project selected, use the report button to export the punch list PDF.
- Sign-off: when the list is ready, the owner's representative can review and sign area sign-offs.

PUNCH LIST (ES):
- Abre un proyecto → Punch List. Captura ítems con título, ubicación/área, oficio, prioridad (A = antes de terminación sustancial, B = 15 días, C = 30 días) y responsable.
- Captura rápida (celular, botón dorado con rayo): foto con cámara, marcado sobre la foto (dibujar con el dedo), botones grandes de prioridad, "Guardar y nuevo" mantiene área/oficio para repetir rápido.
- Modo caminata (celular, botón rojo): primero la voz. Toca el micrófono grande, dicta el ítem en inglés o español, revisa el texto, elige prioridad, Guardar. La ruta guiada te lleva área por área. Funciona en Chrome/Android y Safari iPhone con HTTPS.
- Pestaña Planos: los ítems aparecen como pines sobre el plano (rojo = abierto, morado = listo para revisión, verde = completado). Toca el plano para soltar un pin nuevo.
- Acciones masivas: marca varios ítems para asignarlos a un responsable o reabrirlos de una vez.
- Envejecimiento: la columna "Días" se pone roja después de 10 días abierto; una franja muestra los vencidos agrupados por responsable.
- Reportes: con un proyecto seleccionado, usa el botón de reporte para exportar el punch list en PDF.
- Firma: cuando la lista está lista, el representante del owner puede revisar y firmar los cierres de área.

CLOSEOUT (EN): Project → Closeout. Track required closeout documents per project (warranties, O&M manuals, as-builts, lien releases). Request documents from subcontractors by email directly from an item; statuses: Pending, Requested, Received, Approved.

CLOSEOUT (ES): Proyecto → Closeout. Controla los documentos de cierre por proyecto (garantías, manuales O&M, planos as-built, liberaciones de lien). Solicita documentos a subcontratistas por correo directamente desde un ítem; estados: Pendiente, Solicitado, Recibido, Aprobado.

PLAN ROOM (EN): Project → Plan Room. Upload plan PDFs with the upload dialog: drag files in, review them (number, title, discipline), then upload with real progress bars. Files over 50 MB or non-PDF are rejected with a clear message. Failed files can be retried without re-uploading the rest.

PLAN ROOM (ES): Proyecto → Plan Room. Sube planos PDF con el diálogo de carga: arrastra los archivos, revísalos (número, título, disciplina) y súbelos con barras de progreso reales. Archivos de más de 50 MB o que no sean PDF se rechazan con un mensaje claro. Los que fallen se pueden reintentar sin volver a subir los demás.
`.trim();

function buildSystemPrompt(): string {
  const digest = HELP_GUIDES.map((g) => {
    const block = (lang: 'en' | 'es') => {
      const loc = g[lang];
      const body = loc.sections
        .map((s) => `  ${s.heading}:\n${s.steps.map((st) => `  - ${st}`).join('\n')}`)
        .join('\n');
      return `[${lang.toUpperCase()}] ${loc.title} — ${loc.summary}\n${body}`;
    };
    return `${block('en')}\n${block('es')}`;
  }).join('\n\n');

  return `You are the koduPM Assistant, the built-in help desk of koduPM, a construction project-management web app (projects, RFIs, submittals, change orders, budgets, pay applications, lien waivers, buyout, daily logs, site photos, directory, plan room, punch list, closeout, analytics, approvals, team, settings).

SOURCE OF TRUTH — the official user manual is reproduced below (bilingual), followed by extra notes for modules not yet in the manual. Answer ONLY from this material and from generally obvious app navigation. If the question is not covered, say honestly that it is not covered and suggest the closest module or the Help page (menu → Help). Never invent features, buttons, or menus.

BEHAVIOR RULES:
- Answer in the SAME language as the user's last message (English or Spanish). If the user writes in Spanish, answer fully in Spanish.
- Be concise and practical: short intro line, then numbered steps when the answer is a procedure. Use the exact menu/button names from the manual.
- Never use emojis. Plain, professional tone — like a senior product specialist.
- If the user reports something broken (an error, something that does not save), give the quick checks you know (refresh, check the project filter, permissions/role) and suggest contacting their company admin if it persists. Do not promise fixes.
- Keep answers under 180 words unless the user asks for detail.

USER MANUAL:
${digest}

EXTRA MODULE NOTES:
${EXTRA_MODULE_NOTES}`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const raw = Array.isArray(body?.messages) ? body.messages : [];
    const messages = raw
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 2000) }));

    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const reply = await askClaude({
      system: SYSTEM_PROMPT,
      messages,
      maxTokens: 900,
    });

    return NextResponse.json({ reply: reply.trim() });
  } catch (err) {
    console.error('assistant error:', err);
    return NextResponse.json({ error: 'Assistant unavailable' }, { status: 500 });
  }
}
