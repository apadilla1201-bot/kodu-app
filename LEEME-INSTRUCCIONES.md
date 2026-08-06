LEEME — SUBIDA ÚNICA A GITHUB (v8b: TODO en uno + FIX seguridad COR + FIX build)
========================================================================

Este paquete reemplaza a TODOS los anteriores. NO subas ningún ZIP viejo.

CONTENIDO:
1. FIX SEGURIDAD / COR (middleware.ts — archivo suelto en la raíz del ZIP):
   Corrige que el enlace de aprobación de Change Orders estaba BLOQUEADO
   para personas externas (el portero de NextAuth tapaba también la puerta
   pública /api/cors/public). Además formaliza la regla: los enlaces mágicos
   (/api/<modulo>/public/<token>) NO piden sesión pero solo muestran ESE
   documento; todo lo demás del sistema sigue exigiendo login.
   IMPORTANTE: sube TAMBIÉN el archivo middleware.ts (va en la raíz del repo,
   junto a package.json). GitHub lo sobreescribe solo al arrastrarlo.
2. LIEN WAIVERS — completo (incluye la lista que faltaba en producción).
3. PUNCH LIST — estilo tu Excel: áreas, A/B/C (A=5 días hábiles, B/C=10),
   acción correctiva, DISPUTED con back-charge, firma por área (AIA G704).
4. CLOSEOUT — módulo "Cierre de Proyecto": 22 entregables, solicitud por
   correo con enlace seguro, reporte PDF con firmas.
5. SUBMITTALS — reporte MERGE estilo COR (portada koduPM + anexos del sub
   en un solo PDF) + botón "Email" para enviarlo como adjunto.
6. IMPORTADOR Arena Madness (temporal): 112 ítems de punch + 22 entregables.

PASO 1 — SUBIR
--------------
1. github.com/apadilla1201-bot/kodu-app → Add file → Upload files.
2. Arrastra las 4 CARPETAS (app, components, lib, prisma) Y el archivo
   suelto middleware.ts.
3. Commit changes. Espera el check VERDE de Vercel.
   ⚠️ Si el deploy falla, producción NO se actualiza (queda la versión
   vieja). Avísame y me pasas el error del build.

PASO 2 — EJECUTAR ESTAS URL (en orden, logueado en koduPM)
----------------------------------------------------------
  1) https://app.kodupm.com/api/internal/punch-migrate?key=kodupm-migrar-2026
  2) https://app.kodupm.com/api/internal/punch-import?key=kodupm-migrar-2026
     (lien-waivers-migrate ya corrió y su tabla está lista — no hace falta)
Cada una debe responder {"ok":true,...}

PASO 3 — BORRAR LOS TEMPORALES (MUY IMPORTANTE)
-----------------------------------------------
En GitHub entra a app/api/internal/ y BORRA las carpetas:
   - lien-waivers-migrate/   (ya corrió — bórrala ahora)
   - punch-migrate/
   - punch-import/
Commit. Con eso cierras todas las puertas temporales.

PASO 4 — VERIFICAR
------------------
- PRUEBA DE SEGURIDAD: abre una ventana de incógnito y pega un enlace de
  aprobación de COR de un correo enviado → ahora SÍ carga el COR y permite
  Aprobar/Rechazar SIN cuenta — pero solo ESE COR, nada más.
- En incógnito, intenta abrir https://app.kodupm.com/dashboard → te manda
  al login. Eso confirma que nadie entra al sistema completo sin contraseña.
- Lien Waivers: la lista carga sin error.
- Punch List → Arena Madness: 112 ítems, A=33 / B=60 / C=19, 20 áreas.
- Cierre de Proyecto: 22 entregables agrupados.
- Submittals: abre uno con anexos → PDF (portada + anexos) y botón Email.

RECORDATORIO DE SEGURIDAD
-------------------------
La sesión de koduPM vive en el NAVEGADOR. Si alguien abre un correo de
koduPM en TU computadora con TU sesión iniciada, esa persona ve lo que tú
ves. Cierra sesión en computadoras compartidas. Los destinatarios externos
(en su propio correo/dispositivo) solo ven el documento del enlace.
