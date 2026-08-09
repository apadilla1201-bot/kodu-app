LEEME — SUBIDA A GITHUB (v17: ASISTENTE koduPM — chat de ayuda)
================================================================

Este paquete reemplaza a TODOS los anteriores. NO subas ningún ZIP viejo.

NUEVO EN v17 — ASISTENTE koduPM (chat de ayuda dentro de la app):
- Botón flotante abajo a la derecha (en todas las pantallas con menú).
- Abre un panel de chat que responde CÓMO USAR la herramienta:
  RFIs, submittals, CORs, pay apps, budgets, punch list, closeout,
  plan room, reportes… Responde con pasos exactos.
- BILINGÜE: si le escribes en español responde en español;
  si le escribes en inglés responde en inglés.
- En celular el chat ocupa toda la pantalla; en computadora es una ventana.
- NO requiere migración ni configuración nueva: usa la misma clave de IA
  (ANTHROPIC_API_KEY) que ya tienes en Vercel.

Archivos nuevos en esta versión:
- app/api/assistant/route.ts ............ cerebro del chat (servidor)
- components/assistant-widget.tsx ....... botón y ventana del chat
Archivos actualizados:
- components/dashboard-shell.tsx ........ monta el asistente en el menú
- lib/i18n/messages/en.ts / es.ts ....... textos del chat (EN/ES)

CÓMO SUBIR (mismo procedimiento de siempre):
1. Descomprime el ZIP.
2. En GitHub (repo kodu-app): Add file → Upload files.
3. Arrastra TODAS las carpetas y archivos del paquete
   (app, components, lib, prisma, middleware.ts, package.json).
4. Commit. Vercel despliega solo en 1-2 minutos.

CÓMO PROBAR:
1. Entra a app.kodupm.com con tu usuario.
2. Abajo a la derecha verás un botón redondo navy con ícono de chat.
3. Tócalo y pregunta por ejemplo: "¿Cómo apruebo una orden de cambio?"
   o en inglés: "How do I use Walk Mode on my phone?"
4. Debe responder con pasos concretos en el mismo idioma.

LO QUE YA TRAE ACUMULADO (v10–v16):
- Páginas públicas y correos bilingües EN/ES con logo de cada empresa.
- Plan Room: carga de planos en 3 pasos con progreso real y reintento.
- Punch List: captura rápida con foto y marcado, acciones masivas,
  columna de días, pines sobre el plano, MODO CAMINATA por voz (celular).
- Menú agrupado por fases con contadores de pendientes.
- Lien Waivers, Closeout, Buyout, Pay Apps, reportes PDF.
