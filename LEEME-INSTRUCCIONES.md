# PAGO-OWNER — "Paid by Owner" completo en el G702 + reporte LOG

## Qué corrige / agrega

### 1. G702: ahora muestra el ACUMULADO de pagos directos del Owner
Antes el G702 solo mostraba la línea 7b con el pago de ESTE período.
Ahora, igual que tu Excel de Arena Madness:
- **7b.** Direct Payments — el monto de ESTE período (se deduce del Current Payment Due).
- **7c.** Direct Payments by Owner — **acumulado previo + TOTAL A LA FECHA**
  (suma automática de todas las PA anteriores del proyecto).
La línea 7c solo aparece cuando el proyecto tiene pagos directos — los demás
proyectos no ven nada nuevo.

### 2. NUEVO: reporte "Paid by Owner LOG" (el que te pidió el owner)
En **Pay Applications**: selecciona el proyecto en el filtro (ej. Arena Madness)
y aparece el botón azul **"Paid by Owner LOG"** → descarga un PDF con:
- Logo y datos de la empresa.
- Tabla cronológica: PA #, período, detalle, estado, **monto del período** y
  **acumulado corrido**.
- Fila final: **TOTAL PAID BY OWNER TO DATE**.
- Sale en el idioma de tu perfil (ES/EN), listo para entregar al owner.

## Cómo subirlo (2 minutos)

1. Descomprime el ZIP.
2. Repo **kodu-app** → Add file → Upload files.
3. Arrastra las **2 carpetas**: `app` y `components` → Commit changes.
4. Espera 1-2 minutos a Vercel.

## Cómo verificar

1. Abre la **PA #12 de Arena Madness** → descarga el G702 → debes ver:
   - 7b. Direct Payments: **$6,992.50** (este período)
   - 7c. ... acumulado previo: **$242,681.21** · TOTAL TO DATE: **$249,673.71**
2. En **Pay Applications** → filtro "169 — Arena Madness Sports" → botón
   **Paid by Owner LOG** → PDF con el log completo para el owner.

## Nota
El acumulado se calcula sumando el campo "Direct Payments" de cada PA anterior.
Si alguna PA vieja no tiene ese dato cargado, el acumulado saldrá menor —
en ese caso edita esa PA y ponle su monto en "Direct Payments".
