LEEME — SUBIDA A GITHUB (v19: SUB INVOICES + FIX MODO CAMINATA)
================================================================

Este paquete reemplaza a TODOS los anteriores. NO subas ningún ZIP viejo.

⚠️ SOLO para el repo kodu-app (la app). La landing viva (www) va aparte.

================================================================
NUEVO EN v19 — 2 COSAS:
================================================================

----------------------------------------------------------------
1) SUB INVOICES (módulo NUEVO en el menú, junto a Lien Waivers)
----------------------------------------------------------------
Para que contabilidad procese los pagos: sellas las facturas/pay apps
de los SUBS con el COST CODE y el NETO aprobado, SIN editar el PDF a mano.

FLUJO (30 segundos por invoice):
  a) Menú → "Sub Invoices" → "New Invoice".
  b) Subes el PDF que te mandó el sub (Kitsuco, GL, etc.).
  c) Pones: sub, monto bruto. El NETO se calcula solo (bruto − retainage,
     default 5%) pero puedes editarlo.
  d) Eliges el COST CODE del menú (ya viene cargada la lista de Arena
     Madness: 80 códigos con descripción — no lo tecleas).
  e) Botón SELLO (ícono de estampilla): koduPM estampa en el PDF la
     línea roja idéntica a la que hoy pones a mano:
        Project 169, Cost code : 32 39 13, Net Payment : $2,802.50
  f) Botón ENVIAR (ícono de avión): manda el PDF SELLADO a contabilidad
     por correo, con asunto estándar y la tabla de datos.

Estados: Pendiente → Sellada → Enviada. Badge de pendientes en el menú.

⚠️ REQUIERE MIGRACIÓN (PASO OBLIGATORIO, abajo) — crea la tabla SubInvoice.

Archivos nuevos:
  - app/dashboard/sub-invoices/page.tsx
  - components/sub-invoices-content.tsx
  - app/api/sub-invoices/route.ts
  - app/api/sub-invoices/[id]/route.ts  (editar/borrar)
  - app/api/sub-invoices/[id]/stamp/route.ts  (el sello rojo)
  - app/api/sub-invoices/[id]/file/route.ts  (ver/descargar PDF)
  - app/api/sub-invoices/[id]/send-accounting/route.ts  (enviar)
  - lib/cost-codes.ts  (la lista de Arena Madness)
  - app/api/internal/sub-invoices-migrate/route.ts  (migración temporal)

----------------------------------------------------------------
2) FIX MODO CAMINATA (se frisaba al activar el micrófono)
----------------------------------------------------------------
El punch walk en celular se quedaba congelado al tocar el mic. Arreglado:
  - Ahora pide PERMISO del micrófono ANTES de arrancar (esa era la causa
    principal del frisado en iPhone/Safari).
  - Timeout de seguridad: si el mic no arranca en 8s, avisa y NO se traba.
  - Si el navegador NO soporta voz, aparece un aviso dorado:
    "Sin voz aquí — escribe el ítem arriba y toca Guardar" → puedes
    escribir a mano. Nunca más te quedas sin poder capturar.

================================================================
CÓMO SUBIR:
================================================================
1. Descomprime el ZIP.
2. Repo kodu-app → Add file → Upload files.
3. Arrastra TODAS las carpetas/archivos:
   app, components, lib, prisma, middleware.ts, package.json.
4. Commit. Vercel despliega en 1-2 minutos.

================================================================
PASO OBLIGATORIO DESPUÉS DEL DEPLOY — MIGRACIÓN:
================================================================
1. Cuando Vercel esté verde, avísame YO corro la migración desde aquí:
   https://app.kodupm.com/api/internal/sub-invoices-migrate?key=kodupm-migrar-2026
2. Cuando responda ok:true, BORRA del repo la carpeta:
   app/api/internal  (completa) → Commit.
   (Regla de seguridad permanente: las rutas internas se borran tras usar.)

================================================================
CÓMO PROBAR:
================================================================
SUB INVOICES:
  1. Menú → Sub Invoices → New Invoice.
  2. Sube el PDF "9.1. COR_169-103 sub GL.pdf" (el de GL Services).
  3. Sub: GL Services LLC · Bruto: 2950 · retainage 5% → neto 2802.50.
  4. Cost code: 32 39 13 (bollards at trash area).
  5. Sello → luego "Ver PDF sellado": debe mostrar la línea roja al pie.
  6. Enviar → pones el correo de contabilidad → llega con el PDF sellado.

MODO CAMINATA (en el celular):
  1. Entra a un proyecto → Punch List → botón rojo Modo caminata.
  2. Toca el mic: ahora debe PEDIR PERMISO y luego escuchar.
  3. Si tu navegador no soporta voz, verás el aviso para escribir a mano.

================================================================
LO QUE YA TRAE ACUMULADO (v10–v18):
================================================================
- Páginas públicas y correos bilingües EN/ES con logo de cada empresa.
- Plan Room con carga amigable, progreso real y reintento.
- Punch List: captura rápida, fotos con marcado, acciones masivas,
  pines sobre plano, MODO CAMINATA por voz.
- Menú agrupado con contadores de pendientes.
- ASISTENTE koduPM (chat de ayuda dentro de la app, EN/ES).
- Diseño profesional B2B (tipografía Libre Franklin, sin emojis,
  sin gradientes) + nuevo nombre "Project Controls for Construction Teams".
- Lien Waivers, Closeout, Buyout, Pay Apps, reportes PDF.
