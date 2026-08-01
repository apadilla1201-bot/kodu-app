# MEJORAS 2 — Logo de la empresa en TODOS los reportes PDF

## Qué hace este paquete

Todos los reportes PDF que genera koduPM ahora salen con el **logo de tu empresa**
en el encabezado, y el **nombre de la empresa** en lugar de textos fijos:

| Reporte | Dónde se genera |
|---|---|
| RFI (y vista previa de RFI) | RFIs → abrir un RFI → Descargar PDF |
| Change Order (COR) | Change Orders → Descargar PDF |
| Pay Application G702 y G703 | Pay Apps → Descargar PDF |
| Field Report (reporte semanal de campo) | Proyecto → Field Report → PDF |
| Owner Executive Report | Proyecto → Owner Report → PDF |
| Cronograma CPM (schedule) | Schedules → PDF |
| Look Ahead (ejecutivo y técnico) | Schedules → Look Ahead → PDF |

## Cómo funciona (regla de logos)

1. Si tu empresa **tiene logo** (Configuración → Logo de la empresa) → sale ese logo.
   - En Project Delivery Group sale el logo PDG automáticamente.
2. Si una empresa **NO tiene logo** → sale el logo de **koduPM** (incluido en este
   paquete como `public/kodu-logo.png`).
3. Cada empresa ve **solo su propio logo**. Ninguna otra empresa verá el logo de PDG.

El logo va dentro de una placa azul marino para que se vea bien en cualquier
fondo, igual que en la pantalla de login.

## Cómo subirlo a GitHub (2 minutos)

1. Descomprime este ZIP.
2. Entra a tu repo **kodu-app** en GitHub.
3. Click en **Add file → Upload files**.
4. Arrastra las **3 carpetas** que vienen dentro: `app`, `lib` y `public`.
   - GitHub las fusiona con las que ya existen (no borra nada).
5. Click en **Commit changes**.
6. Espera 1-2 minutos a que Vercel termine el despliegue.

## Cómo verificar que funcionó

1. Entra a https://app.kodupm.com con tu cuenta de PDG.
2. Abre cualquier **RFI** y descarga el PDF → debe salir el **logo de PDG**
   arriba a la izquierda.
3. Descarga un **COR** o un **Pay App** → mismo logo.
4. (Opcional) Entra con la otra empresa de prueba (sin logo) y genera un PDF
   → debe salir el **logo de koduPM**.

## Nota

En algunos reportes todavía aparecen datos fijos de PDG (dirección de Miami,
licencia CGC1530498, línea de contacto). Son los datos reales de tus proyectos
actuales, así que para PDG están correctos. Si más adelante quieres que cada
empresa ponga su propia dirección/licencia, se agrega en Configuración (me avisas
y lo hacemos).
