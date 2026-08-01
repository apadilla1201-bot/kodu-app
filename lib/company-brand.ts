import { prisma } from '@/lib/prisma';

/**
 * Marca de la empresa para reportes PDF (multi-tenant).
 *
 * - Lee el nombre y el logo de la empresa de la sesión.
 * - Si la empresa no tiene logo, se usa el logo de koduPM (/public/kodu-logo.png).
 * - El logo se envuelve en una placa azul marino (#0F1B33) para que se vea
 *   bien sobre cualquier fondo (varios logos, como el de PDG, son claros y
 *   están pensados para fondos oscuros).
 */
export type PdfBrand = {
  /** Nombre de la empresa (BD) o 'koduPM' como respaldo. */
  name: string;
  /** Nombre en mayúsculas, para encabezados. */
  nameUpper: string;
  /** HTML con el <img> del logo, listo para insertar en el encabezado del PDF. */
  logoHtml: string;
};

function escapeAttr(str: string): string {
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

  if (companyId) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, logoUrl: true },
      });
      if (company?.name) name = company.name;
      if (company?.logoUrl) {
        logoUrl = company.logoUrl.startsWith('/')
          ? `${base}${company.logoUrl}`
          : company.logoUrl;
      }
    } catch {
      // Si la consulta falla, el reporte sale con la marca koduPM.
    }
  }

  const src = logoUrl ?? `${base}/kodu-logo.png`;
  const alt = escapeAttr(logoUrl ? name : 'koduPM');
  const logoHtml =
    `<span style="display:inline-block;background:#0F1B33;padding:6px 12px;border-radius:6px;">` +
    `<img src="${src}" alt="${alt}" style="height:${logoHeight}px;width:auto;display:block;" />` +
    `</span>`;

  return { name, nameUpper: name.toUpperCase(), logoHtml };
}
