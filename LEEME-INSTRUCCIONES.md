# MEJORAS 3 — Logos en PDFs corregidos + reportes nuevos + eliminar RFI

## Qué corrige / agrega

### 1. FIX: el logo ahora SÍ sale en los PDFs (RFI, Pay App, todos)
La causa: el generador de PDF imprimía la página ANTES de que el navegador
interno terminara de descargar la imagen del logo, y el encabezado salía vacío.
Ahora espera a que todas las imágenes carguen antes de imprimir.

### 2. NUEVO: botón "Delete" en el detalle del RFI
Junto al botón Download PDF. Pide confirmación. Solo admin/owner/PM pueden
borrar (el servidor lo valida).

### 3. NUEVO: reporte PDF de Budget
En el detalle de cualquier presupuesto (Budgets → abrir uno) aparece un ícono
de documento junto al basurero → descarga el PDF: logo y nombre de la empresa,
resumen financiero (Construction, Furnishings, O&P, GL, Contingency, TOTAL),
todas las partidas, exclusiones y supuestos. En el idioma de tu perfil.

### 4. NUEVO: reporte PDF de Buyout
En Buyout hay un botón "PDF" junto a Refresh → descarga la matriz completa
del proyecto seleccionado: resumen (presupuesto, contratado, CORs, invertido,
restante) y tabla por oficio con montos, estados y fechas. Hoja tamaño Tabloid
horizontal.

### 5. NUEVO: reporte PDF de Submittal
En el detalle de cualquier submittal hay un botón "PDF" junto al estado →
ficha completa: logo, datos, ball in court, descripción, respuesta, notas
y lista de adjuntos.

## Cómo subirlo (2 minutos)

1. Descomprime el ZIP.
2. Repo **kodu-app** → Add file → Upload files.
3. Arrastra las **2 carpetas**: `app` y `components` → Commit changes.
4. Espera 1-2 minutos a Vercel.

## Cómo verificar

1. Abre un **RFI** → Download PDF → ahora SÍ sale el logo de PDG arriba.
2. En ese mismo RFI: botón **Delete** rojo junto al PDF (no lo uses en uno real
   si no quieres borrarlo).
3. Abre un **Pay App** → PDF → logo visible.
4. Abre un **Budget** → ícono de documento (arriba a la derecha) → PDF completo.
5. Ve a **Buyout** → botón **PDF** → matriz del proyecto.
6. Abre un **Submittal** → botón **PDF** → ficha completa.

## Nota sobre info@kodupm.com
(Ver el mensaje del chat: el dominio kodupm.com NO tiene buzón de correo
activo todavía; hay que crearlo para que los correos de "cambio de plan"
lleguen de verdad.)
