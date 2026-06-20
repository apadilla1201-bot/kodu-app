# MIGRATION_PROMPTS.md — Prompts de Cursor para cortar Abacus

Estos prompts se ejecutan EN ORDEN dentro de Cursor (con Claude Sonnet seleccionado).
Cada uno es una tarea acotada y verificable. No los corras todos de una vez —
uno, verificas que la app compila, y sigues al siguiente.

---

## PASO 0 — Inventario (antes de tocar nada)

```
Analiza este proyecto completo. Es una app Next.js 14 + Prisma migrada desde
Abacus. Dame:
1. Lista de todos los archivos que importan o llaman a algo de Abacus
   (busca: ABACUSAI_API_KEY, apps.abacus.ai, WEB_APP_ID, NOTIF_ID).
2. Confirma que lib/ai.ts y lib/pdf.ts existen y entiende qué hacen.
No cambies nada todavía. Solo el reporte.
```

---

## PASO 1 — Migrar IA a Claude (market-analysis)

```
En app/api/market-analysis/route.ts, reemplaza la llamada directa a
apps.abacus.ai por el módulo lib/ai.ts. Usa la función streamClaude()
porque esta ruta usa streaming SSE. El system prompt y el user prompt
NO cambian — solo cambia el transporte. Mantén el mismo formato de
respuesta SSE que espera el frontend ({status, result}).
```

Verifica: `npm run build` compila. La página de COR que pide análisis de mercado sigue funcionando.

---

## PASO 2 — Migrar IA a Claude (extract-pdf)

```
En app/api/extract-pdf/route.ts, reemplaza la llamada a apps.abacus.ai
por askClaude() o askClaudeJSON() de lib/ai.ts (la que aplique según
si espera texto o JSON). Mantén la misma lógica de negocio.
```

---

## PASO 3 — Migrar IA a Claude (resto de rutas)

```
Busca todas las rutas que aún llaman a apps.abacus.ai/v1/chat/completions
para generar narrativas (CORs, RFIs, reportes ejecutivos). Para cada una,
reemplaza la llamada por askClaude() de lib/ai.ts. Hazlas una por una y
dime cuáles tocaste.
```

---

## PASO 4 — Migrar generación de PDF (Puppeteer)

```
Busca todas las rutas que usan el patrón de Abacus para generar PDF:
createConvertHtmlToPdfRequest + polling de getConvertHtmlToPdfStatus.
Para cada una, reemplaza TODO ese bloque por htmlToPdf() de lib/pdf.ts,
siguiendo el ejemplo documentado en los comentarios de ese archivo.
El HTML que ya construyen NO cambia. Empieza por
app/api/generate-pdf/[id]/route.ts (el de COR) y dime el resultado
antes de seguir con los demás.
```

Verifica: genera un PDF de COR en local y revisa que se vea bien.

---

## PASO 5 — Cablear multi-tenant

```
El schema en prisma/schema.prisma ya tiene companyId en User y Project,
y un modelo Company. Quiero activar el aislamiento multi-tenant en el código:

1. En lib/auth-options.ts: agrega companyId al token JWT y a la session
   (igual que ya se hace con role), leyéndolo del user.
2. En las API routes de projects, cors, pay-apps, rfis, budgets, schedules:
   filtra las queries por el companyId de la sesión, para que un usuario
   solo vea proyectos de su company.

Hazlo módulo por módulo, empezando por projects. Muéstrame el cambio en
projects antes de seguir.
```

---

## PASO 6 — Limpiar variables y notificaciones

```
Quita el código muerto que dependía de Abacus:
- Referencias a WEB_APP_ID
- Las notificaciones NOTIF_ID_RFI_* en las rutas de RFI (coméntalas con
  un TODO para reemplazar por email después, no las borres del todo).
Confirma que no quede ninguna referencia a ABACUSAI_API_KEY en el código.
```

---

## PASO 7 — Build final y deploy

```
Corre npm run build. Arregla cualquier error de TypeScript que quede.
Cuando compile limpio, dame el resumen de todo lo que cambiamos para
documentarlo, y los pasos exactos para hacer el primer deploy en Vercel
con las variables de entorno correctas.
```

---

## Orden de prioridad si tienes poco tiempo

Si quieres ver la app corriendo rápido en Vercel sin migrar todo:
- **Mínimo para deploy**: Paso 5 (multi-tenant) NO es bloqueante para que TÚ
  la uses. Puedes desplegar primero con la IA en Claude (Pasos 1-3) y el PDF
  (Paso 4), y dejar multi-tenant para cuando vayas a vender al primer GC.
- **Para vender**: ahí sí necesitas el Paso 5 completo.
