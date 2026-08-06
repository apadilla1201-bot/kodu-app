LEEME — SUBIDA ÚNICA A GITHUB (v7: TODO en uno)
================================================

Este paquete reemplaza a TODOS los anteriores. NO subas ningún ZIP viejo.
Incluye:

1. LIEN WAIVERS — completo + repara los 2 archivos que faltaban en tu repo
   (la lista principal y la ruta pública del sub).
2. PUNCH LIST — estilo tu Excel de Arena Madness: áreas, prioridades A/B/C
   (A=5 días hábiles, B/C=10), acción correctiva, DISPUTED con back-charge,
   firma por área (SIGNOFF, soporte AIA G704) y PDF con página de firmas.
3. CLOSEOUT — módulo nuevo "Cierre de Proyecto": 22 entregables agrupados,
   solicitud por correo con enlace seguro, estados Pendiente → Solicitado →
   Recibido → Verificado, reporte PDF con firmas.
4. SUBMITTALS — reporte MERGE estilo COR: el botón PDF genera UN solo PDF
   (portada koduPM + anexos del sub) y el botón nuevo "Email" lo envía
   como adjunto al correo que tú digas. Esto NO necesita migración.
5. IMPORTADOR Arena Madness (temporal): 112 ítems de punch (A=33/B=60/C=19)
   con vencimientos recalculados desde hoy + 22 entregables de closeout.

PASO 1 — SUBIR
--------------
1. github.com/apadilla1201-bot/kodu-app → Add file → Upload files.
2. Arrastra las 4 CARPETAS de este paquete (app, components, lib, prisma).
3. Commit changes. Espera el check verde de Vercel.

PASO 2 — EJECUTAR ESTAS URL (en orden, logueado en koduPM)
----------------------------------------------------------
  1) https://app.kodupm.com/api/internal/lien-waivers-migrate?key=kodupm-migrar-2026
     (ya corrió una vez y la tabla está lista — correrla de nuevo no hace daño)
  2) https://app.kodupm.com/api/internal/punch-migrate?key=kodupm-migrar-2026
  3) https://app.kodupm.com/api/internal/punch-import?key=kodupm-migrar-2026
     → importa los 112 ítems + 22 entregables de Arena Madness.
Cada una debe responder {"ok":true,...}

PASO 3 — BORRAR LOS TEMPORALES (MUY IMPORTANTE)
-----------------------------------------------
En GitHub entra a app/api/internal/ y BORRA las 3 carpetas:
   - lien-waivers-migrate/
   - punch-migrate/
   - punch-import/
Commit. Con eso cierras todas las puertas temporales.

PASO 4 — VERIFICAR
------------------
- Lien Waivers: la lista carga sin error.
- Punch List → Arena Madness: 112 ítems, tarjetas A=33 / B=60 / C=19,
  pestaña "Firma por Área" con 20 áreas.
- Cierre de Proyecto: 22 entregables agrupados por categoría.
- Submittals: abre uno con anexos → botón PDF (portada + anexos en un
  solo PDF) y botón Email (mándate una prueba a tu correo).

NOTAS
-----
- Si Punch List o Closeout avisan "migración pendiente", falta el PASO 2.2.
- El menú "Cierre de Proyecto" aparece para admin/owner/pm y superintendente.
