# SPRINT 0 — Correcciones de seguridad y marca (koduPM)

## Qué corrige este paquete
1. **SEGURIDAD (lo más importante):** cierra el agujero que permitía a cualquier usuario
   cambiarse el rol a "Owner" desde Settings → My Profile.
   - El endpoint del servidor ahora **ignora por completo** el campo `role`.
   - El dropdown de rol desaparece del perfil; ahora se muestra el rol como
     **texto de solo lectura** con la nota "Your role is assigned by your
     administrator from the Team page."
   - Los roles se siguen asignando desde **Team** (paquete 3), como debe ser.
2. **Marca:** el header de la app ya no dice "COR Management System" — ahora muestra
   el wordmark **koduPM** (k navy + kodu + PM dorado).
3. **Login:** el logo PDG era invisible sobre el fondo crema (era blanco). Se agregó
   `pdg_logo_dark.png` (versión navy legible) y el login la usa. El sidebar navy sigue
   usando el logo blanco original (ese sí se ve bien ahí).
4. **CSS:** las tarjetas de métricas (RFI Log) y los montos (Pay Applications) ya no
   se cortan ni se salen de su tarjeta.
5. **Team page + enlace desde Settings (agregado después, incluido en este ZIP):**
   - La página **Team** estaba toda en español fijo; ahora respeta el idioma del
     usuario (EN/ES) como el resto de la app.
   - En **Settings** ahora aparece una tarjeta de acceso directo a **Team**
     (solo visible para quienes pueden invitar: admin/owner/pm).

## Archivos (10) — sube cada uno a la MISMA ruta en el repo kodu-app

| Archivo del paquete | Va en el repo kodu-app como |
|---|---|
| `app/api/user/profile/route.ts` | `app/api/user/profile/route.ts` (reemplazar) |
| `app/dashboard/team/page.tsx` | `app/dashboard/team/page.tsx` (reemplazar) |
| `app/login/page.tsx` | `app/login/page.tsx` (reemplazar) |
| `components/dashboard-shell.tsx` | `components/dashboard-shell.tsx` (reemplazar) |
| `components/settings-content.tsx` | `components/settings-content.tsx` (reemplazar) |
| `components/rfi-list-content.tsx` | `components/rfi-list-content.tsx` (reemplazar) |
| `components/pay-app-list-content.tsx` | `components/pay-app-list-content.tsx` (reemplazar) |
| `lib/i18n/messages/en.ts` | `lib/i18n/messages/en.ts` (reemplazar) |
| `lib/i18n/messages/es.ts` | `lib/i18n/messages/es.ts` (reemplazar) |
| `public/pdg_logo_dark.png` | `public/pdg_logo_dark.png` (NUEVO — no existe aún) |

## Cómo subirlo (método que ya usamos — arrastrar carpetas)
1. Descomprime el ZIP. Verás las carpetas `app`, `components`, `lib`, `public`.
2. GitHub → repo **kodu-app** → **Add file → Upload files**.
3. Arrastra las 4 carpetas de golpe. GitHub reemplaza los archivos que ya existen
   y agrega el nuevo `pdg_logo_dark.png`.
4. Abajo, en "Commit changes", escribe: `Sprint 0: seguridad rol + marca koduPM + fixes CSS`
   y dale **Commit changes**.
5. Vercel redespliega solo en ~1-2 minutos.

## Cómo verificar que funcionó
1. Entra a https://app.kodupm.com → el header ya debe decir **koduPM** (no "COR Management System").
2. Ve a **Settings → My Profile** → el campo ROLE ya NO es editable (solo lectura).
3. Cierra sesión → en el login el logo PDG ahora se ve (versión oscura) sobre el fondo crema.
4. Entra a **RFI Log** y **Pay Applications** → las tarjetas y montos ya no se cortan.
5. Ve a **Settings** → al final aparece la tarjeta de acceso a **Team**
   (si tu usuario puede invitar). Ábrela: la página Team ahora cambia de idioma
   con el selector EN/ES.

## Nota importante (seguridad)
Con este cambio, si algún usuario tenía pensado "escalarse" a Owner desde su perfil,
ya no podrá. El rol correcto se asigna SIEMPRE desde **Team**. Si en algún momento
necesitas cambiar el rol de alguien, se hace desde Team (o me avisas y lo ajusto en BD).
