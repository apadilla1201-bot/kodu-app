# EMPRESA-DATOS — Cada empresa pone su dirección y licencia en los reportes

## IMPORTANTE primero

Este paquete **incluye también todo lo del paquete REPORTES-LOGO** (el logo en
los PDFs). Entonces:

- Si **NO subiste** el paquete anterior → sube **solo este**.
- Si **YA subiste** el anterior → sube este encima, sin problema (reemplaza
  esos archivos con la versión nueva).

## Qué hace este paquete

1. **Configuración → nueva tarjeta "Datos de la empresa para reportes"**:
   dirección, ciudad, teléfono, sitio web y número de licencia de cada empresa.
2. **Los reportes PDF ya no traen nada fijo de PDG**: toman nombre, logo,
   dirección, contacto y licencia de la empresa que genera el reporte.
3. Tu empresa **Project Delivery Group queda ya llenada** con sus datos reales
   (Miami, licencia CGC1530498, etc.) — no tienes que escribir nada.
4. Empresas sin datos: el PDF sale con el logo koduPM y sin líneas de
   dirección (se ven limpios igual).

## Pasos (5 minutos)

### 1. Subir a GitHub
Descomprime el ZIP. En tu repo **kodu-app**: **Add file → Upload files** →
arrastra las **5 carpetas**: `app`, `components`, `lib`, `prisma`, `public`
→ **Commit changes**.

### 2. Esperar el despliegue
1-2 minutos en Vercel.

### 3. Crear las columnas nuevas (una sola vez)
Abre esta dirección en tu navegador:

  https://app.kodupm.com/api/internal/company-columns?key=kodupm-migrar-2026

Debes ver: **{"ok":true,...,"pdgSeeded":true}**

### 4. BORRAR el archivo temporal (obligatorio)
En GitHub: `app` → `api` → `internal` → `company-columns` → `route.ts` →
menú **⋮** (arriba a la derecha) → **Delete file** → **Commit changes**.
(Este archivo ya no se necesita y no debe quedar en el repo.)

### 5. Verificar
- Entra a **Configuración**: debes ver la tarjeta **"Datos de la empresa para
  reportes"** ya llena con los datos de PDG. Puedes editarlos y Guardar.
- Descarga el PDF de un **RFI** o un **Pay App**: el encabezado trae tu logo,
  el nombre de la empresa y la dirección; el G702 trae la licencia en la
  barra dorada.
