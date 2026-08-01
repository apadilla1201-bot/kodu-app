import { prisma } from '@/lib/prisma';

/**
 * Marca de la empresa para reportes PDF (multi-tenant).
 *
 * - Lee nombre, logo y datos de contacto de la empresa de la sesión.
 * - Sin logo → logo de koduPM (/public/kodu-logo.png).
 * - Sin dirección → las líneas de dirección/contacto simplemente no se imprimen.
 * - El logo va sobre una placa azul marino (#0F1B33) para que se vea bien en
 *   cualquier fondo (varios logos, como el de PDG, son claros y están pensados
 *   para fondos oscuros).
 */
export type PdfBrand = {
  /** Nombre de la empresa (BD) o 'koduPM' como respaldo. */
  name: string;
  /** Nombre en mayúsculas, para encabezados. */
  nameUpper: string;
  /** HTML con el <img> del logo, listo para insertar en el encabezado del PDF. */
  logoHtml: string;
  /** Calle y número (texto plano). */
  address: string | null;
  /** Ciudad, estado, CP (texto plano). */
  addressCity: string | null;
  /** "calle, ciudad" (texto plano — escapar al insertar). */
  addressFull: string | null;
  /** "calle<br/>ciudad" (HTML ya escapado, insertar directo). */
  addressHtml: string | null;
  phone: string | null;
  website: string | null;
  license: string | null;
  /** "calle · ciudad · tel · web" (texto plano — escapar al insertar). */
  contactLine: string | null;
};

function escText(str: string): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function getPdfBrand(
  companyId: string | null | undefined,
  baseUrl: string,
  logoHeight = 40,
): Promise<PdfBrand> {
  const base = (baseUrl || '').replace(/\/+$/, '');
  let name = 'koduPM';
  let logoUrl: string | null = null;
  let address: string | null = null;
  let addressCity: string | null = null;
  let phone: string | null = null;
  let website: string | null = null;
  let license: string | null = null;

  if (companyId) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          logoUrl: true,
          address: true,
          addressCity: true,
          phone: true,
          website: true,
          license: true,
        },
      });
      if (company) {
        if (company.name) name = company.name;
        if (company.logoUrl) {
          logoUrl = company.logoUrl.startsWith('/')
            ? `${base}${company.logoUrl}`
            : company.logoUrl;
        }
        address = company.address ?? null;
        addressCity = company.addressCity ?? null;
        phone = company.phone ?? null;
        website = company.website ?? null;
        license = company.license ?? null;
      }
    } catch {
      // Si la consulta falla, el reporte sale con la marca koduPM.
    }
  }

  const src = logoUrl ?? `${base}/kodu-logo.png`;
  const alt = escText(logoUrl ? name : 'koduPM');
  const logoHtml =
    `<span style="display:inline-block;background:#0F1B33;padding:6px 12px;border-radius:6px;">` +
    `<img src="${src}" alt="${alt}" style="height:${logoHeight}px;width:auto;display:block;" />` +
    `</span>`;

  const addrParts = [address, addressCity].filter(Boolean) as string[];
  const addressFull = addrParts.length ? addrParts.join(', ') : null;
  const addressHtml = addrParts.length ? addrParts.map(escText).join('<br/>') : null;
  const contactParts = [address, addressCity, phone, website].filter(Boolean) as string[];
  const contactLine = contactParts.length ? contactParts.join(' · ') : null;

  return {
    name,
    nameUpper: name.toUpperCase(),
    logoHtml,
    address,
    addressCity,
    addressFull,
    addressHtml,
    phone,
    website,
    license,
    contactLine,
  };
}
