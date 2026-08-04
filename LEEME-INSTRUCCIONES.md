# ORDEN-Y-ENVIO — Orden en listas + Enviar al Owner + Owner's Rep

## 1. Orden ascendente / descendente
- **Change Orders**: ahora los encabezados CO #, Date y Total se pueden clicar
  para ordenar ↑ ascendente / ↓ descendente (flecha dorada).
- **RFIs**: ya tenían orden por columnas (clic en el encabezado).

## 2. Enviar al Owner para aprobación
### COR (ya lo hacía — ahora más claro)
- En el wizard, si pones el email del owner, el botón final dice
  **"Create & Send to Owner for Approval"**: crea el COR y le envía el email
  con enlace seguro para aprobar/rechazar.

### RFI (NUEVO)
- En el detalle de cualquier RFI hay un botón dorado **"Send to Owner"**
  (junto a Download PDF): pide email y nombre del aprobador y le envía el RFI
  con enlace seguro para verlo y responder.

### Regla de acceso (como pediste)
- **Sin cuenta koduPM**: el enlace seguro le permite ver y responder
  **SOLO ese documento** — la página lo dice expresamente ("you are reviewing
  only this RFI/change order"). No ve nada más del sistema.
- **Con cuenta koduPM**: el email incluye además el botón
  **"Open in my koduPM account"** para abrirlo dentro de la app, donde solo
  verá lo que sus credenciales/rol le permitan.

## 3. Asignación para Owner's Rep
- En Nuevo RFI, el campo "Assigned to / Role" ahora incluye la opción
  **Owner's Rep** (además de Owner, Architect, etc.). Puedes asignarle RFIs
  y se le envía el enlace seguro a su correo.

## Cómo subir (2 minutos)
1. Descomprime el ZIP.
2. Repo kodu-app → Add file → Upload files.
3. Arrastra las **3 carpetas**: `app`, `components`, `lib` → Commit changes.
4. Espera 1-2 minutos a Vercel.

## Verificar
1. Change Orders: clic en "CO #" y "Total" → ordena ↑↓.
2. Abre un RFI → botón **Send to Owner** → pon tu propio correo → te llega
   el email con el enlace seguro (ábrelo en ventana incógnita: solo ves ese RFI).
3. Nuevo RFI → campo Role → aparece **Owner's Rep**.
