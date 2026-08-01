# FIX — Página de Budgets (el 404 que encontraste)

## Qué pasó
El menú lateral tiene "Budgets" desde siempre, pero en el repo existían solo
las páginas de **crear** budget (`/dashboard/budgets/new`) y de **detalle**
(`/dashboard/budgets/[id]`) — **faltaba la página principal de la lista**
(`/dashboard/budgets`). Por eso el 404. No tiene nada que ver con los sprints
que subiste: el hueco ya venía de antes.

## Qué agrega este paquete
- **La página de lista de Budgets**: todos los presupuestos de tu compañía
  (cruzando proyectos), con proyecto, versión, fecha, **total general en $**
  y número de ítems. Clic en cualquiera → abre el detalle (esa página sí
  existía y funciona).
- Botón **"New Budget"** que lleva a la página de creación/importación desde
  Excel que ya existía.
- Estado vacío elegante si aún no hay budgets.
- **Seguridad por rol:** solo lo abren admin/dueño/PM (igual que el menú).
  Si un superintendent u otro rol intenta entrar por URL, se le redirige
  al dashboard.

## Archivos (4) — sube cada uno a la MISMA ruta en el repo kodu-app

| Archivo del paquete | Va en el repo kodu-app como |
|---|---|
| `app/dashboard/budgets/page.tsx` | `app/dashboard/budgets/page.tsx` (NUEVO) |
| `components/budgets-content.tsx` | `components/budgets-content.tsx` (NUEVO) |
| `lib/i18n/messages/en.ts` | `lib/i18n/messages/en.ts` (reemplazar) |
| `lib/i18n/messages/es.ts` | `lib/i18n/messages/es.ts` (reemplazar) |

Los archivos de idioma **incluyen todo lo de los Sprints 0, 1, 2 y Step 4b** —
no pierdes nada de lo publicado. (Si aún no has subido el Step 4b, súbelo
primero y este después — o súbelos juntos en el mismo commit, el de este
paquete es el más completo.)

## Cómo subirlo (método de siempre)
1. Descomprime el ZIP. Verás las carpetas `app`, `components`, `lib`.
2. GitHub → repo **kodu-app** → **Add file → Upload files**.
3. Arrastra las 3 carpetas.
4. Commit: `Fix: pagina de lista de Budgets` → **Commit changes**.
5. Vercel redespliega en ~1-2 minutos.

## Cómo verificar
1. Entra a https://app.kodupm.com → menú **Budgets** → ya NO da 404:
   ves la lista (vacía si aún no has creado budgets) con botón "New Budget".
2. Si ya tienes budgets creados, deben aparecer con su total en dólares;
   clic en uno → abre el detalle.
3. Cambia a español → "Presupuestos", "Nuevo presupuesto", etc.
