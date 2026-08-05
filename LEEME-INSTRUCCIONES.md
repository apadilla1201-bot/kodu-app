# Lien Waivers — INSTRUCCIONES (léeme)

## Qué es esto
El módulo nuevo de **Lien Waivers** (exenciones de gravamen): pides al sub su waiver
antes de pagar, él lo firma y lo sube por un enlace seguro (sin cuenta), y tú lo apruebas.
Todo queda registrado por proyecto y vinculado a la Pay Application correspondiente.

## Cómo subirlo (lo de siempre)
1. Descomprime este ZIP.
2. En GitHub → tu repo **kodu-app** → **Add file → Upload files**.
3. Arrastra las **4 carpetas**: `app`, `components`, `lib`, `prisma`.
4. Baja y haz clic en **Commit changes**.
5. Espera 1-2 minutos a que Vercel termine el deploy.

## PASO OBLIGATORIO después del deploy (30 segundos)
Abre esta URL en tu navegador (con tu sesión iniciada en koduPM):

    https://app.kodupm.com/api/internal/lien-waivers-migrate?key=kodupm-migrar-2026

- Debe responder `"ok": true`.
- Esto crea la tabla nueva en la base de datos.
- **Después de que responda OK, BORRA del repo el archivo:**
  `app/api/internal/lien-waivers-migrate/route.ts`
  (entra al archivo en GitHub → menú ⋯ → Delete file → Commit).

## Cómo probarlo
1. Menú lateral → **Lien Waivers** (nuevo, con ícono de documento firmado).
2. **New Waiver**: proyecto, sub, correo, tipo (Conditional/Unconditional — Progress/Final),
   monto, fecha límite, y opcionalmente vincular a una Pay App.
3. Acciones por waiver (íconos a la derecha):
   - ⬇ Descargar la **forma PDF lista para firmar** (con tu logo, licencia y datos).
   - ✈ **Enviar solicitud al sub** — le llega un correo con enlace seguro.
   - ⬆ Subir copia firmada (si el sub te la mandó por otro lado).
   - ✔ Aprobar.
4. **Prueba el flujo del sub**: envíate una solicitud a un correo tuyo SIN cuenta,
   ábrelo en incógnito → solo se ve ese waiver → sube un PDF firmado →
   te llega correo de "recibido" y en el módulo pasa a **Received**.
5. Abre una **Pay Application** → verás la tarjeta **"Lien Waivers — this Pay Application"**
   con el checklist de los waivers vinculados (✔ recibidos / ⏱ pendientes).

## Notas
- Solo Admin/Owner/PM ven este módulo (como Pay Apps y Budgets).
- El sub NO necesita cuenta: su enlace solo muestra su waiver, nada más del sistema.
- La forma PDF es el formato estándar USA (condicional/incondicional × progreso/final).
  Para Florida cumple el estilo §713.20; si tu contrato exige notarización, se notariza
  después de imprimirla — el texto ya lo contempla.
