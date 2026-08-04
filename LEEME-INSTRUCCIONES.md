# PAGO-OWNER AUTOMÁTICO — paquete ÚNICO (no necesitas el FIX-7B, este lo incluye todo)

## Cómo funciona ahora (sin saber nada del tema)

### Al crear una Pay App
En el último paso (Review) aparece una tarjeta dorada que PREGUNTA:

  "¿El Owner hizo pagos directos a subs o suplidores en este período?"
   [ No, ninguno ]   [ Sí, hubo pagos ]

- **No** → todo queda en 0 y el G702 no muestra nada nuevo.
- **Sí** → escribes el monto del período y (opcional) a quién se pagó.
  La tarjeta te muestra en vivo cómo saldrá el G702:
  7b acumulado · 7c este período · 7d total.
- **No puedes crear la PA sin responder** — nadie se lo salta por no saber.

### El acumulado se calcula SOLO (tú nunca lo escribes)
- Al crear la PA, el sistema toma el acumulado de la PA anterior (su 7b + 7c).
- El servidor lo rellena al guardar si faltara, y el PDF lo autocompleta al
  generarse. Triple seguridad.
- En la edición, el acumulado es **solo lectura** (gris, "auto") — solo se
  edita el monto del período.

### El G702 siempre cuadra
7b = acumulado previo · 7c = este período (única deducción) ·
7d = TOTAL A LA FECHA (7b + 7c) · Línea 8 correcta.

## Pasos (3 minutos) — OLVIDA el FIX-7B, este paquete lo trae todo

### 1. Subir
Repo kodu-app → Add file → Upload files → arrastra las **3 carpetas**:
`app`, `components`, `prisma` → Commit changes.

### 2. Esperar Vercel (1-2 min)

### 3. Ejecutar la configuración (una sola vez)
Abre:
  https://app.kodupm.com/api/internal/payapp-autofill?key=kodupm-migrar-2026
Debe decir "ok":true, "pa12Seeded":true. Esto:
- crea la columna nueva,
- pone en la PA #12 de Arena Madness el acumulado oficial 242,681.21
  y el período 6,992.50,
- recalcula los acumulados de todas las PA viejas.

### 4. BORRAR el archivo temporal
Repo → app → api → internal → payapp-autofill → route.ts → ⋮ → Delete file → Commit.

### 5. Verificar
- PA #12 → descarga el G702: 7b 242,681.21 · 7c 6,992.50 · 7d 249,673.71 ·
  CURRENT PAYMENT DUE 295,139.74 (igual que tu Excel).
- Pay Apps → New Pay Application → paso Review → verás la tarjeta de la
  pregunta (respóndela "No, ninguno" si solo estás mirando).
