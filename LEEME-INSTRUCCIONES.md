LEEME — SUBIDA A GITHUB (v18b: DISEÑO PROFESIONAL + NUEVO NOMBRE + LANDING)
============================================================================

Este paquete reemplaza a TODOS los anteriores. NO subas ningún ZIP viejo.

⚠️ NOTA IMPORTANTE: este paquete ahora incluye TAMBIÉN la carpeta
"landing" (la página pública www.kodupm.com). Arrástrala junto con
las demás carpetas (app, components, lib, landing, prisma,
middleware.ts, package.json).

NUEVO EN v18b — LANDING (www.kodupm.com) ALINEADA:
1. Hero sin gradiente decorativo — navy sólido.
2. El panel de ejemplo ya no está rotado/juguetón — derecho, serio.
3. La insignia del hero ahora dice el nuevo posicionamiento:
   "Project Controls for Construction Teams" /
   "Control de Proyectos para Equipos de Construcción".
4. Tipografía de la landing alineada con la app: Libre Franklin
   (títulos) + DM Sans (cuerpo).

NUEVO EN v18 — REPASO DE DISEÑO PROFESIONAL (APP):
1. TIPOGRAFÍA NUEVA: los títulos de toda la app pasan de una fuente
   "redonda" (típica de demos) a Libre Franklin — sobria, estilo
   software B2B serio. El cambio se nota en todo el producto.
2. LOGIN PROFESIONAL:
   - Fondo navy sólido (sin gradiente decorativo).
   - Las 3 tarjetas ya NO usan emojis: ahora son iconos dorados
     profesionales (Projects / CORs / Reports).
3. NUEVO NOMBRE DEL PRODUCTO (login):
   - Antes: "Change Order Management" (ya quedaba corto).
   - Ahora: "Project Controls for Construction Teams"
     ES: "Control de Proyectos para Equipos de Construcción".
   - Subtítulo nuevo que menciona RFIs, Submittals, CORs, Pay Apps,
     Punch List y Closeout.
4. LIMPIEZA: se quitó un script viejo (Abacus) que ya no se usa
   y hacía más lenta la carga del login.

Archivos actualizados en esta versión:
- app/layout.tsx ........... fuente nueva + limpieza
- app/login/page.tsx ....... login profesional
- lib/i18n/messages/en.ts .. nuevo nombre (inglés)
- lib/i18n/messages/es.ts .. nuevo nombre (español)

CÓMO SUBIR (mismo procedimiento de siempre):
1. Descomprime el ZIP.
2. En GitHub (repo kodu-app): Add file → Upload files.
3. Arrastra TODAS las carpetas y archivos del paquete
   (app, components, lib, prisma, middleware.ts, package.json).
4. Commit. Vercel despliega solo en 1-2 minutos.

CÓMO PROBAR:
1. Cierra sesión en app.kodupm.com (o abre una ventana incógnito).
2. La pantalla de login debe decir "Project Controls for Construction
   Teams" con iconos dorados en vez de emojis, fondo navy plano.
3. Entra: los títulos de toda la app se ven con la nueva tipografía.

-------------------------------------------------------------------
LO QUE YA TRAE ACUMULADO (v17):

v17 — ASISTENTE koduPM (chat de ayuda dentro de la app):
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
