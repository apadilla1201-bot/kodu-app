# SPRINT 1 — Búsqueda Ctrl+K + Campana + Breadcrumbs (koduPM)

## Qué agrega este paquete

### 1. Búsqueda global estilo "comando rápido" (como Linear/Notion/Raycast)

- Presiona **Ctrl+K** (o **Cmd+K** en Mac) en cualquier pantalla del dashboard
  y se abre un buscador que encuentra al instante:
  **Proyectos, RFIs, CORs, Submittals y Contactos** — solo de TU compañía.
- También hay un **botón "Search" con el atajo Ctrl K** en el header, para que
  cualquier usuario lo descubra sin saber el atajo.
- Tabs para filtrar: All / Projects / RFIs / CORs / Submittals / Contacts.
- Navegación completa con teclado: **↑ ↓** para moverte, **Enter** para abrir,
  **ESC** para cerrar. Con mouse funciona igual (clic en el resultado).
- Respeta el idioma del usuario (EN/ES) y los colores de marca (navy/dorado).
- **Seguridad multi-tenant:** la búsqueda está limitada al `companyId` de la
  sesión; nadie puede ver datos de otra compañía. Exige sesión iniciada.

### 2. Campana de "Requiere atención" en el header
- Una **campana con contador rojo** junto al buscador que muestra, en vivo:
  **RFIs vencidos**, **CORs pendientes de aprobación** y **Submittals por revisar**.
- Clic en cualquier item → te lleva directo al RFI/COR/Submittal correspondiente.
- Se actualiza sola cada 60 segundos y cada vez que la abres.
- **No toca la base de datos** (no necesita migración): todo se calcula en vivo
  con los datos que ya existen. Si no hay nada pendiente, dice "Todo al día".

### 3. Breadcrumbs + transición suave entre páginas
- Debajo del header aparece la **ruta de navegación** (ej. Dashboard / RFI Log /
  Detalle) para saber siempre dónde estás y volver con un clic.
- Al cambiar de página el contenido entra con un **fade suave** (180ms) —
  se siente más rápido y más "premium". Los IDs internos se muestran como
  "Detalle" en vez de códigos raros.

## Archivos (8) — sube cada uno a la MISMA ruta en el repo kodu-app

| Archivo del paquete | Va en el repo kodu-app como |
|---|---|
| `app/api/search/route.ts` | `app/api/search/route.ts` (NUEVO — no existe aún) |
| `app/api/notifications/route.ts` | `app/api/notifications/route.ts` (NUEVO — no existe aún) |
| `components/global-search.tsx` | `components/global-search.tsx` (NUEVO — no existe aún) |
| `components/notification-bell.tsx` | `components/notification-bell.tsx` (NUEVO — no existe aún) |
| `components/breadcrumbs.tsx` | `components/breadcrumbs.tsx` (NUEVO — no existe aún) |
| `components/dashboard-shell.tsx` | `components/dashboard-shell.tsx` (reemplazar) |
| `lib/i18n/messages/en.ts` | `lib/i18n/messages/en.ts` (reemplazar) |
| `lib/i18n/messages/es.ts` | `lib/i18n/messages/es.ts` (reemplazar) |

## ⚠️ ORDEN IMPORTANTE si aún no has subido el Sprint 0
Este paquete **ya incluye** los cambios del Sprint 0 en `dashboard-shell.tsx`
(marca koduPM en el header) y en los dos archivos de idioma (textos de Team +
Settings). O sea:

- **Si YA subiste el Sprint 0:** sube este tal cual, sin miedo. Los 2 archivos
  de idioma y el shell se reemplazan por versiones más nuevas que conservan
  todo lo del Sprint 0.
- **Si TODAVÍA NO subiste el Sprint 0:** súbelo PRIMERO, espera a que Vercel
  despliegue (~2 min), y DESPUÉS sube este. Así no se pisa nada.

## Cómo subirlo (mismo método de siempre — arrastrar carpetas)
1. Descomprime el ZIP. Verás las carpetas `app`, `components`, `lib`.
2. GitHub → repo **kodu-app** → **Add file → Upload files**.
3. Arrastra las 3 carpetas de golpe.
4. En "Commit changes" escribe: `Sprint 1: busqueda Ctrl+K + campana + breadcrumbs`
   y dale **Commit changes**.
5. Vercel redespliega solo en ~1-2 minutos.

## Cómo verificar que funcionó
1. Entra a https://app.kodupm.com → en el header (a la derecha) debe aparecer
   un botoncito **Search … Ctrl K**.
2. Presiona **Ctrl+K** → se abre la ventana de búsqueda.
3. Escribe el número de un proyecto, un RFI o el nombre de un contacto real
   → deben aparecer resultados agrupados; Enter abre el primero.
4. Prueba los tabs (RFIs, CORs…) y ESC para cerrar.
5. Al lado del buscador verás la **campana**: si tienes RFIs vencidos, CORs
   pendientes o submittals por revisar, aparece un numerito rojo. Ábrela y
   haz clic en un item → debe llevarte a ese registro.
6. Cambia el idioma a ES/EN → los textos del buscador y de la campana cambian
   también.
7. Navega a cualquier página (ej. RFI Log) → debajo del header verás la ruta
   **Dashboard / RFI Log**, y al entrar a un registro: **Dashboard / RFI Log /
   Detalle**. El contenido entra con un fade suave.

## Notas técnicas (por si acaso)
- La búsqueda exige mínimo 2 letras (evita consultas vacías pesadas).
- Muestra hasta 6 resultados por grupo — suficiente para "saltar" rápido;
  no pretende reemplazar los listados completos.
- No toca base de datos ni migraciones: es 100% código nuevo + reemplazos.
