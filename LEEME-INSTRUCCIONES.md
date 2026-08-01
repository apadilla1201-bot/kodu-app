# SPRINT 2 — Approval Inbox + Plan & Billing (koduPM)

## ⚠️ Requisito previo
Este paquete asume que **Sprint 0 y Sprint 1 ya están publicados** (tú confirmaste
que ya lo están ✅). Si algo fallara, avísame antes de subir este.

## Qué agrega este paquete

### 1. Approval Inbox (bandeja de aprobaciones cross-project)
- Nuevo módulo en el menú lateral: **Approvals / Aprobaciones** (icono de bandeja).
- Muestra en UNA sola pantalla, cruzando TODOS tus proyectos:
  - **CORs pendientes de aprobación** — con el **monto total en riesgo** en dólares.
  - **RFIs vencidos** — pasaron su fecha límite, con días de espera.
  - **Submittals por revisar** — enviados y esperando revisión.
- Tarjetas resumen arriba con conteos reales + tabs para filtrar por tipo.
- Clic en cualquier item → te lleva directo al registro para decidir.
- **Solo lo ven los roles de gestión** (admin / dueño de empresa / PM).
  Superintendents, owners de proyecto y subs NO lo ven (ni en el menú ni por URL —
  hay doble bloqueo: menú + redirección en el servidor).
- **No toca la base de datos**: todo se deriva en vivo, sin migraciones.

### 2. Plan & Billing (badge de plan + ruta de upgrade)
- **Badge del plan** en la parte baja del menú lateral (Starter gris / Pro dorado /
  Enterprise dorado sólido). Clic → lleva a Settings.
- Nueva tarjeta **Plan & Billing** en Settings: muestra tu plan actual, qué incluye,
  y el botón **"Contact us to upgrade"** (abre correo a info@kodupm.com).
  (Stripe/pagos automáticos vienen en una fase posterior — esto ya te da el camino
  de monetización visible para los clientes.)

## Archivos (9) — sube cada uno a la MISMA ruta en el repo kodu-app

| Archivo del paquete | Va en el repo kodu-app como |
|---|---|
| `app/api/approvals/route.ts` | `app/api/approvals/route.ts` (NUEVO) |
| `app/api/company/plan/route.ts` | `app/api/company/plan/route.ts` (NUEVO) |
| `app/dashboard/approvals/page.tsx` | `app/dashboard/approvals/page.tsx` (NUEVO) |
| `components/approvals-content.tsx` | `components/approvals-content.tsx` (NUEVO) |
| `components/plan-badge.tsx` | `components/plan-badge.tsx` (NUEVO) |
| `components/dashboard-shell.tsx` | `components/dashboard-shell.tsx` (reemplazar) |
| `components/settings-content.tsx` | `components/settings-content.tsx` (reemplazar) |
| `lib/permissions.ts` | `lib/permissions.ts` (reemplazar) |
| `lib/i18n/messages/en.ts` | `lib/i18n/messages/en.ts` (reemplazar) |
| `lib/i18n/messages/es.ts` | `lib/i18n/messages/es.ts` (reemplazar) |

Son 9 archivos de código + este LEEME. Las versiones "reemplazar" **incluyen todo
lo del Sprint 0 y Sprint 1** — no pierdes nada de lo que ya publicaste.

## Cómo subirlo (mismo método de siempre)
1. Descomprime el ZIP. Verás las carpetas `app`, `components`, `lib`.
2. GitHub → repo **kodu-app** → **Add file → Upload files**.
3. Arrastra las 3 carpetas de golpe.
4. En "Commit changes" escribe: `Sprint 2: approval inbox + plan badge`
   y dale **Commit changes**.
5. Vercel redespliega solo en ~1-2 minutos.

## Cómo verificar que funcionó
1. Entra a https://app.kodupm.com → en el menú lateral aparece **Approvals**
   (o **Aprobaciones** si estás en español).
2. Abre Approvals → verás las 3 tarjetas resumen y las listas. Si no hay nada
   pendiente, aparece "Inbox zero / Bandeja vacía".
3. En la parte baja del sidebar (arriba de tu nombre) aparece el **badge del plan**
   (ahora mismo debería decir STARTER, que es el plan actual de tu compañía).
4. Ve a **Settings** → aparece la tarjeta **Plan & Billing** con el plan actual
   y el enlace para upgrade.
5. Cambia de idioma EN/ES → todo lo nuevo cambia también.
6. (Opcional) Entra con un usuario Superintendent si tienes uno → NO debe ver
   "Approvals" en el menú.

## Nota de negocio
El plan actual de tu compañía en la BD es `starter` (valor por defecto). Cuando
quieras cambiarlo a `pro` (por ejemplo, para tu propia operación), me avisas y
lo ajusto directo en la base de datos — 30 segundos.
