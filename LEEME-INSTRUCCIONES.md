# Punch List — INSTRUCCIONES (léeme)

## Qué es esto
El módulo nuevo de **Punch List** (lista de pendientes de cierre): creas ítems de
corrección con foto, ubicación y responsable; los asignas al sub por correo con
enlace seguro; el sub marca "Ready for Review" con foto de la corrección; y tú
verificas y cierras. Incluye **reporte PDF** para el walkthrough con el owner.

## Cómo subirlo (lo de siempre)
1. Descomprime este ZIP.
2. En GitHub → tu repo **kodu-app** → **Add file → Upload files**.
3. Arrastra las **4 carpetas**: `app`, `components`, `lib`, `prisma`.
4. Baja y haz clic en **Commit changes**.
5. Espera 1-2 minutos a que Vercel termine el deploy (debe quedar en Ready ✅).

## PASO OBLIGATORIO después del deploy (30 segundos)
Abre esta URL en tu navegador (con tu sesión iniciada en koduPM):

    https://app.kodupm.com/api/internal/punch-migrate?key=kodupm-migrar-2026

- Debe responder `"ok": true`.
- **Después de que responda OK, BORRA del repo el archivo:**
  `app/api/internal/punch-migrate/route.ts`
  (entra al archivo en GitHub → menú ⋯ → Delete file → Commit).

## Cómo probarlo
1. Menú lateral → **Punch List** (nuevo, ícono de lista con checks).
2. **New Item**: proyecto, ítem/deficiencia, ubicación, oficio, responsable
   (nombre + correo), prioridad y fecha límite.
3. Acciones por ítem (íconos a la derecha):
   - ✈ **Asignar al sub** — le llega correo con enlace seguro (sin cuenta).
   - 📷 Fotos: del problema y de la corrección (clic en los íconos de cámara).
   - ✔ Verificar y completar (cuando el sub lo marca listo).
   - ↩ Reabrir (si la corrección no quedó bien).
4. **Prueba el flujo del sub**: asigna un ítem a un correo tuyo SIN cuenta,
   ábrelo en incógnito → solo se ve ese ítem → "Mark as Ready for Review"
   con foto → te llega correo y el ítem pasa a **Ready for Review**.
5. Con un proyecto seleccionado en el filtro → botón **Punch List Report**:
   PDF horizontal con resumen, tabla completa y líneas de firma
   (GC / Owner / Architect) — listo para el walkthrough de Arena Madness.

## Notas
- Lo ven Admin/Owner/PM **y Superintendent** (es su trabajo diario de campo).
- El sub NO necesita cuenta: su enlace solo muestra su ítem, nada más.
- Ítems vencidos se marcan en rojo automáticamente.
