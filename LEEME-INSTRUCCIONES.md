# STEP 4b — Signup con selección de plan (koduPM)

## ⚠️ Requisito previo
Sprints 0, 1 y 2 ya publicados (✅ confirmado). Este paquete va al repo **kodu-app**.

## 🚨 Incluye el FIX del 404 que encontraste
El botón **"Start Free / Empieza Gratis"** de la landing apuntaba a
`app.kodupm.com/signup` — una página que **no existe** (por eso el 404 de tu
captura). Este paquete lo corrige por los dos lados:
- La página de login ahora entiende `?mode=signup` y abre directo en modo
  registro.
- La landing (paquete aparte, `SUBIR-LANDING-ES.zip` actualizado) apunta sus
  5 botones "Start Free" a `app.kodupm.com/login?mode=signup`.

## Qué agrega este paquete

### Registro de clientes nuevos CON plan, sin que tú muevas un dedo
Hoy un GC nuevo puede crear cuenta, pero su compañía nace siempre en "starter"
y con un nombre genérico ("Pedro's Company"). Con este cambio:

1. **El formulario de registro pide el nombre de su compañía** — así su cuenta
   nace bien nombrada desde el día uno (ese nombre sale en PDFs, correos, etc.).
2. **Elige su plan al registrarse**: Starter $99/mes · Pro $249/mes · Enterprise
   (a medida) — con los mismos precios de tu landing.
3. **El plan elegido se guarda directo en la base de datos** (Company.plan).
   El badge del sidebar y la tarjeta Plan & Billing (Sprint 2) lo mostrarán
   automáticamente.
4. **Enterprise = venta asistida:** si alguien elige Enterprise, su cuenta se
   crea en Starter y la compañía queda marcada como `[ENTERPRISE LEAD]` en la
   base de datos — tú la ves, la contactas y la subes a mano tras el acuerdo.
   Nadie se auto-sirve el plan más caro sin hablar contigo.
5. **Seguridad:** el servidor valida el plan contra una lista blanca
   (starter/pro/enterprise). Si alguien manipula el formulario y manda otra
   cosa, cae en "starter". Nunca se confía en lo que manda el navegador.

### Lo que NO hace (a propósito)
- **No cobra todavía.** El cliente se registra, elige plan y empieza a usar
  la app. El cobro automático con tarjeta es el Step 4c (Stripe), que sigue
  después. Mientras tanto, cuando tengas tus primeros clientes de pago,
  les facturas por tu lado (o activamos Stripe).

## Archivos (4) — sube cada uno a la MISMA ruta en el repo kodu-app

| Archivo del paquete | Va en el repo kodu-app como |
|---|---|
| `app/api/signup/route.ts` | `app/api/signup/route.ts` (reemplazar) |
| `app/login/page.tsx` | `app/login/page.tsx` (reemplazar) |
| `lib/i18n/messages/en.ts` | `lib/i18n/messages/en.ts` (reemplazar) |
| `lib/i18n/messages/es.ts` | `lib/i18n/messages/es.ts` (reemplazar) |

Las versiones "reemplazar" **incluyen todo lo de los Sprints 0, 1 y 2** —
no pierdes nada de lo publicado.

## Cómo subirlo (método de siempre)
1. Descomprime el ZIP. Verás las carpetas `app` y `lib`.
2. GitHub → repo **kodu-app** → **Add file → Upload files**.
3. Arrastra las 2 carpetas.
4. Commit: `Step 4b: signup con seleccion de plan` → **Commit changes**.
5. Vercel redespliega en ~1-2 minutos.

## Cómo verificar
1. Abre https://app.kodupm.com/login en una **ventana de incógnito**.
2. Dale a "Don't have an account? Sign up".
3. Debes ver: campo **Company name** + 3 tarjetas de plan
   (STARTER $99/mo · PRO $249/mo · ENTERPRISE Custom).
4. Crea una cuenta de prueba con un correo que NO uses en ningún otro lado
   y una clave única (regla de siempre), eligiendo **Pro**.
5. Al entrar al dashboard: el badge del sidebar debe decir **PRO** y en
   Settings → Plan & Billing también.
6. Cambia el idioma a español → el formulario de registro también se traduce.
7. (Importante) Tu cuenta actual NO se toca: sigues entrando igual, tu
   compañía sigue en starter.

## Nota de negocio
- Los precios mostrados ($99/$249/Custom) son los mismos de tu landing.
  Si algún día los cambias, hay que cambiarlos en ambos lados (yo lo hago).
- Cuando tengas el primer cliente Enterprise lead marcado en la BD,
  te aviso cómo verlo y lo contactas.
