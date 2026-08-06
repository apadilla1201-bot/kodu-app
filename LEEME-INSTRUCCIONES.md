# Punch List v2 — estilo Excel PDG Arena Madness — INSTRUCCIONES

## Qué trae esta versión
1. **Estructura de tu Excel**: áreas predefinidas, deficiencia + acción correctiva
   separadas, prioridad A/B/C (A = Life Safety/TCO bloquea entrega, B = Funcional,
   C = Cosmético), "identificado por".
2. **Vencimiento automático**: prioridad A = 5 días hábiles, B/C = 10 días hábiles
   (puedes cambiar la fecha manualmente si quieres).
3. **Estado EN DISPUTA + back-charge**: si el sub no responde, lo marcas en disputa
   con monto y nota de documentación (AIA A201 §2.5 / 6.3) — fila roja en la tabla
   y línea BACK-CHARGE en el PDF.
4. **Dashboard estilo tu hoja**: totales por estado, % cerrado, abiertos por
   prioridad (A en rojo = bloquea TCO), y **progreso por área** con barras.
5. **PDF agrupado por área** con % cerrado por área, leyenda de prioridades y
   back-charges — listo para el walkthrough y soporte del G704.
6. **IMPORTADOR de tu Excel**: los 112 ítems de Arena Madness entran solos.

## Cómo subirlo
1. Descomprime → GitHub → kodu-app → Add file → Upload files → arrastra las
   4 carpetas (app, components, lib, prisma) → Commit.
2. Espera el deploy de Vercel (Ready ✅).

## PASOS OBLIGATORIOS después del deploy (en orden)
1. Migración (agrega las columnas nuevas):
   https://app.kodupm.com/api/internal/punch-migrate?key=kodupm-migrar-2026
   → debe responder "ok": true
2. Importar tu punch de Arena Madness (112 ítems):
   https://app.kodupm.com/api/internal/punch-import?key=kodupm-migrar-2026
   → debe responder "ok": true, "ítems creados: 112"
   (los vencimientos quedan recalculados desde hoy: A = 5 días hábiles, B/C = 10;
   la fecha de identificado queda como hoy)
3. BORRAR del repo las DOS carpetas temporales:
   - app/api/internal/punch-migrate/
   - app/api/internal/punch-import/
4. Verificar: menú → Punch List → filtra el proyecto Arena Madness →
   debes ver 112 ítems, dashboard con A=33, B=60, C=19 y progreso por área.

## Notas
- El importador es seguro de repetir: omite los ítems que ya existan (no duplica).
- Si el proyecto no se llama "Arena", usa &projectId=TU_ID al final de la URL del importador.
- Lo ven Admin/Owner/PM y Superintendent.
