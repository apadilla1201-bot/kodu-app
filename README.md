# Kodu Project Controls AI

Plataforma de gestión de proyectos de construcción para owner's representatives y general contractors. Módulos: Projects, Change Orders (COR), Pay Applications (AIA G702/G703), RFIs, Budgets, y CPM Schedules con earned value.

**Stack:** Next.js 14 (App Router) · Prisma 6 · PostgreSQL (Supabase) · NextAuth · Tailwind + shadcn/ui · Claude (Anthropic) para IA · Puppeteer para PDF.

---

## Estado de la migración

Esta es la app migrada desde Abacus DeepAgent a un stack independiente y vendible. Cambios vs. la versión Abacus:

- **Multi-tenant**: agregado modelo `Company` + Row Level Security. Cada GC ve solo sus datos.
- **IA**: migrada de Abacus (`ABACUSAI_API_KEY` → `gpt-5.4-mini`) a Claude (`ANTHROPIC_API_KEY` → `claude-sonnet-4-6`). Centralizada en `lib/ai.ts`.
- **PDF**: migrado del servicio HTML→PDF de Abacus a generación propia con Puppeteer en `lib/pdf.ts`.

---

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# Edita .env con tus credenciales reales (Supabase, Anthropic, etc.)

# 3. Generar cliente Prisma y empujar schema a Supabase
npm run db:generate
npm run db:push

# 4. (opcional) Cargar datos reales de Arena Madness
#    Los SQL de carga están en el paquete de migración de base de datos.

# 5. Correr en local
npm run dev
```

Abre http://localhost:3000

---

## Tareas pendientes de migración (hacer en Cursor)

Estas son las dependencias de Abacus que aún hay que cortar en el código. Cada una tiene su prompt de Cursor en `MIGRATION_PROMPTS.md`.

1. **IA → Claude** (12 archivos): reemplazar las llamadas a `apps.abacus.ai/v1/chat/completions` por el módulo `lib/ai.ts`. Archivos: `market-analysis`, `extract-pdf`, y las rutas de PDF que generan narrativas.

2. **PDF → Puppeteer** (6 archivos): reemplazar el patrón `createConvertHtmlToPdfRequest` + polling por `htmlToPdf()` de `lib/pdf.ts`. Archivos listados en `lib/pdf.ts`.

3. **Multi-tenant wiring**: el schema ya tiene `companyId`, pero las queries y el login aún no lo filtran. Hay que: (a) agregar `companyId` al JWT en `lib/auth-options.ts`, (b) filtrar las queries por company en las API routes.

4. **Storage**: decidir AWS propio vs Supabase Storage en `lib/s3.ts`.

5. **Notificaciones**: las rutas de RFI usan `NOTIF_ID_*` de Abacus. Diferir o reemplazar con email.

---

## Estructura

```
app/
  api/          → 44 API routes (projects, cors, pay-apps, rfis, budgets, schedules)
  dashboard/    → páginas de cada módulo
  login/        → autenticación
components/      → 30 componentes custom + shadcn/ui
lib/
  ai.ts         → IA centralizada (Claude)        ← NUEVO
  pdf.ts        → generación PDF (Puppeteer)       ← NUEVO
  prisma.ts     → cliente DB
  auth-options.ts → NextAuth
  s3.ts         → almacenamiento
prisma/
  schema.prisma → schema multi-tenant              ← ACTUALIZADO
scripts/
  seed.ts       → datos de prueba
```

---

## Deploy a Vercel

1. Conecta este repo a Vercel
2. Agrega las variables de entorno del `.env.example` (con valores reales)
3. Build command: `prisma generate && next build`
4. Deploy

---

*The Project Delivery Group LLC · Miami, FL*
