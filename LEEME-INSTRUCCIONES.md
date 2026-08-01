# MEJORAS 1 — Marca por empresa + Manual del usuario (koduPM)

## ⚠️ Requisito previo
Sprints 0, 1 y 2 publicados (✅). Si aún no subiste **Step 4b** y el
**FIX Budgets**, súbelos PRIMERO en el mismo commit que este paquete —
los archivos de idioma y login de este paquete **ya incluyen todo** lo de
esos dos (son la versión más completa).

## Qué corrige/agrega este paquete (tus 3 puntos)

### 1. Botón "Log in" en la landing
La página www.kodupm.com ahora tiene **"Log in / Entrar"** en el header,
al lado de "Start Free". Los que ya tienen cuenta entran directo.
→ Esto va en el paquete aparte **SUBIR-LANDING-ES.zip** (v3, repo kodu-landing).

### 2. El logo PDG ya NO es fijo — marca por empresa
- El **login** ya no muestra el logo de Project Delivery Group. Ahora:
  - Si tu compañía **tiene logo propio** → se muestra el tuyo.
  - Si **no tiene** → se muestra el wordmark **koduPM** (nunca más PDG fijo).
- El **sidebar** del dashboard: misma regla (tu logo, o koduPM si no hay).
- **Settings → "Company logo"**: el admin/dueño puede **subir el logo de su
  empresa** (PNG/JPG/WebP/SVG, máx. 2 MB), reemplazarlo o quitarlo.
- **Signup**: toda compañía nueva nace **sin logo** (ve koduPM) hasta que
  suba el suyo. Solo la compañía que se llame "Project Delivery Group"
  hereda el logo PDG automáticamente (tus proyectos actuales, como pediste).
- ⚠️ **Paso manual necesario (1 vez):** para que TU compañía actual recupere
  el logo PDG (login + sidebar), ve a **Settings → Company logo → Upload**
  y sube tu archivo `pdg_logo.png` después de publicar este paquete.

### 3. Manual del usuario en la app
- Nuevo ítem en el menú lateral: **Help / Ayuda** (icono de libro).
- **17 guías** (una por módulo: Dashboard, Proyectos, RFIs, Submittals,
  Buyout, Pay Apps, Budgets, Fotos, Bitácoras, Directorio, Analíticas,
  Aprobaciones, Importar, Equipo, Settings + herramientas Ctrl+K/campana).
- Cada guía explica **qué es, para qué sirve y los pasos exactos** —
  redactadas para que un superintendent o un owner nuevo opere solo,
  **sin llamar a nadie**.
- **Bilingüe completo** (cambia con el idioma del usuario) y cada guía
  marca si aplica a "Todos los roles" o "Admin / PM".
- Disponible para TODOS los roles en el menú.

## Archivos (12) — sube cada uno a la MISMA ruta en el repo kodu-app

| Archivo del paquete | Va en el repo kodu-app como |
|---|---|
| `app/api/company/logo/route.ts` | `app/api/company/logo/route.ts` (NUEVO) |
| `app/api/company/profile/route.ts` | `app/api/company/profile/route.ts` (NUEVO) |
| `app/api/signup/route.ts` | `app/api/signup/route.ts` (reemplazar) |
| `app/dashboard/help/page.tsx` | `app/dashboard/help/page.tsx` (NUEVO) |
| `app/login/page.tsx` | `app/login/page.tsx` (reemplazar) |
| `components/dashboard-shell.tsx` | `components/dashboard-shell.tsx` (reemplazar) |
| `components/settings-content.tsx` | `components/settings-content.tsx` (reemplazar) |
| `components/help-content.tsx` | `components/help-content.tsx` (NUEVO) |
| `lib/help-content.ts` | `lib/help-content.ts` (NUEVO) |
| `lib/permissions.ts` | `lib/permissions.ts` (reemplazar) |
| `lib/i18n/messages/en.ts` | `lib/i18n/messages/en.ts` (reemplazar) |
| `lib/i18n/messages/es.ts` | `lib/i18n/messages/es.ts` (reemplazar) |

## Cómo subirlo (método de siempre)
1. Descomprime el ZIP. Verás las carpetas `app`, `components`, `lib`.
2. GitHub → repo **kodu-app** → **Add file → Upload files**.
3. Arrastra las 3 carpetas (si también subes Step 4b + FIX Budgets,
   arrastra TODO junto — los archivos repetidos quedan con esta versión,
   que es la más nueva).
4. Commit: `Marca por empresa + manual del usuario` → **Commit changes**.
5. Vercel redespliega en ~1-2 minutos.
6. DESPUÉS sube el paquete **SUBIR-LANDING-ES.zip** (v3) al repo
   **kodu-landing** para el botón "Log in" del header.

## Cómo verificar
1. **Login:** entra a app.kodupm.com/login → ya NO sale el logo PDG; sale el
   wordmark **koduPM** (hasta que subas tu logo).
2. **Sidebar:** igual — wordmark koduPM en la parte superior.
3. **Settings → Company logo:** sube tu `pdg_logo.png` → tras la recarga,
   el sidebar y el login muestran TU logo (solo tu compañía).
4. **Help:** menú lateral → **Help / Ayuda** → abre cualquier guía (ej.
   RFI Log) → pasos claros; cambia el idioma y verifica el español.
5. **Landing:** www.kodupm.com → header tiene **Log in** junto a Start Free.
6. **Registro nuevo (incógnito):** crea una cuenta de prueba → su compañía
   nace SIN logo PDG (ve koduPM) — confirma que el PDG no se le aparece a
   extraños.

## Notas
- El nombre de tu empresa en los PDFs/correos NO cambia con este paquete
  (sigue saliendo "The Project Delivery Group LLC" en los PDFs de tus
  proyectos — eso es correcto, son de esa empresa). Los PDFs con logo
  dinámico por empresa quedan para la siguiente fase (Mejoras 2) porque
  son varios generadores y hay que probarlos con calma.
