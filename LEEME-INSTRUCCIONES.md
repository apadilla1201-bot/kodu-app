# FIX — Rol PDG + logo PDG restablecido

## Qué pasó (los 2 problemas tienen la misma raíz)
Tu usuario de PDG tiene rol legacy **'user'** (se ve abajo a la izquierda en
tu captura). Ese rol no existe en la matriz nueva de permisos, así que:
- El menú te caía en modo "viewer" → solo veías **Dashboard**.
- No podías gestionar la compañía → no te salía la opción de subir el logo PDG.

Con una empresa nueva no pasaba porque los signups nuevos nacen con rol
'owner' (correcto). Tu cuenta es anterior a la matriz.

## Qué hace este paquete (2 archivos)
1. **`lib/permissions.ts`** — blindaje permanente: si algún rol raro/legacy
   vuelve a aparecer, el menú mostrará TODO en vez de encogerse. (Los módulos
   sensibles — Budgets, Pay Apps, Approvals, Team — ya tienen su propio
   candado en el servidor, así que no se abre seguridad: solo se evita que
   alguien se quede "atrapado" en el Dashboard como te pasó.)
2. **`app/api/internal/set-owner/route.ts`** — ruta TEMPORAL de administración
   (mismo mecanismo que usamos con las migraciones). Al abrirla con tu correo:
   - Cambia tu rol de 'user' → **'owner'** (admin de tu compañía).
   - Detecta que tu compañía es **The Project Delivery Group LLC** y le
     restablece el **logo PDG** (`/pdg_logo.png`) — aparece en el login y en
     el sidebar de todos tus proyectos PDG.

## Pasos (10 minutos, método de siempre)
1. **Sube** este paquete al repo **kodu-app** (carpetas `app` y `lib`) →
   Commit: `Fix rol PDG + logo PDG` → espera ~2 min a Vercel.
2. **Abre esta URL en tu navegador** (reemplaza TU_CORREO por tu correo real
   de login, el que usas para entrar):
   ```
   https://app.kodupm.com/api/internal/set-owner?key=kodupm-migrar-2026&email=TU_CORREO
   ```
   Debe responder un JSON con `"ok": true`, `"role": "owner"` y el logo PDG.
3. **Cierra sesión** (Sign Out) y **vuelve a entrar** — verás el menú
   completo y el logo PDG arriba en el sidebar y en el login.
4. **BORRA la ruta temporal** (importante, por seguridad):
   GitHub → repo kodu-app → `app/api/internal/set-owner/route.ts` →
   icono ⋮ → **Delete file** → Commit. Vercel redespliega solo.

## Verificación
- Menú lateral completo otra vez (Projects, RFI Log, Budgets, Team…).
- Logo PDG en el sidebar (arriba) y en el login al entrar con tu cuenta PDG.
- Las empresas NUEVAS siguen viendo el wordmark koduPM (el PDG no se les
  aparece — sigue siendo exclusivo de tu compañía).

## Nota
Si algún día otro usuario tuyo de PDG ve el menú cortado, corre la misma URL
con SU correo (antes de borrar la ruta) — o me avisas.
