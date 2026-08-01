# FIX — Completar datos PDG (2 minutos)

## Por qué
La migración anterior creó las columnas nuevas, pero NO llenó los datos de PDG
(pdgSeeded:false) porque tu empresa ya tenía algo escrito en "address" y la
primera versión se saltaba todo. Esta versión rellena solo los campos vacíos.

## Pasos

1. En el repo **kodu-app**: Add file → Upload files → arrastra la carpeta `app`
   → Commit changes. (Reemplaza el archivo temporal anterior.)
2. Espera 1-2 minutos a Vercel.
3. Abre: https://app.kodupm.com/api/internal/company-columns?key=kodupm-migrar-2026
   Debe decir "ok":true y mostrar tus datos en "pdg" (dirección, teléfono,
   web y licencia CGC1530498).
4. BORRA del repo estos DOS archivos temporales:
   - app/api/internal/company-columns/route.ts
   - app/api/internal/set-owner/route.ts   ← quedó pendiente del arreglo de tu rol
   (abrir archivo → menú ⋮ → Delete file → Commit; al borrar ambos,
   la carpeta internal desaparece sola)
5. Verifica en Configuración: la tarjeta "Datos de la empresa para reportes"
   debe salir llena. Luego descarga un PDF de RFI o Pay App.
