/**
 * lib/pdf.ts — Generación de PDF propia (reemplaza Abacus HTML→PDF)
 *
 * Antes: la app mandaba HTML a apps.abacus.ai/api/createConvertHtmlToPdfRequest
 * y hacía polling hasta que Abacus devolvía el PDF. Eso te ataba a Abacus
 * para CADA PDF (CORs, Pay Apps, RFIs, Schedules).
 *
 * Ahora: generamos el PDF nosotros con Puppeteer. Mismo input (HTML string),
 * mismo output (Buffer de PDF). Las rutas que llamaban a Abacus solo cambian
 * la función que invocan.
 *
 * Requiere en package.json:
 *   "puppeteer-core": "^23.0.0"
 *   "@sparticuz/chromium": "^131.0.0"   // Chromium para serverless/Vercel
 *
 * En local (desarrollo) usa el Chrome instalado; en Vercel usa @sparticuz/chromium.
 */

export type HtmlToPdfOptions = {
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'A4';
  landscape?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  scale?: number;
  width?: string;
  height?: string;
};

export async function htmlToPdf(html: string, options: HtmlToPdfOptions = {}): Promise<Buffer> {
  const isProd = process.env.NODE_ENV === 'production';

  let browser: any;

  if (isProd) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = await import('puppeteer-core');
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    const puppeteer = await import('puppeteer-core');
    const chromePaths = [
      process.env.CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean) as string[];

    let executablePath: string | undefined;
    const fs = await import('fs');
    for (const p of chromePaths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
    if (!executablePath) {
      throw new Error(
        'Chrome no encontrado. Instala Google Chrome o define CHROME_PATH en .env.local'
      );
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const pdfOptions: Record<string, unknown> = {
      printBackground: true,
      margin: options.margin ?? { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
    };

    if (options.width && options.height) {
      pdfOptions.width = options.width;
      pdfOptions.height = options.height;
    } else {
      pdfOptions.format = options.format ?? 'Letter';
      pdfOptions.landscape = options.landscape ?? false;
    }

    if (options.scale) pdfOptions.scale = options.scale;

    const pdf = await page.pdf(pdfOptions);
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * NOTA DE MIGRACIÓN para Cursor:
 * En cada ruta que tenía el patrón Abacus (createConvertHtmlToPdfRequest +
 * polling getConvertHtmlToPdfStatus), reemplazar TODO ese bloque por:
 *
 *   import { htmlToPdf } from '@/lib/pdf';
 *   const pdfBuffer = await htmlToPdf(htmlString);
 *   return new Response(pdfBuffer, {
 *     headers: {
 *       'Content-Type': 'application/pdf',
 *       'Content-Disposition': `attachment; filename="${filename}.pdf"`,
 *     },
 *   });
 *
 * El HTML que ya construyen esas rutas no cambia — solo cambia cómo se
 * convierte a PDF. Archivos afectados:
 *   - app/api/generate-pdf/[id]/route.ts          (COR)
 *   - app/api/pay-apps/[id]/pdf/route.ts          (Pay App G702/G703)
 *   - app/api/rfis/[id]/pdf/route.ts              (RFI)
 *   - app/api/projects/[id]/owner-executive/pdf/route.ts
 *   - app/api/schedules/[id]/pdf/route.ts
 *   - app/api/schedules/[id]/lookahead/pdf/route.ts
 */
