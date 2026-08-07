LEEME — SUBIDA A GITHUB (v9: TODO + PLAN ROOM nuevo)
=====================================================

Este paquete reemplaza a TODOS los anteriores. NO subas ningún ZIP viejo.

CONTENIDO:
1. PLAN ROOM (NUEVO) — registro de planos con control de revisiones:
   - Menú nuevo "Plan Room" (entre Cierre de Proyecto y Budgets).
   - Planos agrupados por disciplina (auto por la letra: A=Architectural,
     S=Structural, M/E/P…), búsqueda, filtro "solo con archivo vigente".
   - SUBIDA MÚLTIPLE: seleccionas varios PDF, el número y título se detectan
     del nombre del archivo ("A-101 - First Floor Plan.pdf") y los editas
     antes de subir. Si el plano ya existe → se añade como REVISIÓN nueva.
   - ETIQUETAS al momento de anexar: Original, Permit, Rev A, Rev B, Rev C…
     (con sugerencias; puedes escribir la que quieras).
   - Historial por plano: todas las revisiones, cuál es la vigente,
     "marcar vigente" cualquiera anterior, ver/descargar cada PDF.
   - PAQUETES (sets): Contract Drawings, Permit Set, Addendum 2… con tipo
     y fecha de emisión.
   - DRAWING LOG en PDF (horizontal): número, título, disciplina, paquete,
     # de revisiones, revisión vigente y fecha.
   - PERMISOS: solo Admin/Owner/PM suben y editan; superintendente consulta.
   ⚠️ REQUIERE MIGRACIÓN (PASO 2) — sin ella el Plan Room avisa y no rompe nada.
2. FIX SEGURIDAD / COR (middleware.ts): enlaces públicos de aprobación
   funcionan sin sesión (solo ese documento); el resto exige login.
   ⚠️ Sube TAMBIÉN el archivo suelto middleware.ts (raíz del repo).
3. LIEN WAIVERS — completo.
4. PUNCH LIST — áreas, A/B/C, DISPUTED, firma por área (AIA G704).
5. CLOSEOUT — 22 entregables, solicitud por correo, reporte PDF.
6. SUBMITTALS — reporte MERGE (portada koduPM + anexos) + botón Email.

PASO 1 — SUBIR
--------------
1. github.com/apadilla1201-bot/kodu-app → Add file → Upload files.
2. Arrastra las 4 CARPETAS (app, components, lib, prisma) Y el archivo
   suelto middleware.ts.
3. Commit. Espera el check VERDE de Vercel.
   (Si el deploy falla, producción NO se actualiza — avísame el error.)

PASO 2 — EJECUTAR LA URL DE MIGRACIÓN (logueado en koduPM)
----------------------------------------------------------
  https://app.kodupm.com/api/internal/plans-migrate?key=kodupm-migrar-2026
  Debe responder {"ok":true,...}
  (Las tablas de Punch/Closeout/Waivers ya existen — no necesitas las otras URL.)

PASO 3 — BORRAR EL TEMPORAL
---------------------------
En GitHub borra la carpeta app/api/internal/plans-migrate/ y commit.

PASO 4 — VERIFICAR
------------------
- Menú "Plan Room": sube 2-3 PDF de planos de prueba en Arena Madness,
  verifica que detecta número/título, añade una "Rev A" a uno de ellos,
  y descarga el Drawing Log en PDF.
- Prueba en incógnito: un enlace de COR sigue abriendo solo ese COR.

NOTA SOBRE REFERENCIAS EN RFI/COR/SUBMITTAL
-------------------------------------------
El vínculo directo (selector de plano dentro de esos formularios) queda
listo en una siguiente entrega controlada: requiere tocar las APIs de cada
módulo. Mientras tanto, el campo de texto "Drawing Reference" sigue
funcionando igual — escribe el número del plano (ej. A-101) como hasta hoy.
