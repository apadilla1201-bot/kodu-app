LEEME — SOLO MIGRACIÓN + IMPORTADOR (1 carpeta)
================================================

Borraste las carpetas temporales antes de correr punch-migrate — sin problema,
esto lo repone. Los 112 ítems de punch YA están importados; solo falta crear
la tabla de Closeout y sembrar los 22 entregables.

PASO 1 — SUBIR
--------------
1. github.com/apadilla1201-bot/kodu-app → Add file → Upload files.
2. Arrastra la carpeta "app" de este ZIP (trae app/api/internal/punch-migrate
   y app/api/internal/punch-import).
3. Commit. Espera el check VERDE de Vercel.

PASO 2 — AVÍSAME
----------------
Dime "listo" y yo mismo ejecuto las 2 URL en orden y verifico que todo quede.
(Si prefieres hacerlo tú, logueado en koduPM abre:
  1) https://app.kodupm.com/api/internal/punch-migrate?key=kodupm-migrar-2026
  2) https://app.kodupm.com/api/internal/punch-import?key=kodupm-migrar-2026
 Ambas deben responder {"ok":true,...})

PASO 3 — BORRAR (DESPUÉS de correr las 2 URL)
---------------------------------------------
En GitHub borra de app/api/internal/ las carpetas:
   - punch-migrate/
   - punch-import/
   - lien-waivers-migrate/   (si sigue ahí — ya corrió)
Commit.
