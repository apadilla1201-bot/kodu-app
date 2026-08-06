# Punch List v3 — SIGNOFF por área (AIA G704) — INSTRUCCIONES

## Qué trae esta versión
1. **Pestaña "Firma por Área"** dentro de Punch List (activa cuando seleccionas
   un proyecto): cada área muestra su progreso, y cuando está 100% cerrada se
   habilita el botón **"Firmar área"** — registras Superintendente + PM +
   Owner's Rep + observaciones, y queda guardado quién firmó y cuándo.
   (El sistema NO deja firmar un área con ítems abiertos — igual que tu Excel.)
2. **Anular firma**: si reabres un ítem del área, anulas la firma para mantener
   el registro honesto.
3. **El PDF ahora incluye la página "AREA ACCEPTANCE & FINAL SIGN-OFF"**:
   tabla con todas las áreas, progreso, las 3 firmas y fecha — igual que tu hoja
   SIGNOFF del Excel, soporte del AIA G704 para el cierre de Arena Madness.

## Cómo subirlo
1. Descomprime → GitHub → kodu-app → Add file → Upload files → arrastra las
   4 carpetas (app, components, lib, prisma) → Commit.
2. Espera el deploy de Vercel (Ready ✅).

## PASO OBLIGATORIO después del deploy
1. Migración (crea la tabla de firmas — es acumulativa, no toca nada existente):
   https://app.kodupm.com/api/internal/punch-migrate?key=kodupm-migrar-2026
   → debe responder "ok": true con el paso "tabla PunchAreaSignoff creada"
2. BORRAR del repo la carpeta temporal:
   - app/api/internal/punch-migrate/
   (si todavía existe app/api/internal/punch-import/ de la importación, bórrala también)

## Cómo probarlo
1. Menú → Punch List → selecciona Arena Madness en el filtro de proyecto.
2. Clic en la pestaña **"Firma por Área"** → ves las 20 áreas con su progreso.
3. Las áreas 100% cerradas tienen botón verde "Firmar área" → llena las 3 firmas
   (S. Estrada / A. Padilla / Owner's Rep) → Confirmar.
4. Botón **Punch List Report** → el PDF ahora trae la página final de signoff
   con las firmas registradas.

## Nota
Si ya importaste los 112 ítems, no necesitas volver a importar nada —
esta versión solo AGREGA las firmas por área.
